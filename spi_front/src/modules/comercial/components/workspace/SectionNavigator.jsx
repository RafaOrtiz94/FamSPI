import React from "react";
import { FiCheckCircle, FiClock, FiLock, FiAlertTriangle, FiUser, FiMessageSquare, FiChevronDown } from "react-icons/fi";
import { useAuth } from "../../../../core/auth/AuthContext";
import Modal from "../../../../core/ui/components/Modal";
import {
 canRoleEditSection,
 resolveRoleSectionConfig,
} from "./roleSectionConfig";

const SectionNavigator = ({
 selectedSection,
 uiGuidance,
 onSectionSelect,
 observationData,
 sectionCompleteness = {}
}) => {
  const { user } = useAuth();
  const [, setNowTick] = React.useState(Date.now());
  const [mobileOpen, setMobileOpen] = React.useState(false);
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
 // BC-12: estas dos secciones ya estaban soportadas en roleSectionConfig.js
 // y SectionContent.jsx (solo jefe_operaciones/jefe_financiero editan, cada
 // uno su clase), pero nunca se agregaron aqui -- por eso nunca aparecian en
 // el sidebar aunque el backend/permiso ya las dejara editar.
 {
 id: "investment_values",
 title: "Precios — Inversiones Operativas",
 label: "Precios financieros y operativos",
 description: "Cotizacion, precio operativo, precio financiero y depreciacion en una sola vista",
 icon: "$"
 },
 {
 id: "investment_values_fin",
 hidden: true,
 title: "Precios — Inversiones Financieras",
 description: "Precio unitario de servicios y mano de obra del carrito (solo Jefe Financiero)",
 icon: "$FIN"
 },
 {
 id: "consumption_export",
 title: "Resumen",
 description: "Resumen de todo lo registrado en el Business Case hasta este punto",
 icon: "EXP"
 },
 {
 id: "feasibility",
 title: "Factibilidad",
 description: "Decision final del BC para cierre y continuidad en compras",
 icon: "FAC"
 },
 {
 id: "dispatch_workspace",
 title: "Cantidades Maximas",
 description: "Sincronizacion desde Sheet y control operativo posterior a factibilidad",
 icon: "OPS"
 }
 ];

 // Filter sections based on role
 const availableSections = allSections.filter((section) => !section.hidden);
 const roleVisibleSections = roleConfig.visible === "all"
 ? availableSections
 : availableSections.filter(s => roleConfig.visible.includes(s.id));
 // BC cerrado no factible: solo el Resumen queda navegable, sin importar el rol.
 const isClosedNoFactible = uiGuidance?.workflowState?.currentStage === "cerrado_no_factible";
 const visibleSections = isClosedNoFactible
 ? availableSections.filter((s) => s.id === "consumption_export")
 : roleVisibleSections;

 // Check if section is editable by current role
 const canEditSection = (sectionId) => {
 if (sectionId === "investments") {
 const investmentRule = rules?.investments || {};
 const investmentMetadata = investmentRule?.metadata || {};
 const explicitCanEditInvestments = uiGuidance?.permissions?.canEditInvestments;
 if (explicitCanEditInvestments !== undefined) return explicitCanEditInvestments === true;
 return investmentRule?.canUserEdit !== false
 && (
 investmentMetadata?.requires_stat_document !== true
 || investmentMetadata?.stat_document_uploaded === true
 );
 }
 if (sectionId === "determinations") {
 return uiGuidance?.permissions?.canEditDeterminations === true;
 }
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
 const rule = sectionId === "investment_values"
 ? {
 ...(rules.investment_values_fin || {}),
 isCompleted: Boolean(rules.investment_values_fin?.isCompleted),
 isLocked: Boolean(rules.investment_values_op?.isLocked || rules.investment_values_fin?.isLocked),
 currentOwner: rules.investment_values_fin?.currentOwner || rules.investment_values_op?.currentOwner || null,
 completedBy: rules.investment_values_fin?.completedBy || rules.investment_values_op?.completedBy || null,
 completedAt: rules.investment_values_fin?.completedAt || rules.investment_values_op?.completedAt || null,
 }
 : rules[sectionId];
 const isObserved = observationData?.observedSections?.includes(sectionId);
 const hasComment = observationData?.comments?.[sectionId];
 const isLocked = Boolean(rule?.isLocked);

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

  const getStatusLabel = (status) => ({
  locked: "Bloqueado",
  observed: "Observado",
  completed: "Completado",
  "in-progress": "En curso",
  pending: "Pendiente",
  }[status] || "Pendiente");

  const selectedSectionData = visibleSections.find((section) => section.id === selectedSection);
  const selectedSectionStatus = selectedSectionData
  ? getSectionStatus(selectedSectionData.id)
  : null;

  return (
  <>
  <div className="hidden min-w-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-6 lg:block lg:p-6">
  <div className="space-y-2">
  <div className="mb-4 flex min-w-0 items-center justify-between gap-3 lg:mb-6">
  <h3 className="min-w-0 text-lg font-bold tracking-tight text-gray-900">Secciones</h3>
  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-500">
 {visibleSections.length} de {availableSections.length}
 </span>
 </div>

  <div className="grid min-w-0 grid-cols-1 gap-2">
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
  className={`w-full min-w-0 rounded-xl p-3 text-left transition-all duration-200 ${status.isLocked
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
  <div className="flex min-w-0 items-start gap-3">
 {/* Status icon */}
 <div className={`flex-shrink-0 mt-0.5 ${status.color}`}>
 <status.icon size={18} />
 </div>

 {/* Section content */}
  <div className="min-w-0 flex-1">
  <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
 <span className="text-sm">{section.icon}</span>
  <h4 className={`min-w-0 flex-1 break-words text-sm font-semibold ${status.isLocked ? "text-gray-500" : isSelected ? "text-blue-900" : "text-gray-900"
 }`}>
 {section.label || section.title}
 </h4>
 {status.hasComment && (
 <FiMessageSquare
 size={12}
 className="text-amber-600 flex-shrink-0"
 title="Tiene comentario de observacion"
 />
 )}
 {(status.isLocked || isReadOnly) && (
  <span className="text-xs font-normal text-gray-400">
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

  <p className="mb-2 break-words text-xs leading-relaxed text-gray-500 line-clamp-2">
 {section.description}
 </p>

 {sectionCompleteness[section.id] != null && (
 <div className="mb-2">
 <div className="flex items-center justify-between mb-0.5">
 <span className="text-[10px] text-gray-400 font-medium">Completitud</span>
 <span className={`text-[10px] font-semibold ${
   sectionCompleteness[section.id].percent === 100 ? 'text-emerald-600'
   : sectionCompleteness[section.id].percent >= 50 ? 'text-amber-600'
   : 'text-red-500'
 }`}>
 {sectionCompleteness[section.id].percent}%
 </span>
 </div>
 <div className="h-1 w-full rounded-full bg-gray-100">
 <div
 className={`h-1 rounded-full transition-all ${
   sectionCompleteness[section.id].percent === 100 ? 'bg-emerald-500'
   : sectionCompleteness[section.id].percent >= 50 ? 'bg-amber-400'
   : 'bg-red-400'
 }`}
 style={{ width: `${sectionCompleteness[section.id].percent}%` }}
 />
 </div>
 </div>
 )}

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
  <span className="break-words">{status.completedBy}</span>
 </div>
 )}

 {status.currentOwner && (
 <div className="flex items-center gap-1.5 text-xs text-yellow-700 font-medium bg-yellow-50 px-2 py-0.5 rounded-full w-fit">
 <FiUser size={10} />
  <span className="break-words">Edit: {status.currentOwner}</span>
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

  <div className="sticky top-2 z-20 min-w-0 lg:hidden">
  <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
  <div className="mb-2 flex items-center justify-between gap-3">
  <div className="min-w-0">
  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">Seccion activa</p>
  <p className="mt-1 truncate text-xs text-gray-500">{visibleSections.length} secciones disponibles</p>
  </div>
  {selectedSectionStatus && (
  <span className={`flex shrink-0 items-center gap-1.5 text-xs font-semibold ${selectedSectionStatus.color}`}>
  <selectedSectionStatus.icon size={14} />
  {getStatusLabel(selectedSectionStatus.status)}
  </span>
  )}
  </div>
  <button
  type="button"
  onClick={() => setMobileOpen(true)}
  className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-left transition-colors hover:bg-blue-100"
  aria-label="Abrir secciones del Business Case"
  >
  <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-bold text-blue-700 shadow-sm">
  {selectedSectionData?.icon || "BC"}
  </span>
  <span className="min-w-0 flex-1">
  <span className="block truncate text-sm font-semibold text-blue-950">
  {selectedSectionData?.label || selectedSectionData?.title || "Selecciona una seccion"}
  </span>
  <span className="mt-0.5 block truncate text-xs text-blue-700">
  {selectedSectionData?.description || "Navega por los apartados del caso"}
  </span>
  </span>
  <FiChevronDown className="shrink-0 text-blue-700" size={18} />
  </button>
  </div>
  </div>

  <Modal
  open={mobileOpen}
  onClose={() => setMobileOpen(false)}
  closeOnBackdrop
  title="Secciones del Business Case"
  maxWidth="max-w-xl"
  >
  <div className="grid gap-2">
  {visibleSections.map((section) => {
  const status = getSectionStatus(section.id);
  const isSelected = selectedSection === section.id;
  const isReadOnly = !canEditSection(section.id);
  const StatusIcon = status.icon;
  return (
  <button
  key={section.id}
  type="button"
  onClick={() => {
  onSectionSelect(section.id);
  setMobileOpen(false);
  }}
  className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors ${isSelected
  ? "border-blue-200 bg-blue-50"
  : "border-gray-100 bg-white hover:border-blue-100 hover:bg-gray-50"
  }`}
  >
  <StatusIcon className={`shrink-0 ${status.color}`} size={18} />
  <span className="min-w-0 flex-1">
  <span className={`block break-words text-sm font-semibold ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
  {section.label || section.title}
  </span>
  <span className="mt-0.5 block break-words text-xs text-gray-500">{section.description}</span>
  </span>
  <span className="flex shrink-0 flex-col items-end gap-1">
  <span className={`text-[10px] font-semibold uppercase ${status.color}`}>
  {getStatusLabel(status.status)}
  </span>
  {isReadOnly && <span className="text-[10px] text-gray-400">Solo lectura</span>}
  </span>
  </button>
  );
  })}
  </div>
  </Modal>
  </>
  );
};

export default SectionNavigator;
