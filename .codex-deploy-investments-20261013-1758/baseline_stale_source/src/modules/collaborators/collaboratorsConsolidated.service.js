const AdmZip = require("adm-zip");
const { PDFDocument } = require("pdf-lib");

const logger = require("../../config/logger");
const {
  downloadFileBuffer,
  exportPdfBuffer,
  getFileMetadata,
} = require("../../utils/drive");
const collaboratorsService = require("./collaborators.service");

const MAX_USERS_PER_REQUEST = 50;
const QUALIFICATION_PREFIX = "qualification:";
const GOOGLE_NATIVE_PREFIX = "application/vnd.google-apps.";

const DOCUMENT_LABELS = {
  third_level_title: "Titulo de tercer nivel",
  fourth_level_title: "Titulo de cuarto nivel",
  certification: "Certificacion",
  pending: "Credencial pendiente de clasificacion",
};

const normalizeIds = (values = []) => [
  ...new Set(
    (Array.isArray(values) ? values : [values])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  ),
];

const normalizeKeys = (values = []) => [
  ...new Set(
    (Array.isArray(values) ? values : [values])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  ),
];

const sanitizeFilename = (value, fallback = "colaborador") => {
  const normalized = String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return normalized || fallback;
};

const extractDriveFileId = (url = "") => {
  const value = String(url || "");
  const match = value.match(/\/d\/([a-zA-Z0-9_-]+)/) || value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match?.[1] || null;
};

const qualificationKey = (qualification) =>
  `${QUALIFICATION_PREFIX}${qualification?.qualification_type || "pending"}`;

const qualificationLabel = (qualification) =>
  DOCUMENT_LABELS[qualification?.qualification_type] ||
  (qualification?.pending_classification ? DOCUMENT_LABELS.pending : "Credencial");

const isSelected = (key, selectedKeys) =>
  selectedKeys.length === 0 || selectedKeys.includes(key);

