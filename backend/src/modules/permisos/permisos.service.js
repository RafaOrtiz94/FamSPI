const db = require("../../config/db");
const { logAction } = require("../../utils/audit");
const { validatePermisoRequest } = require("./permisos.validation");
const { generateFRH10 } = require("./permisos.pdf");
const notificationManager = require("../notifications/notificationManager");
const logger = require("../../config/logger");

const ANNUAL_ALLOWANCE = 15;
const MAX_ANNUAL_ALLOWANCE = 30;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const ROLE_APPROVER = {
  comercial: "jefe_comercial",
  acp_comercial: "jefe_comercial",
  marketing: "jefe_comercial",
  backoffice_comercial: "jefe_comercial",
  financiero: "jefe_financiero",
  finanzas: "jefe_financiero",
  tecnico: "jefe_tecnico",
  tecnico_servicio: "jefe_tecnico",
  ti: "jefe_ti",
  admin_ti: "jefe_ti",
  logistica: "jefe_logistica",
  operaciones: "jefe_operaciones",
  calidad: "jefe_calidad",
};

const GERENCIA_GENERAL_ROLES = new Set(["gerencia_general", "gerente_general"]);

function resolveApproverRole(requesterRole = "") {
  const normalized = String(requesterRole || "").trim().toLowerCase();
  const isJefe = normalized.startsWith("jefe_") || normalized.startsWith("jefe");
  if (isJefe) return "gerencia_general";
  return ROLE_APPROVER[normalized] || "gerencia_general";
}

function getApproverRoleCandidates(approver = {}) {
  const candidates = new Set(
    [approver?.role, approver?.scope, approver?.role_name, approver?.rol]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
  );
  if (candidates.has("gerencia_general")) candidates.add("gerente_general");
  if (candidates.has("gerente_general")) candidates.add("gerencia_general");
  return Array.from(candidates);
}

async function findApproverByRole(role) {
  if (!role) return null;
  const { rows } = await db.query(
    `SELECT id, email, fullname
       FROM users
      WHERE LOWER(role) = LOWER($1) AND active = true
      ORDER BY id ASC
      LIMIT 1`,
    [role]
  );
  return rows[0] || null;
}

function getDisplayName(user = {}) {
  return user?.fullname || user?.name || user?.email || "";
}

async function getUserIdentity(userId) {
  if (!userId) return null;
  try {
    const { rows } = await db.query(
      `SELECT
          u.id,
          u.email,
          COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email) AS fullname,
          cp.profile->'personal'->>'cedula' AS cedula
        FROM users u
        LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
        WHERE u.id = $1
        LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  } catch (error) {
    const { rows } = await db.query(
      `SELECT
          u.id,
          u.email,
          COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email) AS fullname,
          NULL::text AS cedula
        FROM users u
        WHERE u.id = $1
        LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  }
}

async function getHireDate(userId) {
  if (!userId) return null;
  const { rows } = await db.query(
    `SELECT cp.profile->'laboral'->>'fecha_ingreso' AS fecha_ingreso
       FROM collaborator_profiles cp
      WHERE cp.user_id = $1
      LIMIT 1`,
    [userId]
  );
  return rows[0]?.fecha_ingreso || null;
}

async function getVacationConsumption({ userId, userEmail, year }) {
  const yearValue = Number(year);
  if (!Number.isFinite(yearValue)) return { approved: 0, pending: 0 };

  let query = `
    SELECT
      COALESCE(SUM(CASE WHEN status IN ('approved','aprobado') THEN COALESCE(duracion_dias, 0) ELSE 0 END), 0) AS approved,
      COALESCE(SUM(CASE WHEN status IN ('pending','pendiente','pending_final','partially_approved') THEN COALESCE(duracion_dias, 0) ELSE 0 END), 0) AS pending
    FROM permisos_vacaciones
    WHERE tipo_solicitud = 'vacaciones'
      AND EXTRACT(YEAR FROM fecha_inicio) = $1
  `;
  const values = [yearValue];
  if (userId) {
    query += " AND user_id = $2";
    values.push(userId);
  } else if (userEmail) {
    query += " AND user_email = $2";
    values.push(userEmail);
  } else {
    return { approved: 0, pending: 0 };
  }

  const { rows } = await db.query(query, values);
  return {
    approved: Number(rows[0]?.approved || 0),
    pending: Number(rows[0]?.pending || 0),
  };
}

