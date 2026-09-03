import { FiClock, FiUpload, FiCheck, FiX } from "react-icons/fi";

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export const STATUS_META = {
  pending: { label: "Pendiente", color: "bg-amber-100 text-amber-800", icon: FiClock },
  partially_approved: { label: "Subir docs", color: "bg-blue-100 text-blue-800", icon: FiUpload },
  pending_final: { label: "Esperando final", color: "bg-purple-100 text-purple-800", icon: FiClock },
  approved: { label: "Aprobado", color: "bg-green-100 text-green-800", icon: FiCheck },
  aprobado: { label: "Aprobado", color: "bg-green-100 text-green-800", icon: FiCheck },
  rejected: { label: "Rechazado", color: "bg-red-100 text-red-800", icon: FiX },
  rechazado: { label: "Rechazado", color: "bg-red-100 text-red-800", icon: FiX },
  cancelled: { label: "Cancelado", color: "bg-gray-200 text-gray-800", icon: FiX },
  cancelado: { label: "Cancelado", color: "bg-gray-200 text-gray-800", icon: FiX },
};

export const formatDateShort = (date) => {
  if (!date) return "N/A";
  const text = String(date);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day).toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
};

export const formatCalendarDate = (date, options = {}) => {
  if (!date) return "N/A";
  const text = String(date).trim();
  const match = text.match(DATE_ONLY_REGEX);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day).toLocaleDateString("es-EC", options);
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString("es-EC", options);
};

const toCalendarUtcMs = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(DATE_ONLY_REGEX);
  if (match) {
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

export const calculateInclusiveCalendarDays = (startValue, endValue) => {
  const startMs = toCalendarUtcMs(startValue);
  const endMs = toCalendarUtcMs(endValue);
  if (startMs === null || endMs === null) return 0;
  const diff = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : 0;
};

export const getTipoLabel = (solicitud = {}) => {
  if (solicitud.tipo_solicitud === "vacaciones") return "Vacaciones";
  const tipos = {
    estudios: "Estudios",
    personal: "Personal",
    salud: "Salud",
    calamidad: "Calamidad",
  };
  return tipos[solicitud.tipo_permiso] || "Permiso";
};

export const hasJustificantes = (solicitud = {}) =>
  Array.isArray(solicitud.justificantes_urls) && solicitud.justificantes_urls.length > 0;

export const hasExternalCoordinationEvidence = (solicitud = {}) =>
  Array.isArray(solicitud.external_coordination_urls) && solicitud.external_coordination_urls.length > 0;

export const JUSTIFICANTE_STATUS_META = {
  pendiente: {
    label: "Justificante pendiente de revisión",
    bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900",
  },
  observado: {
    label: "Justificante con observaciones — resubmite los documentos",
    bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900",
  },
  aceptado: {
    label: "Justificante aceptado",
    bg: "bg-green-50", border: "border-green-200", text: "text-green-900",
  },
  vencido: {
    label: "Plazo de justificante vencido",
    bg: "bg-red-50", border: "border-red-200", text: "text-red-900",
  },
  rechazado: {
    label: "Justificante rechazado",
    bg: "bg-red-50", border: "border-red-200", text: "text-red-900",
  },
};

export const ESCALATION_STATUS_META = {
  reminder_sent: {
    label: "Recordatorio enviado al jefe",
    badge: "bg-orange-100 text-orange-800 border-orange-200",
  },
  escalated: {
    label: "Escalado a Talento Humano",
    badge: "bg-rose-100 text-rose-800 border-rose-200",
  },
};

export const PROVISIONAL_STATUS_META = {
  salida_provisional_autorizada: {
    label: "Salida provisional autorizada",
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-900",
  },
  procedente: {
    label: "Procedente — pendiente aprobación final",
    badge: "bg-teal-100 text-teal-800 border-teal-200",
    bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-900",
  },
  pendiente_regularizacion: {
    label: "Pendiente de regularización",
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-900",
  },
  rechazado_formalmente: {
    label: "Rechazado formalmente",
    badge: "bg-red-100 text-red-800 border-red-200",
    bg: "bg-red-50", border: "border-red-200", text: "text-red-900",
  },
  aceptado_por_excepcion: {
    label: "Aceptado por excepción",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900",
  },
  convertido_a_vacaciones: {
    label: "Convertido a vacaciones",
    badge: "bg-purple-100 text-purple-800 border-purple-200",
    bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-900",
  },
};
