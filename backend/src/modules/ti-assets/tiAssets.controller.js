const { asyncHandler } = require("../../middlewares/asyncHandler");
const svc = require("./tiAssets.service");
const reportSvc = require("./tiAssets.report");
const { TI_ROLES } = require("./tiAssets.service");
const { uploadFileToDrive, ensureFolderPath } = require("../../utils/drive");

function resolvePublicBaseUrl(req) {
  const proto = req.get("x-forwarded-proto") || req.protocol || "https";
  const host = req.get("x-forwarded-host") || req.get("host") || "";
  return host ? `${proto}://${host}` : "";
}

exports.listAssets = asyncHandler(async (req, res) => {
  const data = await svc.listAssets({
    status: req.query?.status,
    q: req.query?.q,
    custodyType: req.query?.custody_type,
    clientId: req.query?.client_id,
    warehouseCode: req.query?.warehouse_code,
    publicBaseUrl: resolvePublicBaseUrl(req),
  });
  res.json({ ok: true, total: data.length, data });
});

exports.listCustodySummary = asyncHandler(async (_req, res) => {
  const data = await svc.listCustodySummary();
  res.json({ ok: true, data });
});

exports.getPublicAssetByCode = asyncHandler(async (req, res) => {
  const data = await svc.getPublicAssetByCode(req.params.assetCode, {
    publicBaseUrl: resolvePublicBaseUrl(req),
  });
  res.json({ ok: true, data });
});

exports.getPublicInitialConditionPhoto = asyncHandler(async (req, res) => {
  const { buffer, filename, mimeType } = await svc.getInitialConditionPhotoFileByCode(
    req.params.assetCode,
    req.params.photoIndex,
  );
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(buffer);
});

exports.listAssetClients = asyncHandler(async (req, res) => {
  const data = await svc.listAssetClients({ q: req.query?.q, limit: req.query?.limit });
  res.json({ ok: true, total: data.length, data });
});

exports.listCustodyHistory = asyncHandler(async (req, res) => {
  const data = await svc.listAssetCustodyHistory(req.params.id);
  res.json({ ok: true, total: data.length, data });
});

exports.moveAssetCustody = asyncHandler(async (req, res) => {
  const data = await svc.moveAssetCustody({
    assetId: req.params.id,
    ...req.body,
    userId: req.user?.id || null,
  });
  res.status(200).json({ ok: true, data });
});

exports.createAsset = asyncHandler(async (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);
  const conditionPhotos = files.map((file, index) => ({
    buffer: file.buffer,
    filename: file.originalname || `condicion-inicial-${index + 1}.jpg`,
    mimeType: file.mimetype || "image/jpeg",
  }));
  const data = await svc.createAsset({ data: req.body || {}, conditionPhotos, userId: req.user?.id || null });
  res.status(201).json({ ok: true, data });
});

exports.uploadInitialConditionPhotos = asyncHandler(async (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);
  const conditionPhotos = files.map((file, index) => ({
    buffer: file.buffer,
    filename: file.originalname || `condicion-inicial-${index + 1}.jpg`,
    mimeType: file.mimetype || "image/jpeg",
  }));
  const data = await svc.uploadInitialConditionPhotos({
    assetId: req.params.id,
    conditionPhotos,
    userId: req.user?.id || null,
  });
  res.status(200).json({ ok: true, data });
});

exports.updateAsset = asyncHandler(async (req, res) => {
  const data = await svc.updateAsset({ assetId: req.params.id, data: req.body || {}, userId: req.user?.id || null });
  res.status(200).json({ ok: true, data });
});

const TI_EVIDENCE_FOLDER = process.env.TI_EVIDENCE_FOLDER_ID || null;

async function resolveEvidenceUpload(file) {
  if (!file) return { evidenceDriveFileId: null, evidenceFileUrl: null };
  let folderId = TI_EVIDENCE_FOLDER;
  if (!folderId) {
    const root = process.env.DRIVE_ROOT_FOLDER_ID;
    const folder = await ensureFolderPath(["Activos TI", "Evidencias sin acta"], root);
    folderId = folder.id;
  }
  const result = await uploadFileToDrive(file, `evidencia-${Date.now()}-${file.originalname}`, folderId);
  return { evidenceDriveFileId: result?.id || null, evidenceFileUrl: result?.webViewLink || null };
}

