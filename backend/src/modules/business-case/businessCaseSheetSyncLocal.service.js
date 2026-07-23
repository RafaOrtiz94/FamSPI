const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { drive, sheets, jwtClient } = require("../../config/google");
const logger = require("../../config/logger");
const { googleDelegatedUser } = require("../../utils/googleCredentials");

const TEMPLATE_FILENAME = "FORMATO_BC.xlsx";
const MAPPING_FILENAME = "mapping_auto.json";
const DYNAMIC_INVESTMENTS_START_ROW = 126;
const DYNAMIC_INVESTMENTS_CLEAR_ROWS = 75;
const MAX_QUANTITIES_LOCK_DESCRIPTION = "SPI_LOCK_MAX_QUANTITIES_POST_FEASIBILITY";
const ANNUAL_QUANTITIES_LOCK_DESCRIPTION = "SPI_LOCK_ANNUAL_QUANTITIES_VALIDATED";
const ANNUAL_QUANTITY_ITEM_TYPES = {
  reactivos: new Set(["reactivo", "determinacion"]),
  controles: new Set(["control"]),
  calibradores: new Set(["calibrador"]),
  materiales: new Set(["consumible", "material"]),
};
// Columna de cantidad anual: en el bloque de reactivos de la plantilla se
// llama "DET/AÑO PROCESO"; en los bloques de calibradores/controles/
// materiales (mas abajo en la misma pestaña) ese header no existe -- ahi
// jefe_servicio/ing_servicio registra en "PRODUCTO CALCULADO". Cada bloque
// declara solo uno de los dos, por lo que buscar ambos resuelve el correcto
// por fila sin necesidad de conocer el item_type en tiempo de parseo.
const ANNUAL_QUANTITY_HEADERS = ["DET/AÑO PROCESO", "PRODUCTO CALCULADO"];

// Google Sheet maestro con el diseño/formato oficial ("FORMATO BC - 15-01-2026").
// Cada BC se crea copiando este archivo (drive.files.copy) en vez de subir el
// .xlsx local y dejar que Google lo convierta -- la conversion xlsx->Sheets
// puede perder bordes/colores/anchos de columna; una copia de un Sheet nativo
// preserva el formato al 100%. El .xlsx local (TEMPLATE_FILENAME) se sigue
// usando solo para la estructura (loadTemplateDefinition: nombres de pestañas,
// filas, aliases) ya que ambos comparten el mismo layout.
const TEMPLATE_SPREADSHEET_ID =
  String(process.env.BC_SHEET_TEMPLATE_SPREADSHEET_ID || "").trim() ||
  "1hKrjRq8cT3yVwlLHyKo-CTxZx_qO3uqKqLyI759-mRk";

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

function resolveMappingPath() {
  const envPath = String(process.env.BC_SHEET_MAPPING_PATH || "").trim();
  const candidatePaths = [];

  if (envPath) {
    candidatePaths.push(path.resolve(envPath));
  }

  candidatePaths.push(path.resolve(__dirname, "../../../Mapeador_Sheets", MAPPING_FILENAME));
  candidatePaths.push(path.resolve(__dirname, "../../../../Mapeador_Sheets", MAPPING_FILENAME));
  candidatePaths.push(path.resolve(__dirname, "../../../../../Mapeador_Sheets", MAPPING_FILENAME));

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
let mappingCache = null;
let equipmentAliasesCache = null;

function loadEquipmentAliases() {
  if (equipmentAliasesCache) return equipmentAliasesCache;
  const candidatePaths = [
    path.resolve(__dirname, "../../../Mapeador_Sheets/equipment_aliases.json"),
    path.resolve(__dirname, "../../../../Mapeador_Sheets/equipment_aliases.json"),
    path.resolve(__dirname, "../../../../../Mapeador_Sheets/equipment_aliases.json"),
  ];
  const found = candidatePaths.find((p) => fs.existsSync(p));
  if (!found) {
    equipmentAliasesCache = new Map();
    return equipmentAliasesCache;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(found, "utf8"));
    const byId = new Map();
    Object.entries(raw.by_id || {}).forEach(([id, aliases]) => {
      if (Array.isArray(aliases) && aliases.length) byId.set(String(id), aliases);
    });
    equipmentAliasesCache = byId;
    logger.info({ path: found, entries: byId.size }, "[SheetGen] equipment_aliases.json cargado");
  } catch (err) {
    logger.warn({ err: err.message }, "[SheetGen] No se pudo cargar equipment_aliases.json");
    equipmentAliasesCache = new Map();
  }
  return equipmentAliasesCache;
}

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

function levenshteinDistance(a = "", b = "") {
  const left = String(a || "");
  const right = String(b || "");
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array(right.length + 1).fill(0);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost,
      );
    }
    for (let j = 0; j <= right.length; j += 1) previous[j] = current[j];
  }

  return previous[right.length];
}

