const db = require("../../config/db");
const logger = require("../../config/logger");
const { ensureFolder } = require("../../utils/drive");

const PUBLIC_FLOW_FOLDER_NAME = process.env.BC_DRIVE_PUBLIC_FOLDER_NAME || "Publicos";
const PRIVATE_FLOW_FOLDER_NAME = process.env.BC_DRIVE_PRIVATE_FOLDER_NAME || "Privados";

function getDriveRootFolderId() {
  return (
    process.env.DRIVE_ROOT_FOLDER_ID ||
    process.env.BUSINESS_CASE_ROOT_FOLDER_ID ||
    process.env.DRIVE_FOLDER_ID ||
    null
  );
}

function sanitizeFolderName(value, fallback = "Cliente") {
  const normalized = String(value || "")
    .trim()
    .replace(/[\/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, " ");
  return normalized || fallback;
}

function normalizePurchaseType(value) {
  return String(value || "").trim().toLowerCase();
}

function isPrivateBusinessCaseType(bcPurchaseType) {
  const normalized = normalizePurchaseType(bcPurchaseType);
  if (!normalized) return false;
  return normalized.includes("private") || normalized.includes("privado");
}

function resolveFlowFolderName(bcPurchaseType) {
  return isPrivateBusinessCaseType(bcPurchaseType)
    ? PRIVATE_FLOW_FOLDER_NAME
    : PUBLIC_FLOW_FOLDER_NAME;
}

async function ensureBusinessCaseDriveFolder({
  businessCaseId,
  clientName,
  bcPurchaseType,
  existingFolderId = null,
  persist = true,
}) {
  if (existingFolderId) {
    return {
      folderId: existingFolderId,
      rootFolderId: getDriveRootFolderId(),
      flowFolderName: resolveFlowFolderName(bcPurchaseType),
      reused: true,
    };
  }

  const rootFolderId = getDriveRootFolderId();
  if (!rootFolderId) {
    const error = new Error("DRIVE_ROOT_FOLDER_ID no configurado para Business Case");
    error.status = 500;
    error.code = "BC_DRIVE_ROOT_MISSING";
    throw error;
  }

  const flowFolderName = resolveFlowFolderName(bcPurchaseType);
  const flowFolder = await ensureFolder(flowFolderName, rootFolderId);
  const clientFolderName = sanitizeFolderName(clientName, "Cliente");
  const clientFolder = await ensureFolder(clientFolderName, flowFolder.id);
  const businessCaseFolder = await ensureFolder(`BC-${businessCaseId}`, clientFolder.id);

  if (persist) {
    await db.query(
      `UPDATE equipment_purchase_requests
          SET drive_folder_id = $2,
              updated_at = NOW()
        WHERE id = $1
          AND (drive_folder_id IS NULL OR drive_folder_id <> $2)`,
      [businessCaseId, businessCaseFolder.id],
    );
  }

  return {
    folderId: businessCaseFolder.id,
    rootFolderId,
    flowFolderName,
    flowFolderId: flowFolder.id,
    clientFolderId: clientFolder.id,
    clientFolderName,
    reused: false,
  };
}

async function getBusinessCaseDriveContext(businessCaseId) {
  const { rows } = await db.query(
    `
    SELECT id, request_type, uses_modern_system, client_name, bc_purchase_type, drive_folder_id
      FROM equipment_purchase_requests
     WHERE id = $1
     LIMIT 1
    `,
    [businessCaseId],
  );
  if (!rows.length) {
    const error = new Error("Business Case no encontrado");
    error.status = 404;
    error.code = "BUSINESS_CASE_NOT_FOUND";
    throw error;
  }
  return rows[0];
}

async function ensureBusinessCaseDriveFolderById(businessCaseId) {
  const row = await getBusinessCaseDriveContext(businessCaseId);
  if (row.request_type !== "business_case" || row.uses_modern_system === false) {
    const error = new Error("BC legacy no soportado para trazabilidad de Drive");
    error.status = 400;
    error.code = "LEGACY_BUSINESS_CASE_UNSUPPORTED";
    throw error;
  }

  try {
    return await ensureBusinessCaseDriveFolder({
      businessCaseId: row.id,
      clientName: row.client_name || "Cliente",
      bcPurchaseType: row.bc_purchase_type || "public",
      existingFolderId: row.drive_folder_id || null,
      persist: true,
    });
  } catch (error) {
    logger.error(
      {
        error: error?.message || String(error),
        business_case_id: businessCaseId,
      },
      "[BC_DRIVE] Error asegurando carpeta de Business Case",
    );
    throw error;
  }
}

module.exports = {
  getDriveRootFolderId,
  isPrivateBusinessCaseType,
  resolveFlowFolderName,
  ensureBusinessCaseDriveFolder,
  ensureBusinessCaseDriveFolderById,
};
