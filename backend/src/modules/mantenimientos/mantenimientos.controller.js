/**
 * ============================================================
 * ⚙️ Controller: Mantenimientos
 * ------------------------------------------------------------
 * Crea, firma, aprueba y exporta mantenimientos con auditoría extendida.
 * ============================================================
 */

const svc = require("./mantenimientos.service");
const { asyncHandler } = require("../../middlewares/asyncHandler");
const { logAction } = require("../../utils/audit");
const preventivePlanning = require("./preventivePlanning.service");
const preventiveOffer = require("./preventiveOffer.service");
const preventiveCompliance = require("./preventiveCompliance.service");
const { issueFst16Document } = require("./fst16.service");
const { issueFst17Document } = require("./fst17.service");

// ============================================================
// 🧾 Crear mantenimiento
// ============================================================
exports.createMantenimiento = asyncHandler(async (req, res) => {
  const user = req.user;
  const data = req.body;

  const firma_responsable = req.files?.firma_responsable?.[0]?.buffer?.toString("base64") || null;
  const firma_receptor = req.files?.firma_receptor?.[0]?.buffer?.toString("base64") || null;
  const evidencias = req.files?.evidencias || [];

  const result = await svc.createMantenimiento({
    data,
    responsable_id: user.id,
    responsable_email: user.email,
    responsable_nombre: user.full_name || user.name || user.email,
    firma_responsable,
    firma_receptor,
    evidencias,
  });

  // Excluir firmas base64 del log para evitar error JSONB
  const { firma_responsable: _fr, firma_receptor: _frec, ...dataSinFirmas } = data;
  await logAction({
    usuario_id: user.id,
    usuario_email: user.email,
    rol: user.role,
    modulo: "mantenimientos",
    accion: "crear",
    descripcion: `Mantenimiento #${result.id || "nuevo"} creado`,
    datos_nuevos: dataSinFirmas,
    contexto: { mantenimiento_id: result.id, request_id: data.request_id || null },
  });

  const nextMaintenance =
    result.nextMaintenance || {
      date: result.next_maintenance_date,
      status: result.next_maintenance_status,
      conflictMessage: result.next_maintenance_conflict,
    };

  res.status(201).json({
    ok: true,
    message:
      nextMaintenance?.status === "conflicto"
        ? "Mantenimiento creado. Revisa el cronograma: el próximo recordatorio tiene conflicto."
        : "Mantenimiento creado y programado en el cronograma.",
    mantenimiento: result,
    nextMaintenance,
  });
});

// ============================================================
// 📋 Listar mantenimientos
// ============================================================
exports.listMantenimientos = asyncHandler(async (req, res) => {
  const role = req.user.role;
  const list = await svc.listMantenimientos(req.user.id, role);

  await logAction({
    usuario_id: req.user.id,
    usuario_email: req.user.email,
    rol: req.user.role,
    modulo: "mantenimientos",
    accion: "listar",
    descripcion: "Listado de mantenimientos",
  });

  res.json({ ok: true, data: list });
});

// ============================================================
// 🔍 Detalle de mantenimiento
// ============================================================
exports.getDetail = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const det = await svc.getDetail(id);
  if (!det) return res.status(404).json({ ok: false, message: "No encontrado" });

  await logAction({
    usuario_id: req.user.id,
    usuario_email: req.user.email,
    rol: req.user.role,
    modulo: "mantenimientos",
    accion: "consultar_detalle",
    descripcion: `Detalle del mantenimiento #${id}`,
    contexto: { mantenimiento_id: id },
  });

  res.json({ ok: true, detalle: det });
});

// ============================================================
// ✍️ Firmar documento
// ============================================================
exports.sign = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { tag, base64 } = req.body;
  const result = await svc.sign({ id, user_id: req.user.id, base64, tag });

  await logAction({
    usuario_id: req.user.id,
    usuario_email: req.user.email,
    rol: req.user.role,
    modulo: "mantenimientos",
    accion: "firmar",
    descripcion: `Firma agregada (${tag}) en mantenimiento #${id}`,
    contexto: { mantenimiento_id: id },
  });

  res.json({ ok: true, result });
});

// ============================================================
// ✅ Aprobar mantenimiento (Gerencia)
// ============================================================
exports.approve = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const user = req.user;
  const result = await svc.approve({ id, approver_id: user.id });

  await logAction({
    usuario_id: user.id,
    usuario_email: user.email,
    rol: user.role,
    modulo: "mantenimientos",
    accion: "aprobar",
    descripcion: `Mantenimiento #${id} aprobado`,
    contexto: { mantenimiento_id: id },
  });

  res.json({ ok: true, result });
});

