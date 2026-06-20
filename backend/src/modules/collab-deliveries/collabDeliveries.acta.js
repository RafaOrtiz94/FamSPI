/**
 * Collab Deliveries — Acta de Entrega: Herramientas y Ropa de Trabajo
 *
 * Fills:
 *   ACTA-H-2026-HT.pdf   → tabla_herramientas
 *   ACTA U-2026-ROPA.pdf → tabla_ropa
 *
 * Common fields (same names as TI templates):
 *   codigo, nombre, cedula, cargo, cargoN, dia, mes, anio
 *
 * cargoN has no /DA entry → setText only, no setFontSize.
 */

const { PDFDocument, rgb, PDFName, PDFString } = require("pdf-lib");
const { loadTimesNewRoman } = require("../../assets/fonts");
const fs   = require("fs");
const path = require("path");

const TEMPLATE_HT   = path.join(__dirname, "../../data/plantillas/ACTA-H-2026-HT.pdf");
const TEMPLATE_ROPA = path.join(__dirname, "../../data/plantillas/ACTA U-2026-ROPA.pdf");

const getMonthName = (monthNum) => {
  const months = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
  ];
  const idx = Number(monthNum) - 1;
  return idx >= 0 && idx < 12 ? months[idx] : String(monthNum);
};

// ─── Herramienta columns (total width = 429.4 pt) ────────────────────────────
const TABLE_COLS_HT = [
  { label: "No.",               width: 22   },
  { label: "Herramienta",       width: 100  },
  { label: "Marca",             width: 72   },
  { label: "Características",   width: 72   },
  { label: "N° de serie",       width: 62   },
  { label: "Condición (1-10)",  width: 40   },
  { label: "Observaciones",     width: 61.4 },
];
// 22+100+72+72+62+40+61.4 = 429.4 ✓

// ─── Ropa columns (total width = 429.4 pt) ───────────────────────────────────
const TABLE_COLS_ROPA = [
  { label: "No.",          width: 22   },
  { label: "Prenda",       width: 140  },
  { label: "Talla",        width: 50   },
  { label: "Cantidad",     width: 50   },
  { label: "Estado",       width: 50   },
  { label: "Observaciones", width: 117.4 },
];
// 22+140+50+50+50+117.4 = 429.4 ✓

// ─── Table field geometry (measured from PDF inspection) ─────────────────────
const TABLE_HT   = { x: 91.0, y: 371.2, width: 429.4, height: 153.6 };
const TABLE_ROPA = { x: 91.0, y: 388.2, width: 429.4, height: 153.6 };

// ─── Typography ───────────────────────────────────────────────────────────────
const FONT_H    = 9;
const FONT_D    = 8;
const LINE_H    = 10;
const PAD_L     = 2;
const PAD_V     = 1;
const MIN_ROW_H = 12;
const HEADER_H  = 13;

const COLOR_HEADER_BG = rgb(0.10, 0.17, 0.29);
const COLOR_HEADER_FG = rgb(1, 1, 1);
const COLOR_ROW_ALT   = rgb(0.95, 0.96, 0.97);
const COLOR_TEXT      = rgb(0.08, 0.08, 0.08);
const COLOR_BORDER    = rgb(0.60, 0.60, 0.60);
const COLOR_SEP       = rgb(0.78, 0.78, 0.78);

// ─── Word-wrap ────────────────────────────────────────────────────────────────
function wrapText(font, text, maxWidth, fontSize) {
  const s = String(text || "").trim();
  if (!s) return ["N/A"];
  if (font.widthOfTextAtSize(s, fontSize) <= maxWidth) return [s];
  const words = s.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
      if (current) { lines.push(current); current = word; }
      else         { lines.push(word);    current = ""; }
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["N/A"];
}

function computeRowLayout(font, values, cols, fontSize) {
  const cellLines = values.map((val, ci) =>
    wrapText(font, val, cols[ci].width - PAD_L * 2, fontSize)
  );
  const maxLineCount = Math.max(...cellLines.map((l) => l.length));
  return { cellLines, rowHeight: Math.max(MIN_ROW_H, maxLineCount * LINE_H + PAD_V * 2) };
}

