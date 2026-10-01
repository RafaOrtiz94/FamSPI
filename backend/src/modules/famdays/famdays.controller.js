const svc = require('./famdays.service');
const logger = require('../../config/logger');

const ok = (res, data, status = 200) => res.status(status).json({ ok: true, data });
const fail = (res, err) => {
  const status = err.status || 500;
  if (status >= 500) logger.error(`[famdays] ${err.message}`, { stack: err.stack });
  res.status(status).json({ ok: false, message: err.message });
};
const ADMIN_ROLES = new Set(['jefe_ti']);
const isAdmin = (req) => ADMIN_ROLES.has(String(req.user?.role || '').toLowerCase());

const getMyAccess = async (req, res) => {
  try { ok(res, await svc.getAccessForUser(req.user)); } catch (err) { fail(res, err); }
};

const listConfigurators = async (req, res) => {
  try {
    await svc.assertCanAdmin(req.user);
    ok(res, await svc.listConfigurators());
  } catch (err) { fail(res, err); }
};

const setConfigurators = async (req, res) => {
  try {
    await svc.assertCanAdmin(req.user);
    ok(res, await svc.replaceConfigurators(req.body.user_ids || [], req.user.id));
  } catch (err) { fail(res, err); }
};

const listEvents = async (_req, res) => {
  try { ok(res, await svc.listEvents()); } catch (err) { fail(res, err); }
};

const getCurrentEvent = async (_req, res) => {
  try { ok(res, await svc.getCurrentEvent()); } catch (err) { fail(res, err); }
};

const getAdminCurrentEvent = async (_req, res) => {
  try { ok(res, await svc.getAdminCurrentEvent()); } catch (err) { fail(res, err); }
};

const getEvent = async (req, res) => {
  try {
    const event = await svc.getEventById(req.params.eventId);
    if (!event) return res.status(404).json({ ok: false, message: 'Evento FamDays no encontrado' });
    ok(res, event);
  } catch (err) { fail(res, err); }
};

const createEvent = async (req, res) => {
  try {
    await svc.assertCanConfigure(req.user);
    ok(res, await svc.createEvent(req.body, req.user.id), 201);
  } catch (err) { fail(res, err); }
};

const updateEvent = async (req, res) => {
  try {
    await svc.assertCanConfigure(req.user);
    ok(res, await svc.updateEvent(req.params.eventId, req.body, req.user.id));
  } catch (err) { fail(res, err); }
};

const deleteEvent = async (req, res) => {
  try {
    await svc.assertCanConfigure(req.user);
    await svc.deleteEvent(req.params.eventId);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err); }
};

const getPresentations = async (req, res) => {
  try { ok(res, await svc.getPresentationsByEvent(req.params.eventId, req.user?.id)); } catch (err) { fail(res, err); }
};

const getPresentation = async (req, res) => {
  try {
    const presentation = await svc.getPresentationById(req.params.presentationId);
    if (!presentation) return res.status(404).json({ ok: false, message: 'Presentacion no encontrada' });
    const blocks = await svc.getBlocksByPresentation(presentation.id);
    ok(res, { ...presentation, blocks, active_block: blocks.find((b) => b.is_active) || null });
  } catch (err) { fail(res, err); }
};

const createPresentation = async (req, res) => {
  try {
    await svc.assertCanConfigure(req.user);
    ok(res, await svc.createPresentation(req.params.eventId, req.body, req.user.id), 201);
  } catch (err) { fail(res, err); }
};

const updatePresentation = async (req, res) => {
  try {
    await svc.assertCanConfigure(req.user);
    ok(res, await svc.updatePresentation(req.params.presentationId, req.body, req.user.id));
  } catch (err) { fail(res, err); }
};

const deletePresentation = async (req, res) => {
  try {
    await svc.assertCanConfigure(req.user);
    await svc.deletePresentation(req.params.presentationId);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err); }
};

const startPresentation = async (req, res) => {
  try {
    await svc.assertCanConfigure(req.user);
    ok(res, await svc.startPresentation(req.params.presentationId, req.user.id));
  } catch (err) { fail(res, err); }
};

