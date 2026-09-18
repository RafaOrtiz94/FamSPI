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

// Categoría funcional de cada link — de qué se trata, no qué tan seguido lo
// usa un rol. Reemplaza el criterio anterior (el botón donde aparecía un
// link dependía de su prioridad por rol, así que "CRM-FAM"/"Work Management"
// caían en "Trabajo" para comercial pero en "Herramientas" para gerencia:
// mismo link, dos ubicaciones distintas según quién mirara). El orden acá
// define el orden de los botones en la barra.
const CATEGORY_META = {
  ventas: { label: "Ventas", dot: "bg-[var(--info-text)]" },
  "compras-equipos": { label: "Compras y Equipos", dot: "bg-[var(--success-text)]" },
  "servicio-tecnico": { label: "Servicio Técnico", dot: "bg-[var(--warning-text)]" },
  personas: { label: "Personas", dot: "bg-[var(--action)]" },
  finanzas: { label: "Finanzas", dot: "bg-[var(--danger-text)]" },
  administracion: { label: "Administración", dot: "bg-[var(--text-secondary)]" },
  ti: { label: "TI", dot: "bg-[var(--info-text)]" },
  herramientas: { label: "Herramientas", dot: "bg-[var(--success-text)]" },
  reportes: { label: "Reportes", dot: "bg-[var(--text-secondary)]" },
};
const CATEGORY_ORDER = ["ventas", "compras-equipos", "servicio-tecnico", "personas", "finanzas", "administracion", "ti", "herramientas", "reportes"];

const comercialLinks = [
  {
    name: "Solicitudes",
    icon: FiClipboard,
    path: "/dashboard/comercial/solicitudes",
    category: "ventas",
  },
  {
    name: "Clientes",
    icon: FiUsers,
    path: "/dashboard/comercial/clientes",
    category: "ventas",
  },
];

const clientsManagementLink = {
  name: "Clientes",
  icon: FiUsers,
  path: "/dashboard/operaciones/clientes",
  category: "ventas",
};

// "comercial"/"jefe_comercial" NO van aqui: ya los captura la rama anterior
// (scope === "comercial" || scope === "jefe_comercial"), asi que incluirlos
// en este set los volvia código muerto -- el bloque de abajo nunca corria
// para ellos pese a tener deliveryCeilingsLink/aprobacionesPlanLink/orden
// distinto, dos definiciones divergentes para el mismo rol.
const comercialScopes = ["acp_comercial", "backoffice", "backoffice_comercial"];

const crmFamLinks = [
  { name: "CRM-FAM", icon: FiTarget, path: "/dashboard/crm-fam", category: "herramientas" },
];

const aprobacionesPlanLink = {
  name: "Aprobación de planes",
  icon: FiCheckCircle,
  path: "/dashboard/comercial/aprobaciones-planificacion",
  category: "ventas",
};

const businessCaseLink = {
  name: "Business Case",
  icon: FiFileText,
  path: "/dashboard/business-case",
  category: "ventas",
};

// Solo jefe_comercial administra la plantilla base del BC (ver
// businessCaseTemplateVersions.routes.js, requireRole(["jefe_comercial"])).
const bcTemplateLink = {
  name: "Plantilla base BC",
  icon: FiFileText,
  path: "/dashboard/comercial/plantilla-bc",
  category: "ventas",
};

const famSheetsLink = {
  name: "FamSheets",
  icon: FiBookOpen,
  path: "/dashboard/comercial/famsheets",
  category: "ventas",
};

const deliveryCeilingsLink = {
  name: "Maximos y Saldos",
  icon: FiLayers,
  path: "/dashboard/comercial/delivery-ceilings",
  category: "ventas",
};

const businessCaseObservabilityLink = {
  name: "Obs. BC",
  icon: FiActivity,
  path: "/dashboard/business-case/observabilidad",
  category: "reportes",
};

const linksInteresLink = {
  name: "Links de Interés",
  icon: FiBookOpen,
  path: "/dashboard/links-interes",
  category: "herramientas",
};

const purchasesWorkspaceLink = {
  name: "Workspace de Compras",
  icon: FiShoppingCart,
  path: "/dashboard/purchases/workspace",
  category: "compras-equipos",
};

