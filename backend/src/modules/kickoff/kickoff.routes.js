const { Router }    = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { requireRole } = require('../../middlewares/roles');
const db = require('../../config/db');
const c  = require('./kickoff.controller');

const router = Router();

const adminRoles    = ['jefe_ti'];
const allStaffRoles = ['jefe_ti', 'ti'];
// Roles con acceso a reportes y respuesta de preguntas post-evento
const reportRoles   = ['jefe_ti', 'gerencia_general'];
const requireReportAccess = (req, res, next) => {
  const role = (req.user?.role || '').toLowerCase();
  if (reportRoles.includes(role)) return next();
  return res.status(403).json({ ok: false, message: 'No autorizado' });
};

// ── requireKickoffAccess ──────────────────────────────────────────────────────
// Módulo abierto a todos los usuarios autenticados.
const requireKickoffAccess = (req, res, next) => next();

const kickoffKeyWithPrefix = (prefix) => (req) =>
  req.user?.id ? `${prefix}_uid:${req.user.id}` : `${prefix}_${ipKeyGenerator(req)}`;

// Rate limit para envío de preguntas: máximo 20 por minuto por usuario.
// Aumentado para soportar pruebas con ~40 usuarios simultáneos en eventos Kick Off.
const questionLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    kickoffKeyWithPrefix("kickoff_q"),
  handler: (_req, res) =>
    res.status(429).json({ ok: false, message: 'Demasiadas preguntas. Espera un momento antes de enviar otra.' }),
});

// Rate limit para rutas de lectura (polling): 500 req/min por usuario.
// Los clientes hacen polling cada 4–5 s → ~15 req/min por usuario, por ende
// 500 deja margen amplio sin abrir la puerta a abusos.
const kickoffReadLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             500,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    kickoffKeyWithPrefix("kickoff_r"),
  handler: (_req, res) =>
    res.status(429).json({ ok: false, message: 'Demasiadas solicitudes al módulo Kick Off. Intenta en un momento.' }),
});

// ── requirePresenterOrAdmin ───────────────────────────────────────────────────
// Permite: adminRoles + SUPER_ROLES  OR  el presentador asignado a esa presentación.
const SUPER_ROLES = ['admin', 'administrador'];

const requirePresenterOrAdmin = (req, res, next) => {
  const role = (req.user?.role || '').toLowerCase();
  if (adminRoles.includes(role) || SUPER_ROLES.includes(role)) return next();

  const presId = req.params.presentationId;
  if (!presId) return res.status(403).json({ ok: false, message: 'No autorizado' });

  db.query(
    'SELECT id FROM kickoff_presentations WHERE id = $1 AND presenter_user_id = $2',
    [presId, req.user?.id]
  )
    .then(({ rows }) => {
      if (rows.length > 0) return next();
      return res.status(403).json({ ok: false, message: 'Solo el presentador asignado o un administrador puede realizar esta acción' });
    })
    .catch(() => res.status(500).json({ ok: false, message: 'Error al verificar permisos' }));
};

// ── requireQuestionModerator ──────────────────────────────────────────────────
// Permite: adminRoles + SUPER_ROLES  OR  el presentador de la presentación a la
// que pertenece la pregunta.
const requireQuestionModerator = (req, res, next) => {
  const role = (req.user?.role || '').toLowerCase();
  if (adminRoles.includes(role) || SUPER_ROLES.includes(role)) return next();

  const qId = req.params.questionId;
  if (!qId) return res.status(403).json({ ok: false, message: 'No autorizado' });

  db.query(
    `SELECT kp.presenter_user_id
     FROM kickoff_questions kq
     JOIN kickoff_presentations kp ON kp.id = kq.presentation_id
     WHERE kq.id = $1`,
    [qId]
  )
    .then(({ rows }) => {
      if (rows[0]?.presenter_user_id === req.user?.id) return next();
      return res.status(403).json({ ok: false, message: 'Solo el presentador asignado puede moderar preguntas' });
    })
    .catch(() => res.status(500).json({ ok: false, message: 'Error al verificar permisos' }));
};

// ─── events ───────────────────────────────────────────────────────────────────

router.get('/events',                  requireRole(adminRoles), kickoffReadLimiter, c.listEvents);
router.get('/events/current',          requireKickoffAccess,    kickoffReadLimiter, c.getCurrentEvent);
router.get('/events/admin/current',    requireRole(adminRoles), kickoffReadLimiter, c.getAdminCurrentEvent);
router.get('/events/:eventId',         requireKickoffAccess,    kickoffReadLimiter, c.getEvent);
router.post('/events',                 requireRole(adminRoles), c.createEvent);
router.patch('/events/:eventId',       requireRole(adminRoles), c.updateEvent);
router.delete('/events/:eventId',      requireRole(adminRoles), c.deleteEvent);

