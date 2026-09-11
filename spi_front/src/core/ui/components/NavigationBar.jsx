import React from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import {
 FiHome,
 FiUsers,
 FiDollarSign,
 FiClipboard,
 FiShoppingCart,
 FiFileText,
 FiTool,
 FiList,
 FiBookOpen,
 FiCpu,
 FiCheckCircle,
 FiCalendar,
 FiLayers,
 FiShield,
 FiLifeBuoy,
 FiActivity,
 FiSettings,
 FiAward,
 FiCheckSquare,
 FiGrid,
 FiTarget,
 FiKey,
 FiMoreHorizontal,
 FiChevronDown,
 FiX,
} from "react-icons/fi";
import clsx from "clsx";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { useAuth } from "../../auth/AuthContext";
import useAuditStatus from "../../hooks/useAuditStatus";
import { isPathEnabledForUser, buildGlobalStatusMap, MODULE_PATH_PREFIXES } from "../../auth/moduleAccess";

const homePathsByScope = {
 gerencia: "/dashboard/gerencia",
 gerente_general: "/dashboard/gerencia",
 director: "/dashboard/gerencia",
 finanzas: "/dashboard/finanzas",
 jefe_finanzas: "/dashboard/finanzas",
 jefe_financiero: "/dashboard/finanzas",
 financiero: "/dashboard/finanzas",
 comercial: "/dashboard/comercial",
 jefe_comercial: "/dashboard/comercial",
 backoffice_comercial: "/dashboard/comercial",
 acp_comercial: "/dashboard/comercial",
 servicio_tecnico: "/dashboard/servicio-tecnico",
 "servicio-tecnico": "/dashboard/servicio-tecnico",
 jefe_tecnico: "/dashboard/servicio-tecnico",
 jefe_servicio: "/dashboard/servicio-tecnico",
 jefe_servicio_tecnico: "/dashboard/servicio-tecnico",
 tecnico: "/dashboard/servicio-tecnico",
 ing_servicio: "/dashboard/servicio-tecnico",
 esp_app: "/dashboard/servicio-tecnico",
 ing_servicio_ext: "/dashboard/ext",
 esp_app_ext: "/dashboard/ext",
 talento_humano: "/dashboard/talento-humano",
 "talento-humano": "/dashboard/talento-humano",
 jefe_talento_humano: "/dashboard/talento-humano",
 it: "/dashboard/ti",
 ti: "/dashboard/ti",
 jefe_ti: "/dashboard/ti",
 admin_ti: "/dashboard/ti",
 operaciones: "/dashboard/operaciones",
 jefe_operaciones: "/dashboard/operaciones",
 logistica: "/dashboard/logistica",
 jefe_logistica: "/dashboard/logistica",
 calidad: "/dashboard/calidad",
 jefe_calidad: "/dashboard/calidad",
};

const getHomeLink = (scope) => {
 const path = homePathsByScope[scope] || "/dashboard";
 return { name: "Inicio", icon: FiHome, path };
};

const comercialLinks = [
 {
 name: "Solicitudes",
 icon: FiClipboard,
 path: "/dashboard/comercial/solicitudes",
 },
 {
 name: "Clientes",
 icon: FiUsers,
 path: "/dashboard/comercial/clientes",
 },
];

const clientsManagementLink = {
 name: "Clientes",
 icon: FiUsers,
 path: "/dashboard/operaciones/clientes",
};

const comercialScopes = ["comercial", "jefe_comercial", "acp_comercial", "backoffice", "backoffice_comercial"];

const crmFamLinks = [
  { name: "CRM-FAM", icon: FiTarget, path: "/dashboard/crm-fam" },
];

const aprobacionesPlanLink = {
 name: "Aprobación de planes",
 icon: FiCheckCircle,
 path: "/dashboard/comercial/aprobaciones-planificacion",
};

const businessCaseLink = {
 name: "Business Case",
 icon: FiFileText,
 path: "/dashboard/business-case",
};

const famSheetsLink = {
 name: "FamSheets",
 icon: FiBookOpen,
 path: "/dashboard/comercial/famsheets",
};

const deliveryCeilingsLink = {
 name: "Maximos y Saldos",
 icon: FiLayers,
 path: "/dashboard/comercial/delivery-ceilings",
};

const businessCaseObservabilityLink = {
 name: "Obs. BC",
 icon: FiActivity,
 path: "/dashboard/business-case/observabilidad",
};

const linksInteresLink = {
 name: "Links de Interés",
 icon: FiBookOpen,
 path: "/dashboard/links-interes",
};

const purchasesWorkspaceLink = {
 name: "Workspace de Compras",
 icon: FiShoppingCart,
 path: "/dashboard/purchases/workspace",
};

const workManagementLink = {
 name: "Work Management",
 icon: FiGrid,
 path: "/dashboard/work-management",
};

const equipmentWorkspaceLink = {
 name: "Workspace de Equipos",
 icon: FiCpu,
 path: "/dashboard/equipos",
};

const servicioCronogramaLink = {
 name: "Cronograma Tecnico",
 icon: FiCalendar,
 path: "/dashboard/servicio-tecnico/cronograma",
};

const servicioInspeccionesLink = {
 name: "Inspecciones de Ambiente",
 icon: FiClipboard,
 path: "/dashboard/servicio-tecnico/inspecciones",
};

const servicioMantenimientosLink = {
 name: "Mantenimientos",
 icon: FiTool,
 path: "/dashboard/servicio-tecnico/mantenimientos",
};

const servicioSolicitudesLink = {
 name: "Solicitudes",
 icon: FiLayers,
 path: "/dashboard/servicio-tecnico/solicitudes",
};

const servicioAplicacionesLink = {
 name: "Aplicaciones ST",
 icon: FiShield,
 path: "/dashboard/servicio-tecnico/aplicaciones",
};

const servicioDisponibilidadLink = {
 name: "Disponibilidad",
 icon: FiUsers,
 path: "/dashboard/servicio-tecnico/disponibilidad",
};

const servicioAsistenciaLink = {
 name: "Asistencia y Salidas",
 icon: FiCheckCircle,
 path: "/dashboard/servicio-tecnico/asistencia",
};

