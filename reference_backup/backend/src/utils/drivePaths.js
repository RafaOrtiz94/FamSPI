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

async function resolveRequestDriveFolders({
  requestId,
  requestTypeCode,
  requestTypeTitle,
  departmentCode,
  departmentName,
  templateCode,
  clientName, // ← NUEVO parámetro
}) {
  const rootId =
    DEFAULT_ROOT_ENV_KEYS.map((key) => process.env[key]).find(Boolean) || null;
  if (!rootId) {
    throw new Error(
      "No se ha configurado DRIVE_ROOT_FOLDER_ID o DRIVE_FOLDER_ID en el entorno"
    );
  }

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
};
