const express = require('express');
const router = express.Router();
const alertsController = require('./alerts.controller');
const { verifyToken } = require('../../middlewares/authMiddleware');

router.use(verifyToken);

// Obtener alertas por BC
router.get('/business-case/:businessCaseId', alertsController.getAlertsByBusinessCase);

// Obtener todas las alertas activas
router.get('/active', alertsController.getActiveAlerts);

// Marcar alerta como reconocida
router.put('/:alertId/acknowledge', alertsController.acknowledgeAlert);

// Detectar consumos inusuales (ejecutar manualmente o por cron)
router.post('/detect-unusual-consumption', alertsController.detectUnusualConsumption);

module.exports = router;
