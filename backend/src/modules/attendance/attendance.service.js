/**
 * src/modules/attendance/attendance.service.js
 * --------------------------------------------
 * PDF generation for attendance reports:
 * - Monthly mode: 1 RH-09 page for selected month
 * - Annual mode: 12 RH-09 pages (one per month)
 */

const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const db = require("../../config/db");
const logger = require("../../config/logger");
const { drive } = require("../../config/google");
const { securePdfForm } = require("../../utils/pdfFormSecurity");
const { buildAttendanceRegularization } = require("./attendanceReports.service");
const {
  HASH_ALGORITHM,
  computeSha256HexFromBuffer,
} = require("../../utils/documentHash");

const TEMPLATE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "plantillas",
  "F.RH-09_V01_PLANTILLA_RA.pdf"
);

let templateBytesCache = null;

const getTemplateBytes = () => {
  if (!templateBytesCache) {
    templateBytesCache = fs.readFileSync(TEMPLATE_PATH);
  }
  return templateBytesCache;
};

const normalizePeriodType = (value) =>
  String(value || "monthly").trim().toLowerCase() === "annual" ? "annual" : "monthly";

const parseDateOnly = (value) => {
  if (!value) return null;
  const parts = String(value).trim().split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
};

const formatDateOnly = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const parseRecordDate = (rawValue) => {
  if (!rawValue) return null;

  if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
    return new Date(
      rawValue.getFullYear(),
      rawValue.getMonth(),
      rawValue.getDate(),
      12,
      0,
      0,
      0
    );
  }

  const asString = String(rawValue).trim();
  const match = asString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
};

const isSameMonth = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const isDateBefore = (a, b) =>
  a.getFullYear() < b.getFullYear() ||
  (a.getFullYear() === b.getFullYear() &&
    (a.getMonth() < b.getMonth() ||
      (a.getMonth() === b.getMonth() && a.getDate() < b.getDate())));

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const normalizeMonthName = (date) =>
  date
    .toLocaleString("es-EC", { month: "long" })
    .replace(/^(.)/, (c) => c.toUpperCase());

const normalizeTimeOffType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "vacaciones") return "vacaciones";
  if (normalized === "permiso") return "permiso";
  return null;
};

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const endOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const parseDateTime = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const fromDateOnly = parseDateOnly(value);
  if (fromDateOnly) return fromDateOnly;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const buildVacationLabel = (ids = []) => `VAC-ID ${ids.join("/")}`;
const buildPermissionLabel = (id, timeLabel = "") =>
  `PER-ID ${id}${timeLabel ? ` ${timeLabel}` : ""}`;

const uniqueNumericIds = (values = []) =>
  [...new Set(values.map((item) => Number.parseInt(item, 10)).filter((item) => Number.isInteger(item)))];

/**
 * Download signature image from Google Drive (service account)
 */
const downloadSignatureFromDrive = async (fileId) => {
  try {
    const response = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(response.data);
  } catch (err) {
    logger.error({ err, fileId }, "Error downloading signature from Drive");
    return null;
  }
};

/**
 * Format time in HH:mm 24h format
 */
const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

/**
 * Safely set a form field text value
 */
const setFieldText = (form, fieldName, value) => {
  try {
    const field = form.getField(fieldName);
    if (field && typeof field.setText === "function") {
      field.setText(value ?? "");
      return true;
    }
  } catch (err) {
    logger.warn({ fieldName, err }, "No se pudo asignar texto al campo");
  }
  return false;
};

/**
 * Attempt to set an image into a field (button) or fall back to text note
 */
const setFieldSignature = async (
  pdfDoc,
  form,
  fieldName,
  signatureBuffer,
  textFallback = "",
  fillTextWhenMissing = false
) => {
  try {
    const field = form.getField(fieldName);
    if (!field) return;

    if (signatureBuffer) {
      let image;
      try {
        image = await pdfDoc.embedPng(signatureBuffer);
      } catch {
        image = await pdfDoc.embedJpg(signatureBuffer);
      }

      if (typeof field.setImage === "function") {
        field.setImage(image);
      }

      if (textFallback && typeof field.setText === "function") {
        field.setText(textFallback);
      }

      if (typeof field.setImage === "function" || typeof field.setText === "function") {
        return;
      }
    }

    if (fillTextWhenMissing && typeof field.setText === "function") {
      field.setText(textFallback);
    }
  } catch (err) {
    logger.warn({ fieldName, err }, "No se pudo asignar firma al campo");
  }
};

