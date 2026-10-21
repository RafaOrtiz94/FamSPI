/**
 * Extrae de la plantilla oficial (Mapeador_Sheets/TABLA BASE BC.xlsx, pestañas
 * "c303 c503" y " e402 e801") los parametros de la formula auditada de
 * cantidades de inmuno-quimica cobas: DET/KIT o presentacion, dias de
 * estabilidad y la formula de cada celda. El resultado se versiona en
 * calculationPackages/immunoChemistryCobasQuantities.data.json junto con el
 * SHA-256 del libro; si la plantilla cambia hay que regenerar y volver a auditar.
 *
 * Uso: node scripts/generate_cobas_quantity_package_data.js
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const WORKBOOK = path.join(__dirname, "..", "Mapeador_Sheets", "TABLA BASE BC.xlsx");
const OUTPUT = path.join(
  __dirname, "..", "src", "modules", "business-case", "calculationPackages",
  "immunoChemistryCobasQuantities.data.json",
);

// Columnas (base 0) por pestaña. En inmuno el encabezado dice "DESCRIPCION | I.D"
// pero los datos estan como I.D | descripcion, igual que en quimica.
const TABS = [
  { sheet: "c303 c503", module: "quimica", id: 0, name: 1, perKit: 3, stability: 4, calculated: 6, minimum: 7 },
  { sheet: " e402 e801", module: "inmuno", id: 0, name: 1, perKit: 2, stability: 3, calculated: 5, minimum: 6 },
];
const HEADER_ROW = 8;

function blockFromHeader(text) {
  const normalized = String(text || "").toUpperCase();
  if (normalized.includes("ELECTROLITOS")) return "ise";
  if (normalized.includes("CONTROLES Y CALIBRADORES")) return "calibrador_control";
  if (normalized.includes("CALIBRADORES")) return "calibrador";
  if (normalized.includes("CONTROLES")) return "control";
  if (normalized.includes("CONSUMIBLES")) return "consumible";
  return null;
}

function normalizeId(cell) {
  if (!cell) return null;
  const raw = typeof cell.v === "number" ? String(Math.round(cell.v)) : String(cell.v).trim();
  if (!raw) return null;
  return /^\d+$/.test(raw) ? raw.replace(/^0+(?=\d)/, "") : raw;
}

function positive(cell) {
  if (!cell) return null;
  const value = typeof cell.v === "number" ? cell.v : Number(String(cell.v).replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Las filas "c303"/"c503" y "e402"/"e801" son el mismo codigo para cada analizador.
function variantFromName(name) {
  const match = String(name || "").toLowerCase().match(/\b(c\s?303|c\s?503|e\s?402|e\s?801)\b/);
  return match ? match[1].replace(/\s/g, "") : null;
}

function extract() {
  const buffer = fs.readFileSync(WORKBOOK);
  const workbook = XLSX.read(buffer, { cellFormula: true });
  const rows = [];

  for (const tab of TABS) {
    const ws = workbook.Sheets[tab.sheet];
    if (!ws) throw new Error(`La plantilla no tiene la pestaña ${JSON.stringify(tab.sheet)}`);
    const lastRow = XLSX.utils.decode_range(ws["!ref"]).e.r + 1;
    const cell = (row, column) => ws[XLSX.utils.encode_cell({ r: row - 1, c: column })];
    const address = (row, column) => XLSX.utils.encode_cell({ r: row - 1, c: column });
    let block = "reactivo";

    for (let row = HEADER_ROW + 1; row <= lastRow; row += 1) {
      const idCell = cell(row, tab.id);
      const idText = idCell ? String(idCell.w ?? idCell.v ?? "").trim() : "";
      const headerBlock = blockFromHeader(idText);
      if (headerBlock) { block = headerBlock; continue; }
      const productId = normalizeId(idCell);
      const name = String(cell(row, tab.name)?.v ?? "").trim();
      if (!productId || !name) continue;

      const minimumCell = cell(row, tab.minimum);
      const minimumFormula = minimumCell?.f || null;
      rows.push({
        sheet: tab.sheet,
        module: tab.module,
        row,
        block,
        productId,
        // Un id numerico exportado en notacion cientifica pierde digitos: no identifica al producto.
        idUnreliable: Boolean(idCell && typeof idCell.v === "number" && /E\+/i.test(String(idCell.w || ""))),
        name,
        variant: variantFromName(name),
        perKit: positive(cell(row, tab.perKit)),
        stabilityDays: positive(cell(row, tab.stability)),
        // Quimica trae la formula en la celda; inmuno solo el valor, que equivale a 360/estabilidad.
        minimumNumerator: minimumFormula && /365/.test(minimumFormula) ? 365 : 360,
        minimumDividedByPerKit: Boolean(minimumFormula && /\/[A-Z]+\d+\)?\/[A-Z]+\d+/.test(minimumFormula)),
        cells: {
          perKit: address(row, tab.perKit),
          stability: address(row, tab.stability),
          calculated: address(row, tab.calculated),
          minimum: address(row, tab.minimum),
          deliverable: address(row, tab.minimum + 1),
        },
      });
    }
  }

  return {
    sourceWorkbook: {
      fileName: path.basename(WORKBOOK),
      sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    },
    rows,
  };
}

if (require.main === module) {
  const data = extract();
  fs.writeFileSync(OUTPUT, `${JSON.stringify(data, null, 1)}\n`);
  const count = (predicate) => data.rows.filter(predicate).length;
  console.log(`Plantilla ${data.sourceWorkbook.fileName} sha256=${data.sourceWorkbook.sha256}`);
  console.log(`${data.rows.length} filas -> ${path.relative(process.cwd(), OUTPUT)}`);
  for (const block of [...new Set(data.rows.map((row) => `${row.module}/${row.block}`))]) {
    console.log(`  ${block}: ${count((row) => `${row.module}/${row.block}` === block)}`);
  }
  console.log(`  sin estabilidad: ${count((row) => !row.stabilityDays)} | reactivos sin DET/KIT: ${count((row) => row.block === "reactivo" && !row.perKit)} | id no confiable: ${count((row) => row.idUnreliable)}`);
}

module.exports = { extract };
