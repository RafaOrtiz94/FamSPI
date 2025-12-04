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
  payload.approver_role = resolveApproverRole(user?.role || user?.rol || "");

  if (payload.tipo_solicitud === "permiso") {
    const validation = await validatePermisoRequest(payload);
    payload.justificacion_requerida = validation.justificantes_requeridos || [];
    payload.es_recuperable = Boolean(validation.es_recuperable);
  }

  const { rows } = await db.query(
    `INSERT INTO permisos_vacaciones (
      user_email, user_fullname, approver_role, tipo_solicitud, tipo_permiso, subtipo_calamidad, duracion_horas, duracion_dias, fecha_inicio, fecha_fin,
      es_recuperable, periodo_vacaciones, justificacion_requerida, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending') RETURNING *`,
    [
      payload.user_email,
      payload.user_fullname,
      payload.approver_role,
      payload.tipo_solicitud,
      payload.tipo_permiso || null,
      payload.subtipo_calamidad || null,
      payload.duracion_horas || null,
      payload.duracion_dias || null,
      payload.fecha_inicio || null,
      payload.fecha_fin || null,
      payload.es_recuperable || false,
      payload.periodo_vacaciones || null,
      payload.justificacion_requerida || null,
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

module.exports = {
  ensureTable,
  createSolicitud,
  aprobarParcial,
  subirJustificantes,
  aprobarFinal,
  rechazar,
  listarPendientes,
  listarPorUsuario,
};
