/**
 * Private Purchases Routes
 *
 * Rutas para gestión del flujo de compras privadas.
 * FASE 2: Agregada validación de roles por endpoint
 */

const express = require('express');
const router = express.Router();

// Middleware de autenticación y roles
const { verifyToken, requireRole } = require('../../middlewares/auth');
const { streamPrivatePurchaseUpdates } = require('./privatePurchaseEvents');

const managerRoles = ['acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial'];
const creatorRoles = ['comercial', ...managerRoles];
const viewerRoles = Array.from(new Set([...creatorRoles, 'jefe_tecnico', 'jefe_operaciones']));

const attachTokenFromQuery = (req, _res, next) => {
  const token = req.query?.token;
  if (token) {
    req.headers.authorization = `Bearer ${token}`;
  }
  next();
};

router.get('/events', attachTokenFromQuery, verifyToken, requireRole(viewerRoles), streamPrivatePurchaseUpdates);

// Aplicar autenticación a todas las rutas
router.use(verifyToken);

// Importar controlador después de configurar middlewares para evitar problemas de carga circular
const controller = require('./privatePurchases.controller');

// CRUD básico
router.post('/', controller.create);
router.get('/', controller.list);
router.get('/mine', controller.listMine);
router.get('/by-role/:role', controller.listByRole);
router.get('/:id', controller.getOne);

// Transiciones de estado - validación por rol en state machine
router.post('/:id/transition', controller.transitionState);
router.get('/:id/transitions', controller.getAllowedTransitions);
router.post('/:id/validate-transition', controller.validateTransition);

// Operaciones del flujo
router.post('/:id/offer', controller.sendOffer);
router.post('/:id/offer/signed', controller.uploadSignedOffer);
router.post('/:id/send-to-acp', controller.forwardToAcp);
router.post('/:id/start-availability', controller.startAvailability);
router.post('/:id/provider-response', controller.saveProviderResponse);
router.post('/:id/submit-contract', controller.uploadContract);
router.post('/:id/contract/client-signed', controller.uploadClientSignedContract);
router.post('/:id/inspection-request', controller.saveInspectionRequest);
router.post('/:id/delivery-guides', controller.uploadDeliveryGuides);
router.post('/:id/request-delivery-dates', controller.requestDeliveryDates);
router.post('/:id/submit-delivery-dates', controller.submitDeliveryDates);
router.get('/:id/documents', controller.getDocuments);
router.post('/:id/request-client-registration', controller.requestClientRegistration);
router.post('/:id/register-client', controller.updateClientRegistration);
router.get('/:id/check-client-approval', controller.checkClientApproval);
router.put('/:id/client-registration', controller.updateClientRegistration);
router.put('/:id/delivery-dates', controller.setDeliveryDates);
router.post('/:id/ready-for-delivery', controller.markReadyForDelivery);
router.post('/:id/complete-delivery', controller.completeDelivery);
router.post('/:id/cancel', controller.cancel);
router.post('/:id/operations-details', controller.updateOperationsDetails);
router.post('/:id/mark-equipment-arrived', controller.markEquipmentArrived);
router.post('/:id/delivery-act', controller.uploadDeliveryAct);
router.post('/:id/delivery-act/assign', controller.assignDeliveryActTechnician);
router.post('/:id/delivery-act/finalize', controller.finalizeDeliveryAct);
router.post('/:id/dispatch-details', controller.updateDispatchDetails);

// Estadísticas
router.get('/stats/:role', controller.getStats);

// FASE 3: Timeline/auditoría para widgets
router.get('/:id/timeline', controller.getTimeline);

module.exports = router;
