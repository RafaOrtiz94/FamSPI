const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const db = require("../../config/db");
const logger = require("../../config/logger");
const { logAction } = require("../../utils/audit");
const { ensureFolder, replaceTags, exportPdf } = require("../../utils/drive");
const { drive } = require("../../config/google");
const notificationManager = require("../notifications/notificationManager");
const { generateFirmaLegalValidationPdf } = require("../permisos/permisos.pdf");
const { createTimeOffEvent } = require("../../utils/calendar");

const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID;
const ANNUAL_ALLOWANCE = 15;
const MAX_ANNUAL_ALLOWANCE = 30;
const TEMPLATE_PATH = path.join(__dirname, "../../data/plantillas/Vacation_Format.docx");
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const resolveLegalVerificationBaseUrl = () => {
  if (process.env.LEGAL_VERIFICATION_BASE_URL) return process.env.LEGAL_VERIFICATION_BASE_URL;
  if (process.env.BACKEND_BASE_URL) return process.env.BACKEND_BASE_URL;
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;
  if (process.env.GOOGLE_REDIRECT_URI) {
    try {
      return new URL(process.env.GOOGLE_REDIRECT_URI).origin;
    } catch (_) {
      // ignore invalid URL
    }
  }
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  return "https://spi-backend-983537733948.us-central1.run.app";
};
const LEGAL_VERIFICATION_BASE_URL = resolveLegalVerificationBaseUrl();

function buildVacationCalendarDescription({ solicitudId, status, period, days }) {
  const lines = [
    "Solicitud de vacaciones registrada en SPI.",
    `ID: ${solicitudId}`,
    `Estado: ${status || "pendiente"}`,
  ];
  if (period) lines.push(`Periodo: ${period}`);
  if (Number.isFinite(Number(days))) lines.push(`Dias: ${days}`);
  return lines.join("\n");
}

function buildWorkdayDateTime(dateValue, timeValue) {
  if (!dateValue) return null;
  let dateOnly = null;
  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    dateOnly = dateValue.toISOString().slice(0, 10);
  } else {
    const raw = String(dateValue).trim();
    dateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || null;
  }
  if (!dateOnly) return null;
  return `${dateOnly}T${timeValue}:00`;
}

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
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS pdf_validacion_legal_url TEXT");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS legal_verification_token TEXT");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS legal_verification_created_at TIMESTAMPTZ");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(6,2)");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS cancelled_by_user_id INTEGER");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS cancelled_by_email TEXT");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS cancellation_reason TEXT");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS cancellation_status TEXT NOT NULL DEFAULT 'none'");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS cancellation_requested_by_user_id INTEGER");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS cancellation_requested_by_email TEXT");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS cancellation_request_reason TEXT");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS cancellation_reviewed_at TIMESTAMPTZ");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS cancellation_reviewed_by_user_id INTEGER");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS cancellation_reviewed_by_email TEXT");
  await db.query("ALTER TABLE vacaciones_solicitudes ADD COLUMN IF NOT EXISTS cancellation_review_reason TEXT");
  await db.query("ALTER TABLE vacaciones_solicitudes DROP CONSTRAINT IF EXISTS vacaciones_solicitudes_cancellation_status_check");
  await db.query(
    "ALTER TABLE vacaciones_solicitudes ADD CONSTRAINT vacaciones_solicitudes_cancellation_status_check CHECK (cancellation_status IN ('none','pending','approved','rejected'))"
  );
  await db.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS ux_vacaciones_legal_verification_token
     ON vacaciones_solicitudes (legal_verification_token)
     WHERE legal_verification_token IS NOT NULL`
  );
  await db.query(`
    CREATE TABLE IF NOT EXISTS vacaciones_solicitudes_firmas (
      id BIGSERIAL PRIMARY KEY,
      solicitud_id BIGINT NOT NULL REFERENCES vacaciones_solicitudes(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      signer_user_id INTEGER NOT NULL REFERENCES users(id),
      signer_email TEXT,
      signer_name TEXT NOT NULL,
      signer_role TEXT,
      signature_type TEXT NOT NULL DEFAULT 'advanced_electronic',
      auth_method TEXT NOT NULL DEFAULT 'oauth_corporate',
      consent_text TEXT,
      ip_address INET,
      user_agent TEXT,
      session_id TEXT,
      payload_hash_sha256 VARCHAR(64) NOT NULL,
      previous_signature_hash_sha256 VARCHAR(64),
      signature_hash_sha256 VARCHAR(64) NOT NULL,
      is_current BOOLEAN NOT NULL DEFAULT true,
      signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT vacaciones_firmas_stage_check
        CHECK (stage IN ('solicitud', 'aprobacion_final', 'rechazo')),
      CONSTRAINT vacaciones_firmas_payload_hash_check
        CHECK (payload_hash_sha256 ~ '^[a-f0-9]{64}$'),
      CONSTRAINT vacaciones_firmas_signature_hash_check
        CHECK (signature_hash_sha256 ~ '^[a-f0-9]{64}$'),
      CONSTRAINT vacaciones_firmas_prev_hash_check
        CHECK (previous_signature_hash_sha256 IS NULL OR previous_signature_hash_sha256 ~ '^[a-f0-9]{64}$')
    );
  `);
  await db.query(`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY solicitud_id, stage
               ORDER BY signed_at DESC, id DESC
             ) AS rn
        FROM vacaciones_solicitudes_firmas
    )
    UPDATE vacaciones_solicitudes_firmas f
       SET is_current = (ranked.rn = 1)
     FROM ranked
     WHERE ranked.id = f.id
  `);
  await db.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS ux_vacaciones_firmas_current_stage
     ON vacaciones_solicitudes_firmas (solicitud_id, stage)
     WHERE is_current = true`
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_vacaciones_firmas_solicitud_signed_at
     ON vacaciones_solicitudes_firmas (solicitud_id, signed_at DESC, id DESC)`
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_vacaciones_firmas_signer_user
     ON vacaciones_solicitudes_firmas (signer_user_id, signed_at DESC)`
  );
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
  ti: "jefe_ti",
  admin_ti: "jefe_ti",
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
  if (candidates.has("jefe_finanzas")) candidates.add("jefe_financiero");
  if (candidates.has("jefe_financiero")) candidates.add("jefe_finanzas");
  if (candidates.has("finanzas")) candidates.add("financiero");
  if (candidates.has("financiero")) candidates.add("finanzas");
  if (candidates.has("gerencia_general")) candidates.add("gerente_general");
  if (candidates.has("gerente_general")) candidates.add("gerencia_general");
  return Array.from(candidates);
}

