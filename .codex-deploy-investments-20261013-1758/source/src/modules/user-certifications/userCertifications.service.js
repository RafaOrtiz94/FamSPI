const db = require("../../config/db");
const logger = require("../../config/logger");
const {
  uploadFileToDrive,
  ensureFolderPath,
  getFileMetadata,
  moveFileToFolder,
} = require("../../utils/drive");
const { logAction } = require("../../utils/audit");
const crypto = require("crypto");
const { PDFDocument: PdfLibDocument, StandardFonts, rgb } = require("pdf-lib");
const QRCode = require("qrcode");
const {
  hasCollaboratorQualificationsTable,
  listQualificationsByUserId,
  softDeleteQualificationByLegacyId,
  syncLegacyCertificationToQualification,
} = require("../shared/collaboratorQualifications");

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const resolveCertificationsDriveRootId = () =>
  process.env.DRIVE_PROFILE_FOLDER_ID ||
    process.env.DRIVE_DOCS_FOLDER_ID ||
    process.env.DRIVE_ROOT_FOLDER_ID ||
    process.env.DRIVE_FOLDER_ID;

const resolveUserCertificationsFolder = async (userEmail) => {
  const base = resolveCertificationsDriveRootId();
  if (!base) return null;

  const userFolderName = userEmail || `user-na`;
  const certsFolder = await ensureFolderPath(
    ["Usuarios", userFolderName, "Certificaciones"],
    base,
  );
  return certsFolder?.id || null;
};

