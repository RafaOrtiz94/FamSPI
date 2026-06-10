/**
 * TI Assets — Acta de Entrega / Retiro de Equipos
 *
 * Fills ACTA-ET-2026-000001.pdf with:
 *   - nombre, cedula, cargo  (text fields: body page 1 + signature page 3)
 *   - tabla_equipos          (drawn manually — Times Roman, dynamic row heights,
 *                             real word-wrap via font.widthOfTextAtSize)
 */

const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs   = require("fs");
const path = require("path");

const TEMPLATE_ENTREGA = path.join(__dirname, "../../data/plantillas/ACTA-ET-2026-000001.pdf");

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

// tabla_equipos field geometry (PDF coords, origin bottom-left, Letter 612×792)
// Positioned: right after heading section, compact height, moved up
const TABLE = { x: 87.86, y: 340, width: 429.40, height: 160 };

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

function drawTableOnPage(page, items, fonts) {
  const { bold, regular } = fonts;
  const tableTop = TABLE.y + TABLE.height;

  // White background over flattened tabla_equipos field
  page.drawRectangle({
    x: TABLE.x, y: TABLE.y, width: TABLE.width, height: TABLE.height,
    color: rgb(1, 1, 1), borderColor: COLOR_BORDER, borderWidth: 0.5,
  });

  // ── Header ────────────────────────────────────────────────────────────────
  const headerY = tableTop - HEADER_H;
  page.drawRectangle({
    x: TABLE.x, y: headerY, width: TABLE.width, height: HEADER_H,
    color: COLOR_HEADER_BG,
  });

  let colX = TABLE.x;
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
    if (rowY < TABLE.y) break;

    // Alternating background
    if (idx % 2 === 1) {
      page.drawRectangle({
        x: TABLE.x, y: rowY, width: TABLE.width, height: rowHeight,
        color: COLOR_ROW_ALT,
      });
    }

    // Draw each cell (multi-line aware)
    let cellX = TABLE.x;
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
      start: { x: TABLE.x, y: rowY },
      end:   { x: TABLE.x + TABLE.width, y: rowY },
      thickness: 0.25, color: COLOR_SEP,
    });

    cursorY = rowY;
  }

  // ── Vertical column separators ────────────────────────────────────────────
  let sepX = TABLE.x;
  TABLE_COLS.slice(0, -1).forEach((col) => {
    sepX += col.width;
    page.drawLine({
      start: { x: sepX, y: TABLE.y },
      end:   { x: sepX, y: TABLE.y + TABLE.height },
      thickness: 0.25, color: COLOR_SEP,
    });
  });
}

// ─── Adaptive font size for text form fields ──────────────────────────────────

/**
 * Scales down font until text fits within maxWidth.
 * Uses Times Roman average glyph width (~0.52 * size) as estimate
 * (exact measurement requires the embedded font, which isn't available yet here).
 */
function adaptiveFontSize(text, maxWidth, { base = 10, min = 7 } = {}) {
  const len = String(text || "").length;
  if (!len) return base;
  let size = base;
  while (size > min && len * 0.52 * size > maxWidth) size -= 0.5;
  return Math.max(size, min);
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

  const boldFont    = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  const form = pdfDoc.getForm();

  // Field widths from PDF inspection (narrower page-3 signature fields are the constraint):
  //   nombre: 132.24pt  |  cedula: 119.10pt  |  cargo: 119.10pt
  // Extract only the sequential number from actaCode (e.g., "ACTA-ET-2026-000001" → "000001")
  const codigoMatch = String(actaCode || "ACTA-ET-2026-000001").match(/(\d{6})$/);
  const codigoText = codigoMatch ? codigoMatch[1] : "000001";

  const nombreText = String(nombre || "");
  const cedulaText = String(cedula || "");
  const cargoNormalText = String(cargo || "");              // Tal cual, sin mayúsculas
  const cargoMayusText  = String(cargo || "").toUpperCase(); // EN MAYÚSCULAS

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

  // Set font sizes where allowed — ALL fields 10pt for consistency
  codigoField.setFontSize(10);
  nombreField.setFontSize(10);
  cedulaField.setFontSize(10);
  cargoField.setFontSize(10);   // Ensure cargo is 10pt (not larger)
  if (diaField) diaField.setFontSize(10);
  if (mesField) mesField.setFontSize(10);
  if (anioField) anioField.setFontSize(10);
  // cargoN has predefined formatting, do not modify font size

  // Fill all fields
  codigoField.setText(codigoText);
  nombreField.setText(nombreText);
  cedulaField.setText(cedulaText);
  cargoField.setText(cargoNormalText);    // Superior: tal cual
  cargoNField.setText(cargoMayusText);    // Inferior: EN MAYÚSCULAS + NEGRITA

  // Fill immutable date fields
  if (diaField) diaField.setText(String(actaDay || "").padStart(2, "0"));
  if (mesField) mesField.setText(getMonthName(actaMonth));  // Nombre del mes en español (Enero, Febrero, etc.)
  if (anioField) anioField.setText(String(actaYear || ""));  // Año actual del momento de creación

  // Clear tabla_equipos — we draw over it
  const tablaField = form.getTextField("tabla_equipos");
  tablaField.setText("");
  tablaField.enableReadOnly();

  form.flatten();

  const page1 = pdfDoc.getPages()[0];
  drawTableOnPage(page1, items, { bold: boldFont, regular: regularFont });

  return Buffer.from(await pdfDoc.save());
}

module.exports = { generateActaEntregaPdf };