const fetchAttendanceUser = async (userId) => {
  try {
    const query = await db.query(
      `
      SELECT
        u.id,
        u.fullname,
        u.email,
        u.role,
        u.created_at,
        u.lopdp_internal_signature_file_id,
        d.name AS department_name,
        NULLIF(cp.profile->'laboral'->>'fecha_ingreso', '') AS hire_date
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
      `,
      [userId]
    );
    return query.rows[0] || null;
  } catch (err) {
    // Backward compatibility: collaborator_profiles may not exist in old envs.
    if (err?.code !== "42P01") throw err;

    const query = await db.query(
      `
      SELECT
        u.id,
        u.fullname,
        u.email,
        u.role,
        u.created_at,
        u.lopdp_internal_signature_file_id,
        d.name AS department_name,
        NULL::text AS hire_date
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1
      LIMIT 1
      `,
      [userId]
    );
    return query.rows[0] || null;
  }
};

const fetchAttendanceRecords = async (userId, startDate, endDate) => {
  const baseSelect = `
      SELECT
        a.*,
        ex.exception_type,
        ex.exception_status,
        COALESCE(field_ops.field_events, '[]'::json) AS field_events
      FROM user_attendance_records a
      LEFT JOIN LATERAL (
        SELECT
          e.type AS exception_type,
          e.status AS exception_status
        FROM attendance_exceptions e
        WHERE e.user_id = a.user_id
          AND (
            e.date = a.date
            OR (
              LOWER(COALESCE(e.type, '')) = ANY(ARRAY['operacion_campo', 'operacion_de_campo', 'salida_oficina', 'viaje', 'campo']::text[])
              AND a.date BETWEEN e.date AND COALESCE(e.return_time::date, e.date)
            )
          )
        ORDER BY COALESCE(e.start_time, e.created_at) DESC, e.id DESC
        LIMIT 1
      ) ex ON true
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(
            json_agg(
              json_build_object(
                'type', event_rows.event_type,
                'time', event_rows.event_time
              )
              ORDER BY event_rows.event_time ASC
            ),
            '[]'::json
          ) AS field_events
        FROM (
          SELECT 'client_entry'::text AS event_type, cvl.hora_entrada AS event_time
          FROM client_visit_logs cvl
          WHERE cvl.user_email IS NOT NULL
            AND LOWER(COALESCE(cvl.user_email, '')) = LOWER(COALESCE((SELECT email FROM users WHERE id = a.user_id LIMIT 1), ''))
            AND cvl.visit_date = a.date
            AND cvl.hora_entrada IS NOT NULL
          UNION ALL
          SELECT 'client_exit'::text AS event_type, cvl.hora_salida AS event_time
          FROM client_visit_logs cvl
          WHERE cvl.user_email IS NOT NULL
            AND LOWER(COALESCE(cvl.user_email, '')) = LOWER(COALESCE((SELECT email FROM users WHERE id = a.user_id LIMIT 1), ''))
            AND cvl.visit_date = a.date
            AND cvl.hora_salida IS NOT NULL
          UNION ALL
          SELECT 'client_entry'::text AS event_type, pv.check_in_time AS event_time
          FROM prospect_visits pv
          WHERE pv.user_email IS NOT NULL
            AND LOWER(COALESCE(pv.user_email, '')) = LOWER(COALESCE((SELECT email FROM users WHERE id = a.user_id LIMIT 1), ''))
            AND pv.visit_date = a.date
            AND pv.check_in_time IS NOT NULL
          UNION ALL
          SELECT 'client_exit'::text AS event_type, pv.check_out_time AS event_time
          FROM prospect_visits pv
          WHERE pv.user_email IS NOT NULL
            AND LOWER(COALESCE(pv.user_email, '')) = LOWER(COALESCE((SELECT email FROM users WHERE id = a.user_id LIMIT 1), ''))
            AND pv.visit_date = a.date
            AND pv.check_out_time IS NOT NULL
          UNION ALL
          SELECT 'office_exit'::text AS event_type, e.start_time AS event_time
          FROM attendance_exceptions e
          WHERE e.user_id = a.user_id
            AND e.date = a.date
            AND e.start_time IS NOT NULL
          UNION ALL
          SELECT 'office_entry'::text AS event_type, e.return_time AS event_time
          FROM attendance_exceptions e
          WHERE e.user_id = a.user_id
            AND e.date = a.date
            AND e.return_time IS NOT NULL
        ) event_rows
      ) field_ops ON true
      WHERE a.user_id = $1
        AND a.date BETWEEN $2 AND $3
  `;
  try {
    const query = await db.query(
      `
      SELECT
        a.*,
        lj.status AS late_justification_status,
        lj.regularized_entry_time AS late_regularized_entry_time,
        base.exception_type,
        base.exception_status,
        base.field_events
      FROM (${baseSelect}) base
      JOIN user_attendance_records a ON a.id = base.id
      LEFT JOIN attendance_late_justifications lj
        ON lj.user_id = a.user_id
       AND lj.attendance_date = a.date
      ORDER BY a.date ASC
      `,
      [userId, startDate, endDate]
    );
    return query.rows.map((row) => ({ ...row, ...buildAttendanceRegularization(row) }));
  } catch (err) {
    if (err?.code !== "42P01") throw err;
    const query = await db.query(
      `
      SELECT a.*, base.exception_type, base.exception_status, base.field_events
      FROM (${baseSelect}) base
      JOIN user_attendance_records a ON a.id = base.id
      ORDER BY date ASC
      `,
      [userId, startDate, endDate]
    );
    return query.rows.map((row) => ({ ...row, ...buildAttendanceRegularization(row) }));
  }
};

