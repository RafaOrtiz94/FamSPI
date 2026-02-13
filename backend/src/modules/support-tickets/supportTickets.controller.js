const service = require("./supportTickets.service");

const handleError = (res, error, fallbackMessage) => {
  const status = error?.status || 500;
  return res.status(status).json({
    ok: false,
    message: error?.message || fallbackMessage,
  });
};

async function create(req, res) {
  try {
    const ticket = await service.createTicket({
      requester: req.user,
      payload: req.body || {},
    });
    return res.status(201).json({ ok: true, data: ticket });
  } catch (error) {
    return handleError(res, error, "No se pudo crear el ticket");
  }
}

async function listMy(req, res) {
  try {
    const tickets = await service.listMyTickets(req.user.id);
    return res.status(200).json({ ok: true, data: tickets });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar tus tickets");
  }
}

async function listWorkspace(req, res) {
  try {
    const tickets = await service.listWorkspaceTickets({
      status: req.query.status,
      ticket_type: req.query.ticket_type,
      q: req.query.q,
    });
    return res.status(200).json({ ok: true, data: tickets });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar los tickets del workspace");
  }
}

async function kpiWorkspace(req, res) {
  try {
    const data = await service.getWorkspaceKpis({
      status: req.query.status,
      ticket_type: req.query.ticket_type,
      q: req.query.q,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudieron calcular los KPI de tickets");
  }
}

async function listEvents(req, res) {
  try {
    const events = await service.listTicketEvents(Number(req.params.id), req.user);
    return res.status(200).json({ ok: true, data: events });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar los eventos");
  }
}

async function listComments(req, res) {
  try {
    const comments = await service.listTicketComments(Number(req.params.id), req.user);
    return res.status(200).json({ ok: true, data: comments });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar los comentarios");
  }
}

async function addComment(req, res) {
  try {
    const comment = await service.addTicketComment({
      ticketId: Number(req.params.id),
      actorUser: req.user,
      message: req.body?.message,
      visibility: req.body?.visibility,
    });
    return res.status(201).json({ ok: true, data: comment });
  } catch (error) {
    return handleError(res, error, "No se pudo registrar el comentario");
  }
}

async function assignSelf(req, res) {
  try {
    const ticket = await service.assignTicketToSelf({
      ticketId: Number(req.params.id),
      tiUser: req.user,
    });
    return res.status(200).json({ ok: true, data: ticket });
  } catch (error) {
    return handleError(res, error, "No se pudo asignar el ticket");
  }
}

async function updateStatus(req, res) {
  try {
    const ticket = await service.updateTicketStatus({
      ticketId: Number(req.params.id),
      status: req.body?.status,
      comment: req.body?.comment,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data: ticket });
  } catch (error) {
    return handleError(res, error, "No se pudo actualizar el estado del ticket");
  }
}

async function closeByRequester(req, res) {
  try {
    const ticket = await service.closeTicketByRequester({
      ticketId: Number(req.params.id),
      requesterUser: req.user,
      comment: req.body?.comment,
    });
    return res.status(200).json({ ok: true, data: ticket });
  } catch (error) {
    return handleError(res, error, "No se pudo cerrar el ticket");
  }
}

async function reopen(req, res) {
  try {
    const ticket = await service.reopenTicket({
      ticketId: Number(req.params.id),
      actorUser: req.user,
      reason: req.body?.reason,
    });
    return res.status(200).json({ ok: true, data: ticket });
  } catch (error) {
    return handleError(res, error, "No se pudo reabrir el ticket");
  }
}

async function rateSatisfaction(req, res) {
  try {
    const ticket = await service.rateTicketSatisfaction({
      ticketId: Number(req.params.id),
      requesterUser: req.user,
      score: req.body?.score,
      comment: req.body?.comment,
    });
    return res.status(200).json({ ok: true, data: ticket });
  } catch (error) {
    return handleError(res, error, "No se pudo registrar la calificacion");
  }
}

module.exports = {
  create,
  listMy,
  listWorkspace,
  kpiWorkspace,
  listEvents,
  listComments,
  addComment,
  assignSelf,
  updateStatus,
  closeByRequester,
  reopen,
  rateSatisfaction,
};