exports.assignAsset = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const skipActa = payload.skip_acta === true || payload.skip_acta === "true";
  let evidenceDriveFileId = null;
  let evidenceFileUrl = null;
  if (skipActa && req.file) {
    ({ evidenceDriveFileId, evidenceFileUrl } = await resolveEvidenceUpload(req.file));
  }
  const data = await svc.assignAsset({
    assetId: req.params.id,
    assignedToUserId: payload.assigned_to_user_id || null,
    reason: payload.reason || null,
    userId: req.user?.id || null,
    recipientNombre: payload.recipient_nombre || null,
    recipientCedula: payload.recipient_cedula || null,
    recipientCargo:  payload.recipient_cargo  || null,
    actaItems: Array.isArray(payload.acta_items) && payload.acta_items.length ? payload.acta_items : null,
    skipActa,
    evidenceDriveFileId,
    evidenceFileUrl,
  });

  if (data.acta_id) {
    svc.queueTiActaPdfGeneration(data.acta_id);
  }

  res.status(200).json({ ok: true, data });
});

exports.assignMultipleAssets = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const skipActa = payload.skip_acta === true || payload.skip_acta === "true";
  let evidenceDriveFileId = null;
  let evidenceFileUrl = null;
  if (skipActa && req.file) {
    ({ evidenceDriveFileId, evidenceFileUrl } = await resolveEvidenceUpload(req.file));
  }
  const data = await svc.assignMultipleAssets({
    assetIds: Array.isArray(payload.asset_ids) ? payload.asset_ids : [],
    assignedToUserId: payload.assigned_to_user_id || null,
    reason: payload.reason || null,
    userId: req.user?.id || null,
    recipientNombre: payload.recipient_nombre || null,
    recipientCedula: payload.recipient_cedula || null,
    recipientCargo:  payload.recipient_cargo  || null,
    acta_items: Array.isArray(payload.acta_items) ? payload.acta_items : null,
    skipActa,
    evidenceDriveFileId,
    evidenceFileUrl,
  });

  if (data.acta_id) {
    svc.queueTiActaPdfGeneration(data.acta_id);
  }

  res.status(200).json({ ok: true, data });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const userRole = req.user?.role || '';

  // FASE 4: Validar que solo TI puede cambiar a ciertos estados
  const restrictedStatuses = ['damaged', 'in_maintenance', 'retired', 'unassigned', 'available'];
  if (restrictedStatuses.includes(payload.status) && !TI_ROLES.includes(userRole)) {
    return res.status(403).json({
      ok: false,
      message: `Solo TI puede cambiar estado a "${payload.status}"`
    });
  }

  const data = await svc.updateAssetStatus({
    assetId: req.params.id,
    status: payload.status,
    reason: payload.reason || null,
    userId: req.user?.id || null,
  });
  res.status(200).json({ ok: true, data });
});

exports.listHistory = asyncHandler(async (req, res) => {
  const data = await svc.listAssetHistory(req.params.id);
  res.status(200).json({ ok: true, total: data.length, data });
});

exports.listAssignmentsHistory = asyncHandler(async (req, res) => {
  const data = await svc.listAssetAssignmentsHistory(req.params.id);
  res.status(200).json({ ok: true, total: data.length, data });
});

exports.uploadAssignmentEvidence = asyncHandler(async (req, res) => {
  if (!req.file) { return res.status(400).json({ ok: false, message: "Debes adjuntar un archivo de evidencia" }); }
  const data = await svc.uploadAssignmentEvidence({
    assignmentId: req.params.assignmentId,
    file: req.file,
    userId: req.user?.id || null,
  });
  res.status(200).json({ ok: true, data });
});