const fetchApprovedTimeOffRecords = async (userEmail, startDate, endDate) => {
  if (!userEmail) return [];

  const query = await db.query(
    `
    SELECT
      id,
      tipo_solicitud,
      fecha_inicio,
      fecha_fin,
      fecha_inicio_hora,
      fecha_fin_hora
    FROM permisos_vacaciones
    WHERE LOWER(COALESCE(user_email, '')) = LOWER($1)
      AND LOWER(COALESCE(status, '')) IN ('approved', 'aprobado')
      AND (
        (
          fecha_inicio_hora IS NOT NULL
          AND fecha_fin_hora IS NOT NULL
          AND fecha_fin_hora >= $2::timestamptz
          AND fecha_inicio_hora <= $3::timestamptz
        )
        OR
        (
          (fecha_inicio_hora IS NULL OR fecha_fin_hora IS NULL)
          AND COALESCE(fecha_fin, $3::date) >= $2::date
          AND COALESCE(fecha_inicio, $2::date) <= $3::date
        )
      )
    ORDER BY COALESCE(fecha_inicio_hora, fecha_inicio::timestamptz) ASC, id ASC
    `,
    [userEmail, startDate, endDate]
  );

  return query.rows || [];
};

const buildMonthlyTimeOffMap = (periodDate, rawTimeOffRecords = []) => {
  const periodYear = periodDate.getFullYear();
  const periodMonth = periodDate.getMonth();
  const daysInMonth = new Date(periodYear, periodMonth + 1, 0).getDate();

  const map = new Map();
  const ensureDayState = (day) => {
    if (!map.has(day)) {
      map.set(day, {
        vacations: new Set(),
        permissions: [],
      });
    }
    return map.get(day);
  };

  for (const row of rawTimeOffRecords) {
    const requestId = Number.parseInt(row?.id, 10);
    if (!Number.isInteger(requestId)) continue;

    const type = normalizeTimeOffType(row?.tipo_solicitud);
    if (!type) continue;

    const startAtRaw = parseDateTime(row?.fecha_inicio_hora);
    const endAtRaw = parseDateTime(row?.fecha_fin_hora);

    const startAt = startAtRaw || parseDateOnly(row?.fecha_inicio);
    const endAt = endAtRaw || parseDateOnly(row?.fecha_fin) || startAt;
    if (!startAt || !endAt) continue;

    let cursor = startOfDay(startAt);
    const finalDay = startOfDay(endAt);
    while (!isDateBefore(finalDay, cursor)) {
      if (cursor.getFullYear() === periodYear && cursor.getMonth() === periodMonth) {
        const day = cursor.getDate();
        if (day >= 1 && day <= daysInMonth) {
          const dayState = ensureDayState(day);

          if (type === "vacaciones" && !startAtRaw && !endAtRaw) {
            dayState.vacations.add(requestId);
          } else {
            const segmentStart = startAtRaw ? new Date(startAtRaw) : startOfDay(cursor);
            const segmentEnd = endAtRaw ? new Date(endAtRaw) : endOfDay(cursor);
            dayState.permissions.push({
              id: requestId,
              start: segmentStart,
              end: segmentEnd,
            });
          }
        }
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 0, 0, 0, 0);
    }
  }

  return map;
};

