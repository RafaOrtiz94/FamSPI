/**
 * Business Case Sheet WebApp
 * Template: FORMATO BC - 15-01-2026
 * Mapping source: BC_MAPPING.md (canonical)
 *
 * NOTE:
 * Google Apps Script WebApp does not reliably expose custom HTTP headers in doPost(e).
 * For that reason, auth is validated using:
 * 1) auth_token in payload
 * 2) HMAC signature over canonical JSON payload
 */

var CONFIG = Object.freeze({
  TEMPLATE_FILE_ID: "REPLACE_WITH_TEMPLATE_FILE_ID",
  OUTPUT_FOLDER_ID: "REPLACE_WITH_OUTPUT_FOLDER_ID",
  AUTH_TOKEN: "REPLACE_WITH_SHARED_TOKEN",
  SIGNING_SECRET: "REPLACE_WITH_HMAC_SECRET",
  EXPECTED_MAPPING_VERSION: "BC_MAPPING_v2026_01_15",
  MAX_TIMESTAMP_SKEW_MS: 5 * 60 * 1000,
});

var _RUNTIME_CONFIG = null;

/**
 * Canonical field map from BC_MAPPING.md
 * Key: logical field key
 * Value: exact destination cell in template (B3:B55, only automatable cells)
 */
var FIELD_TO_CELL = Object.freeze({
  FechaMaximaConsumibles: "B3",
  TipoDeCliente: "B4",
  EntidadContratante: "B5",
  Cliente: "B6",
  CodigoProceso: "B7",
  ObjetoContratacion: "B8",
  ProvinciaCiudad: "B9",
  DiasLaboratorio: "B11",
  TurnosPorDia: "B12",
  HorasPorTurno: "B13",
  ControlesCalidadPorTurno: "B14",
  NivelesDeControl: "B15",
  FrecuenciaControlesRutina: "B16",
  PruebasEspeciales: "B17",
  FrecuenciaControlesEspeciales: "B18",
  NombreEquipoPrincipal: "B20",
  EstadoEquipoPrincipal: "B21",
  PropiedadEquipoPrincipal: "B22",
  NombreEquipoBackUp: "B24",
  EstadoEquipoBackUp: "B25",
  InstalarJuntoPrincipal: "B26",
  UbicacionEquipos: "B27",
  RequiereEquipoComplementario: "B29",
  EquipoComplementarioPrueba: "B30",
  IncluyeLIS: "B32",
  ProveedorSistemaTrabajar: "B33",
  IncluyeHadwareLIS: "B34",
  NumeroPacientesMensual: "B35",
  InterfazSistemaActual: "B36",
  NombreSistema: "B37",
  ProveedorSistemaActual: "B38",
  IncluyeHadwareSistemaActual: "B39",
  ModeloProveedor1: "B41",
  ModeloProveedor2: "B42",
  ModeloProveedor3: "B43",
  CobroArriendoEquipamiento: "B45",
  Plazo: "B46",
  ProyeccionPlazo: "B47",
  PresupuestoReferencial: "B49",
  PorcentajeMaximoCanje: "B50",
  CompromisoDeCompra: "B51",
  TipoEntrega: "B53",
  DeterminacionEfectiva: "B54",
  Observaciones: "B55",
});

/**
 * Optional aliases so backend can send either canonical keys or snake_case keys.
 */