exports.downloadAssignmentEvidenceFile = asyncHandler(async (req, res) => {
  const { buffer, filename, mimeType } = await svc.getAssignmentEvidenceFile(req.params.assignmentId);
  res.setHeader("Content-Type", mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${filename || `evidencia-asignacion-${req.params.assignmentId}`}"`);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(buffer);
});

exports.generateAnnualMaintenance = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const data = await svc.generateAnnualMaintenance({
    year: payload.year,
    dryRun: Boolean(payload.dry_run),
    userId: req.user?.id || null,
  });
  res.status(201).json({ ok: true, data });
});

exports.generateFutureMaintenance = asyncHandler(async (req, res) => {
  const data = await svc.generateFutureMaintenance({ userId: req.user?.id || null });
  res.status(201).json({ ok: true, data });
});

exports.generateReport = asyncHandler(async (req, res) => {
  const periodType = String(req.body?.period_type || "annual").toLowerCase() === "monthly" ? "monthly" : "annual";
  const year = req.body?.year ? Number(req.body.year) : new Date().getFullYear();
  const month = periodType === "monthly"
    ? (req.body?.month ? Number(req.body.month) : (new Date().getMonth() + 1))
    : null;
  const user = req.user || {};
  const generatedByName = user.fullname || user.name || user.email || "Sistema";
  const result = await reportSvc.generateAndStoreMaintenanceReport({
    periodType,
    year,
    month,
    userId: user.id || null,
    generatedByName,
    rootFolderId: process.env.DRIVE_ROOT_FOLDER_ID || null,
  });
  const { pdfBuffer, ...metadata } = result;
  res.status(201).json({ ok: true, data: metadata });
});

exports.listReports = asyncHandler(async (req, res) => {
  const data = await reportSvc.listReports({ limit: Number(req.query?.limit || 50) });
  res.json({ ok: true, total: data.length, data });
});

exports.downloadReport = asyncHandler(async (req, res) => {
  const periodType = String(req.query?.period_type || "annual").toLowerCase() === "monthly" ? "monthly" : "annual";
  const year = req.query?.year ? Number(req.query.year) : new Date().getFullYear();
  const month = periodType === "monthly"
    ? (req.query?.month ? Number(req.query.month) : (new Date().getMonth() + 1))
    : null;
  const user = req.user || {};
  const generatedByName = user.fullname || user.name || user.email || "Sistema";
  let result = null;
  const existing = await reportSvc.downloadReportPdfFromDrive({
    periodType,
    year,
    month,
  });
  if (existing?.pdfBuffer) {
    result = { ...existing.report, pdfBuffer: existing.pdfBuffer };
  } else {
    result = await reportSvc.generateAndStoreMaintenanceReport({
      periodType,
      year,
      month,
      userId: user.id || null,
      generatedByName,
      rootFolderId: process.env.DRIVE_ROOT_FOLDER_ID || null,
    });
  }
  const ts = new Date().toISOString().slice(0, 10);
  const periodLabel = periodType === "monthly"
    ? `${year}-${String(month).padStart(2, "0")}`
    : String(year);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Cronograma_TI_${periodType}_${periodLabel}_${ts}.pdf"`);
  res.send(result.pdfBuffer);
});

exports.diagnoseMaintenance = asyncHandler(async (req, res) => {
  const db = require("../../config/db");
  const currentYear = new Date().getUTCFullYear();

  const { rows: assets } = await db.query(
    `SELECT id, name, status, active, maintenance_frequency_months, purchase_date, created_at
       FROM public.ti_assets ORDER BY id ASC`
  );

  const { rows: schedules } = await db.query(
    `SELECT asset_id, COUNT(*) as total, MIN(planned_date) as first_date, MAX(planned_date) as last_date
       FROM public.ti_asset_maintenance_schedule
      GROUP BY asset_id`
  );
  const scheduleMap = {};
  schedules.forEach((s) => { scheduleMap[s.asset_id] = s; });

  const report = assets.map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    active: a.active,
    maintenance_frequency_months: a.maintenance_frequency_months,
    purchase_date_raw: a.purchase_date,
    purchase_date_type: a.purchase_date === null ? "null" : typeof a.purchase_date,
    purchase_date_is_date_obj: a.purchase_date instanceof Date,
    purchase_date_string: a.purchase_date ? String(a.purchase_date) : null,
    created_at_raw: a.created_at,
    existing_schedules: scheduleMap[a.id]
      ? {
          total: Number(scheduleMap[a.id].total),
          first: String(scheduleMap[a.id].first_date).slice(0, 10),
          last: String(scheduleMap[a.id].last_date).slice(0, 10),
        }
      : null,
    included_in_generate:
      a.active === true && a.status !== "retired" && a.status !== "damaged",
  }));

  res.json({ ok: true, current_year: currentYear, assets: report });
});

