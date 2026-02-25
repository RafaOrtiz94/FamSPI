const { Readable } = require("stream");
const fs = require("fs");
const db = require("../../config/db");
const logger = require("../../config/logger");
const { drive } = require("../../config/google");
const { logAction } = require("../../utils/audit");
const { ensureFolder } = require("../../utils/drive");

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

const toDriveViewUrl = (driveId) =>
  driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w300` : null;

const normalizeAvatarUrl = (row) => {
  // Priorizar URL de Drive thumbnail para mejor performance
  if (row.avatar_drive_id) {
    return toDriveViewUrl(row.avatar_drive_id);
  }

  // Si no hay drive_id pero hay URL de Drive, extraer ID
  if (row.avatar_url && row.avatar_url.includes("drive.google.com")) {
    const match = row.avatar_url.match(/\/d\/([^/?]+)/);
    if (match?.[1]) return toDriveViewUrl(match[1]);
  }

  // Usar data URI solo como último recurso (problemas de performance)
  if (row.avatar_url && row.avatar_url.startsWith("data:")) {
    return row.avatar_url;
  }

  // URL externa o null
  return row.avatar_url || null;
};

const mapProfileRow = (row) => ({
  id: row.id,
  user_id: row.user_id,
  avatar_url: normalizeAvatarUrl(row),
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

const PROFILE_SYNC_KEYS = [
  'personal.telefono_personal',
  'personal.email_personal',
  'personal.estado_civil',
  'personal.genero',
  'personal.tipo_sangre',
  'personal.lugar_nacimiento',
  'personal.fecha_nacimiento',
  'domicilio.ciudad_domicilio',
  'domicilio.direccion_domicilio',
  'domicilio.telefono_fijo',
  'emergencia.persona_contacto',
  'emergencia.telefono_contacto',
  'estudios.nivel_instruccion',
  'estudios.titulo_tercer_nivel',
  'estudios.universidad_tercer_nivel',
  'estudios.titulo_cuarto_nivel',
  'estudios.universidad_cuarto_nivel',
  'laboral.fecha_ingreso',
  'laboral.cargo',
  'laboral.area',
  'laboral.telefono_celular_famproject',
  'laboral.email_famproject'
];

const getNested = (obj, path) => {
  if (!obj) return undefined;
  return path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
};

const setNested = (obj, path, value) => {
  let ref = obj;
  path.forEach((key, idx) => {
    if (idx === path.length - 1) {
      ref[key] = value;
    } else {
      if (!ref[key] || typeof ref[key] !== 'object') ref[key] = {};
      ref = ref[key];
    }
  });
};

const pickCollaboratorProfile = (profile = {}) => {
  const result = {};
  PROFILE_SYNC_KEYS.forEach((key) => {
    const path = key.split('.');
    const value = getNested(profile, path);
    if (value !== undefined) {
      setNested(result, path, value);
    }
  });
  return result;
};

const mergeCollaboratorIntoProfile = (metadata = {}, collaboratorProfile = {}) => {
  const safe = sanitizeMetadata(metadata);
  const merged = { ...safe };
  const synced = pickCollaboratorProfile(collaboratorProfile);
  Object.entries(synced).forEach(([section, data]) => {
    merged[section] = { ...(merged[section] || {}), ...data };
  });
  return merged;
};

const mergeProfileIntoCollaborator = (collabProfile = {}, metadata = {}) => {
  const next = { ...(collabProfile || {}) };
  PROFILE_SYNC_KEYS.forEach((key) => {
    const path = key.split('.');
    const incoming = getNested(metadata, path);
    if (incoming !== undefined) {
      setNested(next, path, incoming);
    }
  });
  return next;
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

const ensureUserProfileMeta = async (userId, defaults = {}) => {
  const { rows } = await db.query(
    `INSERT INTO user_profile (user_id, metadata, preferences, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET metadata = user_profile.metadata
     RETURNING id, user_id, avatar_url, avatar_drive_id, metadata, preferences, created_at, updated_at`,
    [userId, defaults, {}]
  );
  return mapProfileRow(rows[0]);
};


const createProfile = async ({ userId, metadata = {}, preferences = {}, avatar }) => {
  const identity = await getIdentity(userId);
  const safeMetadata = sanitizeMetadata(metadata);
  const safePreferences = sanitizePreferences(preferences);
  const avatarInfo = avatar ? await uploadAvatar(userId, avatar, null, identity) : {};

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
  const avatarInfo = avatar
    ? await uploadAvatar(userId, avatar, current.avatar_drive_id, identity)
    : {};

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

  try {
    const { rows: collabRows } = await db.query(
      `SELECT profile FROM collaborator_profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const collabProfile = collabRows[0]?.profile || {};
    const mergedCollaboratorProfile = mergeProfileIntoCollaborator(collabProfile, mergedMetadata);

    await db.query(
      `INSERT INTO collaborator_profiles (user_id, profile, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET profile = EXCLUDED.profile, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [userId, mergedCollaboratorProfile, userId]
    );
  } catch (syncErr) {
    logger.warn({ syncErr, userId }, "No se pudo sincronizar perfil con colaborador");
  }

  await auditChange({ userId, action: "actualizar", before: current, after: profile });
  return profile;
};

const resolveAvatarFolder = async (identity) => {
  const base =
    process.env.DRIVE_PROFILE_PHOTOS_FOLDER_ID ||
    process.env.DRIVE_PROFILE_FOLDER_ID ||
    process.env.DRIVE_DOCS_FOLDER_ID ||
    process.env.DRIVE_ROOT_FOLDER_ID ||
    process.env.DRIVE_FOLDER_ID;

  if (!base) return null;

  const usersRoot = await ensureFolder("Usuarios", base);
  const userFolderName = identity?.email || identity?.fullname || `user-${identity?.id || "na"}`;
  const userFolder = await ensureFolder(userFolderName, usersRoot.id);
  const avatarFolder = await ensureFolder("Avatar", userFolder.id);
  return avatarFolder.id;
};

const uploadAvatar = async (userId, file, previousDriveId, identity) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const err = new Error("Formato de imagen no permitido");
    err.status = 400;
    throw err;
  }

  const avatarBuffer =
    Buffer.isBuffer(file?.buffer)
      ? file.buffer
      : file?.path
        ? fs.readFileSync(file.path)
        : null;

  if (!avatarBuffer || avatarBuffer.length === 0) {
    const err = new Error("El archivo de imagen está vacío o no se pudo leer");
    err.status = 400;
    throw err;
  }

  const buildDataUri = () =>
    `data:${file.mimetype};base64,${avatarBuffer.toString("base64")}`;

  const actor = identity || (await getIdentity(userId));

  const folderBase = await resolveAvatarFolder(actor);

  if (!folderBase) {
    // Entorno sin Drive: guardar como data URI para no romper la UX
    logger.warn("Sin carpeta Drive para avatar, se guardará como data URI en BD.");
    return { avatar_url: buildDataUri(), avatar_drive_id: previousDriveId || null };
  }

  try {
    const extension = file.mimetype.split("/")[1] || "png";
    const safeName = `profile-${userId}-${Date.now()}.${extension}`;

    const stream = new Readable();
    stream._read = () => { };
    stream.push(avatarBuffer);
    stream.push(null);

    const { data } = await drive.files.create({
      supportsAllDrives: true,
      requestBody: { name: safeName, parents: [folderBase] },
      media: { mimeType: file.mimetype, body: stream },
      fields: "id, name, mimeType, webViewLink, webContentLink",
    });

    // Hacer el archivo visible con link
    try {
      await drive.permissions.create({
        fileId: data.id,
        supportsAllDrives: true,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch (permErr) {
      logger.warn({ permErr }, "No se pudo hacer público el avatar (se usa link por defecto)");
    }

    if (previousDriveId) {
      drive.files
        .delete({ fileId: previousDriveId, supportsAllDrives: true })
        .catch((err) => logger.warn({ err }, "No se pudo eliminar avatar anterior"));
    }

    // Usar thumbnail URL de Drive para mejor performance y compatibilidad
    const driveThumbnailUrl = `https://drive.google.com/thumbnail?id=${data.id}&sz=w300`;
    const dataUri = buildDataUri();
    return {
      // Priorizar URL de Drive thumbnail para mejor performance,
      // mantener data URI como fallback en caso de problemas de Drive
      avatar_url: driveThumbnailUrl,
      avatar_drive_id: data.id,
      // Incluir data URI como backup para casos donde Drive no esté disponible
      avatar_data_uri: dataUri,
    };
  } catch (err) {
    logger.warn({ err }, "No se pudo subir avatar a Drive, guardando data URI en BD");
    return { avatar_url: buildDataUri(), avatar_drive_id: previousDriveId || null };
  }
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
  let profile = (await getProfile(userId)) || null;

  const { rows: collabRows } = await db.query(
    `SELECT profile FROM collaborator_profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  const collaboratorProfile = collabRows[0]?.profile || {};

  if (!profile) {
    profile = await ensureUserProfileMeta(userId, {});
  }

  const mergedMetadata = mergeCollaboratorIntoProfile(profile.metadata || {}, collaboratorProfile);

  if (JSON.stringify(mergedMetadata) !== JSON.stringify(profile.metadata || {})) {
    const { rows } = await db.query(
      `UPDATE user_profile
       SET metadata = $2,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING id, user_id, avatar_url, avatar_drive_id, metadata, preferences, created_at, updated_at`,
      [userId, mergedMetadata]
    );
    profile = mapProfileRow(rows[0]);
  } else {
    profile = mapProfileRow({ ...profile, metadata: mergedMetadata });
  }

  return { identity, profile };
};

module.exports = {
  getProfileWithIdentity,
  createProfile,
  updateProfile,
};
