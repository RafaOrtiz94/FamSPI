/**
 * Lectura en vivo de la pestaña de un equipo que NO tiene pestaña en la plantilla base
 * (TABLA BASE BC.xlsx). Caso real: cobas U 411 (BC dbe65add, 2026-10-19), cuyo Sheet tiene la pestaña
 * "u411" con productos puestos a mano; la sincronizacion normal solo lee filas definidas en la
 * plantilla (por numero de fila) y no veia ninguno.
 *
 * En vez de depender de la plantilla, se lee la pestaña real del BC: se ubica la fila de
 * encabezados (I.D / DET/AÑO / PRODUCTO A ENVIAR), se toma cada fila con codigo y el tipo sale de
 * la seccion (REACTIVOS, CALIBRADORES, CONTROLES, CONSUMIBLES) o, si el nombre lo dice, de el
 * (una tira de calibracion bajo "REACTIVO" es calibrador; un control, control).
 */

const CODE_PATTERN = /^\d{6,}$/;

const normalizeHeader = (value) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
const cleanCode = (value) => String(value ?? "").replace(/\s+/g, "").trim();
const toNumber = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : null;
};

const SECTION_TYPES = [
  [/^CALIBRADOR/, "calibrador"],
  [/^CONTROLES Y CALIBRADORES/, null], // mixta: el tipo sale del nombre
  [/^CONTROL/, "control"],
  [/^(CONSUMIBLE|MATERIAL|SISTEMA)/, "material"],
  [/^REACTIVO/, "reactivo"],
];

function sectionTypeOf(text) {
  const header = normalizeHeader(text);
  const match = SECTION_TYPES.find(([pattern]) => pattern.test(header));
  return match ? { matched: true, type: match[1] } : { matched: false, type: null };
}

/** El nombre manda sobre una seccion generica: "Calibration strip" no es reactivo. */
function typeOf(sectionType, name) {
  const label = String(name || "");
  if (/calibra|calset|\bcfas\b|c\.f\.a\.s/i.test(label)) return "calibrador";
  if (/control|precinorm|precipath/i.test(label)) return "control";
  return sectionType || "reactivo";
}

/**
 * Puro. values = filas de la pestaña (como las devuelve spreadsheets.values.get).
 * Devuelve [{ itemId, name, itemType, annualQty, plannedQty, referenceQty, unitsPerPack, rowNumber }].
 */
function parseLiveEquipmentTab(values = []) {
  const rows = Array.isArray(values) ? values : [];
  const headerIndex = rows.findIndex((row) => {
    const cells = (row || []).map(normalizeHeader);
    return cells.some((cell) => cell === "I.D" || cell === "ID")
      && cells.some((cell) => cell.startsWith("PRODUCTO A ENVIAR") || cell.startsWith("PRODUCTO A ENTREGAR"));
  });
  if (headerIndex < 0) return [];
  const header = rows[headerIndex].map(normalizeHeader);
  const idColumn = header.findIndex((cell) => cell === "I.D" || cell === "ID");
  const nameColumn = idColumn + 1;
  const annualColumn = header.findIndex((cell) => cell.startsWith("DET/ANO") || cell.startsWith("DET/AÑO"));
  const plannedColumn = header.findIndex((cell) => cell.startsWith("PRODUCTO A ENVIAR") || cell.startsWith("PRODUCTO A ENTREGAR"));
  const referenceColumn = header.findIndex((cell) => cell.startsWith("PRODUCTO CALCULADO"));
  const packColumn = header.findIndex((cell) => cell.startsWith("DET/KIT"));
  let section = sectionTypeOf(header[nameColumn]).type;

  const items = [];
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const cells = row || [];
    const code = cleanCode(cells[idColumn]);
    if (!CODE_PATTERN.test(code)) {
      // Fila de seccion: texto en la columna del codigo o del nombre, sin codigo.
      const sectionText = String(cells[idColumn] || cells[nameColumn] || "").trim();
      const detected = sectionTypeOf(sectionText);
      if (detected.matched) section = detected.type;
      return;
    }
    const name = String(cells[nameColumn] ?? "").trim();
    if (!name) return;
    items.push({
      itemId: code,
      name,
      itemType: typeOf(section, name),
      annualQty: annualColumn >= 0 ? toNumber(cells[annualColumn]) : null,
      plannedQty: plannedColumn >= 0 ? toNumber(cells[plannedColumn]) : null,
      referenceQty: referenceColumn >= 0 ? toNumber(cells[referenceColumn]) : null,
      unitsPerPack: packColumn >= 0 && toNumber(cells[packColumn]) > 0 ? toNumber(cells[packColumn]) : null,
      rowNumber: headerIndex + offset + 2,
    });
  });
  return items;
}