const resolveHourlySlotValue = ({ rawValue, slotName, dayTimeOff, regularizedEntryTime = null, lateJustificationStatus = null }) => {
  if (slotName === "entry" && lateJustificationStatus === "approved") {
    const regularized = String(regularizedEntryTime || "").trim();
    if (regularized) {
      return regularized.slice(0, 5);
    }
  }

  const formattedTime = rawValue ? formatTime(rawValue) : "";
  if (!dayTimeOff) return formattedTime;

  const vacationIds = uniqueNumericIds([...dayTimeOff.vacations]);
  if (vacationIds.length) {
    return buildVacationLabel(vacationIds);
  }

  const permissions = Array.isArray(dayTimeOff.permissions) ? dayTimeOff.permissions : [];
  if (!permissions.length) return formattedTime;

  if (formattedTime) {
    const rawDate = parseDateTime(rawValue);
    if (rawDate) {
      const match = permissions.find(
        (item) =>
          item?.start instanceof Date &&
          item?.end instanceof Date &&
          !Number.isNaN(item.start.getTime()) &&
          !Number.isNaN(item.end.getTime()) &&
          rawDate >= item.start &&
          rawDate <= item.end
      );
      if (match) return buildPermissionLabel(match.id, formattedTime);
    }
    return formattedTime;
  }

  const sortedByStart = [...permissions].sort((a, b) => a.start - b.start);
  if (slotName === "entry") {
    const first = sortedByStart[0];
    const resumeTime = first?.end ? formatTime(first.end) : "";
    return buildPermissionLabel(first.id, resumeTime);
  }

  const permissionIds = uniqueNumericIds(sortedByStart.map((item) => item.id));
  if (!permissionIds.length) return "";
  if (permissionIds.length === 1) return buildPermissionLabel(permissionIds[0]);
  return permissionIds.map((id) => buildPermissionLabel(id)).join(" / ");
};

const resolveHireDate = (user) => {
  const profileHireDate = parseDateOnly(user?.hire_date);
  if (profileHireDate) return profileHireDate;

  const created = new Date(user?.created_at);
  if (Number.isNaN(created.getTime())) return null;
  return new Date(created.getFullYear(), created.getMonth(), created.getDate(), 12, 0, 0, 0);
};

const groupRecordsByMonth = (records = []) => {
  const grouped = new Map();
  for (const record of records) {
    const recordDate = parseRecordDate(record?.date);
    if (!recordDate) continue;
    const key = monthKey(recordDate);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);
  }
  return grouped;
};

