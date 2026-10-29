/**
 * ============================================================
 * 🎯 Controller: Requests (Solicitudes)
 * ------------------------------------------------------------
 * Maneja creación, lectura, cancelación y reenvío de solicitudes.
 * Conexión directa con auditoría extendida y flujos automáticos.
 * ============================================================
 */

const service = require("./requests.service");
const { asyncHandler } = require("../../middlewares/asyncHandler");
const { logAction } = require("../../utils/audit");
const { sendMail } = require("../../utils/mailer");
const logger = require("../../config/logger");
const { normalizeRequestDates } = require("../../utils/date.serializer");

// ============================================================
// 📋 Listar solicitudes
// ============================================================
exports.listRequests = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || "1", 10);
  const pageSize = parseInt(req.query.pageSize || "50", 10);
  const status = req.query.status || null;
  const q = req.query.q || null;
  const roleName = String(req.user?.role || req.user?.role_name || "").trim().toLowerCase();
  const type = roleName === "jefe_financiero" ? "F.VE-02" : req.query.type || null;
  const mine = req.query.mine === "true" || req.query.mine === "1";
  const requester_id = mine ? req.user?.id || null : null;

  const result = await service.listRequests({ page, pageSize, status, q, type, requester_id });

  await logAction({
    user_id: req.user?.id || null,
    module: "requests",
    action: "list",
    entity: "requests",
    details: { page, total: result.total },
  });

  res.json({
    ok: true,
    message: "Listado de solicitudes obtenido correctamente",
    data: normalizeRequestDates(result),
  });
});

// ============================================================
// 🧾 Crear nueva solicitud (con validación AJV y logs detallados)
// ============================================================
exports.sendConsentEmailToken = asyncHandler(async (req, res) => {
  const { client_email, client_name, consent_recipient_email } = req.body || {};
  const data = await service.sendConsentEmailToken({
    user: req.user,
    client_email,
    recipient_email: consent_recipient_email,
    client_name,
  });

  await logAction({
    user_id: req.user.id,
    module: "client_requests",
    action: "send_consent_token",
    entity: "client_request_consent_tokens",
    details: { client_email: consent_recipient_email || client_email },
  });

  res.json({
    ok: true,
    message: "Código enviado al correo del cliente.",
    data,
  });
});

exports.verifyConsentEmailToken = asyncHandler(async (req, res) => {
  const { token_id, code } = req.body || {};
  const result = await service.verifyConsentEmailToken({
    user: req.user,
    token_id,
    code,
  });

  await logAction({
    user_id: req.user.id,
    module: "client_requests",
    action: "verify_consent_token",
    entity: "client_request_consent_tokens",
    entity_id: result?.id || token_id,
    details: { token_id },
  });

  res.json({
    ok: true,
    message: "Código validado correctamente.",
    data: {
      token_id: result?.id || token_id,
      verified_at: result?.verified_at,
      expires_at: result?.expires_at,
      client_email: result?.client_email,
    },
  });
});

// ============================================================
// 🧾 Crear nueva solicitud (con validación AJV y logs detallados)
// ============================================================
exports.createRequest = asyncHandler(async (req, res) => {
  const user = req.user;
  let { request_type_id, payload } = req.body;

  if (!request_type_id)
    return res.status(400).json({
      ok: false,
      message: "Falta el campo request_type_id",
    });

  // 🧩 Asegurar que el payload sea un objeto válido (corrige error AJV)
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = {};
    }
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    payload = {};
  }

  const files = Array.isArray(req.files)
    ? req.files
    : [
      ...(req.files?.files || []),
      ...(req.files?.["files[]"] || []),
    ];

  logger.info(
    {
      user: user?.email,
      request_type_id,
      payload: payload?.nombre_cliente ? payload : null,
    },
    "✉️ Request POST /requests recibido"
  );

  try {
    // 🧩 Crear solicitud base
    const result = await service.createRequest({
      requester_id: user.id,
      requester_email: user.email,
      requester_name: user.fullname || user.name || user.email,
      request_type_id,
      payload,
      files,
    });

    await logAction({
      user_id: user.id,
      module: "requests",
      action: "create",
      entity: "requests",
      entity_id: result.request.id,
      details: result,
    });

    // ✉️ Notificación por correo
    try {
      const requestCode = result.request.type_code || "";
      const clientLabel = payload?.nombre_cliente || null;
      await sendMail({
        to: user.email,
        subject: `Solicitud creada${requestCode ? ` ${requestCode}` : ""}${clientLabel ? ` - ${clientLabel}` : ""}`,
        html: `
          <h2>Solicitud creada correctamente</h2>
          <p>Se generó la solicitud <b>${requestCode || ""}${clientLabel ? ` - ${clientLabel}` : ""}</b> (${result.request.status})</p>
          ${result.document?.id
            ? `<p>Documento asociado: 
                  <a href="https://drive.google.com/file/d/${result.document.id}/view" target="_blank">
                    Ver acta
                  </a>
                </p>`
            : ""
          }
        `,
        from: { email: user.email, name: user.fullname || user.name || user.email },
        replyTo: user.email,
        senderName: user.fullname || user.name || user.email,
        delegatedUser: user.email,
        gmailUserId: user.id,
      });
    } catch (mailErr) {
      logger.warn("⚠️ No se pudo enviar correo:", mailErr.message);
    }

    return res.status(201).json({
      ok: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    // 🚨 Log extendido de error AJV o sistema
    logger.error({ err }, "❌ Error creando solicitud");

    if (err.validationErrors) {
      logger.error("📋 Detalles de validación AJV:");
      logger.error(JSON.stringify(err.validationErrors, null, 2));
    }
    logger.error(
      {
        request_type_id,
        payload,
      },
      "⚠️ Request inválido desde frontend"
    );

    await logAction({
      user_id: user?.id || null,
      usuario_email: user?.email || "anon",
      rol: user?.role || "sin-rol",
      modulo: "v1",
      accion: "crear_failed",
      entity: "requests",
      entity_id: null,
      details: {
        error: err.message || "Sin mensaje explícito",
        validationErrors: err.validationErrors || null,
      },
    });

    // 🚨 Respuesta detallada al frontend
    res.status(err.status || 400).json({
      ok: false,
      message: err.message || "Error creando solicitud",
      details: err.validationErrors || err || null,
    });
  }
});

