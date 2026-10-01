/**
 * TI Assets — Acta de Entrega / Retiro de Equipos
 *
 * Fills ACTA-ET-2026-000001.pdf with:
 *   - nombre, cedula, cargo  (text fields: body page 1 + signature page 3)
 *   - tabla_equipos          (drawn manually — Times Roman, dynamic row heights,
 *                             real word-wrap via font.widthOfTextAtSize)
 */

const { PDFDocument, rgb, PDFName, PDFString } = require("pdf-lib");
const { loadTimesNewRoman } = require("../../assets/fonts");
const fs   = require("fs");
const path = require("path");

const TEMPLATE_ENTREGA = path.join(__dirname, "../../data/plantillas/ACTA-ET-2026-000001.pdf");
const TEMPLATE_RETIRO  = path.join(__dirname, "../../data/plantillas/ACTA-D-ET-2026-000001.pdf");

// Convert month number (1-12) to Spanish month name
const getMonthName = (monthNum) => {
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const idx = Number(monthNum) - 1;
  return idx >= 0 && idx < 12 ? months[idx] : String(monthNum);
};

// ─── Column layout (total = 429.40 pt — must match tabla_equipos field width) ─

const TABLE_COLS = [
  { label: "No.",              width: 22   },
  { label: "Equipo/Accesorio", width: 100  },
  { label: "Marca/Modelo",     width: 72   },
  { label: "Serie/IMEI",       width: 72   },
  { label: "Nuevo o Usado",    width: 55   },
  { label: "Estado (1-10)",    width: 40   },
  { label: "Observaciones",    width: 68.4 },
];
// 22 + 100 + 72 + 72 + 55 + 40 + 68.4 = 429.4 ✓

// tabla_equipos field geometry per template (measured from PDF inspection)
const TABLE        = { x: 90.5,  y: 362.4, width: 429.40, height: 153.6 }; // entrega
const TABLE_RETIRO = { x: 91.0,  y: 388.2, width: 429.40, height: 153.6 }; // retiro

// ─── Typography ───────────────────────────────────────────────────────────────

const FONT_H       = 9;    // header labels (bold, white on navy) — Times Roman
const FONT_D       = 8;    // data cells (regular, compact fit) — Times Roman
const LINE_H       = 10;   // leading between wrapped lines (pt)
const PAD_L        = 2;    // left cell padding
const PAD_V        = 1;    // vertical padding inside cell (top + bottom)
const MIN_ROW_H    = 12;   // minimum row height (single-line rows)
const HEADER_H     = 13;   // fixed header height

const COLOR_HEADER_BG = rgb(0.10, 0.17, 0.29); // navy — matches template header area
const COLOR_HEADER_FG = rgb(1, 1, 1);
const COLOR_ROW_ALT   = rgb(0.95, 0.96, 0.97);
const COLOR_TEXT      = rgb(0.08, 0.08, 0.08);
const COLOR_BORDER    = rgb(0.60, 0.60, 0.60);
const COLOR_SEP       = rgb(0.78, 0.78, 0.78);

// ─── Word-wrap ────────────────────────────────────────────────────────────────

/**
 * Wraps `text` into lines that fit within `maxWidth` using exact font metrics.
 * Returns at least one element (empty string if text is empty).
 */
function wrapText(font, text, maxWidth, fontSize) {
  const s = String(text || "").trim();
  if (!s) return ["-"];

  // If whole text fits, return as-is
  if (font.widthOfTextAtSize(s, fontSize) <= maxWidth) return [s];

  const words  = s.split(/\s+/);
  const lines  = [];
  let current  = "";

  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
      if (current) {
        lines.push(current);
        current = word;
      } else {
        // Single word wider than column — force-break
        lines.push(word);
        current = "";
      }
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
}

/**
 * Computes the wrapped lines for every cell in a data row,
 * and the resulting row height.
 */
function computeRowLayout(font, values, fontSize) {
  const cellLines = values.map((val, ci) => {
    const maxW = TABLE_COLS[ci].width - PAD_L * 2;
    return wrapText(font, val, maxW, fontSize);
  });
  const maxLineCount = Math.max(...cellLines.map((l) => l.length));
  const rowHeight    = Math.max(MIN_ROW_H, maxLineCount * LINE_H + PAD_V * 2);
  return { cellLines, rowHeight };
}

// ─── Table renderer ───────────────────────────────────────────────────────────

