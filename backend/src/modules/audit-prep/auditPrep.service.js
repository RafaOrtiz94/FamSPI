const db = require("../../config/db");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");
const { logAction } = require("../../utils/audit");

const MODULE = "audit_prep";
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB

const sanitizeBase64 = (raw = "") => raw.replace(/^data:.*;base64,/, "");

const normalizeRole = (role) => (role || "").toLowerCase();

const isAuditActive = (settings) => {
  if (!settings?.audit_mode) return false;
  const now = new Date();
  if (settings.audit_start_date && new Date(settings.audit_start_date) > now) {
    return false;
  }
  if (settings.audit_end_date && new Date(settings.audit_end_date) < now) {
    return false;
  }
  return true;
};

async function getSettings() {
  const { rows } = await db.query(
    `SELECT id, audit_mode, audit_start_date, audit_end_date, drive_root_id, checklist_schema, created_at, updated_at
       FROM audit_settings
      WHERE id = 1`
  );

  if (!rows[0]) {
    await db.query("INSERT INTO audit_settings (id) VALUES (1)");
    return getSettings();
  }

  return rows[0];
}

async function updateSettings({
  user,
  audit_mode,
  audit_start_date = null,
  audit_end_date = null,
}) {
  const current = await getSettings();

  const normalizeDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const nextMode = audit_mode === undefined ? current.audit_mode : Boolean(audit_mode);
  const nextStart = normalizeDate(audit_start_date) || null;
  const nextEnd = normalizeDate(audit_end_date) || null;

  const { rows } = await db.query(
    `UPDATE audit_settings
        SET audit_mode = $1,
            audit_start_date = $2,
            audit_end_date = $3,
            updated_at = NOW()
      WHERE id = 1
    RETURNING id, audit_mode, audit_start_date, audit_end_date, drive_root_id, checklist_schema, created_at, updated_at`,
    [nextMode, nextStart, nextEnd]
  );

  if (current.audit_mode && !nextMode) {
    await db.query(
      `UPDATE audit_access_grants
          SET active = false,
              revoked_at = NOW(),
              revoked_by = $1
        WHERE active = true`,
      [user?.id || null]
    );
  }

  const updated = rows[0];
  await logAction({
    usuario_id: user?.id || null,
    usuario_email: user?.email,
    rol: user?.role,
    modulo: MODULE,
    accion: "toggle",
    descripcion: `audit_mode=${updated.audit_mode}`,
    datos_anteriores: current,
    datos_nuevos: updated,
  });

  return { ...updated, active: isAuditActive(updated) };
}

async function listSections({ role }) {
  const normalized = normalizeRole(role);
  const { rows } = await db.query(
    `SELECT id, code, title, description, area, storage_path, allowed_roles, ordering, active, metadata, created_at, updated_at
       FROM audit_sections
      WHERE active = true
      ORDER BY ordering ASC, id ASC`
  );

  const filtered = rows.filter((section) => {
    if (!section.allowed_roles?.length) return true;
    if (["gerencia", "admin_ti", "jefe_ti"].includes(normalized)) return true;
    return section.allowed_roles.map((r) => r.toLowerCase()).includes(normalized);
  });

  return filtered;
}