// ============================================================
// 🔍 Obtener detalle de solicitud
// ============================================================
exports.getDetail = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const data = await service.getRequestFull(id);

  if (!data)
    return res.status(404).json({
      ok: false,
      message: "Solicitud no encontrada",
    });

  const roleName = String(req.user?.role || req.user?.role_name || "").trim().toLowerCase();
  if (roleName === "jefe_financiero" && String(data.request?.type_code || "").toUpperCase() !== "F.VE-02") {
    return res.status(403).json({
      ok: false,
      message: "Jefe Financiero solo puede consultar solicitudes de credito.",
    });
  }

  await logAction({
    user_id: req.user?.id || null,
    module: "requests",
    action: "get_detail",
    entity: "requests",
    entity_id: id,
  });

  res.json({
    ok: true,
    message: "Detalle de solicitud obtenido correctamente",
    data: normalizeRequestDates(data),
  });
});

// ============================================================
// ❌ Cancelar solicitud
// ============================================================
exports.cancel = asyncHandler(async (req, res) => {
  const user = req.user;
  const id = parseInt(req.params.id, 10);

  try {
    const ok = await service.cancelRequest({
      id,
      user_id: user.id,
    });

    await logAction({
      user_id: user.id,
      module: "requests",
      action: "cancel",
      entity: "requests",
      entity_id: id,
    });

    res.json({
      ok,
      message: "Solicitud cancelada correctamente",
    });
  } catch (error) {
    logger.error("❌ Error cancelando solicitud:", error.message);

    res.status(400).json({
      ok: false,
      message: error.message,
    });
  }
});

// ============================================================
// 📋 Registrar resultado F.ST-07 (inspecciones independientes)
// ============================================================
exports.processCreditDecision = asyncHandler(async (req, res) => {
  const user = req.user;
  const id = parseInt(req.params.id, 10);
  const { action, payload } = req.body || {};

  try {
    const result = await service.processCreditRequestDecision({
      id,
      user,
      action,
      payload: payload || {},
    });

    await logAction({
      user_id: user.id,
      module: "requests",
      action: action === "approve" ? "credit_approve" : "credit_reject",
      entity: "requests",
      entity_id: id,
      details: payload || {},
    });

    res.json({
      ok: true,
      message: action === "approve"
        ? "Solicitud de credito aprobada correctamente"
        : "Solicitud de credito rechazada correctamente",
      data: result,
    });
  } catch (error) {
    logger.error({ error: error.message, requestId: id }, "Error resolviendo solicitud de credito");
    res.status(error.status || 400).json({
      ok: false,
      message: error.message || "No se pudo resolver la solicitud de credito",
    });
  }
});

exports.registerInspectionResult = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const result = await service.registerIndependentInspectionResult(id, req.body || {}, req.user);
    res.json({ ok: true, ...result });
  } catch (error) {
    logger.error({ error: error.message }, "❌ Error registrando resultado F.ST-07");
    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No se pudo registrar el resultado de la inspección",
      code: error.code || null,
    });
  }
});

// ============================================================
// ♻️ Reenviar solicitud (tras rechazo)
// ============================================================
exports.resubmit = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  let payload = req.body.payload || {};
  const user = req.user;

  // 🧩 Asegurar tipo correcto en payload (igual que en create)
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = {};
    }
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    payload = {};
  }

  try {
    const r = await service.resubmit({
      id,
      user_id: user.id,
      payload,
    });

    await logAction({
      user_id: user.id,
      module: "requests",
      action: "resubmit",
      entity: "requests",
      entity_id: r.id,
      details: payload,
    });

    res.json({
      ok: true,
      message: "Solicitud reenviada correctamente",
      data: r,
    });
  } catch (error) {
    logger.error("❌ Error reenviando solicitud:", error.message);

    res.status(400).json({
      ok: false,
      message: error.message,
    });
  }
});