function drawTableOnPage(page, items, fonts, tableGeom = TABLE) {
  const { bold, regular } = fonts;
  const tableTop = tableGeom.y + tableGeom.height;

  // White background over flattened tabla field
  page.drawRectangle({
    x: tableGeom.x, y: tableGeom.y, width: tableGeom.width, height: tableGeom.height,
    color: rgb(1, 1, 1), borderColor: COLOR_BORDER, borderWidth: 0.5,
  });

  // ── Header ────────────────────────────────────────────────────────────────
  const headerY = tableTop - HEADER_H;
  page.drawRectangle({
    x: TABLE.x, y: headerY, width: TABLE.width, height: HEADER_H,
    color: COLOR_HEADER_BG,
  });

  let colX = tableGeom.x;
  TABLE_COLS.forEach((col) => {
    page.drawText(col.label, {
      x:        colX + PAD_L,
      y:        headerY + PAD_V,
      size:     FONT_H,
      font:     bold,
      color:    COLOR_HEADER_FG,
      maxWidth: col.width - PAD_L * 2,
      lineBreak: false,
    });
    colX += col.width;
  });

  page.drawLine({
    start: { x: TABLE.x, y: headerY },
    end:   { x: TABLE.x + TABLE.width, y: headerY },
    thickness: 0.6, color: COLOR_BORDER,
  });

  // ── Data rows ─────────────────────────────────────────────────────────────
  let cursorY = headerY; // top of current row (y decreases downward)

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];

    const values = [
      String(idx + 1),
      String(item.name || ""),
      String(item.brand_model || "-"),
      String(item.serial_imei || "-"),
      item.is_new ? "Nuevo" : "Usado",
      item.physical_condition != null ? `${item.physical_condition}/10` : "-",
      String(item.observations || "-"),
    ];

    const { cellLines, rowHeight } = computeRowLayout(regular, values, FONT_D);
    const rowY = cursorY - rowHeight; // bottom of this row

    // Stop if row would overflow the table boundary
    if (rowY < tableGeom.y) break;

    // Alternating background
    if (idx % 2 === 1) {
      page.drawRectangle({
        x: TABLE.x, y: rowY, width: TABLE.width, height: rowHeight,
        color: COLOR_ROW_ALT,
      });
    }

    // Draw each cell (multi-line aware)
    let cellX = tableGeom.x;
    TABLE_COLS.forEach((col, ci) => {
      const lines = cellLines[ci];
      lines.forEach((line, li) => {
        // Draw from top of row, stepping down by LINE_H per line
        const textY = cursorY - PAD_V - LINE_H * (li + 1) + (LINE_H - FONT_D);
        page.drawText(line, {
          x:        cellX + PAD_L,
          y:        textY,
          size:     FONT_D,
          font:     regular,
          color:    COLOR_TEXT,
          maxWidth: col.width - PAD_L * 2,
          lineBreak: false,
        });
      });
      cellX += col.width;
    });

    // Row bottom separator
    page.drawLine({
      start: { x: tableGeom.x, y: rowY },
      end:   { x: tableGeom.x + tableGeom.width, y: rowY },
      thickness: 0.25, color: COLOR_SEP,
    });

    cursorY = rowY;
  }

  // ── Vertical column separators ────────────────────────────────────────────
  let sepX = tableGeom.x;
  TABLE_COLS.slice(0, -1).forEach((col) => {
    sepX += col.width;
    page.drawLine({
      start: { x: sepX, y: tableGeom.y },
      end:   { x: sepX, y: tableGeom.y + tableGeom.height },
      thickness: 0.25, color: COLOR_SEP,
    });
  });
}

// ─── AcroForm field helpers ───────────────────────────────────────────────────

/**
 * Ensures a field has a /DA entry so updateAppearances() can create a valid
 * appearance stream. Fields without /DA (like cargoN) silently produce an
 * empty stream, causing the field to be invisible after flatten().
 */
function ensureDA(field) {
  const acro = field.acroField;
  if (!acro.dict.has(PDFName.of("DA"))) {
    acro.dict.set(PDFName.of("DA"), PDFString.of("/Helv 10 Tf 0 g"));
  }
}

