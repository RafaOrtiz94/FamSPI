const fs = require("fs");
const path = require("path");

const db = require("../../config/db");
const logger = require("../../config/logger");
const { logAction } = require("../../utils/audit");
const { ensureFolder, replaceTags, exportPdf } = require("../../utils/drive");
const { drive } = require("../../config/google");
const notificationManager = require("../notifications/notificationManager");

const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID;
const ANNUAL_ALLOWANCE = 15;
const MAX_ANNUAL_ALLOWANCE = 30;
const HOURS_PER_VACATION_DAY = 8;
const TEMPLATE_PATH = path.join(__dirname, "../../data/plantillas/Vacation_Format.docx");
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS vacaciones_solicitudes (
      id SERIAL PRIMARY KEY,
      requester_id INTEGER NOT NULL,
      approver_id INTEGER,
      approver_role TEXT,
      department_id INTEGER,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      return_date DATE NOT NULL,
      period TEXT,
      days INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pendiente',
      drive_doc_id TEXT,
      drive_pdf_id TEXT,
      drive_doc_link TEXT,
      drive_pdf_link TEXT,
      drive_folder_id TEXT,
      advance_request BOOLEAN DEFAULT false,
      advance_eligible_from DATE,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );
  `);
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS advance_request BOOLEAN DEFAULT false");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS advance_eligible_from DATE");
}

const ROLE_APPROVER = {
  comercial: "jefe_comercial",
  acp_comercial: "jefe_comercial",
  marketing: "jefe_comercial",
  backoffice_comercial: "jefe_comercial",
  financiero: "jefe_financiero",
  finanzas: "jefe_financiero",
  tecnico: "jefe_tecnico",
  tecnico_servicio: "jefe_tecnico",
  logistica: "jefe_logistica",
  operaciones: "jefe_operaciones",
  calidad: "jefe_calidad",
};

const HR_ROLES = ["talento-humano", "talento_humano", "talento humano", "rh", "rrhh"];
const MGMT_ROLES = ["gerencia_general", "gerente_general"];
const GERENCIA_GENERAL_ROLES = new Set(["gerencia_general", "gerente_general"]);

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function resolveApproverRole(requesterRole = "") {
  const normalized = normalizeRole(requesterRole);
  const isJefe = normalized.startsWith("jefe_") || normalized.startsWith("jefe");
  if (isJefe) return "gerencia_general";
  return ROLE_APPROVER[normalized] || "gerencia_general";
}

function getApproverRoleCandidates(user = {}) {
  const candidates = new Set(
    [user?.role, user?.scope, user?.role_name, user?.rol]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
  );
  if (candidates.has("gerencia_general")) candidates.add("gerente_general");
  if (candidates.has("gerente_general")) candidates.add("gerencia_general");
  return Array.from(candidates);
}

function diffDaysInclusive(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : 0;
}

async function loadUser(userId) {
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.fullname, u.name, u.role, u.department_id, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1 LIMIT 1`,
    [userId]
  );
  return rows[0];
}