function textSimilarityScore(leftValue, rightValue) {
  const left = normalizeText(leftValue);
  const right = normalizeText(rightValue);
  if (!left || !right) return 0;
  if (left === right) return 100;

  const leftCompact = normalizeCompact(left);
  const rightCompact = normalizeCompact(right);
  if (!leftCompact || !rightCompact) return 0;
  if (leftCompact === rightCompact) return 100;

  const minLength = Math.min(leftCompact.length, rightCompact.length);
  if (minLength >= 6 && (leftCompact.includes(rightCompact) || rightCompact.includes(leftCompact))) {
    return 92;
  }

  const leftTokens = new Set(left.split(/\s+/).filter(Boolean));
  const rightTokens = new Set(right.split(/\s+/).filter(Boolean));
  const intersection = Array.from(leftTokens).filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size || 1;
  const tokenScore = (intersection / union) * 100;

  const distance = levenshteinDistance(leftCompact, rightCompact);
  const distanceScore = (1 - (distance / Math.max(leftCompact.length, rightCompact.length))) * 100;
  return Math.max(tokenScore, distanceScore);
}

function resolveObjectiveRow(objectiveRows, investmentName) {
  const normalizedName = normalizeText(investmentName);
  if (!normalizedName) return null;

  const exactRow = objectiveRows.get(normalizedName);
  if (exactRow) {
    return { rowNumber: exactRow, matchedLabel: normalizedName, score: 100, strategy: "exact" };
  }

  const compactName = normalizeCompact(normalizedName);
  let best = null;
  objectiveRows.forEach((rowNumber, label) => {
    const compactLabel = normalizeCompact(label);
    if (compactName && compactLabel && compactName === compactLabel) {
      best = { rowNumber, matchedLabel: label, score: 100, strategy: "compact" };
      return;
    }
    const score = textSimilarityScore(normalizedName, label);
    if (!best || score > best.score) {
      best = { rowNumber, matchedLabel: label, score, strategy: "fuzzy" };
    }
  });

  if (!best) return null;
  const threshold = compactName.length <= 6 ? 92 : 85;
  return best.score >= threshold ? best : null;
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

function cellAddressToRowColumn(cellAddress) {
  const match = String(cellAddress || "").trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return null;
  const letters = match[1].toUpperCase();
  const row = Number(match[2]);
  if (!row) return null;
  let column = 0;
  for (let i = 0; i < letters.length; i += 1) {
    column = (column * 26) + (letters.charCodeAt(i) - 64);
  }
  return { row, column };
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
  const annualColumn = findColumnIndex(headers, (value) => value.includes("det ano proceso") || value.includes("cantidad proceso ano") || value.includes("producto calculado"));
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

function loadMappingDefinition() {
  if (mappingCache) return mappingCache;
  const resolution = resolveMappingPath();
  if (!fs.existsSync(resolution.path)) {
    mappingCache = { bySheetName: new Map() };
    logger.warn({ triedPaths: resolution.tried }, "No se encontro mapping_auto.json. Se usara parser por heuristica.");
    return mappingCache;
  }

  try {
    const raw = fs.readFileSync(resolution.path, "utf8");
    const parsed = JSON.parse(raw);
    const sheetsDef = Array.isArray(parsed?.sheets) ? parsed.sheets : [];
    const bySheetName = new Map();
    sheetsDef.forEach((entry) => {
      const key = String(entry?.name || "").trim();
      if (key) bySheetName.set(key, entry);
    });
    mappingCache = { bySheetName };
    return mappingCache;
  } catch (error) {
    mappingCache = { bySheetName: new Map() };
    logger.warn({ error: error.message }, "No se pudo parsear mapping_auto.json. Se usara parser por heuristica.");
    return mappingCache;
  }
}

// targetHeader acepta un string o un array de strings candidatos (ej. la
// columna de cantidad anual se llama "DET/AÑO PROCESO" en el bloque de
// reactivos y "PRODUCTO CALCULADO" en el bloque de calibradores/controles/
// materiales de la misma pestaña -- cada bloque solo declara uno de los dos,
// asi que buscar ambos a la vez resuelve el correcto sin ambiguedad).
function _matchesAnyTargetHeader(entry, needles) {
  const normalizedTargetHeader = normalizeText(entry?.target_header);
  const normalizedHeaderText = normalizeText(entry?.header_text);
  return needles.some((needle) => {
    const targetIsDeliver = needle.includes("producto") && (needle.includes("entregar") || needle.includes("enviar"));
    if (targetIsDeliver) {
      return (
        (normalizedTargetHeader.includes("producto") && (normalizedTargetHeader.includes("entregar") || normalizedTargetHeader.includes("enviar"))) ||
        (normalizedHeaderText.includes("producto") && (normalizedHeaderText.includes("entregar") || normalizedHeaderText.includes("enviar")))
      );
    }
    return normalizedTargetHeader.includes(needle) || normalizedHeaderText.includes(needle);
  });
}

function findColumnByTargetHeader(mappingSheet, targetHeader) {
  const headers = Array.isArray(mappingSheet?.fillable_headers) ? mappingSheet.fillable_headers : [];
  const needles = (Array.isArray(targetHeader) ? targetHeader : [targetHeader]).map(normalizeText);
  const match = headers.find((entry) => _matchesAnyTargetHeader(entry, needles));
  return Number(match?.column || 0) || null;
}

function findHeaderRowByTargetHeader(mappingSheet, targetHeader) {
  const headers = Array.isArray(mappingSheet?.fillable_headers) ? mappingSheet.fillable_headers : [];
  const needles = (Array.isArray(targetHeader) ? targetHeader : [targetHeader]).map(normalizeText);
  const match = headers.find((entry) => _matchesAnyTargetHeader(entry, needles));
  return Number(match?.row || 0) || null;
}

function findColumnForRowByTargetHeader(mappingSheet, targetHeader, rowNumber, fallbackColumn = null) {
  const headers = Array.isArray(mappingSheet?.fillable_headers) ? mappingSheet.fillable_headers : [];
  const needles = (Array.isArray(targetHeader) ? targetHeader : [targetHeader]).map(normalizeText);
  const candidates = headers
    .filter((entry) => _matchesAnyTargetHeader(entry, needles))
    .filter((entry) => Number(entry?.row || 0) <= Number(rowNumber || 0))
    .sort((left, right) => Number(left.row || 0) - Number(right.row || 0));

  return Number(candidates[candidates.length - 1]?.column || 0) || fallbackColumn;
}

function buildRowsFromMappingObjectiveTargets(mappingSheet, annualColumn, deliverColumn) {
  const objectiveTargets = Array.isArray(mappingSheet?.empty_fill_targets_objective)
    ? mappingSheet.empty_fill_targets_objective
    : [];

  if (!objectiveTargets.length) return [];

  const byRow = new Map();
  objectiveTargets.forEach((target) => {
    const rowNumber = Number(target?.row || 0);
    if (!rowNumber) return;

    const targetHeader = normalizeText(target?.target_header);
    const isAnnual = targetHeader.includes("det") && targetHeader.includes("proceso");
    const isDeliver = targetHeader.includes("producto") && (targetHeader.includes("entregar") || targetHeader.includes("enviar"));
    if (!isAnnual && !isDeliver) return;

    const labelFromField = normalizeText(target?.label);
    const labelCellAddress = String(target?.label_cell || "").trim();
    const labelCell = cellAddressToRowColumn(labelCellAddress);
    const labelColumn = Number(labelCell?.column || 0) || null;

    const existing = byRow.get(rowNumber) || {
      rowNumber,
      itemId: "",
      label: labelFromField || "",
      labelColumn,
      columns: {
        annual: annualColumn,
        deliver: deliverColumn,
      },
    };

    if (!existing.label && labelFromField) existing.label = labelFromField;
    if (!existing.labelColumn && labelColumn) existing.labelColumn = labelColumn;
    if (isAnnual && Number(target?.column || 0) > 0) existing.columns.annual = Number(target.column);
    if (isDeliver && Number(target?.column || 0) > 0) existing.columns.deliver = Number(target.column);
    byRow.set(rowNumber, existing);
  });

  const rows = Array.from(byRow.values())
    .sort((a, b) => a.rowNumber - b.rowNumber)
    .map((entry) => ({
      rowNumber: entry.rowNumber,
      itemId: entry.itemId || "",
      label: entry.label || "",
      labelColumn: entry.labelColumn || null,
      columns: entry.columns,
    }));

  return rows;
}

function parseEquipmentSheetDefinitionWithMapping(name, ws, mappingSheet) {
  const fallback = parseEquipmentSheetDefinition(name, ws);
  if (!mappingSheet) return fallback;

  const annualColumn = findColumnByTargetHeader(mappingSheet, ANNUAL_QUANTITY_HEADERS) || fallback.columns.annual;
  const deliverColumn = findColumnByTargetHeader(mappingSheet, "PRODUCTO A ENTREGAR") || fallback.columns.deliver;
  const headerRow = findHeaderRowByTargetHeader(mappingSheet, ANNUAL_QUANTITY_HEADERS) || fallback.headerRow;
  const mappedRows = buildRowsFromMappingObjectiveTargets(mappingSheet, annualColumn, deliverColumn);
  const fallbackByRow = new Map((fallback.rows || []).map((row) => [Number(row.rowNumber), row]));

  if (!mappedRows.length) {
    return {
      ...fallback,
      headerRow,
      columns: {
        annual: annualColumn,
        deliver: deliverColumn,
      },
    };
  }

  return {
    ...fallback,
    headerRow,
    columns: {
      annual: annualColumn,
      deliver: deliverColumn,
    },
    rows: Array.from(new Map([
      ...(fallback.rows || []).map((row) => [Number(row.rowNumber), {
        ...row,
        columns: {
          annual: findColumnForRowByTargetHeader(mappingSheet, ANNUAL_QUANTITY_HEADERS, row.rowNumber, annualColumn),
          deliver: findColumnForRowByTargetHeader(mappingSheet, "PRODUCTO A ENTREGAR", row.rowNumber, deliverColumn),
        },
      }]),
      ...mappedRows.map((row) => {
        const fromFallback = fallbackByRow.get(Number(row.rowNumber));
        return [Number(row.rowNumber), {
          ...fromFallback,
          ...row,
          itemId: row.itemId || fromFallback?.itemId || "",
          label: row.label || fromFallback?.label || "",
          columns: {
            annual: findColumnForRowByTargetHeader(mappingSheet, ANNUAL_QUANTITY_HEADERS, row.rowNumber, row.columns?.annual || annualColumn),
            deliver: findColumnForRowByTargetHeader(mappingSheet, "PRODUCTO A ENTREGAR", row.rowNumber, row.columns?.deliver || deliverColumn),
          },
        }];
      }),
    ]).values()).sort((left, right) => Number(left.rowNumber) - Number(right.rowNumber)),
  };
}

function parseNumberFromSheetValue(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return null;
  return parsed;
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

async function pullColumnQuantitiesFromGoogleSheet({ sheetId, equipmentTabs = [], columnField, resultField }) {
  if (!jwtClient || !sheetId) return [];
  const template = loadTemplateDefinition();
  const normalizedTabs = Array.isArray(equipmentTabs) ? equipmentTabs : [];
  if (!normalizedTabs.length) return [];

  const targets = [];
  for (const tab of normalizedTabs) {
    const definition = template.equipmentSheets.find((entry) => entry.name === tab.sheet_name);
    if (!definition?.columns?.[columnField]) continue;
    const rows = Array.isArray(definition.rows) ? definition.rows : [];
    if (!rows.length) continue;
    const rowsByColumn = new Map();
    rows.forEach((row) => {
      const columnIndex = Number(row?.columns?.[columnField] || definition.columns?.[columnField] || 0);
      const rowNumber = Number(row?.rowNumber || 0);
      if (!Number.isInteger(columnIndex) || columnIndex <= 0 || !Number.isInteger(rowNumber) || rowNumber <= 0) return;
      if (!rowsByColumn.has(columnIndex)) rowsByColumn.set(columnIndex, []);
      rowsByColumn.get(columnIndex).push(row);
    });

    rowsByColumn.forEach((columnRows, columnIndex) => {
      const rowNumbers = columnRows.map((row) => Number(row.rowNumber));
      const minRow = Math.min(...rowNumbers);
      const maxRow = Math.max(...rowNumbers);
      const column = columnLetter(columnIndex);
      targets.push({
        sheetName: definition.name,
        range: `${definition.name}!${column}${minRow}:${column}${maxRow}`,
        minRow,
        rows: columnRows,
        tabItems: Array.isArray(tab.items) ? tab.items : [],
      });
    });
  }

  if (!targets.length) return [];

  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId,
    ranges: targets.map((target) => target.range),
    majorDimension: "ROWS",
  });

  const valueRanges = Array.isArray(data?.valueRanges) ? data.valueRanges : [];
  const updatesByItemKey = new Map();

  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    const valueRange = valueRanges[i] || {};
    const values = Array.isArray(valueRange.values) ? valueRange.values : [];
    const lookup = buildSheetItemLookup(target.tabItems);

    for (const rowDef of target.rows) {
      const absoluteRow = Number(rowDef.rowNumber);
      const valueIndex = absoluteRow - target.minRow;
      const rawValue = values[valueIndex]?.[0];
      const parsedValue = parseNumberFromSheetValue(rawValue);
      if (parsedValue === null) continue;

      const matchedItem = rowDef.itemId
        ? lookup.byId.get(normalizeProductId(rowDef.itemId))
        : lookup.byLabel.get(normalizeText(rowDef.label));
      const itemKey = String(matchedItem?.item_key || matchedItem?.itemKey || "").trim();
      if (!itemKey) continue;

      updatesByItemKey.set(itemKey, {
        item_key: itemKey,
        [resultField]: parsedValue,
      });
    }
  }

  return Array.from(updatesByItemKey.values());
}

