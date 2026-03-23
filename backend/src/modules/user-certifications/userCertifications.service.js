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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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

const EXPIRY_WARNING_DAYS = Number(process.env.CERT_EXPIRY_WARNING_DAYS || 30);

const getCertificationLifecycle = (cert = {}) => {
  const expiryDate = cert.expiry_date ? new Date(cert.expiry_date) : null;
  if (!expiryDate || Number.isNaN(expiryDate.getTime())) {
    return {
      status: "permanent",
      status_label: "Sin caducidad",
      status_color: "blue",
      days_until_expiry: null,
      is_expired: false,
      is_expiring_soon: false,
    };
  }

  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    return {
      status: "expired",
      status_label: "Expirada",
      status_color: "red",
      days_until_expiry: daysUntilExpiry,
      is_expired: true,
      is_expiring_soon: false,
    };
  }

  if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
    return {
      status: "expiring_soon",
      status_label: `Expira en ${daysUntilExpiry} días`,
      status_color: "amber",
      days_until_expiry: daysUntilExpiry,
      is_expired: false,
      is_expiring_soon: true,
    };
  }

  return {
    status: "active",
    status_label: "Vigente",
    status_color: "emerald",
    days_until_expiry: daysUntilExpiry,
    is_expired: false,
    is_expiring_soon: false,
  };
};

const enrichCertification = (cert = {}) => ({
  ...cert,
  ...getCertificationLifecycle(cert),
});

const summarizeCertifications = (certifications = []) => {
  return certifications.reduce(
    (acc, cert) => {
      const status = getCertificationLifecycle(cert);
      acc.total += 1;
      if (status.status === "active") acc.active += 1;
      if (status.status === "permanent") acc.permanent += 1;
      if (status.status === "expiring_soon") acc.expiring_soon += 1;
      if (status.status === "expired") acc.expired += 1;
      return acc;
    },
    { total: 0, active: 0, permanent: 0, expiring_soon: 0, expired: 0 }
  );
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
        const driveResult = await uploadFileToDrive(file, `cert-${Date.now()}-${file.originalname}`, folderId);
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
  const certifications = result.rows.map(enrichCertification);
  return {
    certifications,
    summary: summarizeCertifications(certifications),
  };
};

