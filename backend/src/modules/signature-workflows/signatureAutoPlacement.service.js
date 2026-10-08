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
// Altura aproximada de una fila de texto (en puntos), usada solo para dibujar
// el rectangulo de resaltado en el frontend -- no tenemos la metrica real de
// fuente de pdf.js aqui, asi que es una banda generosa alrededor de la
// baseline, no un calculo exacto de ascent/descent.
const LINE_HIGHLIGHT_PT = 14;
// Maximo de filas candidatas a surfacear cuando el nombre matchea mas de una
// fila (evita listas interminables si el PDF tiene nombres muy repetidos).
const MAX_AMBIGUOUS_CANDIDATES = 5;

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

// Recorre todas las lineas de todas las paginas y puntua cuantas palabras del
// nombre del firmante aparecen en cada una (orden y acentos no importan -- el
// PDF suele imprimir "Apellidos Nombres" y el sistema guarda "Nombres
// Apellidos", o viceversa). Devuelve el mejor puntaje encontrado y TODAS las
// lineas que lo alcanzaron con match perfecto (score === 1), para que quien
// llama decida que hacer con un empate en vez de perder esa informacion.
function scoreAllLines(pages, nameSnapshot) {
  const nameTokens = new Set(normalizeTokens(nameSnapshot));
  if (nameTokens.size < 2) return null; // nombre muy corto para matchear con confianza

  let bestScore = 0;
  const perfectMatches = [];

  for (const page of pages) {
    for (const line of page.lines) {
      const lineText = line.items.map((item) => item.text).join(" ");
      const lineTokens = new Set(normalizeTokens(lineText));
      const matched = [...nameTokens].filter((token) => lineTokens.has(token)).length;
      const score = matched / nameTokens.size;
      if (score > bestScore) bestScore = score;
      if (score === 1) perfectMatches.push({ page, line });
    }
  }

  return { bestScore, perfectMatches };
}

// Version "todo o nada": exige match perfecto y sin ambiguedad (una sola fila
// con score 1). Se mantiene igual que antes -- la usa detectSignerPlacement,
// el helper de un solo firmante, donde no hay forma de surfacear candidatos.
function findBestLine(pages, nameSnapshot) {
  const result = scoreAllLines(pages, nameSnapshot);
  if (!result || result.bestScore < 1 || result.perfectMatches.length !== 1) return null;
  return result.perfectMatches[0];
}

// Version que SI distingue un empate de un "no encontrado": la usa
// detectPlacementsForDocument para poder ofrecer las filas candidatas en vez
// de descartar la deteccion en silencio (ver Fase 1 del plan de mejoras).
function findLineMatches(pages, nameSnapshot) {
  const result = scoreAllLines(pages, nameSnapshot);
  if (!result || result.bestScore < 1) return null;
  if (result.perfectMatches.length === 1) return { type: "unique", ...result.perfectMatches[0] };
  return { type: "ambiguous", matches: result.perfectMatches.slice(0, MAX_AMBIGUOUS_CANDIDATES) };
}

function computePlacementFromLine({ page, line }) {
  const rowRightEdge = Math.max(...line.items.map((item) => item.x + item.width));
  const rowLeftEdge = Math.min(...line.items.map((item) => item.x));
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

  // Banda de resaltado (aproximada, ver LINE_HIGHLIGHT_PT) para que el
  // frontend pueda dibujar un rectangulo sobre la fila detectada -- asi el
  // firmante confirma visualmente "esta es mi fila" en vez de confiar a
  // ciegas en el sello ya puesto.
  const highlight = {
    x_min_pct: Math.min(1, Math.max(0, rowLeftEdge / page.width)),
    x_max_pct: Math.min(1, Math.max(0, pageRightContentEdge / page.width)),
    y_pct: Math.min(1, Math.max(0, 1 - (line.y + LINE_HIGHLIGHT_PT * 0.8) / page.height)),
    height_pct: Math.min(1, (LINE_HIGHLIGHT_PT * 1.15) / page.height),
  };

  const linePreview = line.items
    .map((item) => item.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70);

  return { page_number: page.pageNumber, x_pct: xPct, y_pct: yPct, line_preview: linePreview, highlight };
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
 * A diferencia de detectSignerPlacement, esta version SI distingue un empate
 * (nombre encontrado en 2+ filas) de un "no encontrado": en vez de descartar
 * la deteccion, devuelve las filas candidatas para que el firmante elija entre
 * un puñado de opciones en vez de buscar a ciegas en todo el documento.
 *
 * @param {Buffer|Uint8Array} pdfBytes
 * @param {Array<{id:number, name_snapshot:string}>} signers
 * @returns {Promise<Map<number, DetectionResult>>} resultado por signer.id (solo los que tuvieron algun match perfecto)
 *
 * DetectionResult =
 *   { type: 'unique', page_number, x_pct, y_pct, line_preview, highlight }
 *   | { type: 'ambiguous', candidates: Array<{page_number,x_pct,y_pct,line_preview,highlight}> }
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
      const found = findLineMatches(pages, signer.name_snapshot);
      if (!found) continue;
      if (found.type === "unique") {
        results.set(signer.id, { type: "unique", ...computePlacementFromLine(found) });
      } else {
        results.set(signer.id, {
          type: "ambiguous",
          candidates: found.matches.map((match) => computePlacementFromLine(match)),
        });
      }
    } catch (err) {
      logger.warn({ err: err.message, signerId: signer.id }, "[signatureAutoPlacement] fallo con un firmante, se usara ubicacion manual para el");
    }
  }
  return results;
}

module.exports = { detectSignerPlacement, detectPlacementsForDocument, normalizeTokens };