async function pullMaximumQuantitiesFromGoogleSheet({ sheetId, equipmentTabs = [] }) {
  return pullColumnQuantitiesFromGoogleSheet({ sheetId, equipmentTabs, columnField: "deliver", resultField: "planned_qty" });
}

// Sincronizacion inversa Sheet -> SPI para la columna "Cantidad Anual"
// (reactivos, calibradores, controles, materiales en bc_consumption_items).
// A diferencia de pullMaximumQuantitiesFromGoogleSheet (que corre automatico
// al cargar el dispatch workspace), esta se dispara solo por accion manual
// del usuario (boton "Sincronizar cantidades desde Sheet").
async function pullAnnualQuantitiesFromGoogleSheet({ sheetId, equipmentTabs = [] }) {
  return pullColumnQuantitiesFromGoogleSheet({ sheetId, equipmentTabs, columnField: "annual", resultField: "annual_qty" });
}

function buildAnnualQuantityProtectionRanges({ template, equipmentTabs = [], businessCaseId, subsection }) {
  const normalizedSubsection = String(subsection || "").trim().toLowerCase();
  const descriptionPrefix = `${ANNUAL_QUANTITIES_LOCK_DESCRIPTION}:${businessCaseId || "unknown"}:${normalizedSubsection}`;
  const protectedRanges = [];

  (Array.isArray(equipmentTabs) ? equipmentTabs : []).forEach((tab) => {
    const definition = template?.equipmentSheets?.find((entry) => entry.name === tab?.sheet_name);
    if (!definition) return;

    const allowedTypes = ANNUAL_QUANTITY_ITEM_TYPES[normalizedSubsection] || null;
    const eligibleItems = (Array.isArray(tab.items) ? tab.items : []).filter((item) => {
      if (!allowedTypes) return true;
      return allowedTypes.has(String(item?.item_type || item?.itemType || item?.type || "").trim().toLowerCase());
    });
    const lookup = buildSheetItemLookup(eligibleItems);
    const rowsByColumn = new Map();
    (Array.isArray(definition.rows) ? definition.rows : []).forEach((row) => {
      const item = row?.itemId
        ? lookup.byId.get(normalizeProductId(row.itemId))
        : lookup.byLabel.get(normalizeText(row?.label));
      if (!item) return;

      const columnIndex = Number(row?.columns?.annual || definition.columns?.annual || 0);
      const rowNumber = Number(row?.rowNumber || 0);
      if (!Number.isInteger(columnIndex) || columnIndex <= 0 || !Number.isInteger(rowNumber) || rowNumber <= 0) return;
      if (!rowsByColumn.has(columnIndex)) rowsByColumn.set(columnIndex, []);
      rowsByColumn.get(columnIndex).push(rowNumber);
    });

    rowsByColumn.forEach((rawRows, columnIndex) => {
      const rowNumbers = Array.from(new Set(rawRows)).sort((left, right) => left - right);
      let startRow = null;
      let previousRow = null;

      const appendRange = (endRow) => {
        if (!Number.isInteger(startRow)) return;
        protectedRanges.push({
          description: `${descriptionPrefix}:${definition.name}:${startRow}-${endRow}`,
          range: {
            sheetTitle: definition.name,
            startRowIndex: startRow - 1,
            endRowIndex: endRow,
            startColumnIndex: columnIndex - 1,
            endColumnIndex: columnIndex,
          },
        });
      };

      rowNumbers.forEach((rowNumber) => {
        if (startRow === null) {
          startRow = rowNumber;
        } else if (rowNumber !== previousRow + 1) {
          appendRange(previousRow);
          startRow = rowNumber;
        }
        previousRow = rowNumber;
      });
      appendRange(previousRow);
    });
  });

  return protectedRanges;
}