const repairCertificationDriveStorage = async ({
  certificationId,
  userEmail,
  driveFileId,
  dbExecutor = db,
}) => {
  if (!driveFileId || !userEmail) {
    return { repaired: false, reason: "missing_drive_file_or_email" };
  }

  const expectedFolderId = await resolveUserCertificationsFolder(userEmail);
  if (!expectedFolderId) {
    return { repaired: false, reason: "missing_drive_root" };
  }

  const currentFile = await getFileMetadata(driveFileId, "id,parents,webViewLink");
  const currentParents = Array.isArray(currentFile?.parents)
    ? currentFile.parents.filter(Boolean)
    : [];

  if (currentParents.includes(expectedFolderId)) {
    const updatedLink = currentFile?.webViewLink || null;
    if (updatedLink && certificationId) {
      await dbExecutor.query(
        `UPDATE user_certifications
         SET drive_folder_id = $2,
             file_url = COALESCE($3, file_url),
             updated_at = NOW()
         WHERE id = $1`,
        [certificationId, expectedFolderId, updatedLink],
      );
    }
    return {
      repaired: false,
      reason: "already_in_expected_folder",
      expectedFolderId,
      fileUrl: updatedLink,
    };
  }

  const moved = await moveFileToFolder(driveFileId, expectedFolderId);
  const nextLink = moved?.webViewLink || currentFile?.webViewLink || null;

  if (certificationId) {
    await dbExecutor.query(
      `UPDATE user_certifications
       SET drive_folder_id = $2,
           file_url = COALESCE($3, file_url),
           updated_at = NOW()
       WHERE id = $1`,
      [certificationId, expectedFolderId, nextLink],
    );
  }

  return {
    repaired: true,
    expectedFolderId,
    previousParents: currentParents,
    currentParents: moved?.parents || [expectedFolderId],
    fileUrl: nextLink,
  };
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

const getLegacyCertificationsByUserId = async (userId, includeInactive = false) => {
  const query = `
    SELECT *
    FROM user_certifications
    WHERE user_id = $1 ${includeInactive ? "" : "AND is_active = true"}
    ORDER BY created_at DESC
  `;
  const result = await db.query(query, [userId]);
  return result.rows.map(enrichCertification);
};

const getCentralCertificationsByUserId = async (userId) => {
  const qualificationState = await listQualificationsByUserId(userId);
  if (!qualificationState.qualifications.length) {
    return {
      source: qualificationState.source,
      certifications: [],
      summary: summarizeCertifications([]),
    };
  }

  const certifications = qualificationState.qualifications.map(
    mapQualificationToCertification,
  );
  return {
    source: qualificationState.source,
    certifications,
    summary: summarizeCertifications(certifications),
  };
};

const getCertificationUser = async (userId) => {
  const result = await db.query(
    "SELECT id, fullname, email FROM users WHERE id = $1",
    [userId],
  );
  return result.rows[0] || null;
};

const getCentralQualificationByDisplayedId = async (displayedId) => {
  if (!(await hasCollaboratorQualificationsTable())) return null;

  const result = await db.query(
    `SELECT *
     FROM collaborator_qualifications
     WHERE id = $1
        OR metadata->'legacy'->>'legacy_id' = $2
     ORDER BY
       CASE WHEN metadata->'legacy'->>'legacy_id' = $2 THEN 0 ELSE 1 END,
       id DESC
     LIMIT 1`,
    [displayedId, String(displayedId)],
  );

  return result.rows[0] || null;
};

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

const mapQualificationToCertification = (qualification = {}) => {
  const metadata = qualification.metadata || {};
  return enrichCertification({
    id:
      Number(metadata?.legacy?.legacy_id || 0) ||
      Number(qualification.id || 0),
    qualification_id: qualification.id,
    user_id: qualification.user_id,
    title: qualification.title,
    issuer: qualification.issuer,
    issue_date: qualification.issue_date,
    expiry_date: qualification.expiry_date,
    credential_type:
      qualification.qualification_type === "third_level_title" ||
      qualification.qualification_type === "fourth_level_title"
        ? "title"
        : qualification.qualification_type === "senescyt_record"
          ? "other"
          : "certification",
    description: metadata?.description || null,
    drive_file_id: qualification.drive_file_id || null,
    file_url: qualification.drive_url || null,
    metadata,
    source_of_truth: "collaborator_qualifications",
  });
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

  await syncLegacyCertificationToQualification({
    legacyCertification: certification,
    uploadedBy: userId,
  });

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
  if (!includeInactive) {
    const centralState = await getCentralCertificationsByUserId(userId);
    if (centralState.certifications.length > 0) {
      return {
        certifications: centralState.certifications,
        summary: centralState.summary,
      };
    }
  }

  const certifications = await getLegacyCertificationsByUserId(userId, includeInactive);
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

  const centralState = await getCentralCertificationsByUserId(targetUserId);
  const certifications = centralState.certifications.length > 0
    ? centralState.certifications
    : await getLegacyCertificationsByUserId(targetUserId, false);

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
  const centralAllowedRoles = ['acp_comercial', 'talento_humano', 'gerencia', 'gerencia_general'];
  const qualification = await getCentralQualificationByDisplayedId(certificationId);

  if (qualification) {
    const certification = mapQualificationToCertification(qualification);
    if (certification.user_id !== userId && !centralAllowedRoles.includes(requesterRole)) {
      const err = new Error("No tienes permisos para eliminar esta certificaciÃ³n");
      err.status = 403;
      throw err;
    }

    await db.query(
      `UPDATE collaborator_qualifications
       SET is_active = false,
           updated_at = NOW()
       WHERE id = $1`,
      [qualification.id]
    );

    const legacyId = qualification?.metadata?.legacy?.legacy_id || null;
    if (legacyId) {
      await db.query(
        "UPDATE user_certifications SET is_active = false, updated_at = NOW() WHERE id = $1",
        [legacyId]
      );
      await softDeleteQualificationByLegacyId(legacyId);
    }

    await logAction({
      usuario_id: userId,
      usuario_email: null,
      rol: requesterRole,
      modulo: "user-certifications",
      accion: "certification_deleted",
      descripcion: `CertificaciÃ³n eliminada: ${certification.title}`,
      datos_anteriores: certification
    });

    return { success: true, message: "CertificaciÃ³n eliminada correctamente" };
  }

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
  await softDeleteQualificationByLegacyId(certificationId);

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

const CREDENTIAL_TYPE_LABELS = {
  certification: "Certificacion",
  course: "Curso",
  diploma: "Diplomado",
  title: "Titulo",
  other: "Otro",
};

const normalizeUserId = (value) => {
  const normalized = Number.parseInt(value, 10);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    const err = new Error("ID de usuario invalido");
    err.status = 400;
    throw err;
  }
  return normalized;
};

const formatDateLabel = (value, fallback = "No registrada") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const buildCertificationFileLink = (cert = {}) => {
  const fileUrl = String(cert.file_url || "").trim();
  if (fileUrl) return fileUrl;
  const driveFileId = String(cert.drive_file_id || "").trim();
  if (!driveFileId) return null;
  return `https://drive.google.com/file/d/${driveFileId}/view`;
};

const truncateText = (value, max = 95) => {
  const parsed = String(value || "");
  if (parsed.length <= max) return parsed;
  return `${parsed.slice(0, max - 3)}...`;
};

const drawLabelValue = ({ page, x, y, label, value, fontBold, fontRegular, size = 11 }) => {
  page.drawText(`${label}:`, {
    x,
    y,
    size,
    font: fontBold,
    color: rgb(0.11, 0.16, 0.24),
  });
  page.drawText(String(value || "No registrado"), {
    x: x + 132,
    y,
    size,
    font: fontRegular,
    color: rgb(0.17, 0.23, 0.33),
  });
};

/**
 * Genera un dossier PDF con todas las certificaciones activas del colaborador.
 * Cada certificacion se renderiza en su propia pagina, incluyendo link/QR a Drive.
 *
 * @param {number|string} userId
 * @returns {Promise<{buffer: Buffer, filename: string, user: {id:number, fullname:string, email:string}, certificationsCount: number}>}
 */
const generateCertificationsDossier = async (userId) => {
  const targetUserId = normalizeUserId(userId);

  const result = await db.query(
    `
      SELECT
        u.id AS user_id,
        u.fullname,
        u.email,
        uc.id,
        uc.title,
        uc.issuer,
        uc.issue_date,
        uc.expiry_date,
        uc.credential_type,
        uc.description,
        uc.file_url,
        uc.drive_file_id,
        uc.created_at
      FROM users u
      LEFT JOIN user_certifications uc
        ON uc.user_id = u.id
       AND uc.is_active = true
      WHERE u.id = $1
      ORDER BY uc.issue_date DESC NULLS LAST, uc.created_at DESC NULLS LAST
    `,
    [targetUserId]
  );

  if (!result.rows.length) {
    const err = new Error("Usuario no encontrado");
    err.status = 404;
    throw err;
  }

  const user = {
    id: result.rows[0].user_id,
    fullname: result.rows[0].fullname || "Sin nombre",
    email: result.rows[0].email || "",
  };
  const certifications = result.rows.filter((row) => row.id).map((row) => enrichCertification(row));

  if (!certifications.length) {
    const err = new Error("El usuario no tiene certificaciones activas");
    err.status = 404;
    throw err;
  }

  const pdfDoc = await PdfLibDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (let index = 0; index < certifications.length; index += 1) {
    const cert = certifications[index];
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    let y = height - 54;
    page.drawText("DOSSIER DE CERTIFICACIONES", {
      x: 44,
      y,
      size: 17,
      font: fontBold,
      color: rgb(0.11, 0.16, 0.24),
    });

    y -= 24;
    page.drawText(`${index + 1}. ${cert.title || "Sin titulo"}`, {
      x: 44,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.13, 0.2, 0.31),
    });

    y -= 22;
    drawLabelValue({
      page,
      x: 44,
      y,
      label: "Colaborador",
      value: `${user.fullname} (${user.email || "sin correo"})`,
      fontBold,
      fontRegular,
    });

    y -= 18;
    drawLabelValue({
      page,
      x: 44,
      y,
      label: "Tipo",
      value: CREDENTIAL_TYPE_LABELS[cert.credential_type] || CREDENTIAL_TYPE_LABELS.other,
      fontBold,
      fontRegular,
    });

    y -= 18;
    drawLabelValue({
      page,
      x: 44,
      y,
      label: "Emisor",
      value: cert.issuer || "No registrado",
      fontBold,
      fontRegular,
    });

    y -= 18;
    drawLabelValue({
      page,
      x: 44,
      y,
      label: "Fecha de Emision",
      value: formatDateLabel(cert.issue_date),
      fontBold,
      fontRegular,
    });

    y -= 18;
    drawLabelValue({
      page,
      x: 44,
      y,
      label: "Fecha de Vencimiento",
      value: cert.expiry_date ? formatDateLabel(cert.expiry_date) : "Sin vencimiento",
      fontBold,
      fontRegular,
    });

    y -= 18;
    drawLabelValue({
      page,
      x: 44,
      y,
      label: "Estado",
      value: cert.status_label || "Sin estado",
      fontBold,
      fontRegular,
    });

    y -= 30;
    page.drawText("Documento (Drive):", {
      x: 44,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.11, 0.16, 0.24),
    });

    y -= 16;
    const fileLink = buildCertificationFileLink(cert);
    page.drawText(truncateText(fileLink || "Sin enlace disponible", 96), {
      x: 44,
      y,
      size: 10,
      font: fontRegular,
      color: fileLink ? rgb(0.07, 0.31, 0.66) : rgb(0.32, 0.37, 0.45),
    });

    if (fileLink) {
      try {
        const qrDataUrl = await QRCode.toDataURL(fileLink, { width: 180, margin: 1 });
        const base64Png = String(qrDataUrl).split(",")[1];
        if (base64Png) {
          const qrImage = await pdfDoc.embedPng(Buffer.from(base64Png, "base64"));
          page.drawImage(qrImage, {
            x: width - 158,
            y: 110,
            width: 92,
            height: 92,
          });
          page.drawText("Escanear para abrir", {
            x: width - 164,
            y: 96,
            size: 8,
            font: fontRegular,
            color: rgb(0.29, 0.35, 0.44),
          });
        }
      } catch (qrError) {
        logger.warn({ certId: cert.id, qrError: qrError?.message }, "No se pudo generar QR de certificacion");
      }
    }

    page.drawText(`Generado: ${formatDateLabel(new Date(), "-")}`, {
      x: 44,
      y: 32,
      size: 9,
      font: fontRegular,
      color: rgb(0.39, 0.44, 0.52),
    });
    page.drawText(`Pagina ${index + 1} de ${certifications.length}`, {
      x: width - 138,
      y: 32,
      size: 9,
      font: fontRegular,
      color: rgb(0.39, 0.44, 0.52),
    });
  }

  const pdfBuffer = Buffer.from(await pdfDoc.save());
  const safeName = String(user.fullname || "usuario")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return {
    buffer: pdfBuffer,
    filename: `dossier_certificaciones_${safeName || "usuario"}_${new Date().toISOString().split("T")[0]}.pdf`,
    user,
    certificationsCount: certifications.length,
  };
};

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
        RETURNING *
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
      const certification = result.rows[0];
      const certificationId = certification.id;

      await syncLegacyCertificationToQualification({
        legacyCertification: certification,
        uploadedBy: userId,
      });

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

