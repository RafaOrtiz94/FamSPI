const { Router }    = require('express');
const { rateLimit } = require('express-rate-limit');
const { requireRole } = require('../../middlewares/roles');
const db = require('../../config/db');
const c  = require('./kickoff.controller');

const router = Router();

const adminRoles    = ['jefe_ti'];
const allStaffRoles = ['jefe_ti', 'ti'];

// ── Whitelist para acceso en fase de pruebas ──────────────────────────────────
// Estos usuarios tienen acceso aunque el evento no esté abierto al público.
// Cuando el evento tenga is_open=true, todos los usuarios autenticados tienen acceso.
const KICKOFF_WHITELIST = new Set([
  'alex.farino@fam-project.com',
  'pamela.altamirano@fam-project.com',
  'eric.gavilanes@fam-project.com',
  'rafael.ortiz@fam-project.com',
]);

// ── requireKickoffAccess ──────────────────────────────────────────────────────
// Para rutas de asistentes/presentadores (no exclusivas de admin).
// Permite: adminRoles + SUPER_ROLES, whitelist, o todos cuando is_open=true.
const requireKickoffAccess = async (req, res, next) => {
  const role  = (req.user?.role || '').toLowerCase();
  const email = (req.user?.email || '').toLowerCase();

  if (adminRoles.includes(role) || SUPER_ROLES.includes(role)) return next();
  if (allStaffRoles.includes(role)) return next();
  if (KICKOFF_WHITELIST.has(email)) return next();

  try {
    const { rows } = await db.query(
      `SELECT is_open FROM kickoff_events ORDER BY event_date DESC LIMIT 1`
    );
    if (rows[0]?.is_open) return next();
  } catch (_) {}

  return res.status(403).json({ ok: false, message: 'El módulo Kick Off no está disponible para tu usuario en este momento.' });
};

// Rate limit para envío de preguntas: máximo 5 por minuto por usuario
const questionLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => `kickoff_q_${req.user?.id || req.ip}`,
  handler: (_req, res) =>
    res.status(429).json({ ok: false, message: 'Demasiadas preguntas. Espera un momento antes de enviar otra.' }),
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

router.get('/events/current',          requireKickoffAccess,    c.getCurrentEvent);
router.get('/events/admin/current',    requireRole(adminRoles), c.getAdminCurrentEvent);
router.get('/events/:eventId',         requireKickoffAccess,    c.getEvent);
router.post('/events',                 requireRole(adminRoles), c.createEvent);
router.patch('/events/:eventId',       requireRole(adminRoles), c.updateEvent);
router.delete('/events/:eventId',      requireRole(adminRoles), c.deleteEvent);

// ─── presentations ────────────────────────────────────────────────────────────

router.get('/events/:eventId/presentations',       requireKickoffAccess,    c.getPresentations);
router.post('/events/:eventId/presentations',      requireRole(adminRoles), c.createPresentation);
router.get('/presentations/:presentationId',       requireKickoffAccess,    c.getPresentation);
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
router.patch('/questions/:questionId/answer',    requireQuestionModerator, (req, _res, next) => {
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

// ─── ratings ──────────────────────────────────────────────────────────────────

router.post('/questions/:questionId/rate',           requireKickoffAccess, c.rateQuestion);
router.post('/questions/:questionId/rate-aporte',    requireKickoffAccess, c.rateAporte);
router.post('/presentations/:presentationId/rate',   requireKickoffAccess, c.ratePresentation);
router.get('/presentations/:presentationId/ratings', requireKickoffAccess, c.getPresentationRatings);
router.get('/events/:eventId/rankings',              requireKickoffAccess, c.getEventRankings);
router.get('/events/:eventId/aporte-rankings',       requireKickoffAccess, c.getAporteRankings);
router.get('/events/:eventId/winners',               requireKickoffAccess, c.getEventWinners);

// ─── QR ───────────────────────────────────────────────────────────────────────

router.get('/qr/:token', c.getQrByToken);

module.exports = router;
