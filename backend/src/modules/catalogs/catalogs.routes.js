const express = require('express');
const router = express.Router();
// ===== CONSUMIBLES =====
router.get('/consumables', catalogsController.getConsumables);
router.get('/consumables/:id', catalogsController.getConsumableById);
router.get('/consumables/by-determination/:determinationId', catalogsController.getConsumablesByDetermination);
router.post('/consumables', catalogsController.createConsumable);
router.put('/consumables/:id', catalogsController.updateConsumable);
router.delete('/consumables/:id', catalogsController.deleteConsumable);

// ===== VERSIONAMIENTO =====
router.post('/equipment/:id/discontinue', catalogsController.discontinueEquipment);
router.post('/determinations/:id/discontinue', catalogsController.discontinueDetermination);
router.post('/consumables/:id/discontinue', catalogsController.discontinueConsumable);

// ===== RELACIONES =====
router.get('/equipment-consumables', catalogsController.getEquipmentConsumables);
router.post('/equipment-consumables', catalogsController.createEquipmentConsumable);
router.delete('/equipment-consumables/:id', catalogsController.deleteEquipmentConsumable);

// ===== INVERSIONES CATALOGADAS =====
router.get('/investments', catalogsController.getInvestments);
router.post('/investments', catalogsController.createInvestment);
router.put('/investments/:id', catalogsController.updateInvestment);

// ===== VISTAS =====
router.get('/equipment-with-determinations', catalogsController.getEquipmentWithDeterminations);

module.exports = router;
