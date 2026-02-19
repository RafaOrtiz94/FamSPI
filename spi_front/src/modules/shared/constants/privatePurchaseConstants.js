/**
 * Constantes compartidas para el flujo de compras privadas
 * Extraídas de FASE 2 para reducir duplicación
 */

// Estados de compra privada (centralizados)
export const PRIVATE_PURCHASE_STATUS_DEFINITIONS = [
  { value: "pending_commercial", label: "Pendiente comercial", accent: "bg-blue-50 text-blue-700" },
  { value: "pending_backoffice", label: "Pendiente backoffice", accent: "bg-yellow-50 text-yellow-700" },
  { value: "pending_manager_signature", label: "Pendiente firma jefe", accent: "bg-indigo-50 text-indigo-700" },
  { value: "pending_client_signature", label: "Pendiente firma cliente", accent: "bg-teal-50 text-teal-700" },
  { value: "offer_sent", label: "Oferta enviada", accent: "bg-indigo-50 text-indigo-700" },
  { value: "offer_rejected_by_commercial", label: "Oferta rechazada por comercial", accent: "bg-rose-50 text-rose-700" },
  { value: "price_improvement_requested", label: "Mejora de precio solicitada", accent: "bg-amber-50 text-amber-700" },
  { value: "offer_signed", label: "Oferta firmada", accent: "bg-green-50 text-green-700" },
  { value: "client_registration_requested", label: "Cliente no registrado", accent: "bg-cyan-50 text-cyan-700" },
  { value: "client_registered", label: "Cliente registrado", accent: "bg-teal-50 text-teal-700" },
  { value: "inspection_requested", label: "Inspeccion solicitada", accent: "bg-amber-50 text-amber-700" },
  { value: "sent_to_acp", label: "Enviada a ACP", accent: "bg-purple-50 text-purple-700" },
  { value: "acp_availability_requested", label: "Disponibilidad solicitada", accent: "bg-purple-50 text-purple-700" },
  { value: "acp_availability_confirmed", label: "Disponibilidad confirmada", accent: "bg-emerald-50 text-emerald-700" },
  { value: "acp_availability_rejected", label: "Disponibilidad rechazada", accent: "bg-rose-50 text-rose-700" },
  { value: "pending_contract_client_signature", label: "Contrato pendiente firma cliente", accent: "bg-amber-50 text-amber-700" },
  { value: "pending_contract_approval", label: "Pendiente contrato gerencia", accent: "bg-amber-50 text-amber-700" },
  { value: "contract_available", label: "Contrato disponible", accent: "bg-amber-50 text-amber-700" },
  { value: "contract_rejected", label: "Contrato rechazado", accent: "bg-rose-50 text-rose-700" },
  { value: "delivery_dates_requested", label: "Fecha entrega solicitada", accent: "bg-orange-50 text-orange-700" },
  { value: "delivery_dates_submitted", label: "Fecha entrega definida", accent: "bg-teal-50 text-teal-700" },
  { value: "calendar_events_created", label: "Calendario creado", accent: "bg-teal-50 text-teal-700" },
  { value: "waiting_dispatch", label: "Esperando despacho", accent: "bg-indigo-50 text-indigo-700" },
  { value: "dispatch_ready", label: "Despacho listo", accent: "bg-indigo-50 text-indigo-700" },
  { value: "delivery_act_draft_ready", label: "Acta en borrador", accent: "bg-amber-50 text-amber-700" },
  { value: "delivery_act_tech_assigned", label: "Tecnico asignado", accent: "bg-yellow-50 text-yellow-700" },
  { value: "delivery_act_logistics_signed", label: "Acta firmada por logistica", accent: "bg-blue-50 text-blue-700" },
  { value: "delivery_act_generated", label: "Acta generada", accent: "bg-indigo-50 text-indigo-700" },
  { value: "delivered_signed", label: "Entregado", accent: "bg-green-50 text-green-700" },
  { value: "business_case_in_progress", label: "BC en llenado", accent: "bg-purple-50 text-purple-700" },
  { value: "business_case_under_review", label: "BC en revision", accent: "bg-purple-50 text-purple-700" },
  { value: "business_case_feasibility_approved", label: "BC aprobado", accent: "bg-purple-50 text-purple-700" },
  { value: "business_case_rejected", label: "BC rechazado", accent: "bg-rose-50 text-rose-700" },
  { value: "rejected", label: "Rechazada", accent: "bg-rose-50 text-rose-700" },
];

// Códigos de error BE que maneja FE
export const PRIVATE_PURCHASE_ERROR_CODES = {
  DOCS_INCOMPLETE_FOR_GERENCIA: 'DOCS_INCOMPLETE_FOR_GERENCIA',
  DOC_ALREADY_EXISTS: 'DOC_ALREADY_EXISTS',
  GERENCIA_REJECTION_REASON_REQUIRED: 'GERENCIA_REJECTION_REASON_REQUIRED',
  INSPECTION_REQUIRED: 'INSPECTION_REQUIRED',
  INSPECTION_COORDINATION_REQUIRED: 'INSPECTION_COORDINATION_REQUIRED',
};

// Mensajes de error para UI
export const PRIVATE_PURCHASE_ERROR_MESSAGES = {
  [PRIVATE_PURCHASE_ERROR_CODES.DOCS_INCOMPLETE_FOR_GERENCIA]: 'Faltan documentos requeridos para enviar a gerencia',
  [PRIVATE_PURCHASE_ERROR_CODES.DOC_ALREADY_EXISTS]: 'Ya existe un documento de este tipo',
  [PRIVATE_PURCHASE_ERROR_CODES.INSPECTION_REQUIRED]: 'Debe solicitar inspeccion de ambiente antes de subir el contrato',
  [PRIVATE_PURCHASE_ERROR_CODES.INSPECTION_COORDINATION_REQUIRED]:
    'Debes coordinar la fecha de inspección antes de subir el contrato',
};

// Estados que requieren validación de documentos para gerencia
export const STATES_REQUIRING_DOCS_CHECK = [
  'offer_signed',
  'client_registered',
  'inspection_requested',
  'contract_rejected'
];

// Acciones críticas del flujo
export const PRIVATE_PURCHASE_ACTIONS = {
  SEND_TO_GERENCIA: 'send_to_gerencia',
  UPLOAD_SIGNED_OFFER: 'upload_signed_offer',
  UPLOAD_CONTRACT: 'upload_contract',
  REGISTER_CLIENT: 'register_client',
  SEND_TO_ACP: 'send_to_acp',
  REQUEST_DELIVERY_DATES: 'request_delivery_dates',
  SUBMIT_DELIVERY_DATES: 'submit_delivery_dates'
};