async function getHireDate(userId) {
  const { rows } = await db.query(
    `SELECT cp.profile->'laboral'->>'fecha_ingreso' AS fecha_ingreso
       FROM collaborator_profiles cp
      WHERE cp.user_id = $1
      LIMIT 1`,
    [userId]
  );
  return rows[0]?.fecha_ingreso || null;
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

async function findApprover(targetRole) {
  if (!targetRole) return null;
  const { rows } = await db.query(
    "SELECT id FROM users WHERE LOWER(role) = LOWER($1) ORDER BY id LIMIT 1",
    [targetRole]
  );
  return rows[0]?.id || null;
}

async function computeTakenDays(userId, year) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(days),0) as total
       FROM vacaciones_solicitudes
      WHERE requester_id = $1
        AND status IN ('aprobado','approved')
        AND EXTRACT(YEAR FROM start_date) = $2`,
    [userId, year]
  );
  const vacationDays = Number(rows[0]?.total || 0);
  const chargedDays = await computeChargedVacationDays({ userId, year, statuses: ["approved", "aprobado"] });
  return Math.round(((vacationDays + chargedDays) + Number.EPSILON) * 100) / 100;
}

async function computeChargedVacationDays({ userId, userEmail, year, statuses = [] }) {
  const yearValue = Number(year);
  if (!Number.isFinite(yearValue)) return 0;

  let query = `
    SELECT charged_vacation_days, charged_vacation_hours, duracion_horas, duracion_dias
      FROM permisos_vacaciones
     WHERE charged_to_vacation = true
       AND EXTRACT(YEAR FROM fecha_inicio) = $1
  `;
  const values = [yearValue];

  if (Array.isArray(statuses) && statuses.length > 0) {
    query += ` AND LOWER(COALESCE(status, '')) = ANY($2)`;
    values.push(statuses.map((status) => String(status || "").trim().toLowerCase()));
  }

  if (userId) {
    query += ` AND user_id = $${values.length + 1}`;
    values.push(userId);
  } else if (userEmail) {
    query += ` AND LOWER(user_email) = LOWER($${values.length + 1})`;
    values.push(userEmail);
  } else {
    return 0;
  }

  const { rows } = await db.query(query, values);
  return Math.round(
    (rows.reduce((acc, row) => {
      const explicitDays = Number(row?.charged_vacation_days || 0);
      if (Number.isFinite(explicitDays) && explicitDays > 0) return acc + explicitDays;
      const explicitHours = Number(row?.charged_vacation_hours || row?.duracion_horas || 0);
      if (Number.isFinite(explicitHours) && explicitHours > 0) {
        return acc + explicitHours / HOURS_PER_VACATION_DAY;
      }
      const explicitRequestDays = Number(row?.duracion_dias || 0);
      if (Number.isFinite(explicitRequestDays) && explicitRequestDays > 0) return acc + explicitRequestDays;
      return acc;
    }, 0) + Number.EPSILON) * 100
  ) / 100;
}

async function ensureDrivePath(user) {
  const root = await ensureFolder("Talento Humano", DRIVE_ROOT_FOLDER_ID);
  const permisos = await ensureFolder("Permisos Vacaciones", root.id);
  const deptName = user.department_name || "General";
  const deptFolder = await ensureFolder(deptName, permisos.id);
  const personFolder = await ensureFolder(user.fullname || user.name || user.email || `Usuario-${user.id}`, deptFolder.id);
  return personFolder.id;
}

async function createDriveDocument({ user, start_date, end_date, return_date, period, days, folderId }) {
  const name = `Vacaciones - ${user.fullname || user.name || user.email || "Colaborador"} - ${start_date}`;
  const media = fs.createReadStream(TEMPLATE_PATH);

  const { data: created } = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.document",
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      body: media,
    },
    fields: "id, name, webViewLink",
  });

  await replaceTags(created.id, {
    F_Solicitud: new Date().toLocaleDateString("es-EC"),
    F_Inicio: start_date,
    F_Final: end_date,
    Periodo: period || "",
    Dias: days?.toString() || "",
    F_Regreso: return_date,
    Nombre_Solicitante: user.fullname || user.name || user.email,
    Cedula_Solicitante: user.cedula || user.identificacion || "",
  });

  let pdf = null;
  try {
    pdf = await exportPdf(created.id, folderId, `${name}.pdf`);
  } catch (err) {
    logger.warn({ err }, "No se pudo exportar PDF de vacaciones");
  }

  return {
    drive_doc_id: created.id,
    drive_doc_link: created.webViewLink,
    drive_pdf_id: pdf?.id || null,
    drive_pdf_link: pdf?.webViewLink || null,
  };
}

async function createVacationRequest(payload, userId) {
  await ensureTable();
  const user = await loadUser(userId);
  if (!user) throw new Error("Usuario no encontrado");

  const { start_date, end_date, period, allow_advance } = payload;
  if (!start_date || !end_date) throw new Error("Las fechas de inicio y fin son obligatorias");
  const hireDateValue = await getHireDate(userId);
  const allowanceInfo = computeVacationAllowance(hireDateValue, start_date);
  const days = payload.days || diffDaysInclusive(start_date, end_date);
  const return_date = payload.return_date || new Date(new Date(end_date).getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const year = new Date(start_date).getFullYear();
  const taken = await computeTakenDays(userId, year);
  const historicalBalance = await getHistoricVacationBalance({
    userId,
    userEmail: user.email,
    year,
  });
  const remaining = Math.max(allowanceInfo.allowance + historicalBalance - taken, 0);
  if (allowanceInfo.eligible && !allowanceInfo.missingHireDate && days > remaining) {
    throw new Error("No tienes dias disponibles para enviar esta solicitud de vacaciones.");
  }

  const approverRole = resolveApproverRole(user.role || "");
  const approverId = await findApprover(approverRole) || null;

  let driveMeta = { drive_doc_id: null, drive_doc_link: null, drive_pdf_id: null, drive_pdf_link: null, folderId: null };
  try {
    const folderId = await ensureDrivePath(user);
    const doc = await createDriveDocument({
      user,
      start_date,
      end_date,
      return_date,
      period,
      days,
      folderId,
    });
    driveMeta = { ...doc, folderId };
  } catch (err) {
    logger.warn({ err }, "No se pudo generar documento de vacaciones");
  }

  const { rows } = await db.query(
    `INSERT INTO vacaciones_solicitudes (
      requester_id, approver_id, approver_role, department_id, start_date, end_date, return_date, period, days, status,
      drive_doc_id, drive_pdf_id, drive_doc_link, drive_pdf_link, drive_folder_id,
      advance_request, advance_eligible_from
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10,$11,$12,$13,$14,$15,$16)
    RETURNING *`,
    [
      userId,
      approverId,
      approverRole,
      user.department_id || null,
      start_date,
      end_date,
      return_date,
      period || `${year}`,
      days,
      driveMeta.drive_doc_id,
      driveMeta.drive_pdf_id,
      driveMeta.drive_doc_link,
      driveMeta.drive_pdf_link,
      driveMeta.folderId,
      (!allowanceInfo.eligible && !allowanceInfo.missingHireDate && (allow_advance !== false)) || allowanceInfo.missingHireDate,
      !allowanceInfo.eligible ? allowanceInfo.eligibleFrom : null,
    ]
  );

  await logAction({
    user_id: userId,
    module: "vacaciones",
    action: "create",
    entity: "vacaciones_solicitudes",
    entity_id: rows[0].id,
    details: { start_date, end_date, days },
  });

  try {
    if (userId) {
      await notificationManager.sendNotification({
        userId,
        customTitle: "Solicitud enviada",
        customMessage: "Tu solicitud de vacaciones fue enviada para aprobación.",
        type: "info",
        source: "vacaciones",
        priority: 0,
        email: true,
        meta: { solicitud_id: rows[0].id, solicitante: user.email },
      });
    }
    if (approverId && approverId != userId) {
      await notificationManager.sendNotification({
        userId: approverId,
        customTitle: "Nueva solicitud de vacaciones",
        customMessage: `${user.fullname || user.email} ha enviado una solicitud de vacaciones.`,
        type: "task",
        source: "vacaciones",
        priority: 1,
        email: true,
        meta: { solicitud_id: rows[0].id, solicitante: user.email },
      });
    }
  } catch (notifyError) {
    logger.warn({ notifyError, solicitudId: rows[0]?.id }, "No se pudo enviar notificaci?n de vacaciones");
  }

  return { ...rows[0], remaining_before: remaining };
}

async function listVacationRequests(params = {}, user) {
  await ensureTable();
  const role = (user.role || "").toLowerCase();
  const scope = params.scope || "mine";

  const where = [];
  const values = [];
  let idx = 1;

  if (params.status) {
    where.push(`LOWER(status) = LOWER($${idx++})`);
    values.push(params.status);
  }

  const canSeeAll = HR_ROLES.includes(role) || MGMT_ROLES.includes(role);
  if (scope === "pending") {
    const roleCandidates = getApproverRoleCandidates(user);
    where.push(`status = 'pendiente'`);
    where.push(`(approver_id = $${idx} OR (approver_id IS NULL AND LOWER(COALESCE(approver_role, '')) = ANY($${idx + 1})))`);
    values.push(user.id, roleCandidates);
    idx += 2;
  } else if (!canSeeAll || scope === "mine") {
    where.push(`requester_id = $${idx++}`);
    values.push(user.id);
  }

  const { rows } = await db.query(
    `SELECT v.*, u.fullname as requester_name, u.email as requester_email
       FROM vacaciones_solicitudes v
       LEFT JOIN users u ON u.id = v.requester_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY v.created_at DESC
      LIMIT 200`,
    values
  );

  return rows;
}

async function updateVacationStatus(id, status, user) {
  await ensureTable();
  const normalized = (status || "").toLowerCase();
  if (!['aprobado', 'rechazado', 'approved', 'rejected'].includes(normalized)) {
    throw new Error("Estado inválido");
  }

  const { rows } = await db.query("SELECT * FROM vacaciones_solicitudes WHERE id = $1", [id]);
  const current = rows[0];
  if (!current) throw new Error("Solicitud no encontrada");

  const roleCandidates = getApproverRoleCandidates(user);
  const canApprove =
    current.approver_id === user.id ||
    (current.approver_id == null &&
      current.approver_role &&
      (
        GERENCIA_GENERAL_ROLES.has(String(current.approver_role).toLowerCase())
          ? roleCandidates.some((candidate) => GERENCIA_GENERAL_ROLES.has(candidate))
          : roleCandidates.includes(String(current.approver_role).toLowerCase())
      ));

  if (!canApprove) throw new Error("No tienes permisos para esta acción");

  const mappedStatus = normalized.startsWith("ap") || normalized === "approved" ? "aprobado" : "rechazado";

  const { rows: updated } = await db.query(
    `UPDATE vacaciones_solicitudes
        SET status = $1, updated_at = now(), approver_id = COALESCE(approver_id, $2)
      WHERE id = $3 RETURNING *`,
    [mappedStatus, user.id, id]
  );

  await logAction({
    user_id: user.id,
    module: "vacaciones",
    action: mappedStatus,
    entity: "vacaciones_solicitudes",
    entity_id: id,
  });

  try {
    if (updated[0]?.requester_id) {
      const isApproved = mappedStatus === "aprobado";
      await notificationManager.sendNotification({
        userId: updated[0].requester_id,
        customTitle: isApproved ? "Vacaciones aprobadas" : "Vacaciones rechazadas",
        customMessage: isApproved
          ? "Tu solicitud de vacaciones fue aprobada."
          : "Tu solicitud de vacaciones fue rechazada.",
        type: isApproved ? "success" : "warning",
        source: "vacaciones",
        priority: 1,
        email: true,
        meta: { solicitud_id: updated[0].id, status: mappedStatus },
      });
    }
  } catch (notifyError) {
    logger.warn({ notifyError, solicitudId: updated[0]?.id }, "No se pudo notificar estado de vacaciones");
  }
  return updated[0];
}

async function summary(user, includeAll = false) {
  await ensureTable();
  const role = (user.role || "").toLowerCase();
  const canSeeAll = includeAll || HR_ROLES.includes(role) || MGMT_ROLES.includes(role);

  if (!canSeeAll) {
    const year = new Date().getFullYear();
    const taken = await computeTakenDays(user.id, year);
    const hireDateValue = await getHireDate(user.id);
    const allowanceInfo = computeVacationAllowance(hireDateValue, new Date());
    const historicalBalance = await getHistoricVacationBalance({
      userId: user.id,
      userEmail: user.email,
      year,
    });
    const { rows: pendingRows } = await db.query(
      `SELECT COALESCE(SUM(days),0) as total FROM vacaciones_solicitudes
        WHERE requester_id=$1 AND status='pendiente' AND EXTRACT(YEAR FROM start_date)=$2`,
      [user.id, year]
    );
    const pending = Number(pendingRows[0]?.total || 0);
    const chargedFromPermisos = await computeChargedVacationDays({
      userId: user.id,
      userEmail: user.email,
      year,
      statuses: ["approved", "aprobado"],
    });
    const totalAllowance = allowanceInfo.allowance + historicalBalance;

    return {
      year,
      allowance: totalAllowance,
      allowance_base: allowanceInfo.allowance,
      carry_over: historicalBalance,
      tenure_years: allowanceInfo.tenureYears,
      eligible: allowanceInfo.eligible,
      eligible_from: allowanceInfo.eligibleFrom,
      accrued_this_year: allowanceInfo.accruedThisYear,
      missing_hire_date: allowanceInfo.missingHireDate,
      taken,
      pending,
      charged_from_permisos: chargedFromPermisos,
      remaining:
        !allowanceInfo.missingHireDate && !allowanceInfo.eligible
          ? totalAllowance - taken - pending
          : Math.max(totalAllowance - taken - pending, 0),
    };
  }

  const { rows } = await db.query(
    `SELECT u.id as user_id, u.fullname, u.email, d.name as department,
            MAX(cp.profile->'laboral'->>'fecha_ingreso') as fecha_ingreso,
            COALESCE(SUM(CASE WHEN v.status='aprobado' THEN v.days ELSE 0 END),0) as taken,
            COALESCE(SUM(CASE WHEN v.status='pendiente' THEN v.days ELSE 0 END),0) as pending
       FROM users u
       LEFT JOIN vacaciones_solicitudes v ON v.requester_id = u.id
       LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
       LEFT JOIN departments d ON d.id = u.department_id
      WHERE (COALESCE(cp.profile->'extra'->>'applicant_source','') <> 'google_forms'
        AND COALESCE((cp.profile->'extra' ? 'preguntas_adicionales'), false) = false)
      GROUP BY u.id, u.fullname, u.email, d.name
      ORDER BY u.fullname`);

  return Promise.all(rows.map(async (r) => {
    const allowanceInfo = computeVacationAllowance(r.fecha_ingreso, new Date());
    const historicalBalance = await getHistoricVacationBalance({
      userId: r.user_id,
      userEmail: r.email,
      year: new Date().getFullYear(),
    });
    const chargedFromPermisos = await computeChargedVacationDays({
      userId: r.user_id,
      userEmail: r.email,
      year: new Date().getFullYear(),
      statuses: ["approved", "aprobado"],
    });
    const totalAllowance = allowanceInfo.allowance + historicalBalance;
    const taken = Number(r.taken || 0) + chargedFromPermisos;
    return {
      ...r,
      ...allowanceInfo,
      allowance: totalAllowance,
      allowance_base: allowanceInfo.allowance,
      carry_over: historicalBalance,
      charged_from_permisos: chargedFromPermisos,
      taken,
      missing_hire_date: allowanceInfo.missingHireDate,
      remaining:
        !allowanceInfo.missingHireDate && !allowanceInfo.eligible
          ? totalAllowance - taken - Number(r.pending || 0)
          : Math.max(
              totalAllowance - taken - Number(r.pending || 0),
              0
            ),
    };
  }));
}

module.exports = {
  createVacationRequest,
  listVacationRequests,
  updateVacationStatus,
  summary,
};