const buildSourcesForRow = (row, selectedKeys) => {
  const sources = [];

  Object.entries(row.documents || {}).forEach(([key, document]) => {
    if (document && isSelected(key, selectedKeys)) {
      sources.push({
        key,
        label: key,
        fileId: document.drive_file_id || extractDriveFileId(document.drive_url),
        fileName: document.file_name || `${key}.pdf`,
        mimeType: document.mime_type || null,
        url: document.drive_url || null,
      });
    }
  });

  (row.qualifications || []).forEach((qualification) => {
    const key = qualificationKey(qualification);
    if (
      qualification &&
      (isSelected(key, selectedKeys) ||
        (qualification.qualification_type &&
          isSelected(`${QUALIFICATION_PREFIX}${qualification.qualification_type}`, selectedKeys)))
    ) {
      sources.push({
        key,
        label: qualificationLabel(qualification),
        fileId:
          qualification.drive_file_id || extractDriveFileId(qualification.drive_url),
        fileName: qualification.file_name || `${sanitizeFilename(qualification.title, "credencial")}.pdf`,
        mimeType: qualification.mime_type || null,
        url: qualification.drive_url || null,
      });
    }
  });

  const seen = new Set();
  const uniqueSources = sources.filter((source) => {
    const identity = source.fileId || `${source.key}:${source.fileName}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });

  if (!selectedKeys.length) return uniqueSources;

  const order = new Map(selectedKeys.map((key, index) => [key, index]));
  return uniqueSources.sort((left, right) => {
    const leftOrder = order.has(left.key) ? order.get(left.key) : Number.MAX_SAFE_INTEGER;
    const rightOrder = order.has(right.key) ? order.get(right.key) : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
};

const resolveSourceBuffer = async (source) => {
  if (!source.fileId) {
    throw new Error("El registro no tiene un archivo asociado en Drive");
  }

  let mimeType = source.mimeType;
  let fileName = source.fileName;
  if (!mimeType || !fileName) {
    const metadata = await getFileMetadata(source.fileId, "id,name,mimeType");
    mimeType = mimeType || metadata?.mimeType || null;
    fileName = fileName || metadata?.name || source.fileName;
  }

  if (mimeType?.startsWith(GOOGLE_NATIVE_PREFIX)) {
    return {
      buffer: await exportPdfBuffer(source.fileId),
      mimeType: "application/pdf",
      fileName,
    };
  }

  return {
    buffer: await downloadFileBuffer(source.fileId),
    mimeType: mimeType || (String(fileName || "").toLowerCase().endsWith(".pdf") ? "application/pdf" : null),
    fileName,
  };
};

const appendImage = async (pdf, buffer, mimeType) => {
  const image = mimeType === "image/png" ? await pdf.embedPng(buffer) : await pdf.embedJpg(buffer);
  const page = pdf.addPage();
  const margin = 36;
  const maxWidth = page.getWidth() - margin * 2;
  const maxHeight = page.getHeight() - margin * 2;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
    x: (page.getWidth() - width) / 2,
    y: (page.getHeight() - height) / 2,
    width,
    height,
  });
};

const appendSource = async (pdf, source) => {
  const resolved = await resolveSourceBuffer(source);
  const mimeType = String(resolved.mimeType || "").toLowerCase();
  if (mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/jpg") {
    await appendImage(pdf, resolved.buffer, mimeType === "image/png" ? "image/png" : "image/jpeg");
    return;
  }

  const sourcePdf = await PDFDocument.load(resolved.buffer);
  const pages = await pdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
  pages.forEach((page) => pdf.addPage(page));
};

const buildCollaboratorPdf = async (row, selectedKeys) => {
  const sources = buildSourcesForRow(row, selectedKeys);
  const availableKeys = new Set(sources.map((source) => source.key));
  const skipped = selectedKeys
    .filter((key) => !availableKeys.has(key))
    .map((key) => ({ label: key, reason: "No existe un archivo cargado para este colaborador" }));
  const pdf = await PDFDocument.create();

  let appendedCount = 0;
  for (const source of sources) {
    try {
      await appendSource(pdf, source);
      appendedCount += 1;
    } catch (error) {
      logger.warn({ err: error, userId: row.user_id, sourceKey: source.key }, "No se pudo incorporar archivo al consolidado");
      skipped.push({ label: source.label, reason: "No se pudo leer el archivo de Drive" });
    }
  }

  if (appendedCount === 0) {
    const error = new Error(`No se pudo acceder a los documentos de Drive de ${row.fullname || `Usuario #${row.user_id}`}`);
    error.status = 424;
    error.details = { user_id: row.user_id, skipped_documents: skipped };
    throw error;
  }

  return Buffer.from(await pdf.save());
};

const generateConsolidatedDocuments = async ({ userIds = [], documentKeys = [] } = {}) => {
  const requestedUserIds = normalizeIds(userIds);
  const selectedKeys = normalizeKeys(documentKeys);
  if (requestedUserIds.length > MAX_USERS_PER_REQUEST) {
    const error = new Error(`No se pueden consolidar mas de ${MAX_USERS_PER_REQUEST} colaboradores por solicitud`);
    error.status = 400;
    throw error;
  }

  const rows = await collaboratorsService.getDocumentsReport();
  const selectedRows = requestedUserIds.length
    ? rows.filter((row) => requestedUserIds.includes(Number(row.user_id)))
    : rows;
  if (!selectedRows.length) {
    const error = new Error("No se encontraron colaboradores validos para consolidar");
    error.status = 400;
    throw error;
  }

  const missingUsers = requestedUserIds.filter(
    (userId) => !selectedRows.some((row) => Number(row.user_id) === userId),
  );
  if (missingUsers.length) {
    const error = new Error("Uno o mas colaboradores no estan disponibles en el reporte");
    error.status = 400;
    error.details = { missing_user_ids: missingUsers };
    throw error;
  }

  const generated = [];
  for (const row of selectedRows) {
    const buffer = await buildCollaboratorPdf(row, selectedKeys);
    const name = sanitizeFilename(row.fullname, `usuario_${row.user_id}`);
    generated.push({
      filename: `consolidado_${name}.pdf`,
      buffer,
    });
  }

  if (generated.length === 1) {
    return {
      contentType: "application/pdf",
      filename: generated[0].filename,
      buffer: generated[0].buffer,
    };
  }

  const zip = new AdmZip();
  generated.forEach((file) => zip.addFile(file.filename, file.buffer));
  return {
    contentType: "application/zip",
    filename: "consolidados_documentacion.zip",
    buffer: zip.toBuffer(),
  };
};

module.exports = { generateConsolidatedDocuments };
