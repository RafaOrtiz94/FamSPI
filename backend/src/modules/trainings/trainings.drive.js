const {
  copyTemplate,
  replaceTags,
  insertDocsTableRows,
  exportPdfBuffer,
  uploadBase64File,
  ensureFolder,
  exportPdf,
  deleteFile,
} = require("../../utils/drive");
const logger = require("../../config/logger");

const TEMPLATE_ID = "1xOMkBZioaGRg29VyVKjqbnueDTNzL2GePrsh59tRPwQ";
const DRIVE_ROOT   = process.env.DRIVE_ROOT_FOLDER_ID;


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chk(value, match) {
  return value === match ? "■" : "□";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return [
    String(d.getUTCDate()).padStart(2, "0"),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    d.getUTCFullYear(),
  ].join(".");
}

function formatDuration(hours) {
  if (!hours) return "";
  const totalMin = Math.round(Number(hours) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function padMetric(value, width = 3) {
  const raw = String(value ?? "").trim();
  if (!raw) return raw;
  return `${"\u00A0".repeat(Math.max(0, width - raw.length))}${raw}`;
}

function calcPct(attended, total) {
  if (!total) return "0";
  return Math.round((attended / total) * 100).toString();
}

// ---------------------------------------------------------------------------
// Construir mapa de variables simples para replaceTags
// ---------------------------------------------------------------------------

function buildVars(training, attendees) {
  const type = training.event_type || "capacitacion";

  const totalConvocados  = attendees.length;
  const totalAsistentes  = attendees.filter((a) => a.attendance_status === "attended").length;
  const totalInasistentes = attendees.filter((a) => a.attendance_status === "absent").length;

  return {
    // Checkboxes tipo de evento
    CHK_CAPACITACION: chk(type, "capacitacion"),
    CHK_INDUCCION:    chk(type, "induccion"),
    CHK_CHARLA:       chk(type, "charla"),
    CHK_REUNION:      chk(type, "reunion"),

    // Datos generales
    FECHA:            formatDate(training.scheduled_date),
    DURACION:         formatDuration(training.duration_hours),
    AREA_RESPONSABLE: training.area || "",
    CHK_INTERNO:      chk(training.trainer_type, "interno"),
    CHK_EXTERNO:      chk(training.trainer_type, "externo"),
    MATERIAL:         training.material || "",

    // Modalidad
    CHK_PRESENCIAL: chk(training.modality, "presencial"),
    CHK_VIRTUAL:    chk(training.modality, "virtual"),
    CHK_HIBRIDA:    chk(training.modality, "hibrida"),

    // Instructor y contenido
    // Para capacitaciones internas el instructor es el creador; para externas se usa trainer_name
    NOMBRE_INSTRUCTOR: training.trainer_name || training.created_by_name || training.trainer_user_name || "",
    TEMA:              training.title || "",
    OBJETIVO:          training.objectives || "",

    // Análisis
    TOTAL_CONVOCADOS:    padMetric(totalConvocados),
    TOTAL_ASISTENTES:    padMetric(totalAsistentes),
    TOTAL_INASISTENTES:  padMetric(totalInasistentes),
    PORCENTAJE_ASISTENCIA: padMetric(calcPct(totalAsistentes, totalConvocados)),

    // Texto libre
    OBSERVACIONES: training.observations || "",
    CONCLUSIONES:  training.conclusions  || "",
  };
}

// ---------------------------------------------------------------------------
// Asegurar carpeta en Drive: Capacitaciones / CAP-YYYY-NNN
// ---------------------------------------------------------------------------

async function ensureTrainingFolder(trainingCode) {
  const root    = await ensureFolder("Capacitaciones", DRIVE_ROOT);
  const folder  = await ensureFolder(trainingCode, root.id);
  return folder.id;
}

// ---------------------------------------------------------------------------
// Generar acta de asistentes (flujo interna + externa_instructor)
// Retorna: { docId, docUrl, folderId, pdfBase64 }
// ---------------------------------------------------------------------------

// Intenta insertar las filas en la tabla de asistentes.
// Prueba el índice 1 primero (formulario en tabla 0, asistentes en tabla 1).
// Si no encuentra la tabla, prueba el índice 0 (formulario como párrafos normales).
async function insertAttendeeRows(docId, items, getCellValues) {
  const inserted = await insertDocsTableRows(docId, 1, items, getCellValues, { allowEmpty: true });
  if (!inserted) {
    logger.info({ docId }, "Tabla no encontrada en índice 1, reintentando en índice 0");
    await insertDocsTableRows(docId, 0, items, getCellValues, { allowEmpty: true });
  }
}

async function generateActaPdf(training, attendees) {
  const folderId = await ensureTrainingFolder(training.code);

  const doc = await copyTemplate(
    TEMPLATE_ID,
    `Acta ${training.code}`,
    folderId
  );

  await replaceTags(doc.id, buildVars(training, attendees));

  await insertAttendeeRows(
    doc.id,
    attendees,
    (a, i) => [
      String(i + 1),
      a.name_snapshot   || "",
      a.cedula_snapshot || "",
      a.cargo_snapshot  || "",
      a.attendance_status === "absent" ? "Pendiente dar alcance" : "",
    ]
  );

  // Exportar PDF y subirlo a Drive con SHA256
  const pdfResult = await exportPdf(doc.id, folderId, `Acta ${training.code}.pdf`);
  const pdfBuffer = await exportPdfBuffer(doc.id);
  const pdfBase64 = pdfBuffer.toString("base64");

  // Opcionalmente borrar el Google Doc editable (si solo queremos el PDF)
  // await deleteFile(doc.id);

  logger.info({ trainingCode: training.code, pdfId: pdfResult.id }, "Acta de capacitación generada como PDF sellado con SHA256");

  return { 
    pdfId: pdfResult.id, 
    pdfUrl: pdfResult.webViewLink, 
    folderId, 
    pdfBase64,
    content_hash_sha256: pdfResult.content_hash_sha256,
    hash_algorithm: pdfResult.hash_algorithm,
    md5_drive: pdfResult.md5_drive
  };
}

// ---------------------------------------------------------------------------
// Generar acta de inasistentes (solo los ausentes)
// Misma plantilla, pero con los ausentes en la tabla y estadísticas ajustadas
// ---------------------------------------------------------------------------

async function generateAbsentActaPdf(training, absentAttendees) {
  const folderId = await ensureTrainingFolder(training.code);

  const doc = await copyTemplate(
    TEMPLATE_ID,
    `Acta Inasistentes ${training.code}`,
    folderId
  );

  // Esta acta certifica que los inasistentes RECIBIERON el contenido (grabaciones/material).
  // Por eso: convocados = ausentes, asistentes = ausentes, inasistentes = 0, pct = 100%.
  const vars = {
    ...buildVars(training, []),
    TOTAL_CONVOCADOS:      padMetric(absentAttendees.length),
    TOTAL_ASISTENTES:      padMetric(absentAttendees.length),
    TOTAL_INASISTENTES:    padMetric(0),
    PORCENTAJE_ASISTENCIA: padMetric("100"),
    OBSERVACIONES: training.observaciones_inasistentes || training.observations || "",
    CONCLUSIONES:  training.conclusiones_inasistentes  || training.conclusions  || "",
  };

  await replaceTags(doc.id, vars);

  await insertAttendeeRows(
    doc.id,
    absentAttendees,
    (a, i) => [
      String(i + 1),
      a.name_snapshot   || "",
      a.cedula_snapshot || "",
      a.cargo_snapshot  || "",
      "", // Espacio para firma de confirmación de material recibido
    ]
  );

  // Exportar PDF y subirlo a Drive con SHA256
  const pdfResult = await exportPdf(doc.id, folderId, `Acta Inasistentes ${training.code}.pdf`);
  const pdfBuffer = await exportPdfBuffer(doc.id);
  const pdfBase64 = pdfBuffer.toString("base64");

  // Opcionalmente borrar el Google Doc editable
  // await deleteFile(doc.id);

  logger.info({ trainingCode: training.code, pdfId: pdfResult.id }, "Acta de inasistentes generada como PDF sellado con SHA256");

  return { 
    pdfId: pdfResult.id, 
    pdfUrl: pdfResult.webViewLink, 
    folderId, 
    pdfBase64,
    content_hash_sha256: pdfResult.content_hash_sha256,
    hash_algorithm: pdfResult.hash_algorithm,
    md5_drive: pdfResult.md5_drive
  };
}

// ---------------------------------------------------------------------------
// Subir PDF firmado por instructor externo a Drive
// Recibe el buffer del archivo subido por el creador vía multer
// Retorna: { driveId, driveUrl }
// ---------------------------------------------------------------------------

async function uploadExternalSignedPdf(fileBuffer, trainingCode) {
  const folderId = await ensureTrainingFolder(trainingCode);
  const base64   = fileBuffer.toString("base64");

  const result = await uploadBase64File(
    `Acta Firmada Externo ${trainingCode}.pdf`,
    base64,
    "application/pdf",
    folderId
  );

  return { driveId: result.id, driveUrl: result.webViewLink };
}

async function uploadManualSignedActaPdf(fileBuffer, trainingCode, kind = "main") {
  const folderId = await ensureTrainingFolder(trainingCode);
  const base64   = fileBuffer.toString("base64");
  const label = kind === "absent" ? "Acta Inasistentes Firmada" : "Acta Firmada";

  const result = await uploadBase64File(
    `${label} ${trainingCode}.pdf`,
    base64,
    "application/pdf",
    folderId
  );

  return { driveId: result.id, driveUrl: result.webViewLink };
}

module.exports = {
  generateActaPdf,
  generateAbsentActaPdf,
  uploadExternalSignedPdf,
  uploadManualSignedActaPdf,
};
