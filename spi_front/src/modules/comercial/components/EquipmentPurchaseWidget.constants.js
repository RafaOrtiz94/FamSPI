// Equipment Purchase Widget Constants
// Extracted from EquipmentPurchaseWidget.jsx for better maintainability

export const STATUS_CONFIG = {
    pending_provider_assignment: {
        label: "Pendiente datos de proveedor (ACP)",
        iconName: "FiClock",
        ledColor: "bg-slate-400",
        ledGlow: "shadow-lg shadow-slate-300/50",
        cardBg: "bg-gradient-to-br from-white via-slate-50 to-white",
        cardBorder: "border-l-4 border-slate-300",
        cardShadow: "shadow-slate-200/60",
        badgeBg: "bg-slate-100",
        badgeText: "text-slate-700",
    },
    waiting_provider_response: {
        label: "Esperando respuesta de proveedor",
        iconName: "FiClock",
        ledColor: "bg-amber-500",
        ledGlow: "shadow-lg shadow-amber-500/50",
        cardBg: "bg-gradient-to-br from-white via-amber-50 to-white",
        cardBorder: "border-l-4 border-amber-400",
        cardShadow: "shadow-amber-200/60",
        badgeBg: "bg-amber-100",
        badgeText: "text-amber-800"
    },
    no_stock: {
        label: "Sin stock",
        iconName: "FiAlertCircle",
        ledColor: "bg-rose-500",
        ledGlow: "shadow-lg shadow-rose-500/50",
        cardBg: "bg-gradient-to-br from-white via-rose-50 to-white",
        cardBorder: "border-l-4 border-rose-500",
        cardShadow: "shadow-rose-200/60",
        badgeBg: "bg-rose-100",
        badgeText: "text-rose-800"
    },
    waiting_proforma: {
        label: "Solicitando proforma",
        iconName: "FiMail",
        ledColor: "bg-sky-500",
        ledGlow: "shadow-lg shadow-sky-500/50",
        cardBg: "bg-gradient-to-br from-white via-sky-50 to-white",
        cardBorder: "border-l-4 border-sky-400",
        cardShadow: "shadow-sky-200/60",
        badgeBg: "bg-sky-100",
        badgeText: "text-sky-800"
    },
    proforma_received: {
        label: "Proforma recibida",
        iconName: "FiFileText",
        ledColor: "bg-indigo-500",
        ledGlow: "shadow-lg shadow-indigo-500/50",
        cardBg: "bg-gradient-to-br from-white via-indigo-50 to-white",
        cardBorder: "border-l-4 border-indigo-400",
        cardShadow: "shadow-indigo-200/60",
        badgeBg: "bg-indigo-100",
        badgeText: "text-indigo-800"
    },
    waiting_signed_proforma: {
        label: "Esperando proforma firmada",
        iconName: "FiFileText",
        ledColor: "bg-violet-500",
        ledGlow: "shadow-lg shadow-violet-500/50",
        cardBg: "bg-gradient-to-br from-white via-violet-50 to-white",
        cardBorder: "border-l-4 border-violet-400",
        cardShadow: "shadow-violet-200/60",
        badgeBg: "bg-violet-100",
        badgeText: "text-violet-800"
    },
    pending_contract: {
        label: "Pendiente contrato",
        iconName: "FiFileText",
        ledColor: "bg-orange-500",
        ledGlow: "shadow-lg shadow-orange-500/50",
        cardBg: "bg-gradient-to-br from-white via-orange-50 to-white",
        cardBorder: "border-l-4 border-orange-400",
        cardShadow: "shadow-orange-200/60",
        badgeBg: "bg-orange-100",
        badgeText: "text-orange-800"
    },
    completed: {
        label: "Completado",
        iconName: "FiCheckCircle",
        ledColor: "bg-green-500",
        ledGlow: "shadow-lg shadow-green-500/50",
        cardBg: "bg-gradient-to-br from-white via-emerald-50 to-white",
        cardBorder: "border-l-4 border-emerald-500",
        cardShadow: "shadow-emerald-200/60",
        badgeBg: "bg-emerald-100",
        badgeText: "text-emerald-800"
    },
};

// Equipment type labels
export const EQUIPMENT_TYPE_LABELS = {
    new: "Nuevo",
    cu: "CU",
    none: "Sin stock"
};

// Decision labels for equipment items
export const DECISION_LABELS = {
    accept: "Aceptar producto",
    reject: "Rechazar producto"
};

// Form validation messages
export const VALIDATION_MESSAGES = {
    clientRequired: "Cliente y equipos son obligatorios",
    acpRequired: "Debes asignar la solicitud a un ACP Comercial",
    providerRequired: "Debes ingresar el correo del proveedor",
    fileRequired: "Selecciona un archivo",
    datesRequired: "Archivo y fechas son obligatorios"
};

// Modal titles
export const MODAL_TITLES = {
    providerResponse: "Respuesta del proveedor",
    inspectionRequest: "Solicitud de Inspección de Ambiente",
    processing: {
        providerResponse: "Enviando respuesta al proveedor",
        proformaRequest: "Solicitando proforma",
        fileUpload: (type) => `Enviando ${type}`,
        reservation: "Enviando reserva",
        availability: "Enviando correo de disponibilidad"
    }
};

// Processing steps
export const PROCESSING_STEPS = {
    response: { id: "response", label: "Registrando respuesta" },
    proforma: { id: "proforma", label: "Solicitando proforma" },
    proformaUpload: { id: "proforma", label: "Subiendo proforma" },
    signedUpload: { id: "signed", label: "Subiendo proforma firmada" },
    contractUpload: { id: "contract", label: "Subiendo contrato" },
    reserve: { id: "reserve", label: "Enviando reserva" },
    availability: { id: "availability", label: "Enviando correo de disponibilidad" },
    inspection: { id: "inspection", label: "Enviando inspección" }
};

// File input labels
export const FILE_LABELS = {
    proforma: "Elegir archivo",
    contract: "Elegir contrato",
    signedProforma: "Proforma firmada"
};

// Success messages
export const SUCCESS_MESSAGES = {
    requestCreated: (hasProvider) =>
        hasProvider
            ? "Solicitud creada y correo enviado al proveedor"
            : "Solicitud creada y enviada a ACP Comercial para gestionar proveedor",
    responseSaved: "Respuesta registrada",
    proformaRequested: "Proforma solicitada",
    fileUploaded: "Archivo cargado",
    reservationSent: "Reserva enviada y recordatorio agendado",
    availabilitySent: "Correo de disponibilidad enviado",
    inspectionCreated: "Proforma subida e inspección creada exitosamente"
};

// Empty state messages
export const EMPTY_STATES = {
    noRequests: "Sin solicitudes registradas",
    noEquipment: "No hay equipos disponibles",
    noClients: "No hay clientes disponibles",
    noAcpUsers: "Sin ACP disponibles"
};

// Loading messages
export const LOADING_MESSAGES = {
    updating: "Actualizando...",
    processing: "Procesando..."
};

// Accessibility labels
export const ARIA_LABELS = {
    expandRequest: (expanded) => expanded ? "Mostrar menos" : "Mostrar más",
    providerEmail: "Correo electrónico del proveedor",
    clientSelection: "Seleccionar cliente",
    equipmentSelection: "Seleccionar equipos",
    acpAssignment: "Asignar a ACP Comercial",
    notesInput: "Notas adicionales",
    searchRequests: "Buscar cliente o proveedor"
};
