const db = require("../../config/db");
const { logAction } = require("../../utils/audit");
const { validatePermisoRequest } = require("./permisos.validation");
const { generateFRH10 } = require("./permisos.pdf");

const ROLE_APPROVER = {
  comercial: "jefe_comercial",
  acp_comercial: "jefe_comercial",
  backoffice_comercial: "jefe_comercial",
  backoffice: "jefe_comercial",
  jefe_comercial: "gerencia",
  tecnico: "jefe_tecnico",
  tecnico_servicio: "jefe_tecnico",
  aplicaciones: "jefe_tecnico",
  applicaciones: "jefe_tecnico",
  jefe_tecnico: "gerencia",
};

function resolveApproverRole(requesterRole = "") {
  const normalized = requesterRole.toLowerCase();
  return ROLE_APPROVER[normalized] || "gerencia";
}

async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS permisos_vacaciones (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      user_fullname TEXT,
      approver_role TEXT,
      tipo_solicitud TEXT NOT NULL DEFAULT 'vacaciones',
      tipo_permiso TEXT,
      subtipo_calamidad TEXT,
      duracion_horas DECIMAL(4,2),
      duracion_dias DECIMAL(5,2),
      fecha_inicio DATE,
      fecha_fin DATE,
      es_recuperable BOOLEAN DEFAULT false,
      periodo_vacaciones TEXT,
      justificacion_requerida TEXT[],
      justificantes_urls TEXT[],
      aprobacion_parcial_at TIMESTAMPTZ,
      aprobacion_parcial_por TEXT,
      aprobacion_final_at TIMESTAMPTZ,
      aprobacion_final_por TEXT,
      pdf_generado_url TEXT,
      observaciones TEXT[],
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      CHECK (tipo_solicitud IN ('permiso','vacaciones')),
      CHECK ((tipo_solicitud = 'permiso' AND tipo_permiso IN ('estudios','personal','salud','calamidad')) OR tipo_solicitud = 'vacaciones'),
      CHECK ((tipo_permiso = 'calamidad' AND subtipo_calamidad IN ('fallecimiento','accidente','desastre')) OR tipo_permiso != 'calamidad'),
      CHECK (status IN ('pending','partially_approved','pending_final','approved','rejected'))
    );
  `);
  await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS approver_role TEXT");
}

async function createSolicitud({ body, user }) {
  await ensureTable();
  const payload = { ...body };
  payload.tipo_solicitud = payload.tipo_solicitud || "permiso";
  payload.user_email = user?.email;
  payload.user_fullname = user?.fullname || user?.name || user?.email;
  payload.user_id = user?.id;
  payload.approver_role = resolveApproverRole(user?.role || user?.rol || "");

  let driveMeta = {};
  let justificacionRequerida = [];
  let esRecuperable = false;

  // Validar y procesar según tipo de solicitud
  if (payload.tipo_solicitud === "permiso") {
    const validation = await validatePermisoRequest(payload);
    justificacionRequerida = validation.justificantes_requeridos || [];
    esRecuperable = Boolean(validation.es_recuperable);
  } else if (payload.tipo_solicitud === "vacaciones") {
    // Calcular días si no vienen
    if (!payload.duracion_dias && payload.fecha_inicio && payload.fecha_fin) {
      const start = new Date(payload.fecha_inicio);
      const end = new Date(payload.fecha_fin);
      const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
      payload.duracion_dias = diff >= 0 ? diff + 1 : 0;
    }

    // Calcular fecha de regreso si no viene
    if (!payload.fecha_regreso && payload.fecha_fin) {
      const endDate = new Date(payload.fecha_fin);
      endDate.setDate(endDate.getDate() + 1);
      payload.fecha_regreso = endDate.toISOString().split("T")[0];
    }

    // Generar documento en Drive para vacaciones
    try {
      const { uploadVacationDocument } = require("./permisos.drive");
      driveMeta = await uploadVacationDocument({
        user,
        fecha_inicio: payload.fecha_inicio,
        fecha_fin: payload.fecha_fin,
        fecha_regreso: payload.fecha_regreso,
        periodo: payload.periodo_vacaciones,
        dias: payload.duracion_dias,
      });
    } catch (err) {
      console.warn("No se pudo generar documento de vacaciones:", err.message);
    }
  }

  const { rows } = await db.query(
    `INSERT INTO permisos_vacaciones (
      user_email, user_fullname, user_id, approver_role, department_id,
      tipo_solicitud, tipo_permiso, subtipo_calamidad, 
      duracion_horas, duracion_dias, fecha_inicio, fecha_fin, fecha_regreso,
      es_recuperable, periodo_vacaciones, justificacion_requerida, 
      drive_doc_id, drive_pdf_id, drive_doc_link, drive_pdf_link, drive_folder_id,
      status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'pending') RETURNING *`,
    [
      payload.user_email,
      payload.user_fullname,
      payload.user_id,
      payload.approver_role,
      user?.department_id || null,
      payload.tipo_solicitud,
      payload.tipo_permiso || null,
      payload.subtipo_calamidad || null,
      payload.duracion_horas || null,
      payload.duracion_dias || null,
      payload.fecha_inicio || null,
      payload.fecha_fin || null,
      payload.fecha_regreso || null,
      esRecuperable,
      payload.periodo_vacaciones || null,
      justificacionRequerida.length > 0 ? justificacionRequerida : null,
      driveMeta.drive_doc_id || null,
      driveMeta.drive_pdf_id || null,
      driveMeta.drive_doc_link || null,
      driveMeta.drive_pdf_link || null,
      driveMeta.folderId || null,
    ]
  );

  await logAction({ usuario_email: user?.email, modulo: "permisos", accion: "crear" });
  return rows[0];
}

function canApprove({ approverRole, approver }) {
  if (!approverRole) return true;
  const role = approver?.role?.toLowerCase();
  if (!role) return false;
  if (role === "gerencia") return true;
  return role === approverRole.toLowerCase();
}

async function aprobarParcial({ id, approver }) {
  await ensureTable();
  const existing = await db.query(`SELECT approver_role, status FROM permisos_vacaciones WHERE id = $1 LIMIT 1`, [id]);
  const solicitud = existing.rows[0];
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (!canApprove({ approverRole: solicitud.approver_role, approver })) {
    const err = new Error("No autorizado para aprobar esta solicitud");
    err.status = 403;
    throw err;
  }
  const { rows } = await db.query(
    `UPDATE permisos_vacaciones
        SET status = 'partially_approved',
            aprobacion_parcial_at = now(),
            aprobacion_parcial_por = $2,
            updated_at = now()
      WHERE id = $1
    RETURNING *`,
    [id, approver?.email]
  );
  await logAction({ usuario_email: approver?.email, modulo: "permisos", accion: "aprobar_parcial" });
  return rows[0];
}

async function subirJustificantes({ id, urls, user }) {
  await ensureTable();
  const safeUrls = Array.isArray(urls) ? urls : [];
  const { rows } = await db.query(
    `UPDATE permisos_vacaciones
        SET justificantes_urls = $2,
            status = 'pending_final',
            updated_at = now()
      WHERE id = $1
    RETURNING *`,
    [id, safeUrls]
  );
  await logAction({ usuario_email: user?.email, modulo: "permisos", accion: "subir_justificantes" });
  return rows[0];
}

async function aprobarFinal({ id, approver }) {
  await ensureTable();
  const { rows } = await db.query(`SELECT * FROM permisos_vacaciones WHERE id = $1 LIMIT 1`, [id]);
  const solicitud = rows[0];
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (!canApprove({ approverRole: solicitud.approver_role, approver })) {
    const err = new Error("No autorizado para aprobar esta solicitud");
    err.status = 403;
    throw err;
  }
  const pdfUrl = await generateFRH10(solicitud);
  const update = await db.query(
    `UPDATE permisos_vacaciones
        SET status = 'approved',
            aprobacion_final_at = now(),
            aprobacion_final_por = $2,
            pdf_generado_url = $3,
            updated_at = now()
      WHERE id = $1
    RETURNING *`,
    [id, approver?.email, pdfUrl]
  );
  await logAction({ usuario_email: approver?.email, modulo: "permisos", accion: "aprobar_final" });
  return update.rows[0];
}

async function rechazar({ id, approver, observaciones }) {
  await ensureTable();
  const current = await db.query(`SELECT approver_role FROM permisos_vacaciones WHERE id = $1 LIMIT 1`, [id]);
  const solicitud = current.rows[0];
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (!canApprove({ approverRole: solicitud.approver_role, approver })) {
    const err = new Error("No autorizado para rechazar esta solicitud");
    err.status = 403;
    throw err;
  }
  const obsArray = Array.isArray(observaciones)
    ? observaciones
    : observaciones
      ? [observaciones]
      : [];
  const { rows } = await db.query(
    `UPDATE permisos_vacaciones
        SET status = 'rejected',
            observaciones = $2,
            updated_at = now(),
            aprobacion_final_por = $3,
            aprobacion_final_at = now()
      WHERE id = $1
    RETURNING *`,
    [id, obsArray, approver?.email]
  );
  await logAction({ usuario_email: approver?.email, modulo: "permisos", accion: "rechazar" });
  return rows[0];
}

async function listarPendientes({ stage, approver }) {
  await ensureTable();
  let statusFilter = "pending";
  if (stage === "final" || stage === "pending_final") statusFilter = "pending_final";
  if (stage === "parcial") statusFilter = "pending";
  const role = approver?.role?.toLowerCase();
  const allowedRoles = [role].filter(Boolean);
  if (role !== "gerencia") {
    allowedRoles.push("gerencia");
  }
  const { rows } = await db.query(
    `SELECT * FROM permisos_vacaciones WHERE status = $1 AND (approver_role = ANY($2) OR $3 = TRUE OR approver_role IS NULL) ORDER BY created_at DESC`,
    [statusFilter, allowedRoles, role === "gerencia"]
  );
  return rows;
}

async function listarPorUsuario({ user }) {
  await ensureTable();
  const email = user?.email;
  if (!email) return { data: [], summary: {} };

  const { rows } = await db.query(
    `SELECT * FROM permisos_vacaciones WHERE user_email = $1 ORDER BY created_at DESC LIMIT 100`,
    [email]
  );

  const summary = rows.reduce(
    (acc, row) => {
      const status = row.status || "pending";
      acc.status[status] = (acc.status[status] || 0) + 1;
      acc.total += 1;
      return acc;
    },
    { total: 0, status: {} }
  );

  return { data: rows, summary };
}

async function getSolicitudById(id) {
  await ensureTable();
  const { rows } = await db.query(
    `SELECT * FROM permisos_vacaciones WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  ensureTable,
  createSolicitud,
  aprobarParcial,
  subirJustificantes,
  aprobarFinal,
  rechazar,
  listarPendientes,
  listarPorUsuario,
  getSolicitudById,
};
