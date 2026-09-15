const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { drive, sheets, jwtClient } = require("../../config/google");
const logger = require("../../config/logger");
const { googleDelegatedUser } = require("../../utils/googleCredentials");

const TEMPLATE_FILENAME = "TABLA BASE BC.xlsx";
const MAPPING_FILENAME = "mapping_auto.json";
const DYNAMIC_INVESTMENTS_START_ROW = 131;
const DYNAMIC_INVESTMENTS_CLEAR_ROWS = 75;
const MAX_QUANTITIES_LOCK_DESCRIPTION = "SPI_LOCK_MAX_QUANTITIES_POST_FEASIBILITY";
const ANNUAL_QUANTITIES_LOCK_DESCRIPTION = "SPI_LOCK_ANNUAL_QUANTITIES_VALIDATED";
const ANNUAL_QUANTITY_ITEM_TYPES = {
  reactivos: new Set(["reactivo", "determinacion"]),
  controles: new Set(["control"]),
  calibradores: new Set(["calibrador"]),
  materiales: new Set(["consumible", "material"]),
};
const DELIVER_QUANTITY_HEADERS = ["PRODUCTO A ENTREGAR", "PRODUCTO A ENVIAR"];
const ANNUAL_SERVICIO_HEADER = "PRODUCTO CALCULADO";
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
  "1FfB2ycMqvXAa2hLYQXFn_D1UZwfSnM_Rd77SWbtKo08";

