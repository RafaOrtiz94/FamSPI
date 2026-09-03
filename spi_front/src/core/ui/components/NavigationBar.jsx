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
} from "react-icons/fi";
import clsx from "clsx";

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

const crmFamAdminLinks = [
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

const famSignLink = {
 name: "FamSign",
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
 if (["jefe_ti", "admin_ti"].includes(scope) || role.includes("jefe_ti") || role.includes("admin_ti")) {
   groups.secondary.push(...crmFamAdminLinks);
 } else {
   groups.secondary.push(...crmFamLinks);
 }
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

// Componente para botones de navegación
const NavButton = ({ link, variant = "primary", mobile = false, onClick, globalStatusMap }) => {
 const moduleStatus = globalStatusMap?.get(link.path) || null;
 const showConstructionBadge = moduleStatus?.stage === 'construction' || (moduleStatus?.stage === 'testing' && !moduleStatus?.in_whitelist);
 const showBetaBadge = moduleStatus?.stage === 'testing' && moduleStatus?.in_whitelist;
 const baseClasses = mobile
 ? "flex items-center px-3 py-2 text-base font-medium rounded-md transition-colors duration-200"
 : "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-medium transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 lg:text-[13px]";

 const variantClasses = {
 critical: mobile
 ? "text-gray-900 dark:text-white"
 : "text-gray-900 dark:text-white bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800",
 primary: mobile
 ? "text-gray-700 dark:text-gray-200"
 : "text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400",
 secondary: mobile
 ? "text-gray-600 dark:text-gray-300"
 : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100",
 admin: mobile
 ? "text-gray-500 dark:text-gray-400"
 : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
 };

 return (
 <NavLink
 to={link.path}
 end
 onClick={onClick}
 className={({ isActive }) =>
 clsx(
 baseClasses,
 variantClasses[variant],
 isActive && "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
 )
 }
 >
 {({ isActive }) => (
 <>
 {React.createElement(link.icon, {
 className: clsx(
 mobile ? "mr-3 h-5 w-5 flex-shrink-0" : "mr-1.5 h-3.5 w-3.5 flex-shrink-0 lg:h-4 lg:w-4",
 isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
 )
 })}
 <span className="truncate leading-none">{link.name}</span>
 {showConstructionBadge && (
   <span className="ml-1.5 flex-shrink-0 text-xs bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-semibold leading-none">🚧</span>
 )}
 {showBetaBadge && (
   <span className="ml-1.5 flex-shrink-0 text-xs bg-violet-100 text-violet-700 rounded-full px-1.5 py-0.5 font-semibold leading-none">Beta</span>
 )}
 </>
 )}
 </NavLink>
 );
};

// Separador visual entre grupos
const GroupSeparator = () => (
 <div className="mx-1 hidden h-5 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent dark:via-slate-600 xl:block" />
);

const renderGroup = (links, variant, onClick, isMobile, globalStatusMap) =>
 links.map((link) => (
 <NavButton
 key={link.path}
 link={link}
 variant={variant}
 mobile={isMobile}
 onClick={onClick}
 globalStatusMap={globalStatusMap}
 />
 ));

const DesktopOverflowMenu = ({ links, globalStatusMap }) => {
 const [open, setOpen] = React.useState(false);
 const buttonRef = React.useRef(null);
 const menuRef = React.useRef(null);
 const [menuStyle, setMenuStyle] = React.useState(null);
 const location = useLocation();

 const updateMenuPosition = React.useCallback(() => {
 if (!buttonRef.current || typeof window === "undefined") return;
 const rect = buttonRef.current.getBoundingClientRect();
 const width = Math.min(360, window.innerWidth - 32);
 const left = Math.min(Math.max(16, rect.right - width), window.innerWidth - width - 16);
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

 return (
 <div className="hidden md:block">
 <button
 ref={buttonRef}
 type="button"
 onClick={() => setOpen((prev) => !prev)}
 className={clsx(
 "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-all duration-200 lg:text-[13px]",
 open
 ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm"
 : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
 )}
 aria-haspopup="menu"
 aria-expanded={open}
 >
 <FiMoreHorizontal className={clsx("h-4 w-4 flex-shrink-0", open ? "text-blue-600" : "text-slate-500")} />
 <span className="leading-none">Más</span>
 </button>
 {open && menuStyle ? createPortal(
 <div
 ref={menuRef}
 className="fixed z-[1000] rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)]"
 style={menuStyle}
 role="menu"
 >
 <div className="mb-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
 Más módulos
 </div>
 <div className="flex flex-col gap-1">
 {links.map((link) => (
 <NavButton
 key={link.path}
 link={link}
 variant="secondary"
 mobile
 onClick={() => setOpen(false)}
 globalStatusMap={globalStatusMap}
 />
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

 // Portal a document.body: así queda fuera del contenedor con overflow-x-auto
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
 const candidates = React.useMemo(
 () => [
 ...secondaryLinks.map((link) => ({ ...link, navVariant: "secondary" })),
 ...adminLinks.map((link) => ({ ...link, navVariant: "admin" })),
 ],
 [secondaryLinks, adminLinks],
 );
 const allLinks = React.useMemo(
 () => [...criticalLinks, ...primaryLinks, ...candidates],
 [criticalLinks, primaryLinks, candidates],
 );
 const [measuredWidths, setMeasuredWidths] = React.useState({});
 const [visibleCount, setVisibleCount] = React.useState(candidates.length);

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
 const fixedLinks = [...criticalLinks, ...primaryLinks];
 const fixedWidth = fixedLinks.reduce((total, link) => total + widthOf(link), 0);
 const separatorsWidth = (primaryLinks.length > 0 ? 18 : 0) + (candidates.length > 0 ? 18 : 0);
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
 }, [adminLinks, candidates, criticalLinks, primaryLinks, secondaryLinks, widthOf]);

 const visibleCandidates = candidates.slice(0, visibleCount);
 const overflowLinks = candidates.slice(visibleCount);

 return (
 <div
 ref={containerRef}
 className="relative hidden h-10 min-w-0 flex-1 flex-nowrap items-center justify-start gap-1 overflow-x-auto overflow-y-hidden py-1 md:flex xl:gap-1.5"
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
 <div className="flex shrink-0 items-center justify-end gap-1 whitespace-nowrap">
 {renderGroup(primaryLinks, "primary", undefined, false, globalStatusMap)}
 </div>
 </>
 )}
 {(visibleCandidates.length > 0 || overflowLinks.length > 0) && (
 <>
 <GroupSeparator />
 <div className="flex shrink-0 items-center justify-start gap-1 whitespace-nowrap">
 {visibleCandidates.map((link) => (
 <NavButton
 key={link.path}
 link={link}
 variant={link.navVariant}
 globalStatusMap={globalStatusMap}
 />
 ))}
 {overflowLinks.length > 0 && (
 <DesktopOverflowMenu links={overflowLinks} globalStatusMap={globalStatusMap} />
 )}
 </div>
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
 const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
 const filterEnabledLinks = React.useCallback(
 (links) => links.filter((link) => isPathEnabledForUser({ pathname: link.path, moduleAccess: user?.module_access || [] })),
 [user?.module_access]
 );

 // Map: link.path â†’ { stage, in_whitelist } â€” for construction/beta badges
 const globalStatusMap = React.useMemo(() => {
   const byKey = buildGlobalStatusMap(user?.module_global_status || []);
   const byPath = new Map();
   for (const entry of MODULE_PATH_PREFIXES || []) {
     const status = byKey.get(entry.key);
     if (status) {
       for (const p of entry.prefixes || []) byPath.set(p, status);
     }
   }
   return byPath;
 }, [user?.module_global_status]);

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
 const toggleMobileMenu = () => {
 setMobileMenuOpen(!mobileMenuOpen);
 };

 const closeMobileMenu = () => {
 setMobileMenuOpen(false);
 };

 return (
 <nav className="border-b border-slate-200 bg-white">
 <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
 <div className="flex min-h-16 items-center justify-between gap-4 py-2">

 <DesktopAdaptiveNav
 criticalLinks={priorityGroups.critical}
 primaryLinks={priorityGroups.primary}
 secondaryLinks={priorityGroups.secondary}
 adminLinks={priorityGroups.admin}
 globalStatusMap={globalStatusMap}
 />

 {/* Mobile menu button */}
 <div className="ml-auto md:hidden">
 <button
 type="button"
 onClick={toggleMobileMenu}
 className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
 aria-controls="mobile-menu"
 aria-expanded={mobileMenuOpen}
 >
 <span className="sr-only">Abrir navegación</span>
 <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
 </svg>
 </button>
 </div>
 </div>
 </div>

 {/* Mobile menu */}
 {mobileMenuOpen && (
 <div className="md:hidden" id="mobile-menu">
 <div className="space-y-1 border-t border-slate-200 bg-slate-50 px-2 pb-3 pt-2">
 {renderGroup(priorityGroups.critical, "critical", closeMobileMenu, true, globalStatusMap)}

 {priorityGroups.primary.length > 0 && (
 <>
 <div className="my-2 border-t border-slate-200" />
 {renderGroup(priorityGroups.primary, "primary", closeMobileMenu, true, globalStatusMap)}
 </>
 )}

 {priorityGroups.secondary.length > 0 && (
 <>
 <div className="my-2 border-t border-slate-200" />
 {renderGroup(priorityGroups.secondary, "secondary", closeMobileMenu, true, globalStatusMap)}
 </>
 )}

 {priorityGroups.admin.length > 0 && (
 <>
 <div className="my-2 border-t border-slate-200" />
 {renderGroup(priorityGroups.admin, "admin", closeMobileMenu, true, globalStatusMap)}
 </>
 )}
 </div>
 </div>
 )}
 </nav>
 );
};

export default NavigationBar;
