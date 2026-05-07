const { asyncHandler } = require("../../middlewares/asyncHandler");
const svc = require("./tiAssets.service");
const reportSvc = require("./tiAssets.report");

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
  });
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