/**
 * Patches per-widget /DA entries to a fixed font size.
 * Individual widgets can have their own /DA (e.g. "/Helv 0 Tf 0 g" for auto-size
 * or "/Helv 12 Tf 0 g" for 12pt) that override the field-level /DA set by
 * setFontSize(). This replaces the size component in those widget-level DAs
 * so that updateAppearances() renders all widgets at the same fixed size.
 */
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

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates the filled Acta de Entrega PDF.
 *
 * Data sources:
 *   actaCode → ti_asset_actas.acta_code (unique, auto-generated: ACTA-ET-2026-XXXXXX)
 *   nombre → users.fullname  (auto-populated from system when user is selected)
 *   cedula → collaborator_profiles.profile->'personal'->>'cedula'
 *   cargo  → collaborator_profiles.profile->'laboral'->>'cargo'
 *   actaDay, actaMonth, actaYear → ti_asset_actas (immutable, set at creation time)
 *   items  → ti_assets (main asset) + ti_asset_accessories (linked accessories)
 *
 * @param {string} params.actaCode Code (e.g., ACTA-ET-2026-000001)
 * @param {string} params.nombre   Full name (2 first + 2 last names)
 * @param {string} params.cedula   CI number
 * @param {string} params.cargo    Job title
 * @param {number} params.actaDay  Day (1-31) — immutable from acta creation
 * @param {number} params.actaMonth Month (1-12) — immutable from acta creation
 * @param {number} params.actaYear Year — immutable from acta creation
 * @param {Array}  params.items    Inventory rows
 * @returns {Promise<Buffer>}
 */
async function generateActaEntregaPdf({ actaCode = "ACTA-ET-2026-000001", nombre, cedula, cargo, actaDay, actaMonth, actaYear, items = [] }) {
  const templateBytes = fs.readFileSync(TEMPLATE_ENTREGA);
  const pdfDoc = await PDFDocument.load(templateBytes);

  const { bold: boldFont, reg: regularFont } = await loadTimesNewRoman(pdfDoc);

  const form = pdfDoc.getForm();

  // Field widths from PDF inspection (narrower page-3 signature fields are the constraint):
  //   nombre: 132.24pt  |  cedula: 119.10pt  |  cargo: 119.10pt
  // Extract only the sequential number from actaCode (e.g., "ACTA-ET-2026-000001" → "000001")
  const codigoMatch = String(actaCode || "ACTA-ET-2026-000001").match(/(\d{6})$/);
  const codigoText = codigoMatch ? codigoMatch[1] : "000001";

  const nombreText = String(nombre || "");
  const cedulaText = String(cedula || "");
  const cargoNormalText = String(cargo || "");              // Tal cual, sin mayúsculas
  const cargoMayusText  = splitCargoForSignature(String(cargo || "").toUpperCase()); // EN MAYÚSCULAS

  const codigoField = form.getTextField("codigo");
  const nombreField = form.getTextField("nombre");
  const cedulaField = form.getTextField("cedula");
  const cargoField  = form.getTextField("cargo");    // Superior, SIN negrita, SIN mayúsculas
  const cargoNField = form.getTextField("cargoN");   // Inferior, CON negrita, EN MAYÚSCULAS

  // Date fields (immutable once created)
  let diaField, mesField, anioField;
  try {
    diaField = form.getTextField("dia");
  } catch (e) {
    diaField = null;
  }
  try {
    mesField = form.getTextField("mes");
  } catch (e) {
    mesField = null;
  }
  try {
    anioField = form.getTextField("anio");
  } catch (e) {
    anioField = null;
  }

  // Fill fields — Times New Roman TTF, fixed 10pt
  // fixWidgetDAs patches per-widget /DA overrides (e.g. page-3 widgets with "0 Tf")
  // before updateAppearances() reads them to determine the rendered font size.
  for (const [field, val, font] of [
    [codigoField, codigoText,      regularFont],
    [nombreField, nombreText,      regularFont],
    [cedulaField, cedulaText,      regularFont],
    [cargoField,  cargoNormalText, regularFont],
  ]) {
    field.setText(val);
    field.setFontSize(10);
    fixWidgetDAs(field, 10);
    field.updateAppearances(font);
  }

  // cargoN has no /DA in template — inject dummy so updateAppearances creates a valid stream
  try {
    ensureDA(cargoNField);
    try { cargoNField.enableMultiline(); } catch (_) {}
    cargoNField.setText(cargoMayusText);
    cargoNField.setFontSize(10);
    fixWidgetDAs(cargoNField, 10);
    cargoNField.updateAppearances(boldFont);
  } catch (_) {}

  if (diaField)  { diaField.setText(String(actaDay  || "").padStart(2, "0")); diaField.setFontSize(10); fixWidgetDAs(diaField, 10); diaField.updateAppearances(regularFont); }
  if (mesField)  { mesField.setText(getMonthName(actaMonth)); mesField.setFontSize(10); fixWidgetDAs(mesField, 10); mesField.updateAppearances(regularFont); }
  if (anioField) { anioField.setText(String(actaYear || "")); anioField.setFontSize(10); fixWidgetDAs(anioField, 10); anioField.updateAppearances(regularFont); }

  // Clear tabla_equipos — we draw over it
  const tablaField = form.getTextField("tabla_equipos");
  tablaField.setText("");
  tablaField.enableReadOnly();

  form.flatten();

  const page1 = pdfDoc.getPages()[0];
  drawTableOnPage(page1, items, { bold: boldFont, regular: regularFont });

  return Buffer.from(await pdfDoc.save());
}