const PROFESSIONAL_PAGE_SIZE_A4 = [595.28, 841.89];
const PROFESSIONAL_DOSSIER_ALLOWED_ROLES = new Set(["acp_comercial", "talento_humano", "gerencia", "gerencia_general"]);

const dossierToSafeMetadata = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

const dossierFirstNonEmptyValue = (values = []) => {
  for (const value of values) {
    const parsed = String(value || "").trim();
    if (parsed) return parsed;
  }
  return "";
};

const dossierDateKey = (value) => {
  if (!value) return "na";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "na";
  return parsed.toISOString().slice(0, 10).replace(/-/g, "");
};

const dossierDrawField = ({
  page,
  x = 44,
  y = 720,
  label,
  value,
  fontBold,
  fontRegular,
  size = 11,
  labelOffset = 152,
}) => {
  page.drawText(`${label}:`, {
    x,
    y,
    size,
    font: fontBold,
    color: rgb(0.11, 0.16, 0.24),
  });
  page.drawText(String(value || "No registrado"), {
    x: x + labelOffset,
    y,
    size,
    font: fontRegular,
    color: rgb(0.17, 0.23, 0.33),
  });
};

const dossierDrawDivider = (page, { x = 44, y = 700, width = 508 } = {}) => {
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness: 1,
    color: rgb(0.87, 0.9, 0.94),
  });
};

