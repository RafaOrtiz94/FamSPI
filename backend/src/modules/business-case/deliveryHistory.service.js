/**
 * Historial de entregas reales del proceso anterior del mismo cliente (control de consumibles
 * entregados). Es la verdad del motor: con el se calibra la simulacion y, si el cliente repite, se
 * predice su consumo. PRODUCTO A ENTREGAR del Sheet es el calculo del especialista, no la verdad.
 *
 * Formato leido (ver docs/IESS LATACUNGA- INMUNOQUIMICA 2024.xlsx): una hoja por area (INMUNO,
 * QUIMICA); secciones CALIBRADORES / CONTROLES / CONSUMIBLES; columnas ID, producto, cantidades
 * maximas por caja y por unidades, presentacion, TOTAL ENTREGADOS (en unidades), restantes; luego
 * una columna por fecha de entrega y columnas "Stock <fecha>".
 */

const XLSX = require("xlsx");
const db = require("../../config/db");

const SECTION_TYPES = Object.freeze({ CALIBRADORES: "calibrador", CONTROLES: "control", CONSUMIBLES: "material" });
const DAY_MS = 86400000;

const normalizeCode = (value) => String(value ?? "").replace(/\D/g, "").replace(/^0+/, "");
const excelDate = (serial) => new Date(Math.round((serial - 25569) * DAY_MS));
const isDateHeader = (value) => typeof value === "number" && value > 40000 && value < 60000;
const httpError = (status, code, message) => Object.assign(new Error(message), { status, statusCode: status, code });

/**
 * Periodo cubierto: de la primera a la ultima entrega, mas el intervalo medio entre entregas (la
 * ultima entrega cubre el tiempo que sigue). Las columnas van en orden cronologico: una fecha anterior
 * a otra ya vista es un error de tipeo (ej. 2024-02-28 entre fechas de 2025) y se ignora.
 */
function periodOf(datesInColumnOrder) {
  const valid = [];
  datesInColumnOrder.forEach((date) => { if (!valid.length || date >= valid[valid.length - 1]) valid.push(date); });
  if (!valid.length) return null;
  const start = valid[0];
  const end = valid[valid.length - 1];
  const gap = valid.length > 1 ? (end - start) / (valid.length - 1) : 30 * DAY_MS;
  const months = ((end - start) + gap) / (30.4 * DAY_MS);
  return { start, end, months: Number(months.toFixed(2)) };
}

/** Puro. Lee el archivo de control de entregas. */
function parseControlFile(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const items = [];
  workbook.SheetNames.forEach((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
    const header = rows[0] || [];
    const dateColumns = header.map((value, index) => (isDateHeader(value) ? index : null)).filter((index) => index !== null);
    const stockColumns = header.map((value, index) => (/stock/i.test(String(value)) ? index : null)).filter((index) => index !== null);
    if (!dateColumns.length) return;
    const period = periodOf(dateColumns.map((index) => excelDate(header[index])));
    let section = String(header[0] || "").trim().toUpperCase();
    rows.forEach((row, index) => {
      if (index === 0) return;
      const first = String(row[0] || "").trim();
      const label = String(row[1] || "").trim();
      if (first && !(Number(first) > 0) && first.toUpperCase() !== "NO CODIGO" && !label) { section = first.toUpperCase(); return; }
      if (first.toUpperCase() === "ID") { section = label.toUpperCase() || section; return; }
      const itemType = SECTION_TYPES[section];
      if (!itemType || !label || /^(MENSUAL|BIMENSUAL|CONTROL)\s*$/i.test(label)) return;
      const deliveredUnits = Number(row[5]) || 0;
      const contractedBoxes = Number(row[2]) || null;
      if (!(deliveredUnits > 0) && !contractedBoxes) return;
      const contractedUnits = Number(row[3]) || null;
      const unitsPerBox = contractedBoxes && contractedUnits ? contractedUnits / contractedBoxes : 1;
      const code = Number(first) > 0 ? normalizeCode(first) : null;
      items.push({
        itemKey: `${itemType}::${code || label.toLowerCase().replace(/\s+/g, " ")}`,
        itemType,
        supplierCode: code,
        productName: label,
        sheetArea: sheetName.trim(),
        unitsPerBox,
        deliveredUnits,
        deliveredBoxes: Number((deliveredUnits / unitsPerBox).toFixed(3)),
        contractedBoxes,
        period,
        deliveries: dateColumns
          .map((column) => ({ date: excelDate(header[column]).toISOString().slice(0, 10), units: Number(row[column]) || 0 }))
          .filter((entry) => entry.units),
        stock: stockColumns
          .map((column) => ({ label: String(header[column]).trim(), units: row[column] === "" ? null : Number(row[column]) }))
          .filter((entry) => entry.units !== null && Number.isFinite(entry.units)),
      });
    });
  });
  // El mismo producto puede repetirse en dos areas: se suma.
  const byKey = new Map();
  items.forEach((item) => {
    const current = byKey.get(item.itemKey);
    if (!current) { byKey.set(item.itemKey, item); return; }
    current.deliveredUnits += item.deliveredUnits;
    current.deliveredBoxes = Number((current.deliveredBoxes + item.deliveredBoxes).toFixed(3));
    current.deliveries = current.deliveries.concat(item.deliveries);
  });
  return [...byKey.values()];
}