var FIELD_ALIASES = Object.freeze({
  FechaMaximaConsumibles: ["fecha_maxima_consumibles"],
  TipoDeCliente: ["tipo_de_cliente", "tipo_cliente", "client_type"],
  EntidadContratante: ["entidad_contratante", "contracting_entity"],
  Cliente: ["cliente", "client_name", "razon_social"],
  CodigoProceso: ["codigo_proceso", "process_code"],
  ObjetoContratacion: ["objeto_contratacion", "contract_object"],
  ProvinciaCiudad: ["provincia_ciudad", "province_city"],
  DiasLaboratorio: ["dias_laboratorio", "work_days_per_week"],
  TurnosPorDia: ["turnos_por_dia", "shifts_per_day"],
  HorasPorTurno: ["horas_por_turno", "hours_per_shift"],
  ControlesCalidadPorTurno: ["controles_calidad_por_turno", "quality_controls_per_shift"],
  NivelesDeControl: ["niveles_de_control", "control_levels"],
  FrecuenciaControlesRutina: ["frecuencia_controles_rutina", "routine_qc_frequency"],
  PruebasEspeciales: ["pruebas_especiales", "special_tests"],
  FrecuenciaControlesEspeciales: ["frecuencia_controles_especiales", "special_qc_frequency"],
  NombreEquipoPrincipal: ["nombre_equipo_principal", "main_equipment_name"],
  EstadoEquipoPrincipal: ["estado_equipo_principal", "main_equipment_status"],
  PropiedadEquipoPrincipal: ["propiedad_equipo_principal", "main_equipment_ownership"],
  NombreEquipoBackUp: ["nombre_equipo_backup", "backup_equipment_name"],
  EstadoEquipoBackUp: ["estado_equipo_backup", "backup_equipment_status"],
  InstalarJuntoPrincipal: ["instalar_junto_principal", "backup_install_simultaneous"],
  UbicacionEquipos: ["ubicacion_equipos", "equipment_location"],
  RequiereEquipoComplementario: ["requiere_equipo_complementario", "requires_complementary_equipment"],
  EquipoComplementarioPrueba: ["equipo_complementario_prueba", "complementary_equipment_test"],
  IncluyeLIS: ["incluye_lis", "includes_lis"],
  ProveedorSistemaTrabajar: ["proveedor_sistema_trabajar", "lis_provider"],
  IncluyeHadwareLIS: ["incluye_hadware_lis", "includes_hardware"],
  NumeroPacientesMensual: ["numero_pacientes_mensual", "monthly_patients"],
  InterfazSistemaActual: ["interfaz_sistema_actual", "current_system_interface"],
  NombreSistema: ["nombre_sistema", "current_system_name"],
  ProveedorSistemaActual: ["proveedor_sistema_actual", "current_system_provider"],
  IncluyeHadwareSistemaActual: ["incluye_hadware_sistema_actual", "current_system_hardware"],
  ModeloProveedor1: ["modelo_proveedor_1", "provider_model_1"],
  ModeloProveedor2: ["modelo_proveedor_2", "provider_model_2"],
  ModeloProveedor3: ["modelo_proveedor_3", "provider_model_3"],
  CobroArriendoEquipamiento: ["cobro_arriendo_equipamiento", "equipment_rent_charge"],
  Plazo: ["plazo", "deadline_months"],
  ProyeccionPlazo: ["proyeccion_plazo", "projected_deadline_months"],
  PresupuestoReferencial: ["presupuesto_referencial", "referential_budget"],
  PorcentajeMaximoCanje: ["porcentaje_maximo_canje", "max_trade_in_percent"],
  CompromisoDeCompra: ["compromiso_de_compra", "purchase_commitment"],
  TipoEntrega: ["tipo_entrega", "delivery_type"],
  DeterminacionEfectiva: ["determinacion_efectiva", "effective_determination"],
  Observaciones: ["observaciones", "notes"],
});

var INVESTMENTS = Object.freeze({
  START_ROW: 58,
  END_ROW: 119,
  QTY_COLUMN: 4, // D
  PRICE_COLUMN: 5, // E
});

