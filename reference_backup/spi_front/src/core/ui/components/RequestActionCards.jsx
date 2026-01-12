import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FiUserPlus,
  FiShoppingCart,
  FiBriefcase,
  FiFileText,
  FiTool,
  FiCalendar,
  FiCpu,
  FiPlus,
  FiArrowRight
} from "react-icons/fi";
import Card from "./Card";
import Button from "./Button";
import { useRequestModals } from "../../hooks/useRequestModals";
import {
  PermissionRequestModal,
  MaintenanceRequestModal,
  PrivatePurchaseRequestModal,
  EquipmentRequestModal,
  BusinessCaseRequestModal
} from "./RequestModals";

/**
 * RequestActionCards Component
 * ------------------------------------------------------------------
 * Componentes premium para acciones de solicitud en cada página
 * Diseño empresarial con cards y botones elegantes
 */

// ============================================================================
// 🎯 TIPOS DE SOLICITUDES PREDEFINIDOS
// ============================================================================

const REQUEST_TYPES = {
  // Clientes
  CLIENT: {
    title: "Nuevo Cliente",
    description: "Crear solicitud para añadir un nuevo cliente al sistema",
    icon: FiUserPlus,
    path: "/dashboard/comercial/new-client-request",
    color: "blue",
    gradient: "from-blue-500 to-blue-600",
    bgGradient: "from-blue-50 to-blue-100",
    textColor: "text-blue-700"
  },

  // Compras Públicas (ACP)
  PUBLIC_PURCHASE: {
    title: "Compra Pública",
    description: "Solicitar adquisición de equipos o suministros vía ACP",
    icon: FiShoppingCart,
    path: "/dashboard/comercial/acp-compras",
    color: "emerald",
    gradient: "from-emerald-500 to-emerald-600",
    bgGradient: "from-emerald-50 to-emerald-100",
    textColor: "text-emerald-700"
  },

  // Compras Privadas
  PRIVATE_PURCHASE: {
    title: "Compra Privada",
    description: "Gestionar solicitudes de compras privadas",
    icon: FiBriefcase,
    path: "/dashboard/backoffice/private-purchases",
    color: "purple",
    gradient: "from-purple-500 to-purple-600",
    bgGradient: "from-purple-50 to-purple-100",
    textColor: "text-purple-700"
  },

  // Business Case
  BUSINESS_CASE: {
    title: "Business Case",
    description: "Crear análisis de viabilidad para nuevos proyectos",
    icon: FiFileText,
    path: "/dashboard/business-case/wizard",
    color: "indigo",
    gradient: "from-indigo-500 to-indigo-600",
    bgGradient: "from-indigo-50 to-indigo-100",
    textColor: "text-indigo-700"
  },

  // Mantenimiento
  MAINTENANCE: {
    title: "Mantenimiento",
    description: "Solicitar mantenimiento de equipos",
    icon: FiTool,
    path: "/dashboard/servicio-tecnico/mantenimientos",
    color: "orange",
    gradient: "from-orange-500 to-orange-600",
    bgGradient: "from-orange-50 to-orange-100",
    textColor: "text-orange-700"
  },

  // Permisos (redirige a página de permisos con modal)
  PERMISSION: {
    title: "Permiso/Vacación",
    description: "Solicitar permisos o vacaciones",
    icon: FiCalendar,
    path: "/dashboard/talento-humano/permisos",
    color: "teal",
    gradient: "from-teal-500 to-teal-600",
    bgGradient: "from-teal-50 to-teal-100",
    textColor: "text-teal-700"
  },

  // Equipos
  EQUIPMENT: {
    title: "Nuevo Equipo",
    description: "Solicitar adquisición de nuevo equipo",
    icon: FiCpu,
    path: "/dashboard/servicio-tecnico/equipos",
    color: "cyan",
    gradient: "from-cyan-500 to-cyan-600",
    bgGradient: "from-cyan-50 to-cyan-100",
    textColor: "text-cyan-700"
  }
};

// ============================================================================
// 🎨 COMPONENTE DE TARJETA PREMIUM
// ============================================================================

