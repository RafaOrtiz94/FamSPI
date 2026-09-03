const service = require("./opportunities.service");

const sendError = (res, error, fallback = "Error interno del servidor", status = 500) =>
  res.status(status).json({
    ok: false,
    message: error?.message || fallback,
  });

const resolveBadRequestStatus = (error) => {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("no encontrada") || message.includes("no encontrado")) return 404;
  if (message.includes("obligatorio") || message.includes("soportado")) return 400;
  return 500;
};

const listAccounts = async (req, res) => {
  try {
    const data = await service.listAccounts(req.query);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error);
  }
};

const createAccount = async (req, res) => {
  try {
    const data = await service.createAccount(req.body, req.user?.id || null);
    res.status(201).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const listContacts = async (req, res) => {
  try {
    const data = await service.listContacts(req.query);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error);
  }
};

const createContact = async (req, res) => {
  try {
    const data = await service.createContact(req.body, req.user?.id || null);
    res.status(201).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const listOpportunities = async (req, res) => {
  try {
    const data = await service.listOpportunities({ ...req.query, actorUser: req.user });
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error);
  }
};

const getOpportunity = async (req, res) => {
  try {
    const data = await service.getOpportunityDetail(req.params.id);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const createOpportunity = async (req, res) => {
  try {
    const data = await service.createOpportunity(req.body, req.user);
    res.status(201).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const updateOpportunity = async (req, res) => {
  try {
    const data = await service.updateOpportunity(req.params.id, req.body, req.user);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const upsertInfluence = async (req, res) => {
  try {
    const data = await service.upsertInfluence(req.params.id, req.body, req.user);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const deleteInfluence = async (req, res) => {
  try {
    const data = await service.deleteInfluence(req.params.id, req.params.influenceId, req.user);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const upsertFlag = async (req, res) => {
  try {
    const data = await service.upsertFlag(req.params.id, req.body, req.user);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const deleteFlag = async (req, res) => {
  try {
    const data = await service.deleteFlag(req.params.id, req.params.flagId, req.user);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const upsertCompetitor = async (req, res) => {
  try {
    const data = await service.upsertCompetitor(req.params.id, req.body, req.user);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const deleteCompetitor = async (req, res) => {
  try {
    const data = await service.deleteCompetitor(req.params.id, req.params.competitorId, req.user);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const upsertAction = async (req, res) => {
  try {
    const data = await service.upsertAction(req.params.id, req.body, req.user);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const deleteAction = async (req, res) => {
  try {
    const data = await service.deleteAction(req.params.id, req.params.actionId, req.user);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const createComment = async (req, res) => {
  try {
    const data = await service.createComment(req.params.id, req.body, req.user);
    res.status(201).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const deleteComment = async (req, res) => {
  try {
    const data = await service.deleteComment(req.params.id, req.params.commentId);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const lookupProcess = async (req, res) => {
  try {
    const data = await service.lookupProcessByTypeAndId(req.params.type, req.params.processId);
    if (!data) {
      return res.status(404).json({ ok: false, message: "Expediente no encontrado" });
    }
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const linkProcess = async (req, res) => {
  try {
    const data = await service.linkProcess(req.params.id, req.body, req.user);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const unlinkProcess = async (req, res) => {
  try {
    const data = await service.unlinkProcess(req.params.id, req.params.linkId, req.user);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error, error?.message, resolveBadRequestStatus(error));
  }
};

const getManagerDashboard = async (req, res) => {
  try {
    const data = await service.getManagerDashboard(req.user);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  listAccounts,
  createAccount,
  listContacts,
  createContact,
  listOpportunities,
  getOpportunity,
  createOpportunity,
  updateOpportunity,
  upsertInfluence,
  deleteInfluence,
  upsertFlag,
  deleteFlag,
  upsertCompetitor,
  deleteCompetitor,
  upsertAction,
  deleteAction,
  createComment,
  deleteComment,
  lookupProcess,
  linkProcess,
  unlinkProcess,
  getManagerDashboard,
};
