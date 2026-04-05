const db = require("../../config/db");
const logger = require("../../config/logger");
const {
  SUPPORTED_WORKFLOW_SOURCE_TYPES,
  upsertWorkflow,
} = require("./workflowRegistry.service");
const { appendWorkflowAuditEvent } = require("./workflowAudit.service");
const { trackWorkflowDocumentByCode } = require("./fst14.service");

const DEFAULT_ATTENDANCE_RULE_PERCENT = 100;
const DEFAULT_EVALUATION_RULE_PERCENT = 80;
const DEFAULT_SPECIALIST_SCORE_THRESHOLD = 80;
const DEFAULT_CERTIFICATE_DEADLINE_DAYS = 30;

const WORKFLOW_STAGE_MAP = Object.freeze({
  coordination: "technical_documents_in_progress",
  attendance: "technical_documents_in_progress",
  evaluation: "technical_documents_in_progress",
  specialist_evaluation: "technical_documents_in_progress",
  retraining: "blocked",
  conformity: "technical_documents_in_progress",
  certificate: "technical_documents_in_progress",
  software_handoff: "technical_documents_in_progress",
  completed: "completed",
});

const normalizeSourceType = (value) => String(value || "").trim().toLowerCase();
const normalizeSourceId = (value) => String(value || "").trim();
const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || null;
};
const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "yes", "si", "y"].includes(normalized)) return true;
  if (["false", "no", "n"].includes(normalized)) return false;
  return Boolean(fallback);
};
const safeJsonObject = (value, fallback = {}) => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return fallback;
};
const safeJsonArray = (value) => (Array.isArray(value) ? value : []);
const safeNumber = (value, fallback = null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};
const roundTwo = (value) => {
  const parsed = safeNumber(value, 0);
  return Math.round(parsed * 100) / 100;
};
const toDateOnly = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const yyyy = parsed.getUTCFullYear();
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const normalizeSourceContext = (payload = {}, fallback = {}) => {
  const preferredType = normalizeSourceType(
    payload.source_type || payload.sourceType || fallback.source_type || fallback.sourceType || "manual",
  );
  const sourceType = SUPPORTED_WORKFLOW_SOURCE_TYPES.has(preferredType) ? preferredType : "manual";
  const sourceId =
    normalizeSourceId(
      payload.source_id ||
      payload.sourceId ||
      fallback.source_id ||
      fallback.sourceId ||
      payload.request_id ||
      payload.requestId ||
      payload.ORDNumero ||
      payload.Num_Orden ||
      fallback.fallback_id ||
      "",
    ) || `training-${Date.now()}`;
  const requestIdCandidate = payload.request_id || payload.requestId || fallback.request_id || null;
  return {
    source_type: sourceType,
    source_id: sourceId,
    request_id: Number.isFinite(Number(requestIdCandidate)) ? Number(requestIdCandidate) : null,
  };
};

const deriveParticipantKey = (participant = {}, index = 0) => {
  const emailKey = normalizeText(participant.email);
  if (emailKey) return emailKey.toLowerCase();
  const nameKey = normalizeText(participant.full_name || participant.nombre || participant.name);
  if (nameKey) return `name:${nameKey.toLowerCase()}`;
  return `participant:${index + 1}:${Date.now()}`;
};

const normalizeAttendanceMarks = (marks = {}) => {
  const source = safeJsonObject(marks, {});
  const day1 = normalizeBoolean(source.day1 ?? source.dia1 ?? source.Dia_1 ?? source.Dia_1_1, false);
  const day2 = normalizeBoolean(source.day2 ?? source.dia2 ?? source.Dia_2 ?? source.Dia_2_1, false);
  const day3 = normalizeBoolean(source.day3 ?? source.dia3 ?? source.Dia_3 ?? source.Dia_3_1, false);
  return { day1, day2, day3 };
};

const computeAttendancePercent = (marks = {}, requiredSessions = 3) => {
  const normalizedMarks = normalizeAttendanceMarks(marks);
  const presentCount = [normalizedMarks.day1, normalizedMarks.day2, normalizedMarks.day3].filter(Boolean).length;
  const sessions = Math.max(1, Number.parseInt(String(requiredSessions || "3"), 10) || 3);
  return roundTwo((presentCount / sessions) * 100);
};

const buildParticipantsFromLegacyFst05Payload = (payload = {}) => {
  const attendees = safeJsonArray(payload.attendees);
  if (attendees.length > 0) {
    return attendees
      .map((attendee) => safeJsonObject(attendee, {}))
      .map((attendee) => ({
        full_name: normalizeText(attendee.full_name || attendee.nombre || attendee.name),
        role_title: normalizeText(attendee.role_title || attendee.cargo || attendee.role),
        email: normalizeText(attendee.email),
        attendance_marks: normalizeAttendanceMarks(attendee.attendance || attendee.asistencia || attendee.marks),
        legally_signed: normalizeBoolean(attendee.legally_signed, false),
        signature_evidence: safeJsonObject(attendee.signature_evidence, {}),
      }))
      .filter((attendee) => attendee.full_name);
  }

  const participants = [];
  for (let i = 1; i <= 42; i += 1) {
    const fullName = normalizeText(payload[`Nombres_Apellidos${i}`]);
    const roleTitle = normalizeText(payload[`Cargo${i}`]);
    const email = normalizeText(payload[`Correo_Electrónico${i}`] || payload[`Correo_Electronico${i}`]);
    if (!fullName && !roleTitle && !email) {
      if (i > 7) break;
      continue;
    }
    const day1Field = i === 1 ? payload.Dia_1 ?? payload.Dia_1_1 : payload[`Dia_1_${i}`];
    const day2Field = i === 1 ? payload.Dia_2 ?? payload.Dia_2_1 : payload[`Dia_2_${i}`];
    const day3Field = i === 1 ? payload.Dia_3 ?? payload.Dia_3_1 : payload[`Dia_3_${i}`];
    participants.push({
      full_name: fullName || `Asistente ${i}`,
      role_title: roleTitle,
      email,
      attendance_marks: {
        day1: Boolean(String(day1Field || "").trim()),
        day2: Boolean(String(day2Field || "").trim()),
        day3: Boolean(String(day3Field || "").trim()),
      },
      legally_signed: false,
      signature_evidence: {},
    });
  }
  return participants;
};