const dossierBuildVerificationCode = ({ cert = {}, user = {}, dossierSeed = "" }) => {
  const metadata = dossierToSafeMetadata(cert.metadata);
  const metadataCode = dossierFirstNonEmptyValue([
    metadata.verification_code,
    metadata.verificationCode,
    metadata.codigo_verificacion,
    metadata.credential_code,
    metadata.credentialCode,
    metadata.credential_id,
    metadata.credentialId,
    metadata.code,
    metadata.folio,
  ]);
  if (metadataCode) return metadataCode;

  const digest = crypto
    .createHash("sha256")
    .update(`${dossierSeed}|${user.id}|${cert.id}|${dossierDateKey(cert.issue_date)}|${cert.title || ""}`)
    .digest("hex")
    .toUpperCase();

  return `SPI-CERT-${String(user.id || "U0").padStart(4, "0")}-${String(cert.id || "C0").padStart(5, "0")}-${digest.slice(0, 8)}`;
};

const dossierBuildVerificationTarget = ({ fileLink, verificationCode }) => {
  if (fileLink) {
    const separator = fileLink.includes("?") ? "&" : "?";
    return `${fileLink}${separator}vc=${encodeURIComponent(verificationCode)}`;
  }
  return `SPI-CERT:${verificationCode}`;
};

