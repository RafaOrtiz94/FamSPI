const express = require('express');
const router = express.Router();
const ctrl = require('./finanzas.controller');
const { verifyToken } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/roles');

router.get('/api/v1/inventory', verifyToken, requireRole(['finanzas','gerencia']), ctrl.listInventory);
router.post('/api/v1/inventory/move', verifyToken, requireRole(['finanzas','gerencia']), ctrl.moveInventory);
router.get('/api/v1/inventory/report', verifyToken, requireRole(['finanzas','gerencia']), ctrl.report);
router.post('/api/v1/inventory/sync', verifyToken, requireRole(['finanzas','gerencia']), ctrl.syncWithSilver);

module.exports = router;
