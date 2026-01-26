// Private Purchases Widget Constants
// Extracted from PrivatePurchases.jsx for better maintainability
// Based on EquipmentPurchaseWidget.constants.js structure

export const PRIVATE_PURCHASE_STATUS_CONFIG = {
    pending_commercial: {
        label: "Pendiente Asesor",
        iconName: "FiClock",
        ledColor: "bg-amber-500",
        ledGlow: "shadow-lg shadow-amber-500/50",
        cardBg: "bg-gradient-to-br from-white via-amber-50 to-white",
        cardBorder: "border-l-4 border-amber-400",
        cardShadow: "shadow-amber-200/60",
        badgeBg: "bg-amber-100",
        badgeText: "text-amber-800"
    },
    pending_backoffice: {
        label: "Pendiente BackOffice",
        iconName: "FiClock",
        ledColor: "bg-blue-500",
        ledGlow: "shadow-lg shadow-blue-500/50",
        cardBg: "bg-gradient-to-br from-white via-blue-50 to-white",
        cardBorder: "border-l-4 border-blue-400",
        cardShadow: "shadow-blue-200/60",
        badgeBg: "bg-blue-100",
        badgeText: "text-blue-800"
    },
    offer_sent: {
        label: "Oferta Enviada",
        iconName: "FiMail",
        ledColor: "bg-indigo-500",
        ledGlow: "shadow-lg shadow-indigo-500/50",
        cardBg: "bg-gradient-to-br from-white via-indigo-50 to-white",
        cardBorder: "border-l-4 border-indigo-400",
        cardShadow: "shadow-indigo-200/60",
        badgeBg: "bg-indigo-100",
        badgeText: "text-indigo-800"
    },
    offer_signed: {
        label: "Oferta Firmada",
        iconName: "FiFileText",
        ledColor: "bg-emerald-500",
        ledGlow: "shadow-lg shadow-emerald-500/50",
        cardBg: "bg-gradient-to-br from-white via-emerald-50 to-white",
        cardBorder: "border-l-4 border-emerald-400",
        cardShadow: "shadow-emerald-200/60",
        badgeBg: "bg-emerald-100",
        badgeText: "text-emerald-800"
    },
    client_registration_requested: {
        label: "Cliente no registrado",
        iconName: "FiUsers",
        ledColor: "bg-cyan-500",
        ledGlow: "shadow-lg shadow-cyan-500/50",
        cardBg: "bg-gradient-to-br from-white via-cyan-50 to-white",
        cardBorder: "border-l-4 border-cyan-400",
        cardShadow: "shadow-cyan-200/60",
        badgeBg: "bg-cyan-100",
        badgeText: "text-cyan-800"
    },
    client_registered: {
        label: "Cliente Registrado",
        iconName: "FiUsers",
        ledColor: "bg-green-500",
        ledGlow: "shadow-lg shadow-green-500/50",
        cardBg: "bg-gradient-to-br from-white via-green-50 to-white",
        cardBorder: "border-l-4 border-green-400",
        cardShadow: "shadow-green-200/60",
        badgeBg: "bg-green-100",
        badgeText: "text-green-800"
    },
    inspection_requested: {
        label: "Inspeccion Solicitada",
        iconName: "FiSearch",
        ledColor: "bg-amber-500",
        ledGlow: "shadow-lg shadow-amber-500/50",
        cardBg: "bg-gradient-to-br from-white via-amber-50 to-white",
        cardBorder: "border-l-4 border-amber-400",
        cardShadow: "shadow-amber-200/60",
        badgeBg: "bg-amber-100",
        badgeText: "text-amber-800"
    },
    sent_to_acp: {
        label: "Enviada a ACP",
        iconName: "FiMail",
        ledColor: "bg-purple-500",
        ledGlow: "shadow-lg shadow-purple-500/50",
        cardBg: "bg-gradient-to-br from-white via-purple-50 to-white",
        cardBorder: "border-l-4 border-purple-400",
        cardShadow: "shadow-purple-200/60",
        badgeBg: "bg-purple-100",
        badgeText: "text-purple-800"
    },
    acp_availability_requested: {
        label: "Disponibilidad solicitada",
        iconName: "FiClock",
        ledColor: "bg-purple-500",
        ledGlow: "shadow-lg shadow-purple-500/50",
        cardBg: "bg-gradient-to-br from-white via-purple-50 to-white",
        cardBorder: "border-l-4 border-purple-400",
        cardShadow: "shadow-purple-200/60",
        badgeBg: "bg-purple-100",
        badgeText: "text-purple-800"
    },
    acp_availability_confirmed: {
        label: "Disponibilidad confirmada",
        iconName: "FiCheckCircle",
        ledColor: "bg-emerald-500",
        ledGlow: "shadow-lg shadow-emerald-500/50",
        cardBg: "bg-gradient-to-br from-white via-emerald-50 to-white",
        cardBorder: "border-l-4 border-emerald-400",
        cardShadow: "shadow-emerald-200/60",
        badgeBg: "bg-emerald-100",
        badgeText: "text-emerald-800"
    },
    acp_availability_rejected: {
        label: "Disponibilidad rechazada",
        iconName: "FiX",
        ledColor: "bg-rose-500",
        ledGlow: "shadow-lg shadow-rose-500/50",
        cardBg: "bg-gradient-to-br from-white via-rose-50 to-white",
        cardBorder: "border-l-4 border-rose-400",
        cardShadow: "shadow-rose-200/60",
        badgeBg: "bg-rose-100",
        badgeText: "text-rose-800"
    },
    pending_contract_client_signature: {
        label: "Firma cliente pendiente",
        iconName: "FiFileText",
        ledColor: "bg-amber-500",
        ledGlow: "shadow-lg shadow-amber-500/50",
        cardBg: "bg-gradient-to-br from-white via-amber-50 to-white",
        cardBorder: "border-l-4 border-amber-400",
        cardShadow: "shadow-amber-200/60",
        badgeBg: "bg-amber-100",
        badgeText: "text-amber-800"
    },
    pending_contract_approval: {
        label: "Pendiente Aprobación",
        iconName: "FiFileText",
        ledColor: "bg-orange-500",
        ledGlow: "shadow-lg shadow-orange-500/50",
        cardBg: "bg-gradient-to-br from-white via-orange-50 to-white",
        cardBorder: "border-l-4 border-orange-400",
        cardShadow: "shadow-orange-200/60",
        badgeBg: "bg-orange-100",
        badgeText: "text-orange-800"
    },
    contract_available: {
        label: "Contrato Disponible",
        iconName: "FiFileText",
        ledColor: "bg-amber-500",
        ledGlow: "shadow-lg shadow-amber-500/50",
        cardBg: "bg-gradient-to-br from-white via-amber-50 to-white",
        cardBorder: "border-l-4 border-amber-400",
        cardShadow: "shadow-amber-200/60",
        badgeBg: "bg-amber-100",
        badgeText: "text-amber-800"
    },
    delivery_dates_requested: {
        label: "Fecha Solicitada",
        iconName: "FiClock",
        ledColor: "bg-orange-500",
        ledGlow: "shadow-lg shadow-orange-500/50",
        cardBg: "bg-gradient-to-br from-white via-orange-50 to-white",
        cardBorder: "border-l-4 border-orange-400",
        cardShadow: "shadow-orange-200/60",
        badgeBg: "bg-orange-100",
        badgeText: "text-orange-800"
    },
    delivery_dates_submitted: {
        label: "Fecha Definida",
        iconName: "FiCheckCircle",
        ledColor: "bg-teal-500",
        ledGlow: "shadow-lg shadow-teal-500/50",
        cardBg: "bg-gradient-to-br from-white via-teal-50 to-white",
        cardBorder: "border-l-4 border-teal-400",
        cardShadow: "shadow-teal-200/60",
        badgeBg: "bg-teal-100",
        badgeText: "text-teal-800"
    },
    waiting_dispatch: {
        label: "Esperando Despacho",
        iconName: "FiPackage",
        ledColor: "bg-indigo-500",
        ledGlow: "shadow-lg shadow-indigo-500/50",
        cardBg: "bg-gradient-to-br from-white via-indigo-50 to-white",
        cardBorder: "border-l-4 border-indigo-400",
        cardShadow: "shadow-indigo-200/60",
        badgeBg: "bg-indigo-100",
        badgeText: "text-indigo-800"
    },
    dispatch_ready: {
        label: "Despacho Listo",
        iconName: "FiPackage",
        ledColor: "bg-indigo-600",
        ledGlow: "shadow-lg shadow-indigo-600/50",
        cardBg: "bg-gradient-to-br from-white via-indigo-50 to-white",
        cardBorder: "border-l-4 border-indigo-500",
        cardShadow: "shadow-indigo-200/60",
        badgeBg: "bg-indigo-100",
        badgeText: "text-indigo-800"
    },
    delivery_act_draft_ready: {
        label: "Acta en Borrador",
        iconName: "FiFileText",
        ledColor: "bg-amber-500",
        ledGlow: "shadow-lg shadow-amber-500/50",
        cardBg: "bg-gradient-to-br from-white via-amber-50 to-white",
        cardBorder: "border-l-4 border-amber-400",
        cardShadow: "shadow-amber-200/60",
        badgeBg: "bg-amber-100",
        badgeText: "text-amber-800"
    },
    delivery_act_tech_assigned: {
        label: "Tecnico Asignado",
        iconName: "FiUser",
        ledColor: "bg-yellow-500",
        ledGlow: "shadow-lg shadow-yellow-500/50",
        cardBg: "bg-gradient-to-br from-white via-yellow-50 to-white",
        cardBorder: "border-l-4 border-yellow-400",
        cardShadow: "shadow-yellow-200/60",
        badgeBg: "bg-yellow-100",
        badgeText: "text-yellow-800"
    },
    delivery_act_logistics_signed: {
        label: "Acta Firmada por Logistica",
        iconName: "FiPenTool",
        ledColor: "bg-blue-500",
        ledGlow: "shadow-lg shadow-blue-500/50",
        cardBg: "bg-gradient-to-br from-white via-blue-50 to-white",
        cardBorder: "border-l-4 border-blue-400",
        cardShadow: "shadow-blue-200/60",
        badgeBg: "bg-blue-100",
        badgeText: "text-blue-800"
    },
    delivery_act_generated: {
        label: "Acta Generada",
        iconName: "FiFileText",
        ledColor: "bg-indigo-600",
        ledGlow: "shadow-lg shadow-indigo-600/50",
        cardBg: "bg-gradient-to-br from-white via-indigo-50 to-white",
        cardBorder: "border-l-4 border-indigo-500",
        cardShadow: "shadow-indigo-200/60",
        badgeBg: "bg-indigo-100",
        badgeText: "text-indigo-800"
    },
    contract_rejected: {
        label: "Contrato Rechazado",
        iconName: "FiX",
        ledColor: "bg-red-500",
        ledGlow: "shadow-lg shadow-red-500/50",
        cardBg: "bg-gradient-to-br from-white via-red-50 to-white",
        cardBorder: "border-l-4 border-red-500",
        cardShadow: "shadow-red-200/60",
        badgeBg: "bg-red-100",
        badgeText: "text-red-800"
    },
    delivered_signed: {
        label: "Entregado",
        iconName: "FiCheckCircle",
        ledColor: "bg-green-600",
        ledGlow: "shadow-lg shadow-green-600/50",
        cardBg: "bg-gradient-to-br from-white via-emerald-50 to-white",
        cardBorder: "border-l-4 border-emerald-500",
        cardShadow: "shadow-emerald-200/60",
        badgeBg: "bg-emerald-100",
        badgeText: "text-emerald-800"
    },
    rejected: {
        label: "Cancelado",
        iconName: "FiX",
        ledColor: "bg-gray-500",
        ledGlow: "shadow-lg shadow-gray-500/50",
        cardBg: "bg-gradient-to-br from-white via-gray-50 to-white",
        cardBorder: "border-l-4 border-gray-400",
        cardShadow: "shadow-gray-200/60",
        badgeBg: "bg-gray-100",
        badgeText: "text-gray-800"
    }
};