// ─── presentations ────────────────────────────────────────────────────────────

router.get('/events/:eventId/presentations',       requireKickoffAccess,    kickoffReadLimiter, c.getPresentations);
router.post('/events/:eventId/presentations',      requireRole(adminRoles), c.createPresentation);
router.get('/presentations/:presentationId',       requireKickoffAccess,    kickoffReadLimiter, c.getPresentation);
router.patch('/presentations/:presentationId',     requireRole(adminRoles), c.updatePresentation);
router.delete('/presentations/:presentationId',    requireRole(adminRoles), c.deletePresentation);

// Presenter controls — jefe_ti, admin/administrador OR el presentador asignado
router.post('/presentations/:presentationId/start',           requirePresenterOrAdmin, c.startPresentation);
router.post('/presentations/:presentationId/finish',          requirePresenterOrAdmin, c.finishPresentation);
router.post('/presentations/:presentationId/blocks/next',     requirePresenterOrAdmin, c.nextBlock);
router.post('/presentations/:presentationId/blocks/previous', requirePresenterOrAdmin, c.prevBlock);
router.put('/presentations/:presentationId/blocks',           requireRole(adminRoles), c.upsertBlock);
router.delete('/presentations/:presentationId/blocks/:blockId', requireRole(adminRoles), c.deleteBlock);
router.get('/presentations/:presentationId/qr',               requirePresenterOrAdmin, c.getActiveQr);
router.post('/presentations/:presentationId/qr/regenerate',   requirePresenterOrAdmin, c.regenerateQr);

// ─── questions ────────────────────────────────────────────────────────────────

router.get('/presentations/:presentationId/questions',
  requireKickoffAccess,
  kickoffReadLimiter,
  c.getQuestions
);
router.post('/presentations/:presentationId/questions',
  requireKickoffAccess,
  questionLimiter,
  c.createQuestion
);

// Moderation — jefe_ti, admin/administrador OR el presentador asignado a esa pregunta
router.patch('/questions/:questionId/moderate',  requireQuestionModerator, c.moderateQuestion);
router.patch('/questions/:questionId/highlight', requireQuestionModerator, (req, _res, next) => {
  req.body = { ...req.body, status: 'highlighted' };
  next();
}, c.moderateQuestion);
router.patch('/questions/:questionId/answer',    requireReportAccess, (req, _res, next) => {
  req.body = { ...req.body, status: 'answered' };
  next();
}, c.moderateQuestion);
router.patch('/questions/:questionId/hide',      requireQuestionModerator, (req, _res, next) => {
  req.body = { ...req.body, status: 'hidden' };
  next();
}, c.moderateQuestion);
router.patch('/questions/:questionId/approve',   requireQuestionModerator, (req, _res, next) => {
  req.body = { ...req.body, status: 'approved' };
  next();
}, c.moderateQuestion);

// ─── tiebreaker ───────────────────────────────────────────────────────────────

router.get('/events/:eventId/tiebreaker',         requireKickoffAccess, kickoffReadLimiter, c.getTiebreakerStatus);
router.post('/events/:eventId/tiebreaker/start',  requireRole(adminRoles), c.startTiebreakerRound);
router.post('/tiebreaker/rounds/:roundId/vote',   requireKickoffAccess, c.castTiebreakerVote);
router.post('/tiebreaker/rounds/:roundId/finish', requireRole(adminRoles), c.finishTiebreakerRound);

// ─── event summary ────────────────────────────────────────────────────────────

router.get('/events/:eventId/summary', requireReportAccess, kickoffReadLimiter, c.getEventSummary);

// ─── post-event Q&A ───────────────────────────────────────────────────────────

router.get('/events/:eventId/post-qa', requireReportAccess, kickoffReadLimiter, c.getPostEventQA);

// ─── ratings ──────────────────────────────────────────────────────────────────

router.post('/questions/:questionId/rate',           requireKickoffAccess, c.rateQuestion);
router.post('/questions/:questionId/rate-aporte',    requireKickoffAccess, c.rateAporte);
router.get('/events/:eventId/aporte-rankings',       requireKickoffAccess, kickoffReadLimiter, c.getAporteRankings);
router.get('/events/:eventId/winners',               requireKickoffAccess, kickoffReadLimiter, c.getEventWinners);

// ─── QR ───────────────────────────────────────────────────────────────────────

router.get('/qr/:token', c.getQrByToken);

module.exports = router;