var INVESTMENT_ITEMS = Object.freeze([
  { row: 58, label: "Control externo de tercera opinion" },
  { row: 59, label: "Control interno interlaboratorial" },
  { row: 60, label: "Poliza de Fiel Cumplimiento del Contrato" },
  { row: 61, label: "Poliza de seguro de equipos" },
  { row: 62, label: "Ups equipo" },
  { row: 63, label: "Ups servidor" },
  { row: 64, label: "LIS" },
  { row: 65, label: "Interfaz" },
  { row: 66, label: "Lantronix" },
  { row: 67, label: "IP publica" },
  { row: 68, label: "Punto de consulta web" },
  { row: 69, label: "Internet" },
  { row: 70, label: "Router para Internet" },
  { row: 71, label: "Servidor" },
  { row: 72, label: "Computadores" },
  { row: 73, label: "Mantenimiento Computador" },
  { row: 74, label: "Impresora" },
  { row: 75, label: "Man" },
  { row: 76, label: "Tinta" },
  { row: 77, label: "Toner para impresora de equipos" },
  { row: 78, label: "Impresora Zebra Termica ZD230" },
  { row: 79, label: "Lector inalambrico de codigo de barra" },
  { row: 80, label: "Sistema de destilacion de agua pequeno" },
  { row: 81, label: "Sistema de osmosis" },
  { row: 82, label: "Mantenimiento sistema de osmosis" },
  { row: 83, label: "Sistema de prefiltracion" },
  { row: 84, label: "Mantenimiento sistema pre filtracion" },
  { row: 85, label: "Tanque para resina mixta" },
  { row: 86, label: "Estructura de proteccion para sistema de agua" },
  { row: 87, label: "MEMBRANE EQ.OSMOSIS" },
  { row: 88, label: "FILTER NOM. P/SEDIMENTS PX10-20XX" },
  { row: 89, label: "FILTER NOM.P/SEDIMENTS GX05-20XX" },
  { row: 90, label: "RESINA IONICA REGENERADA" },
  { row: 91, label: "RESINA MUERTA" },
  { row: 92, label: "Sal en grano" },
  { row: 93, label: "Modificaciones espacio fisico - estructura" },
  { row: 94, label: "Modificaciones espacio fisico - mobiliario" },
  { row: 95, label: "Climatizacion del area" },
  { row: 96, label: "Rollo de cable UTP CAT5e" },
  { row: 97, label: "Conector RJ45 Delta CAT5E" },
  { row: 98, label: "Rack Cerrado POWEST 5UR" },
  { row: 99, label: "Switch HP Aruba Ion 5 puertos" },
  { row: 100, label: "Switch HP Aruba Ion 1430 24 puertos" },
  { row: 101, label: "Extensiones y cortapicos" },
  { row: 102, label: "Extras" },
  { row: 103, label: "Etiquetas" },
  { row: 104, label: "A4 printer paper" },
  { row: 105, label: "Refrigerador panoramico" },
  { row: 106, label: "Refrigerador medico" },
  { row: 107, label: "Termometro para refrigerador" },
  { row: 108, label: "Termohigrometros" },
  { row: 109, label: "Cronometros digitales" },
  { row: 110, label: "Centrifuga" },
  { row: 111, label: "Servicio Logisticos Proveedores" },
  { row: 112, label: "Servicio Logisticos Clientes" },
  { row: 113, label: "Ampolla de agua bidestilada" },
  { row: 114, label: "Agua destilada por galon" },
  { row: 115, label: "Hisopos" },
  { row: 116, label: "Gasas" },
  { row: 117, label: "Alcohol prepad" },
  { row: 118, label: "Tubos eppendorf" },
  { row: 119, label: "Otros" },
]);

var INVESTMENT_ITEM_TO_ROW = Object.freeze(buildInvestmentItemRowMap_(INVESTMENT_ITEMS));

function AppError(code, message, status, details) {
  this.name = "AppError";
  this.code = code || "REQUEST_ERROR";
  this.message = message || "Request failed";
  this.status = status || 400;
  this.details = details || null;
}
AppError.prototype = Object.create(Error.prototype);