async function getProtectedRangesForSpreadsheet(sheetId) {
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    includeGridData: false,
    fields: "sheets(properties(sheetId,title),protectedRanges(protectedRangeId,description))",
  });
  return data;
}

async function protectAnnualQuantityCellsForSubsection({ sheetId, businessCaseId, subsection, equipmentTabs = [] }) {
  if (!jwtClient || !sheetId) {
    return { protected: false, reason: "GOOGLE_SHEETS_DISABLED", protectedRanges: 0 };
  }

  const template = loadTemplateDefinition();
  const requestedRanges = buildAnnualQuantityProtectionRanges({
    template,
    equipmentTabs,
    businessCaseId,
    subsection,
  });
  const normalizedSubsection = String(subsection || "").trim().toLowerCase();
  const descriptionPrefix = `${ANNUAL_QUANTITIES_LOCK_DESCRIPTION}:${businessCaseId || "unknown"}:${normalizedSubsection}`;
  const { data } = await getProtectedRangesForSpreadsheet(sheetId);
  const sheetIdsByTitle = new Map(
    (data.sheets || []).map((sheet) => [sheet?.properties?.title, sheet?.properties?.sheetId]),
  );
  const requests = [];

  (data.sheets || []).forEach((sheet) => {
    (sheet.protectedRanges || []).forEach((range) => {
      if (!String(range?.description || "").startsWith(descriptionPrefix)) return;
      if (Number.isInteger(range?.protectedRangeId)) {
        requests.push({ deleteProtectedRange: { protectedRangeId: range.protectedRangeId } });
      }
    });
  });

  requestedRanges.forEach((entry) => {
    const sheetNumericId = sheetIdsByTitle.get(entry.range.sheetTitle);
    if (!Number.isInteger(sheetNumericId)) return;
    const { sheetTitle, ...gridRange } = entry.range;
    requests.push({
      addProtectedRange: {
        protectedRange: {
          description: entry.description,
          warningOnly: false,
          range: { sheetId: sheetNumericId, ...gridRange },
          ...(googleDelegatedUser
            ? {
                editors: {
                  users: [googleDelegatedUser],
                  domainUsersCanEdit: false,
                },
              }
            : {}),
        },
      },
    });
  });

  if (!requests.length) {
    return { protected: false, reason: "NO_ANNUAL_CELLS_FOUND", protectedRanges: 0 };
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests },
  });

  return {
    protected: requestedRanges.length > 0,
    reason: requestedRanges.length > 0 ? null : "NO_ANNUAL_CELLS_FOUND",
    protectedRanges: requestedRanges.length,
  };
}

