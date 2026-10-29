const logger = require("../../config/logger");
const service = require("./worldCup2026.service");
const { broadcastWorldCupBoardRefresh, streamWorldCupBoard } = require("./worldCup2026.events");

function resolveParticipantToken(req) {
  return req.get(service.PARTICIPANT_HEADER) || req.query.participant_token || null;
}

async function getPublicPortal(req, res) {
  try {
    const data = await service.getPortalSnapshot(resolveParticipantToken(req));
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    logger.error({ err: error }, "Error obteniendo portal público Mundial 2026");
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No se pudo obtener la configuración del portal",
    });
  }
}

async function getPublicParticipant(req, res) {
  try {
    const token = resolveParticipantToken(req);
    if (!token) {
      return res.status(400).json({ ok: false, message: "Falta el token del participante" });
    }
    const data = await service.getParticipantProfile(token);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    logger.error({ err: error }, "Error consultando participante Mundial 2026");
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No se pudo consultar el participante",
    });
  }
}

async function getLiveBoard(_req, res) {
  try {
    const data = await service.getLiveBoard();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    logger.error({ err: error }, "Error obteniendo live board Mundial 2026");
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No se pudo obtener el tablero en vivo",
    });
  }
}

function streamLiveBoard(req, res) {
  streamWorldCupBoard(req, res, () => service.getLiveBoard());
}

async function createPublicSubmission(req, res) {
  try {
    const data = await service.createSubmission(req.body || {}, {
      sourcePath: req.originalUrl,
      ipAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || null,
      userAgent: req.get("User-Agent") || null,
    });
    broadcastWorldCupBoardRefresh({ action: "submission_created", participant_token: data.participant_token });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    logger.error({ err: error }, "Error creando predicción pública Mundial 2026");
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No se pudo registrar la predicción",
    });
  }
}

module.exports = {
  getPublicPortal,
  getPublicParticipant,
  getLiveBoard,
  streamLiveBoard,
  createPublicSubmission,
};