// ─── Table renderer ───────────────────────────────────────────────────────────
function drawTableOnPage(page, items, cols, table, fonts) {
  const { bold, regular } = fonts;
  const tableTop = table.y + table.height;

  page.drawRectangle({
    x: table.x, y: table.y, width: table.width, height: table.height,
    color: rgb(1, 1, 1), borderColor: COLOR_BORDER, borderWidth: 0.5,
  });

  // Header
  const headerY = tableTop - HEADER_H;
  page.drawRectangle({ x: table.x, y: headerY, width: table.width, height: HEADER_H, color: COLOR_HEADER_BG });

  let colX = table.x;
  cols.forEach((col) => {
    page.drawText(col.label, {
      x: colX + PAD_L, y: headerY + PAD_V,
      size: FONT_H, font: bold, color: COLOR_HEADER_FG,
      maxWidth: col.width - PAD_L * 2, lineBreak: false,
    });
    colX += col.width;
  });

  page.drawLine({
    start: { x: table.x, y: headerY },
    end:   { x: table.x + table.width, y: headerY },
    thickness: 0.6, color: COLOR_BORDER,
  });

  // Data rows
  let cursorY = headerY;

  for (let idx = 0; idx < items.length; idx++) {
    const item  = items[idx];
    const attrs = (typeof item.attributes_summary === "object" && item.attributes_summary) ? item.attributes_summary : {};
    const values = cols.map((col, ci) => {
      if (ci === 0) return String(idx + 1);
      return item._rowValues?.[ci - 1] ?? "-";
    });
    // Filled from outside via _rowValues
    const { cellLines, rowHeight } = computeRowLayout(regular, values, cols, FONT_D);
    const rowY = cursorY - rowHeight;
    if (rowY < table.y) break;

    if (idx % 2 === 1) {
      page.drawRectangle({ x: table.x, y: rowY, width: table.width, height: rowHeight, color: COLOR_ROW_ALT });
    }

    let cellX = table.x;
    cols.forEach((col, ci) => {
      const lines = cellLines[ci];
      lines.forEach((line, li) => {
        page.drawText(line, {
          x: cellX + PAD_L,
          y: cursorY - PAD_V - LINE_H * (li + 1) + (LINE_H - FONT_D),
          size: FONT_D, font: regular, color: COLOR_TEXT,
          maxWidth: col.width - PAD_L * 2, lineBreak: false,
        });
      });
      cellX += col.width;
    });

    page.drawLine({
      start: { x: table.x, y: rowY }, end: { x: table.x + table.width, y: rowY },
      thickness: 0.25, color: COLOR_SEP,
    });
    cursorY = rowY;
  }

  // Vertical column separators
  let sepX = table.x;
  cols.slice(0, -1).forEach((col) => {
    sepX += col.width;
    page.drawLine({
      start: { x: sepX, y: table.y }, end: { x: sepX, y: table.y + table.height },
      thickness: 0.25, color: COLOR_SEP,
    });
  });
}

// ─── AcroForm field helpers ───────────────────────────────────────────────────

function ensureDA(field) {
  const acro = field.acroField;
  if (!acro.dict.has(PDFName.of("DA"))) {
    acro.dict.set(PDFName.of("DA"), PDFString.of("/Helv 10 Tf 0 g"));
  }
}

function fixWidgetDAs(field, size = 10) {
  for (const widget of field.acroField.getWidgets()) {
    const da = widget.dict.get(PDFName.of("DA"));
    if (!da) continue;
    const raw = da.decodeText ? da.decodeText() : String(da);
    const fixed = raw.replace(/([\d.]+)\s+Tf/, `${size} Tf`);
    widget.dict.set(PDFName.of("DA"), PDFString.of(fixed));
  }
}

function splitCargoForSignature(value, maxCharsPerLine = 28) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || text.length <= maxCharsPerLine) return text;

  const beforeLimit = text.lastIndexOf(" ", maxCharsPerLine);
  const afterLimit = text.indexOf(" ", maxCharsPerLine + 1);
  const splitIndex = beforeLimit > 0 ? beforeLimit : afterLimit;
  if (splitIndex <= 0) return text;

  const firstLine = text.slice(0, splitIndex).trim();
  const secondLine = text.slice(splitIndex + 1).trim();
  return secondLine ? `${firstLine}\n${secondLine}` : firstLine;
}

// ─── Shared field filler ──────────────────────────────────────────────────────
async function _fillCommonFields(form, { actaCode, nombre, cedula, cargo, actaDay, actaMonth, actaYear }, fonts) {
  const { bold: boldFont, reg: regularFont } = fonts || {};
  const codigoMatch = String(actaCode || "").match(/(\d{6})$/);
  const codigoText  = codigoMatch ? codigoMatch[1] : "000001";

  const nombreText      = String(nombre || "");
  const cedulaText      = String(cedula || "");
  const cargoNormalText = String(cargo  || "");
  const cargoMayusText  = splitCargoForSignature(String(cargo  || "").toUpperCase());

  const day  = String(actaDay  || new Date().getDate()).padStart(2, "0");
  const mes  = getMonthName(actaMonth || (new Date().getMonth() + 1));
  const anio = String(actaYear || new Date().getFullYear());

  // Fields with /DA — Times New Roman TTF, fixed 10pt
  // fixWidgetDAs patches per-widget /DA overrides (e.g. "0 Tf" or "12 Tf") before
  // updateAppearances() reads them to determine the rendered font size.
  for (const [name, val] of [
    ["codigo", codigoText], ["nombre", nombreText], ["cedula", cedulaText],
    ["cargo", cargoNormalText], ["dia", day], ["mes", mes], ["anio", anio],
  ]) {
    try {
      const f = form.getTextField(name);
      f.setText(val);
      f.setFontSize(10);
      fixWidgetDAs(f, 10);
      if (regularFont) f.updateAppearances(regularFont);
    } catch (_) {}
  }

  // cargoN has no /DA — inject dummy entry so updateAppearances creates a valid 10pt bold stream
  try {
    const cargoNField = form.getTextField("cargoN");
    ensureDA(cargoNField);
    try { cargoNField.enableMultiline(); } catch (_) {}
    cargoNField.setText(cargoMayusText);
    cargoNField.setFontSize(10);
    fixWidgetDAs(cargoNField, 10);
    if (boldFont) cargoNField.updateAppearances(boldFont);
  } catch (_) {}
}