function getRequestMeta(meta = {}) {
  return {
    ipAddress: meta?.ipAddress || null,
    userAgent: meta?.userAgent || null,
    sessionId: meta?.sessionId || null,
  };
}

function stableStringify(input) {
  if (input === null || input === undefined) return "";
  if (Array.isArray(input)) return `[${input.map((item) => stableStringify(item)).join(",")}]`;
  if (input instanceof Date) return input.toISOString();
  if (typeof input === "object") {
    return `{${Object.keys(input)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(input[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(input);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function generateLegalVerificationToken() {
  return crypto.randomBytes(24).toString("hex");
}

function buildLegalVerificationUrl(token) {
  if (!token) return null;
  return `${String(LEGAL_VERIFICATION_BASE_URL).replace(/\/+$/, "")}/api/v1/vacaciones/legal-verification/${token}`;
}

function buildVacationSignatureSnapshot(solicitud = {}) {
  return {
    id: solicitud.id,
    requester_id: solicitud.requester_id,
    approver_id: solicitud.approver_id,
    approver_role: solicitud.approver_role,
    start_date: solicitud.start_date,
    end_date: solicitud.end_date,
    return_date: solicitud.return_date,
    days: solicitud.days,
    status: solicitud.status,
    updated_at: solicitud.updated_at,
  };
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

async function getVacationSignaturesBySolicitudId(solicitudId) {
  if (!solicitudId) return [];
  const { rows } = await db.query(
    `SELECT id, solicitud_id, stage, signer_user_id, signer_email, signer_name, signer_role,
            signature_type, auth_method, consent_text, ip_address::text AS ip_address,
            user_agent, session_id, payload_hash_sha256, previous_signature_hash_sha256,
            signature_hash_sha256, is_current, signed_at, created_at
       FROM vacaciones_solicitudes_firmas
      WHERE solicitud_id = $1
      ORDER BY signed_at ASC, id ASC`,
    [solicitudId]
  );
  return rows.map((row) => ({
    ...row,
    legal_verification_url: buildLegalVerificationUrl(row.legal_verification_token || null),
  }));
}

async function recordVacationWorkflowSignature({ solicitud, stage, actor, meta = {}, consentText }) {
  const actorId = Number(actor?.id || actor?.user_id || 0);
  if (!solicitud?.id || !actorId || !stage) return null;

  const { rows: previousRows } = await db.query(
    `SELECT signature_hash_sha256
       FROM vacaciones_solicitudes_firmas
      WHERE solicitud_id = $1
      ORDER BY signed_at DESC, id DESC
      LIMIT 1`,
    [solicitud.id]
  );
  const previousSignatureHash = previousRows[0]?.signature_hash_sha256 || null;
  const signedAtIso = new Date().toISOString();
  const payloadHash = sha256Hex(stableStringify(buildVacationSignatureSnapshot(solicitud)));
  const signatureHash = sha256Hex(
    stableStringify({
      solicitud_id: solicitud.id,
      stage,
      signer_user_id: actorId,
      signer_email: actor?.email || null,
      signed_at: signedAtIso,
      payload_hash_sha256: payloadHash,
      previous_signature_hash_sha256: previousSignatureHash,
    })
  );
  const requestMeta = getRequestMeta(meta);

  await db.query(
    `UPDATE vacaciones_solicitudes_firmas
        SET is_current = false, updated_at = NOW()
      WHERE solicitud_id = $1
        AND stage = $2
        AND is_current = true`,
    [solicitud.id, stage]
  );

  const { rows } = await db.query(
    `INSERT INTO vacaciones_solicitudes_firmas (
      solicitud_id, stage, signer_user_id, signer_email, signer_name, signer_role,
      signature_type, auth_method, consent_text, ip_address, user_agent, session_id,
      payload_hash_sha256, previous_signature_hash_sha256, signature_hash_sha256, is_current, signed_at
    ) VALUES ($1,$2,$3,$4,$5,$6,'advanced_electronic','oauth_corporate',$7,$8,$9,$10,$11,$12,$13,true,$14)
    RETURNING *`,
    [
      solicitud.id,
      stage,
      actorId,
      actor?.email || null,
      actor?.fullname || actor?.name || actor?.email || `Usuario #${actorId}`,
      String(actor?.role || actor?.scope || actor?.rol || "").toLowerCase() || null,
      consentText || `FamSign ${stage} en vacaciones SPI`,
      requestMeta.ipAddress,
      requestMeta.userAgent,
      requestMeta.sessionId,
      payloadHash,
      previousSignatureHash,
      signatureHash,
      signedAtIso,
    ]
  );
  return rows[0] || null;
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

