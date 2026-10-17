const logger = require("../../config/logger");
const { registerFst08TrainingDocument } = require("./trainingWorkflow.service");
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

const normalizeSpecialistParticipant = (participant = {}) => {
  const scoreValue = Number(participant.specialist_score ?? participant.score);
  const specialistScore = Number.isFinite(scoreValue) ? Math.max(0, Math.min(100, scoreValue)) : null;
  return {
    full_name: normalizeText(participant.full_name || participant.nombre || participant.name),
    role_title: normalizeText(participant.role_title || participant.cargo || participant.role),
    email: normalizeText(participant.email),
    specialist_score: specialistScore,
    comments: normalizeText(participant.comments || participant.observations || participant.comentarios),
    corrective_action: normalizeText(participant.corrective_action || participant.accion_correctiva),
  };
};

const normalizePayloadParticipants = (payload = {}) =>
  safeArray(payload.participants)
    .map((participant) => normalizeSpecialistParticipant(participant))
    .filter((participant) => participant.full_name);

const buildFst08PdfBuffer = async ({
  sourceType,
  sourceId,
  payload,
  participants,
}) => {
  const headerLines = [
    "Formato: F.ST-08 - Evaluación del especialista",
    `Workflow: ${String(sourceType).toUpperCase()} / ${sourceId}`,
    `Cliente: ${payload.client_name || payload.ORDCliente || "N/D"}`,
    `Equipo: ${payload.equipment_name || payload.ORDEquipo || "N/D"}`,
    `Fecha de evaluación: ${formatDateLabel(payload.evaluated_at || payload.ORDFecha || new Date())}`,
    `Especialista evaluado: ${payload.specialist_name || payload.ORDResponsable || "N/D"}`,
    `Evaluador: ${payload.evaluator_name || payload.evaluator || "N/D"}`,
  ];

  const participantLines = participants.map((participant, index) => {
    const parts = [
      `${index + 1}. ${participant.full_name}`,
      participant.role_title ? `Cargo: ${participant.role_title}` : null,
      Number.isFinite(participant.specialist_score)
        ? `Puntaje especialista: ${participant.specialist_score.toFixed(2)}`
        : "Puntaje especialista: N/D",
      participant.comments ? `Comentario: ${participant.comments}` : null,
      participant.corrective_action ? `Acción correctiva: ${participant.corrective_action}` : null,
    ].filter(Boolean);
    return parts.join(" | ");
  });

  return generateNarrativePdfBuffer({
    title: "F.ST-08 - EVALUACIÓN DEL ESPECIALISTA",
    subtitle: "Documento operacional generado por SPI",
    headerLines,
    sections: [
      {
        title: "Resultados por participante",
        lines: participantLines,
      },
    ],
  });
};

const generateFst08PDFEndpoint = async (req, res) => {
  try {
    const payload = req.body || {};
    const sourceType = normalizeText(payload.source_type || payload.sourceType || "manual");
    const sourceId = normalizeText(payload.source_id || payload.sourceId || payload.request_id || payload.requestId);

    if (!sourceType || !sourceId) {
      return res.status(400).json({
        ok: false,
        message: "source_type y source_id son obligatorios para registrar F.ST-08",
      });
    }

    const participants = normalizePayloadParticipants(payload);
    if (!participants.length) {
      return res.status(400).json({
        ok: false,
        message: "Debe registrar al menos un participante para evaluación del especialista",
      });
    }

    const pdfBuffer = await buildFst08PdfBuffer({
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
    const fileName = `F.ST-08_${sanitizeFileToken(sourceId)}_${formatTimestampPart()}.pdf`;
    const uploaded = await uploadTrainingPdf({
      buffer: pdfBuffer,
      fileName,
      parentFolderId: driveFolders.clientFolderId,
    });

    const detail = await registerFst08TrainingDocument({
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
      message: "F.ST-08 registrado correctamente",
      source_type: sourceType,
      source_id: sourceId,
      driveFolderId: driveFolders.clientFolderId,
      pdfId: uploaded.id,
      workflow: detail,
    });
  } catch (error) {
    logger.error({ error }, "Error registrando F.ST-08");
    return res.status(500).json({
      ok: false,
      message: error?.message || "Error registrando F.ST-08",
    });
  }
};

module.exports = {
  generateFst08PDFEndpoint,
  normalizePayloadParticipants,
};