const servicioCasosExternosLink = {
 name: "Casos Externos",
 icon: FiFileText,
 path: "/dashboard/servicio-tecnico/casos-externos",
};

const gerenciaContractApprovalsLink = {
 name: "Album de Compras",
 icon: FiCheckCircle,
 path: "/dashboard/gerencia/compras-album",
};

const talentoLinks = [
 {
 name: "Colaboradores",
 icon: FiUsers,
 path: "/dashboard/talento-humano/colaboradores",
 },
];

const peopleAdminLink = {
 name: "Usuarios y Departamentos",
 icon: FiSettings,
 path: "/dashboard/talento-humano/gestion",
};

const auditLinks = [
 {
 name: "Auditoría y Trazabilidad",
 icon: FiFileText,
 path: "/dashboard/auditoria",
 },
];

const permisosLink = {
 name: "Permisos y Vacaciones",
 icon: FiCalendar,
 path: "/dashboard/talento-humano/permisos",
};

const asistenciaReportesLink = {
 name: "Asistencia Reportes",
 icon: FiClipboard,
 path: "/dashboard/talento-humano/asistencia-reportes",
};

const pruebasTecnicasLink = {
 name: "Gestor de pruebas asignadas",
 icon: FiCheckCircle,
 path: "/dashboard/talento-humano/pruebas-tecnicas",
};

const solicitudesTalentoLink = {
 name: "Solicitudes",
 icon: FiList,
 path: "/dashboard/talento-humano/solicitudes",
};

const capacitacionesLink = {
 name: "Capacitaciones",
 icon: FiAward,
 path: "/dashboard/capacitaciones",
};

const firmaLink = {
 name: "Firma Digital",
 icon: FiCheckSquare,
 path: "/dashboard/signatures/inbox",
};

const clientRequestsReviewLink = {
 name: "Solicitudes Cliente",
 icon: FiClipboard,
 path: "/dashboard/backoffice/client-requests",
};

// Cartera de clientes para backoffice_comercial via extra_roles (ver
// migrations/276_users_extra_roles.sql, ej. lorena.loaiza). Misma
// ClientesPage que usan comercial/operaciones, montada en su propia ruta
// (ver AppRoutes.jsx) para no ampliar el resto de subrutas comerciales.
const clientRequestsPortfolioLink = {
 name: "Clientes",
 icon: FiUsers,
 path: "/dashboard/backoffice/clientes",
};

// Resumen de solo-lectura de Business Case (jefe_calidad y, via extra_roles,
// lorena.loaiza@fam-project.com -- ver businessCase.routes.js).
const bcQualitySummaryLink = {
 name: "Business Case (resumen)",
 icon: FiClipboard,
 path: "/dashboard/business-case/resumen",
};

const viaticosLink = {
 name: "Workspace Viaticos",
 icon: FiDollarSign,
 path: "/dashboard/finanzas/viaticos",
};

const auditPrepLink = {
 name: "Preparación Auditoría",
 icon: FiShield,
 path: "/dashboard/auditoria/preparacion",
};

const tiWorkspaceLink = {
 name: "Workspace TI",
 icon: FiLifeBuoy,
 path: "/dashboard/ti/workspace",
};

const kickoffLink = {
 name: "Kick Off 2026",
 icon: FiCalendar,
 path: "/dashboard/kickoff",
};

const famDaysLink = {
 name: "FamDays",
 icon: FiCalendar,
 path: "/dashboard/famdays",
};

const tiDevicesLink = {
 name: "Dispositivos TI",
 icon: FiCpu,
 path: "/dashboard/ti/dispositivos",
};
const tiModulesLink = {
 name: "Modulos por Usuario",
 icon: FiSettings,
 path: "/dashboard/ti/modulos",
};
const tiShortcutTokenLink = {
 name: "Token Shortcut Siri",
 icon: FiKey,
 path: "/dashboard/ti/shortcut-token",
};

const collabEntregasLink = {
 name: "Entregas Colaboradores",
 icon: FiList,
 path: "/dashboard/collab/entregas",
};

const collabResumenLink = {
 name: "Entregas Colaboradores",
 icon: FiList,
 path: "/dashboard/collab/resumen",
};

