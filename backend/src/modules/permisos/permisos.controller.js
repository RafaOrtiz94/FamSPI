const permisosService = require("./permisos.service");
const { normalizeRow } = require("../../utils/normalizers");
const { uploadJustificante } = require("./permisos.drive");
const { shouldRespondJson, renderVerificationHtml } = require("../../utils/legalVerificationView");
const multer = require("multer");
const fs = require("fs");
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se aceptan PDF, Word, JPG y PNG.`));
    }
  },
});

const normalizeDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
};

const normalizePermisoRow = (row) => {
  const normalized = normalizeRow(row, [
    "aprobacion_parcial_at",
    "aprobacion_final_at",
    "created_at",
    "updated_at",
    "fecha_inicio_hora",
    "fecha_fin_hora",
  ]);
  return {
    ...normalized,
    fecha_inicio: normalizeDateOnly(row?.fecha_inicio),
    fecha_fin: normalizeDateOnly(row?.fecha_fin),
    fecha_regreso: normalizeDateOnly(row?.fecha_regreso),
  };
};

const getRequestMeta = (req) => ({
  ipAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || null,
  userAgent: req.headers["user-agent"] || null,
  sessionId: req.headers["x-session-id"] || req.body?.session_id || null,
});

async function create(req, res) {
  try {
    const result = await permisosService.createSolicitud({ body: req.body, user: req.user, meta: getRequestMeta(req) });
    res.status(201).json({ ok: true, data: result });
  } catch (error) {
    console.error("Error creando solicitud:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function registerStudyEnrollment(req, res) {
  try {
    const file = Array.isArray(req.files) ? req.files[0] : req.file;
    const data = await permisosService.registerStudyEnrollment({
      actor: req.user,
      payload: req.body || {},
      file,
    });
    res.status(201).json({ ok: true, data });
  } catch (error) {
    console.error("Error registrando matrícula de estudios:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function getActiveStudyEnrollment(req, res) {
  try {
    const actorId = req.user?.id;
    const data = await permisosService.getActiveStudyEnrollment({
      userId: actorId,
      date: req.query?.date || null,
    });
    res.json({ ok: true, data: data || null });
  } catch (error) {
    console.error("Error obteniendo matrícula activa:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function listMyStudyEnrollments(req, res) {
  try {
    const actorId = req.user?.id;
    const data = await permisosService.listMyStudyEnrollments({ userId: actorId });
    res.json({ ok: true, data: data || [] });
  } catch (error) {
    console.error("Error listando matrículas:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function listPendingStudyEnrollments(req, res) {
  try {
    const data = await permisosService.listPendingStudyEnrollments({ approver: req.user });
    res.json({ ok: true, data: data || [] });
  } catch (error) {
    console.error("Error listando matrículas pendientes:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function reviewStudyEnrollment(req, res) {
  try {
    const { id } = req.params;
    const data = await permisosService.reviewStudyEnrollment({
      id: Number(id),
      approver: req.user,
      decision: req.body?.decision,
      reason: req.body?.reason,
    });
    res.json({ ok: true, data });
  } catch (error) {
    console.error("Error revisando matrícula:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function aprobarParcial(req, res) {
  try {
    const { id } = req.params;
    const result = await permisosService.aprobarParcial({ id: Number(id), approver: req.user, meta: getRequestMeta(req) });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error aprobando parcialmente:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function uploadJustificantes(req, res) {
  try {
    const { id } = req.params;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ ok: false, message: "No se enviaron archivos" });
    }

    // Obtener la solicitud para tener fecha_inicio y drive_folder_id
    const solicitud = await permisosService.getSolicitudById(Number(id));
    if (!solicitud) {
      return res.status(404).json({ ok: false, message: "Solicitud no encontrada" });
    }

    const urls = [];
    for (const file of files) {
      // Con memoryStorage llega en file.buffer; con diskStorage de legado podría llegar en file.path.
      const fileBuffer = file?.buffer || (file?.path ? fs.readFileSync(file.path) : null);
      if (!fileBuffer) {
        const err = new Error(`No se pudo leer el contenido del archivo: ${file?.originalname || "sin nombre"}`);
        err.status = 400;
        throw err;
      }

      const uploaded = await uploadJustificante({
        user: req.user,
        solicitudId: id,
        fecha_inicio: solicitud.fecha_inicio,
        fileBuffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
        existingFolderId: solicitud.drive_folder_id, // Usar la misma carpeta del acta
      });
      urls.push(uploaded.webViewLink);
    }

    const result = await permisosService.subirJustificantes({ id: Number(id), urls, user: req.user });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error subiendo justificantes:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function revisarJustificantes(req, res) {
  try {
    const { id } = req.params;
    const result = await permisosService.revisarJustificante({
      id: Number(id),
      decision: req.body?.decision,
      observations: req.body?.observations,
      approver: req.user,
    });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error revisando justificantes:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function aprobarFinal(req, res) {
  try {
    const { id } = req.params;
    const result = await permisosService.aprobarFinal({ id: Number(id), approver: req.user, meta: getRequestMeta(req) });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error aprobando finalmente:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function rechazar(req, res) {
  try {
    const { id } = req.params;
    const { observaciones } = req.body;
    const result = await permisosService.rechazar({ id: Number(id), approver: req.user, observaciones, meta: getRequestMeta(req) });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error rechazando:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function cancelar(req, res) {
  try {
    const { id } = req.params;
    const result = await permisosService.cancelarSolicitud({
      id: Number(id),
      actor: req.user,
      reason: req.body?.reason,
    });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error cancelando:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function revisarCancelacion(req, res) {
  try {
    const { id } = req.params;
    const result = await permisosService.revisarCancelacionSolicitud({
      id: Number(id),
      actor: req.user,
      decision: req.body?.decision,
      reason: req.body?.reason,
    });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error revisando cancelación:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function updateRecoveryPlan(req, res) {
  try {
    const { id } = req.params;
    const result = await permisosService.updateRecoveryPlan({
      id: Number(id),
      actor: req.user,
      recoveryPlan: req.body?.recovery_plan,
      action: req.body?.action,
    });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error actualizando plan de recuperación:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function listarPendientes(req, res) {
  try {
    const { stage } = req.query;
    const result = await permisosService.listarPendientes({ stage, approver: req.user });
    const normalized = (result || []).map((row) => normalizePermisoRow(row));
    res.json({ ok: true, data: normalized });
  } catch (error) {
    console.error("Error listando pendientes:", error);
    res.status(500).json({ ok: false, message: error.message });
  }
}

async function listarMias(req, res) {
  try {
    const result = await permisosService.listarPorUsuario({ user: req.user });
    const normalized = (result?.data || []).map((row) => normalizePermisoRow(row));
    res.json({ ok: true, ...result, data: normalized });
  } catch (error) {
    console.error("Error listando mis solicitudes:", error);
    res.status(500).json({ ok: false, message: error.message });
  }
}

async function listarResumenColaboradores(req, res) {
  try {
    const role = (req.user?.role || "").toLowerCase();
    const allowed = new Set([
      "talento_humano",
      "jefe_talento_humano",
      "jefe_financiero",
      "jefe_ti",
      "gerencia",
      "gerencia_general",
      "gerente_general",
      "director",
      "admin",
      "administrador",
    ]);

    if (!allowed.has(role)) {
      return res.status(403).json({ ok: false, message: "No tienes permisos para ver este resumen" });
    }

    const { department_id, year } = req.query;
    const result = await permisosService.listarResumenColaboradores({
      departmentId: department_id ? Number(department_id) : null,
      year: year ? Number(year) : null,
    });
    const normalized = result.map((row) => ({
      ...row,
      permisos: {
        ...row.permisos,
        items: (row.permisos.items || []).map((item) => normalizePermisoRow(item)),
      },
      vacaciones: {
        ...row.vacaciones,
        items: (row.vacaciones.items || []).map((item) => ({
          ...normalizeRow(item, ["created_at"]),
          fecha_inicio: normalizeDateOnly(item?.fecha_inicio),
          fecha_fin: normalizeDateOnly(item?.fecha_fin),
        })),
      },
    }));

    res.json({ ok: true, data: normalized });
  } catch (error) {
    console.error("Error listando resumen de colaboradores:", error);
    res.status(500).json({ ok: false, message: error.message });
  }
}

async function verifyLegalToken(req, res) {
  try {
    const responseAsJson = shouldRespondJson(req);
    const token = String(req.params?.token || "").trim();
    if (!token) {
      if (responseAsJson) return res.status(400).json({ ok: false, message: "Token requerido" });
      return res.status(400).type("html").send(
        renderVerificationHtml({
          title: "Verificación legal inválida",
          subtitle: "FamSign",
          status: "pending",
          sourceType: "Permisos/Vacaciones",
        })
      );
    }
    const result = await permisosService.getLegalVerificationByToken(token);
    if (!result) {
      if (responseAsJson) return res.status(404).json({ ok: false, message: "Token de verificación no encontrado" });
      return res.status(404).type("html").send(
        renderVerificationHtml({
          title: "Token no encontrado",
          subtitle: "FamSign",
          status: "pending",
          token,
          sourceType: "Permisos/Vacaciones",
        })
      );
    }
    if (responseAsJson) return res.json({ ok: true, data: result });
    return res.type("html").send(
      renderVerificationHtml({
        title: "Verificación legal completada",
        subtitle: "FamSign",
        status: result?.status,
        id: result?.id,
        solicitante: result?.solicitante,
        aprobador: result?.aprobador,
        aprobacionFinalAt: result?.aprobacion_final_at,
        token: result?.legal_verification_token || token,
        workflow: result?.firma_avanzada_resumen || null,
        cancellation: result?.cancellation || null,
        sourceType: "Permisos/Vacaciones",
      })
    );
  } catch (error) {
    console.error("Error verificando token legal:", error);
    if (shouldRespondJson(req)) {
      return res.status(500).json({ ok: false, message: error.message || "No se pudo verificar el token legal" });
    }
    return res.status(500).type("html").send(
      renderVerificationHtml({
        title: "Error de verificación",
        subtitle: "FamSign",
        status: "pending",
        sourceType: "Permisos/Vacaciones",
      })
    );
  }
}

const TH_REPORT_ROLES = new Set([
  "talento_humano",
  "jefe_talento_humano",
  "gerencia",
  "gerencia_general",
  "gerente_general",
  "admin",
  "administrador",
]);

async function getReportePeriodo(req, res) {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (!TH_REPORT_ROLES.has(role)) {
      return res.status(403).json({ ok: false, message: "No tienes permisos para este reporte" });
    }
    const { start_date, end_date, department_id, tipo_solicitud, status } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ ok: false, message: "Se requieren start_date y end_date" });
    }
    const result = await permisosService.getReportePeriodo({
      startDate: start_date,
      endDate: end_date,
      departmentId: department_id ? Number(department_id) : null,
      tipoSolicitud: tipo_solicitud || null,
      status: status || null,
    });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error generando reporte de periodo:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function getKpiDashboard(req, res) {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (!TH_REPORT_ROLES.has(role)) {
      return res.status(403).json({ ok: false, message: "No tienes permisos para este dashboard" });
    }
    const { year, department_id } = req.query;
    const result = await permisosService.getKpiDashboard({
      year: year ? Number(year) : null,
      departmentId: department_id ? Number(department_id) : null,
    });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error generando KPI dashboard:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function getLegalCoverage(req, res) {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const allowed = new Set(["admin", "administrador", "jefe_ti", "jefe_financiero", "jefe_finanzas", "gerencia_general", "gerente_general"]);
    if (!allowed.has(role)) {
      return res.status(403).json({ ok: false, message: "No tienes permisos para este recurso" });
    }
    const coverage = await permisosService.getLegalCoverage();
    return res.json({ ok: true, data: coverage });
  } catch (error) {
    console.error("Error obteniendo cobertura legal:", error);
    return res.status(500).json({ ok: false, message: error.message || "No se pudo obtener cobertura legal" });
  }
}

async function convertirAVacaciones(req, res) {
  try {
    const { id } = req.params;
    const result = await permisosService.convertirAVacaciones({
      id: Number(id),
      actor: req.user,
    });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error convirtiendo ausencia a vacaciones:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function resolverRegularizacion(req, res) {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;
    const result = await permisosService.resolverRegularizacion({
      id: Number(id),
      action,
      reason,
      actor: req.user,
    });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error resolviendo regularización:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

module.exports = {
  create,
  registerStudyEnrollment,
  getActiveStudyEnrollment,
  listMyStudyEnrollments,
  listPendingStudyEnrollments,
  reviewStudyEnrollment,
  aprobarParcial,
  uploadJustificantes,
  revisarJustificantes,
  aprobarFinal,
  rechazar,
  cancelar,
  revisarCancelacion,
  updateRecoveryPlan,
  listarPendientes,
  listarMias,
  listarResumenColaboradores,
  verifyLegalToken,
  getLegalCoverage,
  getReportePeriodo,
  getKpiDashboard,
  resolverRegularizacion,
  convertirAVacaciones,
  upload,
};