const addIntegrityNoticeToPages = async (pdfDoc, periodDate) => {
  const footerFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const noticeLine1 =
    "Documento bloqueado al generarse. No permite editar campos del formulario.";
  const noticeLine2 = `Integridad SHA-256 verificada al descargar. Periodo: ${normalizeMonthName(
    periodDate
  )} ${periodDate.getFullYear()}.`;

  for (const page of pdfDoc.getPages()) {
    const width = page.getWidth();
    page.drawRectangle({
      x: 18,
      y: 8,
      width: width - 36,
      height: 24,
      color: rgb(0.965, 0.965, 0.965),
      borderColor: rgb(0.78, 0.78, 0.78),
      borderWidth: 0.5,
      opacity: 0.95,
    });
    page.drawText(noticeLine1, {
      x: 24,
      y: 22,
      size: 7,
      font: footerFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    page.drawText(noticeLine2, {
      x: 24,
      y: 13,
      size: 7,
      font: footerFont,
      color: rgb(0.2, 0.2, 0.2),
    });
  }
};

const buildMonthlyPdfBuffer = async ({
  user,
  periodDate,
  records = [],
  timeOffRecords = [],
  signatureBuffer = null,
  hireDate = null,
}) => {
  const templateBytes = getTemplateBytes();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  const periodYear = periodDate.getFullYear();
  const periodMonth = periodDate.getMonth();
  const daysInMonth = new Date(periodYear, periodMonth + 1, 0).getDate();

  setFieldText(form, "nombre_usuario", user.fullname || "");
  setFieldText(form, "ra_ano", `${periodYear}`);
  setFieldText(form, "ra_mes", normalizeMonthName(periodDate));

  const recordsByDay = new Map();
  for (const record of records) {
    const recordDate = parseRecordDate(record?.date);
    if (!recordDate || !isSameMonth(recordDate, periodDate)) continue;
    recordsByDay.set(recordDate.getDate(), record);
  }
  const timeOffByDay = buildMonthlyTimeOffMap(periodDate, timeOffRecords);

  for (let day = 1; day <= 31; day += 1) {
    if (day > daysInMonth) {
      setFieldText(form, `hora_entrada_${day}`, "");
      setFieldText(form, `hora_salida_${day}`, "");
      setFieldText(form, `hora_entrada_a_${day}`, "");
      setFieldText(form, `hora_salida_a_${day}`, "");
      setFieldText(form, `ra_observaciones_${day}`, "");
      await setFieldSignature(pdfDoc, form, `Firma_${day}`, null, "", true);
      await setFieldSignature(pdfDoc, form, `Firma_S_${day}`, null, "", true);
      continue;
    }

    const currentDate = new Date(periodYear, periodMonth, day, 12, 0, 0, 0);
    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
    const isBeforeHireDate = Boolean(hireDate && isDateBefore(currentDate, hireDate));
    const record = isBeforeHireDate ? null : recordsByDay.get(day);
    const dayTimeOff = isBeforeHireDate ? null : timeOffByDay.get(day);

    setFieldText(
      form,
      `hora_entrada_${day}`,
      resolveHourlySlotValue({
        rawValue: record?.acta_entry_time || record?.entry_time,
        slotName: "entry",
        dayTimeOff,
        regularizedEntryTime: record?.late_regularized_entry_time || null,
        lateJustificationStatus: record?.late_justification_status || null,
      })
    );
    setFieldText(
      form,
      `hora_salida_a_${day}`,
      resolveHourlySlotValue({ rawValue: record?.acta_lunch_start_time || record?.lunch_start_time, slotName: "lunch_start", dayTimeOff })
    );
    setFieldText(
      form,
      `hora_entrada_a_${day}`,
      resolveHourlySlotValue({ rawValue: record?.acta_lunch_end_time || record?.lunch_end_time, slotName: "lunch_end", dayTimeOff })
    );
    setFieldText(
      form,
      `hora_salida_${day}`,
      resolveHourlySlotValue({ rawValue: record?.acta_exit_time || record?.exit_time, slotName: "exit", dayTimeOff })
    );

    const observation = isBeforeHireDate
      ? "NO LABORABA EN LA EMPRESA"
      : isWeekend
      ? "FIN DE SEMANA"
      : dayTimeOff?.vacations?.size
      ? buildVacationLabel(uniqueNumericIds([...dayTimeOff.vacations]))
      : dayTimeOff?.permissions?.length
      ? uniqueNumericIds(dayTimeOff.permissions.map((item) => item.id))
          .map((id) => buildPermissionLabel(id))
          .join(" / ")
      : "";
    setFieldText(form, `ra_observaciones_${day}`, observation);

    const hasFirstCycle = record && record.entry_time && record.lunch_start_time;
    if (hasFirstCycle && signatureBuffer) {
      await setFieldSignature(pdfDoc, form, `Firma_${day}`, signatureBuffer);
    } else {
      await setFieldSignature(pdfDoc, form, `Firma_${day}`, null, "", true);
    }

    const hasSecondCycle = record && record.lunch_end_time && record.exit_time;
    if (hasSecondCycle && signatureBuffer) {
      await setFieldSignature(pdfDoc, form, `Firma_S_${day}`, signatureBuffer);
    } else {
      await setFieldSignature(pdfDoc, form, `Firma_S_${day}`, null, "", true);
    }
  }

  // Explicitly remove bottom act signature fields (requested change).
  setFieldText(form, "Firma_uno", "");
  setFieldText(form, "Firma_dos", "");
  setFieldText(form, "firma_dos", "");

  // Lock all form fields and convert to static content.
  securePdfForm(form);

  // Add immutable notice in footer.
  await addIntegrityNoticeToPages(pdfDoc, periodDate);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
};

const resolveAnnualYear = (year, startDate, endDate) => {
  const parsedYear = Number.parseInt(year, 10);
  if (Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100) {
    return parsedYear;
  }

  const parsedStart = parseDateOnly(startDate);
  if (parsedStart) return parsedStart.getFullYear();

  const parsedEnd = parseDateOnly(endDate);
  if (parsedEnd) return parsedEnd.getFullYear();

  return new Date().getFullYear();
};

const finalizeResult = (buffer, extra = {}) => {
  const hashSha256 = computeSha256HexFromBuffer(buffer);
  return {
    buffer,
    hashSha256,
    hashAlgorithm: HASH_ALGORITHM,
    ...extra,
  };
};

/**
 * Generate attendance PDF report.
 * @param {number|string} userId
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @param {{ periodType?: 'monthly'|'annual', year?: number|string }} options
 */
const generateAttendancePDF = async (userId, startDate, endDate, options = {}) => {
  const targetUserId = Number(userId);
  if (!Number.isFinite(targetUserId)) {
    throw new Error("Usuario invalido");
  }

  const periodType = normalizePeriodType(options?.periodType);
  const user = await fetchAttendanceUser(targetUserId);
  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  const hireDate = resolveHireDate(user);

  let signatureBuffer = null;
  if (user.lopdp_internal_signature_file_id) {
    signatureBuffer = await downloadSignatureFromDrive(user.lopdp_internal_signature_file_id);
  }

  if (periodType === "annual") {
    const year = resolveAnnualYear(options?.year, startDate, endDate);
    const annualStart = new Date(year, 0, 1, 12, 0, 0, 0);
    const annualEnd = new Date(year, 11, 31, 12, 0, 0, 0);

    const yearRecords = await fetchAttendanceRecords(
      targetUserId,
      formatDateOnly(annualStart),
      formatDateOnly(annualEnd)
    );
    const yearTimeOffRecords = await fetchApprovedTimeOffRecords(
      user.email,
      formatDateOnly(annualStart),
      formatDateOnly(annualEnd)
    );
    const recordsByMonth = groupRecordsByMonth(yearRecords);

    const mergedPdf = await PDFDocument.create();
    for (let month = 0; month < 12; month += 1) {
      const periodDate = new Date(year, month, 1, 12, 0, 0, 0);
      const monthRecords = recordsByMonth.get(monthKey(periodDate)) || [];
      const monthPdfBuffer = await buildMonthlyPdfBuffer({
        user,
        periodDate,
        records: monthRecords,
        timeOffRecords: yearTimeOffRecords,
        signatureBuffer,
        hireDate,
      });
      const monthPdfDoc = await PDFDocument.load(monthPdfBuffer);
      const copiedPages = await mergedPdf.copyPages(monthPdfDoc, monthPdfDoc.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();
    const mergedBuffer = Buffer.from(mergedBytes);
    return finalizeResult(mergedBuffer, {
      periodType: "annual",
      reportYear: year,
      fileLabel: `${year}-anual`,
      periodStart: formatDateOnly(annualStart),
      periodEnd: formatDateOnly(annualEnd),
    });
  }

  const parsedStartDate = parseDateOnly(startDate);
  const parsedEndDate = parseDateOnly(endDate);
  if (!parsedStartDate || !parsedEndDate) {
    throw new Error("Fechas invalidas para reporte mensual");
  }

  const periodDate = new Date(
    parsedStartDate.getFullYear(),
    parsedStartDate.getMonth(),
    1,
    12,
    0,
    0,
    0
  );

  const monthRecordsRaw = await fetchAttendanceRecords(
    targetUserId,
    formatDateOnly(parsedStartDate),
    formatDateOnly(parsedEndDate)
  );
  const monthTimeOffRecords = await fetchApprovedTimeOffRecords(
    user.email,
    formatDateOnly(parsedStartDate),
    formatDateOnly(parsedEndDate)
  );
  const monthRecords = monthRecordsRaw.filter((record) => {
    const recordDate = parseRecordDate(record?.date);
    return Boolean(recordDate && isSameMonth(recordDate, periodDate));
  });

  const monthlyBuffer = await buildMonthlyPdfBuffer({
    user,
    periodDate,
    records: monthRecords,
    timeOffRecords: monthTimeOffRecords,
    signatureBuffer,
    hireDate,
  });

  return finalizeResult(monthlyBuffer, {
    periodType: "monthly",
    fileLabel: `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, "0")}`,
    periodStart: formatDateOnly(parsedStartDate),
    periodEnd: formatDateOnly(parsedEndDate),
  });
};

module.exports = {
  generateAttendancePDF,
};