const finishPresentation = async (req, res) => {
  try {
    await svc.assertCanConfigure(req.user);
    ok(res, await svc.finishPresentation(req.params.presentationId, req.user.id));
  } catch (err) { fail(res, err); }
};

const getQuestions = async (req, res) => {
  try {
    const access = await svc.getAccessForUser(req.user);
    ok(res, await svc.getQuestions(req.params.presentationId, {
      status: req.query.status,
      forModerator: access.is_configurator || isAdmin(req),
      userId: req.user?.id,
    }));
  } catch (err) { fail(res, err); }
};

const getEventQuestions = async (req, res) => {
  try {
    ok(res, await svc.getQuestionsByEvent(req.params.eventId, {
      status: req.query.status,
    }));
  } catch (err) { fail(res, err); }
};

const createQuestion = async (req, res) => {
  try { ok(res, await svc.createQuestion(req.params.presentationId, req.body, req.user.id), 201); } catch (err) { fail(res, err); }
};

const createEventQuestion = async (req, res) => {
  try { ok(res, await svc.createEventQuestion(req.params.eventId, req.body, req.user.id), 201); } catch (err) { fail(res, err); }
};

const moderateQuestion = async (req, res) => {
  try {
    await svc.assertCanConfigure(req.user);
    ok(res, await svc.moderateQuestion(req.params.questionId, req.body, req.user.id));
  } catch (err) { fail(res, err); }
};

const highlightQuestion = async (req, res) => {
  req.body = { ...req.body, status: 'highlighted' };
  return moderateQuestion(req, res);
};

const answerQuestion = async (req, res) => {
  req.body = { ...req.body, status: 'answered' };
  return moderateQuestion(req, res);
};

const hideQuestion = async (req, res) => {
  req.body = { ...req.body, status: 'hidden' };
  return moderateQuestion(req, res);
};

const rateAporte = async (req, res) => {
  try {
    const rating = Number.parseInt(req.body.rating, 10);
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ ok: false, message: 'La calificacion debe ser entre 1 y 5' });
    }
    ok(res, await svc.rateAporte(req.params.questionId, req.user.id, rating));
  } catch (err) { fail(res, err); }
};

const getAporteRankings = async (req, res) => {
  try { ok(res, await svc.getAporteRankings(req.params.eventId)); } catch (err) { fail(res, err); }
};

const getEventSummary = async (req, res) => {
  try {
    await svc.assertCanViewReport(req.user);
    ok(res, await svc.getEventSummary(req.params.eventId));
  } catch (err) { fail(res, err); }
};

const getPostEventQA = async (req, res) => {
  try {
    await svc.assertCanViewReport(req.user);
    ok(res, await svc.getPostEventQA(req.params.eventId));
  } catch (err) { fail(res, err); }
};

const regenerateEventQr = async (req, res) => {
  try {
    await svc.assertCanConfigure(req.user);
    ok(res, await svc.generateEventQrToken(req.params.eventId, req.user.id, req.body.expires_in_hours), 201);
  } catch (err) { fail(res, err); }
};

const getActiveEventQr = async (req, res) => {
  try {
    await svc.assertCanConfigure(req.user);
    ok(res, await svc.getActiveQrForEvent(req.params.eventId));
  } catch (err) { fail(res, err); }
};

const getQrByToken = async (req, res) => {
  try {
    const result = await svc.validateQrToken(req.params.token);
    if (!result.valid) return res.status(410).json({ ok: false, message: result.reason });
    ok(res, result);
  } catch (err) { fail(res, err); }
};

module.exports = {
  getMyAccess,
  listConfigurators,
  setConfigurators,
  listEvents,
  getCurrentEvent,
  getAdminCurrentEvent,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getPresentations,
  getPresentation,
  createPresentation,
  updatePresentation,
  deletePresentation,
  startPresentation,
  finishPresentation,
  getQuestions,
  getEventQuestions,
  createQuestion,
  createEventQuestion,
  moderateQuestion,
  highlightQuestion,
  answerQuestion,
  hideQuestion,
  rateAporte,
  getAporteRankings,
  getEventSummary,
  getPostEventQA,
  regenerateEventQr,
  getActiveEventQr,
  getQrByToken,
};
