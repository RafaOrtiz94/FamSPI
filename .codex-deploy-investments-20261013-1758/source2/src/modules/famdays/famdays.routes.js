const { Router } = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const c = require('./famdays.controller');

const router = Router();

const keyWithPrefix = (prefix) => (req) =>
  req.user?.id ? `${prefix}_uid:${req.user.id}` : `${prefix}_${ipKeyGenerator(req)}`;

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyWithPrefix('famdays_r'),
  handler: (_req, res) => res.status(429).json({ ok: false, message: 'Demasiadas solicitudes a FamDays.' }),
});

const questionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyWithPrefix('famdays_q'),
  handler: (_req, res) => res.status(429).json({ ok: false, message: 'Demasiadas preguntas. Espera un momento.' }),
});

const requireFamDaysAccess = (_req, _res, next) => next();

router.get('/access/me', c.getMyAccess);
router.get('/configurators', c.listConfigurators);
router.put('/configurators', c.setConfigurators);

router.get('/events', readLimiter, c.listEvents);
router.get('/events/current', requireFamDaysAccess, readLimiter, c.getCurrentEvent);
router.get('/events/admin/current', readLimiter, c.getAdminCurrentEvent);
router.get('/events/:eventId', requireFamDaysAccess, readLimiter, c.getEvent);
router.post('/events', c.createEvent);
router.patch('/events/:eventId', c.updateEvent);
router.delete('/events/:eventId', c.deleteEvent);

router.get('/events/:eventId/presentations', requireFamDaysAccess, readLimiter, c.getPresentations);
router.post('/events/:eventId/presentations', c.createPresentation);
router.get('/events/:eventId/questions', requireFamDaysAccess, readLimiter, c.getEventQuestions);
router.post('/events/:eventId/questions', requireFamDaysAccess, questionLimiter, c.createEventQuestion);
router.get('/presentations/:presentationId', requireFamDaysAccess, readLimiter, c.getPresentation);
router.patch('/presentations/:presentationId', c.updatePresentation);
router.delete('/presentations/:presentationId', c.deletePresentation);

router.get('/presentations/:presentationId/questions', requireFamDaysAccess, readLimiter, c.getQuestions);
router.post('/presentations/:presentationId/questions', requireFamDaysAccess, questionLimiter, c.createQuestion);
router.patch('/questions/:questionId/moderate', c.moderateQuestion);
router.patch('/questions/:questionId/highlight', c.highlightQuestion);
router.patch('/questions/:questionId/answer', c.answerQuestion);
router.patch('/questions/:questionId/hide', c.hideQuestion);
router.post('/questions/:questionId/rate-aporte', requireFamDaysAccess, c.rateAporte);

router.get('/events/:eventId/aporte-rankings', requireFamDaysAccess, readLimiter, c.getAporteRankings);
router.get('/events/:eventId/summary', readLimiter, c.getEventSummary);
router.get('/events/:eventId/post-qa', readLimiter, c.getPostEventQA);

router.get('/events/:eventId/qr', c.getActiveEventQr);
router.post('/events/:eventId/qr/regenerate', c.regenerateEventQr);
router.get('/qr/:token', c.getQrByToken);

module.exports = router;