/**
 * Generates the filled Acta de Retiro/Devolución PDF (ACTA-D-ET template).
 */
async function generateActaRetiroPdf({ actaCode = "ACTA-D-ET-2026-000001", nombre, cedula, cargo, actaDay, actaMonth, actaYear, items = [] }) {
  const templateBytes = fs.readFileSync(TEMPLATE_RETIRO);
  const pdfDoc = await PDFDocument.load(templateBytes);

  const { bold: boldFont, reg: regularFont } = await loadTimesNewRoman(pdfDoc);

  const form = pdfDoc.getForm();

  const codigoMatch = String(actaCode || "").match(/(\d{6})$/);
  const codigoText  = codigoMatch ? codigoMatch[1] : "000001";

  const nombreText      = String(nombre || "");
  const cedulaText      = String(cedula || "");
  const cargoNormalText = String(cargo || "");
  const cargoMayusText  = splitCargoForSignature(String(cargo || "").toUpperCase());

  // Set fields with explicit font size where /DA exists
  const codigoField = form.getTextField("codigo");
  const nombreField = form.getTextField("nombre");
  const cedulaField = form.getTextField("cedula");
  const cargoField  = form.getTextField("cargo");
  const cargoNField = form.getTextField("cargoN"); // no /DA → setText only, no setFontSize

  let diaField, mesField, anioField;
  try { diaField  = form.getTextField("dia");  } catch (_) { diaField  = null; }
  try { mesField  = form.getTextField("mes");  } catch (_) { mesField  = null; }
  try { anioField = form.getTextField("anio"); } catch (_) { anioField = null; }

  for (const [field, val, font] of [
    [codigoField, codigoText,      regularFont],
    [nombreField, nombreText,      regularFont],
    [cedulaField, cedulaText,      regularFont],
    [cargoField,  cargoNormalText, regularFont],
  ]) {
    field.setText(val);
    field.setFontSize(10);
    fixWidgetDAs(field, 10);
    field.updateAppearances(font);
  }

  // cargoN has no /DA in template — inject dummy so updateAppearances creates a valid stream
  try {
    ensureDA(cargoNField);
    try { cargoNField.enableMultiline(); } catch (_) {}
    cargoNField.setText(cargoMayusText);
    cargoNField.setFontSize(10);
    fixWidgetDAs(cargoNField, 10);
    cargoNField.updateAppearances(boldFont);
  } catch (_) {}

  if (diaField)  { diaField.setText(String(actaDay  || new Date().getDate()).toString().padStart(2, "0")); diaField.setFontSize(10); fixWidgetDAs(diaField, 10); diaField.updateAppearances(regularFont); }
  if (mesField)  { mesField.setText(getMonthName(actaMonth || (new Date().getMonth() + 1))); mesField.setFontSize(10); fixWidgetDAs(mesField, 10); mesField.updateAppearances(regularFont); }
  if (anioField) { anioField.setText(String(actaYear || new Date().getFullYear())); anioField.setFontSize(10); fixWidgetDAs(anioField, 10); anioField.updateAppearances(regularFont); }

  const tablaField = form.getTextField("tabla_equipos");
  tablaField.setText("");
  tablaField.enableReadOnly();

  form.flatten();

  const page1 = pdfDoc.getPages()[0];
  drawTableOnPage(page1, items, { bold: boldFont, regular: regularFont }, TABLE_RETIRO);

  return Buffer.from(await pdfDoc.save());
}

module.exports = { generateActaEntregaPdf, generateActaRetiroPdf };