async function getHistoricVacationBalance({ userId, userEmail, year }) {
  const yearValue = Number(year);
  if (!Number.isFinite(yearValue)) return 0;
  try {
    if (userId) {
      const { rows } = await db.query(
        `SELECT COALESCE(SUM(dias), 0) AS total
           FROM vacaciones_saldos_historicos
          WHERE anio = $1
            AND (user_id = $2 OR LOWER(user_email) = LOWER($3))`,
        [yearValue, userId, userEmail || ""]
      );
      return Number(rows[0]?.total || 0);
    }
    if (userEmail) {
      const { rows } = await db.query(
        `SELECT COALESCE(SUM(dias), 0) AS total
           FROM vacaciones_saldos_historicos
          WHERE anio = $1
            AND LOWER(user_email) = LOWER($2)`,
        [yearValue, userEmail]
      );
      return Number(rows[0]?.total || 0);
    }
  } catch (error) {
    if (error?.code !== "42P01") throw error;
  }
  return 0;
}

let tableReady = false;
let tablePromise = null;

async function ensureTable() {
  if (tableReady) return;
  if (tablePromise) return tablePromise;

  tablePromise = (async () => {
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
      CHECK (status IN ('pending','partially_approved','pending_final','approved','rejected'))
    );
  `);
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS approver_role TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS user_fullname TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS tipo_solicitud TEXT DEFAULT 'vacaciones'");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS tipo_permiso TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS duracion_horas DECIMAL(4,2)");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS duracion_dias DECIMAL(5,2)");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS fecha_inicio DATE");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS fecha_fin DATE");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS justificacion_requerida TEXT[]");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS justificantes_urls TEXT[]");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS aprobacion_parcial_at TIMESTAMPTZ");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS aprobacion_final_at TIMESTAMPTZ");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS approver_user_id INTEGER");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS approver_email TEXT");
    await db.query("ALTER TABLE permisos_vacaciones DROP CONSTRAINT IF EXISTS permisos_vacaciones_check1");
    await db.query("ALTER TABLE permisos_vacaciones DROP CONSTRAINT IF EXISTS permisos_vacaciones_subtipo_calamidad_check");
    await db.query(
      "ALTER TABLE permisos_vacaciones ADD CONSTRAINT permisos_vacaciones_subtipo_calamidad_check CHECK ((tipo_permiso = 'calamidad' AND subtipo_calamidad IS NOT NULL AND length(trim(subtipo_calamidad)) > 0) OR tipo_permiso != 'calamidad')"
    );

    tableReady = true;
  })();

  try {
    await tablePromise;
  } finally {
    tablePromise = null;
  }
}

async function createSolicitud({ body, user }) {
  await ensureTable();
  let requesterIdentity = null;
  if (user?.id) {
    try {
      requesterIdentity = await getUserIdentity(user.id);
    } catch (error) {
      logger.warn({ error, userId: user?.id }, "No se pudo resolver identidad del solicitante");
    }
  }
  const payload = { ...body };
  payload.tipo_solicitud = payload.tipo_solicitud || "permiso";
  payload.user_email = requesterIdentity?.email || user?.email;
  payload.user_fullname = requesterIdentity?.fullname || getDisplayName(user);
  payload.user_id = user?.id;
  const approverRole = resolveApproverRole(user?.role || user?.rol || "");
  const approverUser = await findApproverByRole(approverRole);
  payload.approver_role = approverRole;
  payload.approver_user_id = approverUser?.id || null;
  payload.approver_email = approverUser?.email || null;

  let driveMeta = {};
  let justificacionRequerida = [];
  let esRecuperable = false;

  // Validar y procesar segun tipo de solicitud
  if (payload.tipo_solicitud === "permiso") {
    if (
      payload.tipo_permiso === "salud" &&
      !payload.duracion_dias &&
      !payload.duracion_horas &&
      payload.fecha_inicio &&
      payload.fecha_fin
    ) {
      const start = new Date(payload.fecha_inicio);
      const end = new Date(payload.fecha_fin);
      const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
      payload.duracion_dias = diff >= 0 ? diff + 1 : 0;
    }
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

    const requestYear = payload.fecha_inicio
      ? new Date(payload.fecha_inicio).getFullYear()
      : new Date().getFullYear();
    const hireDate = await getHireDate(payload.user_id);
    const allowanceInfo = computeVacationAllowance(hireDate, payload.fecha_inicio || new Date());
    const consumption = await getVacationConsumption({
      userId: payload.user_id,
      userEmail: payload.user_email,
      year: requestYear,
    });
    const historicalBalance = await getHistoricVacationBalance({
      userId: payload.user_id,
      userEmail: payload.user_email,
      year: requestYear,
    });
    const remaining =
      allowanceInfo.allowance + historicalBalance - consumption.approved - consumption.pending;

    if (allowanceInfo.eligible && !allowanceInfo.missingHireDate) {
      if (Number(payload.duracion_dias || 0) > Math.max(remaining, 0)) {
        const err = new Error("No tienes días disponibles para enviar esta solicitud de vacaciones.");
        err.status = 400;
        throw err;
      }
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
      user_email, user_fullname, user_id, approver_role, approver_user_id, approver_email, department_id,
      tipo_solicitud, tipo_permiso, subtipo_calamidad, 
      duracion_horas, duracion_dias, fecha_inicio, fecha_fin, fecha_regreso,
      es_recuperable, periodo_vacaciones, justificacion_requerida, 
      drive_doc_id, drive_pdf_id, drive_doc_link, drive_pdf_link, drive_folder_id,
      status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,'pending') RETURNING *`,
    [
      payload.user_email,
      payload.user_fullname,
      payload.user_id,
      payload.approver_role,
      payload.approver_user_id,
      payload.approver_email,
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

  try {
    if (payload.user_id) {
      await notificationManager.sendNotification({
        userId: payload.user_id,
        customTitle: "Solicitud enviada",
        customMessage: `Tu solicitud de ${payload.tipo_solicitud} fue enviada para aprobaci?n.`,
        type: "info",
        source: "permisos_vacaciones",
        priority: 0,
        email: true,
        meta: {
          solicitud_id: rows[0].id,
          tipo_solicitud: payload.tipo_solicitud,
          solicitante: payload.user_email,
        },
      });
    }
    if (payload.approver_user_id && payload.approver_user_id != payload.user_id) {
      await notificationManager.sendNotification({
        userId: payload.approver_user_id,
        customTitle: "Nueva solicitud de permisos/vacaciones",
        customMessage: `${payload.user_fullname || payload.user_email} ha enviado una solicitud de ${payload.tipo_solicitud}.`,
        type: "task",
        source: "permisos_vacaciones",
        priority: 1,
        email: true,
        meta: {
          solicitud_id: rows[0].id,
          tipo_solicitud: payload.tipo_solicitud,
          solicitante: payload.user_email,
        },
      });
    }
  } catch (notifyError) {
    logger.warn({ notifyError, solicitudId: rows[0]?.id }, "No se pudo enviar notificaci?n de solicitud");
  }

  
return rows[0];
}

function canApprove({ approverRole, approverUserId, approver }) {
  const roleCandidates = getApproverRoleCandidates(approver);
  if (roleCandidates.length === 0) return false;
  if (approverUserId) return approver?.id === approverUserId;
  if (!approverRole) return false;
  const expected = String(approverRole || "").toLowerCase();
  if (GERENCIA_GENERAL_ROLES.has(expected)) {
    return roleCandidates.some((role) => GERENCIA_GENERAL_ROLES.has(role));
  }
  return roleCandidates.includes(expected);
}

async function aprobarParcial({ id, approver }) {
  await ensureTable();
  const existing = await db.query(
    `SELECT approver_role, approver_user_id, status, tipo_solicitud FROM permisos_vacaciones WHERE id = $1 LIMIT 1`,
    [id]
  );
  const solicitud = existing.rows[0];
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (solicitud.tipo_solicitud === "vacaciones") {
    const err = new Error("Las solicitudes de vacaciones se aprueban de forma definitiva");
    err.status = 400;
    throw err;
  }
  if (!canApprove({ approverRole: solicitud.approver_role, approverUserId: solicitud.approver_user_id, approver })) {
    const err = new Error("No autorizado para aprobar esta solicitud");
    err.status = 403;
    throw err;
  }
  const approverName = getDisplayName(approver);
  const { rows } = await db.query(
    `UPDATE permisos_vacaciones
        SET status = 'partially_approved',
            aprobacion_parcial_at = now(),
            aprobacion_parcial_por = $2,
            updated_at = now()
      WHERE id = $1
    RETURNING *`,
    [id, approverName]
  );
  await logAction({ usuario_email: approver?.email, modulo: "permisos", accion: "aprobar_parcial" });
  try {
    if (rows[0]?.user_id) {
      await notificationManager.sendNotification({
        userId: rows[0].user_id,
        customTitle: "Solicitud aprobada parcialmente",
        customMessage: "Tu solicitud fue aprobada parcialmente. Debes subir los justificantes para la aprobación final.",
        type: "info",
        source: "permisos_vacaciones",
        priority: 1,
        email: true,
        meta: { solicitud_id: rows[0].id, tipo_solicitud: rows[0].tipo_solicitud },
      });
    }
  } catch (notifyError) {
    logger.warn({ notifyError, solicitudId: rows[0]?.id }, "No se pudo notificar aprobaci?n parcial");
  }
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

  try {
    const solicitud = rows[0];
    if (solicitud?.approver_user_id && solicitud.approver_user_id != user?.id) {
      await notificationManager.sendNotification({
        userId: solicitud.approver_user_id,
        customTitle: "Justificantes subidos",
        customMessage: `${solicitud.user_fullname || solicitud.user_email} subió justificantes. La solicitud está lista para aprobación final.`,
        type: "info",
        source: "permisos_vacaciones",
        priority: 1,
        email: true,
        meta: { solicitud_id: solicitud.id, tipo_solicitud: solicitud.tipo_solicitud },
      });
    }
  } catch (notifyError) {
    logger.warn({ notifyError, solicitudId: id }, "No se pudo notificar justificantes");
  }
  return rows[0];
}

async function aprobarFinal({ id, approver }) {
  await ensureTable();
  const { rows } = await db.query(`SELECT * FROM permisos_vacaciones WHERE id = $1 LIMIT 1`, [id]);
  const solicitud = rows[0];
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (!canApprove({ approverRole: solicitud.approver_role, approverUserId: solicitud.approver_user_id, approver })) {
    const err = new Error("No autorizado para aprobar esta solicitud");
    err.status = 403;
    throw err;
  }
  const requesterIdentity = await getUserIdentity(solicitud.user_id).catch(() => null);
  const approverIdentity = await getUserIdentity(approver?.id).catch(() => null);
  const approverName = approverIdentity?.fullname || getDisplayName(approver);
  const approvalDate = new Date();

  const pdfPayload = {
    ...solicitud,
    user_fullname: requesterIdentity?.fullname || solicitud.user_fullname || solicitud.user_email,
    user_document_id: requesterIdentity?.cedula || "",
    approver_fullname: approverName,
    approver_document_id: approverIdentity?.cedula || "",
    aprobacion_final_por: approverName,
    aprobacion_final_at: approvalDate,
  };

  const pdfUrl = await generateFRH10(pdfPayload);
  const update = await db.query(
    `UPDATE permisos_vacaciones
        SET status = 'approved',
            aprobacion_final_at = now(),
            aprobacion_final_por = $2,
            pdf_generado_url = $3,
            updated_at = now()
      WHERE id = $1
    RETURNING *`,
    [id, approverName, pdfUrl]
  );
  await logAction({ usuario_email: approver?.email, modulo: "permisos", accion: "aprobar_final" });
  try {
    if (update.rows[0]?.user_id) {
      await notificationManager.sendNotification({
        userId: update.rows[0].user_id,
        customTitle: "Solicitud aprobada",
        customMessage: "Tu solicitud fue aprobada de forma definitiva.",
        type: "success",
        source: "permisos_vacaciones",
        priority: 1,
        email: true,
        meta: { solicitud_id: update.rows[0].id, tipo_solicitud: update.rows[0].tipo_solicitud },
      });
    }
  } catch (notifyError) {
    logger.warn({ notifyError, solicitudId: update.rows[0]?.id }, "No se pudo notificar aprobaci?n final");
  }
  return update.rows[0];
}

async function rechazar({ id, approver, observaciones }) {
  await ensureTable();
  const current = await db.query(`SELECT approver_role, approver_user_id FROM permisos_vacaciones WHERE id = $1 LIMIT 1`, [id]);
  const solicitud = current.rows[0];
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (!canApprove({ approverRole: solicitud.approver_role, approverUserId: solicitud.approver_user_id, approver })) {
    const err = new Error("No autorizado para rechazar esta solicitud");
    err.status = 403;
    throw err;
  }
  const obsArray = Array.isArray(observaciones)
    ? observaciones
    : observaciones
      ? [observaciones]
      : [];
  const approverName = getDisplayName(approver);
  const { rows } = await db.query(
    `UPDATE permisos_vacaciones
        SET status = 'rejected',
            observaciones = $2,
            updated_at = now(),
            aprobacion_final_por = $3,
            aprobacion_final_at = now()
      WHERE id = $1
    RETURNING *`,
    [id, obsArray, approverName]
  );
  await logAction({ usuario_email: approver?.email, modulo: "permisos", accion: "rechazar" });
  try {
    if (rows[0]?.user_id) {
      await notificationManager.sendNotification({
        userId: rows[0].user_id,
        customTitle: "Solicitud rechazada",
        customMessage: "Tu solicitud fue rechazada. Revisa las observaciones.",
        type: "warning",
        source: "permisos_vacaciones",
        priority: 1,
        email: true,
        meta: { solicitud_id: rows[0].id, tipo_solicitud: rows[0].tipo_solicitud, observaciones: rows[0].observaciones },
      });
    }
  } catch (notifyError) {
    logger.warn({ notifyError, solicitudId: rows[0]?.id }, "No se pudo notificar rechazo");
  }
  return rows[0];
}

async function listarPendientes({ stage, approver }) {
  await ensureTable();
  let statusFilter = "pending";
  if (stage === "final" || stage === "pending_final") statusFilter = "pending_final";
  if (stage === "parcial") statusFilter = "pending";
  const roleCandidates = getApproverRoleCandidates(approver);
  if (!approver?.id && roleCandidates.length === 0) return [];
  const { rows } = await db.query(
    `SELECT * FROM permisos_vacaciones
      WHERE status = $1
        AND (
          (approver_user_id IS NOT NULL AND approver_user_id = $2)
          OR
          (approver_user_id IS NULL AND LOWER(COALESCE(approver_role, '')) = ANY($3))
        )
      ORDER BY created_at DESC`,
    [statusFilter, approver?.id || null, roleCandidates]
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

function calculateVacationDays(row) {
  const explicitDays = Number(row?.duracion_dias);
  if (Number.isFinite(explicitDays) && explicitDays > 0) return explicitDays;
  if (!row?.fecha_inicio || !row?.fecha_fin) return 0;
  const start = new Date(row.fecha_inicio);
  const end = new Date(row.fecha_fin);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : 0;
}

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const calculateYearsOfService = (hireDate, asOfDate) => {
  if (!hireDate || !asOfDate) return 0;
  let years = asOfDate.getFullYear() - hireDate.getFullYear();
  const anniversary = new Date(hireDate.getTime());
  anniversary.setFullYear(hireDate.getFullYear() + years);
  if (asOfDate < anniversary) years -= 1;
  return Math.max(years, 0);
};

const computeVacationAllowance = (hireDateValue, asOfValue = new Date()) => {
  const hireDate = normalizeDate(hireDateValue);
  const asOfDate = normalizeDate(asOfValue) || new Date();
  if (!hireDate) {
    return {
      allowance: 0,
      tenureYears: 0,
      eligible: false,
      eligibleFrom: null,
      missingHireDate: true,
    };
  }

  const tenureYears = calculateYearsOfService(hireDate, asOfDate);
  if (tenureYears < 1) {
    const eligibleFrom = new Date(hireDate.getTime() + ONE_YEAR_MS);
    return {
      allowance: 0,
      tenureYears,
      eligible: false,
      eligibleFrom: eligibleFrom.toISOString().split("T")[0],
      accruedThisYear: false,
      missingHireDate: false,
    };
  }

  const anniversaryThisYear = new Date(hireDate.getTime());
  anniversaryThisYear.setFullYear(asOfDate.getFullYear());
  const accruedThisYear = asOfDate >= anniversaryThisYear;
  const eligibleFrom = anniversaryThisYear.toISOString().split("T")[0];
  if (!accruedThisYear) {
    return {
      allowance: 0,
      tenureYears,
      eligible: true,
      eligibleFrom,
      accruedThisYear: false,
      missingHireDate: false,
    };
  }

  const yearsAtAnniversary = calculateYearsOfService(hireDate, anniversaryThisYear);
  const extra = yearsAtAnniversary > 5 ? yearsAtAnniversary - 5 : 0;
  return {
    allowance: Math.min(ANNUAL_ALLOWANCE + extra, MAX_ANNUAL_ALLOWANCE),
    tenureYears,
    eligible: true,
    eligibleFrom,
    accruedThisYear: true,
    missingHireDate: false,
  };
};

async function listarResumenColaboradores() {
  await ensureTable();
  const usersResult = await db.query(
    `SELECT u.id, u.email, u.fullname, u.name,
            cp.profile->'laboral'->>'fecha_ingreso' as fecha_ingreso,
            cp.profile->'extra'->>'applicant_source' as applicant_source
       FROM users u
       LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      ORDER BY COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email, CONCAT('Usuario #', u.id)) ASC`
  );
  const { rows } = await db.query(
    `SELECT
        id,
        user_email,
        user_fullname,
        tipo_solicitud,
        tipo_permiso,
        status,
        duracion_dias,
        duracion_horas,
        justificacion_requerida,
        justificantes_urls,
        fecha_inicio,
        fecha_fin,
        aprobacion_parcial_at,
        aprobacion_final_at,
        created_at
      FROM permisos_vacaciones
      ORDER BY created_at DESC`
  );

  const collaborators = new Map();

  for (const user of usersResult.rows) {
    if (String(user.applicant_source || "").toLowerCase() === "google_forms") {
      continue;
    }
    const userEmail = user.email || null;
    const key = userEmail || `user-${user.id}`;
    if (collaborators.has(key)) continue;
    const allowanceInfo = computeVacationAllowance(user.fecha_ingreso, new Date());
    const year = new Date().getFullYear();
    const historicalBalance = await getHistoricVacationBalance({
      userId: user.id,
      userEmail,
      year,
    });
    const totalAllowance = allowanceInfo.allowance + historicalBalance;
    collaborators.set(key, {
      user_id: user.id,
      user_email: userEmail,
      user_fullname: user.fullname || user.name || userEmail || `Usuario #${user.id}`,
      permisos: {
        total: 0,
        aprobacion_completa: 0,
        aprobacion_parcial: 0,
        pendientes: 0,
        aprobados: 0,
        items: [],
      },
      vacaciones: {
        dias_aprobados: 0,
        dias_pendientes: 0,
        dias_disponibles: totalAllowance,
        dias_restantes: totalAllowance,
        dias_base: allowanceInfo.allowance,
        dias_arrastre: historicalBalance,
        missing_hire_date: allowanceInfo.missingHireDate,
        eligible: allowanceInfo.eligible,
        eligible_from: allowanceInfo.eligibleFrom,
        accrued_this_year: allowanceInfo.accruedThisYear,
        items: [],
      },
    });
  }

  rows.forEach((row) => {
    const key = row.user_email || `user-${row.id}`;
    if (!collaborators.has(key)) {
      collaborators.set(key, {
        user_id: null,
        user_email: row.user_email,
        user_fullname: row.user_fullname,
        permisos: {
          total: 0,
          aprobacion_completa: 0,
          aprobacion_parcial: 0,
          pendientes: 0,
          aprobados: 0,
          items: [],
        },
        vacaciones: {
          dias_aprobados: 0,
          dias_pendientes: 0,
          dias_disponibles: 0,
          dias_restantes: 0,
          dias_base: 0,
          dias_arrastre: 0,
          missing_hire_date: true,
          eligible: false,
          eligible_from: null,
          accrued_this_year: false,
          items: [],
        },
      });
    }

    const record = collaborators.get(key);
    const status = row.status || "pending";

    if (row.tipo_solicitud === "vacaciones") {
      const days = calculateVacationDays(row);
      if (status === "approved" || status === "aprobado") {
        record.vacaciones.dias_aprobados += days;
      } else if (status === "pending" || status === "pendiente" || status === "pending_final" || status === "partially_approved") {
        record.vacaciones.dias_pendientes += days;
      }

      record.vacaciones.items.push({
        id: row.id,
        status,
        fecha_inicio: row.fecha_inicio,
        fecha_fin: row.fecha_fin,
        duracion_dias: days,
        created_at: row.created_at,
      });
    } else {
      record.permisos.total += 1;
      if (status === "approved" || status === "aprobado") {
        record.permisos.aprobacion_completa += 1;
        record.permisos.aprobados += 1;
      } else if (status === "partially_approved") {
        record.permisos.aprobacion_parcial += 1;
      } else if (status === "pending" || status === "pending_final" || status === "pendiente") {
        record.permisos.pendientes += 1;
      }

      record.permisos.items.push({
        id: row.id,
        status,
        tipo_permiso: row.tipo_permiso,
        fecha_inicio: row.fecha_inicio,
        fecha_fin: row.fecha_fin,
        duracion_horas: row.duracion_horas,
        duracion_dias: row.duracion_dias,
        justificacion_requerida: row.justificacion_requerida,
        justificantes_urls: row.justificantes_urls,
        created_at: row.created_at,
        aprobacion_parcial_at: row.aprobacion_parcial_at,
        aprobacion_final_at: row.aprobacion_final_at,
      });
    }
  });

  return Array.from(collaborators.values()).map((record) => {
    const saldo = record.vacaciones.dias_disponibles -
      record.vacaciones.dias_aprobados -
      record.vacaciones.dias_pendientes;
    record.vacaciones.dias_restantes =
      record.vacaciones.eligible === false && !record.vacaciones.missing_hire_date
        ? saldo
        : Math.max(0, saldo);
    return record;
  });
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
  listarResumenColaboradores,
};
