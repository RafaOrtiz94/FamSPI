const express = require('express');
const { requireRole, verifyToken } = require('../../middlewares/auth');
const { SECURITY_DEV_EMITTER_ENABLED } = require('../../config/security');
const {
  getOffHoursLogins,
  getOffHoursLoginTimeline,
  reviewOffHoursLogin,
  exportOffHoursLogins,
  emitOffHoursTest
} = require('./security.controller');

const router = express.Router();

// Lista explícita de entornos permitidos para DEV features
const ALLOWED_DEV_ENVS = ['development', 'sandbox', 'test', 'dev'];
const isDevEnv = ALLOWED_DEV_ENVS.includes(process.env.NODE_ENV);

// Runtime guard para /dev/* (cinturón y tirantes)
router.use('/dev', (req, res, next) => {
  if (!isDevEnv) {
    return res.status(404).json({ ok: false, message: 'Not found' });
  }
  next();
});

// ✅ ORDEN CRÍTICO: Auth primero, luego RBAC
router.use(verifyToken);
router.use(requireRole(['ti']));

// DEV endpoint solo en entornos permitidos + config habilitada
// ✅ Herencia automática de middlewares (verifyToken + requireRole)
if (isDevEnv && SECURITY_DEV_EMITTER_ENABLED) {
  router.post('/dev/emit-offhours', emitOffHoursTest);
}

// Production endpoints
router.get('/offhours-logins', getOffHoursLogins);
router.get('/offhours-logins/:id/timeline', getOffHoursLoginTimeline);
router.post('/offhours-logins/:id/review', reviewOffHoursLogin);
router.get('/offhours-logins/export', exportOffHoursLogins);

module.exports = router;