exports.listMaintenance = asyncHandler(async (req, res) => {
  const data = await svc.listMaintenance({ year: req.query?.year || null });
  res.status(200).json({ ok: true, total: data.length, data });
});

exports.clearAllMaintenance = asyncHandler(async (req, res) => {
  const data = await svc.clearAllMaintenanceSchedules({ userId: req.user?.id || null });
  res.status(200).json({ ok: true, data });
});

exports.setMaintenanceCoordinationDate = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const data = await svc.setMaintenanceCoordinationDate({
    maintenanceId: req.params.id,
    coordinatedWithdrawalDate: payload.coordinated_withdrawal_date,
    userId: req.user?.id || null,
  });
  res.status(200).json({ ok: true, data });
});

exports.createMaintenance = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const data = await svc.createMaintenance({
    assetId: payload.asset_id,
    plannedDate: payload.planned_date,
    notes: payload.notes || null,
    userId: req.user?.id || null,
  });
  res.status(201).json({ ok: true, data });
});

exports.completeMaintenance = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const data = await svc.completeMaintenance({
    maintenanceId: req.params.id,
    notes: payload.notes || null,
    userId: req.user?.id || null,
  });
  res.status(200).json({ ok: true, data });
});

exports.requestMaintenanceDelivery = asyncHandler(async (req, res) => {
  const data = await svc.requestAssignedDeliveryForMaintenance({
    maintenanceId: req.params.id,
    userId: req.user?.id || null,
  });
  res.status(200).json({ ok: true, data });
});

// ─── Accessories ──────────────────────────────────────────────────────────────

exports.listAccessories = asyncHandler(async (req, res) => {
  const data = await svc.listAccessories(req.params.id);
  res.json({ ok: true, total: data.length, data });
});

exports.createAccessory = asyncHandler(async (req, res) => {
  const data = await svc.createAccessory({
    assetId: req.params.id,
    data: req.body || {},
    userId: req.user?.id || null,
  });
  res.status(201).json({ ok: true, data });
});

exports.updateAccessory = asyncHandler(async (req, res) => {
  const data = await svc.updateAccessory({
    accessoryId: req.params.accId,
    data: req.body || {},
    userId: req.user?.id || null,
  });
  res.status(200).json({ ok: true, data });
});

exports.removeAccessory = asyncHandler(async (req, res) => {
  const data = await svc.removeAccessory({
    accessoryId: req.params.accId,
    userId: req.user?.id || null,
  });
  res.status(200).json({ ok: true, data });
});

// ─── Actas ────────────────────────────────────────────────────────────────────

exports.listAllActas = asyncHandler(async (req, res) => {
  const data = await svc.listAllActas({
    limit:       Number(req.query?.limit  || 100),
    offset:      Number(req.query?.offset || 0),
    tipo:        req.query?.tipo        || null,
    is_complete: req.query?.is_complete != null
      ? req.query.is_complete === "true"
      : null,
  });
  res.json({ ok: true, total: data.length, data });
});

exports.listActas = asyncHandler(async (req, res) => {
  const data = await svc.listActas({ assetId: req.params.id, limit: 50 });
  res.json({ ok: true, total: data.length, data });
});

exports.getActa = asyncHandler(async (req, res) => {
  const data = await svc.getActaWithItems(req.params.actaId);
  res.json({ ok: true, data });
});