/**
 * Motor profesional de expediente consolidado de certificaciones.
 * Incluye metadatos de vigencia y codigo de verificacion por certificacion.
 *
 * @param {number|string} userId
 * @param {{ requesterUserId?: number, requesterRole?: string }} [options]
 */
const buildProfessionalCertificationsDossier = async (userId, options = {}) => {
  const targetUserId = normalizeUserId(userId);
  const requesterUserId = options?.requesterUserId ? normalizeUserId(options.requesterUserId) : null;
  const requesterRole = String(options?.requesterRole || "").trim().toLowerCase() || null;

  const user = await getCertificationUser(targetUserId);
  if (!user) {
    const err = new Error("Usuario no encontrado");
    err.status = 404;
    throw err;
  }

  const centralState = await getCentralCertificationsByUserId(targetUserId);
  const certifications = centralState.certifications.length > 0
    ? centralState.certifications
    : await getLegacyCertificationsByUserId(targetUserId, false);

  if (!certifications.length) {
    const err = new Error("El usuario no tiene certificaciones activas");
    err.status = 404;
    throw err;
  }

  const generatedAt = new Date();
  const summary = summarizeCertifications(certifications);
  const dossierSeed = crypto
    .createHash("sha1")
    .update(`${targetUserId}|${generatedAt.toISOString()}|${certifications.length}`)
    .digest("hex")
    .toUpperCase();
  const dossierCode = `SPI-DOS-${String(targetUserId).padStart(4, "0")}-${dossierSeed.slice(0, 10)}`;

  const pdfDoc = await PdfLibDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const totalPages = certifications.length + 1;

  const cover = pdfDoc.addPage(PROFESSIONAL_PAGE_SIZE_A4);
  const { width: coverWidth, height: coverHeight } = cover.getSize();
  let coverY = coverHeight - 72;

  cover.drawText("DOSSIER PROFESIONAL", {
    x: 44,
    y: coverY,
    size: 14,
    font: fontBold,
    color: rgb(0.15, 0.22, 0.34),
  });
  coverY -= 24;
  cover.drawText("CONSOLIDADO DE CERTIFICACIONES", {
    x: 44,
    y: coverY,
    size: 20,
    font: fontBold,
    color: rgb(0.07, 0.14, 0.26),
  });
  coverY -= 14;
  dossierDrawDivider(cover, { y: coverY });
  coverY -= 34;

  dossierDrawField({ page: cover, y: coverY, label: "Colaborador", value: user.fullname, fontBold, fontRegular });
  coverY -= 20;
  dossierDrawField({ page: cover, y: coverY, label: "Correo", value: user.email || "No registrado", fontBold, fontRegular });
  coverY -= 20;
  dossierDrawField({ page: cover, y: coverY, label: "Codigo de dossier", value: dossierCode, fontBold, fontRegular });
  coverY -= 20;
  dossierDrawField({ page: cover, y: coverY, label: "Generado el", value: generatedAt.toLocaleString("es-EC"), fontBold, fontRegular });
  coverY -= 32;

  cover.drawText("RESUMEN DE VIGENCIA", {
    x: 44,
    y: coverY,
    size: 12,
    font: fontBold,
    color: rgb(0.09, 0.15, 0.25),
  });
  coverY -= 20;
  dossierDrawField({ page: cover, y: coverY, label: "Total certificaciones", value: summary.total, fontBold, fontRegular });
  coverY -= 18;
  dossierDrawField({ page: cover, y: coverY, label: "Vigentes", value: summary.active, fontBold, fontRegular });
  coverY -= 18;
  dossierDrawField({ page: cover, y: coverY, label: "Permanentes", value: summary.permanent, fontBold, fontRegular });
  coverY -= 18;
  dossierDrawField({ page: cover, y: coverY, label: "Por vencer", value: summary.expiring_soon, fontBold, fontRegular });
  coverY -= 18;
  dossierDrawField({ page: cover, y: coverY, label: "Expiradas", value: summary.expired, fontBold, fontRegular });

  cover.drawText("Documento emitido por SPI FAM - Talento Humano", {
    x: 44,
    y: 40,
    size: 9,
    font: fontRegular,
    color: rgb(0.39, 0.44, 0.52),
  });
  cover.drawText(`Pagina 1 de ${totalPages}`, {
    x: coverWidth - 138,
    y: 40,
    size: 9,
    font: fontRegular,
    color: rgb(0.39, 0.44, 0.52),
  });

  for (let index = 0; index < certifications.length; index += 1) {
    const cert = certifications[index];
    const metadata = dossierToSafeMetadata(cert.metadata);
    const verificationCode = dossierBuildVerificationCode({ cert, user, dossierSeed });
    const fileLink = buildCertificationFileLink(cert);
    const verificationTarget = dossierBuildVerificationTarget({ fileLink, verificationCode });
    const externalReference = dossierFirstNonEmptyValue([
      metadata.credential_id,
      metadata.credentialId,
      metadata.credential_reference,
      metadata.reference,
      metadata.folio,
    ]);

    const page = pdfDoc.addPage(PROFESSIONAL_PAGE_SIZE_A4);
    const { width, height } = page.getSize();
    let y = height - 58;

    page.drawText("CERTIFICACION", {
      x: 44,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0.23, 0.3, 0.4),
    });
    y -= 22;
    page.drawText(`${index + 1}. ${cert.title || "Sin titulo"}`, {
      x: 44,
      y,
      size: 18,
      font: fontBold,
      color: rgb(0.07, 0.14, 0.26),
    });
    y -= 14;
    dossierDrawDivider(page, { y });

    y -= 28;
    dossierDrawField({ page, y, label: "Colaborador", value: user.fullname, fontBold, fontRegular });
    y -= 18;
    dossierDrawField({
      page,
      y,
      label: "Tipo",
      value: CREDENTIAL_TYPE_LABELS[cert.credential_type] || CREDENTIAL_TYPE_LABELS.other,
      fontBold,
      fontRegular,
    });
    y -= 18;
    dossierDrawField({ page, y, label: "Emisor", value: cert.issuer || "No registrado", fontBold, fontRegular });
    y -= 18;
    dossierDrawField({ page, y, label: "Fecha de emision", value: formatDateLabel(cert.issue_date), fontBold, fontRegular });
    y -= 18;
    dossierDrawField({
      page,
      y,
      label: "Fecha de vencimiento",
      value: cert.expiry_date ? formatDateLabel(cert.expiry_date) : "Sin vencimiento",
      fontBold,
      fontRegular,
    });
    y -= 18;
    dossierDrawField({ page, y, label: "Estado de vigencia", value: cert.status_label || "Sin estado", fontBold, fontRegular });
    y -= 18;
    dossierDrawField({
      page,
      y,
      label: "Dias para vencimiento",
      value: cert.days_until_expiry == null ? "No aplica" : cert.days_until_expiry,
      fontBold,
      fontRegular,
    });
    y -= 18;
    dossierDrawField({
      page,
      y,
      label: "Codigo de verificacion",
      value: verificationCode,
      fontBold,
      fontRegular,
      size: 10,
    });
    y -= 18;
    dossierDrawField({ page, y, label: "ID interno", value: cert.id, fontBold, fontRegular });

    if (externalReference) {
      y -= 18;
      dossierDrawField({
        page,
        y,
        label: "Referencia externa",
        value: externalReference,
        fontBold,
        fontRegular,
      });
    }

    if (cert.description) {
      y -= 24;
      page.drawText("Descripcion:", {
        x: 44,
        y,
        size: 11,
        font: fontBold,
        color: rgb(0.11, 0.16, 0.24),
      });
      y -= 14;
      page.drawText(truncateText(cert.description, 310), {
        x: 44,
        y,
        size: 10,
        font: fontRegular,
        color: rgb(0.17, 0.23, 0.33),
        maxWidth: 380,
        lineHeight: 12,
      });
    }

    y -= 28;
    page.drawText("Documento / evidencia:", {
      x: 44,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.11, 0.16, 0.24),
    });
    y -= 16;
    page.drawText(truncateText(fileLink || "Sin enlace disponible", 96), {
      x: 44,
      y,
      size: 10,
      font: fontRegular,
      color: fileLink ? rgb(0.07, 0.31, 0.66) : rgb(0.32, 0.37, 0.45),
    });

    try {
      const qrDataUrl = await QRCode.toDataURL(verificationTarget, { width: 180, margin: 1 });
      const base64Png = String(qrDataUrl).split(",")[1];
      if (base64Png) {
        const qrImage = await pdfDoc.embedPng(Buffer.from(base64Png, "base64"));
        page.drawImage(qrImage, {
          x: width - 158,
          y: 110,
          width: 92,
          height: 92,
        });
        page.drawText("Escanear para verificar", {
          x: width - 170,
          y: 96,
          size: 8,
          font: fontRegular,
          color: rgb(0.29, 0.35, 0.44),
        });
      }
    } catch (qrError) {
      logger.warn({ certId: cert.id, qrError: qrError?.message }, "No se pudo generar QR de certificacion");
    }

    page.drawText(`Generado: ${generatedAt.toLocaleString("es-EC")}`, {
      x: 44,
      y: 32,
      size: 9,
      font: fontRegular,
      color: rgb(0.39, 0.44, 0.52),
    });
    page.drawText(`Pagina ${index + 2} de ${totalPages}`, {
      x: width - 138,
      y: 32,
      size: 9,
      font: fontRegular,
      color: rgb(0.39, 0.44, 0.52),
    });
  }

  const pdfBuffer = Buffer.from(await pdfDoc.save());
  const safeName = String(user.fullname || "usuario")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  if (requesterUserId) {
    try {
      await logAction({
        usuario_id: requesterUserId,
        rol: requesterRole || null,
        modulo: "user-certifications",
        accion: "certifications_dossier_generated",
        descripcion: `Dossier de certificaciones generado para usuario ${targetUserId}`,
        datos_nuevos: {
          target_user_id: targetUserId,
          certifications_count: certifications.length,
          dossier_code: dossierCode,
        },
      });
    } catch (auditError) {
      logger.warn({ auditError, targetUserId }, "No se pudo registrar auditoria del dossier de certificaciones");
    }
  }

  return {
    buffer: pdfBuffer,
    filename: `dossier_certificaciones_${safeName || "usuario"}_${generatedAt.toISOString().split("T")[0]}.pdf`,
    user,
    certificationsCount: certifications.length,
    dossierCode,
  };
};