const getCertificationsByUserId = async (targetUserId, requesterUserId, requesterRole) => {
  // Check permissions
  const allowedRoles = ['acp_comercial', 'talento_humano', 'gerencia', 'gerencia_general'];
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
  const certifications = result.rows.map(enrichCertification);

  // Audit access by other users
  if (requesterUserId !== targetUserId) {
    await logAction({
      usuario_id: requesterUserId,
      usuario_email: null,
      rol: requesterRole,
      modulo: "user-certifications",
      accion: "certification_accessed_by_role",
      descripcion: `Acceso a certificaciones del usuario ${targetUserId}`,
      datos_nuevos: { target_user_id: targetUserId, count: certifications.length }
    });
  }

  return {
    certifications,
    summary: summarizeCertifications(certifications),
  };
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
  const allowedRoles = ['acp_comercial', 'talento_humano', 'gerencia', 'gerencia_general'];
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

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateConsolidatedCertificationsPDF = async (targetUserId, requesterUserId, requesterRole) => {
  console.log('🎯 [PDF] Generando PDF consolidado de certificaciones para usuario:', targetUserId, 'por:', requesterUserId, 'rol:', requesterRole);

  // Verificar permisos
  const allowedRoles = ['acp_comercial', 'talento_humano', 'gerencia', 'gerencia_general'];
  if (!allowedRoles.includes(requesterRole) && requesterUserId !== targetUserId) {
    const err = new Error("No tienes permisos para acceder a las certificaciones de este usuario");
    err.status = 403;
    throw err;
  }

  // Obtener certificaciones del usuario
  const certificationsResult = await getCertificationsByUserId(targetUserId, requesterUserId, requesterRole);
  const certifications = certificationsResult.certifications || [];

  if (certifications.length === 0) {
    const err = new Error("El usuario no tiene certificaciones activas");
    err.status = 404;
    throw err;
  }

  // Obtener información del usuario
  const user = await db.query("SELECT fullname, email FROM users WHERE id = $1", [targetUserId]);
  if (!user.rows[0]) {
    const err = new Error("Usuario no encontrado");
    err.status = 404;
    throw err;
  }

  // Crear PDF
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Certificaciones - ${user.rows[0].fullname}`,
      Author: 'SPI FAM',
      Subject: 'Consolidado de Certificaciones Profesionales'
    }
  });

  // Buffer para almacenar el PDF
  const buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => console.log('✅ PDF generado exitosamente'));

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('CERTIFICACIONES PROFESIONALES', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(16).font('Helvetica').text(user.rows[0].fullname, { align: 'center' });
  doc.fontSize(12).font('Helvetica').text(user.rows[0].email, { align: 'center' });
  doc.moveDown(1);

  // Fecha de generación
  doc.fontSize(10).font('Helvetica').text(`Generado el: ${new Date().toLocaleDateString('es-ES')}`, { align: 'right' });
  doc.moveDown(1);

  // Línea separadora
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  // Contenido de certificaciones
  certifications.forEach((cert, index) => {
    // Verificar si necesitamos una nueva página
    if (doc.y > 600) {
      doc.addPage();
    }

    // Número de certificación
    doc.fontSize(14).font('Helvetica-Bold').text(`${index + 1}. ${cert.title}`, { underline: true });
    doc.moveDown(0.3);

    // Información básica
    const certInfo = [
      `Tipo: ${cert.credential_type === 'certification' ? 'Certificación' :
        cert.credential_type === 'course' ? 'Curso' :
          cert.credential_type === 'diploma' ? 'Diplomado' :
            cert.credential_type === 'title' ? 'Título' : 'Otro'}`,
      cert.issuer ? `Emisor: ${cert.issuer}` : null,
      cert.issue_date ? `Fecha de emisión: ${new Date(cert.issue_date).toLocaleDateString('es-ES')}` : null,
      cert.expiry_date ? `Fecha de expiración: ${new Date(cert.expiry_date).toLocaleDateString('es-ES')}` : null,
      cert.description ? `Descripción: ${cert.description}` : null
    ].filter(Boolean);

    doc.fontSize(11).font('Helvetica');
    certInfo.forEach(info => {
      doc.text(info);
      doc.moveDown(0.2);
    });

    // Estado de la certificación
    const statusText = cert.expiry_date ?
      (new Date(cert.expiry_date) > new Date() ? 'Vigente' : 'Expirada') : 'Sin fecha de expiración';
    doc.fontSize(10).font('Helvetica-Bold').fillColor(statusText === 'Vigente' ? 'green' : 'red')
      .text(`Estado: ${statusText}`, { align: 'right' });
    doc.fillColor('black');

    doc.moveDown(0.8);

    // Línea separadora entre certificaciones
    if (index < certifications.length - 1) {
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
    }
  });

  // Footer
  doc.fontSize(8).font('Helvetica').fillColor('gray')
    .text('Documento generado por SPI FAM - Sistema de Gestión Profesional', 50, 750, { align: 'center' });

  // Finalizar documento
  doc.end();

  // Retornar buffer cuando esté completo
  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);

      // Audit log
      db.query(`
        INSERT INTO auditoria (
          usuario_id, modulo, accion, descripcion, datos_nuevos, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        requesterUserId,
        'user-certifications',
        'pdf_generated',
        `PDF consolidado generado para usuario ${targetUserId}`,
        {
          target_user_id: targetUserId,
          requester_role: requesterRole,
          certifications_count: certifications.length
        }
      ]).catch(err => console.error('Error en audit log:', err));

      resolve({
        buffer: pdfBuffer,
        filename: `certificaciones_${user.rows[0].fullname.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
        user: user.rows[0],
        certificationsCount: certifications.length
      });
    });

    doc.on('error', reject);
  });
};

const createBulkCertifications = async (userId, bulkData, files = []) => {
  console.log('🎯 Creando certificaciones bulk para usuario:', userId, 'archivos:', files.length);

  const results = [];
  const validationErrors = [];

  // Get user info for folder creation
  const user = await db.query("SELECT email, fullname FROM users WHERE id = $1", [userId]);
  if (!user.rows[0]) {
    const err = new Error("Usuario no encontrado");
    err.status = 404;
    throw err;
  }

  // Parse metadata from form data
  let metadataArray = [];
  try {
    if (bulkData.metadata && typeof bulkData.metadata === 'string') {
      metadataArray = JSON.parse(bulkData.metadata);
    } else if (Array.isArray(bulkData.metadata)) {
      metadataArray = bulkData.metadata;
    }
  } catch (parseErr) {
    console.error('Error parsing metadata:', parseErr);
    validationErrors.push("Formato de metadata inválido");
  }

  // Validate that we have matching files and metadata
  if (files.length !== metadataArray.length) {
    validationErrors.push(`Número de archivos (${files.length}) no coincide con metadata (${metadataArray.length})`);
  }

  if (validationErrors.length > 0) {
    const err = new Error("Errores de validación: " + validationErrors.join(", "));
    err.status = 400;
    throw err;
  }

  // Create user folder if needed
  let folderId = null;
  try {
    folderId = await resolveUserCertificationsFolder(user.rows[0].email);
  } catch (folderErr) {
    console.warn('Error creando carpeta Drive, continuando sin archivos:', folderErr);
  }

  // Process each file and metadata pair
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const metadata = metadataArray[i];

    try {
      // Validate individual file
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        results.push({
          index: i,
          filename: file.originalname,
          status: 'error',
          error: 'Tipo de archivo no permitido. Solo se aceptan PDF, JPG, PNG, WEBP'
        });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        results.push({
          index: i,
          filename: file.originalname,
          status: 'error',
          error: `Archivo demasiado grande. Máximo ${MAX_FILE_SIZE / 1024 / 1024}MB`
        });
        continue;
      }

      // Validate metadata
      const certValidation = validateCertificationData(metadata);
      if (certValidation.length > 0) {
        results.push({
          index: i,
          filename: file.originalname,
          status: 'error',
          error: 'Datos inválidos: ' + certValidation.join(', ')
        });
        continue;
      }

      let driveInfo = {};
      if (folderId) {
        try {
          const driveResult = await uploadFileToDrive(file, `cert-bulk-${Date.now()}-${file.originalname}`, folderId);
          driveInfo = {
            drive_file_id: driveResult.id,
            drive_folder_id: folderId,
            file_url: driveResult.webViewLink
          };
        } catch (driveErr) {
          console.error('Error subiendo archivo a Drive:', driveErr);
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
        RETURNING id
      `;

      const values = [
        userId,
        metadata.title.trim(),
        metadata.issuer?.trim() || null,
        metadata.issue_date || null,
        metadata.expiry_date || null,
        metadata.credential_type || 'certification',
        metadata.description?.trim() || null,
        driveInfo.drive_file_id || null,
        driveInfo.drive_folder_id || null,
        driveInfo.file_url || null,
        metadata.metadata || {}
      ];

      const result = await db.query(insertQuery, values);
      const certificationId = result.rows[0].id;

      results.push({
        index: i,
        filename: file.originalname,
        created_id: certificationId,
        status: 'success'
      });

      // Audit log
      await logAction({
        usuario_id: userId,
        usuario_email: user.rows[0].email,
        rol: null,
        modulo: "user-certifications",
        accion: "certification_bulk_created",
        descripcion: `Certificación bulk creada: ${metadata.title}`,
        datos_nuevos: { ...metadata, id: certificationId, bulk_index: i }
      });

    } catch (itemErr) {
      console.error(`Error procesando archivo ${i}:`, itemErr);
      results.push({
        index: i,
        filename: file.originalname,
        status: 'error',
        error: itemErr.message || 'Error interno procesando archivo'
      });
    }
  }

  const createdCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'error').length;

  console.log(`✅ Bulk upload completado: ${createdCount} exitosos, ${failedCount} fallidos`);

  return {
    results,
    created_count: createdCount,
    failed_count: failedCount,
    total_processed: files.length
  };
};

module.exports = {
  createCertification,
  getUserCertifications,
  getCertificationsByUserId,
  softDeleteCertification,
  generateConsolidatedCertificationsPDF,
  createBulkCertifications
};
