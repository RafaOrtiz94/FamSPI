/**
 * Ficha tecnica de producto de un activo TI (PDF, descarga de un clic).
 *
 * Es la ficha del fabricante para el modelo del equipo + las fotos reales de
 * la unidad. NO lleva informacion interna (codigo de activo, estado,
 * asignacion, ubicacion, fechas, precios, mantenimiento, evaluaciones).
 *
 * Contenido (orden de prioridad): redaccion guardada (ti_assets.tech_spec_narrative)
 * -> redaccion con Claude por API (si hay credenciales) -> plantilla con las
 * caracteristicas registradas. El clic nunca queda sin PDF.
 */
const PDFDocument = require("pdfkit");
const db = require("../../config/db");
const logger = require("../../config/logger");

const SPEC_MODEL = "claude-opus-5-5";
const AI_TIMEOUT_MS = 75000;
const PHOTO_COLUMNS = [
  "initial_condition_photo_1_drive_file_id",
  "initial_condition_photo_2_drive_file_id",
];

function hasText(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

// characteristics es JSONB, pero la UI guarda texto libre ("RAM, disco...");
// puede llegar como string, como objeto {} o como objeto con claves.
function characteristicsToText(value) {
  if (!hasText(value) && typeof value !== "object") return "";
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => hasText(v));
    return entries.map(([k, v]) => `${k}: ${v}`).join("; ");
  }
  return String(value);
}

function productTitle(asset) {
  return [asset.brand, asset.model].filter((v) => hasText(v) && String(v).trim().toUpperCase() !== "N/A").join(" ");
}

async function loadAssetFacts(assetId) {
  const { rows } = await db.query(
    `SELECT * FROM public.ti_assets WHERE id = $1 AND active IS NOT FALSE LIMIT 1`,
    [assetId],
  );
  const asset = rows[0];
  if (!asset) {
    const error = new Error("Activo no encontrado");
    error.status = 404;
    throw error;
  }
  return {
    asset,
    // Solo datos del producto: nada interno.
    product: [
      ["Tipo de equipo", asset.name],
      ["Marca", asset.brand],
      ["Modelo", asset.model],
      ["Número de serie", asset.serial_number],
      ["IMEI", asset.imei],
    ].filter(([, value]) => hasText(value)),
    characteristicsText: characteristicsToText(asset.characteristics),
    photoFileIds: PHOTO_COLUMNS.map((column) => asset[column]).filter(hasText),
  };
}

// pdfkit solo incrusta JPEG y PNG: cualquier otra foto (HEIC, WebP) se omite.
function isEmbeddableImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  return isJpeg || isPng;
}

async function loadProductPhotos(facts) {
  if (!facts.photoFileIds.length) return [];
  const { downloadFileBuffer } = require("../../utils/drive");
  const photos = [];
  for (const fileId of facts.photoFileIds) {
    try {
      const buffer = await downloadFileBuffer(fileId);
      if (isEmbeddableImage(buffer)) photos.push(buffer);
      else logger.warn({ assetId: facts.asset.id, fileId }, "[TI_SPEC] Foto en formato no soportado por el PDF; se omite");
    } catch (error) {
      logger.warn({ assetId: facts.asset.id, fileId, error: error?.message }, "[TI_SPEC] No se pudo descargar la foto; se omite");
    }
  }
  return photos;
}

// ─── Redaccion (IA por API o guardada) ───────────────────────────────────────

