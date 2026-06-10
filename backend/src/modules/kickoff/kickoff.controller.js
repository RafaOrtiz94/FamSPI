const svc    = require('./kickoff.service');
const logger = require('../../config/logger');

// ─── helpers ──────────────────────────────────────────────────────────────────

const ok   = (res, data, status = 200) => res.status(status).json({ ok: true, data });
const fail = (res, err) => {
  const status = err.status || 500;
  if (status >= 500) logger.error(`[kickoff] ${err.message}`, { stack: err.stack });
  else               logger.warn(`[kickoff] ${err.message}`);
  res.status(status).json({ ok: false, message: err.message });
};

const ADMIN_ROLES  = new Set(['jefe_ti', 'admin', 'administrador']);
const REPORT_ROLES = new Set(['jefe_ti', 'gerencia_general']);
const isAdminRole  = (req) => ADMIN_ROLES.has((req.user?.role || '').toLowerCase());
const isReportRole = (req) => REPORT_ROLES.has((req.user?.role || '').toLowerCase());

async function isPresenter(userId, presentationId) {
  const db = require('../../config/db');
  const { rows } = await db.query(
    `SELECT id FROM kickoff_presentations WHERE id = $1 AND presenter_user_id = $2`,
    [presentationId, userId]
  );
  return rows.length > 0;
}

// ─── events ───────────────────────────────────────────────────────────────────

