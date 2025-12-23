import {
  FiUserPlus,
  FiCreditCard,
  FiUsers,
  FiClipboard,
  FiTruck,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle
} from "react-icons/fi";

/**
 * Configuración centralizada de tipos de solicitud
 * Usada por todos los componentes de solicitudes para mantener consistencia
 */
export const REQUEST_TYPES_CONFIG = {
  cliente: {
    id: 'cliente',
    label: "Registrar Cliente",
    title: "Solicitudes de Clientes",
    icon: FiUserPlus,
    color: "emerald",
    subtitle: "Clientes",
    bgClass: "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800",
    iconBgClass: "bg-emerald-100 text-emerald-600",
    emptyMessage: "No has registrado solicitudes de clientes"
  },
  compra: {
    id: 'compra',
    label: "Requerimientos",
    title: "Requerimientos de Compra",
    icon: FiCreditCard,
    color: "indigo",
    subtitle: "Compras",
    bgClass: "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800",
    iconBgClass: "bg-indigo-100 text-indigo-600",
    emptyMessage: "No has creado requerimientos de compra"
  },
  permisos: {
    id: 'permisos',
    label: "Permisos y Vacaciones",
    title: "Permisos y Vacaciones",
    icon: FiUsers,
    color: "orange",
    subtitle: "Talento Humano",
    bgClass: "bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800",
    iconBgClass: "bg-orange-100 text-orange-600",
    emptyMessage: "No has solicitado permisos"
  },
  inspection: {
    id: 'inspection',
    label: "Inspecciones Técnicas",
    title: "Inspecciones Técnicas",
    icon: FiClipboard,
    color: "blue",
    subtitle: "Inspecciones",
    bgClass: "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800",
    iconBgClass: "bg-blue-100 text-blue-600",
    emptyMessage: "No has solicitado inspecciones técnicas"
  },
  retiro: {
    id: 'retiro',
    label: "Retiros y Devoluciones",
    title: "Retiros y Devoluciones",
    icon: FiTruck,
    color: "amber",
    subtitle: "Retiros",
    bgClass: "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800",
    iconBgClass: "bg-amber-100 text-amber-600",
    emptyMessage: "No has solicitado retiros de equipos"
  }
};

/**
 * Configuración centralizada de KPIs
 * Estructura reutilizable para cards de estadísticas
 */
export const KPI_CONFIG = [
  {
    title: "Total Solicitudes",
    value: "total",
    subtitle: "Gestiones activas",
    icon: FiClipboard,
    colors: "from-blue-50 via-blue-100 to-blue-200",
    borderColor: "border-blue-500",
    shadowColor: "shadow-blue-100/50",
    iconBg: "bg-blue-600",
    textColor: "text-blue-800",
    valueColor: "text-blue-900"
  },
  {
    title: "Aprobadas",
    value: "approved",
    subtitle: (stats) => `${stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}% de éxito`,
    icon: FiCheckCircle,
    colors: "from-green-50 via-green-100 to-green-200",
    borderColor: "border-green-500",
    shadowColor: "shadow-green-100/50",
    iconBg: "bg-green-600",
    textColor: "text-green-800",
    valueColor: "text-green-900"
  },
  {
    title: "En Proceso",
    value: "pending",
    subtitle: "Pendientes de revisión",
    icon: FiClock,
    colors: "from-yellow-50 via-yellow-100 to-yellow-200",
    borderColor: "border-yellow-500",
    shadowColor: "shadow-yellow-100/50",
    iconBg: "bg-yellow-600",
    textColor: "text-yellow-800",
    valueColor: "text-yellow-900"
  },
  {
    title: "Rechazadas",
    value: "rejected",
    subtitle: "Requieren corrección",
    icon: FiAlertTriangle,
    colors: "from-red-50 via-red-100 to-red-200",
    borderColor: "border-red-500",
    shadowColor: "shadow-red-100/50",
    iconBg: "bg-red-600",
    textColor: "text-red-800",
    valueColor: "text-red-900"
  }
];

/**
 * Funciones utilitarias para estados de solicitud
 */
export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'approved':
    case 'aprobada':
    case 'completed':
      return 'text-green-600 bg-green-50';
    case 'pending':
    case 'pendiente':
    case 'in_progress':
      return 'text-yellow-600 bg-yellow-50';
    case 'rejected':
    case 'rechazada':
    case 'cancelled':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

export const getStatusIcon = (status) => {
  switch (status?.toLowerCase()) {
    case 'approved':
    case 'aprobada':
    case 'completed':
      return <FiCheckCircle className="w-4 h-4" />;
    case 'pending':
    case 'pendiente':
    case 'in_progress':
      return <FiClock className="w-4 h-4" />;
    case 'rejected':
    case 'rechazada':
    case 'cancelled':
      return <FiAlertTriangle className="w-4 h-4" />;
    default:
      return <FiAlertTriangle className="w-4 h-4" />;
  }
};

export const formatDate = (dateString) => {
  if (!dateString) return 'Fecha desconocida';
  try {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return 'Fecha desconocida';
  }
};

/**
 * Funciones helper para determinar acciones disponibles por rol
 */
export const getAvailableActions = (user) => {
  const roleName = (user?.role_name || user?.role || "").toLowerCase();
  const isACP = roleName.includes('acp');

  const baseActions = ["cliente", "compra", "permisos"];
  const acpActions = ["cliente", "compra", "permisos"];
  const fullActions = ["inspection", "retiro", ...baseActions];

  const availableActionIds = isACP ? acpActions : fullActions;

  return availableActionIds.map(id => REQUEST_TYPES_CONFIG[id]).filter(Boolean);
};

export const getRequestViewComponent = (user) => {
  const roleName = (user?.role_name || user?.role || "").toLowerCase();
  const isACP = roleName.includes('acp');

  // Aquí se podría importar dinámicamente si fuera necesario
  return isACP ? 'ACPComercialSolicitudesView' : 'ComercialSolicitudesView';
};