const NARRATIVE_SCHEMA = {
  type: "object",
  properties: {
    descripcion_producto: { type: "string" },
    especificaciones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          componente: { type: "string" },
          valor: { type: "string" },
          // "fabricante": ficha tecnica del modelo; "registro": caracteristicas
          // registradas (equipos sin modelo comercial, p. ej. clones).
          fuente: { type: "string", enum: ["fabricante", "registro"] },
        },
        required: ["componente", "valor", "fuente"],
        additionalProperties: false,
      },
    },
    caracteristicas_destacadas: { type: "array", items: { type: "string" } },
    aplicaciones: { type: "string" },
  },
  required: ["descripcion_producto", "especificaciones", "caracteristicas_destacadas", "aplicaciones"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Redactas fichas tecnicas de producto de equipos tecnologicos, en espanol formal y claro. La ficha describe el producto en si, como la ficha tecnica del fabricante: nunca incluye informacion interna de la empresa (codigos de inventario, estado, asignacion, ubicacion, fechas, precios ni mantenimiento).

Fuente de las especificaciones: cuando la marca y el modelo identifican un producto comercial concreto, las especificaciones son las de la ficha del fabricante para ese modelo (fuente "fabricante"). Incluye solo valores de los que estes seguro para ese modelo exacto; si un valor depende de una variante o version que no se indico (por ejemplo, un sufijo de modelo), indicalo asi en lugar de elegir una. Si el equipo no tiene modelo comercial (ensamblado o clon, modelo "N/A"), usa solo las caracteristicas registradas (fuente "registro") y no completes con valores supuestos.

Contenido:
- "descripcion_producto": uno o dos parrafos sobre que es el producto, su categoria y sus capacidades principales.
- "especificaciones": filas componente/valor/fuente (por ejemplo "Tamano de pantalla", "Resolucion", "Procesador"). No repitas marca, modelo ni numero de serie, que ya se muestran en la ficha.
- "caracteristicas_destacadas": entre tres y seis frases cortas con las ventajas tecnicas del producto.
- "aplicaciones": un parrafo con los usos para los que el producto es adecuado y, si las tiene, sus limitaciones.`;

let anthropicClient = null;
function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return null;
  if (!anthropicClient) {
    const Anthropic = require("@anthropic-ai/sdk");
    anthropicClient = new Anthropic({ timeout: AI_TIMEOUT_MS, maxRetries: 1 });
  }
  return anthropicClient;
}

// Lo que recibe quien redacta: solo datos del producto.
function buildNarrativeInput(facts) {
  return {
    producto: Object.fromEntries(facts.product.filter(([label]) => label !== "Número de serie" && label !== "IMEI")),
    caracteristicas_registradas: facts.characteristicsText || null,
  };
}

async function generateNarrativeWithAI(facts) {
  const client = getAnthropicClient();
  if (!client) return null;

  const response = await client.beta.messages.create({
    model: SPEC_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: NARRATIVE_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Datos del producto (JSON):\n${JSON.stringify(buildNarrativeInput(facts), null, 2)}\n\nRedacta la ficha tecnica de este producto.`,
      },
    ],
  });

  if (response.stop_reason !== "end_turn") {
    throw new Error(`Redaccion IA incompleta (stop_reason=${response.stop_reason})`);
  }
  const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("");
  return JSON.parse(text);
}

// Respaldo sin redaccion: caracteristicas registradas, sin datos internos.
function buildTemplateNarrative(facts) {
  const { asset, characteristicsText } = facts;
  const title = productTitle(asset);
  const specs = [];
  if (characteristicsText) {
    characteristicsText.split(/[;,/\n]+/).map((part) => part.trim()).filter(Boolean).forEach((part) => {
      const [label, ...rest] = part.split(":");
      specs.push(rest.length
        ? { componente: label.trim(), valor: rest.join(":").trim(), fuente: "registro" }
        : { componente: "Característica", valor: part, fuente: "registro" });
    });
  }
  return {
    descripcion_producto: `${asset.name || "Equipo"}${title ? ` ${title}` : ""}.`,
    especificaciones: specs,
    caracteristicas_destacadas: [],
    aplicaciones: "",
  };
}