// Sistema de prioridades por rol
const getPriorityGroups = (scope, role, auditActive, extraRoles = []) => {
 const roleSet = new Set(
 String(role || "")
 .split(",")
 .map((item) => item.trim().toLowerCase())
 .filter(Boolean)
 );
 // jefe_financiero SI debe ver Business Case: precifica inversiones
 // financieras en tiempo real ahi (ver InvestmentValuesSection). Solo se
 // oculta para el rol "financiero" (sin permisos de precificacion).
 const hideBusinessCaseForFinance =
 String(scope || "").toLowerCase() === "financiero" ||
 roleSet.has("financiero");

 const groups = {
 critical: [], // Funciones críticas diarias - siempre visibles
 primary: [], // Funciones principales del rol
 secondary: [], // Funciones especificas/secundarias
 admin: [] // Funciones administrativas/menos usadas
 };

 // Siempre incluir inicio como critico
 groups.critical.push(getHomeLink(scope));
 groups.admin.push(famDaysLink);

 // 📊 GERENCIA - Enfoque en control y supervisión
 if (["gerencia", "gerencia_general", "gerente_general", "director"].includes(scope)) {
 groups.critical.push(businessCaseLink, aprobacionesPlanLink); // Estrategia y Control
 if (["gerencia", "gerencia_general"].includes(scope)) {
 groups.critical.push(famSheetsLink);
 }
 // Acceso post-evento para responder preguntas y exportar reportes
 if (scope === "gerencia_general") {
   groups.secondary.push(kickoffLink);
 }
 groups.primary.push(gerenciaContractApprovalsLink, collabResumenLink, permisosLink, auditLinks[0]);
 groups.primary.push(deliveryCeilingsLink);
 groups.secondary.push(workManagementLink, ...crmFamLinks);
 groups.secondary.push(capacitacionesLink, firmaLink, auditPrepLink);
 groups.admin.push(...talentoLinks);
 }

 // 💰 FINANZAS - Control presupuestario
 else if (["finanzas", "jefe_finanzas", "jefe_financiero", "financiero", "contador"].includes(scope)) {
 groups.primary.push(viaticosLink, collabEntregasLink, asistenciaReportesLink, permisosLink);
  if (!hideBusinessCaseForFinance) {
  groups.primary.push(businessCaseLink);
  }
  if (scope === "jefe_financiero") {
  groups.primary.push(comercialLinks[0]);
  }
  groups.secondary.push(capacitacionesLink, firmaLink);
 if (auditActive) groups.secondary.push(auditPrepLink);
 }

 // 💼 COMERCIAL - Asesor comercial / jefe comercial
 else if (scope === "comercial" || scope === "jefe_comercial") {
 groups.critical.push(...comercialLinks); // Solicitudes y clientes (clientes tab incluye planificacion)
 groups.primary.push(
  businessCaseLink,
  purchasesWorkspaceLink,
  equipmentWorkspaceLink,
  workManagementLink,
  ...crmFamLinks,
  viaticosLink,
  capacitacionesLink,
  famSignLink,
  permisosLink,
  linksInteresLink
 );
 }

 // 💼 COMERCIAL - Flujo de ventas completo
 else if (comercialScopes.includes(scope)) {
 groups.critical.push(...comercialLinks); // Solicitudes y clientes (clientes tab incluye planificacion)
 const canSeeFamSheets = ["comercial", "jefe_comercial"].includes(scope);

 if (canSeeFamSheets) {
 groups.primary.push(famSheetsLink);
 }

 // UNIFICACION: Solo Workspace de Compras - Roles según AppRoutes.jsx
 const workspaceAllowedRoles = [
 "comercial", "jefe_comercial", "acp_comercial", "gerencia",
 "gerencia_general", "jefe_operaciones", "jefe_logistica", "backoffice_comercial"
 ];

 if (workspaceAllowedRoles.includes(scope) || role.includes("backoffice")) {
 groups.primary.unshift(purchasesWorkspaceLink); // Workspace primero en primary
 }
 const equipmentWorkspaceAllowedRoles = [
 "comercial", "jefe_comercial", "backoffice_comercial", "acp_comercial",
 "servicio_tecnico", "tecnico", "ing_servicio", "esp_app",
 "jefe_tecnico", "jefe_servicio", "jefe_servicio_tecnico",
 "operaciones", "jefe_operaciones", "logistica", "jefe_logistica",
 "gerencia", "gerencia_general", "admin", "administrador", "ti", "admin_ti",
 ];
 if (equipmentWorkspaceAllowedRoles.includes(scope) || role.includes("backoffice")) {
 groups.primary.push(equipmentWorkspaceLink);
 }
 groups.primary.push(deliveryCeilingsLink);
 groups.primary.push(workManagementLink);

 if (["jefe_comercial"].includes(scope)) {
 groups.primary.push(aprobacionesPlanLink);
 }

 groups.secondary.push(businessCaseLink); // Business Case queda en secondary
 groups.secondary.push(...crmFamLinks);
 groups.secondary.push(capacitacionesLink, firmaLink);
 groups.admin.push(permisosLink, viaticosLink);
 }

 // SERVICIO TECNICO - Operaciones tecnicas (internos)
 else if (["servicio_tecnico", "jefe_tecnico", "jefe_servicio", "jefe_servicio_tecnico", "tecnico", "ing_servicio", "esp_app"].includes(scope)) {
 const isJefeServicio = ["jefe_servicio", "jefe_servicio_tecnico"].includes(scope);
 groups.critical.push(servicioCronogramaLink);
 groups.critical.push(isJefeServicio ? servicioSolicitudesLink : servicioInspeccionesLink);
 // Correctivos, Retiros, Desinfeccion y Verificacion ya no tienen link
 // propio: son pestañas/formularios reachable desde Mantenimientos,
 // Solicitudes y el hub "Aplicaciones ST" respectivamente -- tenerlos
 // ademas como items de nivel superior duplicaba destino sin agregar
 // nada, y el area de servicio tecnico tenia el menu mas largo de todos.
 groups.primary.push(
  businessCaseLink,
  purchasesWorkspaceLink,
  equipmentWorkspaceLink,
  workManagementLink,
  servicioMantenimientosLink,
  servicioAplicacionesLink,
  servicioDisponibilidadLink,
  servicioAsistenciaLink,
  servicioCasosExternosLink,
  permisosLink,
  capacitacionesLink,
  firmaLink,
  pruebasTecnicasLink
 );
 if (["jefe_tecnico", "jefe_servicio"].includes(scope)) groups.primary.push(collabEntregasLink);
 groups.secondary.push(viaticosLink);
 }

 // EXTERNOS â€” acceso reducido a FamSign, Capacitaciones, Permisos, Viaticos
 else if (["ing_servicio_ext", "esp_app_ext"].includes(scope)) {
 groups.primary.push(firmaLink, capacitacionesLink, permisosLink, viaticosLink);
 }

 // TALENTO HUMANO - Gestión de personal
 else if (["talento-humano", "talento_humano", "jefe_talento_humano"].includes(scope)) {
 groups.primary.push(...talentoLinks);
 groups.primary.push(asistenciaReportesLink);
 groups.primary.push(permisosLink);
 if (["talento_humano","talento-humano"].includes(scope)) groups.primary.push(collabEntregasLink);
 groups.primary.push(capacitacionesLink, viaticosLink);
 groups.secondary.push(firmaLink);
 }

 // TI - Tecnología y auditoría
else if (["it", "ti", "jefe_ti", "admin_ti"].includes(scope)) {
 groups.critical.push(tiWorkspaceLink);
 if (["ti", "jefe_ti"].includes(scope) || role.includes("ti") || role.includes("jefe_ti")) {
 groups.critical.push(tiShortcutTokenLink);
 }
 if (["jefe_ti", "admin_ti"].includes(scope) || role.includes("jefe_ti") || role.includes("admin_ti")) {
 groups.critical.push(tiModulesLink, kickoffLink);
 }
 groups.primary.push(tiDevicesLink, permisosLink, capacitacionesLink, firmaLink, ...talentoLinks, ...auditLinks);
 if (["ti", "jefe_ti"].includes(scope) || role.includes("jefe_ti")) {
 groups.primary.push(peopleAdminLink);
 }
 groups.secondary.push(viaticosLink);
 groups.secondary.push(workManagementLink);
 if (auditActive) groups.primary.push(auditPrepLink);
 groups.secondary.push(...crmFamLinks);
 }

 // âš™ï¸ OPERACIONES - Procesos operativos
else if (["operaciones", "jefe_operaciones", "jefe_de_operaciones"].includes(scope)) {
 const isOperationsChief =
 scope === "jefe_operaciones" ||
 scope === "jefe_de_operaciones" ||
 roleSet.has("jefe_operaciones") ||
 roleSet.has("jefe_de_operaciones");
 if (isOperationsChief) {
 groups.critical.push(clientsManagementLink);
 }
 groups.primary.push(purchasesWorkspaceLink, permisosLink, pruebasTecnicasLink);
 groups.primary.push(equipmentWorkspaceLink);
 groups.secondary.push(workManagementLink);
 groups.secondary.push(capacitacionesLink, firmaLink, businessCaseLink);
 if (auditActive) groups.secondary.push(auditPrepLink);
 }

 // LOGISTICA - Despachos y actas
 else if (["logistica", "jefe_logistica"].includes(scope)) {
 groups.primary.push(purchasesWorkspaceLink);
 groups.primary.push(equipmentWorkspaceLink);
 groups.primary.push(permisosLink);
 groups.secondary.push(workManagementLink);
 groups.secondary.push(capacitacionesLink, firmaLink);
 }

 // 🎨 CALIDAD - Control de calidad
 else if (["calidad", "jefe_calidad"].includes(scope)) {
 groups.primary.push(clientRequestsReviewLink, solicitudesTalentoLink, permisosLink);
 // Bug real: jefe_calidad y calidad comparten scope="calidad" (ver
 // resolveRoleMeta en auth.controller.js) -- scope nunca es "jefe_calidad".
 // Hay que mirar el rol crudo para no darle este link tambien a "calidad".
 if (role === "jefe_calidad") groups.primary.push(bcQualitySummaryLink);
 groups.secondary.push(capacitacionesLink, firmaLink);
 if (auditActive) groups.primary.push(auditPrepLink);
 }

 // 🏢 BACKOFFICE - Soporte administrativo
 else if (role.includes("backoffice")) {
 groups.primary.push(purchasesWorkspaceLink);
 groups.secondary.push(...comercialLinks, capacitacionesLink, firmaLink);
 }

 if ([
 "jefe_comercial",
 "jefe_tecnico",
 "jefe_servicio",
 "jefe_operaciones",
 "gerencia",
 "gerencia_general",
 "admin",
 "administrador",
 ].includes(scope)) {
 groups.secondary.push(businessCaseObservabilityLink);
 }

 // Kick Off 2026 â€” solo jefe_ti (acceso para reportes post-evento)

 if (!["comercial", "jefe_comercial"].includes(scope)) {
 groups.secondary.push(linksInteresLink);
 }

 // Cualquier usuario interno activo puede ser asignado como responsable de
 // una prueba tecnica en el pipeline de contratacion (ver getInternalUsers
 // en hiring-pipeline.service.js, sin filtro de rol) -- el link debe ser
 // universal, no solo para servicio_tecnico/operaciones (que ya lo agregan
 // arriba). BUG: alexandra.molina (jefe_financiero) fue asignada y no tenia
 // forma de llegar a la pagina desde el navbar.
 if (!groups.primary.includes(pruebasTecnicasLink) && !groups.secondary.includes(pruebasTecnicasLink)) {
 groups.secondary.push(pruebasTecnicasLink);
 }

 // extra_roles: capacidad de backoffice_comercial otorgada a un usuario
 // puntual sin cambiar su rol/scope principal (ver migrations/276_users_extra_roles.sql,
 // p.ej. lorena.loaiza con scope "financiero"). Cubre tanto la aprobacion de
 // solicitudes de nuevos clientes como la gestion de cartera de clientes
 // (misma vista que usa jefe_operaciones/comercial, montada en su propia
 // ruta /dashboard/backoffice/clientes). Sin esto, la persona puede entrar
 // por URL directa pero no tiene como descubrir el apartado desde el
 // navbar -- mismo patron de bug que pruebas tecnicas arriba.
 if (Array.isArray(extraRoles) && extraRoles.includes("backoffice_comercial")) {
 if (
 !groups.critical.includes(clientRequestsReviewLink) &&
 !groups.primary.includes(clientRequestsReviewLink) &&
 !groups.secondary.includes(clientRequestsReviewLink)
 ) {
 groups.primary.push(clientRequestsReviewLink);
 }
 if (
 !groups.critical.includes(clientRequestsPortfolioLink) &&
 !groups.primary.includes(clientRequestsPortfolioLink) &&
 !groups.secondary.includes(clientRequestsPortfolioLink)
 ) {
 groups.primary.push(clientRequestsPortfolioLink);
 }
 }

 if (Array.isArray(extraRoles) && extraRoles.includes("bc_quality_summary")) {
 if (
 !groups.critical.includes(bcQualitySummaryLink) &&
 !groups.primary.includes(bcQualitySummaryLink) &&
 !groups.secondary.includes(bcQualitySummaryLink)
 ) {
 groups.primary.push(bcQualitySummaryLink);
 }
 }

 // Filtrar elementos vacíos y aplanar arrays
 Object.keys(groups).forEach(key => {
 groups[key] = groups[key].filter(Boolean);
 });

 return groups;
};