const listEvents = async (req, res) => {
  try {
    const data = await svc.listAllEvents();
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const getCurrentEvent = async (req, res) => {
  try {
    const data = await svc.getCurrentEvent();
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const getAdminCurrentEvent = async (req, res) => {
  try {
    const data = await svc.getAdminCurrentEvent();
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const getEvent = async (req, res) => {
  try {
    const data = await svc.getEventById(req.params.eventId);
    if (!data) return res.status(404).json({ ok: false, message: 'Evento no encontrado' });
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const createEvent = async (req, res) => {
  try {
    const data = await svc.createEvent(req.body, req.user.id);
    ok(res, data, 201);
  } catch (e) { fail(res, e); }
};

const updateEvent = async (req, res) => {
  try {
    const data = await svc.updateEvent(req.params.eventId, req.body, req.user.id);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const deleteEvent = async (req, res) => {
  try {
    await svc.deleteEvent(req.params.eventId);
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
};

// ─── presentations ────────────────────────────────────────────────────────────

const getPresentations = async (req, res) => {
  try {
    const userId = isAdminRole(req) ? null : req.user?.id;
    const data   = await svc.getPresentationsByEvent(req.params.eventId, userId);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const getPresentation = async (req, res) => {
  try {

    const pres = await svc.getPresentationById(req.params.presentationId);
    if (!pres) return res.status(404).json({ ok: false, message: 'Presentación no encontrada' });
    const blocks      = await svc.getBlocksByPresentation(pres.id);
    const active_block = blocks.find(b => b.is_active) || null;
    ok(res, { ...pres, blocks, active_block });
  } catch (e) { fail(res, e); }
};

const createPresentation = async (req, res) => {
  try {
    const data = await svc.createPresentation(req.params.eventId, req.body, req.user.id);
    ok(res, data, 201);
  } catch (e) { fail(res, e); }
};

const updatePresentation = async (req, res) => {
  try {
    const data = await svc.updatePresentation(req.params.presentationId, req.body, req.user.id);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const deletePresentation = async (req, res) => {
  try {
    await svc.deletePresentation(req.params.presentationId);
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
};

const startPresentation = async (req, res) => {
  try {
    const data = await svc.startPresentation(req.params.presentationId, req.user.id);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const finishPresentation = async (req, res) => {
  try {
    const data = await svc.finishPresentation(req.params.presentationId, req.user.id);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const nextBlock = async (req, res) => {
  try {
    const data = await svc.advanceBlock(req.params.presentationId, 'next', req.user.id);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const prevBlock = async (req, res) => {
  try {
    const data = await svc.advanceBlock(req.params.presentationId, 'prev', req.user.id);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const upsertBlock = async (req, res) => {
  try {
    const data = await svc.upsertBlock(req.params.presentationId, req.body, req.user.id);
    ok(res, data, req.body.id ? 200 : 201);
  } catch (e) { fail(res, e); }
};

const deleteBlock = async (req, res) => {
  try {
    await svc.deleteBlock(req.params.blockId, req.params.presentationId);
    ok(res, { deleted: true });
  } catch (e) { fail(res, e); }
};

// ─── questions ────────────────────────────────────────────────────────────────

const getQuestions = async (req, res) => {
  try {
    const forModerator = isAdminRole(req) || isReportRole(req) || await isPresenter(req.user.id, req.params.presentationId);
    const data = await svc.getQuestions(req.params.presentationId, {
      status:       req.query.status,
      forModerator,
      userId:       req.user?.id,
    });
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const createQuestion = async (req, res) => {
  try {
    const data = await svc.createQuestion(req.params.presentationId, req.body, req.user.id);
    ok(res, data, 201);
  } catch (e) { fail(res, e); }
};

const moderateQuestion = async (req, res) => {
  try {
    const data = await svc.moderateQuestion(req.params.questionId, req.body, req.user.id);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

// ─── tiebreaker ───────────────────────────────────────────────────────────────

const getTiebreakerStatus = async (req, res) => {
  try {
    const data = await svc.getTiebreakerStatus(req.params.eventId, req.user?.id);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const startTiebreakerRound = async (req, res) => {
  try {
    const { aporte_ids } = req.body;
    const data = await svc.startTiebreakerRound(req.params.eventId, aporte_ids, req.user.id);
    ok(res, data, 201);
  } catch (e) { fail(res, e); }
};

const castTiebreakerVote = async (req, res) => {
  try {
    const data = await svc.castTiebreakerVote(req.params.roundId, req.body.aporte_id, req.user.id);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const finishTiebreakerRound = async (req, res) => {
  try {
    const data = await svc.finishTiebreakerRound(req.params.roundId, req.user.id);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

// ─── event summary ────────────────────────────────────────────────────────────

const getEventSummary = async (req, res) => {
  try {
    const data = await svc.getEventSummary(req.params.eventId);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

// ─── post-event Q&A ───────────────────────────────────────────────────────────

const getPostEventQA = async (req, res) => {
  try {
    const data = await svc.getPostEventQA(req.params.eventId);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

// ─── QR ───────────────────────────────────────────────────────────────────────

const getQrByToken = async (req, res) => {
  try {
    const result = await svc.validateQrToken(req.params.token, req.user?.id);
    if (!result.valid) return res.status(410).json({ ok: false, message: result.reason });
    ok(res, result);
  } catch (e) { fail(res, e); }
};

const regenerateQr = async (req, res) => {
  try {
    const data = await svc.generateQrToken(
      req.params.presentationId,
      req.user.id,
      req.body.expires_in_hours
    );
    ok(res, data, 201);
  } catch (e) { fail(res, e); }
};

const getActiveQr = async (req, res) => {
  try {
    const data = await svc.getActiveQrForPresentation(req.params.presentationId);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

// ─── ratings ──────────────────────────────────────────────────────────────────

const rateQuestion = async (req, res) => {
  try {
    const rating = parseInt(req.body.rating);
    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ ok: false, message: 'La calificación debe ser entre 1 y 5' });
    const data = await svc.rateQuestion(req.params.questionId, req.user.id, rating);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const rateAporte = async (req, res) => {
  try {
    const rating = parseInt(req.body.rating);
    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ ok: false, message: 'La calificación debe ser entre 1 y 5' });
    const data = await svc.rateAporte(req.params.questionId, req.user.id, rating);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const getAporteRankings = async (req, res) => {
  try {
    const data = await svc.getAporteRankings(req.params.eventId);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

const getEventWinners = async (req, res) => {
  try {
    const data = await svc.getEventWinners(req.params.eventId);
    ok(res, data);
  } catch (e) { fail(res, e); }
};

module.exports = {
  listEvents,
  getCurrentEvent, getAdminCurrentEvent, getEvent, createEvent, updateEvent, deleteEvent,
  getPresentations, getPresentation, createPresentation,
  updatePresentation, startPresentation, finishPresentation, deletePresentation,
  nextBlock, prevBlock, upsertBlock, deleteBlock,
  getQuestions, createQuestion, moderateQuestion,
  getQrByToken, regenerateQr, getActiveQr,
  rateQuestion,
  rateAporte, getAporteRankings, getEventWinners,
  getEventSummary,
  getPostEventQA,
  getTiebreakerStatus, startTiebreakerRound, castTiebreakerVote, finishTiebreakerRound,
};