function resolveTemplatePath() {
  const envPath = String(process.env.BC_SHEET_TEMPLATE_PATH || "").trim();
  const candidatePaths = [];

  if (envPath) {
    candidatePaths.push(path.resolve(envPath));
  }

  // Common layouts:
  // 1) monorepo root: /<repo>/Mapeador_Sheets/TABLA BASE BC.xlsx
  // 2) backend root:  /<repo>/backend/Mapeador_Sheets/TABLA BASE BC.xlsx
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
  let inInvestmentBlock = false;

  for (let row = range.s.r + 1; row <= range.e.r + 1; row += 1) {
    const label = String(getCellValue(ws, `A${row}`) || "").trim();
    if (!label) continue;
    const normalizedLabel = normalizeText(label);
    if (normalizedLabel.includes("inversiones adicionales")) {
      inInvestmentBlock = true;
      continue;
    }
    if (
      inInvestmentBlock &&
      (normalizedLabel === "sub total" ||
        normalizedLabel === "total" ||
        normalizedLabel.includes("porque es importante ganar este proceso"))
    ) {
      inInvestmentBlock = false;
    }
    if (normalizedLabel.includes("porque es importante ganar este proceso")) {
      fieldCells.SmartObjective = pickWritableCell(ws, row, 2, 5);
      continue;
    }
    const fieldKey = BC_LABEL_FIELD_MAP.get(normalizedLabel);
    if (fieldKey) {
      fieldCells[fieldKey] = pickWritableCell(ws, row, 2, 5);
    }
    if (inInvestmentBlock) {
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
  const itemTypeByRow = inferItemTypeByRow(ws, range, name);
  const offerSectionByRow = inferOfferSectionByRow(ws, range);

  let idColumn = findColumnIndex(headers, (value) => value === "id" || value === "i d");
  let labelColumn = findColumnIndex(headers, (value) => value === "producto" || value === "reactivo" || value === "descripcion");
  // Bug real confirmado en la pestana " e402 e801": su fila de encabezado
  // trae "DESCRIPCION" e "I.D" en el orden de columna invertido respecto a
  // los datos reales de abajo (columna A = codigo numerico, columna B =
  // texto -- pero el header dice lo contrario), lo que hacia que TODO
  // renglon de esa pestana quedara con id/label mezclados y nunca matcheara
  // contra bc_consumption_items. Se valida contra una muestra de filas
  // reales: si la columna que el header llama "ID" en realidad contiene
  // texto (y la de "DESCRIPCION" contiene codigos numericos), se
  // intercambian.
  if (idColumn && labelColumn && idColumn !== labelColumn) {
    let idNumericSamples = 0;
    let labelNumericSamples = 0;
    let sampleCount = 0;
    for (let row = headerRow + 1; row <= Math.min(headerRow + 15, range.e.r + 1); row += 1) {
      const idSample = String(getCellValue(ws, `${columnLetter(idColumn)}${row}`) || "").trim();
      const labelSample = String(getCellValue(ws, `${columnLetter(labelColumn)}${row}`) || "").trim();
      if (!idSample && !labelSample) continue;
      sampleCount += 1;
      if (/^[0-9][0-9.\-]*$/.test(idSample)) idNumericSamples += 1;
      if (/^[0-9][0-9.\-]*$/.test(labelSample)) labelNumericSamples += 1;
    }
    if (sampleCount >= 3 && labelNumericSamples > idNumericSamples) {
      [idColumn, labelColumn] = [labelColumn, idColumn];
    }
  }
  const annualColumn = findColumnIndex(headers, (value) => value.includes("det ano proceso") || value.includes("cantidad proceso ano") || value.includes("producto calculado"));
  const deliverColumn = findColumnIndex(headers, (value) => value.includes("producto a entregar") || value.includes("producto a enviar"));
  // "DET/KIT" es un valor FIJO de catalogo (rendimiento del kit, ej. 400
  // determinaciones), no una cantidad -- nunca confundir con "DET/AÑO
  // PROCESO" (annualColumn, cantidad que llena comercial) ni con "PRODUCTO
  // CALCULADO". Bug real: la oferta mostraba ahi la cantidad anual/calculada
  // en vez de este valor de catalogo porque nadie lo leia del sheet.
  const detKitColumn = findColumnIndex(headers, (value) => value === "det kit" || value === "det/kit");

  const rows = [];
  for (let row = headerRow + 1; row <= range.e.r + 1; row += 1) {
    const idValue = idColumn ? getCellValue(ws, `${columnLetter(idColumn)}${row}`) : "";
    const labelValue = labelColumn ? getCellValue(ws, `${columnLetter(labelColumn)}${row}`) : "";
    const normalizedId = normalizeProductId(idValue);
    const normalizedLabel = normalizeText(labelValue);
    if (!normalizedId && !normalizedLabel) continue;
    const detKitValue = detKitColumn ? getCellValue(ws, `${columnLetter(detKitColumn)}${row}`) : "";
    const parsedDetKit = parseNumberFromSheetValue(detKitValue);
    rows.push({
      rowNumber: row,
      itemId: normalizedId,
      label: normalizedLabel,
      itemType: itemTypeByRow.get(row) || "reactivo",
      offerSection: offerSectionByRow.get(row) || null,
      detKit: parsedDetKit === null ? null : parsedDetKit,
    });
  }

  // Fila "EQUIPO" (ej. fila 6: A="EQUIPO", B="COBAS PURE c303", D="COBAS PRO
  // c503") solo existe en las pestanas combo -- nombra los 2 submodelos
  // reales que comparten esa pestana. No hay marca por renglon de a cual
  // submodelo pertenece cada reactivo (es un listado compartido), pero esta
  // fila si permite mostrar el nombre real de cada submodelo al separar la
  // oferta de un equipo combo (ver expandComboOfferTarget en
  // businessCaseOffer.service.js).
  let subEquipmentNames = [];
  for (let row = 1; row <= Math.min(headerRow, 10); row += 1) {
    if (String(getCellValue(ws, `A${row}`) || "").trim().toUpperCase() === "EQUIPO") {
      const values = [];
      for (let col = 2; col <= 12; col += 1) {
        const value = String(getCellValue(ws, `${columnLetter(col)}${row}`) || "").trim();
        if (value) values.push(value);
      }
      subEquipmentNames = values;
      break;
    }
  }

  return {
    name,
    aliases: collectSheetAliases(ws, range, name),
    headerRow,
    subEquipmentNames,
    columns: {
      // Fallback heuristico (sin mapping_auto.json): no hay forma de
      // distinguir estructuralmente comercial vs servicio, asi que la unica
      // columna detectada sirve como mejor esfuerzo para ambas variantes.
      annual: annualColumn,
      annualComercial: annualColumn,
      annualServicio: annualColumn,
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

function inferItemTypeFromSectionLabel(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (normalized.includes("calibrador")) return "calibrador";
  if (normalized.includes("control")) return "control";
  if (
    normalized.includes("consumible") ||
    normalized.includes("material") ||
    normalized.includes("insumo")
  ) {
    return "material";
  }
  if (
    normalized === "i d" ||
    normalized === "id" ||
    normalized.includes("det ano") ||
    normalized.includes("det a o") ||
    normalized.includes("determinacion")
  ) {
    return "reactivo";
  }
  return null;
}

function inferItemTypeByRow(ws, range, sheetName = "") {
  const result = new Map();
  let currentType = "reactivo";
  // true solo mientras estamos dentro de un encabezado que menciona AMBOS
  // "control" y "calibrador" a la vez (ej. "CONTROLES Y CALIBRADORES",
  // confirmado en cobas Pure c303/c503). Secciones limpias como "CONTROLES"
  // o "CALIBRADORES" por separado (ej. e411) no activan esto.
  let currentSectionAmbiguous = false;

  for (let row = range.s.r + 1; row <= range.e.r + 1; row += 1) {
    const labelA = getCellValue(ws, `A${row}`);
    const sectionType = inferItemTypeFromSectionLabel(labelA);
    if (sectionType) {
      currentType = sectionType;
      const normalizedLabel = normalizeText(labelA);
      const wasAmbiguous = currentSectionAmbiguous;
      currentSectionAmbiguous = normalizedLabel.includes("control") && normalizedLabel.includes("calibrador");
      // Alerta permanente: si aparece un encabezado control+calibrador
      // fusionado en un equipo nuevo (o editan la plantilla), esto lo hace
      // visible en logs en vez de fallar en silencio como paso con
      // c303/c503 (ver businessCaseSheetSyncLocal.mapping.test.js, test
      // "encabezados fusionados control/calibrador" -- ese test tambien
      // audita toda la plantilla real).
      if (currentSectionAmbiguous && !wasAmbiguous) {
        logger.warn(
          { sheetName, row, label: labelA },
          "BC sheet sync: encabezado de seccion ambiguo (control+calibrador fusionados) -- desambiguando por nombre de fila",
        );
      }
    }

    const idValue = normalizeProductId(labelA);
    const descriptionValue = normalizeText(getCellValue(ws, `B${row}`));
    const nameValue = normalizeText(getCellValue(ws, `C${row}`));
    if (idValue || descriptionValue || nameValue) {
      let rowType = currentType;
      // Dentro del bloque fusionado, inferItemTypeFromSectionLabel siempre
      // resuelve "calibrador" primero (ver esa funcion) y todo el bloque
      // queda mal clasificado. El nombre propio de cada fila es mas
      // confiable ahi: la mayoria de controles reales trae "control" en su
      // nombre (ej. "precicontrol", "d dimer gen 2 control i ii", "rf
      // control set"), y "precinorm"/"precipath" son las lineas de control
      // Roche que NO llevan la palabra "control" (confirmado contra BC real
      // 54762e41-74c9-45fb-80e0-454b9bf040a8: "precinorm puc"/"precipath puc"
      // son controles, no calibradores). Los calibradores reales no matchean
      // ninguno de estos.
      if (currentSectionAmbiguous) {
        const rowLabel = `${descriptionValue} ${nameValue}`;
        const isControl = rowLabel.includes("control") || rowLabel.includes("precinorm") || rowLabel.includes("precipath");
        rowType = isControl ? "control" : "calibrador";
      }
      result.set(row, rowType);
    }
  }

  return result;
}

function inferOfferSectionByRow(ws, range) {
  const result = new Map();
  let currentSection = null;

  for (let row = range.s.r + 1; row <= range.e.r + 1; row += 1) {
    const label = normalizeText(getCellValue(ws, `A${row}`));
    if (label.includes("sistema para electrolitos") || label === "electrolitos") {
      currentSection = "electrolito";
    } else if (label === "consumibles" || label === "materiales") {
      currentSection = "consumible";
    }
    if (currentSection) result.set(row, currentSection);
  }

  return result;
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
// materiales de la misma pestaña). Confirmado contra hojas reales que los
// dos textos a veces coexisten en el MISMO bloque (DET/AÑO/PROCESO como
// fuente manual autoritativa + PRODUCTO CALCULADO como espejo calculado):
// por eso NO basta con juntar ambos en un solo pool y tomar "el mas cercano"
// -- hay que resolver cada needle por separado y, en caso de empate de fila,
// preferir el que aparece primero en la lista (DET/AÑO PROCESO antes que
// PRODUCTO CALCULADO). Cuando estan en bloques distintos, gana el bloque
// mas cercano (mayor fila), sin importar cual de los dos textos sea.
function _matchesTargetHeader(entry, needle) {
  const normalizedTargetHeader = normalizeText(entry?.target_header);
  const normalizedHeaderText = normalizeText(entry?.header_text);
  const targetIsDeliver = needle.includes("producto") && (needle.includes("entregar") || needle.includes("enviar"));
  if (targetIsDeliver) {
    return (
      (normalizedTargetHeader.includes("producto") && (normalizedTargetHeader.includes("entregar") || normalizedTargetHeader.includes("enviar"))) ||
      (normalizedHeaderText.includes("producto") && (normalizedHeaderText.includes("entregar") || normalizedHeaderText.includes("enviar")))
    );
  }
  return normalizedTargetHeader.includes(needle) || normalizedHeaderText.includes(needle);
}

// "fillable_headers" solo registra columnas de LLENADO MANUAL -- una columna
// calculada por formula como "PRODUCTO CALCULADO" nunca aparece ahi (se
// confirmo en la pestaña real "b123": F8 = "PRODUCTO CALCULADO" existe en el
// volcado completo `cells`, pero no en `fillable_headers`). Por eso los
// candidatos de encabezado deben salir de AMBAS fuentes: fillable_headers
// (para columnas editables como DET/AÑO PROCESO) y cells (para columnas
// calculadas como PRODUCTO CALCULADO), no solo de la primera.
function _collectHeaderEntries(mappingSheet) {
  const fillable = Array.isArray(mappingSheet?.fillable_headers) ? mappingSheet.fillable_headers : [];
  const rawCells = mappingSheet?.cells;
  const cellEntries = [];
  const pushCellEntry = (cell) => {
    if (!cell || typeof cell.value !== "string" || !cell.value.trim()) return;
    const row = Number(cell.row || 0);
    const column = Number(cell.column_index || cell.column || 0);
    if (!row || !column) return;
    cellEntries.push({ row, column, target_header: cell.value, header_text: cell.value });
  };
  if (Array.isArray(rawCells)) {
    rawCells.forEach(pushCellEntry);
  } else if (rawCells && typeof rawCells === "object") {
    Object.values(rawCells).forEach(pushCellEntry);
  }
  return [...fillable, ...cellEntries];
}

// Para cada needle (en orden de prioridad), busca la entrada cuya fila sea la
// mas cercana (mayor) sin pasarse de maxRow. Devuelve la mejor entre todos
// los needles: gana la de mayor fila; en empate, gana el needle que aparece
// primero en la lista.
function _bestHeaderEntry(headers, needles, maxRow = Infinity) {
  let best = null;
  needles.forEach((needle) => {
    const candidates = headers
      .filter((entry) => _matchesTargetHeader(entry, needle))
      .filter((entry) => Number(entry?.row || 0) <= maxRow)
      .sort((left, right) => Number(left.row || 0) - Number(right.row || 0));
    const closest = candidates[candidates.length - 1];
    if (closest && (!best || Number(closest.row || 0) > Number(best.row || 0))) {
      best = closest;
    }
  });
  return best;
}

function findColumnByTargetHeader(mappingSheet, targetHeader) {
  const headers = _collectHeaderEntries(mappingSheet);
  const needles = (Array.isArray(targetHeader) ? targetHeader : [targetHeader]).map(normalizeText);
  const match = _bestHeaderEntry(headers, needles);
  return Number(match?.column || 0) || null;
}

function findHeaderRowByTargetHeader(mappingSheet, targetHeader) {
  const headers = _collectHeaderEntries(mappingSheet);
  const needles = (Array.isArray(targetHeader) ? targetHeader : [targetHeader]).map(normalizeText);
  const match = _bestHeaderEntry(headers, needles);
  return Number(match?.row || 0) || null;
}

function findColumnForRowByTargetHeader(mappingSheet, targetHeader, rowNumber, fallbackColumn = null) {
  const headers = _collectHeaderEntries(mappingSheet);
  const needles = (Array.isArray(targetHeader) ? targetHeader : [targetHeader]).map(normalizeText);
  const match = _bestHeaderEntry(headers, needles, Number(rowNumber || 0));
  return Number(match?.column || 0) || fallbackColumn;
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
        annualComercial: annualColumn,
        deliver: deliverColumn,
      },
    };

    if (!existing.label && labelFromField) existing.label = labelFromField;
    if (!existing.labelColumn && labelColumn) existing.labelColumn = labelColumn;
    // "DET/AÑO PROCESO" es la columna que llena acp_comercial (reactivos).
    // empty_fill_targets_objective solo detecta headers de LLENADO MANUAL,
    // por lo que nunca produce una entrada para "PRODUCTO CALCULADO" (columna
    // calculada por formula que llena jefe_servicio) -- esa se resuelve por
    // separado en parseEquipmentSheetDefinitionWithMapping via _cells.
    if (isAnnual && Number(target?.column || 0) > 0) {
      existing.columns.annualComercial = Number(target.column);
      existing.annualComercialPrecise = true;
    }
    if (isDeliver && Number(target?.column || 0) > 0) {
      existing.columns.deliver = Number(target.column);
      existing.deliverPrecise = true;
    }
    byRow.set(rowNumber, existing);
  });

  const rows = Array.from(byRow.values())
    .sort((a, b) => a.rowNumber - b.rowNumber)
    .map((entry) => ({
      rowNumber: entry.rowNumber,
      itemId: entry.itemId || "",
      label: entry.label || "",
      labelColumn: entry.labelColumn || null,
      itemType: entry.itemType || null,
      columns: entry.columns,
      annualComercialPrecise: Boolean(entry.annualComercialPrecise),
      deliverPrecise: Boolean(entry.deliverPrecise),
    }));

  return rows;
}

// La cantidad anual tiene DOS columnas posibles, con dueños distintos, y NO
// se resuelven por proximidad de fila ni por "cual esta mas cerca": son
// propiedad de un ROL cada una, confirmado con el negocio:
//   - "DET/AÑO PROCESO": la llena acp_comercial. Aplica a reactivos.
//   - "PRODUCTO CALCULADO": la llena jefe_servicio (columna calculada, nunca
//     aparece en fillable_headers). Aplica a controles/calibradores/materiales.
// Se resuelven de forma INDEPENDIENTE (nunca se mezclan ni se elige "la mas
// cercana entre ambas"); la eleccion de cual usar para una fila puntual la
// hace el llamador segun el item_type real (ver ANNUAL_QUANTITY_ITEM_TYPES).
function parseEquipmentSheetDefinitionWithMapping(name, ws, mappingSheet) {
  const fallback = parseEquipmentSheetDefinition(name, ws);
  if (!mappingSheet) return fallback;

  const annualComercialColumn = findColumnByTargetHeader(mappingSheet, "DET/AÑO PROCESO") || fallback.columns.annual;
  // "PRODUCTO CALCULADO" es el header esperado, pero algunas pestañas de
  // equipo (confirmado en c303/c503) no lo tienen y registran la cantidad de
  // controles/calibradores/materiales directamente en "PRODUCTO A ENTREGAR"/
  // "PRODUCTO A ENVIAR" -- sin este fallback esas pestañas resuelven columna
  // 0 y la cantidad anual queda en 0 para toda la subseccion.
  const annualServicioColumn = findColumnByTargetHeader(mappingSheet, [ANNUAL_SERVICIO_HEADER, ...DELIVER_QUANTITY_HEADERS]) || fallback.columns.deliver;
  const deliverColumn = findColumnByTargetHeader(mappingSheet, DELIVER_QUANTITY_HEADERS) || fallback.columns.deliver;
  const headerRow = findHeaderRowByTargetHeader(mappingSheet, "DET/AÑO PROCESO") || fallback.headerRow;
  const mappedRows = buildRowsFromMappingObjectiveTargets(mappingSheet, annualComercialColumn, deliverColumn);
  const fallbackByRow = new Map((fallback.rows || []).map((row) => [Number(row.rowNumber), row]));

  const tabColumns = {
    annualComercial: annualComercialColumn,
    annualServicio: annualServicioColumn,
    deliver: deliverColumn,
  };

  if (!mappedRows.length) {
    return { ...fallback, headerRow, columns: tabColumns };
  }

  return {
    ...fallback,
    headerRow,
    columns: tabColumns,
    rows: Array.from(new Map([
      ...(fallback.rows || []).map((row) => [Number(row.rowNumber), {
        ...row,
        columns: {
          annualComercial: findColumnForRowByTargetHeader(mappingSheet, "DET/AÑO PROCESO", row.rowNumber, annualComercialColumn),
          annualServicio: findColumnForRowByTargetHeader(mappingSheet, [ANNUAL_SERVICIO_HEADER, ...DELIVER_QUANTITY_HEADERS], row.rowNumber, annualServicioColumn),
          deliver: findColumnForRowByTargetHeader(mappingSheet, DELIVER_QUANTITY_HEADERS, row.rowNumber, deliverColumn),
        },
      }]),
      ...mappedRows.map((row) => {
        const fromFallback = fallbackByRow.get(Number(row.rowNumber));
        // mapping_auto.json es un snapshot generado una vez y puede quedar
        // desfasado si alguien inserta/borra filas en el xlsx despues (visto
        // en produccion: una fila de calibrador nueva en la pestaña "c111"
        // desalineo el mapping en 1 fila para todo lo que venia despues,
        // pegando el itemId correcto -- re-leido en vivo por fallback -- con
        // el label VIEJO de otra fila/producto). itemId/itemType de
        // buildRowsFromMappingObjectiveTargets siempre vienen vacios (nunca
        // se asignan ahi), asi que en la practica solo "label" puede venir
        // de la fuente stale. Por eso label debe priorizar SIEMPRE el valor
        // re-leido en vivo (fromFallback) sobre el del mapping -- el mapping
        // solo rellena cuando el parser base no pudo leer nada (celdas
        // combinadas u otro caso raro), nunca para "corregir" un label que
        // ya se leyo bien.
        return [Number(row.rowNumber), {
          ...fromFallback,
          ...row,
          itemType: fromFallback?.itemType || row.itemType || null,
          itemId: fromFallback?.itemId || row.itemId || "",
          label: fromFallback?.label || row.label || "",
          columns: {
            // Si empty_fill_targets_objective ya dio una columna precisa para
            // ESTA fila especifica (DET/AÑO PROCESO), se respeta tal cual.
            annualComercial: row.annualComercialPrecise
              ? row.columns.annualComercial
              : findColumnForRowByTargetHeader(mappingSheet, "DET/AÑO PROCESO", row.rowNumber, row.columns?.annualComercial || annualComercialColumn),
            annualServicio: findColumnForRowByTargetHeader(mappingSheet, [ANNUAL_SERVICIO_HEADER, ...DELIVER_QUANTITY_HEADERS], row.rowNumber, annualServicioColumn),
            deliver: row.deliverPrecise
              ? row.columns.deliver
              : findColumnForRowByTargetHeader(mappingSheet, DELIVER_QUANTITY_HEADERS, row.rowNumber, row.columns?.deliver || deliverColumn),
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

// La columna de cantidad anual tiene DOS variantes con dueño distinto
// (ver ANNUAL_QUANTITY_ITEM_TYPES / _annualColumnCategory): reactivos leen
// de "annualComercial" (DET/AÑO PROCESO, la llena acp_comercial); controles/
// calibradores/materiales leen de "annualServicio" (PRODUCTO CALCULADO, la
// llena jefe_servicio). "deliver" (PRODUCTO A ENTREGAR) no tiene esta
// distincion, es una unica columna para todos los tipos.
function _annualColumnCategory(itemType) {
  const normalized = String(itemType || "").trim().toLowerCase();
  if (ANNUAL_QUANTITY_ITEM_TYPES.reactivos.has(normalized)) return "comercial";
  if (
    ANNUAL_QUANTITY_ITEM_TYPES.controles.has(normalized) ||
    ANNUAL_QUANTITY_ITEM_TYPES.calibradores.has(normalized) ||
    ANNUAL_QUANTITY_ITEM_TYPES.materiales.has(normalized)
  ) {
    return "servicio";
  }
  return null;
}

async function pullColumnQuantitiesFromGoogleSheet({ sheetId, equipmentTabs = [], columnField, resultField }) {
  if (!jwtClient || !sheetId) return [];
  const template = loadTemplateDefinition();
  const normalizedTabs = Array.isArray(equipmentTabs) ? equipmentTabs : [];
  if (!normalizedTabs.length) return [];

  const isAnnualField = columnField === "annual";
  // Para "annual" se generan hasta 2 grupos de columna por pestaña (comercial
  // y servicio); para cualquier otro campo (deliver) se mantiene una unica
  // columna sin distincion de categoria.
  const columnVariants = isAnnualField
    ? [{ field: "annualComercial", category: "comercial" }, { field: "annualServicio", category: "servicio" }]
    : [{ field: columnField, category: null }];

  const targets = [];
  for (const tab of normalizedTabs) {
    const definition = template.equipmentSheets.find((entry) => entry.name === tab.sheet_name);
    if (!definition) continue;
    const rows = Array.isArray(definition.rows) ? definition.rows : [];
    if (!rows.length) continue;

    for (const variant of columnVariants) {
      if (!definition.columns?.[variant.field]) continue;
      const rowsByColumn = new Map();
      rows.forEach((row) => {
        const columnIndex = Number(row?.columns?.[variant.field] || definition.columns?.[variant.field] || 0);
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
          category: variant.category,
          tabItems: Array.isArray(tab.items) ? tab.items : [],
        });
      });
    }
  }

  if (!targets.length) return [];

  // Un BC integrado puede conservar referencias de una pestaña opcional que
  // no existe en su Sheet ya generado. No debe impedir leer ni depurar las
  // pestañas que si existen.
  const { data: spreadsheet } = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    includeGridData: false,
    fields: "sheets(properties(title))",
  });
  const availableSheetNames = new Set(
    (spreadsheet?.sheets || []).map((sheet) => String(sheet?.properties?.title || "").trim()).filter(Boolean),
  );
  const validTargets = targets.filter((target) => availableSheetNames.has(target.sheetName));
  const missingSheetNames = [...new Set(
    targets
      .filter((target) => !availableSheetNames.has(target.sheetName))
      .map((target) => target.sheetName),
  )];
  if (missingSheetNames.length) {
    logger.warn({ sheetId, missingSheetNames }, "BC sheet sync: se omitieron pestañas inexistentes");
  }
  if (!validTargets.length) return [];

  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId,
    ranges: validTargets.map((target) => target.range),
    majorDimension: "ROWS",
  });

  const valueRanges = Array.isArray(data?.valueRanges) ? data.valueRanges : [];
  const updatesByItemKey = new Map();

  for (let i = 0; i < validTargets.length; i += 1) {
    const target = validTargets[i];
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

      // Si este grupo tiene categoria (solo aplica a "annual"), el valor solo
      // es valido para items cuyo tipo real pertenezca a esa categoria --
      // evita que un reactivo tome el valor de la columna de servicio o
      // viceversa cuando ambas columnas existen en la misma pestaña.
      if (target.category) {
        const itemCategory = _annualColumnCategory(matchedItem?.item_type || matchedItem?.itemType);
        if (itemCategory !== target.category) continue;
      }

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

// "Producto Calculado" para reactivos es solo de referencia visual (no se usa
// en ningun calculo -- la cantidad real de reactivos sigue viniendo unicamente
// de DET/AÑO PROCESO via pullAnnualQuantitiesFromGoogleSheet). Se lee la
// columna "annualServicio" (PRODUCTO CALCULADO) pero solo para filas cuyo
// item_type sea reactivo/determinacion, restringiendo cada pestaña a esos
// items antes de delegar en pullColumnQuantitiesFromGoogleSheet con
// columnField distinto de "annual" para que no aplique el filtro de
// categoria (que rechazaria un reactivo leyendo la columna de servicio).
async function pullReferenceQuantitiesFromGoogleSheet({ sheetId, equipmentTabs = [] }) {
  const reactivoTabs = (Array.isArray(equipmentTabs) ? equipmentTabs : [])
    .map((tab) => ({
      ...tab,
      items: (Array.isArray(tab.items) ? tab.items : []).filter((item) => (
        ANNUAL_QUANTITY_ITEM_TYPES.reactivos.has(String(item?.item_type || item?.itemType || item?.type || "").trim().toLowerCase())
      )),
    }))
    .filter((tab) => tab.items.length);

  return pullColumnQuantitiesFromGoogleSheet({
    sheetId,
    equipmentTabs: reactivoTabs,
    columnField: "annualServicio",
    resultField: "reference_qty",
  });
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

      const annualField = normalizedSubsection === "reactivos" ? "annualComercial" : "deliver";
      const columnIndex = Number(row?.columns?.[annualField] || definition.columns?.[annualField] || 0);
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
  return data || {};
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
  const data = await getProtectedRangesForSpreadsheet(sheetId);
  const sheetEntries = Array.isArray(data?.sheets) ? data.sheets : [];
  const sheetIdsByTitle = new Map(
    sheetEntries.map((sheet) => [sheet?.properties?.title, sheet?.properties?.sheetId]),
  );
  const requests = [];

  sheetEntries.forEach((sheet) => {
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
  const data = await getProtectedRangesForSpreadsheet(sheetId);
  const sheetEntries = Array.isArray(data?.sheets) ? data.sheets : [];
  const requests = [];
  let deletedRanges = 0;

  sheetEntries.forEach((sheet) => {
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
      else if (recordAlias.length >= 3 && sheetAlias.includes(recordAlias)) best = Math.max(best, 88);
      else if (sheetAlias.length >= 3 && recordAlias.includes(sheetAlias)) best = Math.max(best, 85);
    }
  }
  return best;
}

function buildNormalizedAliasVariants(value) {
  const variants = new Set();
  const raw = String(value || "").trim();
  if (!raw) return variants;

  const addNormalized = (input) => {
    const normalizedText = normalizeText(input);
    const normalizedCompact = normalizeCompact(input);
    if (normalizedCompact) variants.add(normalizedCompact);

    const tokens = normalizedText.split(/\s+/).filter(Boolean);
    tokens.forEach((token) => {
      if (token.length >= 2) variants.add(token);
    });

    if (tokens.length >= 2) {
      variants.add(tokens.slice(0, 2).join(""));
    }

    const withoutDigits = normalizedCompact.replace(/\d+/g, "");
    if (withoutDigits.length >= 2) variants.add(withoutDigits);

    const withoutLetters = normalizedCompact.replace(/[a-z]+/g, "");
    if (withoutLetters.length >= 2) variants.add(withoutLetters);
  };

  addNormalized(raw);
  addNormalized(raw.replace(/\([^)]*\)/g, " "));
  addNormalized(
    raw.replace(
      /\b(sin|con)\s+(licencia|licencias|license|licenses)\b/gi,
      " ",
    ),
  );

  return variants;
}

function buildRecordAliases(record = {}) {
  const aliases = new Set();
  [record.name, record.code, record.model, record.equipment_name, record.equipment_code].forEach((value) => {
    buildNormalizedAliasVariants(value).forEach((alias) => aliases.add(alias));
  });
  const id = String(record.id ?? "");
  if (id) {
    const extras = loadEquipmentAliases().get(id) || [];
    extras.forEach((value) => {
      buildNormalizedAliasVariants(value).forEach((alias) => aliases.add(alias));
    });
  }
  return Array.from(aliases);
}

function extractNumericAliasTokens(values = []) {
  const tokens = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const normalized = normalizeText(value);
    const matches = normalized.match(/\d{3,4}/g) || [];
    matches.forEach((match) => tokens.add(match));
  });
  return Array.from(tokens);
}

function extractModelFamilyAliases(values = []) {
  const tokens = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const normalized = normalizeCompact(value);
    // Keep the letter prefix with the model number: e411 and t411 are
    // different analyzers even though they share the numeric token 411.
    const matches = normalized.match(/[a-z]\d{3,4}/g) || [];
    matches.forEach((match) => tokens.add(match));
  });
  return Array.from(tokens);
}

function normalizeSheetWriteValue(value) {
  if (typeof value !== "string") return value;
  return value.toUpperCase();
}

function buildValueRange(range, values) {
  return { range, values: [[normalizeSheetWriteValue(values)]] };
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

async function preservePreviousSpreadsheet(fileId, reason = "recreate") {
  if (!fileId) return { preserved: false, reason: "NO_FILE_ID" };
  try {
    await drive.files.update({
      fileId,
      supportsAllDrives: true,
      requestBody: {
        name: `ARCHIVO ANTERIOR - ${reason} - ${new Date().toISOString()} - ${fileId}`,
      },
      fields: "id,name",
    });
    return { preserved: true, reason: null };
  } catch (error) {
    logger.warn({ fileId, error: error.message }, "No se pudo renombrar spreadsheet previo; se conservara sin renombrar");
    return { preserved: true, reason: "RENAME_FAILED" };
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

      const preservation = await preservePreviousSpreadsheet(
        existingSheetId,
        forceRecreate ? "regeneracion-forzada" : "pestanas-faltantes",
      );
      logger.warn(
        { existingSheetId, missingSheetNames, forceRecreate, previousPreserved: preservation.preserved, preservationReason: preservation.reason },
        forceRecreate
          ? "Regeneracion forzada solicitada. Se creara una nueva hoja y se conservara la anterior."
          : "Spreadsheet previo incompleto. Se creara una nueva hoja y se conservara la anterior.",
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
        previousPreserved: preservation.preserved,
        previousPreservationReason: preservation.reason,
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
  const smartObjectiveCell = fieldCells.SmartObjective || "B129";

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

  if (payload.fields?.SmartObjective !== undefined) {
    clears.push(`BC!${smartObjectiveCell}`);
    updates.push(buildValueRange(`BC!${smartObjectiveCell}`, payload.fields.SmartObjective || ""));
  }

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

  // Solo se limpia/escribe la columna "comercial" (DET/AÑO PROCESO): es la
  // unica de llenado manual. "annualServicio" (PRODUCTO CALCULADO) es una
  // columna calculada por formula en el Sheet -- escribir ahi destruiria el
  // calculo, por eso SPI nunca escribe esa columna, solo la lee (sync inverso
  // en pullColumnQuantitiesFromGoogleSheet). Los items de categoria servicio
  // (controles/calibradores/materiales) se omiten aqui a proposito.
  const lookup = buildSheetItemLookup(sheetPayload.items || []);
  const rowsByAnnualColumn = new Map();
  (definition.rows || []).forEach((row) => {
    const item = row?.itemId ? lookup.byId.get(row.itemId) : lookup.byLabel.get(row.label);
    if (!item || _annualColumnCategory(item.item_type || item.itemType) !== "comercial") return;
    const columnIndex = Number(row?.columns?.annualComercial || definition.columns?.annualComercial || 0);
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

  definition.rows.forEach((row) => {
    const item = row.itemId ? lookup.byId.get(row.itemId) : lookup.byLabel.get(row.label);
    if (!item || _annualColumnCategory(item.item_type || item.itemType) !== "comercial") return;
    const annualColumn = Number(row?.columns?.annualComercial || definition.columns?.annualComercial || 0);
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
    numericAliases: extractNumericAliasTokens(buildRecordAliases(record)),
    modelAliases: extractModelFamilyAliases(buildRecordAliases(record)),
  }));
  const matchedSheetsByRecordId = new Map();

  if (!equipmentRecords.length) {
    logger.warn("[SheetGen] buildSheetPayloads: no equipment records provided — equipment tabs will be empty");
  }

  recordsWithAliases.forEach((record, index) => {
    const recordKey = Number(record.id) || `idx:${index}`;
    const candidates = template.equipmentSheets
      .map((sheetDefinition) => {
        const score = scoreAliases(record.aliases, sheetDefinition.aliases);
        const sheetNameAlias = normalizeCompact(sheetDefinition.name);
        const sheetNumericAliases = extractNumericAliasTokens(sheetDefinition.aliases);
        const sheetModelAliases = extractModelFamilyAliases(sheetDefinition.aliases);
        return {
          sheetDefinition,
          score,
          sharedNumericAliases: sheetNumericAliases.filter((token) => record.numericAliases.includes(token)),
          sharedModelAliases: sheetModelAliases.filter((token) => record.modelAliases.includes(token)),
          hasModelFamilyConflict:
            record.modelAliases.length > 0 &&
            sheetModelAliases.length > 0 &&
            !sheetModelAliases.some((token) => record.modelAliases.includes(token)),
          directNameMatch: record.aliases.some((alias) => alias === sheetNameAlias || alias.includes(sheetNameAlias)),
        };
      })
      .filter((candidate) => candidate.score >= 85)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (Number(right.directNameMatch) !== Number(left.directNameMatch)) {
          return Number(right.directNameMatch) - Number(left.directNameMatch);
        }
        return String(left.sheetDefinition.name || "").localeCompare(String(right.sheetDefinition.name || ""), "es");
      });
    if (!candidates.length) return;

    // Bug real: cuando exactamente UNA pestana comparte el numero de modelo
    // (ej. "503" para "cobas Pro <503> ISE"), antes solo se usaba ese match
    // numerico si habia 2+ candidatas (caso combo). Con una sola, caia al
    // scoring por substring generico de abajo, que puede empatar entre 2
    // pestanas (ambas contienen "cobaspro..." porque ambas tienen un submodelo
    // "Pro") y el desempate final es alfabetico -- " e402 e801" con espacio
    // inicial ordena antes que "c303 c503" sin relacion alguna con cual
    // pestana es la correcta. El numero de modelo es una senal mucho mas
    // confiable que el desempate alfabetico y debe ganar siempre que sea
    // inequivoco (exactamente una pestana con numero compartido).
    const numericMatchedCandidates = candidates.filter((candidate) => {
      if (!candidate.sharedNumericAliases.length) return false;
      // A single-model record such as e411 must not match t411 merely by
      // sharing 411. Combo records intentionally carry multiple model
      // numbers (for example 303 + 402), so each matching model tab remains
      // eligible even though their family prefixes differ.
      const isSingleModelRecord = record.numericAliases.length === 1;
      return !isSingleModelRecord || !candidate.hasModelFamilyConflict;
    });
    if (numericMatchedCandidates.length > 1) {
      matchedSheetsByRecordId.set(recordKey, numericMatchedCandidates.map((candidate) => candidate.sheetDefinition.name));
      return;
    }
    if (numericMatchedCandidates.length === 1) {
      matchedSheetsByRecordId.set(recordKey, [numericMatchedCandidates[0].sheetDefinition.name]);
      return;
    }

    const exactMatches = candidates
      .filter((candidate) => candidate.score === 100)
      .map((candidate) => candidate.sheetDefinition.name);

    if (exactMatches.length > 1) {
      matchedSheetsByRecordId.set(recordKey, exactMatches);
      return;
    }

    matchedSheetsByRecordId.set(recordKey, [candidates[0].sheetDefinition.name]);
  });

  template.equipmentSheets.forEach((sheetDefinition) => {
    const matchedRecords = recordsWithAliases.filter((record, index) => {
      const recordKey = Number(record.id) || `idx:${index}`;
      const matchedSheets = matchedSheetsByRecordId.get(recordKey) || [];
      return matchedSheets.includes(sheetDefinition.name);
    });
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
  if (payload.fields?.SmartObjective !== undefined) {
    const smartObjectiveCell = template.bc.fieldCells?.SmartObjective || "B129";
    await writeRanges(spreadsheet.spreadsheetId, [
      buildValueRange(`BC!${smartObjectiveCell}`, payload.fields.SmartObjective || ""),
    ]);
  }

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
    previous_sheet_preserved: spreadsheet.previousPreserved === true,
    previous_sheet_preservation_reason: spreadsheet.previousPreservationReason || null,
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
  pullReferenceQuantitiesFromGoogleSheet,
  buildAnnualQuantityProtectionRanges,
  protectAnnualQuantityCellsForSubsection,
  unprotectAnnualQuantityCellsForSubsection,
  protectSpreadsheetAfterMaximumQuantitiesSync,
  syncBusinessCaseToGoogleSheet,
  clearSheetCaches,
};