async function upsertSection({ user, payload }) {
  const {
    code,
    title,
    description,
    area,
    storage_path,
    allowed_roles = [],
    ordering = 0,
    metadata = {},
  } = payload || {};

  if (!code || !title || !storage_path) {
    const err = new Error("Faltan campos obligatorios para la sección");
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO audit_sections (code, title, description, area, storage_path, allowed_roles, ordering, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (code) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       area = EXCLUDED.area,
       storage_path = EXCLUDED.storage_path,
       allowed_roles = EXCLUDED.allowed_roles,
       ordering = EXCLUDED.ordering,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING id, code, title, description, area, storage_path, allowed_roles, ordering, active, metadata, created_at, updated_at`,
    [
      code,
      title,
      description || null,
      area || null,
      storage_path,
      allowed_roles,
      ordering,
      metadata,
    ]
  );

  const saved = rows[0];
  await logAction({
    usuario_id: user?.id || null,
    usuario_email: user?.email,
    rol: user?.role,
    modulo: MODULE,
    accion: "upsert_section",
    descripcion: code,
    datos_nuevos: saved,
  });
  return saved;
}

async function getSection(code) {
  const { rows } = await db.query(
    `SELECT id, code, title, description, area, storage_path, allowed_roles, ordering, active, metadata
       FROM audit_sections
      WHERE code = $1 AND active = true`,
    [code]
  );
  return rows[0];
}

async function ensureAuditRoot(settings) {
  if (settings.drive_root_id) return settings.drive_root_id;
  const folder = await ensureFolder("Auditoria", null);
  await db.query(
    `UPDATE audit_settings SET drive_root_id = $1, updated_at = NOW() WHERE id = 1`,
    [folder.id]
  );
  return folder.id;
}

async function ensureStoragePath(rootId, storagePath) {
  const parts = storagePath.split("/").filter(Boolean);
  let parentId = rootId;
  for (const name of parts) {
    const folder = await ensureFolder(name.trim(), parentId);
    parentId = folder.id;
  }
  return parentId;
}

const mapDocument = (row) => ({
  id: row.id,
  section_code: row.section_code,
  name: row.name,
  status: row.status,
  uploaded_at: row.uploaded_at,
  uploaded_by: row.uploaded_by,
  uploader_email: row.uploader_email,
  uploader_name: row.uploader_name,
  metadata: (() => {
    const meta = { ...(row.metadata || {}) };
    delete meta.webViewLink; // no exponer IDs de Drive
    return meta;
  })(),
});

async function listDocuments({ role }) {
  const normalized = normalizeRole(role);
  const { rows } = await db.query(
    `SELECT d.id, d.section_code, d.name, d.status, d.uploaded_at, d.uploaded_by, d.metadata,
            s.allowed_roles, s.area,
            u.email AS uploader_email, u.nombre_completo AS uploader_name
       FROM audit_documents d
       JOIN audit_sections s ON s.code = d.section_code
       LEFT JOIN users u ON u.id = d.uploaded_by
      WHERE s.active = true
      ORDER BY d.updated_at DESC`
  );

  return rows
    .filter((row) => {
      if (!row.allowed_roles?.length) return true;
      if (["gerencia", "admin_ti", "jefe_ti"].includes(normalized)) return true;
      return row.allowed_roles.map((r) => r.toLowerCase()).includes(normalized);
    })
    .map(mapDocument);
}

function assertAllowedSection(section, role) {
  if (!section) {
    const err = new Error("Sección no encontrada o inactiva");
    err.status = 404;
    throw err;
  }
  const normalized = normalizeRole(role);
  if (!section.allowed_roles?.length) return;
  const allowed = section.allowed_roles.map((r) => r.toLowerCase());
  if (
    !allowed.includes(normalized) &&
    !["gerencia", "admin_ti", "jefe_ti"].includes(normalized)
  ) {
    const err = new Error("No tienes permisos para esta sección");
    err.status = 403;
    throw err;
  }
}

function validateFilePayload(file) {
  if (!file?.name || !file?.content || !file?.mimeType) {
    const err = new Error("Archivo inválido");
    err.status = 400;
    throw err;
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
    const err = new Error("Tipo de archivo no permitido");
    err.status = 415;
    throw err;
  }
  const raw = sanitizeBase64(file.content);
  const size = Buffer.byteLength(raw, "base64");
  if (size > MAX_FILE_BYTES) {
    const err = new Error("Archivo excede el límite de 15MB");
    err.status = 413;
    throw err;
  }
  return { ...file, content: raw, size };
}

async function uploadDocument({ user, section_code, file }) {
  const settings = await getSettings();
  if (!isAuditActive(settings)) {
    const err = new Error("La auditoría no está activa");
    err.status = 409;
    throw err;
  }

  const section = await getSection(section_code);
  assertAllowedSection(section, user?.role);
  const safeFile = validateFilePayload(file);

  const rootId = await ensureAuditRoot(settings);
  const folderId = await ensureStoragePath(rootId, section.storage_path);
  const uploaded = await uploadBase64File(
    safeFile.name,
    safeFile.content,
    safeFile.mimeType,
    folderId
  );

  const { rows } = await db.query(
    `INSERT INTO audit_documents (section_code, name, status, drive_file_id, drive_folder_id, uploaded_by, uploaded_at, metadata)
     VALUES ($1,$2,'cargado',$3,$4,$5,NOW(),$6)
     RETURNING id, section_code, name, status, uploaded_at, uploaded_by, metadata`,
    [
      section_code,
      safeFile.name,
      uploaded.id,
      folderId,
      user?.id || null,
      { webViewLink: uploaded.webViewLink },
    ]
  );

  const saved = rows[0];
  await logAction({
    usuario_id: user?.id || null,
    usuario_email: user?.email,
    rol: user?.role,
    modulo: MODULE,
    accion: "upload",
    descripcion: `${section_code}:${safeFile.name}`,
    datos_nuevos: saved,
  });

  return mapDocument({ ...saved, uploader_email: user?.email, uploader_name: user?.nombre_completo });
}

async function updateDocumentStatus({ user, id, status }) {
  const allowedStatus = new Set(["pendiente", "cargado", "revision"]);
  if (!allowedStatus.has(status)) {
    const err = new Error("Estado inválido");
    err.status = 400;
    throw err;
  }

  const { rows: accessRows } = await db.query(
    `SELECT d.id, d.section_code, s.allowed_roles
       FROM audit_documents d
       JOIN audit_sections s ON s.code = d.section_code
      WHERE d.id = $1`,
    [id]
  );

  if (!accessRows[0]) {
    const err = new Error("Documento no encontrado");
    err.status = 404;
    throw err;
  }

  assertAllowedSection(accessRows[0], user?.role);

  const { rows } = await db.query(
    `UPDATE audit_documents
        SET status = $2,
            updated_at = NOW()
      WHERE id = $1
    RETURNING id, section_code, name, status, uploaded_at, uploaded_by, metadata`,
    [id, status]
  );

  if (!rows[0]) {
    const err = new Error("Documento no encontrado");
    err.status = 404;
    throw err;
  }

  const updated = rows[0];
  await logAction({
    usuario_id: user?.id || null,
    usuario_email: user?.email,
    rol: user?.role,
    modulo: MODULE,
    accion: "update_status",
    descripcion: `${updated.section_code}:${status}`,
    datos_nuevos: updated,
  });

  return mapDocument(updated);
}

async function getDocumentWithDrive(id) {
  const { rows } = await db.query(
    `SELECT d.id, d.section_code, d.name, d.status, d.drive_file_id, d.drive_folder_id, d.uploaded_at, d.uploaded_by, d.metadata,
            s.allowed_roles
       FROM audit_documents d
       JOIN audit_sections s ON s.code = d.section_code
      WHERE d.id = $1`,
    [id]
  );
  return rows[0];
}

async function listExternalAccess() {
  const { rows } = await db.query(
    `SELECT id, email, display_name, expires_at, active, created_by, created_at, revoked_at, revoked_by
       FROM audit_access_grants
      ORDER BY created_at DESC`
  );
  return rows;
}

async function addExternalAccess({ user, email, display_name, expires_at }) {
  if (!email) {
    const err = new Error("Correo requerido para el auditor externo");
    err.status = 400;
    throw err;
  }

  const { rows: activeRows } = await db.query(
    `SELECT COUNT(*) FROM audit_access_grants WHERE active = true`
  );
  const activeCount = parseInt(activeRows[0]?.count || 0, 10);
  if (activeCount >= 2) {
    const err = new Error("Solo se permiten 2 auditores externos activos");
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO audit_access_grants (email, display_name, expires_at, active, created_by)
     VALUES ($1,$2,$3,true,$4)
     RETURNING id, email, display_name, expires_at, active, created_by, created_at, revoked_at, revoked_by`,
    [String(email).toLowerCase(), display_name || null, expires_at || null, user?.id || null]
  );

  const grant = rows[0];
  await logAction({
    usuario_id: user?.id || null,
    usuario_email: user?.email,
    rol: user?.role,
    modulo: MODULE,
    accion: "grant_external",
    descripcion: email,
    datos_nuevos: grant,
  });

  return grant;
}

async function revokeExternalAccess({ user, id }) {
  const { rows } = await db.query(
    `UPDATE audit_access_grants
        SET active = false,
            revoked_at = NOW(),
            revoked_by = $2
      WHERE id = $1
    RETURNING id, email, display_name, expires_at, active, created_by, created_at, revoked_at, revoked_by`,
    [id, user?.id || null]
  );

  if (!rows[0]) {
    const err = new Error("Acceso no encontrado");
    err.status = 404;
    throw err;
  }

  const grant = rows[0];
  await logAction({
    usuario_id: user?.id || null,
    usuario_email: user?.email,
    rol: user?.role,
    modulo: MODULE,
    accion: "revoke_external",
    descripcion: `${grant.email}`,
    datos_nuevos: grant,
  });
  return grant;
}

module.exports = {
  getSettings,
  updateSettings,
  listSections,
  upsertSection,
  uploadDocument,
  listDocuments,
  updateDocumentStatus,
  getDocumentWithDrive,
  listExternalAccess,
  addExternalAccess,
  revokeExternalAccess,
  isAuditActive,
  assertAllowedSection,
};