// ─── Herramienta ─────────────────────────────────────────────────────────────

/**
 * @param {string}  params.actaCode
 * @param {string}  params.nombre
 * @param {string}  params.cedula
 * @param {string}  params.cargo
 * @param {number}  params.actaDay
 * @param {number}  params.actaMonth
 * @param {number}  params.actaYear
 * @param {Array}   params.items  — rows from collab_delivery_actas_items
 *   Each item: { name, attributes_summary: { marca, caracteristicas }, serial_number, physical_condition, observations }
 */
async function generateActaHerramientaPdf({ actaCode = "", nombre, cedula, cargo, actaDay, actaMonth, actaYear, items = [] }) {
  const templateBytes = fs.readFileSync(TEMPLATE_HT);
  const pdfDoc = await PDFDocument.load(templateBytes);

  const fonts = await loadTimesNewRoman(pdfDoc);
  const { bold: boldFont, reg: regularFont } = fonts;
  const form = pdfDoc.getForm();

  await _fillCommonFields(form, { actaCode, nombre, cedula, cargo, actaDay, actaMonth, actaYear }, fonts);

  // Clear the tabla field
  try {
    const t = form.getTextField("tabla_herramientas");
    t.setText("");
    t.enableReadOnly();
  } catch (_) {}

  form.flatten();

  // Build row values for herramienta columns (col 0 = No. filled automatically)
  const richItems = items.map((item) => {
    let a = {};
    try {
      a = typeof item.attributes_summary === "object" && item.attributes_summary
        ? item.attributes_summary
        : JSON.parse(item.attributes_summary || "{}");
    } catch (_) {}
    item._rowValues = [
      String(item.name || ""),
      a.marca           ? String(a.marca)           : "N/A",
      a.caracteristicas ? String(a.caracteristicas) : "N/A",
      item.serial_number ? String(item.serial_number) : "N/A",
      item.physical_condition != null ? `${item.physical_condition}/10` : "N/A",
      item.observations ? String(item.observations) : "N/A",
    ];
    return item;
  });

  const page1 = pdfDoc.getPages()[0];
  drawTableOnPage(page1, richItems, TABLE_COLS_HT, TABLE_HT, { bold: boldFont, regular: regularFont });

  return Buffer.from(await pdfDoc.save());
}

// ─── Ropa ─────────────────────────────────────────────────────────────────────

/**
 * @param {Array} params.items — rows from collab_delivery_actas_items
 *   Each item: { name, attributes_summary: { talla, cantidad }, observations }
 */
async function generateActaRopaPdf({ actaCode = "", nombre, cedula, cargo, actaDay, actaMonth, actaYear, items = [] }) {
  const templateBytes = fs.readFileSync(TEMPLATE_ROPA);
  const pdfDoc = await PDFDocument.load(templateBytes);

  const fonts = await loadTimesNewRoman(pdfDoc);
  const { bold: boldFont, reg: regularFont } = fonts;
  const form = pdfDoc.getForm();

  await _fillCommonFields(form, { actaCode, nombre, cedula, cargo, actaDay, actaMonth, actaYear }, fonts);

  try {
    const t = form.getTextField("tabla_ropa");
    t.setText("");
    t.enableReadOnly();
  } catch (_) {}

  form.flatten();

  const richItems = items.map((item) => {
    let a = {};
    try {
      a = typeof item.attributes_summary === "object" && item.attributes_summary
        ? item.attributes_summary
        : JSON.parse(item.attributes_summary || "{}");
    } catch (_) {}
    item._rowValues = [
      String(item.name || ""),
      a.talla    ? String(a.talla)    : "N/A",
      a.cantidad ? String(a.cantidad) : "N/A",
      item.is_new != null ? (item.is_new ? "Nuevo" : "Usado") : "N/A",
      item.observations ? String(item.observations) : "N/A",
    ];
    return item;
  });

  const page1 = pdfDoc.getPages()[0];
  drawTableOnPage(page1, richItems, TABLE_COLS_ROPA, TABLE_ROPA, { bold: boldFont, regular: regularFont });

  return Buffer.from(await pdfDoc.save());
}

module.exports = { generateActaHerramientaPdf, generateActaRopaPdf };