/*
 * ============================================================
 * === Flujo de Creación de Nuevos Clientes
 * ============================================================
 */

// ============================================================
// 🧾 Crear Solicitud de Nuevo Cliente
// ============================================================
exports.createClientRequest = asyncHandler(async (req, res) => {
  const result = await service.createClientRequest(req.user, req.body, req.files);

  await logAction({
    user_id: req.user.id,
    module: "client_requests",
    action: "create",
    entity: "client_requests",
    entity_id: result.id,
    details: `Solicitud de cliente para ${result.commercial_name}`,
  });

  res.status(201).json({
    ok: true,
    message: "Solicitud de creación de cliente enviada correctamente.",
    data: result,
  });
});

// ============================================================
// 📋 Listar Solicitudes de Nuevos Clientes
// ============================================================
exports.listClientRequests = asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 25, status, q } = req.query;
  const isMyRequests = req.path.includes("/my");

  const result = await service.listClientRequests({
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    status,
    q,
    createdBy: isMyRequests ? req.user.email : undefined,
  });

  await logAction({
    user_id: req.user.id,
    module: "client_requests",
    action: "list",
    entity: "client_requests",
    details: `Listado de solicitudes de clientes. Página: ${page}`,
  });

  res.json({
    ok: true,
    message: "Listado de solicitudes de clientes obtenido.",
    data: normalizeRequestDates(result),
  });
});

// ============================================================
// 🔍 Obtener Detalle de Solicitud de Nuevo Cliente
// ============================================================

// ============================================================
// ? Obtener resumen de solicitudes de nuevos clientes
// ============================================================
exports.getClientRequestSummary = asyncHandler(async (req, res) => {
  const summary = await service.getClientRequestSummary({});

  await logAction({
    user_id: req.user.id,
    module: "client_requests",
    action: "summary",
    entity: "client_requests",
    details: "Resumen de estados de solicitudes",
  });

  res.json({
    ok: true,
    message: "Resumen de solicitudes de clientes obtenido.",
    data: summary,
  });
});

exports.getClientRequestById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = await service.getClientRequestById(id, req.user);

  await logAction({
    user_id: req.user.id,
    module: "client_requests",
    action: "get_detail",
    entity: "client_requests",
    entity_id: id,
  });

  res.json({
    ok: true,
    message: "Detalle de solicitud obtenido.",
    data: normalizeRequestDates(result),
  });
});

exports.updateClientRequestQualityChecklist = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { item_key, status, notes } = req.body || {};
  const result = await service.updateClientRequestQualityChecklist({
    id,
    user: req.user,
    item_key,
    status,
    notes,
  });

  await logAction({
    user_id: req.user.id,
    module: "client_requests",
    action: "quality_checklist_update",
    entity: "client_requests",
    entity_id: id,
    details: { item_key, status },
  });

  res.json({
    ok: true,
    message: "Checklist de calidad actualizado.",
    data: normalizeRequestDates(result),
  });
});

// ============================================================
// 🔄 Procesar Solicitud (Aprobar/Rechazar)
// ============================================================
exports.processClientRequest = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { action, rejection_reason } = req.body; // action: 'approve' o 'reject'

  const result = await service.processClientRequest({
    id,
    user: req.user,
    action,
    rejection_reason,
  });

  await logAction({
    user_id: req.user.id,
    module: "client_requests",
    action: action, // 'approve' o 'reject'
    entity: "client_requests",
    entity_id: id,
    details: `Acción: ${action}. Razón: ${rejection_reason || "N/A"}`,
  });

  res.json({
    ok: true,
    message: `Solicitud ${action === 'approve' ? 'aprobada' : 'rechazada'} correctamente.`,
    data: result,
  });
});

// ============================================================
// 🙏 Procesar Consentimiento LOPDP
// ============================================================
exports.grantConsent = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const result = await service.grantConsent({
    token,
    audit: {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    },
  });

  await logAction({
    user_id: null, // Es una acción del cliente final
    module: "client_requests",
    action: "grant_consent",
    entity: "client_requests",
    entity_id: result.id,
    details: `Consentimiento otorgado para la solicitud #${result.id}`,
  });

  // Idealmente, redirigir a una página de agradecimiento en el frontend.
  // Por ahora, se devuelve un JSON.
  res.json({
    ok: true,
    message: "Gracias por confirmar. Tu autorización ha sido registrada.",
  });
});

// ============================================================
// ✏️ Actualizar Solicitud de Nuevo Cliente (Corrección)
// ============================================================
exports.updateClientRequest = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = await service.updateClientRequest(id, req.user, req.body, req.files);

  await logAction({
    user_id: req.user.id,
    module: "client_requests",
    action: "update",
    entity: "client_requests",
    entity_id: id,
    details: `Solicitud corregida por usuario`,
  });

  res.json({
    ok: true,
    message: "Solicitud actualizada correctamente.",
    data: result,
  });
});