function isValidNarrative(value) {
  return Boolean(value && typeof value === "object" && hasText(value.descripcion_producto) && Array.isArray(value.especificaciones));
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

function renderSpecPdf({ facts, narrative, photos }) {
  const { asset, product } = facts;
  const title = productTitle(asset);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const W = 515;
    const LEFT = 40;

    const ensureSpace = (needed) => {
      if (doc.y + needed > 780) doc.addPage();
    };
    const sectionTitle = (text) => {
      ensureSpace(80); // titulo + primeras lineas juntos (sin titulos huerfanos)
      doc.moveDown(0.8);
      const y = doc.y;
      doc.rect(LEFT, y, 3, 14).fill("#2563EB");
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a").text(text, LEFT + 10, y + 1, { width: W - 10 });
      doc.moveDown(0.4);
    };
    const paragraph = (text) => {
      if (!hasText(text)) return;
      ensureSpace(30);
      doc.fontSize(9.5).font("Helvetica").fillColor("#1f2937").text(String(text), LEFT, doc.y, { width: W, align: "justify", lineGap: 2 });
    };
    const keyValueTable = (rowsKv, labelWidth = 170) => {
      rowsKv.forEach(([label, value], index) => {
        const valueText = String(value ?? "-");
        const height = Math.max(16, doc.heightOfString(valueText, { width: W - labelWidth - 12, fontSize: 8.5 }) + 6);
        ensureSpace(height);
        const y = doc.y;
        if (index % 2 === 0) doc.rect(LEFT, y, W, height).fill("#f8fafc");
        doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#334155").text(label, LEFT + 6, y + 4, { width: labelWidth - 8 });
        doc.fontSize(8.5).font("Helvetica").fillColor("#1f2937").text(valueText, LEFT + labelWidth, y + 4, { width: W - labelWidth - 12 });
        doc.y = y + height;
      });
    };

    // Encabezado: solo el producto.
    doc.rect(LEFT, 40, W, 62).fill("#1E293B");
    doc.fillColor("#94a3b8").fontSize(9).font("Helvetica").text("FICHA TÉCNICA", LEFT + 12, 50, { width: W - 24, characterSpacing: 1 });
    doc.fillColor("#ffffff").fontSize(16).font("Helvetica-Bold").text(title || asset.name || "Equipo", LEFT + 12, 63, { width: W - 24 });
    if (title && hasText(asset.name)) {
      doc.fontSize(9.5).font("Helvetica").fillColor("#cbd5e1").text(String(asset.name), LEFT + 12, 84, { width: W - 24 });
    }
    doc.y = 116;

    sectionTitle("Producto");
    keyValueTable(product);

    if (photos.length) {
      sectionTitle("Fotografías del equipo");
      const gap = 15;
      const boxW = photos.length > 1 ? (W - gap) / 2 : W;
      const boxH = 165;
      ensureSpace(boxH + 10);
      const y = doc.y;
      photos.slice(0, 2).forEach((buffer, index) => {
        const x = LEFT + index * (boxW + gap);
        doc.rect(x, y, boxW, boxH).fill("#f8fafc");
        try {
          doc.image(buffer, x + 4, y + 4, { fit: [boxW - 8, boxH - 8], align: "center", valign: "center" });
        } catch (error) {
          logger.warn({ assetId: asset.id, error: error?.message }, "[TI_SPEC] Foto no se pudo incrustar");
        }
      });
      doc.y = y + boxH + 4;
    }

    sectionTitle("Descripción");
    paragraph(narrative.descripcion_producto);

    sectionTitle("Especificaciones técnicas");
    const specs = Array.isArray(narrative.especificaciones) ? narrative.especificaciones : [];
    const fromManufacturer = (s) => s?.fuente === "fabricante";
    const mixedSources = specs.some(fromManufacturer) && specs.some((s) => !fromManufacturer(s));
    if (specs.length) {
      keyValueTable(specs.map((s) => [mixedSources && fromManufacturer(s) ? `${s.componente} *` : s.componente, s.valor]));
      doc.moveDown(0.3);
      const sourceNote = !specs.some(fromManufacturer)
        ? "Equipo sin modelo comercial: especificaciones según los componentes del equipo."
        : mixedSources
          ? `* Según la ficha técnica del fabricante para el modelo ${title}.`
          : `Especificaciones según la ficha técnica del fabricante para el modelo ${title}.`;
      doc.fontSize(7.5).font("Helvetica-Oblique").fillColor("#64748b").text(sourceNote, LEFT, doc.y, { width: W });
    } else {
      paragraph("Sin especificaciones técnicas disponibles para este equipo.");
    }

    const highlights = Array.isArray(narrative.caracteristicas_destacadas) ? narrative.caracteristicas_destacadas.filter(hasText) : [];
    if (highlights.length) {
      sectionTitle("Características destacadas");
      highlights.forEach((item) => {
        ensureSpace(16);
        doc.fontSize(9.5).font("Helvetica").fillColor("#1f2937").text(`•  ${item}`, LEFT + 8, doc.y, { width: W - 8, lineGap: 2 });
      });
    }

    if (hasText(narrative.aplicaciones)) {
      sectionTitle("Aplicaciones");
      paragraph(narrative.aplicaciones);
    }

    const footer = `${title || asset.name || "Equipo"}  ·  Ficha técnica`;
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i += 1) {
      doc.switchToPage(i);
      // El pie va dentro del margen inferior: sin esto pdfkit agrega una
      // pagina en blanco por cada pie escrito.
      doc.page.margins.bottom = 0;
      doc.fontSize(7).font("Helvetica").fillColor("#94a3b8")
        .text(`${footer}  ·  Página ${i + 1} de ${pageCount}`, LEFT, 805, { width: W, align: "center", lineBreak: false });
    }
    doc.end();
  });
}

