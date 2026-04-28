const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { drive, sheets, jwtClient } = require("../../config/google");
const logger = require("../../config/logger");

const TEMPLATE_FILENAME = "FORMATO_BC.xlsx";

function resolveTemplatePath() {
  const envPath = String(process.env.BC_SHEET_TEMPLATE_PATH || "").trim();
  const candidatePaths = [];

  if (envPath) {
    candidatePaths.push(path.resolve(envPath));
  }

  // Common layouts:
  // 1) monorepo root: /<repo>/Mapeador_Sheets/FORMATO_BC.xlsx
  // 2) backend root:  /<repo>/backend/Mapeador_Sheets/FORMATO_BC.xlsx
  // 3) legacy fallback with one extra parent
  candidatePaths.push(path.resolve(__dirname, "../../../Mapeador_Sheets", TEMPLATE_FILENAME));
  candidatePaths.push(path.resolve(__dirname, "../../../../Mapeador_Sheets", TEMPLATE_FILENAME));
  candidatePaths.push(path.resolve(__dirname, "../../../../../Mapeador_Sheets", TEMPLATE_FILENAME));

  const found = candidatePaths.find((candidate) => fs.existsSync(candidate));
  return {
    path: found || candidatePaths[0],
    tried: candidatePaths,
  };
}

const GENERIC_SHEET_TOKENS = new Set([
  "cliente",
  "fecha",
  "modalidad",
  "plazo",
  "meses",
  "proyeccion",
  "equipo",
  "determinacion",
  "determinacione",
  "producto",
  "descripcion",
  "reactivo",
  "i.d",
  "id",
  "detkit",
  "diasestabilidad",
  "detanoproceso",
  "cantidadprocesoano",
  "productoacalcular",
  "productocalculado",
  "minimosporestabilidad",
  "productoaentregar",
  "productoaenviar",
  "registrossanitarios",
]);

const BC_LABEL_FIELD_MAP = new Map([
  ["tipo de cliente", "TipoDeCliente"],
  ["entidad contratante", "EntidadContratante"],
  ["cliente", "Cliente"],
  ["codigo del proceso", "CodigoProceso"],
  ["objeto de contratacion", "ObjetoContratacion"],
  ["provincia ciudad", "ProvinciaCiudad"],
  ["numero de dias por semana que trabaja el laboratorio", "DiasLaboratorio"],
  ["turnos por dia", "TurnosPorDia"],
  ["horas por turno", "HorasPorTurno"],
  ["controles de calidad por turno", "ControlesCalidadPorTurno"],
  ["niveles de control", "NivelesDeControl"],
  ["frecuencia de controles de calidad rutina", "FrecuenciaControlesRutina"],
  ["pruebas especiales", "PruebasEspeciales"],
  ["frecuencia de controles de calidad pruebas especiales", "FrecuenciaControlesEspeciales"],
  ["nombre de equipo principal", "NombreEquipoPrincipal"],
  ["estado de equipo principal nuevo usado ano de fabricacion tdr", "EstadoEquipoPrincipal"],
  ["estado de equipo propio alquilado nuevo reservado serie fam", "PropiedadEquipoPrincipal"],
  ["nombre de equipo back up", "NombreEquipoBackUp"],
  ["estado de equipo back up nuevo usado ano de fabricacion", "EstadoEquipoBackUp"],
  ["se debe instalar a la par del equipo principal si no", "InstalarJuntoPrincipal"],
  ["ubicacion de los equipos a instalar", "UbicacionEquipos"],
  ["requiere equipo complementario si no", "RequiereEquipoComplementario"],
  ["equipo complementario para que prueba", "EquipoComplementarioPrueba"],
  ["incluye lis si no", "IncluyeLIS"],
  ["proveedor del sistema a trabajar", "ProveedorSistemaTrabajar"],
  ["numero de pacientes mensual", "NumeroPacientesMensual"],
  ["interfaz a sistema actual", "InterfazSistemaActual"],
  ["nombre del sistema", "NombreSistema"],
  ["proveedor", "ProveedorSistemaActual"],
  ["plazo", "Plazo"],
  ["proyeccion de plazo", "ProyeccionPlazo"],
  ["presupuesto referencial del proceso", "PresupuestoReferencial"],
  ["porcentaje maximo de canje", "PorcentajeMaximoCanje"],
  ["compromiso de compra gerencia", "CompromisoDeCompra"],
  ["total parcial tiempo parcial a necesidad del laboratorio", "TipoEntrega"],
  ["determinacion efectiva si no", "DeterminacionEfectiva"],
  ["observaciones", "Observaciones"],
]);

