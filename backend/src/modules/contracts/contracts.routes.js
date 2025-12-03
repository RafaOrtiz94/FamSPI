const express = require('express');
const router = express.Router();
const contractsController = require('./contracts.controller');
const { verifyToken } = require('../../middlewares/authMiddleware');

router.use(verifyToken);

// Crear inventario al activar BC
router.post('/activate/:businessCaseId', contractsController.activateBusinessCase);

// Registrar consumo
router.post('/consumption', contractsController.registerConsumption);

// Ver inventario por BC
router.get('/inventory/:businessCaseId', contractsController.getInventoryByBusinessCase);

// Ver inventario por cliente
router.get('/inventory/client/:clientId', contractsController.getInventoryByClient);

// Actualizar umbral de alertas
router.put('/thresholds/:contractDeterminationId', contractsController.updateAlertThresholds);

module.exports = router;