async function unprotectAnnualQuantityCellsForSubsection({ sheetId, businessCaseId, subsection }) {
  if (!jwtClient || !sheetId) {
    return { unprotected: false, reason: "GOOGLE_SHEETS_DISABLED", protectedRanges: 0 };
  }

  const normalizedSubsection = String(subsection || "").trim().toLowerCase();
  const descriptionPrefix = `${ANNUAL_QUANTITIES_LOCK_DESCRIPTION}:${businessCaseId || "unknown"}:${normalizedSubsection}`;
  const { data } = await getProtectedRangesForSpreadsheet(sheetId);
  const requests = [];
  let deletedRanges = 0;

  (data.sheets || []).forEach((sheet) => {
    (sheet.protectedRanges || []).forEach((range) => {
      if (!String(range?.description || "").startsWith(descriptionPrefix)) return;
      if (!Number.isInteger(range?.protectedRangeId)) return;
      requests.push({ deleteProtectedRange: { protectedRangeId: range.protectedRangeId } });
      deletedRanges += 1;
    });
  });

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests },
    });
  }

  return { unprotected: deletedRanges > 0, reason: null, protectedRanges: deletedRanges };
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
  const mappingDefinition = loadMappingDefinition();
  const equipmentSheets = workbook.SheetNames
    .filter((name) => name !== "BC")
    .map((name) => parseEquipmentSheetDefinitionWithMapping(
      name,
      workbook.Sheets[name],
      mappingDefinition.bySheetName.get(name),
    ));

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
  const id = String(record.id ?? "");
  if (id) {
    const extras = loadEquipmentAliases().get(id) || [];
    extras.forEach((a) => aliases.add(a));
  }
  return Array.from(aliases);
}