// Componente para botones de navegación — superficie clara (DESIGN.md §3.1/§4).
// `variant` da peso visual por prioridad (crítico se ve como control con
// borde; el resto son tabs planos). `context="popover"` es para cuando el
// link vive en un panel flotante (menú "Más" / hoja móvil) en vez de la fila
// principal — mismos tokens de superficie, sin el marcador de activo.
const NavButton = ({ link, variant = "primary", mobile = false, context = "nav", onClick, globalStatusMap }) => {
 const moduleStatus = globalStatusMap?.get(link.path) || null;
 const showConstructionBadge = moduleStatus?.stage === 'construction' || (moduleStatus?.stage === 'testing' && !moduleStatus?.in_whitelist);
 const showBetaBadge = moduleStatus?.stage === 'testing' && moduleStatus?.in_whitelist;
 const isChip = variant === "critical" && !mobile && context === "nav";

 const baseClasses = mobile
 ? "flex items-center px-3 py-2.5 text-[15px] font-medium rounded-lg transition-colors duration-150 active:bg-[var(--surface-subtle)]"
 : clsx(
   "relative inline-flex shrink-0 items-center whitespace-nowrap text-xs font-medium transition-colors duration-150 lg:text-[13px]",
   isChip ? "rounded-lg border px-2.5 py-1.5" : "rounded-md px-2 py-1.5"
 );

 const navTierClasses = {
 critical: isChip
   ? "border-white/20 bg-white/5 text-[var(--nav-selected-text)] font-semibold shadow-sm hover:border-[var(--nav-marker)] hover:bg-[var(--nav-active)]"
   : "text-[var(--nav-selected-text)] font-semibold hover:bg-[var(--nav-active)]",
 primary: "text-[var(--nav-text)] hover:bg-[var(--nav-active)] hover:text-[var(--nav-selected-text)]",
 secondary: "text-[var(--nav-text)]/80 hover:bg-[var(--nav-active)] hover:text-[var(--nav-selected-text)]",
 admin: "text-[var(--nav-text)]/65 hover:bg-[var(--nav-active)] hover:text-[var(--nav-selected-text)]",
 };
 const popoverTierClasses = {
 critical: "text-[var(--text)] font-semibold hover:bg-[var(--surface-subtle)]",
 primary: "text-[var(--text)] hover:bg-[var(--surface-subtle)]",
 secondary: "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]",
 admin: "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]",
 };
 // Spring "instrumento de precisión": rápido y sin rebote perceptible — se
 // mueve como una aguja de dial, no como un elemento elástico/juguetón.
 // Desactivado (salto instantáneo) si el usuario prefiere menos movimiento.
 const prefersReducedMotion = useReducedMotion();
 const indicatorTransition = prefersReducedMotion
 ? { duration: 0 }
 : { type: "spring", stiffness: 520, damping: 40, mass: 0.7 };

 return (
 <NavLink
 to={link.path}
 end
 onClick={onClick}
 className={({ isActive }) =>
 clsx(
 baseClasses,
  context === "popover" ? popoverTierClasses[variant] : navTierClasses[variant],
 isActive && context === "popover" && "bg-[var(--selected)] text-[var(--action)] font-semibold",
 isActive && context === "nav" && !isChip && "text-[var(--action)] font-semibold",
 isActive && context === "nav" && isChip && "border-[var(--action)] text-[var(--action)]"
 )
 }
 >
 {({ isActive }) => (
 <>
 {/* Indicador "mágico" — un único elemento compartido (layoutId) que
     Framer Motion desliza/redimensiona entre ítems al cambiar de ruta,
     en vez de aparecer/desaparecer de golpe en la nueva posición. */}
 {isActive && context === "nav" && isChip && (
   <motion.span
     layoutId="nav-chip-indicator"
     transition={indicatorTransition}
     className="absolute inset-0 -z-10 rounded-lg bg-[var(--selected)]"
   />
 )}
 {React.createElement(link.icon, {
 className: clsx(
 mobile ? "mr-3 h-5 w-5 flex-shrink-0" : "mr-1.5 h-3.5 w-3.5 flex-shrink-0 lg:h-4 lg:w-4",
 isActive ? "text-[var(--action)]" : "text-[var(--text-secondary)]"
 )
 })}
 <span className="truncate leading-none">{link.name}</span>
 {showConstructionBadge && (
   <span className="ml-1.5 flex-shrink-0 rounded-md bg-[var(--warning-bg)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--warning-text)]">🚧</span>
 )}
 {showBetaBadge && (
   <span className="ml-1.5 flex-shrink-0 rounded-md bg-[var(--info-bg)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--info-text)]">Beta</span>
 )}
 {/* Subrayado de activo — único indicador visual para los tabs planos */}
 {isActive && context === "nav" && !mobile && !isChip && (
   <motion.span
     layoutId="nav-underline-indicator"
     transition={indicatorTransition}
     className="pointer-events-none absolute inset-x-2 -bottom-1 h-[2px] rounded-full bg-[var(--action)]"
   />
 )}
 </>
 )}
 </NavLink>
 );
};

