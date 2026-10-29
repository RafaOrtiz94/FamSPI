const externalCasesService = require("./externalCases.service");
const externalCaseSyncService = require("./externalCaseSync.service");

const handleError = (res, error, fallbackMessage) => {
  const status = error?.status || 500;
  return res.status(status).json({
    ok: false,
    message: error?.message || fallbackMessage,
    code: error?.code || (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
    details: error?.details || null,
    retryable: typeof error?.retryable === "boolean" ? error.retryable : status >= 500,
  });
};

async function listWorkspace(req, res) {
  try {
    const rows = await externalCasesService.listExternalCasesWorkspace({
      provider: req.query.provider,
      status: req.query.status,
      sync_status: req.query.sync_status,
      only_drift: req.query.only_drift,
      q: req.query.q,
      limit: req.query.limit,
    });
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar los casos externos");
  }
}

async function kpiWorkspace(req, res) {
  try {
    const data = await externalCasesService.getExternalCasesWorkspaceKpi({
      provider: req.query.provider,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudieron calcular los KPI de casos externos");
  }
}

async function getProviderHealth(req, res) {
  try {
    const data = await externalCasesService.listProviderHealth();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo obtener la salud de integraciones");
  }
}

async function listProviderIdentities(req, res) {
  try {
    const data = await externalCasesService.listProviderIdentities({
      provider: req.query.provider,
      status: req.query.status,
      q: req.query.q,
      limit: req.query.limit,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar identidades externas");
  }
}

async function upsertProviderIdentity(req, res) {
  try {
    const data = await externalCasesService.upsertProviderIdentity({
      payload: req.body || {},
      actorUser: req.user || null,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo guardar identidad externa");
  }
}

async function getDetail(req, res) {
  try {
    const data = await externalCasesService.getExternalCaseDetail(req.params.id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo obtener el detalle del caso externo");
  }
}

async function listEvents(req, res) {
  try {
    const data = await externalCasesService.listExternalCaseEvents(req.params.id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar eventos del caso externo");
  }
}

async function createCase(req, res) {
  try {
    const data = await externalCasesService.createExternalCase({
      payload: req.body || {},
      actorUser: req.user,
      sourceChannel: "internal",
      provider: req.body?.provider,
      strictValidation: true,
    });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo crear el caso externo");
  }
}

async function createInboundCase(req, res) {
  try {
    const data = await externalCasesService.createInboundExternalCase({
      provider: req.params.provider,
      payload: req.body || {},
      actorUser: req.user || null,
    });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo registrar el caso inbound");
  }
}

async function retrySync(req, res) {
  try {
    const data = await externalCasesService.retryExternalCaseSync({
      caseId: req.params.id,
      actorUser: req.user,
      reason: req.body?.reason,
      runImmediately: req.body?.run_immediately !== false,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo reintentar sincronización");
  }
}

async function reconcileState(req, res) {
  try {
    const data = await externalCasesService.reconcileExternalCaseState({
      caseId: req.params.id,
      actorUser: req.user,
      comment: req.body?.comment || null,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo reconciliar estado del caso");
  }
}

async function processQueue(req, res) {
  try {
    const summary = await externalCaseSyncService.runOnce({
      limit: req.body?.limit || req.query?.limit,
      actorUser: req.user || null,
      workerId: "external-case-manual-queue",
    });
    return res.status(200).json({ ok: true, data: summary });
  } catch (error) {
    return handleError(res, error, "No se pudo procesar la cola de sincronización");
  }
}

async function postCeacDecision(req, res) {
  try {
    const data = await externalCasesService.applyCeacDecision({
      caseId: req.params.id,
      decision: req.body?.decision,
      notes: req.body?.notes || null,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo registrar la decisión CEAC");
  }
}

async function postGoAppMilestone(req, res) {
  try {
    const data = await externalCasesService.recordGoAppMilestone({
      caseId: req.params.id,
      milestone: req.params.milestone,
      payload: req.body || {},
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo registrar el hito GoApp");
  }
}

module.exports = {
  listWorkspace,
  kpiWorkspace,
  getProviderHealth,
  listProviderIdentities,
  upsertProviderIdentity,
  getDetail,
  listEvents,
  createCase,
  createInboundCase,
  retrySync,
  reconcileState,
  processQueue,
  postCeacDecision,
  postGoAppMilestone,
};
