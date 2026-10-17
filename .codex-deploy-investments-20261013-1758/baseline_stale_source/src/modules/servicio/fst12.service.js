const logger = require("../../config/logger");
const { registerFst12TrainingDocument } = require("./trainingWorkflow.service");
const {
  normalizeText,
  safeArray,
  sanitizeFileToken,
  formatDateLabel,
  formatTimestampPart,
  buildTrainingDriveFolder,
  generateNarrativePdfBuffer,
  uploadTrainingPdf,
} = require("./trainingDocumentUtils.service");

const normalizeActionList = (value) =>
  safeArray(value)
    .map((item) => normalizeText(item))
    .filter(Boolean);

const buildFst12PdfBuffer = async ({
  sourceType,
  sourceId,
  payload,
}) => {
  const isConformant =
    payload.is_conformant === true ||
    payload.is_conformant === 1 ||
    String(payload.is_conformant || "").trim().toLowerCase() === "true";

  const headerLines = [
    "Formato: F.ST-12 - Conformidad final de entrenamiento",
    `Workflow: ${String(sourceType).toUpperCase()} / ${sourceId}`,
    `Cliente: ${payload.client_name || payload.ORDCliente || "N/D"}`,
    `Equipo: ${payload.equipment_name || payload.ORDEquipo || "N/D"}`,
    `Fecha de firma: ${formatDateLabel(payload.signed_at || payload.ORDFecha || new Date())}`,
    `Firmante cliente: ${payload.client_signer_name || "N/D"}`,
    `Cargo firmante: ${payload.signer_role || "N/D"}`,
    `Resultado: ${isConformant ? "CONFORME" : "NO CONFORME"}`,
  ];

  const actions = normalizeActionList(payload.pending_actions || payload.corrective_actions);
  return generateNarrativePdfBuffer({
    title: "F.ST-12 - CONFORMIDAD FINAL",
    subtitle: "Documento operacional generado por SPI",
    headerLines,
    sections: [
      {
        title: "Observaciones de conformidad",
        lines: [payload.notes || payload.observaciones || "Sin observaciones"],
      },
      {
        title: "Acciones pendientes / correctivas",
        lines: actions,
      },
    ],
  });
};

const generateFst12PDFEndpoint = async (req, res) => {
  try {
    const payload = req.body || {};
    const sourceType = normalizeText(payload.source_type || payload.sourceType || "manual");
    const sourceId = normalizeText(payload.source_id || payload.sourceId || payload.request_id || payload.requestId);

    if (!sourceType || !sourceId) {
      return res.status(400).json({
        ok: false,
        message: "source_type y source_id son obligatorios para registrar F.ST-12",
      });
    }

    if (!normalizeText(payload.client_signer_name)) {
      return res.status(400).json({
        ok: false,
        message: "client_signer_name es obligatorio para registrar F.ST-12",
      });
    }

    const pdfBuffer = await buildFst12PdfBuffer({
      sourceType,
      sourceId,
      payload,
    });

    const driveFolders = await buildTrainingDriveFolder({
      sourceType,
      sourceId,
      clientName: payload.client_name || payload.ORDCliente || null,
    });
    const fileName = `F.ST-12_${sanitizeFileToken(sourceId)}_${formatTimestampPart()}.pdf`;
    const uploaded = await uploadTrainingPdf({
      buffer: pdfBuffer,
      fileName,
      parentFolderId: driveFolders.clientFolderId,
    });

    const detail = await registerFst12TrainingDocument({
      payload: {
        ...payload,
        source_type: sourceType,
        source_id: sourceId,
      },
      document: {
        file_id: uploaded.id,
        folder_id: driveFolders.clientFolderId,
        link: uploaded.webViewLink || null,
      },
      user: req.user,
    });

    return res.json({
      ok: true,
      message: "F.ST-12 registrado correctamente",
      source_type: sourceType,
      source_id: sourceId,
      driveFolderId: driveFolders.clientFolderId,
      pdfId: uploaded.id,
      workflow: detail,
    });
  } catch (error) {
    logger.error({ error }, "Error registrando F.ST-12");
    return res.status(500).json({
      ok: false,
      message: error?.message || "Error registrando F.ST-12",
    });
  }
};

module.exports = {
  generateFst12PDFEndpoint,
};