function buildValueRange(range, values) {
  return { range, values: [[values]] };
}

async function createSpreadsheetFromTemplate({ outputFolderId, businessCaseName }) {
  const name = businessCaseName || `BC-${Date.now()}`;

  const { data } = await drive.files.copy({
    fileId: TEMPLATE_SPREADSHEET_ID,
    supportsAllDrives: true,
    requestBody: {
      name,
      parents: outputFolderId ? [outputFolderId] : undefined,
    },
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

async function protectSpreadsheetAfterMaximumQuantitiesSync({ sheetId, businessCaseId }) {
  if (!jwtClient || !sheetId) {
    return {
      protected: false,
      reason: "GOOGLE_SHEETS_DISABLED",
      protectedSheets: 0,
    };
  }

  const description = `${MAX_QUANTITIES_LOCK_DESCRIPTION}:${businessCaseId || "unknown"}`;
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    includeGridData: false,
    fields: "sheets(properties(sheetId,title),protectedRanges(protectedRangeId,description))",
  });

  const requests = [];
  (data.sheets || []).forEach((sheet) => {
    const sheetProperties = sheet?.properties || {};
    const sheetNumericId = sheetProperties.sheetId;
    if (!Number.isInteger(sheetNumericId)) return;

    (sheet.protectedRanges || []).forEach((range) => {
      if (String(range?.description || "").startsWith(MAX_QUANTITIES_LOCK_DESCRIPTION)) {
        requests.push({
          deleteProtectedRange: {
            protectedRangeId: range.protectedRangeId,
          },
        });
      }
    });

    requests.push({
      addProtectedRange: {
        protectedRange: {
          description,
          warningOnly: false,
          range: {
            sheetId: sheetNumericId,
          },
          ...(googleDelegatedUser
            ? {
                editors: {
                  users: [googleDelegatedUser],
                  domainUsersCanEdit: false,
                },
              }
            : {}),
        },
      },
    });
  });

  if (!requests.length) {
    return {
      protected: false,
      reason: "NO_SHEETS_FOUND",
      protectedSheets: 0,
    };
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests },
  });

  return {
    protected: true,
    protectedSheets: (data.sheets || []).length,
    reason: null,
  };
}

async function deleteFileIfExists(fileId) {
  if (!fileId) return;
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch (error) {
    logger.warn({ fileId, error: error.message }, "No se pudo eliminar el spreadsheet previo del BC");
  }
}