const ensureTrainingWorkflowTables = async () => {
  await db.query(`CREATE SCHEMA IF NOT EXISTS servicio`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.training_events (
      id BIGSERIAL PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      request_id INTEGER,
      client_id INTEGER,
      client_name TEXT,
      equipment_name TEXT,
      equipment_serial TEXT,
      work_order_type TEXT NOT NULL DEFAULT 'training_initial',
      work_order_ref TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      stage TEXT NOT NULL DEFAULT 'coordination',
      coordination_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      supplies_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
      sessions_total INTEGER NOT NULL DEFAULT 0,
      total_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      materials JSONB NOT NULL DEFAULT '[]'::jsonb,
      attendance_rule_percent NUMERIC(5,2) NOT NULL DEFAULT 100,
      evaluation_rule_percent NUMERIC(5,2) NOT NULL DEFAULT 80,
      attendance_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
      evaluation_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
      specialist_score_avg NUMERIC(5,2),
      specialist_score_threshold NUMERIC(5,2) NOT NULL DEFAULT 80,
      re_training_required BOOLEAN NOT NULL DEFAULT FALSE,
      re_training_count INTEGER NOT NULL DEFAULT 0,
      re_training_status TEXT NOT NULL DEFAULT 'not_required',
      certificate_status TEXT NOT NULL DEFAULT 'pending',
      certificate_due_at TIMESTAMPTZ,
      certificate_emitted_at TIMESTAMPTZ,
      certificate_delivery_deadline_at TIMESTAMPTZ,
      certificate_delivered_at TIMESTAMPTZ,
      certificate_file_id TEXT,
      certificate_link TEXT,
      fst04_document_id TEXT,
      fst04_document_link TEXT,
      fst05_document_id TEXT,
      fst05_document_link TEXT,
      fst06_document_id TEXT,
      fst06_document_link TEXT,
      fst08_document_id TEXT,
      fst08_document_link TEXT,
      fst12_document_id TEXT,
      fst12_document_link TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (source_type, source_id)
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_training_events_source
    ON servicio.training_events (source_type, source_id, updated_at DESC)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_training_events_status
    ON servicio.training_events (status, stage, updated_at DESC)
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.training_event_participants (
      id BIGSERIAL PRIMARY KEY,
      training_event_id BIGINT NOT NULL REFERENCES servicio.training_events(id) ON DELETE CASCADE,
      participant_key TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role_title TEXT,
      email TEXT,
      attendance_marks JSONB NOT NULL DEFAULT '{}'::jsonb,
      attendance_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
      evaluation_score NUMERIC(5,2),
      evaluation_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      specialist_evaluation_score NUMERIC(5,2),
      specialist_evaluation_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      legally_signed BOOLEAN NOT NULL DEFAULT FALSE,
      signature_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (training_event_id, participant_key)
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_training_participants_event
    ON servicio.training_event_participants (training_event_id, updated_at DESC)
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.training_event_sessions (
      id BIGSERIAL PRIMARY KEY,
      training_event_id BIGINT NOT NULL REFERENCES servicio.training_events(id) ON DELETE CASCADE,
      session_no INTEGER NOT NULL,
      session_date DATE,
      start_time TIME,
      end_time TIME,
      duration_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      materials JSONB NOT NULL DEFAULT '[]'::jsonb,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (training_event_id, session_no)
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_training_sessions_event
    ON servicio.training_event_sessions (training_event_id, session_no)
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.training_event_retraining_cycles (
      id BIGSERIAL PRIMARY KEY,
      training_event_id BIGINT NOT NULL REFERENCES servicio.training_events(id) ON DELETE CASCADE,
      cycle_no INTEGER NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      closed_at TIMESTAMPTZ,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (training_event_id, cycle_no)
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_training_retraining_event
    ON servicio.training_event_retraining_cycles (training_event_id, status, opened_at DESC)
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.training_event_certificates (
      id BIGSERIAL PRIMARY KEY,
      training_event_id BIGINT NOT NULL REFERENCES servicio.training_events(id) ON DELETE CASCADE,
      participant_id BIGINT REFERENCES servicio.training_event_participants(id) ON DELETE SET NULL,
      certificate_number TEXT,
      status TEXT NOT NULL DEFAULT 'issued',
      file_id TEXT,
      link TEXT,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      delivery_deadline_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      delivered_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      delivered_by_email TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_training_certificates_event
    ON servicio.training_event_certificates (training_event_id, issued_at DESC)
  `);
};

const computeWorkflowMetrics = ({ event, participants }) => {
  const list = safeJsonArray(participants);
  const attendanceRule = safeNumber(event?.attendance_rule_percent, DEFAULT_ATTENDANCE_RULE_PERCENT);
  const evaluationRule = safeNumber(event?.evaluation_rule_percent, DEFAULT_EVALUATION_RULE_PERCENT);
  const specialistThreshold = safeNumber(event?.specialist_score_threshold, DEFAULT_SPECIALIST_SCORE_THRESHOLD);

  const attendancePass =
    list.length > 0 &&
    list.every((participant) => safeNumber(participant.attendance_percent, 0) >= attendanceRule);
  const evaluationPass =
    list.length > 0 &&
    list.every((participant) => {
      const score = safeNumber(participant.evaluation_score, null);
      return Number.isFinite(score) && score >= evaluationRule;
    });
  const specialistScores = list
    .map((participant) => safeNumber(participant.specialist_evaluation_score, null))
    .filter((score) => Number.isFinite(score));
  const specialistScoreAvg = specialistScores.length
    ? roundTwo(specialistScores.reduce((sum, current) => sum + current, 0) / specialistScores.length)
    : null;
  const specialistBelowThreshold =
    Number.isFinite(specialistScoreAvg) && specialistScoreAvg < specialistThreshold;

  const attendancePercent = list.length
    ? roundTwo(Math.min(...list.map((participant) => safeNumber(participant.attendance_percent, 0))))
    : 0;
  const evaluationPercent = list.length
    ? roundTwo(Math.min(...list.map((participant) => safeNumber(participant.evaluation_score, 0))))
    : 0;

  const conformityData = safeJsonObject(event?.metadata?.training_conformity, {});
  const hasConformity = Boolean(event?.fst12_document_id) || normalizeBoolean(conformityData?.is_conformant, false);
  const trainingPassed = attendancePass && evaluationPass;
  const retrainingReasons = [];
  if (!attendancePass) retrainingReasons.push("ATTENDANCE_BELOW_100");
  if (!evaluationPass) retrainingReasons.push("EVALUATION_BELOW_80");
  const reTrainingRequired = retrainingReasons.length > 0;

  let status = String(event?.status || "draft");
  let stage = String(event?.stage || "coordination");

  if (event?.certificate_status === "delivered" || event?.certificate_delivered_at) {
    status = "completed";
    stage = "completed";
  } else if (reTrainingRequired && list.length > 0) {
    status = "pending_retraining";
    stage = "retraining";
  } else if (trainingPassed && hasConformity) {
    if (event?.certificate_status === "issued") {
      status = "certificate_issued";
      stage = "certificate";
    } else {
      status = "pending_certificate";
      stage = "certificate";
    }
  } else if (trainingPassed && !hasConformity) {
    status = "in_progress";
    stage = "conformity";
  } else if (list.length > 0) {
    status = "in_progress";
    stage = "evaluation";
  } else if (event?.fst05_document_id) {
    status = "in_progress";
    stage = "attendance";
  } else if (event?.fst04_document_id) {
    status = "coordinated";
    stage = "coordination";
  }

  return {
    attendance_percent: attendancePercent,
    evaluation_percent: evaluationPercent,
    specialist_score_avg: specialistScoreAvg,
    specialist_below_threshold: specialistBelowThreshold,
    re_training_required: reTrainingRequired,
    retraining_reasons: retrainingReasons,
    training_passed: trainingPassed,
    has_conformity: hasConformity,
    status,
    stage,
  };
};

const getTrainingEventBySource = async ({ source_type, source_id }) => {
  const { rows } = await db.query(
    `SELECT *
       FROM servicio.training_events
      WHERE source_type = $1
        AND source_id = $2
      LIMIT 1`,
    [source_type, source_id],
  );
  return rows[0] || null;
};

const listParticipantsByEventId = async (eventId) => {
  const { rows } = await db.query(
    `SELECT *
       FROM servicio.training_event_participants
      WHERE training_event_id = $1
      ORDER BY id ASC`,
    [eventId],
  );
  return rows || [];
};

const listSessionsByEventId = async (eventId) => {
  const { rows } = await db.query(
    `SELECT *
       FROM servicio.training_event_sessions
      WHERE training_event_id = $1
      ORDER BY session_no ASC`,
    [eventId],
  );
  return rows || [];
};

const listRetrainingCyclesByEventId = async (eventId) => {
  const { rows } = await db.query(
    `SELECT *
       FROM servicio.training_event_retraining_cycles
      WHERE training_event_id = $1
      ORDER BY cycle_no DESC`,
    [eventId],
  );
  return rows || [];
};

const listCertificatesByEventId = async (eventId) => {
  const { rows } = await db.query(
    `SELECT *
       FROM servicio.training_event_certificates
      WHERE training_event_id = $1
      ORDER BY issued_at DESC, id DESC`,
    [eventId],
  );
  return rows || [];
};

const buildWorkOrderRef = ({ source_id, event_id }) => {
  const token = String(source_id || "manual")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-10)
    .toUpperCase() || "TRAINING";
  const suffix = String(event_id || Date.now()).slice(-6);
  return `WO-TRAIN-${token}-${suffix}`;
};

const upsertTrainingEvent = async ({
  sourceContext,
  patch = {},
  user = null,
}) => {
  const payload = safeJsonObject(patch, {});
  const { rows } = await db.query(
    `
      INSERT INTO servicio.training_events (
        source_type, source_id, request_id, client_id, client_name, equipment_name, equipment_serial,
        work_order_type, work_order_ref, status, stage, coordination_data, supplies_confirmed,
        sessions_total, total_hours, materials, attendance_rule_percent, evaluation_rule_percent,
        specialist_score_threshold, certificate_status, certificate_due_at, certificate_emitted_at,
        certificate_delivery_deadline_at, certificate_delivered_at, certificate_file_id, certificate_link,
        fst04_document_id, fst04_document_link, fst05_document_id, fst05_document_link, fst06_document_id, fst06_document_link,
        fst08_document_id, fst08_document_link, fst12_document_id, fst12_document_link, metadata,
        created_by, created_by_email, created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        COALESCE($8, 'training_initial'),
        $9,
        COALESCE($10, 'draft'),
        COALESCE($11, 'coordination'),
        COALESCE($12::jsonb, '{}'::jsonb),
        COALESCE($13, FALSE),
        COALESCE($14, 0),
        COALESCE($15, 0),
        COALESCE($16::jsonb, '[]'::jsonb),
        COALESCE($17, $43),
        COALESCE($18, $44),
        COALESCE($19, $45),
        COALESCE($20, 'pending'),
        $21,$22,$23,$24,$25,$26,
        $27,$28,$29,$30,$31,$32,$33,$34,$35,$36,
        COALESCE($37::jsonb, '{}'::jsonb),
        $38,$39,now(),now()
      )
      ON CONFLICT (source_type, source_id) DO UPDATE
        SET request_id = COALESCE(EXCLUDED.request_id, servicio.training_events.request_id),
            client_id = COALESCE(EXCLUDED.client_id, servicio.training_events.client_id),
            client_name = COALESCE(EXCLUDED.client_name, servicio.training_events.client_name),
            equipment_name = COALESCE(EXCLUDED.equipment_name, servicio.training_events.equipment_name),
            equipment_serial = COALESCE(EXCLUDED.equipment_serial, servicio.training_events.equipment_serial),
            work_order_type = COALESCE(EXCLUDED.work_order_type, servicio.training_events.work_order_type),
            work_order_ref = COALESCE(EXCLUDED.work_order_ref, servicio.training_events.work_order_ref),
            status = COALESCE(EXCLUDED.status, servicio.training_events.status),
            stage = COALESCE(EXCLUDED.stage, servicio.training_events.stage),
            coordination_data = COALESCE(servicio.training_events.coordination_data, '{}'::jsonb) || COALESCE(EXCLUDED.coordination_data, '{}'::jsonb),
            supplies_confirmed = COALESCE(EXCLUDED.supplies_confirmed, servicio.training_events.supplies_confirmed),
            sessions_total = COALESCE(EXCLUDED.sessions_total, servicio.training_events.sessions_total),
            total_hours = COALESCE(EXCLUDED.total_hours, servicio.training_events.total_hours),
            materials = CASE
              WHEN EXCLUDED.materials IS NULL THEN servicio.training_events.materials
              ELSE EXCLUDED.materials
            END,
            attendance_rule_percent = COALESCE(EXCLUDED.attendance_rule_percent, servicio.training_events.attendance_rule_percent),
            evaluation_rule_percent = COALESCE(EXCLUDED.evaluation_rule_percent, servicio.training_events.evaluation_rule_percent),
            specialist_score_threshold = COALESCE(EXCLUDED.specialist_score_threshold, servicio.training_events.specialist_score_threshold),
            certificate_status = COALESCE(EXCLUDED.certificate_status, servicio.training_events.certificate_status),
            certificate_due_at = COALESCE(EXCLUDED.certificate_due_at, servicio.training_events.certificate_due_at),
            certificate_emitted_at = COALESCE(EXCLUDED.certificate_emitted_at, servicio.training_events.certificate_emitted_at),
            certificate_delivery_deadline_at = COALESCE(EXCLUDED.certificate_delivery_deadline_at, servicio.training_events.certificate_delivery_deadline_at),
            certificate_delivered_at = COALESCE(EXCLUDED.certificate_delivered_at, servicio.training_events.certificate_delivered_at),
            certificate_file_id = COALESCE(EXCLUDED.certificate_file_id, servicio.training_events.certificate_file_id),
            certificate_link = COALESCE(EXCLUDED.certificate_link, servicio.training_events.certificate_link),
            fst04_document_id = COALESCE(EXCLUDED.fst04_document_id, servicio.training_events.fst04_document_id),
            fst04_document_link = COALESCE(EXCLUDED.fst04_document_link, servicio.training_events.fst04_document_link),
            fst05_document_id = COALESCE(EXCLUDED.fst05_document_id, servicio.training_events.fst05_document_id),
            fst05_document_link = COALESCE(EXCLUDED.fst05_document_link, servicio.training_events.fst05_document_link),
            fst06_document_id = COALESCE(EXCLUDED.fst06_document_id, servicio.training_events.fst06_document_id),
            fst06_document_link = COALESCE(EXCLUDED.fst06_document_link, servicio.training_events.fst06_document_link),
            fst08_document_id = COALESCE(EXCLUDED.fst08_document_id, servicio.training_events.fst08_document_id),
            fst08_document_link = COALESCE(EXCLUDED.fst08_document_link, servicio.training_events.fst08_document_link),
            fst12_document_id = COALESCE(EXCLUDED.fst12_document_id, servicio.training_events.fst12_document_id),
            fst12_document_link = COALESCE(EXCLUDED.fst12_document_link, servicio.training_events.fst12_document_link),
            metadata = COALESCE(servicio.training_events.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
            created_by = COALESCE(servicio.training_events.created_by, EXCLUDED.created_by),
            created_by_email = COALESCE(servicio.training_events.created_by_email, EXCLUDED.created_by_email),
            updated_at = now()
      RETURNING *
    `,
    [
      sourceContext.source_type,
      sourceContext.source_id,
      Number.isFinite(Number(sourceContext.request_id))
        ? Number(sourceContext.request_id)
        : Number.isFinite(Number(payload.request_id))
          ? Number(payload.request_id)
          : null,
      Number.isFinite(Number(payload.client_id)) ? Number(payload.client_id) : null,
      normalizeText(payload.client_name),
      normalizeText(payload.equipment_name),
      normalizeText(payload.equipment_serial),
      normalizeText(payload.work_order_type),
      normalizeText(payload.work_order_ref),
      normalizeText(payload.status),
      normalizeText(payload.stage),
      payload.coordination_data ? JSON.stringify(payload.coordination_data) : null,
      Object.prototype.hasOwnProperty.call(payload, "supplies_confirmed")
        ? normalizeBoolean(payload.supplies_confirmed, false)
        : null,
      Number.isFinite(Number(payload.sessions_total)) ? Number(payload.sessions_total) : null,
      Number.isFinite(Number(payload.total_hours)) ? roundTwo(payload.total_hours) : null,
      payload.materials ? JSON.stringify(payload.materials) : null,
      Number.isFinite(Number(payload.attendance_rule_percent))
        ? roundTwo(payload.attendance_rule_percent)
        : null,
      Number.isFinite(Number(payload.evaluation_rule_percent))
        ? roundTwo(payload.evaluation_rule_percent)
        : null,
      Number.isFinite(Number(payload.specialist_score_threshold))
        ? roundTwo(payload.specialist_score_threshold)
        : null,
      normalizeText(payload.certificate_status),
      payload.certificate_due_at || null,
      payload.certificate_emitted_at || null,
      payload.certificate_delivery_deadline_at || null,
      payload.certificate_delivered_at || null,
      normalizeText(payload.certificate_file_id),
      normalizeText(payload.certificate_link),
      normalizeText(payload.fst04_document_id),
      normalizeText(payload.fst04_document_link),
      normalizeText(payload.fst05_document_id),
      normalizeText(payload.fst05_document_link),
      normalizeText(payload.fst06_document_id),
      normalizeText(payload.fst06_document_link),
      normalizeText(payload.fst08_document_id),
      normalizeText(payload.fst08_document_link),
      normalizeText(payload.fst12_document_id),
      normalizeText(payload.fst12_document_link),
      payload.metadata ? JSON.stringify(payload.metadata) : null,
      Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
      normalizeText(user?.email),
      DEFAULT_ATTENDANCE_RULE_PERCENT,
      DEFAULT_EVALUATION_RULE_PERCENT,
      DEFAULT_SPECIALIST_SCORE_THRESHOLD,
    ],
  );
  const event = rows[0] || null;
  if (!event) return null;
  if (!event.work_order_ref) {
    const generatedRef = buildWorkOrderRef({
      source_id: event.source_id,
      event_id: event.id,
    });
    const { rows: updatedRows } = await db.query(
      `UPDATE servicio.training_events
          SET work_order_ref = $2,
              updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [event.id, generatedRef],
    );
    return updatedRows[0] || event;
  }
  return event;
};

const upsertTrainingSessions = async (eventId, sessions = []) => {
  if (!eventId) return;
  const list = safeJsonArray(sessions)
    .map((session) => safeJsonObject(session, {}))
    .map((session, index) => ({
      session_no: Number.isFinite(Number(session.session_no)) ? Number(session.session_no) : index + 1,
      session_date: toDateOnly(session.session_date || session.date),
      start_time: normalizeText(session.start_time || session.start),
      end_time: normalizeText(session.end_time || session.end),
      duration_hours: roundTwo(safeNumber(session.duration_hours || session.hours, 0)),
      materials: safeJsonArray(session.materials),
      notes: normalizeText(session.notes),
    }));

  for (const session of list) {
    // eslint-disable-next-line no-await-in-loop
    await db.query(
      `INSERT INTO servicio.training_event_sessions (
          training_event_id, session_no, session_date, start_time, end_time,
          duration_hours, materials, notes, created_at, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,now(),now())
       ON CONFLICT (training_event_id, session_no) DO UPDATE
         SET session_date = COALESCE(EXCLUDED.session_date, servicio.training_event_sessions.session_date),
             start_time = COALESCE(EXCLUDED.start_time, servicio.training_event_sessions.start_time),
             end_time = COALESCE(EXCLUDED.end_time, servicio.training_event_sessions.end_time),
             duration_hours = COALESCE(EXCLUDED.duration_hours, servicio.training_event_sessions.duration_hours),
             materials = CASE
               WHEN EXCLUDED.materials IS NULL THEN servicio.training_event_sessions.materials
               ELSE EXCLUDED.materials
             END,
             notes = COALESCE(EXCLUDED.notes, servicio.training_event_sessions.notes),
             updated_at = now()`,
      [
        eventId,
        session.session_no,
        session.session_date,
        session.start_time,
        session.end_time,
        session.duration_hours,
        JSON.stringify(session.materials || []),
        session.notes,
      ],
    );
  }
};

const upsertTrainingParticipants = async ({
  eventId,
  participants = [],
  requiredSessions = 3,
}) => {
  const list = safeJsonArray(participants)
    .map((participant) => safeJsonObject(participant, {}))
    .filter((participant) => normalizeText(participant.full_name || participant.nombre || participant.name));

  for (let index = 0; index < list.length; index += 1) {
    const participant = list[index];
    const participantKey = deriveParticipantKey(participant, index);
    const fullName = normalizeText(participant.full_name || participant.nombre || participant.name) || `Asistente ${index + 1}`;
    const roleTitle = normalizeText(participant.role_title || participant.cargo || participant.role);
    const email = normalizeText(participant.email);
    const attendanceMarks = normalizeAttendanceMarks(participant.attendance_marks || participant.attendance || participant.asistencia);
    const attendancePercent = Number.isFinite(Number(participant.attendance_percent))
      ? roundTwo(participant.attendance_percent)
      : computeAttendancePercent(attendanceMarks, requiredSessions);
    const evaluationScore = Number.isFinite(Number(participant.evaluation_score))
      ? roundTwo(participant.evaluation_score)
      : null;
    const specialistScore = Number.isFinite(Number(participant.specialist_evaluation_score))
      ? roundTwo(participant.specialist_evaluation_score)
      : null;
    const legallySigned = normalizeBoolean(participant.legally_signed, false);
    const signatureEvidence = safeJsonObject(participant.signature_evidence, {});
    const evaluationPayload = safeJsonObject(participant.evaluation_payload, {});
    const specialistPayload = safeJsonObject(participant.specialist_evaluation_payload, {});

    // eslint-disable-next-line no-await-in-loop
    await db.query(
      `INSERT INTO servicio.training_event_participants (
          training_event_id, participant_key, full_name, role_title, email,
          attendance_marks, attendance_percent, evaluation_score, evaluation_payload,
          specialist_evaluation_score, specialist_evaluation_payload,
          legally_signed, signature_evidence, status, created_at, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10,$11::jsonb,$12,$13::jsonb,$14,now(),now())
       ON CONFLICT (training_event_id, participant_key) DO UPDATE
         SET full_name = COALESCE(EXCLUDED.full_name, servicio.training_event_participants.full_name),
             role_title = COALESCE(EXCLUDED.role_title, servicio.training_event_participants.role_title),
             email = COALESCE(EXCLUDED.email, servicio.training_event_participants.email),
             attendance_marks = COALESCE(servicio.training_event_participants.attendance_marks, '{}'::jsonb) || COALESCE(EXCLUDED.attendance_marks, '{}'::jsonb),
             attendance_percent = COALESCE(EXCLUDED.attendance_percent, servicio.training_event_participants.attendance_percent),
             evaluation_score = COALESCE(EXCLUDED.evaluation_score, servicio.training_event_participants.evaluation_score),
             evaluation_payload = COALESCE(servicio.training_event_participants.evaluation_payload, '{}'::jsonb) || COALESCE(EXCLUDED.evaluation_payload, '{}'::jsonb),
             specialist_evaluation_score = COALESCE(EXCLUDED.specialist_evaluation_score, servicio.training_event_participants.specialist_evaluation_score),
             specialist_evaluation_payload = COALESCE(servicio.training_event_participants.specialist_evaluation_payload, '{}'::jsonb) || COALESCE(EXCLUDED.specialist_evaluation_payload, '{}'::jsonb),
             legally_signed = COALESCE(EXCLUDED.legally_signed, servicio.training_event_participants.legally_signed),
             signature_evidence = COALESCE(servicio.training_event_participants.signature_evidence, '{}'::jsonb) || COALESCE(EXCLUDED.signature_evidence, '{}'::jsonb),
             status = COALESCE(EXCLUDED.status, servicio.training_event_participants.status),
             updated_at = now()`,
      [
        eventId,
        participantKey,
        fullName,
        roleTitle,
        email,
        JSON.stringify(attendanceMarks),
        attendancePercent,
        evaluationScore,
        JSON.stringify(evaluationPayload),
        specialistScore,
        JSON.stringify(specialistPayload),
        legallySigned,
        JSON.stringify(signatureEvidence),
        normalizeText(participant.status) || "in_progress",
      ],
    );
  }
};

const syncRetrainingCycle = async ({
  event,
  metrics,
  user,
}) => {
  const { rows: openCycles } = await db.query(
    `SELECT *
       FROM servicio.training_event_retraining_cycles
      WHERE training_event_id = $1
        AND status = 'open'
      ORDER BY cycle_no DESC`,
    [event.id],
  );

  if (metrics.re_training_required) {
    if (!openCycles.length) {
      const { rows: maxRows } = await db.query(
        `SELECT COALESCE(MAX(cycle_no), 0) AS max_cycle
           FROM servicio.training_event_retraining_cycles
          WHERE training_event_id = $1`,
        [event.id],
      );
      const nextCycleNo = Number(maxRows[0]?.max_cycle || 0) + 1;
      await db.query(
        `INSERT INTO servicio.training_event_retraining_cycles (
            training_event_id, cycle_no, reason, status, payload, opened_at,
            created_by, created_by_email, updated_at
         )
         VALUES ($1,$2,$3,'open',$4::jsonb,now(),$5,$6,now())`,
        [
          event.id,
          nextCycleNo,
          metrics.retraining_reasons.join(", "),
          JSON.stringify({
            reasons: metrics.retraining_reasons,
            attendance_percent: metrics.attendance_percent,
            evaluation_percent: metrics.evaluation_percent,
          }),
          Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
          normalizeText(user?.email),
        ],
      );
    }
  } else if (openCycles.length) {
    await db.query(
      `UPDATE servicio.training_event_retraining_cycles
          SET status = 'closed',
              closed_at = now(),
              updated_at = now()
        WHERE training_event_id = $1
          AND status = 'open'`,
      [event.id],
    );
  }

  const { rows: countRows } = await db.query(
    `SELECT
       COUNT(*)::int AS total_cycles,
       COUNT(*) FILTER (WHERE status = 'open')::int AS open_cycles
     FROM servicio.training_event_retraining_cycles
    WHERE training_event_id = $1`,
    [event.id],
  );
  const totalCycles = Number(countRows[0]?.total_cycles || 0);
  const openCyclesCount = Number(countRows[0]?.open_cycles || 0);
  return {
    re_training_count: totalCycles,
    re_training_status: openCyclesCount > 0 ? "open" : totalCycles > 0 ? "resolved" : "not_required",
  };
};

const syncWorkflowRegistryForTraining = async (event, user) => {
  const sourceType = normalizeSourceType(event?.source_type);
  const sourceId = normalizeSourceId(event?.source_id);
  if (!sourceType || !sourceId) return;
  const stage = WORKFLOW_STAGE_MAP[event?.stage] || "technical_documents_in_progress";
  const globalStatus =
    event?.status === "completed"
      ? "completed"
      : event?.status === "pending_retraining"
        ? "blocked"
        : "in_progress";
  await upsertWorkflow({
    sourceType,
    sourceId,
    requestId: Number.isFinite(Number(event?.request_id)) ? Number(event.request_id) : null,
    clientName: event?.client_name || null,
    equipmentName: event?.equipment_name || null,
    procedureCode: "ST-01-01",
    globalStatus,
    currentStage: stage,
    metadata: {
      training_status: event?.status || null,
      training_stage: event?.stage || null,
      training_work_order_ref: event?.work_order_ref || null,
    },
    user,
  });
};

const appendClientHistory = async ({ event, user, note, type = "training" }) => {
  const clientId = Number(event?.client_id);
  if (!Number.isFinite(clientId)) return;
  const createdBy = normalizeText(user?.email);
  if (!createdBy) return;
  try {
    await db.query(
      `INSERT INTO client_interactions (client_id, type, notes, created_by)
       VALUES ($1,$2,$3,$4)`,
      [clientId, type, note, createdBy],
    );
  } catch (error) {
    logger.warn({ error, clientId }, "No se pudo registrar interacción de cliente para entrenamiento");
  }
};

const appendEquipmentHistory = async ({ event, user, eventType, details = {} }) => {
  try {
    await db.query(
      `INSERT INTO public.equipos_historial (unidad_id, evento, request_id, detalle, created_by, created_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,now())`,
      [
        null,
        eventType,
        Number.isFinite(Number(event?.request_id)) ? Number(event.request_id) : null,
        JSON.stringify(details || {}),
        Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
      ],
    );
  } catch (error) {
    logger.warn({ error, request_id: event?.request_id }, "No se pudo registrar historial de equipo para entrenamiento");
  }
};

const recomputeTrainingState = async ({
  sourceContext,
  user,
  eventType = "training_workflow_updated",
  auditPayload = {},
}) => {
  const currentEvent = await getTrainingEventBySource(sourceContext);
  if (!currentEvent) return null;
  const participants = await listParticipantsByEventId(currentEvent.id);
  const metrics = computeWorkflowMetrics({ event: currentEvent, participants });
  const retrainingState = await syncRetrainingCycle({
    event: currentEvent,
    metrics,
    user,
  });

  const metadataPatch = {
    training_metrics: {
      attendance_percent: metrics.attendance_percent,
      evaluation_percent: metrics.evaluation_percent,
      specialist_score_avg: metrics.specialist_score_avg,
      specialist_below_threshold: metrics.specialist_below_threshold,
      retraining_reasons: metrics.retraining_reasons,
      training_passed: metrics.training_passed,
      has_conformity: metrics.has_conformity,
      recalculated_at: new Date().toISOString(),
    },
  };

  const { rows } = await db.query(
    `UPDATE servicio.training_events
        SET attendance_percent = $2,
            evaluation_percent = $3,
            specialist_score_avg = $4,
            re_training_required = $5,
            re_training_count = $6,
            re_training_status = $7,
            status = $8,
            stage = $9,
            metadata = COALESCE(metadata, '{}'::jsonb) || $10::jsonb,
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [
      currentEvent.id,
      metrics.attendance_percent,
      metrics.evaluation_percent,
      metrics.specialist_score_avg,
      metrics.re_training_required,
      retrainingState.re_training_count,
      retrainingState.re_training_status,
      metrics.status,
      metrics.stage,
      JSON.stringify(metadataPatch),
    ],
  );
  const updatedEvent = rows[0] || currentEvent;

  await syncWorkflowRegistryForTraining(updatedEvent, user);
  await appendWorkflowAuditEvent({
    sourceType: updatedEvent.source_type,
    sourceId: updatedEvent.source_id,
    procedureCode: "ST-01-01",
    eventType,
    stageKey: WORKFLOW_STAGE_MAP[updatedEvent.stage] || "technical_documents_in_progress",
    actor: user,
    payload: {
      ...auditPayload,
      status: updatedEvent.status,
      stage: updatedEvent.stage,
      attendance_percent: updatedEvent.attendance_percent,
      evaluation_percent: updatedEvent.evaluation_percent,
      re_training_required: updatedEvent.re_training_required,
      re_training_status: updatedEvent.re_training_status,
      certificate_status: updatedEvent.certificate_status,
    },
  });

  if (updatedEvent.status === "pending_retraining") {
    await appendClientHistory({
      event: updatedEvent,
      user,
      type: "training_retraining",
      note: `Entrenamiento requiere reentrenamiento. Razones: ${metrics.retraining_reasons.join(", ") || "N/D"}`,
    });
    await appendEquipmentHistory({
      event: updatedEvent,
      user,
      eventType: "training_retraining_required",
      details: {
        source_type: updatedEvent.source_type,
        source_id: updatedEvent.source_id,
        reasons: metrics.retraining_reasons,
      },
    });
  }

  return updatedEvent;
};

const getTrainingWorkflowDetail = async ({ source_type, source_id }) => {
  await ensureTrainingWorkflowTables();
  const sourceContext = normalizeSourceContext({ source_type, source_id });
  const event = await getTrainingEventBySource(sourceContext);
  if (!event) return null;
  const [participants, sessions, retraining_cycles, certificates] = await Promise.all([
    listParticipantsByEventId(event.id),
    listSessionsByEventId(event.id),
    listRetrainingCyclesByEventId(event.id),
    listCertificatesByEventId(event.id),
  ]);
  const metrics = computeWorkflowMetrics({ event, participants });

  return {
    event,
    participants,
    sessions,
    retraining_cycles,
    certificates,
    metrics,
  };
};

const registerFst04TrainingDocument = async ({
  payload = {},
  document = {},
  user = null,
}) => {
  await ensureTrainingWorkflowTables();
  const sourceContext = normalizeSourceContext(payload, {
    fallback_id: payload.ORDNumero || `training-fst04-${Date.now()}`,
  });
  const coordinationData = {
    order_number: normalizeText(payload.ORDNumero),
    client_name: normalizeText(payload.ORDCliente),
    equipment_name: normalizeText(payload.ORDEquipo),
    equipment_serial: normalizeText(payload.ORDSerie),
    responsible_name: normalizeText(payload.ORDResponsable),
    start_date: toDateOnly(payload.Fecha_Inicio),
    end_date: toDateOnly(payload.Fecha_final),
    days: safeNumber(payload.Dias, null),
    hours_per_day: safeNumber(payload.Horas, null),
    participants_expected: safeNumber(payload.Num_P, null),
    observations: [payload.Obs_1, payload.Obs_2, payload.Obs_3, payload.Obs_4]
      .map((item) => normalizeText(item))
      .filter(Boolean),
    supplies_confirmed: normalizeBoolean(payload.supplies_confirmed, false),
    source: "F.ST-04",
  };
  const totalHours =
    Number.isFinite(Number(payload.Dias)) && Number.isFinite(Number(payload.Horas))
      ? roundTwo(Number(payload.Dias) * Number(payload.Horas))
      : Number.isFinite(Number(payload.Horas))
        ? roundTwo(Number(payload.Horas))
        : 0;

  const upsertedEvent = await upsertTrainingEvent({
    sourceContext,
    patch: {
      request_id: sourceContext.request_id,
      client_id: safeNumber(payload.client_id, null),
      client_name: normalizeText(payload.ORDCliente || payload.client_name),
      equipment_name: normalizeText(payload.ORDEquipo || payload.equipment_name),
      equipment_serial: normalizeText(payload.ORDSerie || payload.equipment_serial),
      status: "coordinated",
      stage: "coordination",
      coordination_data: coordinationData,
      supplies_confirmed: normalizeBoolean(payload.supplies_confirmed, false),
      sessions_total: safeNumber(payload.Dias, 0),
      total_hours: totalHours,
      materials: safeJsonArray(payload.materials),
      fst04_document_id: normalizeText(document.file_id),
      fst04_document_link: normalizeText(document.link),
      metadata: {
        training_module: "training_workflow",
      },
    },
    user,
  });

  if (safeJsonArray(payload.sessions).length) {
    await upsertTrainingSessions(upsertedEvent.id, payload.sessions);
  }

  if (document.file_id) {
    await trackWorkflowDocumentByCode({
      sourceType: sourceContext.source_type,
      sourceId: sourceContext.source_id,
      documentCode: "F.ST-04",
      stageKey: "technical_documents_in_progress",
      requestId: sourceContext.request_id,
      driveFileId: document.file_id,
      driveFolderId: document.folder_id || null,
      driveLink: document.link || null,
      clientName: upsertedEvent.client_name,
      equipmentName: upsertedEvent.equipment_name,
      user,
      metadata: {
        source_module: "training_workflow",
      },
    });
  }

  await recomputeTrainingState({
    sourceContext,
    user,
    eventType: "training_coordination_registered",
    auditPayload: {
      document_code: "F.ST-04",
      work_order_ref: upsertedEvent.work_order_ref,
    },
  });

  await appendClientHistory({
    event: upsertedEvent,
    user,
    type: "training_coordination",
    note: `Coordinación de entrenamiento registrada (${coordinationData.start_date || "N/D"} a ${coordinationData.end_date || "N/D"})`,
  });
  await appendEquipmentHistory({
    event: upsertedEvent,
    user,
    eventType: "training_coordination_registered",
    details: {
      source_type: sourceContext.source_type,
      source_id: sourceContext.source_id,
      work_order_ref: upsertedEvent.work_order_ref,
      supplies_confirmed: upsertedEvent.supplies_confirmed,
    },
  });

  return getTrainingWorkflowDetail(sourceContext);
};

const registerFst05TrainingDocument = async ({
  payload = {},
  document = {},
  user = null,
  strategy = {},
}) => {
  await ensureTrainingWorkflowTables();
  const sourceContext = normalizeSourceContext(payload, {
    fallback_id: payload.Num_Orden || `training-fst05-${Date.now()}`,
  });
  const participants = buildParticipantsFromLegacyFst05Payload(payload);

  const event = await upsertTrainingEvent({
    sourceContext,
    patch: {
      request_id: sourceContext.request_id,
      client_id: safeNumber(payload.client_id, null),
      client_name: normalizeText(payload.ORDCliente || payload.client_name),
      equipment_name: normalizeText(payload.ORDEquipo || payload.equipment_name),
      equipment_serial: normalizeText(payload.ORDSerie || payload.equipment_serial),
      status: "in_progress",
      stage: "attendance",
      fst05_document_id: normalizeText(document.file_id),
      fst05_document_link: normalizeText(document.link),
      coordination_data: {
        order_number: normalizeText(payload.Num_Orden),
        training_date: toDateOnly(payload.ORDFecha),
      },
      metadata: {
        fst05_strategy: strategy,
      },
    },
    user,
  });

  await upsertTrainingParticipants({
    eventId: event.id,
    participants,
    requiredSessions: 3,
  });

  if (document.file_id) {
    await trackWorkflowDocumentByCode({
      sourceType: sourceContext.source_type,
      sourceId: sourceContext.source_id,
      documentCode: "F.ST-05",
      stageKey: "technical_documents_in_progress",
      requestId: sourceContext.request_id,
      driveFileId: document.file_id,
      driveFolderId: document.folder_id || null,
      driveLink: document.link || null,
      clientName: event.client_name,
      equipmentName: event.equipment_name,
      user,
      metadata: {
        source_module: "training_workflow",
        strategy,
      },
    });
  }

  await recomputeTrainingState({
    sourceContext,
    user,
    eventType: "training_attendance_registered",
    auditPayload: {
      document_code: "F.ST-05",
      participants_count: participants.length,
      strategy,
    },
  });

  return getTrainingWorkflowDetail(sourceContext);
};

const registerFst06TrainingDocument = async ({
  payload = {},
  document = {},
  user = null,
}) => {
  await ensureTrainingWorkflowTables();
  const sourceContext = normalizeSourceContext(payload, {
    fallback_id: payload.order_number || payload.ORDNumero || `training-fst06-${Date.now()}`,
  });
  const participants = safeJsonArray(payload.participants)
    .map((participant) => safeJsonObject(participant, {}))
    .map((participant) => ({
      full_name: normalizeText(participant.full_name || participant.nombre || participant.name),
      role_title: normalizeText(participant.role_title || participant.cargo || participant.role),
      email: normalizeText(participant.email),
      attendance_marks: normalizeAttendanceMarks(participant.attendance || participant.attendance_marks),
      legally_signed: normalizeBoolean(participant.legally_signed, false),
      signature_evidence: safeJsonObject(participant.signature_evidence, {}),
      evaluation_score: safeNumber(participant.evaluation_score ?? participant.score, null),
      evaluation_payload: {
        max_score: safeNumber(participant.max_score, 100),
        remarks: normalizeText(participant.remarks || participant.observations),
        criteria: safeJsonArray(participant.criteria),
      },
    }))
    .filter((participant) => participant.full_name);

  const event = await upsertTrainingEvent({
    sourceContext,
    patch: {
      request_id: sourceContext.request_id,
      client_name: normalizeText(payload.client_name),
      equipment_name: normalizeText(payload.equipment_name),
      status: "in_progress",
      stage: "evaluation",
      fst06_document_id: normalizeText(document.file_id),
      fst06_document_link: normalizeText(document.link),
      metadata: {
        fst06_meta: {
          evaluated_at: new Date().toISOString(),
        },
      },
    },
    user,
  });

  await upsertTrainingParticipants({
    eventId: event.id,
    participants,
    requiredSessions: safeNumber(event.sessions_total, 3) || 3,
  });

  if (document.file_id) {
    await trackWorkflowDocumentByCode({
      sourceType: sourceContext.source_type,
      sourceId: sourceContext.source_id,
      documentCode: "F.ST-06",
      stageKey: "technical_documents_in_progress",
      requestId: sourceContext.request_id,
      driveFileId: document.file_id,
      driveFolderId: document.folder_id || null,
      driveLink: document.link || null,
      clientName: event.client_name,
      equipmentName: event.equipment_name,
      user,
      metadata: {
        source_module: "training_workflow",
      },
    });
  }

  await recomputeTrainingState({
    sourceContext,
    user,
    eventType: "training_evaluation_registered",
    auditPayload: {
      document_code: "F.ST-06",
      participants_count: participants.length,
    },
  });
  return getTrainingWorkflowDetail(sourceContext);
};

const registerFst08TrainingDocument = async ({
  payload = {},
  document = {},
  user = null,
}) => {
  await ensureTrainingWorkflowTables();
  const sourceContext = normalizeSourceContext(payload, {
    fallback_id: payload.order_number || payload.ORDNumero || `training-fst08-${Date.now()}`,
  });

  const participants = safeJsonArray(payload.participants)
    .map((participant) => safeJsonObject(participant, {}))
    .map((participant) => ({
      full_name: normalizeText(participant.full_name || participant.nombre || participant.name),
      role_title: normalizeText(participant.role_title || participant.cargo || participant.role),
      email: normalizeText(participant.email),
      specialist_evaluation_score: safeNumber(participant.specialist_score ?? participant.score, null),
      specialist_evaluation_payload: {
        comments: normalizeText(participant.comments || participant.observations),
        corrective_action: normalizeText(participant.corrective_action),
      },
    }))
    .filter((participant) => participant.full_name);

  const event = await upsertTrainingEvent({
    sourceContext,
    patch: {
      request_id: sourceContext.request_id,
      client_name: normalizeText(payload.client_name),
      equipment_name: normalizeText(payload.equipment_name),
      status: "in_progress",
      stage: "specialist_evaluation",
      fst08_document_id: normalizeText(document.file_id),
      fst08_document_link: normalizeText(document.link),
      metadata: {
        fst08_meta: {
          evaluated_at: new Date().toISOString(),
        },
      },
    },
    user,
  });

  await upsertTrainingParticipants({
    eventId: event.id,
    participants,
    requiredSessions: safeNumber(event.sessions_total, 3) || 3,
  });

  if (document.file_id) {
    await trackWorkflowDocumentByCode({
      sourceType: sourceContext.source_type,
      sourceId: sourceContext.source_id,
      documentCode: "F.ST-08",
      stageKey: "technical_documents_in_progress",
      requestId: sourceContext.request_id,
      driveFileId: document.file_id,
      driveFolderId: document.folder_id || null,
      driveLink: document.link || null,
      clientName: event.client_name,
      equipmentName: event.equipment_name,
      user,
      metadata: {
        source_module: "training_workflow",
      },
    });
  }

  await recomputeTrainingState({
    sourceContext,
    user,
    eventType: "training_specialist_evaluation_registered",
    auditPayload: {
      document_code: "F.ST-08",
      participants_count: participants.length,
    },
  });
  return getTrainingWorkflowDetail(sourceContext);
};

const registerFst12TrainingDocument = async ({
  payload = {},
  document = {},
  user = null,
}) => {
  await ensureTrainingWorkflowTables();
  const sourceContext = normalizeSourceContext(payload, {
    fallback_id: payload.order_number || payload.ORDNumero || `training-fst12-${Date.now()}`,
  });
  const event = await upsertTrainingEvent({
    sourceContext,
    patch: {
      request_id: sourceContext.request_id,
      status: "in_progress",
      stage: "conformity",
      fst12_document_id: normalizeText(document.file_id),
      fst12_document_link: normalizeText(document.link),
      metadata: {
        training_conformity: {
          is_conformant: normalizeBoolean(payload.is_conformant, false),
          client_signer_name: normalizeText(payload.client_signer_name),
          signer_role: normalizeText(payload.signer_role),
          signed_at: payload.signed_at || new Date().toISOString(),
          notes: normalizeText(payload.notes),
        },
      },
    },
    user,
  });

  if (document.file_id) {
    await trackWorkflowDocumentByCode({
      sourceType: sourceContext.source_type,
      sourceId: sourceContext.source_id,
      documentCode: "F.ST-12",
      stageKey: "technical_documents_in_progress",
      requestId: sourceContext.request_id,
      driveFileId: document.file_id,
      driveFolderId: document.folder_id || null,
      driveLink: document.link || null,
      clientName: event.client_name,
      equipmentName: event.equipment_name,
      user,
      metadata: {
        source_module: "training_workflow",
      },
    });
  }

  await recomputeTrainingState({
    sourceContext,
    user,
    eventType: "training_conformity_registered",
    auditPayload: {
      document_code: "F.ST-12",
      is_conformant: normalizeBoolean(payload.is_conformant, false),
    },
  });
  return getTrainingWorkflowDetail(sourceContext);
};

const updateTrainingWorkflowAction = async ({
  action,
  payload = {},
  user = null,
}) => {
  await ensureTrainingWorkflowTables();
  const normalizedAction = String(action || payload.action || "").trim().toLowerCase();
  if (!normalizedAction) {
    const error = new Error("Debe indicar la accion de workflow de entrenamiento");
    error.status = 400;
    error.code = "TRAINING_ACTION_REQUIRED";
    throw error;
  }
  const sourceContext = normalizeSourceContext(payload);
  if (normalizedAction === "coordination") {
    const detail = await registerFst04TrainingDocument({ payload, user, document: {} });
    return detail;
  }
  if (normalizedAction === "attendance") {
    const detail = await registerFst05TrainingDocument({
      payload,
      user,
      document: {},
      strategy: { source: "manual_attendance_upsert" },
    });
    return detail;
  }
  if (normalizedAction === "evaluation") {
    return registerFst06TrainingDocument({ payload, user, document: {} });
  }
  if (normalizedAction === "specialist_evaluation") {
    return registerFst08TrainingDocument({ payload, user, document: {} });
  }
  if (normalizedAction === "conformity") {
    return registerFst12TrainingDocument({ payload, user, document: {} });
  }
  if (normalizedAction === "software_handoff") {
    const event = await upsertTrainingEvent({
      sourceContext,
      patch: {
        stage: "software_handoff",
        status: "in_progress",
        metadata: {
          software_handoff: {
            delivered_at: payload.delivered_at || new Date().toISOString(),
            responsible_name: normalizeText(payload.responsible_name),
            responsible_email: normalizeText(payload.responsible_email),
            evidence: normalizeText(payload.evidence),
            notes: normalizeText(payload.notes),
          },
        },
      },
      user,
    });
    await recomputeTrainingState({
      sourceContext,
      user,
      eventType: "training_software_handoff_registered",
      auditPayload: {
        responsible_name: normalizeText(payload.responsible_name),
      },
    });
    return getTrainingWorkflowDetail({
      source_type: event.source_type,
      source_id: event.source_id,
    });
  }

  const error = new Error("Accion de workflow de entrenamiento no soportada");
  error.status = 400;
  error.code = "TRAINING_ACTION_INVALID";
  throw error;
};

const issueTrainingCertificateRecord = async ({
  source_type,
  source_id,
  file_id,
  link,
  certificate_number = null,
  participant_id = null,
  user = null,
  metadata = {},
  delivery_deadline_days = DEFAULT_CERTIFICATE_DEADLINE_DAYS,
}) => {
  await ensureTrainingWorkflowTables();
  const sourceContext = normalizeSourceContext({ source_type, source_id });
  const event = await getTrainingEventBySource(sourceContext);
  if (!event) {
    const error = new Error("No existe workflow de entrenamiento para emitir certificado");
    error.status = 404;
    error.code = "TRAINING_WORKFLOW_NOT_FOUND";
    throw error;
  }
  if (event.status === "pending_retraining") {
    const error = new Error("No se puede emitir certificado mientras exista reentrenamiento pendiente");
    error.status = 409;
    error.code = "TRAINING_RETRAINING_PENDING";
    throw error;
  }
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + Number(delivery_deadline_days || DEFAULT_CERTIFICATE_DEADLINE_DAYS));
  const issuedAt = new Date().toISOString();
  const { rows: certificateRows } = await db.query(
    `INSERT INTO servicio.training_event_certificates (
        training_event_id, participant_id, certificate_number, status, file_id, link,
        issued_at, delivery_deadline_at, delivered_at, delivered_by, delivered_by_email, metadata, created_at, updated_at
      )
      VALUES ($1,$2,$3,'issued',$4,$5,$6,$7,NULL,NULL,NULL,$8::jsonb,now(),now())
      RETURNING *`,
    [
      event.id,
      Number.isFinite(Number(participant_id)) ? Number(participant_id) : null,
      normalizeText(certificate_number),
      normalizeText(file_id),
      normalizeText(link),
      issuedAt,
      deadline.toISOString(),
      JSON.stringify(safeJsonObject(metadata, {})),
    ],
  );
  const certificate = certificateRows[0] || null;

  await upsertTrainingEvent({
    sourceContext,
    patch: {
      certificate_status: "issued",
      certificate_emitted_at: issuedAt,
      certificate_due_at: deadline.toISOString(),
      certificate_delivery_deadline_at: deadline.toISOString(),
      certificate_file_id: normalizeText(file_id),
      certificate_link: normalizeText(link),
      status: "certificate_issued",
      stage: "certificate",
      metadata: {
        last_certificate_id: certificate?.id || null,
      },
    },
    user,
  });

  await recomputeTrainingState({
    sourceContext,
    user,
    eventType: "training_certificate_issued",
    auditPayload: {
      certificate_id: certificate?.id || null,
      certificate_number: certificate?.certificate_number || null,
    },
  });

  await appendClientHistory({
    event,
    user,
    type: "training_certificate",
    note: `Certificado de entrenamiento emitido${certificate?.certificate_number ? ` (${certificate.certificate_number})` : ""}. Fecha limite de entrega: ${deadline.toISOString().slice(0, 10)}`,
  });
  await appendEquipmentHistory({
    event,
    user,
    eventType: "training_certificate_issued",
    details: {
      source_type: sourceContext.source_type,
      source_id: sourceContext.source_id,
      certificate_id: certificate?.id || null,
      certificate_number: certificate?.certificate_number || null,
      deadline: deadline.toISOString(),
    },
  });

  return {
    certificate,
    workflow: await getTrainingWorkflowDetail(sourceContext),
  };
};

const markTrainingCertificateDelivered = async ({
  source_type,
  source_id,
  certificate_id = null,
  delivered_at = null,
  user = null,
  delivery_evidence = null,
}) => {
  await ensureTrainingWorkflowTables();
  const sourceContext = normalizeSourceContext({ source_type, source_id });
  const event = await getTrainingEventBySource(sourceContext);
  if (!event) {
    const error = new Error("No existe workflow de entrenamiento para registrar entrega de certificado");
    error.status = 404;
    error.code = "TRAINING_WORKFLOW_NOT_FOUND";
    throw error;
  }
  let certificate = null;
  if (Number.isFinite(Number(certificate_id))) {
    const { rows } = await db.query(
      `SELECT *
         FROM servicio.training_event_certificates
        WHERE id = $1
          AND training_event_id = $2
        LIMIT 1`,
      [Number(certificate_id), event.id],
    );
    certificate = rows[0] || null;
  } else {
    const { rows } = await db.query(
      `SELECT *
         FROM servicio.training_event_certificates
        WHERE training_event_id = $1
          AND status IN ('issued', 'pending', 'expired')
        ORDER BY issued_at DESC
        LIMIT 1`,
      [event.id],
    );
    certificate = rows[0] || null;
  }

  if (!certificate) {
    const error = new Error("No existe certificado emitido para marcar entrega");
    error.status = 404;
    error.code = "TRAINING_CERTIFICATE_NOT_FOUND";
    throw error;
  }

  const deliveredAt = delivered_at || new Date().toISOString();
  const { rows } = await db.query(
    `UPDATE servicio.training_event_certificates
        SET status = 'delivered',
            delivered_at = $2,
            delivered_by = $3,
            delivered_by_email = $4,
            metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb,
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [
      certificate.id,
      deliveredAt,
      Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
      normalizeText(user?.email),
      JSON.stringify({
        delivery_evidence: normalizeText(delivery_evidence),
      }),
    ],
  );
  const updatedCertificate = rows[0] || certificate;

  await upsertTrainingEvent({
    sourceContext,
    patch: {
      certificate_status: "delivered",
      certificate_delivered_at: deliveredAt,
      status: "completed",
      stage: "completed",
      metadata: {
        certificate_delivery_evidence: normalizeText(delivery_evidence),
      },
    },
    user,
  });

  await recomputeTrainingState({
    sourceContext,
    user,
    eventType: "training_certificate_delivered",
    auditPayload: {
      certificate_id: updatedCertificate.id,
      delivered_at: deliveredAt,
    },
  });

  await appendClientHistory({
    event,
    user,
    type: "training_certificate_delivery",
    note: `Certificado de entrenamiento entregado${updatedCertificate.certificate_number ? ` (${updatedCertificate.certificate_number})` : ""} el ${deliveredAt.slice(0, 10)}.`,
  });
  await appendEquipmentHistory({
    event,
    user,
    eventType: "training_certificate_delivered",
    details: {
      source_type: sourceContext.source_type,
      source_id: sourceContext.source_id,
      certificate_id: updatedCertificate.id,
      delivered_at: deliveredAt,
    },
  });

  return {
    certificate: updatedCertificate,
    workflow: await getTrainingWorkflowDetail(sourceContext),
  };
};

module.exports = {
  DEFAULT_CERTIFICATE_DEADLINE_DAYS,
  ensureTrainingWorkflowTables,
  normalizeSourceContext,
  buildParticipantsFromLegacyFst05Payload,
  getTrainingWorkflowDetail,
  registerFst04TrainingDocument,
  registerFst05TrainingDocument,
  registerFst06TrainingDocument,
  registerFst08TrainingDocument,
  registerFst12TrainingDocument,
  updateTrainingWorkflowAction,
  issueTrainingCertificateRecord,
  markTrainingCertificateDelivered,
};
