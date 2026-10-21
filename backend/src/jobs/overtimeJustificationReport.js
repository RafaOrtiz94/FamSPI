/**
 * Informe mensual de justificacion de horas extras (PDF)
 * ------------------------------------------------------
 * Genera el PDF del mes calendario anterior, lo guarda en Drive y lo envia por correo.
 * Se dispara por POST /internal/jobs/attendance/overtime-justification-report (dia 1 de cada mes).
 *
 * Configuracion (sin valores por defecto: colaborador y destinatarios no van en el codigo):
 *   OVERTIME_REPORT_USER_EMAIL            correo del colaborador del informe
 *   OVERTIME_REPORT_RECIPIENTS            destinatarios separados por coma
 *   OVERTIME_REPORT_DRIVE_ROOT_FOLDER_ID  carpeta raiz en Drive (cae a DRIVE_ROOT_FOLDER_ID)
 */

const logger = require("../config/logger");
const { ensureFolder, uploadBase64File } = require("../utils/drive");
const { sendMail } = require("../utils/mailer");
const { generateOvertimeJustificationReport } = require("../modules/attendance/attendanceOvertimeJustification.service");

const DRIVE_FOLDER_NAME = "Informes Horas Extras";

// Mes calendario anterior en hora de Ecuador (UTC-5 fijo)
function previousMonth(now = new Date()) {
  const ec = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const month = ec.getUTCMonth(); // 0-11 => mes anterior en base 1
  return month === 0 ? { year: ec.getUTCFullYear() - 1, month: 12 } : { year: ec.getUTCFullYear(), month };
}

function readConfig() {
  const email = String(process.env.OVERTIME_REPORT_USER_EMAIL || "").trim();
  const recipients = String(process.env.OVERTIME_REPORT_RECIPIENTS || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!email || !recipients.length) {
    const err = new Error("Configura OVERTIME_REPORT_USER_EMAIL y OVERTIME_REPORT_RECIPIENTS");
    err.status = 503;
    throw err;
  }
  return {
    email,
    recipients,
    driveRootId: process.env.OVERTIME_REPORT_DRIVE_ROOT_FOLDER_ID || process.env.DRIVE_ROOT_FOLDER_ID || null,
  };
}

// ponytail: sin control de duplicados; reejecutar el mismo mes crea otro archivo y otro correo.
async function runOnce({ year, month } = {}) {
  const config = readConfig();
  const target = year && month ? { year, month } : previousMonth();
  const report = await generateOvertimeJustificationReport({ email: config.email, ...target });
  const contentBase64 = report.buffer.toString("base64");
  const result = { file_name: report.fileName, period: report.period.key, drive_link: null, emailed: false, errors: [] };

  try {
    if (!config.driveRootId) throw new Error("Falta OVERTIME_REPORT_DRIVE_ROOT_FOLDER_ID o DRIVE_ROOT_FOLDER_ID");
    const folder = await ensureFolder(DRIVE_FOLDER_NAME, config.driveRootId);
    const uploaded = await uploadBase64File(report.fileName, contentBase64, "application/pdf", folder.id);
    result.drive_link = uploaded?.webViewLink || null;
  } catch (error) {
    logger.error({ err: error }, "[OVERTIME REPORT] Fallo la subida a Drive");
    result.errors.push(`drive: ${error.message}`);
  }

  try {
    await sendMail({
      to: config.recipients,
      subject: `Informe de horas extras - ${report.period.label}`,
      html: `
        <p>Se adjunta el informe de justificacion de horas extras correspondiente a ${report.period.label} (mes calendario completo).</p>
        ${result.drive_link ? `<p>Copia en Drive: <a href="${result.drive_link}">${report.fileName}</a></p>` : ""}
      `,
      attachments: [{ filename: report.fileName, contentType: "application/pdf", contentBase64 }],
      source: "attendance_overtime_justification_report",
    });
    result.emailed = true;
  } catch (error) {
    logger.error({ err: error }, "[OVERTIME REPORT] Fallo el envio por correo");
    result.errors.push(`correo: ${error.message}`);
  }

  if (!result.drive_link && !result.emailed) {
    throw new Error(`El informe se genero pero no se pudo entregar (${result.errors.join("; ")})`);
  }
  logger.info({ period: result.period, drive: Boolean(result.drive_link), emailed: result.emailed }, "[OVERTIME REPORT] Informe mensual generado");
  return result;
}

module.exports = { runOnce, previousMonth };
