import { FiClock, FiUpload, FiCheck, FiX } from "react-icons/fi";

export const STATUS_META = {
  pending: { label: "Pendiente", color: "bg-amber-100 text-amber-800", icon: FiClock },
  partially_approved: { label: "Subir docs", color: "bg-blue-100 text-blue-800", icon: FiUpload },
  pending_final: { label: "Esperando final", color: "bg-purple-100 text-purple-800", icon: FiClock },
  approved: { label: "Aprobado", color: "bg-green-100 text-green-800", icon: FiCheck },
  rejected: { label: "Rechazado", color: "bg-red-100 text-red-800", icon: FiX },
};

export const formatDateShort = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
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