const workManagementLink = {
  name: "Work Management",
  icon: FiGrid,
  path: "/dashboard/work-management",
  category: "herramientas",
};

const equipmentWorkspaceLink = {
  name: "Workspace de Equipos",
  icon: FiCpu,
  path: "/dashboard/equipos",
  category: "compras-equipos",
};

const servicioCronogramaLink = {
  name: "Cronograma Tecnico",
  icon: FiCalendar,
  path: "/dashboard/servicio-tecnico/cronograma",
  category: "servicio-tecnico",
};

const servicioInspeccionesLink = {
  name: "Inspecciones de Ambiente",
  icon: FiClipboard,
  path: "/dashboard/servicio-tecnico/inspecciones",
  category: "servicio-tecnico",
};

const servicioMantenimientosLink = {
  name: "Mantenimientos",
  icon: FiTool,
  path: "/dashboard/servicio-tecnico/mantenimientos",
  category: "servicio-tecnico",
};

const servicioSolicitudesLink = {
  name: "Solicitudes",
  icon: FiLayers,
  path: "/dashboard/servicio-tecnico/solicitudes",
  category: "servicio-tecnico",
};

const servicioAplicacionesLink = {
  name: "Aplicaciones ST",
  icon: FiShield,
  path: "/dashboard/servicio-tecnico/aplicaciones",
  category: "servicio-tecnico",
};

const servicioDisponibilidadLink = {
  name: "Disponibilidad",
  icon: FiUsers,
  path: "/dashboard/servicio-tecnico/disponibilidad",
  category: "servicio-tecnico",
};

const servicioAsistenciaLink = {
  name: "Asistencia y Salidas",
  icon: FiCheckCircle,
  path: "/dashboard/servicio-tecnico/asistencia",
  category: "servicio-tecnico",
};

const servicioCasosExternosLink = {
  name: "Casos Externos",
  icon: FiFileText,
  path: "/dashboard/servicio-tecnico/casos-externos",
  category: "servicio-tecnico",
};

const gerenciaContractApprovalsLink = {
  name: "Album de Compras",
  icon: FiCheckCircle,
  path: "/dashboard/gerencia/compras-album",
  category: "compras-equipos",
};

const talentoLinks = [
  {
    name: "Colaboradores",
    icon: FiUsers,
    path: "/dashboard/talento-humano/colaboradores",
    category: "personas",
  },
];

const peopleAdminLink = {
  name: "Usuarios y Departamentos",
  icon: FiSettings,
  path: "/dashboard/talento-humano/gestion",
  category: "administracion",
};

const auditLinks = [
  {
    name: "Auditoría y Trazabilidad",
    icon: FiFileText,
    path: "/dashboard/auditoria",
    category: "administracion",
  },
];

const permisosLink = {
  name: "Permisos y Vacaciones",
  icon: FiCalendar,
  path: "/dashboard/talento-humano/permisos",
  category: "personas",
};

const asistenciaReportesLink = {
  name: "Asistencia Reportes",
  icon: FiClipboard,
  path: "/dashboard/talento-humano/asistencia-reportes",
  category: "personas",
};

const pruebasTecnicasLink = {
  name: "Gestor de pruebas asignadas",
  icon: FiCheckCircle,
  path: "/dashboard/talento-humano/pruebas-tecnicas",
  category: "personas",
};

const solicitudesTalentoLink = {
  name: "Solicitudes",
  icon: FiList,
  path: "/dashboard/talento-humano/solicitudes",
  category: "personas",
};

const capacitacionesLink = {
  name: "Capacitaciones",
  icon: FiAward,
  path: "/dashboard/capacitaciones",
  category: "personas",
};

const firmaLink = {
  name: "Firma Digital",
  icon: FiCheckSquare,
  path: "/dashboard/signatures/inbox",
  category: "herramientas",
};

const clientRequestsReviewLink = {
  name: "Solicitudes Cliente",
  icon: FiClipboard,
  path: "/dashboard/backoffice/client-requests",
  category: "ventas",
};