/**
 * Para los equipos seleccionados SIN pestaña en la plantilla: busca en el Sheet del BC la pestaña que
 * corresponde (mismo puntaje de alias que buildSheetPayloads, sobre el nombre de la pestaña) y la lee.
 * @returns {Promise<Array<{ item_key, item_id, item_name, item_type, equipment_id, equipment_name, catalog_id, source, annual_qty, planned_qty, reference_qty }>>}
 */
async function readLiveTabsForUnmappedEquipment({ sheetsApi, sheetId, equipmentRecords = [], mappedEquipmentIds = [], helpers, logger }) {
  const mapped = new Set(mappedEquipmentIds.map(Number));
  const unmapped = equipmentRecords.filter((record) => !mapped.has(Number(record.id)));
  if (!unmapped.length || !sheetId) return [];
  const meta = await sheetsApi.spreadsheets.get({ spreadsheetId: sheetId, fields: "sheets.properties.title" });
  const titles = (meta.data.sheets || []).map((sheet) => sheet.properties.title).filter((title) => normalizeHeader(title) !== "BC");
  const out = [];
  for (const record of unmapped) {
    const aliases = helpers.buildEquipmentMatchAliases(record);
    const best = titles
      .map((title) => ({ title, score: helpers.scoreAliases(aliases, [helpers.normalizeCompact(title)]) }))
      .filter((candidate) => candidate.score >= 85)
      .sort((a, b) => b.score - a.score)[0];
    if (!best) {
      logger?.warn?.({ sheetId, equipmentId: record.id, equipmentName: record.name, tabs: titles }, "[BC_SHEET][LIVE_TAB] Equipo sin pestaña en la plantilla ni en el Sheet");
      continue;
    }
    const response = await sheetsApi.spreadsheets.values.get({ spreadsheetId: sheetId, range: `'${best.title}'!A1:L300` });
    const items = parseLiveEquipmentTab(response.data.values || []);
    logger?.info?.({ sheetId, equipmentId: record.id, tab: best.title, items: items.length }, "[BC_SHEET][LIVE_TAB] Pestaña leida en vivo (equipo sin plantilla)");
    items.forEach((item) => out.push({
      item_key: `sheet:${record.id}:${item.itemId}:${item.itemType}`,
      item_id: item.itemId,
      item_name: item.name,
      item_type: item.itemType,
      equipment_id: Number(record.id),
      equipment_name: record.name || null,
      catalog_id: null,
      source: "sheet_live_tab",
      annual_qty: item.annualQty,
      planned_qty: item.plannedQty,
      reference_qty: item.referenceQty,
      units_per_pack: item.unitsPerPack,
    }));
  }
  return out;
}

/**
 * Guarda la presentacion (DET/KIT) de los productos leidos en vivo. Va directo a la columna porque el
 * guardado de consumos desde la UI reescribe los items y no la conoce (la conserva).
 */
async function savePackSizes(db, businessCaseId, items = []) {
  const withPack = items.filter((item) => item.units_per_pack > 0);
  for (const item of withPack) {
    await db.query(
      "UPDATE bc_consumption_items SET units_per_pack = $3 WHERE business_case_id = $1 AND item_key = $2 AND units_per_pack IS DISTINCT FROM $3",
      [businessCaseId, item.item_key, item.units_per_pack],
    );
  }
}

module.exports = { parseLiveEquipmentTab, readLiveTabsForUnmappedEquipment, savePackSizes, __testables: { typeOf, sectionTypeOf } };
