const { asyncHandler } = require("../../middlewares/asyncHandler");
const svc = require("./tiAssets.service");
const reportSvc = require("./tiAssets.report");
const { generateActaEntregaPdf } = require("./tiAssets.acta");
const { computeSha256HexFromBuffer } = require("../../utils/documentHash");
const { uploadBase64File, ensureFolder } = require("../../utils/drive");

exports.listAssets = asyncHandler(async (req, res) => {
  const data = await svc.listAssets({ status: req.query?.status, q: req.query?.q });
  res.json({ ok: true, total: data.length, data });
});

exports.createAsset = asyncHandler(async (req, res) => {
  const data = await svc.createAsset({ data: req.body || {}, userId: req.user?.id || null });
  res.status(201).json({ ok: true, data });
});

exports.updateAsset = asyncHandler(async (req, res) => {
  const data = await svc.updateAsset({ assetId: req.params.id, data: req.body || {}, userId: req.user?.id || null });
  res.status(200).json({ ok: true, data });
});

exports.assignAsset = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const data = await svc.assignAsset({
    assetId: req.params.id,
    assignedToUserId: payload.assigned_to_user_id || null,
    reason: payload.reason || null,
    userId: req.user?.id || null,
    recipientNombre: payload.recipient_nombre || null,
    recipientCedula: payload.recipient_cedula || null,
    recipientCargo:  payload.recipient_cargo  || null,
    actaItems: Array.isArray(payload.acta_items) && payload.acta_items.length ? payload.acta_items : null,
  });

  // Generate and upload the PDF acta asynchronously (non-blocking for the HTTP response)
  if (data.acta_id) {
    setImmediate(async () => {
      try {
        const actaDetail = await svc.getActaWithItems(data.acta_id);
        const pdfBuffer = await generateActaEntregaPdf({
          actaCode:  actaDetail.acta_code || "ACTA-ET-2026-000001",
          nombre:    actaDetail.recipient_nombre || "",
          cedula:    actaDetail.recipient_cedula || "",
          cargo:     actaDetail.recipient_cargo  || "",
          actaDay:   actaDetail.acta_day || new Date().getDate(),
          actaMonth: actaDetail.acta_month || (new Date().getMonth() + 1),
          actaYear:  actaDetail.acta_year || new Date().getFullYear(),
          items:     actaDetail.items || [],
        });
        const sha256 = computeSha256HexFromBuffer(pdfBuffer);
        const tipo = actaDetail.tipo === "entrega" ? "ET" : "RT";
        const filename = `ACTA-${tipo}-${String(actaDetail.id).padStart(6, "0")}.pdf`;
        let driveUrl = null;
        let driveFileId = null;
        try {
          const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID || null;
          let folderId = null;
          if (rootFolderId) {
            const folder = await ensureFolder("Actas TI", rootFolderId);
            folderId = folder?.id || null;
          }
          const uploaded = await uploadBase64File(filename, pdfBuffer.toString("base64"), "application/pdf", folderId);
          driveUrl = uploaded?.webViewLink || uploaded?.webContentLink || null;
          driveFileId = uploaded?.id || null;
        } catch (_driveErr) { /* drive opcional */ }
        await svc.updateActaPdf({ actaId: data.acta_id, filename, sha256, driveUrl, driveFileId });
      } catch (_err) { /* no bloquea el flujo */ }
    });
  }

  res.status(200).json({ ok: true, data });
});

exports.assignMultipleAssets = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const data = await svc.assignMultipleAssets({
    assetIds: Array.isArray(payload.asset_ids) ? payload.asset_ids : [],
    assignedToUserId: payload.assigned_to_user_id || null,
    reason: payload.reason || null,
    userId: req.user?.id || null,
    recipientNombre: payload.recipient_nombre || null,
    recipientCedula: payload.recipient_cedula || null,
    recipientCargo:  payload.recipient_cargo  || null,
    acta_items: Array.isArray(payload.acta_items) ? payload.acta_items : null,
  });

  // Generate and upload the PDF acta asynchronously
  if (data.acta_id) {
    setImmediate(async () => {
      try {
        const actaDetail = await svc.getActaWithItems(data.acta_id);
        const pdfBuffer = await generateActaEntregaPdf({
          actaCode:  actaDetail.acta_code || "ACTA-ET-2026-000001",
          nombre:    actaDetail.recipient_nombre || "",
          cedula:    actaDetail.recipient_cedula || "",
          cargo:     actaDetail.recipient_cargo  || "",
          actaDay:   actaDetail.acta_day || new Date().getDate(),
          actaMonth: actaDetail.acta_month || (new Date().getMonth() + 1),
          actaYear:  actaDetail.acta_year || new Date().getFullYear(),
          items:     actaDetail.items || [],
        });
        const sha256 = computeSha256HexFromBuffer(pdfBuffer);
        const tipo = actaDetail.tipo === "entrega" ? "ET" : "RT";
        const filename = `ACTA-${tipo}-${String(actaDetail.id).padStart(6, "0")}.pdf`;
        let driveUrl = null;
        let driveFileId = null;
        try {
          const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID || null;
          const userEmail = req.user?.email || "unknown@example.com";
          const result = await uploadBase64File({
            base64Data: Buffer.from(pdfBuffer).toString("base64"),
            filename,
            mimeType: "application/pdf",
            folderPath: rootFolderId ? `Usuarios/${userEmail}/Documentos/TI-Assets/` : null,
            rootFolderId,
          });
          driveUrl = result.webViewLink;
          driveFileId = result.id;
        } catch (_err) { /* no bloquea el flujo */ }
        await svc.updateActaPdf({
          actaId: data.acta_id,
          filename,
          sha256,
          driveUrl,
          driveFileId,
        });
      } catch (_err) { /* no bloquea el flujo */ }
    });
  }

  res.status(200).json({ ok: true, data });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const payload = req.body || {};
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

exports.downloadActaPdf = asyncHandler(async (req, res) => {
  const acta = await svc.getActaWithItems(req.params.actaId);
  const pdfBuffer = await generateActaEntregaPdf({
    actaCode:  acta.acta_code || "ACTA-ET-2026-000001",
    nombre:    acta.recipient_nombre || "",
    cedula:    acta.recipient_cedula || "",
    cargo:     acta.recipient_cargo  || "",
    actaDay:   acta.acta_day || new Date().getDate(),
    actaMonth: acta.acta_month || (new Date().getMonth() + 1),
    actaYear:  acta.acta_year || new Date().getFullYear(),
    items:     acta.items || [],
  });
  const filename = acta.acta_code ? `${acta.acta_code}.pdf` : `ACTA-${String(acta.id).padStart(6, "0")}.pdf`;
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

// ─── Reports (on-demand PDF) ──────────────────────────────────────────────────

exports.downloadAssetReport = asyncHandler(async (req, res) => {
  const pdfBuffer = await svc.generateAssetPdfReport(req.params.id);
  const filename  = `Reporte-Activo-${String(req.params.id).padStart(6, "0")}.pdf`;
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
    userId:           req.user?.id || null,
  });
  res.status(201).json({ ok: true, data });
});
