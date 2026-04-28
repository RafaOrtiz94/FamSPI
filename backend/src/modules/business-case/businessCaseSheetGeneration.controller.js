const logger = require("../../config/logger");
const sheetGenerationService = require("./businessCaseSheetGeneration.service");
const { generateBusinessCaseExcel } = require("./excelExporter.service");
const db = require("../../config/db");

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

    // Fail-safe: process one queue batch immediately after enqueue.
    // This avoids jobs getting stuck when scheduler env is misconfigured in Cloud Run.
    try {
      await sheetGenerationService.processPendingJobsBatch({ limit: 1 });
    } catch (inlineError) {
      logger.warn(
        {
          error: inlineError?.message || String(inlineError),
          business_case_id: id,
        },
        "[BC_SHEET] Inline queue processing after enqueue failed",
      );
    }

    return res.status(202).json(result.responseBody);
  } catch (error) {
    return sendError(res, error, "No se pudo encolar la generacion de la hoja del Business Case");
  }
}

async function getSheetGenerationPreview(req, res) {
  try {
    const { id } = req.params;
    const response = await sheetGenerationService.getGenerationPreview({
      businessCaseId: id,
      input: req.query || {},
    });
    return res.json(response);
  } catch (error) {
    return sendError(res, error, "No se pudo generar la vista previa de sincronizacion");
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

/**
 * Fallback: download local Excel when Google Sheets generation fails (REQ-BC-13).
 * Returns xlsx binary directly — no queue, no Sheets API dependency.
 */
async function downloadFallbackExcel(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT * FROM v_business_cases_complete WHERE business_case_id = $1`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ ok: false, message: 'Business Case no encontrado' });
    }
    const buffer = await generateBusinessCaseExcel(rows[0]);
    const filename = `BC_${id}_fallback_${Date.now()}.xlsx`;
    sheetGenerationService.recordDocumentVersion({
      businessCaseId: id,
      documentType: 'excel_fallback',
      documentUrl: null,
      sheetId: null,
      fileName: filename,
      canonicalState: rows[0].canonical_state || null,
      generatedBy: req.user?.id || null,
      metadata: { source: 'fallback_download' },
    }).catch(() => null);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Fallback-Excel', 'true');
    return res.send(buffer);
  } catch (error) {
    return sendError(res, error, 'No se pudo generar el Excel local de fallback');
  }
}

async function getDocumentVersionHistory(req, res) {
  try {
    const { id } = req.params;
    const limit = Number(req.query.limit) || 20;
    const response = await sheetGenerationService.getDocumentVersions({ businessCaseId: id, limit });
    return res.json(response);
  } catch (error) {
    return sendError(res, error, 'No se pudo obtener el historial de versiones del documento');
  }
}

module.exports = {
  enqueueSheetGeneration,
  getSheetGenerationPreview,
  getSheetGenerationJobStatus,
  getLatestSheetGenerationJobStatus,
  getSheetGenerationMetrics,
  downloadFallbackExcel,
  getDocumentVersionHistory,
};