// Cartera de clientes para backoffice_comercial via extra_roles (ver
// migrations/276_users_extra_roles.sql, ej. lorena.loaiza). Misma
// ClientesPage que usan comercial/operaciones, montada en su propia ruta
// (ver AppRoutes.jsx) para no ampliar el resto de subrutas comerciales.
const clientRequestsPortfolioLink = {
  name: "Clientes",
  icon: FiUsers,
  path: "/dashboard/backoffice/clientes",
  category: "ventas",
};

// Resumen de solo-lectura de Business Case (jefe_calidad y, via extra_roles,
// lorena.loaiza@fam-project.com -- ver businessCase.routes.js).
const bcQualitySummaryLink = {
  name: "Business Case (resumen)",
  icon: FiClipboard,
  path: "/dashboard/business-case/resumen",
  category: "reportes",
};

const viaticosLink = {
  name: "Workspace Viaticos",
  icon: FiDollarSign,
  path: "/dashboard/finanzas/viaticos",
  category: "finanzas",
};

const auditPrepLink = {
  name: "Preparación Auditoría",
  icon: FiShield,
  path: "/dashboard/auditoria/preparacion",
  category: "administracion",
};

const tiWorkspaceLink = {
  name: "Workspace TI",
  icon: FiLifeBuoy,
  path: "/dashboard/ti/workspace",
  category: "ti",
};

const kickoffLink = {
  name: "Kick Off 2026",
  icon: FiCalendar,
  path: "/dashboard/kickoff",
  category: "herramientas",
};

const famDaysLink = {
  name: "FamDays",
  icon: FiCalendar,
  path: "/dashboard/famdays",
  category: "herramientas",
};

const tiDevicesLink = {
  name: "Dispositivos TI",
  icon: FiCpu,
  path: "/dashboard/ti/dispositivos",
  category: "ti",
};
const tiModulesLink = {
  name: "Modulos por Usuario",
  icon: FiSettings,
  path: "/dashboard/ti/modulos",
  category: "administracion",
};
const tiShortcutTokenLink = {
  name: "Token Shortcut Siri",
  icon: FiKey,
  path: "/dashboard/ti/shortcut-token",
  category: "ti",
};

const collabEntregasLink = {
  name: "Entregas Colaboradores",
  icon: FiList,
  path: "/dashboard/collab/entregas",
  category: "compras-equipos",
};

