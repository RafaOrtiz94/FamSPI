const db = require("../../config/db");

const DETERMINATIONS_DEADLINE_HOURS = 48;
const DETERMINATIONS_DOCUMENT_VIEW_ROLES = new Set([
  "comercial",
  "acp_comercial",
  "jefe_comercial",
  "backoffice_comercial",
]);
const DETERMINATIONS_ALLOWED_UPLOAD_ROLES = new Set(["comercial"]);

function normalizePurchaseType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["private_comodato", "comodato_privado"].includes(raw)) return "private_comodato";
  if (["public", "comodato_publico"].includes(raw)) return "public";
  if (raw.startsWith("private")) return "private_comodato";
  return "public";
}

function getRoleConfig(businessCase = {}) {
  const normalizedType = normalizePurchaseType(businessCase?.bc_purchase_type);
  if (normalizedType === "private_comodato") {
    return {
      type: "private_comodato",
      editors: ["backoffice_comercial", "jefe_comercial"],
      notify: ["backoffice_comercial", "jefe_comercial"],
      label: "Compra privada comodato",
    };
  }
  return {
    type: "public",
    editors: ["acp_comercial"],
    notify: ["acp_comercial"],
    label: "Compra publica",
  };
}

function toDateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoOrNull(value) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null;
}

function isUploadRole(role = "") {
  return DETERMINATIONS_ALLOWED_UPLOAD_ROLES.has(String(role || "").toLowerCase());
}

async function getCurrentDocument(businessCaseId) {
  try {
    const { rows } = await db.query(
      `
      SELECT id, business_case_id, file_name, mime_type, file_size_bytes,
             drive_file_id, drive_link, document_hash_sha256,
             uploaded_by_user_id, uploaded_by_email, uploaded_at, metadata
      FROM bc_determinations_documents
      WHERE business_case_id = $1
        AND is_current = true
      ORDER BY uploaded_at DESC, id DESC
      LIMIT 1
      `,
      [businessCaseId],
    );
    return rows[0] || null;
  } catch (error) {
    if (error?.code === "42P01") return null;
    throw error;
  }
}