async function createVacationRequest(payload, userId, meta = {}) {
  await ensureTable();
  const user = await loadUser(userId);
  if (!user) throw new Error("Usuario no encontrado");

  const { start_date, end_date, period, allow_advance } = payload;
  const startTime = payload?.start_time ? new Date(payload.start_time) : null;
  const endTime = payload?.end_time ? new Date(payload.end_time) : null;
  let durationHours = Number(payload?.duration_hours || 0);
  if (startTime && endTime && !Number.isNaN(startTime.getTime()) && !Number.isNaN(endTime.getTime())) {
    const diffHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    if (diffHours <= 0) throw new Error("El rango horario de vacaciones no es válido");
    durationHours = Math.round(diffHours * 100) / 100;
  }
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
      advance_request, advance_eligible_from, start_time, end_time, duration_hours
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
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
      startTime && !Number.isNaN(startTime.getTime()) ? startTime.toISOString() : null,
      endTime && !Number.isNaN(endTime.getTime()) ? endTime.toISOString() : null,
      durationHours > 0 ? durationHours : null,
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
        customMessage: "Tu solicitud de vacaciones fue enviada para aprobaci?n.",
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

  try {
    await recordVacationWorkflowSignature({
      solicitud: rows[0],
      stage: "solicitud",
      actor: user,
      meta,
      consentText: "Confirmo la solicitud de vacaciones en SPI",
    });
  } catch (signatureError) {
    logger.warn({ signatureError, solicitudId: rows[0]?.id }, "No se pudo registrar FamSign en vacaciones (solicitud)");
  }

  const signatures = await getVacationSignaturesBySolicitudId(rows[0]?.id);
  return { ...rows[0], remaining_before: remaining, firmas_workflow: signatures };
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
    where.push(`(approver_id = $${idx} OR LOWER(COALESCE(approver_role, '')) = ANY($${idx + 1}))`);
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

async function updateVacationStatus(id, status, user, meta = {}) {
  await ensureTable();
  const normalized = (status || "").toLowerCase();
  if (!['aprobado', 'rechazado', 'approved', 'rejected'].includes(normalized)) {
    throw new Error("Estado invÃ¡lido");
  }

  const { rows } = await db.query("SELECT * FROM vacaciones_solicitudes WHERE id = $1", [id]);
  const current = rows[0];
  if (!current) throw new Error("Solicitud no encontrada");

  const roleCandidates = getApproverRoleCandidates(user);
  const canApprove =
    current.approver_id === user.id ||
    (current.approver_role &&
      (
        GERENCIA_GENERAL_ROLES.has(String(current.approver_role).toLowerCase())
          ? roleCandidates.some((candidate) => GERENCIA_GENERAL_ROLES.has(candidate))
          : roleCandidates.includes(String(current.approver_role).toLowerCase())
      ));

  if (!canApprove) throw new Error("No tienes permisos para esta acciÃ³n");

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

  let verificationToken = updated[0]?.legal_verification_token || null;
  if (!verificationToken) {
    verificationToken = generateLegalVerificationToken();
    await db.query(
      `UPDATE vacaciones_solicitudes
          SET legal_verification_token = $2,
              legal_verification_created_at = COALESCE(legal_verification_created_at, NOW()),
              updated_at = now()
        WHERE id = $1`,
      [id, verificationToken]
    );
  }

  const signatureStage = mappedStatus === "aprobado" ? "aprobacion_final" : "rechazo";
  try {
    await recordVacationWorkflowSignature({
      solicitud: updated[0],
      stage: signatureStage,
      actor: user,
      meta,
      consentText:
        mappedStatus === "aprobado"
          ? "Confirmo la aprobacion final de vacaciones en SPI"
          : "Confirmo el rechazo de vacaciones en SPI",
    });
  } catch (signatureError) {
    logger.warn({ signatureError, solicitudId: updated[0]?.id }, "No se pudo registrar firma en vacaciones");
  }

  let legalPdfUrl = null;
  try {
    const requester = await loadUser(updated[0]?.requester_id);
    const signatures = await getVacationSignaturesBySolicitudId(updated[0]?.id);
    legalPdfUrl = await generateFirmaLegalValidationPdf({
      solicitud: {
        id: updated[0]?.id,
        tipo_solicitud: "vacaciones",
        status: updated[0]?.status,
        user_id: updated[0]?.requester_id,
        user_email: requester?.email || null,
        user_fullname: requester?.fullname || requester?.name || requester?.email || null,
        approver_fullname: user?.fullname || user?.name || user?.email || null,
        approver_email: user?.email || null,
        pdf_generado_url: updated[0]?.drive_pdf_link || updated[0]?.drive_doc_link || null,
        drive_folder_id: updated[0]?.drive_folder_id || null,
      },
      signatures,
      verification: {
        token: verificationToken,
        url: buildLegalVerificationUrl(verificationToken),
      },
    });
  } catch (legalPdfError) {
    logger.warn({ legalPdfError, solicitudId: updated[0]?.id }, "No se pudo generar constancia legal de vacaciones");
  }

  if (legalPdfUrl) {
    await db.query(
      `UPDATE vacaciones_solicitudes
          SET pdf_validacion_legal_url = $2, updated_at = now()
        WHERE id = $1`,
      [id, legalPdfUrl]
    );
  }

  if (mappedStatus === "aprobado") {
    try {
      const requester = await loadUser(updated[0]?.requester_id);
      const startDateTime = buildWorkdayDateTime(updated[0]?.start_date, "09:00");
      const endDateTime = buildWorkdayDateTime(updated[0]?.end_date, "18:00");
      const effectiveStartDateTime = updated[0]?.start_time || startDateTime;
      const effectiveEndDateTime = updated[0]?.end_time || endDateTime;
      await createTimeOffEvent({
        userEmail: requester?.email || null,
        summary: `Vacaciones - ${requester?.fullname || requester?.email || "Colaborador"}`,
        description: buildVacationCalendarDescription({
          solicitudId: updated[0]?.id,
          status: updated[0]?.status,
          period: updated[0]?.period,
          days: updated[0]?.days,
        }),
        startDate: updated[0]?.start_date,
        endDate: updated[0]?.end_date,
        startDateTime: effectiveStartDateTime,
        endDateTime: effectiveEndDateTime,
        reminderMinutesBefore: 1440,
      });
    } catch (calendarError) {
      logger.warn(
        { calendarError, solicitudId: updated[0]?.id, requesterId: updated[0]?.requester_id },
        "No se pudo crear evento de calendario en aprobacion final de vacaciones"
      );
    }
  }

  const signatures = await getVacationSignaturesBySolicitudId(updated[0]?.id);
  return {
    ...updated[0],
    firmas_workflow: signatures,
    pdf_validacion_legal_url: legalPdfUrl || updated[0]?.pdf_validacion_legal_url || null,
    legal_verification_token: verificationToken || updated[0]?.legal_verification_token || null,
    legal_verification_url: buildLegalVerificationUrl(verificationToken || updated[0]?.legal_verification_token || null),
  };
}

async function cancelVacationRequest(id, reason, actor) {
  await ensureTable();
  const trimmedReason = String(reason || "").trim();
  if (!trimmedReason) throw new Error("Debes registrar el motivo de cancelación");

  const { rows } = await db.query("SELECT * FROM vacaciones_solicitudes WHERE id = $1", [id]);
  const current = rows[0];
  if (!current) throw new Error("Solicitud no encontrada");
  if (["rechazado", "cancelado"].includes(String(current.status || "").toLowerCase())) {
    throw new Error("La solicitud ya no puede ser cancelada");
  }

  const actorId = Number(actor?.id || 0);
  const roleCandidates = getApproverRoleCandidates(actor);
  const isRequester = Number(current.requester_id) === actorId;
  const isApprover =
    Number(current.approver_id) === actorId ||
    (current.approver_role &&
      (GERENCIA_GENERAL_ROLES.has(String(current.approver_role).toLowerCase())
        ? roleCandidates.some((candidate) => GERENCIA_GENERAL_ROLES.has(candidate))
        : roleCandidates.includes(String(current.approver_role).toLowerCase())));
  if (!isRequester && !isApprover) throw new Error("No tienes permisos para cancelar esta solicitud");

  const normalizedStatus = String(current.status || "").toLowerCase();
  if (!["aprobado", "approved"].includes(normalizedStatus)) {
    throw new Error("Solo solicitudes aprobadas pueden entrar en flujo de cancelación");
  }

  if (isRequester && !isApprover) {
    if (String(current.cancellation_status || "none").toLowerCase() === "pending") {
      throw new Error("Ya existe una solicitud de cancelación pendiente");
    }
    const { rows: requested } = await db.query(
      `UPDATE vacaciones_solicitudes
          SET cancellation_status = 'pending',
              cancellation_requested_at = NOW(),
              cancellation_requested_by_user_id = $2,
              cancellation_requested_by_email = $3,
              cancellation_request_reason = $4,
              cancellation_reviewed_at = NULL,
              cancellation_reviewed_by_user_id = NULL,
              cancellation_reviewed_by_email = NULL,
              cancellation_review_reason = NULL,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [id, actorId || null, actor?.email || null, trimmedReason]
    );
    return requested[0];
  }

  const { rows: updated } = await db.query(
    `UPDATE vacaciones_solicitudes
        SET status = 'cancelado',
            cancelled_at = NOW(),
            cancelled_by_user_id = $2,
            cancelled_by_email = $3,
            cancellation_reason = $4,
            cancellation_status = 'approved',
            cancellation_reviewed_at = NOW(),
            cancellation_reviewed_by_user_id = $2,
            cancellation_reviewed_by_email = $3,
            cancellation_review_reason = $4,
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, actorId || null, actor?.email || null, trimmedReason]
  );
  return updated[0];
}

async function reviewVacationCancellation(id, decision, reason, actor) {
  await ensureTable();
  const normalizedDecision = String(decision || "").toLowerCase();
  if (!["approve", "reject"].includes(normalizedDecision)) throw new Error("Decision inválida");
  const trimmedReason = String(reason || "").trim();
  if (!trimmedReason) throw new Error("Debes registrar el motivo de la decisión");

  const { rows } = await db.query("SELECT * FROM vacaciones_solicitudes WHERE id = $1", [id]);
  const current = rows[0];
  if (!current) throw new Error("Solicitud no encontrada");
  if (String(current.cancellation_status || "none").toLowerCase() !== "pending") {
    throw new Error("No existe una cancelación pendiente para esta solicitud");
  }

  const actorId = Number(actor?.id || 0);
  const roleCandidates = getApproverRoleCandidates(actor);
  const isApprover =
    Number(current.approver_id) === actorId ||
    (current.approver_role &&
      (GERENCIA_GENERAL_ROLES.has(String(current.approver_role).toLowerCase())
        ? roleCandidates.some((candidate) => GERENCIA_GENERAL_ROLES.has(candidate))
        : roleCandidates.includes(String(current.approver_role).toLowerCase())));
  if (!isApprover) throw new Error("No tienes permisos para revisar esta cancelación");

  if (normalizedDecision === "approve") {
    const { rows: updated } = await db.query(
      `UPDATE vacaciones_solicitudes
          SET status = 'cancelado',
              cancelled_at = NOW(),
              cancelled_by_user_id = $2,
              cancelled_by_email = $3,
              cancellation_reason = COALESCE(cancellation_request_reason, $4),
              cancellation_status = 'approved',
              cancellation_reviewed_at = NOW(),
              cancellation_reviewed_by_user_id = $2,
              cancellation_reviewed_by_email = $3,
              cancellation_review_reason = $4,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [id, actorId || null, actor?.email || null, trimmedReason]
    );
    return updated[0];
  }

  const { rows: updated } = await db.query(
    `UPDATE vacaciones_solicitudes
        SET cancellation_status = 'rejected',
            cancellation_reviewed_at = NOW(),
            cancellation_reviewed_by_user_id = $2,
            cancellation_reviewed_by_email = $3,
            cancellation_review_reason = $4,
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, actorId || null, actor?.email || null, trimmedReason]
  );
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
    const pending = parseInt(pendingRows[0]?.total || 0, 10);
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
    const totalAllowance = allowanceInfo.allowance + historicalBalance;
    return {
      ...r,
      ...allowanceInfo,
      allowance: totalAllowance,
      allowance_base: allowanceInfo.allowance,
      carry_over: historicalBalance,
      missing_hire_date: allowanceInfo.missingHireDate,
      remaining:
        !allowanceInfo.missingHireDate && !allowanceInfo.eligible
          ? totalAllowance - Number(r.taken || 0) - Number(r.pending || 0)
          : Math.max(
              totalAllowance - Number(r.taken || 0) - Number(r.pending || 0),
              0
            ),
    };
  }));
}