const RequestActionCard = ({
  type,
  size = "default",
  className = "",
  onClick
}) => {
  const navigate = useNavigate();
  const { openModal } = useRequestModals();
  const config = REQUEST_TYPES[type];

  if (!config) {
    console.warn(`RequestActionCard: Tipo '${type}' no encontrado`);
    return null;
  }

  const Icon = config.icon;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Para tipos específicos, abrir modal en lugar de navegar
      if (['PERMISSION', 'MAINTENANCE', 'PRIVATE_PURCHASE', 'EQUIPMENT', 'BUSINESS_CASE'].includes(type)) {
        openModal(type);
      } else {
        // Para otros tipos, navegar normalmente
        navigate(config.path);
      }
    }
  };

  if (size === "compact") {
    return (
      <motion.div
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
        className={`cursor-pointer ${className}`}
        onClick={handleClick}
      >
        <Card className={`p-4 bg-gradient-to-br ${config.bgGradient} border border-${config.color}-200 hover:shadow-lg transition-all duration-300`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient} text-white shadow-sm`}>
              <Icon size={18} />
            </div>
            <div className="flex-1">
              <h3 className={`font-semibold ${config.textColor} text-sm`}>
                {config.title}
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">
                {config.description}
              </p>
            </div>
            <FiArrowRight className={`${config.textColor} opacity-60`} size={16} />
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`cursor-pointer ${className}`}
      onClick={handleClick}
    >
      <Card className={`p-6 bg-gradient-to-br ${config.bgGradient} border border-${config.color}-200 hover:shadow-xl transition-all duration-300 relative overflow-hidden`}>
        {/* Decorative background pattern */}
        <div className="absolute top-0 right-0 w-20 h-20 opacity-10">
          <div className={`w-full h-full bg-gradient-to-br ${config.gradient} rounded-full transform translate-x-6 -translate-y-6`} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-3">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${config.gradient} text-white shadow-lg`}>
              <Icon size={24} />
            </div>
            <div className="flex-1">
              <h3 className={`font-bold ${config.textColor} text-lg`}>
                {config.title}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {config.description}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-2 text-sm font-medium ${config.textColor}`}>
              <FiPlus size={14} />
              Crear solicitud
            </span>
            <div className={`p-2 rounded-lg bg-white/60 ${config.textColor} hover:bg-white/80 transition-colors`}>
              <FiArrowRight size={16} />
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

// ============================================================================
// 🎯 COMPONENTE DE BOTÓN PREMIUM
// ============================================================================

const RequestActionButton = ({
  type,
  variant = "primary",
  size = "default",
  className = "",
  onClick
}) => {
  const navigate = useNavigate();
  const { openModal } = useRequestModals();
  const config = REQUEST_TYPES[type];

  if (!config) {
    console.warn(`RequestActionButton: Tipo '${type}' no encontrado`);
    return null;
  }

  const Icon = config.icon;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Para tipos específicos, abrir modal en lugar de navegar
      if (['PERMISSION', 'MAINTENANCE', 'PRIVATE_PURCHASE', 'EQUIPMENT', 'BUSINESS_CASE'].includes(type)) {
        openModal(type);
      } else {
        // Para otros tipos, navegar normalmente
        navigate(config.path);
      }
    }
  };

  const buttonSize = size === "sm" ? "py-2 px-4 text-sm" : "py-3 px-6 text-base";

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Button
        onClick={handleClick}
        className={`${buttonSize} bg-gradient-to-r ${config.gradient} hover:shadow-lg hover:shadow-${config.color}-500/25 font-semibold text-white border-0 ${className}`}
        icon={Icon}
      >
        {config.title}
      </Button>
    </motion.div>
  );
};

// ============================================================================
// 🎨 COMPONENTE DE GRID PARA MÚLTIPLES ACCIONES
// ============================================================================

const RequestActionGrid = ({
  actions = [],
  columns = 2,
  size = "default",
  className = ""
}) => {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
  };

  return (
    <div className={`grid gap-4 ${gridCols[columns]} ${className}`}>
      {actions.map((action, index) => (
        <motion.div
          key={action.type}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <RequestActionCard
            type={action.type}
            size={size}
            onClick={action.onClick}
          />
        </motion.div>
      ))}
    </div>
  );
};

// ============================================================================
// 🎯 PROVIDER DE MODALES
// ============================================================================

const RequestModalProvider = () => {
  const {
    permissionModalOpen,
    maintenanceModalOpen,
    privatePurchaseModalOpen,
    equipmentModalOpen,
    businessCaseModalOpen,
    closeModal
  } = useRequestModals();

  return (
    <>
      <PermissionRequestModal
        isOpen={permissionModalOpen}
        onClose={() => closeModal('PERMISSION')}
        onSuccess={() => {
          closeModal('PERMISSION');
          // Aquí puedes agregar lógica adicional como refrescar datos
        }}
      />

      <MaintenanceRequestModal
        isOpen={maintenanceModalOpen}
        onClose={() => closeModal('MAINTENANCE')}
        onSuccess={() => {
          closeModal('MAINTENANCE');
          // Aquí puedes agregar lógica adicional como refrescar datos
        }}
      />

      <PrivatePurchaseRequestModal
        isOpen={privatePurchaseModalOpen}
        onClose={() => closeModal('PRIVATE_PURCHASE')}
        onSuccess={() => {
          closeModal('PRIVATE_PURCHASE');
          // Aquí puedes agregar lógica adicional como refrescar datos
        }}
      />

      <EquipmentRequestModal
        isOpen={equipmentModalOpen}
        onClose={() => closeModal('EQUIPMENT')}
        onSuccess={() => {
          closeModal('EQUIPMENT');
          // Aquí puedes agregar lógica adicional como refrescar datos
        }}
      />

      <BusinessCaseRequestModal
        isOpen={businessCaseModalOpen}
        onClose={() => closeModal('BUSINESS_CASE')}
        onSuccess={() => {
          closeModal('BUSINESS_CASE');
          // Aquí puedes agregar lógica adicional como refrescar datos
        }}
      />
    </>
  );
};

// ============================================================================
// 📤 EXPORTS
// ============================================================================

export {
  RequestActionCard,
  RequestActionButton,
  RequestActionGrid,
  RequestModalProvider,
  REQUEST_TYPES
};

export default RequestActionCard;
