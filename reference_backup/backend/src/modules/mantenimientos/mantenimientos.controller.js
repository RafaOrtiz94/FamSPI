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