const generateConsolidatedCertificationsPDFV2 = async (targetUserId, requesterUserId, requesterRole) => {
  const normalizedTargetUserId = normalizeUserId(targetUserId);
  const normalizedRequesterUserId = normalizeUserId(requesterUserId);
  const normalizedRole = String(requesterRole || "").trim().toLowerCase();
  const isSelfRequest = normalizedRequesterUserId === normalizedTargetUserId;
  const canGenerate = PROFESSIONAL_DOSSIER_ALLOWED_ROLES.has(normalizedRole);

  if (!isSelfRequest && !canGenerate) {
    const err = new Error("No tienes permisos para acceder a las certificaciones de este usuario");
    err.status = 403;
    throw err;
  }

  return buildProfessionalCertificationsDossier(normalizedTargetUserId, {
    requesterUserId: normalizedRequesterUserId,
    requesterRole: normalizedRole,
  });
};

module.exports = {
  formatDateLabel,
  createCertification,
  getUserCertifications,
  getCertificationsByUserId,
  softDeleteCertification,
  generateCertificationsDossier: buildProfessionalCertificationsDossier,
  generateConsolidatedCertificationsPDF: generateConsolidatedCertificationsPDFV2,
  createBulkCertifications,
  resolveUserCertificationsFolder,
  repairCertificationDriveStorage,
};
