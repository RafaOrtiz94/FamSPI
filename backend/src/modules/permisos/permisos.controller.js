const permisosService = require("./permisos.service");
const { normalizeRow } = require("../../utils/normalizers");
const { uploadJustificante } = require("./permisos.drive");
const { shouldRespondJson, renderVerificationHtml } = require("../../utils/legalVerificationView");
const multer = require("multer");
const upload = multer({ 
  storage: multer.diskStorage({
    destination: '/tmp',
    filename: (req, file, cb) => {
      cb(null, `permiso_${Date.now()}_${file.originalname}`);
    }
  })
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
      const uploaded = await uploadJustificante({
        user: req.user,
        solicitudId: id,
        fecha_inicio: solicitud.fecha_inicio,
        fileBuffer: file.buffer,
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

    const result = await permisosService.listarResumenColaboradores();
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
          title: "VerificaciÃ³n legal invÃ¡lida",
          subtitle: "FamSign",
          status: "pending",
          sourceType: "Permisos/Vacaciones",
        })
      );
    }
    const result = await permisosService.getLegalVerificationByToken(token);
    if (!result) {
      if (responseAsJson) return res.status(404).json({ ok: false, message: "Token de verificaciÃ³n no encontrado" });
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
        title: "VerificaciÃ³n legal completada",
        subtitle: "FamSign",
        status: result?.status,
        id: result?.id,
        solicitante: result?.solicitante,
        aprobador: result?.aprobador,
        aprobacionFinalAt: result?.aprobacion_final_at,
        token: result?.legal_verification_token || token,
        workflow: result?.firma_avanzada_resumen || null,
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
        title: "Error de verificaciÃ³n",
        subtitle: "FamSign",
        status: "pending",
        sourceType: "Permisos/Vacaciones",
      })
    );
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

module.exports = {
  create,
  aprobarParcial,
  uploadJustificantes,
  aprobarFinal,
  rechazar,
  listarPendientes,
  listarMias,
  listarResumenColaboradores,
  verifyLegalToken,
  getLegalCoverage,
  upload,
};