// Equipment type labels for private purchases
export const PRIVATE_PURCHASE_EQUIPMENT_TYPE_LABELS = {
    new: "Nuevo",
    cu: "CU",
    comodato: "Comodato"
};

// Decision labels for equipment items
export const PRIVATE_PURCHASE_DECISION_LABELS = {
    accept: "Aceptar producto",
    reject: "Rechazar producto"
};

// Form validation messages
export const PRIVATE_PURCHASE_VALIDATION_MESSAGES = {
    clientRequired: "Cliente y equipos son obligatorios",
    fileRequired: "Selecciona un archivo",
    datesRequired: "Archivo y fechas son obligatorios"
};

// Modal titles
export const PRIVATE_PURCHASE_MODAL_TITLES = {
    offerUpload: "Enviar oferta",
    signedUpload: "Subir oferta firmada",
    detailView: "Detalle de solicitud privada",
    processing: {
        offerUpload: "Enviando oferta",
        signedUpload: "Subiendo oferta firmada",
        clientRegistration: "Registrando cliente",
        sendingToAcp: "Enviando a ACP",
        resubmit: "Reenviando a gerencia"
    }
};

// Processing steps
export const PRIVATE_PURCHASE_PROCESSING_STEPS = {
    offerUpload: { id: "offer_upload", label: "Subiendo oferta" },
    signedUpload: { id: "signed_upload", label: "Subiendo oferta firmada" },
    clientRegistration: { id: "client_registration", label: "Registrando cliente" },
    sendingToAcp: { id: "send_to_acp", label: "Enviando a ACP" },
    resubmit: { id: "resubmit", label: "Reenviando a gerencia" },
    acpSendEmail: { id: "acp_send_email", label: "Enviando correo proveedor" },
    acpResponse: { id: "acp_response", label: "Registrando respuesta proveedor" },
    availabilityAccept: { id: "availability_accept", label: "Aceptando disponibilidad" },
    availabilityReject: { id: "availability_reject", label: "Rechazando disponibilidad" }
};

