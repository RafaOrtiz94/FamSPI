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
import { NewPublicPurchaseRequestModal } from "../../../modules/comercial/components/NewPublicPurchaseRequestModal";

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
 gradient: "bg-blue-700",
 bgGradient: "bg-blue-50",
 textColor: "text-blue-800",
 borderColor: "border-blue-200",
 shadowColor: "hover:shadow-blue-200/40"
 },

 // Compras Públicas (ACP)
 PUBLIC_PURCHASE: {
 title: "Compra Pública",
 description: "Solicitar adquisición de equipos o suministros vía ACP",
 icon: FiShoppingCart,
 path: "/dashboard/purchases/workspace?tab=public",
 color: "emerald",
 gradient: "bg-emerald-700",
 bgGradient: "bg-emerald-50",
 textColor: "text-emerald-800",
 borderColor: "border-emerald-200",
 shadowColor: "hover:shadow-emerald-200/40"
 },

 // Compras Privadas
 PRIVATE_PURCHASE: {
 title: "Compra Privada",
 description: "Gestionar solicitudes de compras privadas",
 icon: FiBriefcase,
 path: "/dashboard/purchases/workspace?tab=private",
 color: "purple",
 gradient: "bg-violet-700",
 bgGradient: "bg-violet-50",
 textColor: "text-violet-800",
 borderColor: "border-violet-200",
 shadowColor: "hover:shadow-violet-200/40"
 },

 // Business Case
 BUSINESS_CASE: {
 title: "Business Case",
 description: "Crear análisis de viabilidad para nuevos proyectos",
 icon: FiFileText,
 path: "/dashboard/business-case/wizard",
 color: "indigo",
 gradient: "bg-indigo-700",
 bgGradient: "bg-indigo-50",
 textColor: "text-indigo-800",
 borderColor: "border-indigo-200",
 shadowColor: "hover:shadow-indigo-200/40"
 },

 // Mantenimiento
 MAINTENANCE: {
 title: "Mantenimiento",
 description: "Solicitar mantenimiento de equipos",
 icon: FiTool,
 path: "/dashboard/servicio-tecnico/mantenimientos",
 color: "orange",
 gradient: "bg-orange-700",
 bgGradient: "bg-orange-50",
 textColor: "text-orange-800",
 borderColor: "border-orange-200",
 shadowColor: "hover:shadow-orange-200/40"
 },

 // Permisos (redirige a página de permisos con modal)
 PERMISSION: {
 title: "Permiso/Vacación",
 description: "Solicitar permisos o vacaciones",
 icon: FiCalendar,
 path: "/dashboard/talento-humano/permisos",
 color: "teal",
 gradient: "bg-teal-700",
 bgGradient: "bg-teal-50",
 textColor: "text-teal-800",
 borderColor: "border-teal-200",
 shadowColor: "hover:shadow-teal-200/40"
 },

 // Equipos
 EQUIPMENT: {
 title: "Nuevo Equipo",
 description: "Solicitar adquisición de nuevo equipo",
 icon: FiCpu,
 path: "/dashboard/servicio-tecnico/equipos",
 color: "cyan",
 gradient: "bg-cyan-700",
 bgGradient: "bg-cyan-50",
 textColor: "text-cyan-800",
 borderColor: "border-cyan-200",
 shadowColor: "hover:shadow-cyan-200/40"
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
 if (['PERMISSION', 'MAINTENANCE', 'PRIVATE_PURCHASE', 'NEW_PUBLIC_PURCHASE', 'EQUIPMENT', 'BUSINESS_CASE'].includes(type)) {
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
 <Card className={`p-4 ${config.bgGradient} border ${config.borderColor} hover:shadow-lg transition-all duration-300`}>
 <div className="flex items-center gap-3">
 <div className={`p-2 rounded-lg ${config.gradient} text-white shadow-sm`}>
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
 <Card className={`p-6 ${config.bgGradient} border ${config.borderColor} hover:shadow-xl transition-all duration-300 relative overflow-hidden`}>
 {/* Decorative background pattern */}
 <div className="absolute top-0 right-0 w-20 h-20 opacity-10">
 <div className={`w-full h-full ${config.gradient} rounded-full transform translate-x-6 -translate-y-6`} />
 </div>

 <div className="relative z-10">
 <div className="flex items-center gap-4 mb-3">
 <div className={`p-3 rounded-xl ${config.gradient} text-white shadow-lg`}>
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
 if (['PERMISSION', 'MAINTENANCE', 'PRIVATE_PURCHASE', 'NEW_PUBLIC_PURCHASE', 'EQUIPMENT', 'BUSINESS_CASE'].includes(type)) {
 openModal(type);
 } else {
 // Para otros tipos, navegar normalmente
 navigate(config.path);
 }
 }
 };

 const buttonSize =
 size === "xs"
 ? "px-3 py-1.5 text-xs rounded-lg"
 : size === "sm"
 ? "py-2 px-4 text-sm"
 : "py-3 px-6 text-base";

 return (
 <motion.div
 whileHover={{ scale: 1.05 }}
 whileTap={{ scale: 0.95 }}
 >
 <Button
 onClick={handleClick}
 className={`${buttonSize} ${config.gradient} hover:shadow-lg font-semibold text-white border-0 ${className}`}
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
 2: "grid-cols-1 sm:grid-cols-2",
 3: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
 4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
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
 newPublicPurchaseModalOpen,
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

 <NewPublicPurchaseRequestModal
 isOpen={newPublicPurchaseModalOpen}
 onClose={() => closeModal('NEW_PUBLIC_PURCHASE')}
 onSuccess={() => {
 closeModal('NEW_PUBLIC_PURCHASE');
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
