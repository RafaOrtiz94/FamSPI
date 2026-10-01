const crypto = require("crypto");
const db = require("../../config/db");
const logger = require("../../config/logger");
const { createTimeOffEvent } = require("../../utils/calendar");
const { ensureFolderPath, uploadFileToDrive } = require("../../utils/drive");
const { sendMail } = require("../../utils/mailer");
const { getHolidaysForYear } = require("../security/security.holidays.ec");

const ATTENDANCE_TIMEZONE = "America/Guayaquil";
const GENERAL_UNAVAILABILITY_EMAILS = String(
  process.env.TIMEOFF_GENERAL_NOTIFY_EMAILS || "general@fam-project.com"
)
  .split(",")
  .map((value) => String(value || "").trim().toLowerCase())
  .filter(Boolean);
const BIRTHDAY_FOLDER_ROOT = String(
  process.env.ATTENDANCE_DRIVE_FOLDER_ID ||
    process.env.GOOGLE_DRIVE_ATTENDANCE_FOLDER_ID ||
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ||
    ""
).trim() || null;
const BIRTHDAY_EVIDENCE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const normalizeRoleToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const HR_BIRTHDAY_ALLOWED_ROLES = new Set([
  "talento_humano",
  "jefe_talento_humano",
  "jefe_de_talento_humano",
  "analista_talento_humano",
  "asistente_talento_humano",
  "auxiliar_talento_humano",
  "rh",
  "rrhh",
  "admin",
  "administrador",
]);

const BENEFIT_STATUS = Object.freeze({
  QR_GENERATED: "qr_generated",
  EVIDENCE_UPLOADED: "evidence_uploaded",
  REDEEMED: "redeemed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
});

function collectUserRoles(user = {}) {
  return [
    user?.role,
    user?.scope,
    user?.role_name,
    user?.rol,
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.scopes) ? user.scopes : []),
  ]
    .map(normalizeRoleToken)
    .filter(Boolean);
}

function hasBirthdayAdminAccess(user = {}) {
  return collectUserRoles(user).some((role) => HR_BIRTHDAY_ALLOWED_ROLES.has(role));
}

function buildDateFromParts(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) {
    return new Date(Date.UTC(year, month - 1, 0));
  }
  return date;
}

function toIsoDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const base = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + Number(days || 0));
  return toIsoDate(base);
}

function buildEcTimestamp(date, time) {
  return new Date(`${date}T${time}:00-05:00`).toISOString();
}

function parseBirthDate(rawValue) {
  const iso = toIsoDate(rawValue);
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { iso, year, month, day };
}

function resolveBirthdayCycle(birthDate, referenceDate = new Date()) {
  const parsed = parseBirthDate(birthDate);
  if (!parsed) return null;

  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (Number.isNaN(ref.getTime())) return null;

  const refYear = ref.getUTCFullYear();
  const currentYearBirthday = buildDateFromParts(refYear, parsed.month, parsed.day);
  const currentYearBirthdayIso = toIsoDate(currentYearBirthday);
  const referenceIso = toIsoDate(ref);

  const cycleStartYear = referenceIso < currentYearBirthdayIso ? refYear - 1 : refYear;
  const cycleStart = toIsoDate(buildDateFromParts(cycleStartYear, parsed.month, parsed.day));
  const nextBirthday = toIsoDate(buildDateFromParts(cycleStartYear + 1, parsed.month, parsed.day));
  const cycleEnd = addDays(nextBirthday, -1);

  return {
    birthDate: parsed.iso,
    cycleStart,
    cycleEnd,
    nextBirthday,
  };
}

function assertCanManageBirthdayBenefit(user = {}) {
  if (hasBirthdayAdminAccess(user)) return;
  const error = new Error("No tienes permisos para gestionar el beneficio de cumpleaños");
  error.status = 403;
  throw error;
}

function assertCanAccessOwnBenefit(user = {}, benefit = {}) {
  const requesterId = Number(user?.id || 0);
  const ownerId = Number(benefit?.user_id || 0);
  if (requesterId > 0 && ownerId > 0 && requesterId === ownerId) return;
  if (hasBirthdayAdminAccess(user)) return;
  const error = new Error("No tienes permisos para acceder a este beneficio");
  error.status = 403;
  throw error;
}

