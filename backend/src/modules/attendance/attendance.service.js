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
  const query = await db.query(
    `
    SELECT *
    FROM user_attendance_records
    WHERE user_id = $1 AND date BETWEEN $2 AND $3
    ORDER BY date ASC
    `,
    [userId, startDate, endDate]
  );
  return query.rows;
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

    setFieldText(form, `hora_entrada_${day}`, record ? formatTime(record.entry_time) : "");
    setFieldText(form, `hora_salida_a_${day}`, record ? formatTime(record.lunch_start_time) : "");
    setFieldText(form, `hora_entrada_a_${day}`, record ? formatTime(record.lunch_end_time) : "");
    setFieldText(form, `hora_salida_${day}`, record ? formatTime(record.exit_time) : "");

    const observation = isBeforeHireDate
      ? "NO LABORABA EN LA EMPRESA"
      : isWeekend
      ? "FIN DE SEMANA"
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
    const recordsByMonth = groupRecordsByMonth(yearRecords);

    const mergedPdf = await PDFDocument.create();
    for (let month = 0; month < 12; month += 1) {
      const periodDate = new Date(year, month, 1, 12, 0, 0, 0);
      const monthRecords = recordsByMonth.get(monthKey(periodDate)) || [];
      const monthPdfBuffer = await buildMonthlyPdfBuffer({
        user,
        periodDate,
        records: monthRecords,
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
  const monthRecords = monthRecordsRaw.filter((record) => {
    const recordDate = parseRecordDate(record?.date);
    return Boolean(recordDate && isSameMonth(recordDate, periodDate));
  });

  const monthlyBuffer = await buildMonthlyPdfBuffer({
    user,
    periodDate,
    records: monthRecords,
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
