const { Readable } = require("stream");
const db = require("../../config/db");
const logger = require("../../config/logger");
const { drive } = require("../../config/google");
const { logAction } = require("../../utils/audit");

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const BLOCKED_METADATA_KEYS = new Set([
  "email",
  "fullname",
  "full_name",
  "domain",
  "google_id",
  "oauth_id",
]);

const sanitizeMetadata = (metadata = {}) => {
  if (!metadata || typeof metadata !== "object") return {};

  const safeEntries = Object.entries(metadata).filter(([key]) =>
    key ? !BLOCKED_METADATA_KEYS.has(String(key).toLowerCase()) : false
  );

  const safeMetadata = {};
  safeEntries.forEach(([key, value]) => {
    if (value === undefined) return;
    if (value === null) {
      safeMetadata[key] = null;
      return;
    }
    if (typeof value === "string") {
      safeMetadata[key] = value.slice(0, 500);
    } else if (typeof value === "number" || typeof value === "boolean") {
      safeMetadata[key] = value;
    } else if (Array.isArray(value) || typeof value === "object") {
      safeMetadata[key] = value;
    }
  });

  return safeMetadata;
};

const sanitizePreferences = (preferences = {}) => {
  if (!preferences || typeof preferences !== "object") return {};

  const allowedKeys = new Set(["theme", "language", "density", "notifications"]);
  const normalized = {};

  Object.entries(preferences).forEach(([key, value]) => {
    if (!allowedKeys.has(key)) return;

    switch (key) {
      case "theme":
        normalized.theme = ["dark", "light"].includes(String(value)) ? value : undefined;
        break;
      case "language":
        normalized.language = String(value || "es").slice(0, 10);
        break;
      case "density":
        normalized.density = ["comfortable", "compact"].includes(String(value))
          ? value
          : undefined;
        break;
      case "notifications":
        normalized.notifications = typeof value === "object" ? value : undefined;
        break;
      default:
        break;
    }
  });

  return Object.fromEntries(
    Object.entries(normalized).filter(([, v]) => v !== undefined)
  );
};

const mapProfileRow = (row) => ({
  id: row.id,
  user_id: row.user_id,
  avatar_url: row.avatar_url,
  avatar_drive_id: row.avatar_drive_id,
  metadata: row.metadata || {},
  preferences: row.preferences || {},
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const getIdentity = async (userId) => {
  const { rows } = await db.query(
    `SELECT id, email, fullname, role, department_id, google_id, created_at, updated_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (!rows[0]) return null;
  return rows[0];
};

const getProfile = async (userId) => {
  const { rows } = await db.query(
    `SELECT id, user_id, avatar_url, avatar_drive_id, metadata, preferences, created_at, updated_at
     FROM user_profile
     WHERE user_id = $1`,
    [userId]
  );

  if (!rows[0]) return null;
  return mapProfileRow(rows[0]);
};

const createProfile = async ({ userId, metadata = {}, preferences = {}, avatar }) => {
  const safeMetadata = sanitizeMetadata(metadata);
  const safePreferences = sanitizePreferences(preferences);
  const avatarInfo = avatar ? await uploadAvatar(userId, avatar) : {};

  const { rows } = await db.query(
    `INSERT INTO user_profile (user_id, avatar_url, avatar_drive_id, metadata, preferences, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING id, user_id, avatar_url, avatar_drive_id, metadata, preferences, created_at, updated_at`,
    [
      userId,
      avatarInfo.avatar_url || null,
      avatarInfo.avatar_drive_id || null,
      safeMetadata,
      safePreferences,
    ]
  );

  const profile = mapProfileRow(rows[0]);
  await auditChange({ userId, action: "crear", before: null, after: profile });
  return profile;
};

const updateProfile = async ({ userId, metadata = {}, preferences = {}, avatar }) => {
  const identity = await getIdentity(userId);
  if (!identity) {
    const err = new Error("Usuario no encontrado");
    err.status = 404;
    throw err;
  }

  const existing = await getProfile(userId);
  if (!existing) {
    return createProfile({ userId, metadata, preferences, avatar });
  }

  const current = existing;
  const safeMetadata = sanitizeMetadata(metadata);
  const safePreferences = sanitizePreferences(preferences);

  const mergedMetadata = { ...current.metadata, ...safeMetadata };
  const mergedPreferences = { ...current.preferences, ...safePreferences };
  const avatarInfo = avatar ? await uploadAvatar(userId, avatar, current.avatar_drive_id) : {};

  const { rows } = await db.query(
    `UPDATE user_profile
     SET metadata = $2,
         preferences = $3,
         avatar_url = COALESCE($4, avatar_url),
         avatar_drive_id = COALESCE($5, avatar_drive_id),
         updated_at = NOW()
     WHERE user_id = $1
     RETURNING id, user_id, avatar_url, avatar_drive_id, metadata, preferences, created_at, updated_at`,
    [
      userId,
      mergedMetadata,
      mergedPreferences,
      avatarInfo.avatar_url || null,
      avatarInfo.avatar_drive_id || null,
    ]
  );

  const profile = mapProfileRow(rows[0]);
  await auditChange({ userId, action: "actualizar", before: current, after: profile });
  return profile;
};

const uploadAvatar = async (userId, file, previousDriveId) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const err = new Error("Formato de imagen no permitido");
    err.status = 400;
    throw err;
  }

  const folderBase =
    process.env.DRIVE_PROFILE_PHOTOS_FOLDER_ID ||
    process.env.DRIVE_PROFILE_FOLDER_ID ||
    process.env.DRIVE_DOCS_FOLDER_ID;

  if (!folderBase) {
    const err = new Error("No hay carpeta configurada para fotos de perfil");
    err.status = 500;
    throw err;
  }

  const extension = file.mimetype.split("/")[1] || "png";
  const safeName = `profile-${userId}-${Date.now()}.${extension}`;

  const stream = new Readable();
  stream._read = () => {};
  stream.push(file.buffer);
  stream.push(null);

  const { data } = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name: safeName, parents: [folderBase] },
    media: { mimeType: file.mimetype, body: stream },
    fields: "id, name, mimeType, webViewLink, webContentLink",
  });

  if (previousDriveId) {
    drive.files
      .delete({ fileId: previousDriveId, supportsAllDrives: true })
      .catch((err) => logger.warn({ err }, "No se pudo eliminar avatar anterior"));
  }

  return { avatar_url: data.webViewLink || data.webContentLink || null, avatar_drive_id: data.id };
};

const auditChange = async ({ userId, action, before, after }) => {
  try {
    await logAction({
      usuario_id: userId,
      usuario_email: null,
      rol: null,
      modulo: "user-profile",
      accion: action,
      descripcion: `Perfil de usuario ${action}`,
      datos_anteriores: before,
      datos_nuevos: after,
    });
  } catch (err) {
    logger.warn({ err }, "No se pudo registrar auditoría de perfil");
  }
};

const getProfileWithIdentity = async (userId) => {
  const identity = await getIdentity(userId);
  const profile = (await getProfile(userId)) || null;
  return { identity, profile };
};

module.exports = {
  getProfileWithIdentity,
  createProfile,
  updateProfile,
};