function safeFilePart(value) {
  return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function generateAssetTechSpecPdf(assetId) {
  const facts = await loadAssetFacts(assetId);
  let narrative = isValidNarrative(facts.asset.tech_spec_narrative) ? facts.asset.tech_spec_narrative : null;
  if (!narrative) {
    try {
      narrative = await generateNarrativeWithAI(facts);
    } catch (error) {
      logger.warn({ assetId, error: error?.message }, "[TI_SPEC] Redaccion IA fallo; se usa plantilla");
    }
  }
  if (!narrative) narrative = buildTemplateNarrative(facts);

  const photos = await loadProductPhotos(facts);
  const pdfBuffer = await renderSpecPdf({ facts, narrative, photos });
  const name = [productTitle(facts.asset) || facts.asset.name, facts.asset.serial_number || facts.asset.id]
    .map(safeFilePart).filter(Boolean).join("-");
  return { pdfBuffer, filename: `Ficha-Tecnica-${name}.pdf`, photosIncluded: photos.length };
}

// Publica en Drive la ficha de cada activo con redaccion guardada:
// Activos TI / Especificaciones Tecnicas / <codigo> / Ficha-Tecnica-<...>.pdf
// Corre en Cloud Run (credenciales de Drive). dryRun=true solo lista.
async function publishStoredTechSpecs({ dryRun = true, assetIds = null } = {}) {
  const { ensureFolder, uploadBase64File } = require("../../utils/drive");
  const ids = Array.isArray(assetIds) && assetIds.length ? assetIds.map(Number).filter(Number.isInteger) : null;
  const { rows } = await db.query(
    `SELECT id, asset_code FROM public.ti_assets
      WHERE tech_spec_narrative IS NOT NULL AND active IS NOT FALSE
        AND ($1::bigint[] IS NULL OR id = ANY($1::bigint[]))
      ORDER BY id`,
    [ids],
  );
  const base = process.env.DRIVE_ROOT_FOLDER_ID || process.env.DRIVE_FOLDER_ID;
  if (!dryRun && !base) {
    const error = new Error("DRIVE_ROOT_FOLDER_ID no configurado");
    error.status = 500;
    throw error;
  }

  const results = [];
  let specsRootId = null;
  for (const row of rows) {
    if (dryRun) {
      results.push({ asset_id: row.id, asset_code: row.asset_code, published: false, reason: "dry_run" });
      continue;
    }
    try {
      if (!specsRootId) {
        const activosRoot = await ensureFolder("Activos TI", base);
        specsRootId = (await ensureFolder("Especificaciones Técnicas", activosRoot.id)).id;
      }
      const assetFolder = await ensureFolder(String(row.asset_code || row.id), specsRootId);
      const { pdfBuffer, filename, photosIncluded } = await generateAssetTechSpecPdf(row.id);
      const uploaded = await uploadBase64File(filename, pdfBuffer.toString("base64"), "application/pdf", assetFolder.id);
      const fileId = uploaded?.id || null;
      const url = uploaded?.webViewLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : null);
      await db.query(
        `UPDATE public.ti_assets SET tech_spec_drive_file_id = $2, tech_spec_drive_url = $3 WHERE id = $1`,
        [row.id, fileId, url],
      );
      results.push({ asset_id: row.id, asset_code: row.asset_code, published: true, photos: photosIncluded, drive_url: url });
    } catch (error) {
      logger.warn({ assetId: row.id, error: error?.message }, "[TI_SPEC] No se pudo publicar en Drive");
      results.push({ asset_id: row.id, asset_code: row.asset_code, published: false, error: error?.message || String(error) });
    }
  }
  return {
    dry_run: dryRun,
    total: results.length,
    published: results.filter((r) => r.published).length,
    failed: results.filter((r) => r.error).length,
    results,
  };
}

module.exports = {
  generateAssetTechSpecPdf,
  publishStoredTechSpecs,
  loadAssetFacts,
  buildNarrativeInput,
  isValidNarrative,
  NARRATIVE_SCHEMA,
  buildTemplateNarrative,
  characteristicsToText,
  isEmbeddableImage,
};
