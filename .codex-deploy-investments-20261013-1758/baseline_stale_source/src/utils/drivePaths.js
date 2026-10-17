const { ensureFolder } = require("./drive");
const logger = require("../config/logger");

const DEFAULT_ROOT_ENV_KEYS = ["DRIVE_ROOT_FOLDER_ID", "DRIVE_FOLDER_ID"];
const VARIANT_LABELS = {
  inspection: "Solicitud de Inspección de Ambiente",
  retiro: "Solicitud de Retiro de Equipo",
  compra: "Proceso de Compra",
  cliente: "Ficha de Cliente",
};

function parseMapEnv(value) {
  if (!value) return {};
  return value.split(",").reduce((acc, pair) => {
    const [key, id] = pair.split(":").map((v) => v?.trim());
    if (key && id) acc[key.toLowerCase()] = id;
    return acc;
  }, {});
}

function sanitizeName(text, fallback = "General") {
  const clean = String(text || fallback).trim();
  return clean.length ? clean : fallback;
}

/**
 * Obtiene el nombre de usuario para carpetas Drive con sanitización robusta
 * @param {Object} user - Objeto usuario con campos fullname, name, displayName, email
 * @returns {string} Nombre sanitizado para carpeta Drive
 */
function getUserDisplayName(user) {
  if (!user) return 'Usuario-SPI';

  // Fallbacks exactos en orden de preferencia
  let displayName = '';

  // 1. user.fullname (trim)
  if (user.fullname && typeof user.fullname === 'string') {
    displayName = user.fullname.trim();
  }

  // 2. user.name (trim)
  if (!displayName && user.name && typeof user.name === 'string') {
    displayName = user.name.trim();
  }

  // 3. user.displayName (trim) - si existe
  if (!displayName && user.displayName && typeof user.displayName === 'string') {
    displayName = user.displayName.trim();
  }

  // 4. user.email -> parte antes de @
  if (!displayName && user.email && typeof user.email === 'string') {
    const emailPart = user.email.split('@')[0];
    if (emailPart) {
      displayName = emailPart.trim();
    }
  }

  // 5. Último fallback
  if (!displayName) {
    displayName = 'Usuario-SPI';
  }

  // Sanitización para carpetas Drive
  displayName = displayName
    // Colapsar espacios múltiples
    .replace(/\s+/g, ' ')
    // Remover caracteres no permitidos (mantener letras, números, espacios, guion, guion_bajo, punto)
    .replace(/[^a-zA-Z0-9\s\-_\.]/g, '')
    // Limpiar espacios al inicio/fin
    .trim()
    // Limitar longitud (80 chars máximo para Drive)
    .substring(0, 80);

  // Si queda vacío después de sanitización, usar fallback
  if (!displayName) {
    displayName = 'Usuario-SPI';
  }

  logger.debug(`[DRIVE] Nombre de usuario sanitizado: "${displayName}"`);
  return displayName;
}

function padId(id) {
  return String(id).padStart(4, "0");
}

async function ensurePathSegment({ name, parentId, map, mapKey }) {
  if (mapKey && map[mapKey]) {
    return { id: map[mapKey], name };
  }
  const folder = await ensureFolder(name, parentId);
  return { id: folder.id, name: folder.name };
}

async function resolveCommercialDrivePath({
  driveRootId,
  user,
  requestType,
  requestId,
  clientName
}) {
  // Sanitize user name for folder using new helper
  const sanitizedUserName = getUserDisplayName(user);

  // Sanitize request type label
  const requestTypeLabels = {
    'F.ST-20': 'Inspección de Ambiente',
    'F.ST-21': 'Retiro de Equipo'
  };
  const typeLabel = requestTypeLabels[requestType] || requestType || 'Solicitud';

  logger.info("[DRIVE-COMMERCIAL] Resolviendo estructura", {
    user: sanitizedUserName,
    type: typeLabel,
    requestId
  });

  // 1. Ensure "Comercial" folder exists at root level
  const comercialFolder = await ensurePathSegment({
    name: "Comercial",
    parentId: driveRootId,
    map: {},
  });

  // 2. Ensure user folder exists within "Comercial"
  const userFolder = await ensurePathSegment({
    name: sanitizedUserName,
    parentId: comercialFolder.id,
    map: {},
  });

  // 3. Ensure request type folder exists within user folder
  const typeFolder = await ensurePathSegment({
    name: typeLabel,
    parentId: userFolder.id,
    map: {},
  });

  // 4. Create request folder within type folder
  const paddedId = padId(requestId);
  const clientPart = clientName ? ` - ${sanitizeName(clientName, "")}` : "";
  const requestFolderName = `REQ-${paddedId}${clientPart}`;

  const requestFolder = await ensurePathSegment({
    name: requestFolderName,
    parentId: typeFolder.id,
    map: {},
  });

  logger.info("[DRIVE-COMMERCIAL] Estructura creada", {
    comercialFolder: comercialFolder.name,
    userFolder: userFolder.name,
    typeFolder: typeFolder.name,
    requestFolder: requestFolder.name,
  });

  return {
    comercialFolderId: comercialFolder.id,
    userFolderId: userFolder.id,
    typeFolderId: typeFolder.id,
    requestFolderId: requestFolder.id,
  };
}