let templateCache = null;

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeCompact(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function normalizeProductId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.replace(/\.0+$/, "").replace(/[^0-9]/g, "");
}

function columnLetter(index) {
  let current = Number(index);
  let letter = "";
  while (current > 0) {
    const rem = (current - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    current = Math.floor((current - 1) / 26);
  }
  return letter;
}

function decodeRange(ws) {
  const ref = ws?.["!ref"] || "A1:A1";
  return XLSX.utils.decode_range(ref);
}

function getCellValue(ws, cellAddress) {
  const value = ws?.[cellAddress]?.v;
  return value === undefined || value === null ? "" : value;
}

function pickWritableCell(ws, rowNumber, startColumn = 2, endColumn = 6) {
  for (let col = startColumn; col <= endColumn; col += 1) {
    const address = `${columnLetter(col)}${rowNumber}`;
    if (!String(getCellValue(ws, address) || "").trim()) return address;
  }
  return `${columnLetter(startColumn)}${rowNumber}`;
}

function findHeaderRow(sheetMatrix = []) {
  for (let rowIndex = 0; rowIndex < sheetMatrix.length; rowIndex += 1) {
    const row = sheetMatrix[rowIndex] || [];
    const normalized = row.map((cell) => normalizeText(cell));
    const hasDeliverColumn = normalized.some((value) => value.includes("producto a entregar") || value.includes("producto a enviar"));
    const hasAnnualColumn = normalized.some((value) => value.includes("det ano proceso") || value.includes("det a o proceso") || value.includes("cantidad proceso ano") || value.includes("det ano proceso"));
    if (hasDeliverColumn && hasAnnualColumn) return rowIndex + 1;
  }
  return 8;
}

function findColumnIndex(headers = [], matcher) {
  for (let index = 0; index < headers.length; index += 1) {
    if (matcher(normalizeText(headers[index]))) return index + 1;
  }
  return null;
}

function collectSheetAliases(ws, range, sheetName) {
  const aliases = new Set([normalizeCompact(sheetName)]);
  for (let row = range.s.r + 1; row <= Math.min(range.e.r + 1, 8); row += 1) {
    for (let col = range.s.c + 1; col <= Math.min(range.e.c + 1, 10); col += 1) {
      const raw = getCellValue(ws, `${columnLetter(col)}${row}`);
      const normalized = normalizeCompact(raw);
      if (!normalized) continue;
      if (GENERIC_SHEET_TOKENS.has(normalized)) continue;
      aliases.add(normalized);
    }
  }
  return Array.from(aliases).filter(Boolean);
}

function parseBCDefinition(ws) {
  const range = decodeRange(ws);
  const fieldCells = {};
  const objectiveRows = new Map();

  for (let row = range.s.r + 1; row <= range.e.r + 1; row += 1) {
    const label = String(getCellValue(ws, `A${row}`) || "").trim();
    if (!label) continue;
    const normalizedLabel = normalizeText(label);
    const fieldKey = BC_LABEL_FIELD_MAP.get(normalizedLabel);
    if (fieldKey) {
      fieldCells[fieldKey] = pickWritableCell(ws, row, 2, 5);
    }
    if (row >= 58) {
      objectiveRows.set(normalizedLabel, row);
    }
  }

  fieldCells.ModeloProveedor1 = pickWritableCell(ws, 41, 2, 5);
  fieldCells.ModeloProveedor2 = pickWritableCell(ws, 42, 2, 5);
  fieldCells.ModeloProveedor3 = pickWritableCell(ws, 43, 2, 5);
  fieldCells.IncluyeHadwareLIS = pickWritableCell(ws, 34, 2, 5);
  fieldCells.IncluyeHadwareSistemaActual = pickWritableCell(ws, 39, 2, 5);
  fieldCells.Plazo = pickWritableCell(ws, 46, 2, 5);
  fieldCells.ProyeccionPlazo = pickWritableCell(ws, 47, 2, 5);
  fieldCells.PresupuestoReferencial = pickWritableCell(ws, 49, 2, 5);
  fieldCells.PorcentajeMaximoCanje = pickWritableCell(ws, 50, 2, 5);
  fieldCells.CompromisoDeCompra = pickWritableCell(ws, 51, 2, 5);
  fieldCells.TipoEntrega = pickWritableCell(ws, 53, 2, 5);
  fieldCells.DeterminacionEfectiva = pickWritableCell(ws, 54, 2, 5);
  fieldCells.Observaciones = pickWritableCell(ws, 55, 2, 5);

  return { fieldCells, objectiveRows };
}

function parseEquipmentSheetDefinition(name, ws) {
  const range = decodeRange(ws);
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  const headerRow = findHeaderRow(matrix);
  const headers = matrix[headerRow - 1] || [];

  const idColumn = findColumnIndex(headers, (value) => value === "id" || value === "i d");
  const labelColumn = findColumnIndex(headers, (value) => value === "producto" || value === "reactivo" || value === "descripcion");
  const annualColumn = findColumnIndex(headers, (value) => value.includes("det ano proceso") || value.includes("cantidad proceso ano"));
  const deliverColumn = findColumnIndex(headers, (value) => value.includes("producto a entregar") || value.includes("producto a enviar"));

  const rows = [];
  for (let row = headerRow + 1; row <= range.e.r + 1; row += 1) {
    const idValue = idColumn ? getCellValue(ws, `${columnLetter(idColumn)}${row}`) : "";
    const labelValue = labelColumn ? getCellValue(ws, `${columnLetter(labelColumn)}${row}`) : "";
    const normalizedId = normalizeProductId(idValue);
    const normalizedLabel = normalizeText(labelValue);
    if (!normalizedId && !normalizedLabel) continue;
    rows.push({
      rowNumber: row,
      itemId: normalizedId,
      label: normalizedLabel,
    });
  }

  return {
    name,
    aliases: collectSheetAliases(ws, range, name),
    headerRow,
    columns: {
      annual: annualColumn,
      deliver: deliverColumn,
    },
    rows,
    metadataCells: {
      client: String(getCellValue(ws, "A1") || "").trim().toUpperCase() === "CLIENTE" ? pickWritableCell(ws, 1, 2, 4) : null,
      date: String(getCellValue(ws, "A2") || "").trim().toUpperCase() === "FECHA" ? pickWritableCell(ws, 2, 2, 4) : null,
      modality: String(getCellValue(ws, "A3") || "").trim().toUpperCase() === "MODALIDAD" ? pickWritableCell(ws, 3, 2, 2) : null,
      plazo: String(getCellValue(ws, "A4") || "").trim().toUpperCase() === "PLAZO" ? pickWritableCell(ws, 4, 2, 2) : null,
      projection: String(getCellValue(ws, "A5") || "").trim().toUpperCase().startsWith("PROYECCION") ? pickWritableCell(ws, 5, 2, 2) : null,
    },
  };
}

function loadTemplateDefinition() {
  if (templateCache) return templateCache;
  const templateResolution = resolveTemplatePath();
  const templatePath = templateResolution.path;
  if (!fs.existsSync(templatePath)) {
    const error = new Error(`No existe la plantilla de Sheets: ${templatePath}`);
    error.code = "BC_SHEET_TEMPLATE_MISSING";
    error.retryable = false;
    error.status = 500;
    error.details = { triedPaths: templateResolution.tried };
    throw error;
  }

  const workbook = XLSX.readFile(templatePath, { raw: false, cellFormula: true });
  const bcSheet = workbook.Sheets.BC;
  const equipmentSheets = workbook.SheetNames.filter((name) => name !== "BC").map((name) => parseEquipmentSheetDefinition(name, workbook.Sheets[name]));

  templateCache = {
    templatePath,
    bc: parseBCDefinition(bcSheet),
    equipmentSheets,
    allSheetNames: workbook.SheetNames.slice(),
  };
  return templateCache;
}

function scoreAliases(recordAliases = [], sheetAliases = []) {
  let best = 0;
  for (const recordAlias of recordAliases) {
    for (const sheetAlias of sheetAliases) {
      if (!recordAlias || !sheetAlias) continue;
      if (recordAlias === sheetAlias) best = Math.max(best, 100);
      else if (recordAlias.length >= 4 && sheetAlias.includes(recordAlias)) best = Math.max(best, 88);
      else if (sheetAlias.length >= 4 && recordAlias.includes(sheetAlias)) best = Math.max(best, 85);
    }
  }
  return best;
}

function buildRecordAliases(record = {}) {
  const aliases = new Set();
  [record.name, record.code, record.model, record.equipment_name, record.equipment_code].forEach((value) => {
    const normalized = normalizeCompact(value);
    if (normalized) aliases.add(normalized);
  });
  return Array.from(aliases);
}

function buildSheetItemLookup(items = []) {
  const byId = new Map();
  const byLabel = new Map();
  items.forEach((item) => {
    const itemId = normalizeProductId(item.itemId || item.item_id);
    const label = normalizeText(item.itemName || item.item_name || item.name);
    if (itemId) byId.set(itemId, item);
    if (label) byLabel.set(label, item);
  });
  return { byId, byLabel };
}

function buildValueRange(range, values) {
  return { range, values: [[values]] };
}

async function createSpreadsheetFromTemplate({ outputFolderId, businessCaseName }) {
  const name = businessCaseName || `BC-${Date.now()}`;
  const { path: templatePath } = resolveTemplatePath();
  if (!fs.existsSync(templatePath)) {
    const error = new Error(`No existe la plantilla de Sheets: ${templatePath}`);
    error.code = "BC_SHEET_TEMPLATE_MISSING";
    error.retryable = false;
    error.status = 500;
    throw error;
  }
  const media = {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    body: fs.createReadStream(templatePath),
  };

  const { data } = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name,
      parents: outputFolderId ? [outputFolderId] : undefined,
      mimeType: "application/vnd.google-apps.spreadsheet",
    },
    media,
    fields: "id, name, webViewLink",
  });

  return {
    sheetId: data.id,
    sheetUrl: data.webViewLink,
  };
}

