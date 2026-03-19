import React from "react";
import { FiCheckCircle, FiClock, FiLock, FiAlertTriangle, FiUser, FiMessageSquare } from "react-icons/fi";
import { useAuth } from "../../../../core/auth/AuthContext";
import {
 canRoleEditSection,
 resolveRoleSectionConfig,
} from "./roleSectionConfig";

const SectionNavigator = ({
 selectedSection,
 uiGuidance,
 onSectionSelect,
 observationData
}) => {
 const { user } = useAuth();
 const [, setNowTick] = React.useState(Date.now());
 const userRole = (user?.role || "").toLowerCase();

 const { sectionOwnership } = uiGuidance;
 const { rules } = sectionOwnership;
 const preflow = uiGuidance?.preflow || null;
 const preflowRequired = new Set(preflow?.requiredSections || []);

 // Get role config, default to showing all if role not found
 const roleConfig = resolveRoleSectionConfig(userRole);
 const determinationsGate = uiGuidance?.workspaceData?.determinations_gate || null;

 // Full section list
 const allSections = [
 {
 id: "general",
 title: "Datos Generales",
 description: "Cliente, contrato y requerimientos basicos",
 icon: "DG"
 },
 {
 id: "lab",
 title: "Entorno Laboratorio",
 description: "Configuracion y operacion del laboratorio",
 icon: "LAB"
 },
 {
 id: "requirement",
 title: "Condiciones del BC",
 description: "Plazos, entregas y observaciones clave",
 icon: "BC"
 },
 {
 id: "equipment",
 title: "Equipamiento",
 description: "Seleccion y configuracion de equipos",
 icon: "EQ"
 },
 {
 id: "lis",
 title: "Integracion LIS",
 description: "Sistema de informacion laboratorio",
 icon: "LIS"
 },
 {
 id: "determinations",
 title: "Determinaciones",
 description: "Analisis y cuantificaciones",
 icon: "DET"
 },
 {
 id: "investments",
 title: "Inversiones",
 description: "Costos adicionales y presupuestos",
 icon: "INV"
 },
 {
 id: "consumption_export",
 title: "Sincronizacion",
 description: "Creacion y sincronizacion del Sheet oficial del Business Case",
 icon: "EXP"
 },
 {
 id: "dispatch_workspace",
 title: "Cantidades Maximas",
 description: "Cantidades maximas comerciales y control operativo por elemento",
 icon: "OPS"
 },
 {
 id: "feasibility",
 title: "Factibilidad",
 description: "Decision final del BC para cierre y continuidad en compras",
 icon: "FAC"
 }
 ];

 // Filter sections based on role
 const visibleSections = roleConfig.visible === "all"
 ? allSections
 : allSections.filter(s => roleConfig.visible.includes(s.id));

 // Check if section is editable by current role
 const canEditSection = (sectionId) => {
 return canRoleEditSection(roleConfig, sectionId);
 };

 React.useEffect(() => {
 const timer = setInterval(() => {
 setNowTick(Date.now());
 }, 60 * 1000);
 return () => clearInterval(timer);
 }, []);

 const getDeterminationsCountdown = () => {
 if (!determinationsGate?.deadlineAt) return null;
 const deadline = new Date(determinationsGate.deadlineAt);
 if (Number.isNaN(deadline.getTime())) return null;
 const ms = deadline.getTime() - Date.now();
 if (ms <= 0) return "Vencido";
 const hours = Math.floor(ms / (1000 * 60 * 60));
 const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
 return `${hours}h ${minutes}m`;
 };

 const getSectionStatus = (sectionId) => {
 const rule = rules[sectionId];
 const isObserved = observationData?.observedSections?.includes(sectionId);
 const hasComment = observationData?.comments?.[sectionId];
 const isLocked = Boolean(rule?.isLocked);
 const isReadOnly = !canEditSection(sectionId);

 // Priority: locked > observed > completed > in-progress > pending
 if (isLocked && !rule?.isCompleted) {
 return {
 status: "locked",
 icon: FiLock,
 color: "text-gray-400",
 isLocked: true
 };
 }

 if (isObserved) {
 return {
 status: "observed",
 icon: FiAlertTriangle,
 color: "text-amber-600",
 hasComment: Boolean(hasComment),
 isObserved: true
 };
 }

 if (!rule) return { status: "pending", icon: FiClock, color: "text-gray-400" };

 if (rule.isCompleted) {
 return {
 status: "completed",
 icon: FiCheckCircle,
 color: "text-green-600",
 completedBy: rule.completedBy,
 completedAt: rule.completedAt
 };
 }

 if (rule.currentOwner) {
 return {
 status: "in-progress",
 icon: FiAlertTriangle,
 color: "text-yellow-600",
 currentOwner: rule.currentOwner
 };
 }

 return { status: "pending", icon: FiClock, color: "text-gray-400" };
 };

 return (
 <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 lg:p-6 h-auto lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto custom-scrollbar lg:sticky lg:top-6">
 <div className="space-y-2">
 <div className="flex items-center justify-between mb-4 lg:mb-6">
 <h3 className="text-lg font-bold text-gray-900 tracking-tight">Secciones</h3>
 <span className="text-xs font-semibold text-gray-500 px-2 py-1 bg-gray-100 rounded-full">
 {visibleSections.length} de {allSections.length}
 </span>
 </div>

 <div className="grid grid-cols-1 gap-2">
 {visibleSections.map((section) => {
 const status = getSectionStatus(section.id);
 const isSelected = selectedSection === section.id;
 const isReadOnly = !canEditSection(section.id);
 const isDeterminations = section.id === "determinations";
 const countdown = isDeterminations ? getDeterminationsCountdown() : null;
 const needsStatDoc = isDeterminations && determinationsGate?.requiresDocument;
 const statDocReady = isDeterminations && determinationsGate?.documentUploaded;
 const isExpired = isDeterminations && determinationsGate?.isExpired;

 return (
 <button
 key={section.id}
 onClick={() => onSectionSelect(section.id)}
 className={`w-full text-left p-3 rounded-xl transition-all duration-200 ${status.isLocked
 ? "opacity-60 cursor-not-allowed bg-gray-50 border border-gray-100"
 : isSelected
 ? status.isObserved
 ? "bg-amber-50 border border-amber-200 shadow-sm ring-1 ring-amber-200"
 : "bg-blue-50 border border-blue-200 shadow-sm ring-1 ring-blue-200"
 : status.isObserved
 ? "hover:bg-amber-50 border border-transparent hover:shadow-sm"
 : "hover:bg-gray-50 border border-transparent hover:shadow-sm"
 }`}
 >
 <div className="flex items-start gap-3">
 {/* Status icon */}
 <div className={`flex-shrink-0 mt-0.5 ${status.color}`}>
 <status.icon size={18} />
 </div>

 {/* Section content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <span className="text-sm">{section.icon}</span>
 <h4 className={`text-sm font-semibold truncate ${status.isLocked ? "text-gray-500" : isSelected ? "text-blue-900" : "text-gray-900"
 }`}>
 {section.title}
 </h4>
 {status.hasComment && (
 <FiMessageSquare
 size={12}
 className="text-amber-600 flex-shrink-0"
 title="Tiene comentario de observacion"
 />
 )}
 {(status.isLocked || isReadOnly) && (
 <span className="text-xs text-gray-400 font-normal ml-auto">
 {status.isLocked ? "(Bloqueado)" : "(Solo lectura)"}
 </span>
 )}
 {preflowRequired.has(section.id) && (
 <span
 className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-full ${
 preflow?.isExpired
 ? "bg-rose-100 text-rose-700"
 : "bg-indigo-100 text-indigo-700"
 }`}
 title="Seccion requerida para iniciar flujo de compras"
 >
 Preflow
 </span>
 )}
 </div>

 <p className="text-xs text-gray-500 mb-2 line-clamp-2 leading-relaxed">
 {section.description}
 </p>

 {isDeterminations && (
 <div className="mt-2 flex flex-wrap gap-1.5">
 {needsStatDoc && (
 <span
 className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-full ${
 statDocReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
 }`}
 >
 {statDocReady ? "Documento cargado" : "Documento pendiente"}
 </span>
 )}
 {countdown && (
 <span
 className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-full ${
 isExpired ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"
 }`}
 >
 {isExpired ? "Ventana vencida" : `Tiempo ${countdown}`}
 </span>
 )}
 </div>
 )}

 {/* Ownership info */}
 {status.completedBy && (
 <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full w-fit">
 <FiUser size={10} />
 <span>{status.completedBy}</span>
 </div>
 )}

 {status.currentOwner && (
 <div className="flex items-center gap-1.5 text-xs text-yellow-700 font-medium bg-yellow-50 px-2 py-0.5 rounded-full w-fit">
 <FiUser size={10} />
 <span>Edit: {status.currentOwner}</span>
 </div>
 )}
 </div>
 </div>
 </button>
 );
 })}
 </div>
 </div>
 </div>
 );
};

export default SectionNavigator;
