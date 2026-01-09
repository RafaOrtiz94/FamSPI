const db = require("../../config/db");
const logger = require("../../config/logger");
const { uploadFileToDrive, ensureFolder } = require("../../utils/drive");
const { logAction } = require("../../utils/audit");

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const resolveUserCertificationsFolder = async (userEmail) => {
  const base = process.env.DRIVE_PROFILE_FOLDER_ID ||
               process.env.DRIVE_DOCS_FOLDER_ID ||
               process.env.DRIVE_ROOT_FOLDER_ID ||
               process.env.DRIVE_FOLDER_ID;

  if (!base) return null;

  const usersRoot = await ensureFolder("Usuarios", base);
  const userFolderName = userEmail || `user-na`;
  const userFolder = await ensureFolder(userFolderName, usersRoot.id);
  const certsFolder = await ensureFolder("Certificaciones", userFolder.id);
  return certsFolder.id;
};

const validateCertificationData = (data) => {
  const errors = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push("El título es obligatorio");
  }

  if (data.title && data.title.length > 255) {
    errors.push("El título no puede exceder 255 caracteres");
  }

  if (data.issuer && data.issuer.length > 255) {
    errors.push("El emisor no puede exceder 255 caracteres");
  }

  if (data.description && data.description.length > 1000) {
    errors.push("La descripción no puede exceder 1000 caracteres");
  }

  const validTypes = ['certification', 'course', 'diploma', 'title', 'other'];
  if (data.credential_type && !validTypes.includes(data.credential_type)) {
    errors.push("Tipo de credencial inválido");
  }

  return errors;
};

const createCertification = async (userId, certificationData, file = null) => {
  const validationErrors = validateCertificationData(certificationData);
  if (validationErrors.length > 0) {
    const err = new Error("Datos de validación inválidos: " + validationErrors.join(", "));
    err.status = 400;
    throw err;
  }

  // Get user info for folder creation
  const user = await db.query("SELECT email, fullname FROM users WHERE id = $1", [userId]);
  if (!user.rows[0]) {
    const err = new Error("Usuario no encontrado");
    err.status = 404;
    throw err;
  }

  let driveInfo = {};
  if (file) {
    // Validate file
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const err = new Error("Tipo de archivo no permitido. Solo se aceptan PDF, JPG, PNG, WEBP");
      err.status = 400;
      throw err;
    }

    if (file.size > MAX_FILE_SIZE) {
      const err = new Error(`Archivo demasiado grande. Máximo ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      err.status = 400;
      throw err;
    }

    try {
      // Create user folder if needed
      const folderId = await resolveUserCertificationsFolder(user.rows[0].email);

      if (folderId) {
        // Upload file to Drive
        const driveResult = await uploadFileToDrive(file, `cert-${Date.now()}-${file.originalname}`);
        driveInfo = {
          drive_file_id: driveResult.id,
          drive_folder_id: folderId,
          file_url: driveResult.webViewLink
        };
      } else {
        logger.warn("No se pudo crear carpeta Drive para certificaciones");
      }
    } catch (driveErr) {
      logger.error({ driveErr }, "Error subiendo archivo a Drive");
      // Continue without file upload
    }
  }

  // Insert certification
  const insertQuery = `
    INSERT INTO user_certifications (
      user_id, title, issuer, issue_date, expiry_date,
      credential_type, description, drive_file_id, drive_folder_id, file_url,
      metadata, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
    RETURNING *
  `;

  const values = [
    userId,
    certificationData.title.trim(),
    certificationData.issuer?.trim() || null,
    certificationData.issue_date || null,
    certificationData.expiry_date || null,
    certificationData.credential_type || 'certification',
    certificationData.description?.trim() || null,
    driveInfo.drive_file_id || null,
    driveInfo.drive_folder_id || null,
    driveInfo.file_url || null,
    certificationData.metadata || {}
  ];

  const result = await db.query(insertQuery, values);
  const certification = result.rows[0];

  // Audit log
  await logAction({
    usuario_id: userId,
    usuario_email: user.rows[0].email,
    rol: null,
    modulo: "user-certifications",
    accion: "certification_created",
    descripcion: `Certificación creada: ${certification.title}`,
    datos_nuevos: certification
  });

  return certification;
};

const getUserCertifications = async (userId, includeInactive = false) => {
  const query = `
    SELECT * FROM user_certifications
    WHERE user_id = $1 ${includeInactive ? '' : 'AND is_active = true'}
    ORDER BY created_at DESC
  `;
  const result = await db.query(query, [userId]);
  return result.rows;
};

const getCertificationsByUserId = async (targetUserId, requesterUserId, requesterRole) => {
  // Check permissions
  const allowedRoles = ['acp_comercial', 'talento_humano'];
  if (!allowedRoles.includes(requesterRole) && requesterUserId !== targetUserId) {
    const err = new Error("No tienes permisos para ver las certificaciones de este usuario");
    err.status = 403;
    throw err;
  }

  const query = `
    SELECT uc.*, u.email, u.fullname
    FROM user_certifications uc
    JOIN users u ON uc.user_id = u.id
    WHERE uc.user_id = $1 AND uc.is_active = true
    ORDER BY uc.created_at DESC
  `;

  const result = await db.query(query, [targetUserId]);

  // Audit access by other users
  if (requesterUserId !== targetUserId) {
    await logAction({
      usuario_id: requesterUserId,
      usuario_email: null,
      rol: requesterRole,
      modulo: "user-certifications",
      accion: "certification_accessed_by_role",
      descripcion: `Acceso a certificaciones del usuario ${targetUserId}`,
      datos_nuevos: { target_user_id: targetUserId, count: result.rows.length }
    });
  }

  return result.rows;
};

const softDeleteCertification = async (certificationId, userId, requesterRole) => {
  // Get certification
  const certQuery = await db.query(
    "SELECT * FROM user_certifications WHERE id = $1 AND is_active = true",
    [certificationId]
  );

  if (!certQuery.rows[0]) {
    const err = new Error("Certificación no encontrada");
    err.status = 404;
    throw err;
  }

  const certification = certQuery.rows[0];

  // Check ownership or permissions
  const allowedRoles = ['acp_comercial', 'talento_humano'];
  if (certification.user_id !== userId && !allowedRoles.includes(requesterRole)) {
    const err = new Error("No tienes permisos para eliminar esta certificación");
    err.status = 403;
    throw err;
  }

  // Soft delete
  await db.query(
    "UPDATE user_certifications SET is_active = false, updated_at = NOW() WHERE id = $1",
    [certificationId]
  );

  // Audit log
  await logAction({
    usuario_id: userId,
    usuario_email: null,
    rol: requesterRole,
    modulo: "user-certifications",
    accion: "certification_deleted",
    descripcion: `Certificación eliminada: ${certification.title}`,
    datos_anteriores: certification
  });

  return { success: true, message: "Certificación eliminada correctamente" };
};

module.exports = {
  createCertification,
  getUserCertifications,
  getCertificationsByUserId,
  softDeleteCertification
};