async function ensureSpreadsheet({ requiredSheetNames, existingSheetId, outputFolderId, businessCaseName, forceRecreate = false }) {
  if (existingSheetId) {
    try {
      const meta = await getSpreadsheetMeta(existingSheetId);
      const missingSheetNames = requiredSheetNames.filter((name) => !meta.sheetMap.has(name));
      const hasAllSheets = missingSheetNames.length === 0;
      if (hasAllSheets && !forceRecreate) {
        return {
          spreadsheetId: existingSheetId,
          spreadsheetUrl: meta.data?.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${existingSheetId}/edit`,
          sheetMap: meta.sheetMap,
          existing: true,
          recreated: false,
          replacementReason: null,
          missingSheetNames: [],
        };
      }

      await deleteFileIfExists(existingSheetId);
      logger.warn(
        { existingSheetId, missingSheetNames, forceRecreate },
        forceRecreate
          ? "Regeneracion forzada solicitada. Se recreara desde plantilla."
          : "Spreadsheet previo incompleto. Se recreara desde plantilla.",
      );

      const created = await createSpreadsheetFromTemplate({ outputFolderId, businessCaseName });
      const createdMeta = await getSpreadsheetMeta(created.sheetId);
      return {
        spreadsheetId: created.sheetId,
        spreadsheetUrl: created.sheetUrl,
        sheetMap: createdMeta.sheetMap,
        existing: false,
        recreated: true,
        replacementReason: forceRecreate && hasAllSheets ? "forced_regenerate" : "missing_required_sheets",
        missingSheetNames,
      };
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
    recreated: false,
    replacementReason: existingSheetId ? "existing_sheet_unusable" : null,
    missingSheetNames: [],
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
  clears.push(
    `BC!A${DYNAMIC_INVESTMENTS_START_ROW}:E${DYNAMIC_INVESTMENTS_START_ROW + DYNAMIC_INVESTMENTS_CLEAR_ROWS - 1}`,
  );

  const unmatchedInvestments = [];
  const fuzzyMatchedInvestments = [];
  const rowPayloads = new Map();

  const stageInvestmentRow = (rowNumber, name, investment, strategy = "exact") => {
    const cantidad = Number(investment?.cantidad ?? 0);
    const precio = Number(investment?.precio ?? 0);
    const safeCantidad = Number.isFinite(cantidad) ? cantidad : 0;
    const safePrecio = Number.isFinite(precio) ? precio : 0;
    const current = rowPayloads.get(rowNumber) || {
      names: [],
      descriptions: [],
      quantitySum: 0,
      totalValue: 0,
      firstQuantity: "",
      firstPrice: "",
      strategies: new Set(),
    };
    current.names.push(name);
    current.descriptions.push(String(investment?.descripcion || investment?.observaciones || investment?.notes || name || "").trim());
    current.quantitySum += safeCantidad;
    current.totalValue += safeCantidad * safePrecio;
    if (current.firstQuantity === "") current.firstQuantity = investment?.cantidad ?? "";
    if (current.firstPrice === "") current.firstPrice = investment?.precio ?? "";
    current.strategies.add(strategy);
    rowPayloads.set(rowNumber, current);
  };

  Object.entries(payload.inversiones || {}).forEach(([name, investment]) => {
    const match = resolveObjectiveRow(objectiveRows, name);
    if (!match?.rowNumber) {
      unmatchedInvestments.push({ name, investment });
      return;
    }
    const rowNumber = match.rowNumber;
    if (match.strategy !== "exact") {
      fuzzyMatchedInvestments.push({
        input: name,
        matched_label: match.matchedLabel,
        row: rowNumber,
        score: Number(match.score.toFixed(2)),
        strategy: match.strategy,
      });
    }
    stageInvestmentRow(rowNumber, name, investment, match.strategy);
  });

  rowPayloads.forEach((entry, rowNumber) => {
    const isGrouped = entry.names.length > 1;
    const displayValues = (entry.descriptions.length ? entry.descriptions : entry.names)
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const label = isGrouped ? displayValues.join("; ") : (displayValues[0] || entry.names[0]);
    const quantity = isGrouped ? (entry.totalValue > 0 ? 1 : entry.quantitySum) : entry.firstQuantity;
    const price = isGrouped ? (entry.totalValue > 0 ? entry.totalValue : entry.firstPrice) : entry.firstPrice;
    updates.push(buildValueRange(`BC!B${rowNumber}`, label));
    updates.push(buildValueRange(`BC!D${rowNumber}`, quantity));
    updates.push(buildValueRange(`BC!E${rowNumber}`, price));
  });

  unmatchedInvestments.forEach(({ name, investment }, index) => {
    const rowNumber = DYNAMIC_INVESTMENTS_START_ROW + index;
    const description = String(
      investment?.caracteristicas ||
      investment?.descripcion ||
      investment?.observaciones ||
      investment?.notes ||
      "",
    ).trim();
    updates.push(buildValueRange(`BC!A${rowNumber}`, investment?.nombre || name));
    updates.push(buildValueRange(`BC!B${rowNumber}`, description));
    updates.push(buildValueRange(`BC!C${rowNumber}`, investment?.categoria || ""));
    updates.push(buildValueRange(`BC!D${rowNumber}`, investment?.cantidad ?? ""));
    updates.push(buildValueRange(`BC!E${rowNumber}`, investment?.precio ?? ""));
  });

  if (fuzzyMatchedInvestments.length) {
    logger.info({ matches: fuzzyMatchedInvestments }, "[SheetGen] inversiones mapeadas con normalizacion tolerante");
  }
  if (unmatchedInvestments.length) {
    logger.warn(
      {
        names: unmatchedInvestments.map((entry) => entry.name),
        start_row: DYNAMIC_INVESTMENTS_START_ROW,
        rows: unmatchedInvestments.length,
      },
      "[SheetGen] inversiones nuevas enviadas a filas dinamicas",
    );
  }

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

  const rowsByAnnualColumn = new Map();
  (definition.rows || []).forEach((row) => {
    const columnIndex = Number(row?.columns?.annual || definition.columns?.annual || 0);
    const rowNumber = Number(row?.rowNumber || 0);
    if (!Number.isInteger(columnIndex) || columnIndex <= 0 || !Number.isInteger(rowNumber) || rowNumber <= 0) return;
    if (!rowsByAnnualColumn.has(columnIndex)) rowsByAnnualColumn.set(columnIndex, []);
    rowsByAnnualColumn.get(columnIndex).push(rowNumber);
  });
  rowsByAnnualColumn.forEach((rowNumbers, columnIndex) => {
    const minRow = Math.min(...rowNumbers);
    const maxRow = Math.max(...rowNumbers);
    clears.push(`${definition.name}!${columnLetter(columnIndex)}${minRow}:${columnLetter(columnIndex)}${maxRow}`);
  });
  // PRODUCTO A ENTREGAR is user-owned in the sheet.
  // Do not clear it during sync to avoid overwriting manually curated maximum quantities.

  const lookup = buildSheetItemLookup(sheetPayload.items || []);
  definition.rows.forEach((row) => {
    const item = row.itemId ? lookup.byId.get(row.itemId) : lookup.byLabel.get(row.label);
    if (!item) return;
    const annualColumn = Number(row?.columns?.annual || definition.columns?.annual || 0);
    if (annualColumn > 0) {
      updates.push(buildValueRange(`${definition.name}!${columnLetter(annualColumn)}${row.rowNumber}`, item.annual_qty ?? item.annualQty ?? ""));
    }
    // PRODUCTO A ENTREGAR is intentionally not written from backend mapping.
    // SPI must consume the maximum quantities entered directly by users in the sheet.
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

  if (!equipmentRecords.length) {
    logger.warn("[SheetGen] buildSheetPayloads: no equipment records provided — equipment tabs will be empty");
  }

  template.equipmentSheets.forEach((sheetDefinition) => {
    const matchedRecords = recordsWithAliases.filter((record) => scoreAliases(record.aliases, sheetDefinition.aliases) >= 85);
    if (!matchedRecords.length) {
      if (equipmentRecords.length) {
        const scores = recordsWithAliases.map((r) => ({ name: r.name, score: scoreAliases(r.aliases, sheetDefinition.aliases), recordAliases: r.aliases, sheetAliases: sheetDefinition.aliases }));
        logger.warn({ sheet: sheetDefinition.name, scores }, "[SheetGen] No equipment record matched sheet — alias scoring miss");
      }
      return;
    }

    const matchedIds = new Set(matchedRecords.map((record) => Number(record.id)).filter((value) => Number.isInteger(value) && value > 0));
    // The reverse annual sync passes catalog identities separately from the
    // maximum-quantity values stored in PRODUCTO A ENTREGAR.
    const syncItems = payload.sync_items || payload.max_quantities || [];
    const matchedItems = syncItems.filter((item) => {
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

async function syncBusinessCaseToGoogleSheet({ businessCase, outputFolderId, payload = {}, previousSheetId = null, forceRecreate = false }) {
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
    forceRecreate,
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
    reused_existing_file: spreadsheet.existing === true,
    recreated_file: spreadsheet.recreated === true,
    replacement_reason: spreadsheet.replacementReason || null,
    missing_required_sheets: Array.isArray(spreadsheet.missingSheetNames) ? spreadsheet.missingSheetNames : [],
    previous_sheet_id: previousSheetId || null,
  };
}

function clearSheetCaches() {
  templateCache = null;
  mappingCache = null;
  equipmentAliasesCache = null;
}

module.exports = {
  ANNUAL_QUANTITY_HEADERS,
  findColumnForRowByTargetHeader,
  loadTemplateDefinition,
  buildRecordAliases,
  scoreAliases,
  buildSheetPayloads,
  pullMaximumQuantitiesFromGoogleSheet,
  pullAnnualQuantitiesFromGoogleSheet,
  buildAnnualQuantityProtectionRanges,
  protectAnnualQuantityCellsForSubsection,
  unprotectAnnualQuantityCellsForSubsection,
  protectSpreadsheetAfterMaximumQuantitiesSync,
  syncBusinessCaseToGoogleSheet,
  clearSheetCaches,
};
