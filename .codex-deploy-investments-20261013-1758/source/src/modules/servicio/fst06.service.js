const logger = require("../../config/logger");
const { registerFst06TrainingDocument } = require("./trainingWorkflow.service");
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

const normalizeParticipant = (participant = {}) => {
  const scoreValue = Number(participant.evaluation_score ?? participant.score);
  const score = Number.isFinite(scoreValue) ? Math.max(0, Math.min(100, scoreValue)) : null;
  return {
    full_name: normalizeText(participant.full_name || participant.nombre || participant.name),
    role_title: normalizeText(participant.role_title || participant.cargo || participant.role),
    email: normalizeText(participant.email),
    evaluation_score: score,
    remarks: normalizeText(participant.remarks || participant.observations || participant.comentarios),
    criteria: safeArray(participant.criteria).map((item) => normalizeText(item)).filter(Boolean),
  };
};

const normalizePayloadParticipants = (payload = {}) =>
  safeArray(payload.participants)
    .map((participant) => normalizeParticipant(participant))
    .filter((participant) => participant.full_name);

const buildFst06PdfBuffer = async ({
  sourceType,
  sourceId,
  payload,
  participants,
}) => {
  const headerLines = [
    `Formato: F.ST-06 - Evaluación de participantes`,
    `Workflow: ${String(sourceType).toUpperCase()} / ${sourceId}`,
    `Cliente: ${payload.client_name || payload.ORDCliente || "N/D"}`,
    `Equipo: ${payload.equipment_name || payload.ORDEquipo || "N/D"}`,
    `Fecha de evaluación: ${formatDateLabel(payload.evaluated_at || payload.ORDFecha || new Date())}`,
    `Especialista: ${payload.specialist_name || payload.ORDResponsable || "N/D"}`,
  ];

  const participantLines = participants.map((participant, index) => {
    const parts = [
      `${index + 1}. ${participant.full_name}`,
      participant.role_title ? `Cargo: ${participant.role_title}` : null,
      Number.isFinite(participant.evaluation_score)
        ? `Puntaje: ${participant.evaluation_score.toFixed(2)}`
        : "Puntaje: N/D",
      participant.remarks ? `Observación: ${participant.remarks}` : null,
    ].filter(Boolean);
    return parts.join(" | ");
  });

  return generateNarrativePdfBuffer({
    title: "F.ST-06 - EVALUACIÓN DE PARTICIPANTES",
    subtitle: "Documento operacional generado por SPI",
    headerLines,
    sections: [
      {
        title: "Resumen de participantes",
        lines: participantLines,
      },
      {
        title: "Criterios reportados",
        lines: participants.flatMap((participant) =>
          participant.criteria.map((item) => `${participant.full_name}: ${item}`),
        ),
      },
    ],
  });
};

const generateFst06PDFEndpoint = async (req, res) => {
  try {
    const payload = req.body || {};
    const sourceType = normalizeText(payload.source_type || payload.sourceType || "manual");
    const sourceId = normalizeText(payload.source_id || payload.sourceId || payload.request_id || payload.requestId);

    if (!sourceType || !sourceId) {
      return res.status(400).json({
        ok: false,
        message: "source_type y source_id son obligatorios para registrar F.ST-06",
      });
    }

    const participants = normalizePayloadParticipants(payload);
    if (!participants.length) {
      return res.status(400).json({
        ok: false,
        message: "Debe registrar al menos un participante evaluado",
      });
    }

    const pdfBuffer = await buildFst06PdfBuffer({
      sourceType,
      sourceId,
      payload,
      participants,
    });

    const driveFolders = await buildTrainingDriveFolder({
      sourceType,
      sourceId,
      clientName: payload.client_name || payload.ORDCliente || null,
    });
    const fileName = `F.ST-06_${sanitizeFileToken(sourceId)}_${formatTimestampPart()}.pdf`;
    const uploaded = await uploadTrainingPdf({
      buffer: pdfBuffer,
      fileName,
      parentFolderId: driveFolders.clientFolderId,
    });

    const detail = await registerFst06TrainingDocument({
      payload: {
        ...payload,
        source_type: sourceType,
        source_id: sourceId,
        participants,
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
      message: "F.ST-06 registrado correctamente",
      source_type: sourceType,
      source_id: sourceId,
      driveFolderId: driveFolders.clientFolderId,
      pdfId: uploaded.id,
      workflow: detail,
    });
  } catch (error) {
    logger.error({ error }, "Error registrando F.ST-06");
    return res.status(500).json({
      ok: false,
      message: error?.message || "Error registrando F.ST-06",
    });
  }
};

module.exports = {
  generateFst06PDFEndpoint,
  normalizePayloadParticipants,
};