// Separación entre el grupo crítico y el resto — solo espacio, sin línea ni
// marca decorativa (se probó con línea+tick y no funcionó visualmente).
const GroupSeparator = () => <div className="w-2 xl:w-3" aria-hidden="true" />;

const renderGroup = (links, variant, onClick, isMobile, globalStatusMap, context = "nav") =>
 links.map((link) => (
 <NavButton
 key={link.path}
 link={link}
 variant={variant}
 mobile={isMobile}
 context={context}
 onClick={onClick}
 globalStatusMap={globalStatusMap}
 />
 ));

// Tab del dock inferior móvil (<768px) — icono sobre etiqueta, patrón app
// nativa (DESIGN.md §6: "navegación inferior de 3–5 destinos"). Reemplaza el
// menú hamburguesa: los destinos críticos quedan a un toque del pulgar en
// vez de dos (abrir menú → elegir).
const MobileTabLink = ({ link, globalStatusMap }) => {
 const moduleStatus = globalStatusMap?.get(link.path) || null;
 const showConstructionBadge = moduleStatus?.stage === 'construction' || (moduleStatus?.stage === 'testing' && !moduleStatus?.in_whitelist);
 const showBetaBadge = moduleStatus?.stage === 'testing' && moduleStatus?.in_whitelist;
 const prefersReducedMotion = useReducedMotion();
 const indicatorTransition = prefersReducedMotion
 ? { duration: 0 }
 : { type: "spring", stiffness: 520, damping: 40, mass: 0.7 };
 return (
 <NavLink
 to={link.path}
 end
 className={({ isActive }) =>
 clsx(
 "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 pb-1 pt-2 text-[10px] font-medium leading-none transition-colors duration-150",
 isActive ? "text-[var(--nav-selected-text)]" : "text-[var(--nav-text)]"
 )
 }
 style={{ minHeight: "var(--row-height)" }}
 >
 {({ isActive }) => (
 <>
 {isActive && (
   <motion.span
     layoutId="mobile-tab-indicator"
     transition={indicatorTransition}
     className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-[var(--nav-marker)]"
   />
 )}
 <motion.span
 className="relative"
 whileTap={prefersReducedMotion ? undefined : { scale: 0.82 }}
 transition={{ duration: 0.12 }}
 >
 {React.createElement(link.icon, {
 className: clsx("h-5 w-5", isActive ? "text-[var(--nav-marker)]" : "text-[var(--nav-text)]"),
 })}
 {(showConstructionBadge || showBetaBadge) && (
 <span
 className={clsx(
 "absolute -right-1 -top-1 h-2 w-2 rounded-full ring-1 ring-[var(--nav)]",
 showBetaBadge ? "bg-[var(--info-text)]" : "bg-[var(--warning-text)]"
 )}
 />
 )}
 </motion.span>
 <span className="max-w-full truncate">{link.name}</span>
 </>
 )}
 </NavLink>
 );
};