async function getLegalVerificationByToken(token) {
  await ensureTable();
  if (!token) return null;
  const { rows } = await db.query(
    `SELECT v.*, u.fullname as requester_name, u.email as requester_email
       FROM vacaciones_solicitudes v
       LEFT JOIN users u ON u.id = v.requester_id
      WHERE v.legal_verification_token = $1
      LIMIT 1`,
    [token]
  );
  if (!rows[0]) return null;
  const signatures = await getVacationSignaturesBySolicitudId(rows[0].id);
  return {
    id: rows[0].id,
    tipo_solicitud: "vacaciones",
    status: rows[0].status,
    solicitante: rows[0].requester_name || rows[0].requester_email || null,
    aprobador: rows[0].approver_role || rows[0].approver_id || null,
    start_date: rows[0].start_date,
    end_date: rows[0].end_date,
    pdf_validacion_legal_url: rows[0].pdf_validacion_legal_url || null,
    legal_verification_token: rows[0].legal_verification_token || token,
    legal_verification_url: buildLegalVerificationUrl(rows[0].legal_verification_token || token),
    firmas_workflow: signatures,
  };
}

module.exports = {
  createVacationRequest,
  listVacationRequests,
  updateVacationStatus,
  cancelVacationRequest,
  reviewVacationCancellation,
  summary,
  getLegalVerificationByToken,
};
