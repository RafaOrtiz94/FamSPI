const logger = require("../../config/logger");
const {
  getTrainingWorkflowDetail,
  issueTrainingCertificateRecord,
  markTrainingCertificateDelivered,
} = require("./trainingWorkflow.service");
const {
  normalizeText,
  sanitizeFileToken,
  formatDateLabel,
  formatTimestampPart,
  buildTrainingDriveFolder,
  generateNarrativePdfBuffer,
  uploadTrainingPdf,
} = require("./trainingDocumentUtils.service");

const buildTrainingCertificatePdfBuffer = async ({
  sourceType,
  sourceId,
  workflowDetail,
  certificateNumber,
  payload = {},
}) => {
  const event = workflowDetail?.event || {};
  const participantName = normalizeText(payload.participant_name);
  const titleLine = participantName
    ? `Participante: ${participantName}`
    : "Participante: Certificación grupal";

  return generateNarrativePdfBuffer({
    title: "CERTIFICADO DE ENTRENAMIENTO TÉCNICO",
    subtitle: "Emisión operacional ST-01-01",
    headerLines: [
      `Certificado: ${certificateNumber || "N/D"}`,
      `Workflow: ${String(sourceType).toUpperCase()} / ${sourceId}`,
      `Cliente: ${event.client_name || payload.client_name || "N/D"}`,
      `Equipo: ${event.equipment_name || payload.equipment_name || "N/D"}`,
      titleLine,
      `Fecha de emisión: ${formatDateLabel(new Date())}`,
      `Vigencia operacional para entrega: 30 días calendario`,
    ],
    sections: [
      {
        title: "Alcance",
        lines: [
          "Se certifica la finalización del entrenamiento técnico y de aplicaciones conforme al procedimiento ST-01-01.",
          "La entrega del certificado debe registrarse en el workflow antes del vencimiento operacional.",
        ],
      },
      {
        title: "Control",
        lines: [
          `Estado de entrenamiento: ${workflowDetail?.event?.status || "N/D"}`,
          `Etapa actual: ${workflowDetail?.event?.stage || "N/D"}`,
        ],
      },
    ],
  });
};

const issueTrainingCertificateEndpoint = async (req, res) => {
  try {
    const payload = req.body || {};
    const sourceType = normalizeText(payload.source_type || payload.sourceType || "manual");
    const sourceId = normalizeText(payload.source_id || payload.sourceId || payload.request_id || payload.requestId);
    const certificateNumber = normalizeText(payload.certificate_number || payload.certificateNumber);

    if (!sourceType || !sourceId) {
      return res.status(400).json({
        ok: false,
        message: "source_type y source_id son obligatorios para emitir certificado",
      });
    }

    const workflowDetail = await getTrainingWorkflowDetail({
      source_type: sourceType,
      source_id: sourceId,
    });
    if (!workflowDetail?.event) {
      return res.status(404).json({
        ok: false,
        message: "No existe workflow de entrenamiento para emitir certificado",
      });
    }

    const pdfBuffer = await buildTrainingCertificatePdfBuffer({
      sourceType,
      sourceId,
      workflowDetail,
      certificateNumber,
      payload,
    });

    const driveFolders = await buildTrainingDriveFolder({
      sourceType,
      sourceId,
      clientName: workflowDetail.event.client_name || payload.client_name || null,
    });
    const fileName = `CERT-ST_${sanitizeFileToken(sourceId)}_${formatTimestampPart()}.pdf`;
    const uploaded = await uploadTrainingPdf({
      buffer: pdfBuffer,
      fileName,
      parentFolderId: driveFolders.clientFolderId,
    });

    const result = await issueTrainingCertificateRecord({
      source_type: sourceType,
      source_id: sourceId,
      file_id: uploaded.id,
      link: uploaded.webViewLink || null,
      certificate_number: certificateNumber,
      participant_id: payload.participant_id || payload.participantId || null,
      metadata: {
        generated_by: "trainingCertificates.service",
        certificate_type: payload.certificate_type || "training",
      },
      user: req.user,
    });

    return res.json({
      ok: true,
      message: "Certificado emitido correctamente",
      source_type: sourceType,
      source_id: sourceId,
      driveFolderId: driveFolders.clientFolderId,
      pdfId: uploaded.id,
      certificate: result?.certificate || null,
      workflow: result?.workflow || null,
    });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error emitiendo certificado de entrenamiento");
    return res.status(status).json({
      ok: false,
      message: error?.message || "Error emitiendo certificado",
      code: error?.code || "TRAINING_CERTIFICATE_ISSUE_ERROR",
    });
  }
};

const deliverTrainingCertificateEndpoint = async (req, res) => {
  try {
    const payload = req.body || {};
    const sourceType = normalizeText(payload.source_type || payload.sourceType || "manual");
    const sourceId = normalizeText(payload.source_id || payload.sourceId || payload.request_id || payload.requestId);

    if (!sourceType || !sourceId) {
      return res.status(400).json({
        ok: false,
        message: "source_type y source_id son obligatorios para registrar entrega de certificado",
      });
    }

    const result = await markTrainingCertificateDelivered({
      source_type: sourceType,
      source_id: sourceId,
      certificate_id: payload.certificate_id || payload.certificateId || null,
      delivered_at: payload.delivered_at || payload.deliveredAt || null,
      delivery_evidence: payload.delivery_evidence || payload.deliveryEvidence || null,
      user: req.user,
    });

    return res.json({
      ok: true,
      message: "Entrega de certificado registrada correctamente",
      source_type: sourceType,
      source_id: sourceId,
      certificate: result?.certificate || null,
      workflow: result?.workflow || null,
    });
  } catch (error) {
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    logger.error({ error }, "Error registrando entrega de certificado");
    return res.status(status).json({
      ok: false,
      message: error?.message || "Error registrando entrega de certificado",
      code: error?.code || "TRAINING_CERTIFICATE_DELIVERY_ERROR",
    });
  }
};

module.exports = {
  issueTrainingCertificateEndpoint,
  deliverTrainingCertificateEndpoint,
};