function doPost(e) {
  try {
    validateRuntimeConfig_();
    var payload = parseRequestBody_(e);
    validateSecurity_(payload);
    var validPayload = validateRequest(payload);
    var copyInfo = duplicateTemplate(validPayload);
    var ss = SpreadsheetApp.openById(copyInfo.sheetId);
    var sheet = ss.getSheets()[0];

    fillKeyValueFields(sheet, validPayload.fields);
    fillInversiones(sheet, validPayload.inversiones || {});
    SpreadsheetApp.flush();

    return jsonOutput_(buildResponse(copyInfo, validPayload));
  } catch (error) {
    return jsonOutput_(buildErrorResponse_(error));
  }
}

function cfg_() {
  if (_RUNTIME_CONFIG) return _RUNTIME_CONFIG;
  var props = PropertiesService.getScriptProperties();
  _RUNTIME_CONFIG = {
    TEMPLATE_FILE_ID: String(props.getProperty("BC_TEMPLATE_FILE_ID") || CONFIG.TEMPLATE_FILE_ID || "").trim(),
    OUTPUT_FOLDER_ID: String(props.getProperty("BC_OUTPUT_FOLDER_ID") || CONFIG.OUTPUT_FOLDER_ID || "").trim(),
    AUTH_TOKEN: String(props.getProperty("BC_AUTH_TOKEN") || CONFIG.AUTH_TOKEN || "").trim(),
    SIGNING_SECRET: String(props.getProperty("BC_SIGNING_SECRET") || CONFIG.SIGNING_SECRET || "").trim(),
    EXPECTED_MAPPING_VERSION: String(
      props.getProperty("BC_EXPECTED_MAPPING_VERSION") || CONFIG.EXPECTED_MAPPING_VERSION || "",
    ).trim(),
    MAX_TIMESTAMP_SKEW_MS: Number(
      props.getProperty("BC_MAX_TIMESTAMP_SKEW_MS") || CONFIG.MAX_TIMESTAMP_SKEW_MS || 300000,
    ),
  };
  return _RUNTIME_CONFIG;
}

function validateRuntimeConfig_() {
  var config = cfg_();
  if (!config.TEMPLATE_FILE_ID || config.TEMPLATE_FILE_ID.indexOf("REPLACE_") === 0) {
    throw new AppError("CONFIG_ERROR", "BC_TEMPLATE_FILE_ID no configurado", 500);
  }
  if (!config.AUTH_TOKEN || config.AUTH_TOKEN.indexOf("REPLACE_") === 0) {
    throw new AppError("CONFIG_ERROR", "BC_AUTH_TOKEN no configurado", 500);
  }
  if (!config.SIGNING_SECRET || config.SIGNING_SECRET.indexOf("REPLACE_") === 0) {
    throw new AppError("CONFIG_ERROR", "BC_SIGNING_SECRET no configurado", 500);
  }
  if (!config.EXPECTED_MAPPING_VERSION) {
    throw new AppError("CONFIG_ERROR", "BC_EXPECTED_MAPPING_VERSION no configurado", 500);
  }
}

function parseRequestBody_(e) {
  var raw = e && e.postData && e.postData.contents;
  if (!raw) {
    throw new AppError("VALIDATION_ERROR", "Body JSON requerido", 400);
  }

  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_parseError) {
    throw new AppError("VALIDATION_ERROR", "JSON invalido", 400);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError("VALIDATION_ERROR", "El body debe ser un objeto JSON", 400);
  }
  return parsed;
}

