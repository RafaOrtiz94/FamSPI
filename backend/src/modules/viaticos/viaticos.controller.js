const service = require("./viaticos.service");

const handleError = (res, error, fallbackMessage) => {
  const status = error?.status || 500;
  return res.status(status).json({
    ok: false,
    message: error?.message || fallbackMessage,
  });
};

async function listCandidates(req, res) {
  try {
    const data = await service.listVisitCandidates({
      actorUser: req.user,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      status: req.query.status,
      requesterEmail: req.query.requester_email,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar los candidatos de viaticos");
  }
}

async function list(req, res) {
  try {
    const data = await service.listAllowances({
      actorUser: req.user,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      status: req.query.status,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar los viaticos");
  }
}

async function upsert(req, res) {
  try {
    const data = await service.upsertAllowance({
      actorUser: req.user,
      payload: req.body || {},
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo registrar el viatico");
  }
}

async function updateStatus(req, res) {
  try {
    const allowanceId = Number(req.params.id);
    const data = await service.updateAllowanceStatus({
      allowanceId,
      status: req.body?.status,
      amount: req.body?.amount,
      approvedAmount: req.body?.approved_amount,
      paymentDate: req.body?.payment_date,
      notes: req.body?.notes,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo actualizar el viatico");
  }
}

async function listDocuments(req, res) {
  try {
    const allowanceId = Number(req.params.id);
    const data = await service.listAllowanceDocuments({
      allowanceId,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar los documentos de viatico");
  }
}

async function addDocument(req, res) {
  try {
    const allowanceId = Number(req.params.id);
    const data = await service.createAllowanceDocument({
      allowanceId,
      actorUser: req.user,
      payload: req.body || {},
    });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo registrar el documento");
  }
}

async function report(req, res) {
  try {
    const allowanceId = Number(req.params.id);
    const data = await service.buildAllowanceReport({
      allowanceId,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo generar el reporte de cotejo");
  }
}

module.exports = {
  listCandidates,
  list,
  upsert,
  updateStatus,
  listDocuments,
  addDocument,
  report,
};
