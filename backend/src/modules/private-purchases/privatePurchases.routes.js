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

const managerRoles = ['acp_comercial', 'gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial'];

// PR-01: Creadores — comercial, asesor_comercial, analista_comercial + managers
const creatorRoles = ['comercial', 'asesor_comercial', 'analista_comercial', ...managerRoles];

// PR: comercialAndBackofficeRoles incluye comercial y backoffice (antes faltaban)
const comercialAndBackofficeRoles = Array.from(new Set([
  'comercial',
  'asesor_comercial',
  'analista_comercial',
  'backoffice',
  'backoffice_comercial',
  ...managerRoles,
]));

// PR-02: Viewers — todos los que pueden ver expedientes privados
const viewerRoles = Array.from(new Set([
  ...creatorRoles,
  'backoffice',
  'backoffice_comercial',
  'jefe_tecnico',
  'jefe_servicio_tecnico',
  'tecnico',
  'jefe_operaciones',
  'jefe_logistica',
  'logistica',
]));

const deliveryRoles = Array.from(new Set([
  ...managerRoles,
  'jefe_operaciones',
  'operaciones',
  'jefe_logistica',
  'logistica',
  'jefe_tecnico',
  'jefe_servicio_tecnico',
  'tecnico',
]));

const inspectionRequestRoles = [
  'comercial',
  'asesor_comercial',
  'analista_comercial',
  'backoffice',
  'backoffice_comercial',
  'jefe_comercial',
  'jefe_de_comercial',
  'gerencia',
  'gerencia_general',
];

// PR-05: Control Operativo — SOLO acp_comercial o jefe_comercial pueden configurar tipo
const supplyControlRoles = ['acp_comercial', 'jefe_comercial', 'jefe_de_comercial'];

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
router.post('/', requireRole(creatorRoles), controller.create);
router.get('/', requireRole(viewerRoles), controller.list);
router.get('/mine', requireRole(viewerRoles), controller.listMine);
router.get('/by-role/:role', requireRole(viewerRoles), controller.listByRole);
// Carga de técnicos por fecha — debe ir ANTES de /:id
router.get('/technician-schedule', requireRole(['jefe_tecnico', 'jefe_servicio_tecnico', 'comercial', 'backoffice', 'backoffice_comercial', ...managerRoles]), controller.getTechnicianSchedule);
// Reservas activas — debe ir ANTES de /:id
router.get('/active-reservations', requireRole(['acp_comercial', ...managerRoles]), controller.getActiveReservations);
router.get('/:id', requireRole(viewerRoles), controller.getOne);

// Transiciones de estado - validación por rol en state machine
router.post('/:id/transition', requireRole(viewerRoles), controller.transitionState);
router.get('/:id/transitions', requireRole(viewerRoles), controller.getAllowedTransitions);
router.post('/:id/validate-transition', requireRole(viewerRoles), controller.validateTransition);