exports.updateActa = asyncHandler(async (req, res) => {
  const data = await svc.updateActa({
    actaId: req.params.actaId,
    data: req.body || {},
    userId: req.user?.id || null,
  });
  res.status(200).json({ ok: true, data });
});

exports.getActaSignatureWorkflow = asyncHandler(async (req, res) => {
  const data = await svc.getActaSignatureWorkflow(req.params.actaId, req.user);
  res.json({ ok: true, data });
});

exports.startActaSignatureWorkflow = asyncHandler(async (req, res) => {
  const data = await svc.startSignatureWorkflowForActa({
    actaId: req.params.actaId,
    signers: Array.isArray(req.body?.signers) ? req.body.signers : [],
    actorUser: req.user,
  });
  res.status(201).json({ ok: true, data });
});

exports.downloadActaPdf = asyncHandler(async (req, res) => {
  const { filename, pdfBuffer } = await svc.getActaPdfDownload(req.params.actaId, { preferStored: false });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(pdfBuffer);
});

exports.uploadSignedActa = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ ok: false, message: "Se requiere un archivo PDF" });
  }
  const data = await svc.uploadSignedActa({
    actaId:           req.params.actaId,
    fileBuffer:       req.file.buffer,
    originalFilename: req.file.originalname || "acta-firmada.pdf",
    userId:           req.user?.id || null,
  });
  res.status(200).json({ ok: true, data });
});

exports.uploadLegacySignedActa = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ ok: false, message: "Se requiere un archivo PDF" });
  }
  const data = await svc.uploadLegacySignedActa({
    assignmentId: req.params.assignmentId,
    fileBuffer: req.file.buffer,
    originalFilename: req.file.originalname || "acta-historica-firmada.pdf",
    userId: req.user?.id || null,
  });
  res.status(200).json({ ok: true, data });
});

// ─── Reports (on-demand PDF) ──────────────────────────────────────────────────

exports.downloadAssetReport = asyncHandler(async (req, res) => {
  const pdfBuffer = await svc.generateAssetPdfReport(req.params.id);
  const filename  = `Reporte-Activo-${String(req.params.id).padStart(6, "0")}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(pdfBuffer);
});

exports.downloadAssetLabel = asyncHandler(async (req, res) => {
  const { pdfBuffer, filename } = await svc.generateAssetLabelPdf(req.params.id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(pdfBuffer);
});

exports.downloadCollaboratorReport = asyncHandler(async (req, res) => {
  const pdfBuffer = await svc.generateCollaboratorPdfReport(req.params.userId);
  const filename  = `Reporte-Colaborador-${String(req.params.userId).padStart(6, "0")}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(pdfBuffer);
});

// ─── Financial docs ───────────────────────────────────────────────────────────

// ─── Recipient info for acta pre-fill ────────────────────────────────────────

exports.getActaRecipientInfo = asyncHandler(async (req, res) => {
  const db = require("../../config/db");
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ ok: false, message: "userId inválido" });
  }

  const { rows } = await db.query(
    `SELECT
        u.id,
        COALESCE(u.fullname, u.name, u.email) AS fullname,
        u.email,
        cp.profile->'personal'->>'cedula'     AS cedula,
        cp.profile->'personal'->>'nombres'    AS nombres,
        cp.profile->'personal'->>'apellidos'  AS apellidos,
        cp.profile->'laboral'->>'cargo'        AS cargo
       FROM public.users u
       LEFT JOIN public.collaborator_profiles cp ON cp.user_id = u.id
      WHERE u.id = $1 LIMIT 1`,
    [userId],
  );

  if (!rows.length) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

  const row    = rows[0];
  // Prefer combined nombres+apellidos if available, fall back to fullname
  const nombre = [row.nombres, row.apellidos].filter(Boolean).join(" ").trim() || row.fullname || "";

  res.json({
    ok: true,
    data: {
      id:     row.id,
      nombre: nombre,
      cedula: row.cedula || "",
      cargo:  row.cargo  || "",
      email:  row.email  || "",
    },
  });
});