const DesktopOverflowMenu = ({ links, globalStatusMap, label = "Módulos" }) => {
 const [open, setOpen] = React.useState(false);
 const buttonRef = React.useRef(null);
 const menuRef = React.useRef(null);
 const [menuStyle, setMenuStyle] = React.useState(null);
 const location = useLocation();

 const updateMenuPosition = React.useCallback(() => {
 if (!buttonRef.current || typeof window === "undefined") return;
 const rect = buttonRef.current.getBoundingClientRect();
  const width = Math.min(720, window.innerWidth - 32);
  const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16);
 setMenuStyle({ top: rect.bottom + 8, left, width });
 }, []);

  React.useEffect(() => {
 setOpen(false);
 }, [location.pathname]);

 React.useEffect(() => {
 if (open) {
 updateMenuPosition();
 }
  }, [open, updateMenuPosition]);

  const groupedLinks = React.useMemo(() => ({
    primary: links.filter((link) => (link.navVariant || "primary") === "primary"),
    secondary: links.filter((link) => link.navVariant === "secondary"),
    admin: links.filter((link) => link.navVariant === "admin"),
  }), [links]);

 React.useEffect(() => {
 if (!open) return undefined;
 const handlePointerDown = (event) => {
 if (!buttonRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
 setOpen(false);
 }
 };
 const handleEscape = (event) => {
 if (event.key === "Escape") {
 setOpen(false);
 }
 };
 const handleReposition = () => updateMenuPosition();
 document.addEventListener("mousedown", handlePointerDown);
 document.addEventListener("keydown", handleEscape);
 window.addEventListener("resize", handleReposition);
 window.addEventListener("scroll", handleReposition, true);
 return () => {
 document.removeEventListener("mousedown", handlePointerDown);
 document.removeEventListener("keydown", handleEscape);
 window.removeEventListener("resize", handleReposition);
 window.removeEventListener("scroll", handleReposition, true);
 };
 }, [open, updateMenuPosition]);

 if (!links.length) return null;
 const isModuleActive = links.some((link) => location.pathname === link.path || location.pathname.startsWith(`${link.path}/`));

 return (
 <div className="hidden md:block">
 <button
 ref={buttonRef}
 type="button"
 onClick={() => setOpen((prev) => !prev)}
 className={clsx(
 "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors duration-150 lg:text-[13px]",
  open || isModuleActive
 ? "border-[var(--action)] bg-[var(--selected)] text-[var(--action)]"
 : "border-[var(--border-control)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--action)] hover:text-[var(--action)]",
 )}
 aria-haspopup="true"
 aria-expanded={open}
  aria-label={`Abrir ${label}`}
 >
  <FiMoreHorizontal className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
  <span className="leading-none">{label}</span>
  <FiChevronDown className={clsx("h-3.5 w-3.5 transition-transform duration-150", open && "rotate-180")} aria-hidden="true" />
 </button>
 {open && menuStyle ? createPortal(
 <div
 ref={menuRef}
 className="fixed z-[1000] rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-popover)]"
 style={menuStyle}
  >
  <div className="mb-1 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
  {label}
  </div>
  <div className="grid gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3">
  {[
    ["Principales", groupedLinks.primary],
    ["Herramientas", groupedLinks.secondary],
    ["Administración", groupedLinks.admin],
  ].map(([title, group]) => group.length > 0 && (
  <section key={title} aria-labelledby={`nav-group-${title}`}>
  <h3 id={`nav-group-${title}`} className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{title}</h3>
  <div className="flex flex-col gap-0.5">
  {group.map((link) => (
  <NavButton key={link.path} link={link} variant={link.navVariant || "secondary"} context="popover" mobile onClick={() => setOpen(false)} globalStatusMap={globalStatusMap} />
  ))}
  </div>
  </section>
  ))}
  </div>
 </div>,
 document.body
 ) : null}
 </div>
 );
};

// Estimación de respaldo usada únicamente hasta que la fila de medición real
// (MeasureRow) entregue anchos reales — evita un "flash" de 0 items visibles.
const estimateNavLinkWidth = (link) => {
 const labelWidth = String(link?.name || "").length * 7.5;
 return Math.ceil(54 + labelWidth);
};

const OVERFLOW_BUTTON_WIDTH = 90;