function validateSecurity_(payload) {
  var config = cfg_();
  var token = String(payload.auth_token || "").trim();
  if (!token || token !== config.AUTH_TOKEN) {
    throw new AppError("AUTH_ERROR", "Token invalido", 401);
  }

  var timestamp = String(payload.timestamp || "").trim();
  if (!timestamp) {
    throw new AppError("VALIDATION_ERROR", "timestamp requerido", 400);
  }
  var ts = new Date(timestamp).getTime();
  if (!isFinite(ts)) {
    throw new AppError("VALIDATION_ERROR", "timestamp invalido", 400);
  }
  if (Math.abs(Date.now() - ts) > config.MAX_TIMESTAMP_SKEW_MS) {
    throw new AppError("AUTH_ERROR", "timestamp fuera de ventana valida", 401);
  }

  var providedSignature = String(payload.signature || "").trim().toLowerCase();
  if (!providedSignature) {
    throw new AppError("AUTH_ERROR", "signature requerida", 401);
  }

  var signBase = {
    request_id: payload.request_id || null,
    idempotency_key: payload.idempotency_key || null,
    mapping_version: payload.mapping_version || null,
    timestamp: payload.timestamp || null,
    auth_token: payload.auth_token || null,
    output_folder_id: payload.output_folder_id || null,
    fields: payload.fields || {},
    inversiones: payload.inversiones || {},
  };

  var expectedSignature = hmacHex_(stableStringify_(signBase), config.SIGNING_SECRET);
  if (!secureCompare_(providedSignature, expectedSignature)) {
    throw new AppError("AUTH_ERROR", "signature invalida", 401);
  }
}

function validateRequest(payload) {
  var config = cfg_();
  var fields = payload.fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw new AppError("VALIDATION_ERROR", "fields es requerido y debe ser objeto", 400);
  }
  if (!Object.keys(fields).length) {
    throw new AppError("VALIDATION_ERROR", "fields no puede estar vacio", 400);
  }

  var mappingVersion = String(payload.mapping_version || "").trim();
  if (!mappingVersion) {
    throw new AppError("VALIDATION_ERROR", "mapping_version requerido", 400);
  }
  if (mappingVersion !== config.EXPECTED_MAPPING_VERSION) {
    throw new AppError(
      "MAPPING_VERSION_ERROR",
      "mapping_version no coincide con la version desplegada",
      409,
      { expected: config.EXPECTED_MAPPING_VERSION, received: mappingVersion },
    );
  }

  var inversiones = payload.inversiones || {};
  if (typeof inversiones !== "object" || Array.isArray(inversiones)) {
    throw new AppError("VALIDATION_ERROR", "inversiones debe ser objeto", 400);
  }

  return {
    request_id: payload.request_id || null,
    idempotency_key: payload.idempotency_key || null,
    mapping_version: mappingVersion,
    output_folder_id: payload.output_folder_id ? String(payload.output_folder_id).trim() : null,
    fields: fields,
    inversiones: inversiones,
  };
}

function duplicateTemplate(payload) {
  var config = cfg_();
  var templateFile;
  try {
    templateFile = DriveApp.getFileById(config.TEMPLATE_FILE_ID);
  } catch (_error) {
    throw new AppError("TEMPLATE_NOT_FOUND", "Template no encontrado en Drive", 500);
  }

  var requestedOutputFolderId = String(payload.output_folder_id || "").trim();
  var effectiveOutputFolderId = requestedOutputFolderId || config.OUTPUT_FOLDER_ID;

  var targetFolder = null;
  if (effectiveOutputFolderId) {
    try {
      targetFolder = DriveApp.getFolderById(effectiveOutputFolderId);
    } catch (_folderError) {
      throw new AppError("OUTPUT_FOLDER_ERROR", "No se pudo abrir la carpeta destino", 500);
    }
  } else {
    var parents = templateFile.getParents();
    if (parents.hasNext()) targetFolder = parents.next();
  }

  var clientValueInfo = resolveFieldValue_(payload.fields, "Cliente");
  var safeClient = String((clientValueInfo && clientValueInfo.value) || "Cliente")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 50);
  var copyName = "BC_" + safeClient + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  var copiedFile = targetFolder ? templateFile.makeCopy(copyName, targetFolder) : templateFile.makeCopy(copyName);

  return {
    sheetId: copiedFile.getId(),
    url: copiedFile.getUrl(),
  };
}