// ============================================================
// 📄 Exportar PDF
// ============================================================
exports.exportPdf = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const result = await svc.exportPdf(id);

  await logAction({
    usuario_id: req.user.id,
    usuario_email: req.user.email,
    rol: req.user.role,
    modulo: "mantenimientos",
    accion: "exportar_pdf",
    descripcion: `Documento PDF exportado para mantenimiento #${id}`,
    contexto: { mantenimiento_id: id },
  });

  res.json({ ok: true, result });
});

exports.signAdvanced = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const {
    consent,
    consent_text: consentText,
    role_at_sign: roleAtSign,
    authorized_role: authorizedRole,
    session_id: sessionId,
  } = req.body || {};

  // La firma avanzada sólo procede con consentimiento explícito del responsable
  if (consent !== true) {
    return res.status(400).json({ ok: false, message: "Se requiere consentimiento expreso" });
  }

  if (!sessionId) {
    return res.status(400).json({ ok: false, message: "session_id es obligatorio" });
  }

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  const userAgent = req.headers["user-agent"]; // Evidencia técnica para trazabilidad

  const result = await svc.signAdvanced({
    id,
    user: req.user,
    consentText,
    roleAtSign,
    authorizedRole,
    sessionId,
    ip,
    userAgent,
  });

  res.status(201).json({ ok: true, ...result });
});

// ============================================================
// 🧭 ST-01-02 Preventivo - Plan Anual y Ejecución
// ============================================================
exports.listPreventiveAnnualPlans = asyncHandler(async (req, res) => {
  const rows = await preventivePlanning.listPreventiveAnnualPlans({
    year: req.query?.year || null,
    status: req.query?.status || null,
    q: req.query?.q || null,
    limit: req.query?.limit || 100,
  });
  res.json({ ok: true, count: rows.length, rows });
});

exports.getPreventiveAnnualPlanDetail = asyncHandler(async (req, res) => {
  const detail = await preventivePlanning.getPreventiveAnnualPlanDetail(req.params.planId);
  if (!detail) return res.status(404).json({ ok: false, error: "Plan preventivo no encontrado" });
  res.json({ ok: true, plan: detail });
});

exports.createPreventiveAnnualPlan = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const detail = await preventivePlanning.createPreventiveAnnualPlan({
    year: payload.year,
    title: payload.title,
    notes: payload.notes,
    sourceScheduleId: payload.source_schedule_id || payload.sourceScheduleId || null,
    anexo7Capacity: payload.anexo7_capacity || payload.anexo7Capacity || {},
    equipmentItems: payload.equipment_items || payload.equipmentItems || [],
    user: req.user,
  });
  res.status(201).json({ ok: true, plan: detail });
});

exports.publishPreventiveAnnualPlan = asyncHandler(async (req, res) => {
  const detail = await preventivePlanning.publishPreventiveAnnualPlan({
    planId: req.params.planId,
    user: req.user,
  });
  res.json({ ok: true, plan: detail });
});

exports.rebaselinePreventiveAnnualPlan = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const detail = await preventivePlanning.rebaselinePreventiveAnnualPlan({
    planId: req.params.planId,
    reason: payload.reason || null,
    anexo7Capacity: payload.anexo7_capacity || payload.anexo7Capacity || null,
    user: req.user,
  });
  res.status(201).json({ ok: true, plan: detail });
});

exports.issueFst16 = asyncHandler(async (req, res) => {
  const result = await issueFst16Document({
    annualPlanId: req.params.planId,
    notes: req.body?.notes || null,
    user: req.user,
  });
  res.status(201).json({ ok: true, ...result });
});

exports.issueFst17 = asyncHandler(async (req, res) => {
  const result = await issueFst17Document({
    planItemId: req.params.itemId,
    notes: req.body?.notes || null,
    user: req.user,
  });
  res.status(201).json({ ok: true, ...result });
});

exports.registerPreventiveOffer = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const result = await preventiveOffer.issuePreventiveOffer({
    planItemId: req.params.itemId,
    validUntil: payload.valid_until || payload.validUntil || null,
    offerPayload: payload.offer_payload || payload.offerPayload || {},
    notes: payload.notes || null,
    user: req.user,
  });
  res.status(201).json({ ok: true, ...result });
});

exports.decidePreventiveOffer = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const result = await preventiveOffer.decideOffer({
    planItemId: req.params.itemId,
    decision: payload.decision,
    reason: payload.reason || payload.decision_reason || null,
    user: req.user,
  });
  res.json({ ok: true, ...result });
});

