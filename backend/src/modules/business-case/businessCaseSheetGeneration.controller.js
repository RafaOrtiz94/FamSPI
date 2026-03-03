const logger = require("../../config/logger");
const sheetGenerationService = require("./businessCaseSheetGeneration.service");

function resolveIdempotencyKey(req) {
  const headerKey = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
  if (headerKey) return String(headerKey).trim();
  const bodyKey = req.body?.idempotency_key || req.body?.idempotencyKey;
  if (bodyKey) return String(bodyKey).trim();
  return null;
}

function resolveCorrelationId(req, res) {
  const header = res.getHeader("x-correlation-id") || req.headers["x-correlation-id"];
  return header ? String(header) : null;
}

function sendError(res, error, fallbackMessage) {
  logger.error(
    {
      error: error?.message || String(error),
      code: error?.code || null,
      status: error?.status || null,
    },
    fallbackMessage,
  );

  return res.status(error?.status || 500).json({
    ok: false,
    message: error?.message || fallbackMessage,
    code: error?.code || (error?.status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
    retryable: typeof error?.retryable === "boolean" ? error.retryable : (error?.status || 500) >= 500,
    details: error?.details || null,
  });
}

async function enqueueSheetGeneration(req, res) {
  try {
    const { id } = req.params;
    const result = await sheetGenerationService.enqueueGenerationJob({
      businessCaseId: id,
      input: req.body || {},
      user: req.user || null,
      idempotencyKey: resolveIdempotencyKey(req),
      correlationId: resolveCorrelationId(req, res),
    });

    if (result?.replay) {
      return res.status(result.replayStatus || 202).json(result.replayPayload || { ok: true });
    }

    return res.status(202).json(result.responseBody);
  } catch (error) {
    return sendError(res, error, "No se pudo encolar la generacion de la hoja del Business Case");
  }
}

async function getSheetGenerationJobStatus(req, res) {
  try {
    const { id, jobId } = req.params;
    const parsedJobId = Number(jobId);
    if (!Number.isFinite(parsedJobId) || parsedJobId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "jobId invalido",
        code: "REQUEST_ERROR",
        retryable: false,
      });
    }

    const response = await sheetGenerationService.getJobStatus({
      businessCaseId: id,
      jobId: parsedJobId,
    });
    return res.json(response);
  } catch (error) {
    return sendError(res, error, "No se pudo consultar el estado del job de generacion");
  }
}

async function getLatestSheetGenerationJobStatus(req, res) {
  try {
    const { id } = req.params;
    const response = await sheetGenerationService.getLatestJobStatus({
      businessCaseId: id,
    });
    return res.json(response);
  } catch (error) {
    return sendError(res, error, "No se pudo consultar el ultimo job de generacion");
  }
}

async function getSheetGenerationMetrics(_req, res) {
  try {
    const response = await sheetGenerationService.getQueueMetrics();
    return res.json(response);
  } catch (error) {
    return sendError(res, error, "No se pudieron obtener metricas de la cola de generacion");
  }
}

module.exports = {
  enqueueSheetGeneration,
  getSheetGenerationJobStatus,
  getLatestSheetGenerationJobStatus,
  getSheetGenerationMetrics,
};
