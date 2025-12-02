const fs = require("fs");
const path = require("path");

const db = require("../../config/db");
const logger = require("../../config/logger");
const { logAction } = require("../../utils/audit");
const { ensureFolder, replaceTags, exportPdf } = require("../../utils/drive");
const { drive } = require("../../config/google");

const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID;
const ANNUAL_ALLOWANCE = 15;
const TEMPLATE_PATH = path.join(__dirname, "../../data/plantillas/Vacation_Format.docx");

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
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );
  `);
}

const ROLE_APPROVER = {
  comercial: "jefe_comercial",
  acp_comercial: "jefe_comercial",
  backoffice: "jefe_comercial",
  backoffice_comercial: "jefe_comercial",
  jefe_comercial: "gerencia",
  tecnico: "jefe_tecnico",
  tecnico_servicio: "jefe_tecnico",
  jefe_tecnico: "gerencia",
  calidad: "jefe_calidad",
  jefe_calidad: "gerencia",
};

const HR_ROLES = ["talento-humano", "talento_humano", "talento humano", "rh", "rrhh"];
const MGMT_ROLES = ["gerencia", "gerencia_general", "gerente_general", "director", "gerente"];

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
  return parseInt(rows[0]?.total || 0, 10);
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

  const { start_date, end_date, period } = payload;
  if (!start_date || !end_date) throw new Error("Las fechas de inicio y fin son obligatorias");

  const days = payload.days || diffDaysInclusive(start_date, end_date);
  const return_date = payload.return_date || new Date(new Date(end_date).getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const year = new Date(start_date).getFullYear();
  const taken = await computeTakenDays(userId, year);
  const remaining = Math.max(ANNUAL_ALLOWANCE - taken, 0);

  const approverRole = ROLE_APPROVER[(user.role || "").toLowerCase()] || "gerencia";
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
      drive_doc_id, drive_pdf_id, drive_doc_link, drive_pdf_link, drive_folder_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10,$11,$12,$13,$14)
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
  if (scope === "pending" && !canSeeAll) {
    where.push(`status = 'pendiente'`);
    where.push(`(approver_id = $${idx} OR approver_role = LOWER($${idx + 1}))`);
    values.push(user.id, role);
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

  const role = (user.role || "").toLowerCase();
  const canApprove =
    HR_ROLES.includes(role) ||
    MGMT_ROLES.includes(role) ||
    current.approver_id === user.id ||
    (current.approver_role && current.approver_role.toLowerCase() === role);

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

  return updated[0];
}

async function summary(user, includeAll = false) {
  await ensureTable();
  const role = (user.role || "").toLowerCase();
  const canSeeAll = includeAll || HR_ROLES.includes(role) || MGMT_ROLES.includes(role);

  if (!canSeeAll) {
    const year = new Date().getFullYear();
    const taken = await computeTakenDays(user.id, year);
    const { rows: pendingRows } = await db.query(
      `SELECT COALESCE(SUM(days),0) as total FROM vacaciones_solicitudes
        WHERE requester_id=$1 AND status='pendiente' AND EXTRACT(YEAR FROM start_date)=$2`,
      [user.id, year]
    );
    const pending = parseInt(pendingRows[0]?.total || 0, 10);

    return {
      year,
      allowance: ANNUAL_ALLOWANCE,
      taken,
      pending,
      remaining: Math.max(ANNUAL_ALLOWANCE - taken - pending, 0),
    };
  }

  const { rows } = await db.query(
    `SELECT u.id as user_id, u.fullname, u.email, d.name as department,
            COALESCE(SUM(CASE WHEN v.status='aprobado' THEN v.days ELSE 0 END),0) as taken,
            COALESCE(SUM(CASE WHEN v.status='pendiente' THEN v.days ELSE 0 END),0) as pending
       FROM users u
       LEFT JOIN vacaciones_solicitudes v ON v.requester_id = u.id
       LEFT JOIN departments d ON d.id = u.department_id
      GROUP BY u.id, u.fullname, u.email, d.name
      ORDER BY u.fullname`);

  return rows.map((r) => ({
    ...r,
    allowance: ANNUAL_ALLOWANCE,
    remaining: Math.max(ANNUAL_ALLOWANCE - Number(r.taken || 0) - Number(r.pending || 0), 0),
  }));
}

module.exports = {
  createVacationRequest,
  listVacationRequests,
  updateVacationStatus,
  summary,
};