async function saveCurrentDocument({
  businessCaseId,
  fileName,
  mimeType,
  fileSizeBytes,
  driveFileId,
  driveLink,
  documentHashSha256,
  uploadedByUserId,
  uploadedByEmail,
  metadata = {},
}) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      `
      UPDATE bc_determinations_documents
      SET is_current = false, updated_at = NOW()
      WHERE business_case_id = $1
        AND is_current = true
      `,
      [businessCaseId],
    );

    const { rows } = await client.query(
      `
      INSERT INTO bc_determinations_documents (
        business_case_id,
        file_name,
        mime_type,
        file_size_bytes,
        drive_file_id,
        drive_link,
        document_hash_sha256,
        uploaded_by_user_id,
        uploaded_by_email,
        uploaded_at,
        is_current,
        metadata,
        created_at,
        updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),true,$10::jsonb,NOW(),NOW()
      )
      RETURNING id, business_case_id, file_name, mime_type, file_size_bytes,
                drive_file_id, drive_link, document_hash_sha256,
                uploaded_by_user_id, uploaded_by_email, uploaded_at, metadata
      `,
      [
        businessCaseId,
        fileName || null,
        mimeType || null,
        Number.isFinite(Number(fileSizeBytes)) ? Number(fileSizeBytes) : null,
        driveFileId || null,
        driveLink || null,
        documentHashSha256 || null,
        uploadedByUserId || null,
        uploadedByEmail || null,
        JSON.stringify(metadata || {}),
      ],
    );
    await client.query("COMMIT");
    return rows[0] || null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function buildGateInfo({
  businessCase,
  role = "unknown",
  now = new Date(),
  currentDocument = null,
}) {
  const config = getRoleConfig(businessCase);
  const metadata = businessCase?.modern_bc_metadata && typeof businessCase.modern_bc_metadata === "object"
    ? businessCase.modern_bc_metadata
    : {};
  const rawGate = metadata?.determinations_gate && typeof metadata.determinations_gate === "object"
    ? metadata.determinations_gate
    : {};
  const metadataDocument = rawGate?.document && typeof rawGate.document === "object" ? rawGate.document : {};
  const document = currentDocument
    ? {
      name: currentDocument?.file_name || metadataDocument?.name || null,
      mime_type: currentDocument?.mime_type || metadataDocument?.mime_type || null,
      drive_file_id: currentDocument?.drive_file_id || metadataDocument?.drive_file_id || null,
      drive_link: currentDocument?.drive_link || metadataDocument?.drive_link || null,
      uploaded_at: currentDocument?.uploaded_at || metadataDocument?.uploaded_at || null,
      uploaded_by_email: currentDocument?.uploaded_by_email || metadataDocument?.uploaded_by_email || null,
      uploaded_by_id: currentDocument?.uploaded_by_user_id || metadataDocument?.uploaded_by_id || null,
      file_size_bytes: currentDocument?.file_size_bytes || null,
      document_hash_sha256: currentDocument?.document_hash_sha256 || null,
    }
    : metadataDocument;

  const uploadedAt = toDateOrNull(rawGate?.enabled_at || document?.uploaded_at || null);
  const deadlineAt = toDateOrNull(rawGate?.deadline_at || null)
    || (uploadedAt ? new Date(uploadedAt.getTime() + DETERMINATIONS_DEADLINE_HOURS * 60 * 60 * 1000) : null);
  const hasDocument = Boolean(document?.drive_file_id || document?.drive_link);
  const enabled = Boolean(rawGate?.enabled && hasDocument && uploadedAt);
  const expiredByTime = Boolean(deadlineAt && deadlineAt.getTime() < now.getTime());
  const expiredByFlag = Boolean(rawGate?.is_expired);
  const expired = expiredByTime || expiredByFlag;
  const normalizedRole = String(role || "").toLowerCase();
  const canUpload = isUploadRole(normalizedRole);
  const canViewDocument = hasDocument && (
    canUpload ||
    DETERMINATIONS_DOCUMENT_VIEW_ROLES.has(normalizedRole)
  );
  const canEditDeterminations = enabled && !expired && config.editors.includes(normalizedRole);

  return {
    enabledForBusinessCase: true,
    workflowType: config.type,
    workflowLabel: config.label,
    requiresDocument: true,
    documentUploaded: hasDocument,
    enabledAt: toIsoOrNull(uploadedAt),
    deadlineAt: toIsoOrNull(deadlineAt),
    remainingMs: deadlineAt ? Math.max(0, deadlineAt.getTime() - now.getTime()) : null,
    isExpired: expired,
    editors: config.editors,
    notificationsTargetRoles: config.notify,
    permissions: {
      canUploadDocument: canUpload,
      canViewDocument,
      canEditDeterminations,
    },
    document: hasDocument
      ? {
        name: document?.name || null,
        mimeType: document?.mime_type || null,
        driveFileId: document?.drive_file_id || null,
        driveLink: document?.drive_link || null,
        uploadedAt: toIsoOrNull(toDateOrNull(document?.uploaded_at)),
        uploadedByEmail: document?.uploaded_by_email || null,
        uploadedById: document?.uploaded_by_id || null,
        fileSizeBytes: document?.file_size_bytes || null,
        documentHashSha256: document?.document_hash_sha256 || null,
      }
      : null,
  };
}

function assertCanEditDeterminationsOrThrow(gate) {
  if (!gate?.documentUploaded) {
    const error = new Error("Debe cargarse el documento estadistico antes de editar determinaciones.");
    error.status = 409;
    error.code = "DETERMINATIONS_STAT_DOC_REQUIRED";
    throw error;
  }
  if (gate?.isExpired) {
    const error = new Error("La ventana de 48 horas para determinaciones ya expiro.");
    error.status = 409;
    error.code = "DETERMINATIONS_EDIT_WINDOW_EXPIRED";
    throw error;
  }
  if (!gate?.permissions?.canEditDeterminations) {
    const error = new Error("No tienes permisos para editar determinaciones en este flujo.");
    error.status = 403;
    error.code = "DETERMINATIONS_ROLE_NOT_ALLOWED";
    throw error;
  }
}

module.exports = {
  DETERMINATIONS_DEADLINE_HOURS,
  isUploadRole,
  getRoleConfig,
  getCurrentDocument,
  saveCurrentDocument,
  buildGateInfo,
  assertCanEditDeterminationsOrThrow,
};