exports.registerReprogrammingNotice = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const result = await preventivePlanning.createReprogrammingNotice({
    planItemId: req.params.itemId,
    newPlannedDate: payload.new_planned_date || payload.newPlannedDate,
    reason: payload.reason,
    payload: payload.anexo5_payload || payload.anexo5Payload || {},
    user: req.user,
  });
  res.status(201).json({ ok: true, ...result });
});

exports.registerPreventiveCoordination = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const item = await preventivePlanning.updatePlanItemCoordination({
    planItemId: req.params.itemId,
    coordinatedAt: payload.coordinated_at || payload.coordinatedAt || null,
    coordinationWindow: payload.coordination_window || payload.coordinationWindow || null,
    notes: payload.notes || null,
    user: req.user,
  });
  res.json({ ok: true, plan_item: item });
});

exports.registerPreventiveWorkOrder = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const item = await preventivePlanning.upsertPlanItemWorkOrder({
    planItemId: req.params.itemId,
    workOrderNumber: payload.work_order_number || payload.workOrderNumber || null,
    autoCreate:
      typeof payload.auto_create === "boolean"
        ? payload.auto_create
        : typeof payload.autoCreate === "boolean"
          ? payload.autoCreate
          : true,
    notes: payload.notes || null,
    user: req.user,
  });
  res.json({ ok: true, plan_item: item });
});

exports.requestPreventiveKit = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const result = await preventivePlanning.requestPreventiveKit({
    planItemId: req.params.itemId,
    observations: payload.observations || null,
    requestedAt: payload.requested_at || payload.requestedAt || null,
    workOrderNumber: payload.work_order_number || payload.workOrderNumber || null,
    user: req.user,
  });
  res.status(201).json({ ok: true, ...result });
});

exports.registerKitWarehouseExit = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const result = await preventivePlanning.registerKitWarehouseExit({
    kitRequestId: req.params.kitId,
    warehouseExitAt: payload.warehouse_exit_at || payload.warehouseExitAt || null,
    warehouseExitReference:
      payload.warehouse_exit_reference || payload.warehouseExitReference || null,
    user: req.user,
  });
  res.json({ ok: true, ...result });
});

exports.closePreventiveExecution = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const result = await preventivePlanning.registerPreventiveExecution({
    planItemId: req.params.itemId,
    executedAt: payload.executed_at || payload.executedAt || null,
    durationMinutes: payload.duration_minutes || payload.durationMinutes || null,
    activities: payload.activities || [],
    partsReplaced: payload.parts_replaced || payload.partsReplaced || [],
    consumables: payload.consumables || [],
    evidence: payload.evidence || [],
    reportPayload: payload.report_payload || payload.reportPayload || {},
    workOrderNumber: payload.work_order_number || payload.workOrderNumber || null,
    notes: payload.notes || null,
    user: req.user,
  });
  res.status(201).json({ ok: true, ...result });
});

exports.getPreventiveComplianceDashboard = asyncHandler(async (req, res) => {
  const data = await preventiveCompliance.getComplianceDashboard({
    year: req.query?.year || null,
    month: req.query?.month || null,
    annualPlanId: req.query?.annual_plan_id || req.query?.annualPlanId || null,
  });
  res.json({ ok: true, ...data });
});

exports.getPreventiveCapacityDashboard = asyncHandler(async (req, res) => {
  const data = await preventiveCompliance.getCapacityDashboard({
    annualPlanId: req.query?.annual_plan_id || req.query?.annualPlanId || null,
    year: req.query?.year || null,
  });
  res.json({ ok: true, ...data });
});

exports.sendPreventiveMonthlyReport = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const recipients = Array.isArray(payload.recipients) ? payload.recipients : [];
  const data = await preventiveCompliance.sendMonthlyProgressReport({
    annualPlanId: req.params.planId,
    month: payload.month || null,
    recipients,
    user: req.user,
  });
  res.status(201).json({ ok: true, ...data });
});

exports.getPreventiveTimeline = asyncHandler(async (req, res) => {
  const rows = await preventivePlanning.listPreventiveTimeline({
    annualPlanId: req.query?.annual_plan_id || req.query?.annualPlanId || null,
    planItemId: req.query?.plan_item_id || req.query?.planItemId || null,
    limit: req.query?.limit || 200,
  });
  res.json({ ok: true, count: rows.length, rows });
});

exports.getPreventiveHistory = asyncHandler(async (req, res) => {
  const rows = await preventivePlanning.listPreventiveHistory({
    equipmentId: req.query?.equipment_id || req.query?.equipmentId || null,
    clientName: req.query?.client_name || req.query?.clientName || null,
    limit: req.query?.limit || 200,
  });
  res.json({ ok: true, count: rows.length, rows });
});