const collabResumenLink = {
  name: "Entregas Colaboradores",
  icon: FiList,
  path: "/dashboard/collab/resumen",
  category: "compras-equipos",
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
      firmaLink,
      permisosLink,
      linksInteresLink
    );
    if (scope === "jefe_comercial") {
      groups.primary.push(bcTemplateLink);
    }
  }

  // 💼 COMERCIAL - Roles de apoyo (acp_comercial, backoffice, backoffice_comercial).
  // comercial/jefe_comercial ya tienen su propio bloque arriba: este set de
  // scopes (comercialScopes) los excluye a proposito, asi que las listas de
  // roles permitidos que antes vivian aqui siempre se resolvian true para los
  // tres scopes que de verdad llegan a esta rama -- se quita la variable
  // muerta y se deja la asignacion directa.
  else if (comercialScopes.includes(scope)) {
    groups.critical.push(...comercialLinks); // Solicitudes y clientes (clientes tab incluye planificacion)
    groups.primary.unshift(purchasesWorkspaceLink); // Workspace primero en primary
    groups.primary.push(equipmentWorkspaceLink);
    groups.primary.push(deliveryCeilingsLink);
    groups.primary.push(workManagementLink);

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
    if (["talento_humano", "talento-humano"].includes(scope)) groups.primary.push(collabEntregasLink);
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
// Sin chips: nada de bordes/pills flotando sobre la barra. Todo item —
// crítico o dentro de un dropdown— es un link plano que solo gana un fondo
// sutil en hover/activo (mismo patrón que navigationMenuTriggerStyle de
// shadcn: bg-transparent en reposo, bg-accent/50 en hover o activo).
const NavButton = ({ link, variant = "primary", mobile = false, context = "nav", onClick, globalStatusMap }) => {
  const moduleStatus = globalStatusMap?.get(link.path) || null;
  const showConstructionBadge = moduleStatus?.stage === 'construction' || (moduleStatus?.stage === 'testing' && !moduleStatus?.in_whitelist);
  const showBetaBadge = moduleStatus?.stage === 'testing' && moduleStatus?.in_whitelist;
  const isPopover = context === "popover";

  const baseClasses = mobile
    ? "flex items-center gap-3 rounded-md px-2.5 py-2 text-[15px] font-medium transition-colors duration-150 active:bg-[var(--surface-subtle)]"
    : "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 lg:text-[13px]";

  // Jerarquía por peso de texto, no por caja: crítico va en semibold, el
  // resto en regular — la única caja que existe es el fondo plano de
  // hover/activo, compartido por todos los tiers.
  const navTierClasses = {
    critical: "text-[var(--text)] font-semibold hover:bg-[var(--surface-subtle)]",
    primary: "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]",
    secondary: "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]",
    admin: "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]",
  };
  const popoverTierClasses = {
    critical: "text-[var(--text)] font-semibold hover:bg-[var(--surface-subtle)]",
    primary: "text-[var(--text)] hover:bg-[var(--surface-subtle)]",
    secondary: "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]",
    admin: "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]",
  };

  return (
    <NavLink
      to={link.path}
      end
      onClick={onClick}
      className={({ isActive }) =>
        clsx(
          baseClasses,
          isPopover ? popoverTierClasses[variant] : navTierClasses[variant],
          isActive && "bg-[var(--selected)] text-[var(--action)] font-semibold"
        )
      }
    >
      {({ isActive }) => (
        <>
          {React.createElement(link.icon, {
            className: clsx(
              mobile ? "h-5 w-5 flex-shrink-0" : "h-3.5 w-3.5 flex-shrink-0 lg:h-4 lg:w-4",
              isActive ? "text-[var(--action)]" : "text-[var(--text-secondary)]"
            )
          })}
          <span className="truncate leading-none">{link.name}</span>
          {showConstructionBadge && (
            <span className="flex-shrink-0 rounded-md bg-[var(--warning-bg)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--warning-text)]">🚧</span>
          )}
          {showBetaBadge && (
            <span className="flex-shrink-0 rounded-md bg-[var(--info-bg)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--info-text)]">Beta</span>
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
          isActive ? "text-[var(--action)]" : "text-[var(--text-secondary)]"
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
              className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-[var(--action)]"
            />
          )}
          <motion.span
            className="relative"
            whileTap={prefersReducedMotion ? undefined : { scale: 0.82 }}
            transition={{ duration: 0.12 }}
          >
            {React.createElement(link.icon, {
              className: clsx("h-5 w-5", isActive ? "text-[var(--action)]" : "text-[var(--text-secondary)]"),
            })}
            {(showConstructionBadge || showBetaBadge) && (
              <span
                className={clsx(
                  "absolute -right-1 -top-1 h-2 w-2 rounded-full ring-1 ring-[var(--surface)]",
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

// Duración/easing del dropdown tomados de DESIGN.md (animation.durationDropdown
// / animation.easingOut) — no se inventan valores nuevos fuera del sistema.
const DROPDOWN_TRANSITION = { duration: 0.16, ease: [0.2, 0.8, 0.2, 1] };

// Un botón por categoría funcional (Ventas, Compras y Equipos, Personas...)
// en vez de por prioridad. Cada botón solo contiene links de SU categoría,
// así que ya no hace falta sub-agrupar dentro del dropdown -- el label del
// botón y el contenido siempre son coherentes entre sí y entre roles.
const DesktopOverflowMenu = ({ links, globalStatusMap, label, dotClass }) => {
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const [menuStyle, setMenuStyle] = React.useState(null);
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const dropdownTransition = prefersReducedMotion ? { duration: 0 } : DROPDOWN_TRANSITION;

  const updateMenuPosition = React.useCallback(() => {
    if (!buttonRef.current || typeof window === "undefined") return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 32);
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
      <motion.button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
        transition={{ duration: 0.1 }}
        className={clsx(
          // Sin borde: mismo tratamiento plano que el resto de los items de la
          // barra -- fondo transparente en reposo, --selected en hover/abierto.
          "inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 lg:text-[13px]",
          open || isModuleActive
            ? "bg-[var(--selected)] text-[var(--action)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]",
        )}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Abrir ${label}`}
      >
        <span className={clsx("h-1.5 w-1.5 flex-shrink-0 rounded-full", dotClass)} aria-hidden="true" />
        <span className="leading-none">{label}</span>
        <FiChevronDown className={clsx("h-3.5 w-3.5 transition-transform duration-150", open && "rotate-180")} aria-hidden="true" />
      </motion.button>
      {menuStyle ? createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              className="fixed z-[1000] rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-popover)]"
              style={menuStyle}
              initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.97, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.97, y: -4 }}
              transition={dropdownTransition}
            >
              <div className="mb-1 flex items-center gap-2 border-b border-[var(--border)] px-1.5 pb-2">
                <span className={clsx("h-1.5 w-1.5 rounded-full", dotClass)} aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{label}</span>
              </div>
              <div className="flex flex-col gap-0.5 p-1">
                {links.map((link) => (
                  <NavButton key={link.path} link={link} variant="primary" context="popover" mobile onClick={() => setOpen(false)} globalStatusMap={globalStatusMap} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
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
    () => [...primaryLinks, ...secondaryLinks, ...adminLinks],
    [primaryLinks, secondaryLinks, adminLinks],
  );
  // Botones de la barra agrupados por categoría funcional (no por prioridad
  // de rol) -- CATEGORY_ORDER fija un orden estable para que, por ejemplo,
  // "Ventas" siempre aparezca antes que "Administración" sin importar qué
  // rol esté mirando la barra.
  const categoryBuckets = React.useMemo(() => {
    const byCategory = new Map();
    for (const link of candidates) {
      const key = link.category || "herramientas";
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key).push(link);
    }
    return CATEGORY_ORDER
      .map((key) => [key, byCategory.get(key) || []])
      .filter(([, group]) => group.length > 0);
  }, [candidates]);
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
      {categoryBuckets.map(([key, group]) => (
        <React.Fragment key={key}>
          <GroupSeparator />
          <DesktopOverflowMenu links={group} label={CATEGORY_META[key].label} dotClass={CATEGORY_META[key].dot} globalStatusMap={globalStatusMap} />
        </React.Fragment>
      ))}
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
  // Misma categorización funcional que los botones de escritorio, así la
  // hoja "Más módulos" del dock móvil no es una lista suelta sino las
  // mismas secciones (Ventas, Compras y Equipos, Personas...).
  const moreSheetGroups = React.useMemo(() => {
    const byCategory = new Map();
    for (const link of moreSheetLinks) {
      const key = link.category || "herramientas";
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key).push(link);
    }
    return CATEGORY_ORDER
      .map((key) => [key, byCategory.get(key) || []])
      .filter(([, group]) => group.length > 0);
  }, [moreSheetLinks]);

  return (
    <>
      {/* Barra de accesos — superficie clara (--surface), en contraste
     deliberado con el Header naval de arriba (identidad oscura /
     navegación clara). Antes usaba --nav (navy oscuro), lo que dejaba dos
     franjas oscuras apiladas y obligaba a cada item a simular "chips"
     claros para poder leerse encima -- con superficie clara los items
     vuelven a ser texto plano. */}
      <nav className="hidden border-b border-[var(--border)] bg-[var(--surface)] md:block">
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
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] md:hidden"
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
              moreSheetOpen ? "text-[var(--action)]" : "text-[var(--text-secondary)]"
            )}
            style={{ minHeight: "var(--row-height)" }}
          >
            <FiMoreHorizontal className={clsx("h-5 w-5", moreSheetOpen ? "text-[var(--action)]" : "text-[var(--text-secondary)]")} />
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
              <div className="space-y-3 pb-1">
                {moreSheetGroups.map(([key, group]) => (
                  <section key={key} aria-labelledby={`more-sheet-group-${key}`}>
                    <h3 id={`more-sheet-group-${key}`} className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                      <span className={clsx("h-1.5 w-1.5 rounded-full", CATEGORY_META[key].dot)} aria-hidden="true" />
                      {CATEGORY_META[key].label}
                    </h3>
                    <div className="space-y-0.5">
                      {renderGroup(group, "primary", closeMoreSheet, true, globalStatusMap, "popover")}
                    </div>
                  </section>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default NavigationBar;