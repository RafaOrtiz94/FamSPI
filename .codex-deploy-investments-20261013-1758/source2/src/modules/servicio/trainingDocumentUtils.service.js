const PDFDocument = require("pdfkit");
const logger = require("../../config/logger");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");

const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const sanitizeFileToken = (value, fallback = "N-D") => {
  const cleaned = String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return cleaned || fallback;
};

const formatDateLabel = (value) => {
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/D";
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}`;
};

const formatTimestampPart = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}`;
};

const buildTrainingDriveFolder = async ({
  sourceType,
  sourceId,
  clientName,
}) => {
  const driveRootFolderId = process.env.DRIVE_ROOT_FOLDER_ID;
  if (!driveRootFolderId) {
    const error = new Error("DRIVE_ROOT_FOLDER_ID no está configurado");
    error.status = 500;
    error.code = "TRAINING_DRIVE_NOT_CONFIGURED";
    throw error;
  }

  const servicioFolder = await ensureFolder("Servicio Técnico", driveRootFolderId);
  const trainingFolder = await ensureFolder("Entrenamiento", servicioFolder.id);
  const workflowFolderName = `WF-${sanitizeFileToken(sourceType || "manual").toUpperCase()}-${sanitizeFileToken(sourceId || "manual")}`;
  const workflowFolder = await ensureFolder(workflowFolderName, trainingFolder.id);
  const clientFolder = await ensureFolder(
    sanitizeFileToken(clientName || "Cliente", "Cliente"),
    workflowFolder.id,
  );
  return {
    rootFolderId: driveRootFolderId,
    servicioFolderId: servicioFolder.id,
    trainingFolderId: trainingFolder.id,
    workflowFolderId: workflowFolder.id,
    clientFolderId: clientFolder.id,
  };
};

const generateNarrativePdfBuffer = async ({
  title,
  subtitle = null,
  headerLines = [],
  sections = [],
}) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 42, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.font("Helvetica-Bold").fontSize(14).text(String(title || "Documento ST"), {
      align: "center",
    });
    if (subtitle) {
      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(10).fillColor("#334155").text(String(subtitle), {
        align: "center",
      });
    }
    doc.moveDown(0.8);
    doc.fillColor("#0f172a").font("Helvetica").fontSize(10);

    safeArray(headerLines)
      .map((line) => normalizeText(line))
      .filter(Boolean)
      .forEach((line) => doc.text(line));

    safeArray(sections).forEach((section) => {
      const sectionTitle = normalizeText(section?.title);
      if (sectionTitle) {
        doc.moveDown(0.6);
        doc.font("Helvetica-Bold").fontSize(10).text(sectionTitle);
        doc.font("Helvetica").fontSize(10);
      }

      const lines = safeArray(section?.lines)
        .map((line) => normalizeText(line))
        .filter(Boolean);
      if (!lines.length) {
        doc.text("N/D");
      } else {
        lines.forEach((line) => doc.text(`- ${line}`));
      }
    });

    doc.moveDown(0.8);
    doc.fillColor("#475569").fontSize(8).text(
      `Generado por SPI el ${new Date().toISOString()}`,
      { align: "right" },
    );
    doc.end();
  });

const uploadTrainingPdf = async ({
  buffer,
  fileName,
  parentFolderId,
}) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const error = new Error("Buffer de PDF inválido para subir a Drive");
    error.status = 500;
    error.code = "TRAINING_PDF_BUFFER_INVALID";
    throw error;
  }
  try {
    const uploaded = await uploadBase64File(
      fileName,
      buffer.toString("base64"),
      "application/pdf",
      parentFolderId,
    );
    return uploaded;
  } catch (error) {
    logger.error({ error, fileName, parentFolderId }, "No se pudo subir PDF de entrenamiento a Drive");
    throw error;
  }
};

module.exports = {
  normalizeText,
  safeArray,
  sanitizeFileToken,
  formatDateLabel,
  formatTimestampPart,
  buildTrainingDriveFolder,
  generateNarrativePdfBuffer,
  uploadTrainingPdf,
};