async function importForBusinessCase(businessCaseId, buffer, { fileName = null, user = null } = {}) {
  let items;
  try {
    items = parseControlFile(buffer);
  } catch (error) {
    throw httpError(400, "DELIVERY_FILE_UNREADABLE", "No se pudo leer el archivo de control de entregas.");
  }
  if (!items.length) {
    throw httpError(400, "DELIVERY_FILE_EMPTY", "El archivo no tiene productos con entregas (se esperan secciones CALIBRADORES, CONTROLES o CONSUMIBLES y columnas por fecha).");
  }
  await db.query("DELETE FROM bc_delivery_history WHERE business_case_id = $1", [businessCaseId]);
  for (const item of items) {
    await db.query(
      `INSERT INTO bc_delivery_history
         (business_case_id, item_key, item_type, supplier_code, product_name, sheet_area, units_per_box, delivered_units,
          delivered_boxes, contracted_boxes, period_start, period_end, period_months, deliveries, stock, source_file, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        businessCaseId, item.itemKey, item.itemType, item.supplierCode, item.productName, item.sheetArea, item.unitsPerBox,
        item.deliveredUnits, item.deliveredBoxes, item.contractedBoxes,
        item.period?.start || null, item.period?.end || null, item.period?.months || null,
        JSON.stringify(item.deliveries), JSON.stringify(item.stock), fileName, user?.email || null,
      ],
    );
  }
  return getForBusinessCase(businessCaseId);
}

async function getForBusinessCase(businessCaseId) {
  try {
    const { rows } = await db.query(
      `SELECT item_key, item_type, supplier_code, product_name, sheet_area, delivered_boxes, contracted_boxes,
              period_start, period_end, period_months, jsonb_array_length(deliveries) AS delivery_count, source_file, uploaded_by, uploaded_at
         FROM bc_delivery_history WHERE business_case_id = $1 ORDER BY item_type, product_name`,
      [businessCaseId],
    );
    const byType = {};
    rows.forEach((row) => { byType[row.item_type] = (byType[row.item_type] || 0) + 1; });
    return {
      products: rows.length,
      byType,
      sourceFile: rows[0]?.source_file || null,
      uploadedBy: rows[0]?.uploaded_by || null,
      uploadedAt: rows[0]?.uploaded_at || null,
      items: rows,
    };
  } catch (error) {
    if (String(error?.code || "") === "42P01") return { products: 0, byType: {}, items: [] };
    throw error;
  }
}

/**
 * Consumo real llevado a la duracion del proceso: Map "tipo::codigo" -> cajas.
 * entregado × (meses del proceso / meses que cubrieron las entregas).
 */
async function realForProcess(businessCaseId, processMonths) {
  try {
    const { rows } = await db.query(
      `SELECT item_type, supplier_code, delivered_boxes, period_months
         FROM bc_delivery_history WHERE business_case_id = $1 AND supplier_code IS NOT NULL AND delivered_boxes > 0`,
      [businessCaseId],
    );
    return new Map(rows.map((row) => {
      const factor = processMonths > 0 && Number(row.period_months) > 0 ? processMonths / Number(row.period_months) : 1;
      return [`${row.item_type}::${normalizeCode(row.supplier_code)}`, Number((Number(row.delivered_boxes) * factor).toFixed(2))];
    }));
  } catch (error) {
    if (String(error?.code || "") === "42P01") return new Map();
    throw error;
  }
}

module.exports = { parseControlFile, importForBusinessCase, getForBusinessCase, realForProcess, __testables: { periodOf } };