async function resolveRequestDriveFolders({
  requestId,
  requestTypeCode,
  requestTypeTitle,
  departmentCode,
  departmentName,
  templateCode,
  clientName, // ← NUEVO parámetro
  user, // ← NUEVO parámetro para estructura comercial
}) {
  const rootId =
    DEFAULT_ROOT_ENV_KEYS.map((key) => process.env[key]).find(Boolean) || null;
  if (!rootId) {
    throw new Error(
      "No se ha configurado DRIVE_ROOT_FOLDER_ID o DRIVE_FOLDER_ID en el entorno"
    );
  }

  // Check if this is a Commercial request (F.ST-20, F.ST-21)
  const isCommercialRequest = ['F.ST-20', 'F.ST-21'].includes(requestTypeCode) ||
    (user?.role === 'comercial' || user?.role === 'jefe_comercial');

  if (isCommercialRequest) {
    logger.info("[DRIVE] Usando estructura comercial para solicitud", { requestId, requestTypeCode });
    const commercialFolders = await resolveCommercialDrivePath({
      driveRootId: rootId,
      user,
      requestType: requestTypeCode,
      requestId,
      clientName
    });

    return {
      rootId,
      ...commercialFolders,
    };
  }

  // Original logic for non-commercial requests
  const departmentMap = parseMapEnv(process.env.DRIVE_DEPARTMENT_FOLDER_MAP);
  const typeMap = parseMapEnv(process.env.DRIVE_TYPE_FOLDER_MAP);

  const deptName = sanitizeName(departmentName || departmentCode || "General");
  const deptKey = deptName.toLowerCase();
  const deptFolder = await ensurePathSegment({
    name: deptName,
    parentId: rootId,
    map: departmentMap,
    mapKey: deptKey,
  });

  const templateKey = (templateCode || "").toLowerCase();
  const aliasLabel = VARIANT_LABELS[templateKey];
  const typeLabel = aliasLabel
    ? aliasLabel
    : sanitizeName(
      requestTypeCode ? `${requestTypeCode} - ${requestTypeTitle || ""}`.trim() : "SinTipo",
      "SinTipo"
    );
  const typeKey = aliasLabel
    ? templateKey
    : (requestTypeCode || typeLabel).toLowerCase();
  const typeFolder = await ensurePathSegment({
    name: typeLabel,
    parentId: deptFolder.id,
    map: typeMap,
    mapKey: typeKey,
  });

  // Mejorar nombre de carpeta individual con número y cliente
  const paddedId = padId(requestId);
  const clientPart = clientName ? ` - ${sanitizeName(clientName, "")}` : "";
  const requestFolderName = `REQ-${paddedId}${clientPart}`;

  const requestFolder = await ensurePathSegment({
    name: requestFolderName,
    parentId: typeFolder.id,
    map: {},
  });

  logger.info("[DRIVE] Carpetas resueltas", {
    requestId,
    department: deptFolder.name,
    type: typeFolder.name,
    requestFolder: requestFolder.name,
  });

  return {
    rootId,
    departmentFolderId: deptFolder.id,
    typeFolderId: typeFolder.id,
    requestFolderId: requestFolder.id,
  };
}

module.exports = {
  resolveRequestDriveFolders,
  padId,
  getUserDisplayName,
};
