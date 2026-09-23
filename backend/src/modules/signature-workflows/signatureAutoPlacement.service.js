/**
 * signatureAutoPlacement.service.js
 *
 * Fase 1 del mapeo automatico de firma: cuando el nombre completo de un firmante
 * aparece como texto real (no escaneado) en algun lugar del PDF fuente -- el caso
 * tipico de un listado/roster con una fila por persona (ej. F.RH-02) -- se detecta
 * esa fila sola y se calcula donde debe ir el sello, sin que el firmante tenga que
 * hacer clic. Si no se encuentra con confianza, se devuelve null y el firmante
 * sigue el flujo manual de siempre (ver signStep, que solo usa esta deteccion como
 * un prellenado opcional -- nunca es obligatoria).
 *
 * Motivado por un caso real: un firmante conto mal las filas en un listado de 29
 * personas y su firma quedo en la casilla de otra persona (ver evento
 * signature_placement_corrected del workflow 66).
 */

const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const logger = require("../../config/logger");

// Mismo margen usado por la hoja de evidencia (signatureWorkflows.pdf.js) --
// se reusa como aproximacion del margen derecho real de la pagina.
const PAGE_MARGIN_PT = 48;
// sigW/sigH de appendSignatureBlock -- el sello mide esto en puntos PDF.
const SIG_W = 110;

function stripAccents(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function normalizeTokens(value) {
  return stripAccents(value)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1); // descarta iniciales sueltas / ruido de 1 letra
}

// Agrupa los items de texto de una pagina en "lineas" visuales por su coordenada Y
// (misma logica que usa cualquier lector de PDF basado en texto: items con Y muy
// cercana pertenecen a la misma linea, sin importar el orden en que el PDF los liste).
function groupIntoLines(items, yTolerance = 2.5) {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const lines = [];
  for (const item of sorted) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= yTolerance);
    if (line) {
      line.items.push(item);
      line.y = (line.y * (line.items.length - 1) + item.y) / line.items.length;
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }
  return lines;
}

async function extractPages(pdfBytes) {
  // pdf.js exige Uint8Array puro -- un Buffer de Node (subclase de Uint8Array pero
  // con propiedades extra) lo rechaza con un warning y falla la extraccion.
  const data = pdfBytes instanceof Uint8Array && pdfBytes.constructor === Uint8Array
    ? pdfBytes
    : new Uint8Array(pdfBytes);
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter((item) => String(item.str || "").trim())
      .map((item) => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
      }));
    pages.push({ pageNumber, width: viewport.width, height: viewport.height, lines: groupIntoLines(items) });
  }
  return pages;
}

// Busca, entre todas las lineas de todas las paginas, la que contiene el nombre
// completo del firmante (orden de palabras y acentos no importan -- el PDF suele
// imprimir "Apellidos Nombres" y el sistema guarda "Nombres Apellidos", o viceversa).
// Exige que TODAS las palabras del nombre aparezcan en la linea, y que ninguna otra
// linea del documento tenga el mismo puntaje perfecto (evita falsos positivos con
// nombres parecidos/repetidos).
function findBestLine(pages, nameSnapshot) {
  const nameTokens = new Set(normalizeTokens(nameSnapshot));
  if (nameTokens.size < 2) return null; // nombre muy corto para matchear con confianza

  let best = null;
  let bestScore = 0;
  let tiesAtBest = 0;

  for (const page of pages) {
    for (const line of page.lines) {
      const lineText = line.items.map((item) => item.text).join(" ");
      const lineTokens = new Set(normalizeTokens(lineText));
      const matched = [...nameTokens].filter((token) => lineTokens.has(token)).length;
      const score = matched / nameTokens.size;
      if (score > bestScore) {
        bestScore = score;
        best = { page, line };
        tiesAtBest = 1;
      } else if (score === bestScore && score > 0) {
        tiesAtBest += 1;
      }
    }
  }

  if (bestScore < 1 || tiesAtBest > 1) return null;
  return best;
}

function computePlacementFromLine({ page, line }) {
  const rowRightEdge = Math.max(...line.items.map((item) => item.x + item.width));
  const pageRightContentEdge = page.width - PAGE_MARGIN_PT;
  // El sello se centra a medio camino entre donde termina el texto de la fila y el
  // margen derecho de la pagina -- ahi suele estar la celda de firma vacia en un
  // listado con columnas nombre/cedula/cargo/firma.
  const targetXPt = Math.min(
    Math.max((rowRightEdge + pageRightContentEdge) / 2, rowRightEdge + SIG_W / 2),
    pageRightContentEdge - SIG_W / 2,
  );

  const xPct = Math.min(1, Math.max(0, targetXPt / page.width));
  // y_pct se mide desde ARRIBA (misma convencion que signStep/appendSignatureBlock).
  const yPct = Math.min(1, Math.max(0, 1 - line.y / page.height));

  return { page_number: page.pageNumber, x_pct: xPct, y_pct: yPct };
}

/**
 * @param {Buffer|Uint8Array} pdfBytes
 * @param {string} nameSnapshot
 * @returns {Promise<{page_number:number,x_pct:number,y_pct:number}|null>}
 */
async function detectSignerPlacement(pdfBytes, nameSnapshot) {
  try {
    const pages = await extractPages(pdfBytes);
    const best = findBestLine(pages, nameSnapshot);
    if (!best) return null;
    return computePlacementFromLine(best);
  } catch (err) {
    logger.warn({ err: err.message }, "[signatureAutoPlacement] fallo la deteccion, se usara ubicacion manual");
    return null;
  }
}

/**
 * Version por lote: parsea el PDF UNA sola vez y matchea a todos los firmantes contra
 * ese mismo resultado. detectSignerPlacement (arriba) reparte esto en 29 parseos
 * completos del mismo PDF si se llama una vez por firmante -- caro y alarga sin
 * necesidad la transaccion de sendWorkflow, que mantiene bloqueada la fila del
 * workflow (FOR UPDATE) mientras corre.
 *
 * @param {Buffer|Uint8Array} pdfBytes
 * @param {Array<{id:number, name_snapshot:string}>} signers
 * @returns {Promise<Map<number, {page_number:number,x_pct:number,y_pct:number}>>} placements por signer.id (solo los detectados)
 */
async function detectPlacementsForDocument(pdfBytes, signers) {
  const results = new Map();
  let pages;
  try {
    pages = await extractPages(pdfBytes);
  } catch (err) {
    logger.warn({ err: err.message }, "[signatureAutoPlacement] no se pudo leer el PDF, se usara ubicacion manual para todos");
    return results;
  }
  for (const signer of signers) {
    try {
      const best = findBestLine(pages, signer.name_snapshot);
      if (best) results.set(signer.id, computePlacementFromLine(best));
    } catch (err) {
      logger.warn({ err: err.message, signerId: signer.id }, "[signatureAutoPlacement] fallo con un firmante, se usara ubicacion manual para el");
    }
  }
  return results;
}

module.exports = { detectSignerPlacement, detectPlacementsForDocument, normalizeTokens };