exports.listFinancialDocs = asyncHandler(async (req, res) => {
  const data = await svc.listFinancialDocs(req.params.id);
  res.json({ ok: true, total: data.length, data });
});

exports.getLetrasDeChangioHistory = asyncHandler(async (req, res) => {
  const data = await svc.getLetrasDeChangioHistory(req.params.id);
  res.json({ ok: true, total: data.length, data });
});

exports.uploadFinancialDoc = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ ok: false, message: "Se requiere un archivo PDF" });
  }
  const docType = req.body?.doc_type || req.params?.docType || "";
  if (!docType) {
    return res.status(400).json({ ok: false, message: "doc_type requerido: factura | letra_de_cambio" });
  }
  const data = await svc.uploadFinancialDoc({
    assetId:          req.params.id,
    docType,
    fileBuffer:       req.file.buffer,
    originalFilename: req.file.originalname || "documento.pdf",
    notes:            req.body?.notes || null,
    invoiceNumber:    req.body?.invoice_number || null,
    userId:           req.user?.id || null,
  });
  res.status(201).json({ ok: true, data });
});

// ─── FASE 6: Liberation ────────────────────────────────────────────────────

exports.liberateAsset = asyncHandler(async (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (files.length < 2) {
    return res.status(400).json({ ok: false, message: "Se requieren al menos 2 fotos para liberar el equipo" });
  }
  const payload = req.body || {};
  const photos = files.map((f, i) => ({
    buffer:   f.buffer,
    filename: f.originalname || `liberation_${req.params.id}_${i + 1}.jpg`,
  }));
  const data = await svc.liberateAsset({
    assetId: req.params.id,
    photos,
    notes:  payload.notes || null,
    userId: req.user?.id || null,
  });
  res.status(200).json({ ok: true, data });
});

exports.getLiberationPhotos = asyncHandler(async (req, res) => {
  const data = await svc.getLiberationPhotos(req.params.id);
  res.json({ ok: true, total: data.length, data });
});

exports.downloadLiberationPhotoFile = asyncHandler(async (req, res) => {
  const { buffer, filename, mimeType } = await svc.getLiberationPhotoFile(req.params.photoId);
  res.setHeader("Content-Type", mimeType || "image/jpeg");
  res.setHeader("Content-Disposition", `inline; filename="${filename || `liberacion-${req.params.photoId}.jpg`}"`);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(buffer);
});

// ─── FASE 2: Corporate Numbers ─────────────────────────────────────────────

exports.listCorporateNumbers = asyncHandler(async (req, res) => {
  const data = await svc.listCorporateNumbers({
    status: req.query?.status,
    q: req.query?.q,
  });
  res.json({ ok: true, total: data.length, data });
});

exports.getCorporateNumber = asyncHandler(async (req, res) => {
  const data = await svc.getCorporateNumber(req.params.id);
  res.json({ ok: true, data });
});

exports.createCorporateNumber = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const data = await svc.createCorporateNumber({
    number: payload.number,
    notes: payload.notes || null,
    userId: req.user?.id || null,
  });
  res.status(201).json({ ok: true, data });
});

exports.updateCorporateNumber = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const data = await svc.updateCorporateNumber({
    numberId: req.params.id,
    number: payload.number,
    status: payload.status,
    userId: req.user?.id || null,
  });
  res.json({ ok: true, data });
});

exports.assignCorporateNumber = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const data = await svc.assignCorporateNumber({
    numberId: req.params.id,
    assetId: payload.asset_id,
    assignedToUserId: payload.assigned_to_user_id || null,
    userId: req.user?.id || null,
  });
  res.json({ ok: true, data });
});

exports.changeCorporateNumber = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const data = await svc.changeCorporateNumber({
    currentNumberId: req.params.currentId,
    newNumberId: payload.new_number_id,
    reason: payload.reason || null,
    userId: req.user?.id || null,
  });
  res.json({ ok: true, data });
});

exports.getCorporateNumberHistory = asyncHandler(async (req, res) => {
  const data = await svc.getCorporateNumberHistory(req.params.id);
  res.json({ ok: true, total: data.length, data });
});