// Renderiza los links reales fuera de flujo (visibility:hidden, position:absolute)
// para medir su ancho real en píxeles con el mismo markup/fuente que se mostrará.
// Esto reemplaza la estimación por longitud de texto, que subestimaba nombres largos
// (tildes, palabras largas) y provocaba que el cálculo de overflow permitiera más
// items de los que realmente cabían, forzando el squish/wrap del navbar.
const MeasureRow = ({ links, onMeasured }) => {
 const rowRef = React.useRef(null);

 React.useLayoutEffect(() => {
 if (!rowRef.current) return;
 const map = {};
 Array.from(rowRef.current.children).forEach((el) => {
 const path = el.getAttribute("data-path");
 if (path) map[path] = el.getBoundingClientRect().width;
 });
 onMeasured(map);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [links]);

 // Portal a document.body: así queda fuera del contenedor de la barra
 // y no infla su scrollWidth (un descendiente absolute/relative sí lo haría).
 return createPortal(
 <div
 ref={rowRef}
 aria-hidden="true"
 className="pointer-events-none invisible fixed left-0 top-0 flex items-center gap-1"
 >
 {links.map((link) => (
 <div key={link.path} data-path={link.path} className="inline-flex">
 <NavButton link={link} variant={link.navVariant || "primary"} />
 </div>
 ))}
 </div>,
 document.body
 );
};

const DesktopAdaptiveNav = ({ criticalLinks, primaryLinks, secondaryLinks, adminLinks, globalStatusMap }) => {
 const containerRef = React.useRef(null);
 // Único grupo siempre fijo: crítico (Inicio + lo esencial del rol, 1-3
 // ítems). Todo lo demás — primary, secondary, admin, en ese orden de
 // prioridad — es candidato a colapsar en "Más" según el espacio real
 // disponible. Antes solo secondary/admin colapsaban y primary quedaba fijo,
 // lo que producía scroll horizontal cuando un rol tenía muchos primary.
  const candidates = React.useMemo(
 () => [
 ...primaryLinks.map((link) => ({ ...link, navVariant: "primary" })),
 ...secondaryLinks.map((link) => ({ ...link, navVariant: "secondary" })),
 ...adminLinks.map((link) => ({ ...link, navVariant: "admin" })),
 ],
 [primaryLinks, secondaryLinks, adminLinks],
 );
 const allLinks = React.useMemo(
 () => [...criticalLinks, ...candidates],
 [criticalLinks, candidates],
 );
 const [measuredWidths, setMeasuredWidths] = React.useState({});
  const [, setVisibleCount] = React.useState(candidates.length);

 const handleMeasured = React.useCallback((map) => {
 setMeasuredWidths(map);
 }, []);

 const widthOf = React.useCallback(
 (link) => measuredWidths[link.path] ?? estimateNavLinkWidth(link),
 [measuredWidths],
 );

 React.useLayoutEffect(() => {
 const calculate = () => {
 if (!containerRef.current) return;
 const containerWidth = containerRef.current.getBoundingClientRect().width;
 const fixedWidth = criticalLinks.reduce((total, link) => total + widthOf(link), 0);
 const separatorsWidth = candidates.length > 0 ? 18 : 0;
 const safetyGap = 24;
 const availableForCandidates = containerWidth - fixedWidth - separatorsWidth - safetyGap;

 if (availableForCandidates <= OVERFLOW_BUTTON_WIDTH) {
 setVisibleCount(0);
 return;
 }

 let used = 0;
 let nextVisibleCount = 0;
 for (const link of candidates) {
 const linkWidth = widthOf(link);
 const hasRemaining = nextVisibleCount < candidates.length - 1;
 const reserve = hasRemaining ? OVERFLOW_BUTTON_WIDTH : 0;
 if (used + linkWidth + reserve > availableForCandidates) break;
 used += linkWidth;
 nextVisibleCount += 1;
 }
 setVisibleCount(nextVisibleCount);
 };

 calculate();
 if (typeof ResizeObserver === "undefined") {
 window.addEventListener("resize", calculate);
 return () => window.removeEventListener("resize", calculate);
 }
 const observer = new ResizeObserver(calculate);
 observer.observe(containerRef.current);
 return () => observer.disconnect();
 }, [candidates, criticalLinks, widthOf]);

  return (
 <div
 ref={containerRef}
 className="relative hidden h-10 min-w-0 flex-1 flex-nowrap items-center justify-start gap-1 overflow-x-clip overflow-y-hidden py-1 md:flex xl:gap-1.5"
 aria-label="Navegación principal"
 >
 {/* Medición real fuera de flujo: no afecta el layout visible. */}
 <MeasureRow links={allLinks} onMeasured={handleMeasured} />

 <div className="flex shrink-0 items-center justify-end gap-1 whitespace-nowrap">
 {renderGroup(criticalLinks, "critical", undefined, false, globalStatusMap)}
 </div>
  {primaryLinks.length > 0 && (
  <>
  <GroupSeparator />
  <DesktopOverflowMenu links={primaryLinks.map((link) => ({ ...link, navVariant: "primary" }))} label="Trabajo" globalStatusMap={globalStatusMap} />
  </>
  )}
  {secondaryLinks.length > 0 && (
  <>
  <GroupSeparator />
  <DesktopOverflowMenu links={secondaryLinks.map((link) => ({ ...link, navVariant: "secondary" }))} label="Herramientas" globalStatusMap={globalStatusMap} />
  </>
  )}
  {adminLinks.length > 0 && (
  <>
  <GroupSeparator />
  <DesktopOverflowMenu links={adminLinks.map((link) => ({ ...link, navVariant: "admin" }))} label="Administración" globalStatusMap={globalStatusMap} />
  </>
  )}
 </div>
 );
};

const NavigationBar = () => {
 const { user } = useAuth();
 const normalizeList = (value) => {
 if (Array.isArray(value)) {
 return value.map((item) => String(item || "").toLowerCase()).filter(Boolean);
 }
 if (!value) return [];
 return String(value)
 .split(",")
 .map((item) => item.trim().toLowerCase())
 .filter(Boolean);
 };
 const roleList = normalizeList(user?.role);
 const scopeList = normalizeList(user?.scope || user?.role);
 const role = roleList.join(",");
 const scope = scopeList[0] || roleList[0] || "";
 const { status: auditStatus } = useAuditStatus();
 const auditActive = Boolean(auditStatus?.active);
 const prefersReducedMotion = useReducedMotion();
 const [moreSheetOpen, setMoreSheetOpen] = React.useState(false);
 const filterEnabledLinks = React.useCallback(
 (links) => links.filter((link) => isPathEnabledForUser({ pathname: link.path, moduleAccess: user?.module_access || [], moduleCatalog: user?.module_catalog || [] })),
 [user?.module_access, user?.module_catalog]
 );

 // Map: link.path â†’ { stage, in_whitelist } â€” for construction/beta badges
 const globalStatusMap = React.useMemo(() => {
   const byKey = buildGlobalStatusMap(user?.module_global_status || []);
   const byPath = new Map();
   const catalog = user?.module_catalog?.length
     ? user.module_catalog.map((item) => ({ ...item, prefixes: item.path_prefixes || item.prefixes || [] }))
     : MODULE_PATH_PREFIXES;
   for (const entry of catalog || []) {
     const status = byKey.get(entry.key);
     if (status) {
       for (const p of entry.prefixes || []) byPath.set(p, status);
     }
   }
   return byPath;
 }, [user?.module_global_status, user?.module_catalog]);

 const priorityGroups = React.useMemo(
 () => {
 const base = getPriorityGroups(scope, role, auditActive, user?.extra_roles);
 return {
 critical: filterEnabledLinks(base.critical),
 primary: filterEnabledLinks(base.primary),
 secondary: filterEnabledLinks(base.secondary),
 admin: filterEnabledLinks(base.admin),
 };
 },
 [scope, role, auditActive, filterEnabledLinks, user?.extra_roles]
 );

 const closeMoreSheet = () => setMoreSheetOpen(false);
 const toggleMoreSheet = () => setMoreSheetOpen((prev) => !prev);

 // Dock inferior móvil: hasta 5 destinos totales. Si hay más módulos de los
 // que caben, el último slot se cede a "Más" (hoja con el resto, en orden de
 // prioridad — mismo orden que ya calculó getPriorityGroups).
 const allMobileLinks = React.useMemo(
 () => [
 ...priorityGroups.critical,
 ...priorityGroups.primary,
 ...priorityGroups.secondary,
 ...priorityGroups.admin,
 ],
 [priorityGroups]
 );
 const MOBILE_TAB_LIMIT = 5;
 const hasMobileOverflow = allMobileLinks.length > MOBILE_TAB_LIMIT;
 const bottomTabs = hasMobileOverflow ? allMobileLinks.slice(0, MOBILE_TAB_LIMIT - 1) : allMobileLinks;
 const moreSheetLinks = hasMobileOverflow ? allMobileLinks.slice(MOBILE_TAB_LIMIT - 1) : [];

 return (
 <>
 {/* Barra de accesos — superficie clara, en contraste deliberado con el
     Header naval de arriba (identidad oscura / navegación clara). Sin
     border-b ni línea decorativa: solo la superficie clara marca el límite
     contra el canvas de la página. */}
 <nav className="hidden border-b border-white/10 bg-[var(--nav)] md:block">
 <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
  <div className="flex min-h-12 items-center justify-between gap-4 py-1.5">
 <DesktopAdaptiveNav
 criticalLinks={priorityGroups.critical}
 primaryLinks={priorityGroups.primary}
 secondaryLinks={priorityGroups.secondary}
 adminLinks={priorityGroups.admin}
 globalStatusMap={globalStatusMap}
 />
 </div>
 </div>
 </nav>

 {/* Dock inferior móvil — reemplaza el menú hamburguesa (DESIGN.md §6) */}
 <nav
 className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/10 bg-[var(--nav)] pb-[env(safe-area-inset-bottom)] md:hidden"
 aria-label="Navegación principal"
 >
 {bottomTabs.map((link) => (
 <MobileTabLink key={link.path} link={link} globalStatusMap={globalStatusMap} />
 ))}
 {hasMobileOverflow && (
 <motion.button
 type="button"
 onClick={toggleMoreSheet}
 whileTap={prefersReducedMotion ? undefined : { scale: 0.88 }}
 aria-haspopup="menu"
 aria-expanded={moreSheetOpen}
 className={clsx(
 "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 pb-1 pt-2 text-[10px] font-medium leading-none transition-colors duration-150",
 moreSheetOpen ? "text-[var(--nav-selected-text)]" : "text-[var(--nav-text)]"
 )}
 style={{ minHeight: "var(--row-height)" }}
 >
 <FiMoreHorizontal className={clsx("h-5 w-5", moreSheetOpen ? "text-[var(--nav-marker)]" : "text-[var(--nav-text)]")} />
 <span>Más</span>
 </motion.button>
 )}
 </nav>

 {/* Hoja "Más módulos" — el resto de los accesos, fuera de las 5 pestañas.
     z-[9999]: por encima de TODOS los widgets flotantes fijos del shell
     (NotificationBell z-90, KickoffRankingFab z-89, MobileFabDock z-[9998],
     etc.) — antes el overlay quedaba en z-30 y esos botones se veían encima
     del fondo oscuro, colándose sobre la hoja. */}
 <AnimatePresence>
 {moreSheetOpen && (
 <div className="fixed inset-0 z-[9999] md:hidden" role="dialog" aria-modal="true" aria-label="Más módulos">
 <motion.div
 className="absolute inset-0 bg-black/40"
 onClick={closeMoreSheet}
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
 />
 <motion.div
 className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-overlay)]"
 style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
 initial={{ y: "100%" }}
 animate={{ y: 0 }}
 exit={{ y: "100%" }}
 transition={
 prefersReducedMotion
 ? { duration: 0 }
 : { type: "spring", stiffness: 420, damping: 38, mass: 0.8 }
 }
 >
 <div className="mb-2 flex items-center justify-between px-1">
 <span className="text-sm font-semibold text-[var(--text)]">Más módulos</span>
 <button
 type="button"
 onClick={closeMoreSheet}
 aria-label="Cerrar"
 className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--surface-subtle)]"
 >
 <FiX className="h-5 w-5" />
 </button>
 </div>
 <div className="space-y-0.5 pb-1">
 {renderGroup(moreSheetLinks, "primary", closeMoreSheet, true, globalStatusMap, "popover")}
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>
 </>
 );
};

export default NavigationBar;
