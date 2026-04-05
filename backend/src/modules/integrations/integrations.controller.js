const service = require("./integrations.service");

const handleError = (res, error, fallbackMessage) => {
  const status = error?.status || 500;
  return res.status(status).json({
    ok: false,
    message: error?.message || fallbackMessage,
    code: error?.code || (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
    details: error?.details || null,
  });
};

async function getHealth(req, res) {
  try {
    const data = await service.getExternalIntegrationsHealth();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo obtener estado de integraciones");
  }
}

async function processExternalSyncQueue(req, res) {
  try {
    const data = await service.processExternalCasesSyncQueue({
      limit: req.body?.limit || req.query?.limit,
      actorUser: req.user || null,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo procesar cola de sincronización externa");
  }
}

module.exports = {
  getHealth,
  processExternalSyncQueue,
};