function fillKeyValueFields(sheet, fields) {
  var keys = Object.keys(FIELD_TO_CELL);
  for (var i = 0; i < keys.length; i += 1) {
    var logicalKey = keys[i];
    var resolved = resolveFieldValue_(fields, logicalKey);
    if (!resolved || !resolved.exists) continue;

    var cell = FIELD_TO_CELL[logicalKey];
    var value = normalizeCellValue_(resolved.value);
    sheet.getRange(cell).setValue(value);
  }
}

function fillInversiones(sheet, inversiones) {
  var keys = Object.keys(inversiones || {});
  if (!keys.length) return;

  for (var i = 0; i < keys.length; i += 1) {
    var investmentName = keys[i];
    var normalized = normalizeLabel_(investmentName);
    var targetRow = INVESTMENT_ITEM_TO_ROW[normalized];
    if (!targetRow) continue;

    var item = inversiones[investmentName] || {};
    if (Object.prototype.hasOwnProperty.call(item, "cantidad")) {
      sheet.getRange(targetRow, INVESTMENTS.QTY_COLUMN).setValue(toNumberOrEmpty_(item.cantidad));
    }
    if (Object.prototype.hasOwnProperty.call(item, "precio")) {
      sheet.getRange(targetRow, INVESTMENTS.PRICE_COLUMN).setValue(toNumberOrEmpty_(item.precio));
    }
  }
}

function buildResponse(copyInfo, payload) {
  return {
    ok: true,
    code: "OK",
    sheetId: copyInfo.sheetId,
    url: copyInfo.url,
    timestamp: new Date().toISOString(),
    request_id: payload.request_id,
    mapping_version: payload.mapping_version,
  };
}

function buildErrorResponse_(error) {
  var appError = error && error.name === "AppError" ? error : null;
  return {
    ok: false,
    code: appError ? appError.code : "INTERNAL_ERROR",
    message: appError ? appError.message : (error && error.message) || "Internal error",
    status: appError ? appError.status : 500,
    details: appError ? appError.details : null,
    timestamp: new Date().toISOString(),
  };
}

function resolveFieldValue_(fields, logicalKey) {
  if (!fields || typeof fields !== "object") return { exists: false, value: undefined };
  if (Object.prototype.hasOwnProperty.call(fields, logicalKey)) {
    return { exists: true, value: fields[logicalKey] };
  }

  var aliases = FIELD_ALIASES[logicalKey] || [];
  for (var i = 0; i < aliases.length; i += 1) {
    var alias = aliases[i];
    if (Object.prototype.hasOwnProperty.call(fields, alias)) {
      return { exists: true, value: fields[alias] };
    }
  }

  return { exists: false, value: undefined };
}

function buildInvestmentItemRowMap_(items) {
  var out = {};
  for (var i = 0; i < items.length; i += 1) {
    var current = items[i];
    var key = normalizeLabel_(current.label);
    out[key] = current.row;
  }
  return out;
}

function normalizeCellValue_(value) {
  if (typeof value === "boolean") return value ? "SI" : "NO";
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function toNumberOrEmpty_(value) {
  if (value === null || value === undefined || value === "") return "";
  var n = Number(value);
  return isFinite(n) ? n : "";
}

function normalizeLabel_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function hmacHex_(message, secret) {
  var bytes = Utilities.computeHmacSha256Signature(message, secret);
  var out = [];
  for (var i = 0; i < bytes.length; i += 1) {
    var v = (bytes[i] + 256) % 256;
    var h = v.toString(16);
    if (h.length === 1) h = "0" + h;
    out.push(h);
  }
  return out.join("");
}

function secureCompare_(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function stableStringify_(value) {
  return JSON.stringify(sortRecursively_(value));
}

function sortRecursively_(value) {
  if (Array.isArray(value)) {
    return value.map(sortRecursively_);
  }
  if (!value || typeof value !== "object") return value;

  var keys = Object.keys(value).sort();
  var out = {};
  for (var i = 0; i < keys.length; i += 1) {
    var key = keys[i];
    out[key] = sortRecursively_(value[key]);
  }
  return out;
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