async function getSpreadsheetMeta(sheetId) {
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const { data } = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        includeGridData: false,
      });
      const sheetMap = new Map();
      (data.sheets || []).forEach((entry) => {
        const title = entry?.properties?.title;
        const id = entry?.properties?.sheetId;
        if (title) sheetMap.set(title, id);
      });
      return { data, sheetMap };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }
  throw lastError;
}

async function deleteFileIfExists(fileId) {
  if (!fileId) return;
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch (error) {
    logger.warn({ fileId, error: error.message }, "No se pudo eliminar el spreadsheet previo del BC");
  }
}

async function ensureSpreadsheet({ requiredSheetNames, existingSheetId, outputFolderId, businessCaseName }) {
  if (existingSheetId) {
    try {
      const meta = await getSpreadsheetMeta(existingSheetId);
      const hasAllSheets = requiredSheetNames.every((name) => meta.sheetMap.has(name));
      if (hasAllSheets) {
        return {
          spreadsheetId: existingSheetId,
          spreadsheetUrl: meta.data?.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${existingSheetId}/edit`,
          sheetMap: meta.sheetMap,
          existing: true,
        };
      }
      await deleteFileIfExists(existingSheetId);
    } catch (error) {
      logger.warn({ existingSheetId, error: error.message }, "Spreadsheet previo no utilizable. Se recreara desde plantilla.");
    }
  }

  const created = await createSpreadsheetFromTemplate({ outputFolderId, businessCaseName });
  const meta = await getSpreadsheetMeta(created.sheetId);
  return {
    spreadsheetId: created.sheetId,
    spreadsheetUrl: created.sheetUrl,
    sheetMap: meta.sheetMap,
    existing: false,
  };
}

async function pruneSheets(spreadsheetId, sheetMap, requiredSheetNames = []) {
  const deletions = [];
  sheetMap.forEach((sheetId, title) => {
    if (!requiredSheetNames.includes(title)) {
      deletions.push({ deleteSheet: { sheetId } });
    }
  });

  if (!deletions.length) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: deletions },
  });
}

async function clearRanges(spreadsheetId, ranges = []) {
  const cleanRanges = ranges.filter(Boolean);
  if (!cleanRanges.length) return;
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: { ranges: cleanRanges },
  });
}

async function writeRanges(spreadsheetId, data = []) {
  const cleanData = data.filter((item) => item && item.range);
  if (!cleanData.length) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: cleanData,
    },
  });
}

function resolveBusinessCaseName(businessCase = {}) {
  const parts = [
    String(businessCase.process_code || "").trim(),
    String(businessCase.client_name || "").trim(),
    String(businessCase.id || businessCase.business_case_id || "").trim(),
  ].filter(Boolean);
  return parts.length ? `BC ${parts.join(" - ")}` : `BC ${Date.now()}`;
}

function buildBusinessCaseRanges(template, payload) {
  const updates = [];
  const clears = [];
  const fieldCells = template.bc.fieldCells || {};

  Object.entries(fieldCells).forEach(([fieldKey, cell]) => {
    clears.push(`BC!${cell}`);
    updates.push(buildValueRange(`BC!${cell}`, payload.fields?.[fieldKey] ?? ""));
  });

  const objectiveRows = template.bc.objectiveRows || new Map();
  objectiveRows.forEach((rowNumber) => {
    clears.push(`BC!B${rowNumber}`);
    clears.push(`BC!D${rowNumber}`);
    clears.push(`BC!E${rowNumber}`);
  });

  Object.entries(payload.inversiones || {}).forEach(([name, investment]) => {
    const normalizedName = normalizeText(name);
    const rowNumber = objectiveRows.get(normalizedName);
    if (!rowNumber) return;
    updates.push(buildValueRange(`BC!B${rowNumber}`, name));
    updates.push(buildValueRange(`BC!D${rowNumber}`, investment?.cantidad ?? ""));
    updates.push(buildValueRange(`BC!E${rowNumber}`, investment?.precio ?? ""));
  });

  return { updates, clears };
}

function buildEquipmentSheetRanges(template, sheetPayload = {}) {
  const updates = [];
  const clears = [];
  const definition = template.equipmentSheets.find((item) => item.name === sheetPayload.sheet_name);
  if (!definition) return { updates, clears };

  const meta = definition.metadataCells || {};
  if (meta.client) updates.push(buildValueRange(`${definition.name}!${meta.client}`, sheetPayload.client || ""));
  if (meta.date) updates.push(buildValueRange(`${definition.name}!${meta.date}`, sheetPayload.date || ""));
  if (meta.modality) updates.push(buildValueRange(`${definition.name}!${meta.modality}`, sheetPayload.modality || ""));
  if (meta.plazo) updates.push(buildValueRange(`${definition.name}!${meta.plazo}`, sheetPayload.deadline_months ?? ""));
  if (meta.projection) updates.push(buildValueRange(`${definition.name}!${meta.projection}`, sheetPayload.projected_deadline_months ?? ""));

  const lastRowNumber = definition.rows.length
    ? definition.rows[definition.rows.length - 1].rowNumber
    : definition.headerRow + 1;
  if (definition.columns.annual) {
    clears.push(`${definition.name}!${columnLetter(definition.columns.annual)}${definition.headerRow + 1}:${columnLetter(definition.columns.annual)}${Math.max(definition.headerRow + 1, lastRowNumber)}`);
  }
  if (definition.columns.deliver) {
    clears.push(`${definition.name}!${columnLetter(definition.columns.deliver)}${definition.headerRow + 1}:${columnLetter(definition.columns.deliver)}${Math.max(definition.headerRow + 1, lastRowNumber)}`);
  }

  const lookup = buildSheetItemLookup(sheetPayload.items || []);
  definition.rows.forEach((row) => {
    const item = row.itemId ? lookup.byId.get(row.itemId) : lookup.byLabel.get(row.label);
    if (!item) return;
    if (definition.columns.annual) {
      updates.push(buildValueRange(`${definition.name}!${columnLetter(definition.columns.annual)}${row.rowNumber}`, item.annual_qty ?? item.annualQty ?? ""));
    }
    if (definition.columns.deliver) {
      const deliverValue = item.planned_qty ?? item.plannedQty ?? "";
      updates.push(buildValueRange(`${definition.name}!${columnLetter(definition.columns.deliver)}${row.rowNumber}`, deliverValue));
    }
  });

  return { updates, clears };
}

function resolveCurrentDateValue() {
  const formatter = new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function buildSheetPayloads({ template, equipmentRecords = [], payload = {} }) {
  const selectedSheets = [];
  const recordsWithAliases = equipmentRecords.map((record) => ({
    ...record,
    aliases: buildRecordAliases(record),
  }));

  template.equipmentSheets.forEach((sheetDefinition) => {
    const matchedRecords = recordsWithAliases.filter((record) => scoreAliases(record.aliases, sheetDefinition.aliases) >= 85);
    if (!matchedRecords.length) return;

    const matchedIds = new Set(matchedRecords.map((record) => Number(record.id)).filter((value) => Number.isInteger(value) && value > 0));
    const matchedItems = (payload.max_quantities || []).filter((item) => {
      if (matchedIds.size && matchedIds.has(Number(item.equipment_id || item.equipmentId))) return true;
      const itemAliases = buildRecordAliases({
        name: item.equipment_name || item.equipmentName,
        code: item.equipment_code || item.equipmentCode,
      });
      return scoreAliases(itemAliases, sheetDefinition.aliases) >= 85;
    });

    selectedSheets.push({
      sheet_name: sheetDefinition.name,
      equipment_ids: Array.from(matchedIds),
      equipment_names: matchedRecords.map((record) => record.name || record.equipment_name).filter(Boolean),
      client: payload.fields?.Cliente || "",
      date: resolveCurrentDateValue(),
      modality: payload.sheet_context?.modality || "",
      deadline_months: payload.sheet_context?.deadline_months ?? "",
      projected_deadline_months: payload.sheet_context?.projected_deadline_months ?? "",
      items: matchedItems,
    });
  });

  return selectedSheets;
}

async function syncBusinessCaseToGoogleSheet({ businessCase, outputFolderId, payload = {}, previousSheetId = null }) {
  if (!jwtClient) {
    const error = new Error("Google JWT Client no inicializado para sincronizar Business Case a Sheets");
    error.code = "GOOGLE_AUTH_UNAVAILABLE";
    error.retryable = false;
    error.status = 500;
    throw error;
  }

  const template = loadTemplateDefinition();
  const selectedSheets = Array.isArray(payload.equipment_tabs) ? payload.equipment_tabs : [];
  const requiredSheetNames = ["BC", ...selectedSheets.map((item) => item.sheet_name)].filter(Boolean);
  const spreadsheet = await ensureSpreadsheet({
    requiredSheetNames,
    existingSheetId: previousSheetId,
    outputFolderId,
    businessCaseName: resolveBusinessCaseName(businessCase),
  });

  await pruneSheets(spreadsheet.spreadsheetId, spreadsheet.sheetMap, requiredSheetNames);

  const bcRanges = buildBusinessCaseRanges(template, payload);
  const sectionRanges = selectedSheets.map((sheetPayload) => buildEquipmentSheetRanges(template, sheetPayload));

  const clearRangesPayload = [
    ...bcRanges.clears,
    ...sectionRanges.flatMap((entry) => entry.clears),
  ];
  const updatePayload = [
    ...bcRanges.updates,
    ...sectionRanges.flatMap((entry) => entry.updates),
  ];

  await clearRanges(spreadsheet.spreadsheetId, clearRangesPayload);
  await writeRanges(spreadsheet.spreadsheetId, updatePayload);

  return {
    sheetId: spreadsheet.spreadsheetId,
    url: spreadsheet.spreadsheetUrl,
    timestamp: new Date().toISOString(),
    provider: "google_sheets_local",
    selected_sheets: requiredSheetNames,
  };
}

module.exports = {
  loadTemplateDefinition,
  buildRecordAliases,
  scoreAliases,
  buildSheetPayloads,
  syncBusinessCaseToGoogleSheet,
};