function isWeekend(dateIso) {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function isHoliday(dateIso) {
  const year = Number(String(dateIso || "").slice(0, 4));
  if (!Number.isInteger(year)) return false;
  const holidays = getHolidaysForYear(year);
  return Array.isArray(holidays) && holidays.includes(dateIso);
}

function buildBenefitSummary(row = {}) {
  const redeemDate = row?.redeem_date ? toIsoDate(row.redeem_date) : null;
  const state = String(row?.status || "").trim().toLowerCase() || BENEFIT_STATUS.QR_GENERATED;
  return {
    id: row?.id || null,
    user_id: row?.user_id || null,
    user_email: row?.user_email || null,
    user_fullname: row?.user_fullname || null,
    birth_date: toIsoDate(row?.birth_date),
    cycle_start: toIsoDate(row?.cycle_start),
    cycle_end: toIsoDate(row?.cycle_end),
    status: state,
    qr_token: row?.qr_token || null,
    qr_url: row?.qr_token
      ? `${String(process.env.APP_FRONTEND_URL || process.env.FRONTEND_URL || "").replace(/\/$/, "")}/cumpleanos/canje/${row.qr_token}`
      : null,
    qr_generated_at: row?.qr_generated_at || null,
    redeem_date: redeemDate,
    redeemed_at: row?.redeemed_at || null,
    coordination_uploaded_at: row?.coordination_uploaded_at || null,
    coordination_evidence_urls: Array.isArray(row?.coordination_evidence_urls)
      ? row.coordination_evidence_urls.filter(Boolean)
      : [],
    calendar_event_id: row?.calendar_event_id || null,
    calendar_event_calendar_id: row?.calendar_event_calendar_id || null,
    attendance_regularized_at: row?.attendance_regularized_at || null,
    general_notification_sent_at: row?.general_notification_sent_at || null,
    metadata: row?.metadata && typeof row.metadata === "object" ? row.metadata : {},
    can_redeem: state !== BENEFIT_STATUS.REDEEMED && state !== BENEFIT_STATUS.EXPIRED && state !== BENEFIT_STATUS.CANCELLED,
    can_upload_evidence: state !== BENEFIT_STATUS.REDEEMED && state !== BENEFIT_STATUS.EXPIRED && state !== BENEFIT_STATUS.CANCELLED,
  };
}

async function ensureBirthdayBenefitTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS attendance_birthday_day_off_benefits (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_email TEXT NOT NULL,
      user_fullname TEXT,
      birth_date DATE NOT NULL,
      cycle_start DATE NOT NULL,
      cycle_end DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'qr_generated',
      qr_token TEXT NOT NULL,
      qr_generated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      qr_generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      coordination_evidence_drive_urls TEXT[] NOT NULL DEFAULT '{}',
      coordination_evidence_drive_ids TEXT[] NOT NULL DEFAULT '{}',
      coordination_uploaded_at TIMESTAMPTZ,
      redeem_date DATE,
      redeemed_at TIMESTAMPTZ,
      redeemed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      calendar_event_id TEXT,
      calendar_event_calendar_id TEXT,
      general_notification_sent_at TIMESTAMPTZ,
      attendance_regularized_at TIMESTAMPTZ,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT attendance_birthday_day_off_benefits_status_ck CHECK (
        status IN ('qr_generated', 'evidence_uploaded', 'redeemed', 'expired', 'cancelled')
      ),
      CONSTRAINT attendance_birthday_day_off_benefits_cycle_uniq UNIQUE (user_id, cycle_start),
      CONSTRAINT attendance_birthday_day_off_benefits_token_uniq UNIQUE (qr_token)
    );
  `);
}

async function getCollaboratorBirthdayProfile(userId) {
  const result = await db.query(
    `
      SELECT
        u.id AS user_id,
        LOWER(COALESCE(u.email, '')) AS user_email,
        COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email) AS user_fullname,
        cp.profile->'personal'->>'fecha_nacimiento' AS birth_date
      FROM users u
      LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `,
    [Number(userId)],
  );

  const row = result.rows?.[0];
  if (!row) {
    const error = new Error("Colaborador no encontrado");
    error.status = 404;
    throw error;
  }

  if (!row.birth_date) {
    const error = new Error("El colaborador no tiene fecha de nacimiento registrada");
    error.status = 400;
    throw error;
  }

  const cycle = resolveBirthdayCycle(row.birth_date, new Date());
  if (!cycle) {
    const error = new Error("No se pudo calcular el ciclo del beneficio de cumpleaños");
    error.status = 400;
    throw error;
  }

  return {
    ...row,
    ...cycle,
  };
}

async function markExpiredIfNeeded(row) {
  if (!row?.id) return row;
  const cycleEnd = toIsoDate(row.cycle_end);
  const status = String(row.status || "").trim().toLowerCase();
  const today = toIsoDate(new Date());
  if (!cycleEnd || !today) return row;
  if (status === BENEFIT_STATUS.REDEEMED || status === BENEFIT_STATUS.CANCELLED || status === BENEFIT_STATUS.EXPIRED) {
    return row;
  }
  if (today <= cycleEnd) return row;

  const update = await db.query(
    `
      UPDATE attendance_birthday_day_off_benefits
         SET status = $2,
             updated_at = NOW()
       WHERE id = $1
       RETURNING *
    `,
    [row.id, BENEFIT_STATUS.EXPIRED],
  );
  return update.rows?.[0] || row;
}

async function getBirthdayBenefitForCycle(userId, cycleStart) {
  await ensureBirthdayBenefitTable();
  const result = await db.query(
    `
      SELECT *
      FROM attendance_birthday_day_off_benefits
      WHERE user_id = $1 AND cycle_start = $2::date
      LIMIT 1
    `,
    [Number(userId), cycleStart],
  );
  const row = result.rows?.[0] || null;
  return row ? markExpiredIfNeeded(row) : null;
}

async function getBirthdayBenefitByToken(token) {
  await ensureBirthdayBenefitTable();
  const result = await db.query(
    `
      SELECT *
      FROM attendance_birthday_day_off_benefits
      WHERE qr_token = $1
      LIMIT 1
    `,
    [String(token || "").trim()],
  );
  const row = result.rows?.[0];
  if (!row) {
    const error = new Error("El QR de cumpleaños no es válido");
    error.status = 404;
    throw error;
  }
  return markExpiredIfNeeded(row);
}

async function getBirthdayBenefitSummaryForUser(userId) {
  const profile = await getCollaboratorBirthdayProfile(userId);
  const row = await getBirthdayBenefitForCycle(userId, profile.cycleStart);
  if (!row) {
    return {
      user_id: profile.user_id,
      user_email: profile.user_email,
      user_fullname: profile.user_fullname,
      birth_date: profile.birthDate,
      cycle_start: profile.cycleStart,
      cycle_end: profile.cycleEnd,
      status: "not_generated",
      qr_token: null,
      qr_url: null,
      coordination_evidence_urls: [],
      metadata: {},
      can_redeem: false,
      can_upload_evidence: false,
    };
  }
  return buildBenefitSummary(row);
}

async function generateBirthdayBenefitQr({ targetUserId, actorUser }) {
  assertCanManageBirthdayBenefit(actorUser);
  const profile = await getCollaboratorBirthdayProfile(targetUserId);
  const current = await getBirthdayBenefitForCycle(targetUserId, profile.cycleStart);

  if (String(current?.status || "").trim().toLowerCase() === BENEFIT_STATUS.REDEEMED) {
    return buildBenefitSummary(current);
  }

  const token = crypto.randomBytes(24).toString("hex");
  const params = [
    profile.user_id,
    profile.user_email,
    profile.user_fullname,
    profile.birthDate,
    profile.cycleStart,
    profile.cycleEnd,
    token,
    Number(actorUser?.id || 0) || null,
  ];

  const result = await db.query(
    `
      INSERT INTO attendance_birthday_day_off_benefits (
        user_id,
        user_email,
        user_fullname,
        birth_date,
        cycle_start,
        cycle_end,
        qr_token,
        qr_generated_by_user_id,
        qr_generated_at,
        status,
        updated_at
      )
      VALUES ($1, $2, $3, $4::date, $5::date, $6::date, $7, $8, NOW(), $9, NOW())
      ON CONFLICT (user_id, cycle_start)
      DO UPDATE SET
        user_email = EXCLUDED.user_email,
        user_fullname = EXCLUDED.user_fullname,
        birth_date = EXCLUDED.birth_date,
        cycle_end = EXCLUDED.cycle_end,
        qr_token = EXCLUDED.qr_token,
        qr_generated_by_user_id = EXCLUDED.qr_generated_by_user_id,
        qr_generated_at = NOW(),
        status = CASE
          WHEN attendance_birthday_day_off_benefits.status = 'redeemed'
            THEN attendance_birthday_day_off_benefits.status
          WHEN COALESCE(array_length(attendance_birthday_day_off_benefits.coordination_evidence_drive_urls, 1), 0) > 0
            THEN 'evidence_uploaded'
          ELSE 'qr_generated'
        END,
        updated_at = NOW()
      RETURNING *
    `,
    [...params, BENEFIT_STATUS.QR_GENERATED],
  );

  return buildBenefitSummary(result.rows[0]);
}

function buildGeneralBirthdayMail({ collaboratorName, redeemDate }) {
  const subject = `[SPI] Aviso general de no disponibilidad: ${collaboratorName}`;
  const text = [
    "Aviso general para planificacion operativa.",
    `El colaborador ${collaboratorName} hara uso de su dia libre por cumpleaños.`,
    `Fecha: ${redeemDate}.`,
    "Esta notificacion se envia al grupo general para que cada area lo tenga en cuenta.",
  ].join("\n");
  const html = `
    <p><strong>Aviso general para planificacion operativa.</strong></p>
    <p>El colaborador <strong>${collaboratorName}</strong> hara uso de su <strong>dia libre por cumpleaños</strong>.</p>
    <p>Fecha: <strong>${redeemDate}</strong>.</p>
    <p>Esta notificacion se envia al grupo general para que cada area lo tenga en cuenta.</p>
  `;
  return { subject, text, html };
}

async function sendGeneralBirthdayNotification({ collaboratorName, redeemDate }) {
  if (!GENERAL_UNAVAILABILITY_EMAILS.length) return;
  const { subject, text, html } = buildGeneralBirthdayMail({ collaboratorName, redeemDate });
  await sendMail({
    to: GENERAL_UNAVAILABILITY_EMAILS,
    subject,
    text,
    html,
    source: "attendance.birthday_benefit",
  });
}

async function uploadCoordinationEvidence({ benefit, files = [] }) {
  if (!files.length) {
    const error = new Error("Debes subir la evidencia de coordinación");
    error.status = 400;
    throw error;
  }
  if (!BIRTHDAY_FOLDER_ROOT) {
    const error = new Error("No existe carpeta configurada para evidencias de cumpleaños");
    error.status = 500;
    throw error;
  }

  const folder = await ensureFolderPath(
    ["Asistencia", "Beneficio cumpleaños", benefit.cycle_start, benefit.user_email],
    BIRTHDAY_FOLDER_ROOT,
  );
  const uploaded = [];

  for (const file of files) {
    if (!BIRTHDAY_EVIDENCE_MIME_TYPES.has(String(file?.mimetype || "").toLowerCase())) {
      const error = new Error("Solo se aceptan imágenes o PDF como evidencia de coordinación");
      error.status = 400;
      throw error;
    }
    const safeName = `${Date.now()}-${String(file.originalname || "evidencia").replace(/[^\w.-]+/g, "_")}`;
    const driveFile = await uploadFileToDrive(file, safeName, folder?.id || undefined, {
      makeAnyoneReader: true,
    });
    uploaded.push({
      id: driveFile?.id || null,
      url: driveFile?.webViewLink || driveFile?.webContentLink || null,
    });
  }

  return uploaded;
}

async function submitBirthdayBenefitEvidence({ token, actorUser, files }) {
  const benefit = await getBirthdayBenefitByToken(token);
  assertCanAccessOwnBenefit(actorUser, benefit);

  if (![BENEFIT_STATUS.QR_GENERATED, BENEFIT_STATUS.EVIDENCE_UPLOADED].includes(String(benefit.status || "").trim().toLowerCase())) {
    const error = new Error("Este beneficio ya no permite subir evidencias");
    error.status = 400;
    throw error;
  }

  const uploaded = await uploadCoordinationEvidence({ benefit, files });
  const urls = [
    ...(Array.isArray(benefit.coordination_evidence_drive_urls) ? benefit.coordination_evidence_drive_urls : []),
    ...uploaded.map((item) => item.url).filter(Boolean),
  ];
  const ids = [
    ...(Array.isArray(benefit.coordination_evidence_drive_ids) ? benefit.coordination_evidence_drive_ids : []),
    ...uploaded.map((item) => item.id).filter(Boolean),
  ];

  const result = await db.query(
    `
      UPDATE attendance_birthday_day_off_benefits
         SET coordination_evidence_drive_urls = $2::text[],
             coordination_evidence_drive_ids = $3::text[],
             coordination_uploaded_at = NOW(),
             status = $4,
             updated_at = NOW()
       WHERE id = $1
       RETURNING *
    `,
    [benefit.id, urls, ids, BENEFIT_STATUS.EVIDENCE_UPLOADED],
  );

  return buildBenefitSummary(result.rows[0]);
}

function validateRedeemDate(benefit, redeemDate) {
  const date = toIsoDate(redeemDate);
  if (!date) {
    const error = new Error("Debes seleccionar una fecha válida para el canje");
    error.status = 400;
    throw error;
  }
  if (date < toIsoDate(benefit.cycle_start) || date > toIsoDate(benefit.cycle_end)) {
    const error = new Error("La fecha elegida está fuera de la vigencia del beneficio");
    error.status = 400;
    throw error;
  }
  if (isWeekend(date) || isHoliday(date)) {
    const error = new Error("El canje solo puede registrarse en días laborables");
    error.status = 400;
    throw error;
  }
  return date;
}

async function regularizeBirthdayAttendance({ userId, redeemDate }) {
  const entry = buildEcTimestamp(redeemDate, "09:00");
  const lunchOut = buildEcTimestamp(redeemDate, "13:00");
  const lunchIn = buildEcTimestamp(redeemDate, "14:00");
  const exit = buildEcTimestamp(redeemDate, "18:00");

  const result = await db.query(
    `
      INSERT INTO user_attendance_records (
        user_id,
        date,
        entry_time,
        lunch_start_time,
        lunch_end_time,
        exit_time,
        entry_location,
        lunch_start_location,
        lunch_end_location,
        exit_location,
        notes,
        total_hours,
        updated_at
      )
      VALUES (
        $1,
        $2::date,
        $3::timestamptz,
        $4::timestamptz,
        $5::timestamptz,
        $6::timestamptz,
        'Beneficio cumpleaños',
        'Beneficio cumpleaños',
        'Beneficio cumpleaños',
        'Beneficio cumpleaños',
        'Jornada regularizada por día libre de cumpleaños',
        8,
        NOW()
      )
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        entry_time = EXCLUDED.entry_time,
        lunch_start_time = EXCLUDED.lunch_start_time,
        lunch_end_time = EXCLUDED.lunch_end_time,
        exit_time = EXCLUDED.exit_time,
        entry_location = COALESCE(NULLIF(user_attendance_records.entry_location, ''), EXCLUDED.entry_location),
        lunch_start_location = COALESCE(NULLIF(user_attendance_records.lunch_start_location, ''), EXCLUDED.lunch_start_location),
        lunch_end_location = COALESCE(NULLIF(user_attendance_records.lunch_end_location, ''), EXCLUDED.lunch_end_location),
        exit_location = COALESCE(NULLIF(user_attendance_records.exit_location, ''), EXCLUDED.exit_location),
        notes = 'Jornada regularizada por día libre de cumpleaños',
        total_hours = 8,
        updated_at = NOW()
      RETURNING id
    `,
    [userId, redeemDate, entry, lunchOut, lunchIn, exit],
  );
  return result.rows?.[0]?.id || null;
}

async function redeemBirthdayBenefit({ token, actorUser, redeemDate }) {
  const benefit = await getBirthdayBenefitByToken(token);
  assertCanAccessOwnBenefit(actorUser, benefit);

  if (String(benefit.status || "").trim().toLowerCase() === BENEFIT_STATUS.REDEEMED) {
    return buildBenefitSummary(benefit);
  }
  if (!Array.isArray(benefit.coordination_evidence_drive_urls) || !benefit.coordination_evidence_drive_urls.length) {
    const error = new Error("Debes subir la evidencia de coordinación antes de canjear el beneficio");
    error.status = 400;
    throw error;
  }

  const normalizedRedeemDate = validateRedeemDate(benefit, redeemDate);
  const attendanceRecordId = await regularizeBirthdayAttendance({
    userId: Number(benefit.user_id),
    redeemDate: normalizedRedeemDate,
  });

  let calendarEvent = null;
  try {
    calendarEvent = await createTimeOffEvent({
      userEmail: benefit.user_email,
      summary: `Día libre por cumpleaños - ${benefit.user_fullname || benefit.user_email}`,
      description: `Beneficio de cumpleaños canjeado en FamSPI para ${benefit.user_fullname || benefit.user_email}.`,
      startDate: normalizedRedeemDate,
      endDate: normalizedRedeemDate,
      startDateTime: buildEcTimestamp(normalizedRedeemDate, "09:00"),
      endDateTime: buildEcTimestamp(normalizedRedeemDate, "18:00"),
      timezone: ATTENDANCE_TIMEZONE,
      reminderMinutesBefore: 1440,
    });
  } catch (error) {
    logger.warn(
      { error: error?.message, benefitId: benefit.id, userEmail: benefit.user_email },
      "[ATTENDANCE] No se pudo crear evento de calendario para beneficio de cumpleaños",
    );
  }

  let generalNotificationSentAt = null;
  try {
    await sendGeneralBirthdayNotification({
      collaboratorName: benefit.user_fullname || benefit.user_email,
      redeemDate: normalizedRedeemDate,
    });
    generalNotificationSentAt = new Date().toISOString();
  } catch (error) {
    logger.warn(
      { error: error?.message, benefitId: benefit.id, userEmail: benefit.user_email },
      "[ATTENDANCE] No se pudo enviar aviso general por cumpleaños",
    );
  }

  const result = await db.query(
    `
      UPDATE attendance_birthday_day_off_benefits
         SET redeem_date = $2::date,
             redeemed_at = NOW(),
             redeemed_by_user_id = $3,
             calendar_event_id = $4,
             calendar_event_calendar_id = $5,
             general_notification_sent_at = $6,
             attendance_regularized_at = NOW(),
             status = $7,
             metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('attendance_record_id', $8),
             updated_at = NOW()
       WHERE id = $1
       RETURNING *
    `,
    [
      benefit.id,
      normalizedRedeemDate,
      Number(actorUser?.id || 0) || null,
      calendarEvent?.id || null,
      calendarEvent?.calendarId || null,
      generalNotificationSentAt,
      BENEFIT_STATUS.REDEEMED,
      attendanceRecordId,
    ],
  );

  return buildBenefitSummary(result.rows[0]);
}

async function getBirthdayBenefitByTokenForAccess({ token, actorUser = null }) {
  const benefit = await getBirthdayBenefitByToken(token);
  if (actorUser?.id) {
    assertCanAccessOwnBenefit(actorUser, benefit);
  }
  return buildBenefitSummary(benefit);
}

module.exports = {
  BENEFIT_STATUS,
  ensureBirthdayBenefitTable,
  hasBirthdayAdminAccess,
  getBirthdayBenefitSummaryForUser,
  generateBirthdayBenefitQr,
  getBirthdayBenefitByTokenForAccess,
  submitBirthdayBenefitEvidence,
  redeemBirthdayBenefit,
};
