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
// Todos los roles con visibilidad según sección 12 del workflow: todos ven, acciones se gatean.
const viewerRoles = Array.from(new Set([
  ...creatorRoles,
  'jefe_tecnico',
  'jefe_servicio_tecnico',
  'tecnico',
  'jefe_operaciones',
  'jefe_logistica',
  'logistica',
  'backoffice_comercial',
]));
const supplyControlRoles = [...managerRoles, 'backoffice_comercial'];
const serialRoles = [...managerRoles, 'jefe_logistica', 'logistica'];

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
router.post(
  '/:id/start-business-case',
  requireRole(['backoffice_comercial', 'acp_comercial', 'jefe_comercial']),
  controller.startBusinessCase,
);
router.post('/:id/provider-response', controller.saveProviderResponse);
router.post('/:id/submit-contract', controller.uploadContract);
router.post('/:id/contract/client-signed', controller.uploadClientSignedContract);
router.post('/:id/inspection-request', controller.saveInspectionRequest);
router.patch('/:id/coordinate-inspection-date', controller.coordinateInspectionDate);
router.patch(
  '/:id/review-inspection-date',
  requireRole(['jefe_tecnico', 'jefe_servicio_tecnico']),
  controller.reviewInspectionDate
);
router.patch(
  '/:id/site-inspection',
  requireRole(['tecnico', 'jefe_tecnico', 'jefe_servicio_tecnico']),
  controller.registerSiteInspection,
);
router.patch(
  '/:id/installation-workflow',
  requireRole([
    'tecnico',
    'jefe_tecnico',
    'jefe_servicio_tecnico',
    'jefe_operaciones',
    'jefe_logistica',
    'logistica',
    'jefe_comercial',
    'acp_comercial',
  ]),
  controller.updateInstallationWorkflow,
);
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

// WORKFLOW ALIGNMENT — Parte 2
// supply_control_type: bc_maximums | commercial_deliverables | none
router.post(
  '/:id/set-supply-control-type',
  requireRole(supplyControlRoles),
  controller.setSupplyControlType,
);
// Serial: solo registrable cuando serial_status = received_pending_serial (equipo recibido)
router.post(
  '/:id/register-serial',
  requireRole(serialRoles),
  controller.registerSerial,
);

module.exports = router;