// File input labels
export const PRIVATE_PURCHASE_FILE_LABELS = {
    offer: "Archivo de oferta (PDF, PNG o JPG)",
    signedOffer: "Oferta firmada (PDF, PNG o JPG)"
};

// Success messages
export const PRIVATE_PURCHASE_SUCCESS_MESSAGES = {
    offerUploaded: "Oferta registrada y enviada",
    signedOfferUploaded: "Oferta firmada registrada",
    clientRegistered: "Cliente marcado como registrado",
    sentToAcp: "Solicitud enviada a ACP",
    resubmitted: "Solicitud reenviada a gerencia para revisión"
};

// Empty state messages
export const PRIVATE_PURCHASE_EMPTY_STATES = {
    noRequests: "No hay solicitudes privadas registradas",
    noEquipment: "No hay equipos registrados"
};

// Loading messages
export const PRIVATE_PURCHASE_LOADING_MESSAGES = {
    updating: "Actualizando...",
    processing: "Procesando...",
    loadingRequests: "Cargando solicitudes..."
};

// Accessibility labels
export const PRIVATE_PURCHASE_ARIA_LABELS = {
    expandRequest: (expanded) => expanded ? "Mostrar menos" : "Mostrar más",
    clientInfo: "Información del cliente",
    equipmentList: "Lista de equipos",
    statusBadge: "Estado de la solicitud",
    actionsMenu: "Acciones disponibles",
    searchRequests: "Buscar solicitudes por cliente o estado"
};