// Operaciones del flujo
// Solicitar proforma al proveedor (email) — solo ACP/gerencia
router.post('/:id/request-proforma', requireRole(['acp_comercial', ...managerRoles]), controller.requestProformaFromProvider);
// Subir proforma sin firmar y activar reserva — solo ACP/gerencia
router.post('/:id/upload-proforma', requireRole(['acp_comercial', ...managerRoles]), controller.uploadProformaAndReserve);
// Subir proforma firmada por el proveedor (habilita contrato) — solo ACP/gerencia
router.post('/:id/upload-signed-proforma', requireRole(['acp_comercial', ...managerRoles]), controller.uploadSignedProforma);
router.post('/:id/offer', requireRole(comercialAndBackofficeRoles), controller.sendOffer);
router.post('/:id/offer/signed', requireRole(['comercial', ...managerRoles]), controller.uploadSignedOffer);
router.post('/:id/send-to-acp', requireRole(comercialAndBackofficeRoles), controller.forwardToAcp);
router.post('/:id/start-availability', requireRole(managerRoles), controller.startAvailability);
router.post(
  '/:id/start-business-case',
  // NUEVO-06: jefe_de_comercial = mismo nivel que jefe_comercial
  requireRole(['backoffice_comercial', 'acp_comercial', 'jefe_comercial', 'jefe_de_comercial']),
  controller.startBusinessCase,
);
router.post('/:id/provider-response', requireRole(managerRoles), controller.saveProviderResponse);
// Decisiones del cliente intermedias — gestionadas por comercial
router.post('/:id/confirm-cu-availability',  requireRole(['comercial', 'asesor_comercial', 'analista_comercial', ...managerRoles]), controller.confirmClientCuApproval);
router.post('/:id/confirm-import-approval',  requireRole(['comercial', 'asesor_comercial', 'analista_comercial', ...managerRoles]), controller.confirmClientImportApproval);
router.post('/:id/submit-contract', requireRole(comercialAndBackofficeRoles), controller.uploadContract);
router.post('/:id/contract/client-signed', requireRole(['comercial', ...managerRoles]), controller.uploadClientSignedContract);
// Gerencia aprueba o rechaza el contrato (sin subir archivo)
router.post('/:id/contract/gerencia-decision', requireRole(['gerencia', 'gerencia_general', 'jefe_comercial', 'jefe_de_comercial']), controller.registerManagerContractDecision);
// ACP sube el contrato firmado (solo tras aprobación de gerencia)
router.post('/:id/contract/acp-signed', requireRole(['acp_comercial', ...managerRoles]), controller.uploadAcpSignedContract);
// Reiniciar flujo de contrato tras rechazo de gerencia
router.post('/:id/contract/restart-rejection', requireRole(comercialAndBackofficeRoles), controller.restartContractAfterRejection);
// Contrato del proveedor — ACP lo recibe y luego sube el firmado
router.post('/:id/provider-contract/received', requireRole(['acp_comercial', ...managerRoles]), controller.markProviderContractReceived);
router.post('/:id/provider-contract/upload', requireRole(['acp_comercial', ...managerRoles]), controller.uploadProviderContract);
router.post('/:id/inspection-request', requireRole(inspectionRequestRoles), controller.saveInspectionRequest);
router.patch('/:id/coordinate-inspection-date', requireRole(['jefe_tecnico', 'jefe_servicio_tecnico']), controller.coordinateInspectionDate);
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
router.post('/:id/delivery-guides', requireRole(deliveryRoles), controller.uploadDeliveryGuides);
router.post('/:id/request-delivery-dates', requireRole([...creatorRoles, 'backoffice_comercial']), controller.requestDeliveryDates);
router.post('/:id/submit-delivery-dates', requireRole(deliveryRoles), controller.submitDeliveryDates);
router.post('/:id/renew-reservation', requireRole(managerRoles), controller.renewReservation);
router.get('/:id/documents', requireRole(viewerRoles), controller.getDocuments);
// NUEVO-05: backoffice y backoffice_comercial también pueden gestionar registro de clientes en compras privadas
router.post('/:id/request-client-registration', requireRole(['comercial', 'backoffice', 'backoffice_comercial', ...managerRoles]), controller.requestClientRegistration);
router.post('/:id/register-client', requireRole(['comercial', 'backoffice', 'backoffice_comercial', ...managerRoles]), controller.updateClientRegistration);
router.get('/:id/check-client-approval', requireRole(viewerRoles), controller.checkClientApproval);
router.put('/:id/client-registration', requireRole(['comercial', 'backoffice', 'backoffice_comercial', ...managerRoles]), controller.updateClientRegistration);
router.put('/:id/delivery-dates', requireRole(deliveryRoles), controller.setDeliveryDates);
router.post('/:id/ready-for-delivery', requireRole(deliveryRoles), controller.markReadyForDelivery);
router.post('/:id/complete-delivery', requireRole(deliveryRoles), controller.completeDelivery);
router.post('/:id/cancel', requireRole(managerRoles), controller.cancel);
router.post('/:id/operations-details', requireRole(deliveryRoles), controller.updateOperationsDetails);
router.post('/:id/mark-equipment-arrived', requireRole(deliveryRoles), controller.markEquipmentArrived);
router.post('/:id/delivery-act', requireRole(deliveryRoles), controller.uploadDeliveryAct);
router.post('/:id/delivery-act/assign', requireRole(['jefe_tecnico', 'jefe_servicio_tecnico']), controller.assignDeliveryActTechnician);
router.post('/:id/delivery-act/finalize', requireRole(['jefe_tecnico', 'jefe_servicio_tecnico']), controller.finalizeDeliveryAct);
router.post('/:id/dispatch-details', requireRole(deliveryRoles), controller.updateDispatchDetails);

// Estadísticas
router.get('/stats/:role', requireRole(managerRoles), controller.getStats);

// FASE 3: Timeline/auditoría para widgets
router.get('/:id/timeline', requireRole(viewerRoles), controller.getTimeline);

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
