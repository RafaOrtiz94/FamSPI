import React from "react";
import { NavLink } from "react-router-dom";
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
  FiTruck,
  FiLifeBuoy,
} from "react-icons/fi";
import clsx from "clsx";

import { useAuth } from "../../auth/AuthContext";
import useAuditStatus from "../../hooks/useAuditStatus";

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
  jefe_servicio_tecnico: "/dashboard/servicio-tecnico",
  tecnico: "/dashboard/servicio-tecnico",
  talento_humano: "/dashboard/talento-humano",
  "talento-humano": "/dashboard/talento-humano",
  jefe_talento_humano: "/dashboard/talento-humano",
  ti: "/dashboard/ti",
  jefe_ti: "/dashboard/ti",
  admin_ti: "/dashboard/ti",
  operaciones: "/dashboard/operaciones",
  jefe_operaciones: "/dashboard/operaciones",
  logistica: "/dashboard/logistica",
  jefe_logistica: "/dashboard/logistica",
  calidad: "/dashboard/calidad",
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

const planificacionLink = {
  name: "Planificación",
  icon: FiCalendar,
  path: "/dashboard/comercial/planificacion",
};

const comercialScopes = ["comercial", "acp_comercial", "backoffice", "backoffice_comercial"];


const aprobacionesPlanLink = {
  name: "Aprobación de planes",
  icon: FiCheckCircle,
  path: "/dashboard/comercial/aprobaciones-planificacion",
};

const privatePurchasesLink = {
  name: "Compras Privadas",
  icon: FiLayers,
  path: "/dashboard/backoffice/private-purchases",
};

const publicPurchasesLink = {
  name: "Compras Públicas",
  icon: FiShoppingCart,
  path: "/dashboard/comercial/equipment-purchases",
};

const businessCaseLink = {
  name: "Business Case",
  icon: FiFileText,
  path: "/dashboard/business-case",
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


const gerenciaContractApprovalsLink = {
  name: "Album de Compras",
  icon: FiCheckCircle,
  path: "/dashboard/gerencia/compras-album",
};

const logisticaPurchasesLink = {
  name: "Compras Privadas",
  icon: FiTruck,
  path: "/dashboard/logistica/private-purchases",
};

const talentoLinks = [
  {
    name: "Colaboradores",
    icon: FiUsers,
    path: "/dashboard/talento-humano/colaboradores",
  },
];

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

const servicioLinks = [
  {
    name: "Workspace Procedimiento",
    icon: FiShoppingCart,
    path: "/dashboard/servicio-tecnico/workspace-procedimiento",
  },
  {
    name: "Mantenimientos",
    icon: FiTool,
    path: "/dashboard/servicio-tecnico/mantenimientos",
  },
  {
    name: "Solicitudes",
    icon: FiList,
    path: "/dashboard/servicio-tecnico/solicitudes",
  },
  {
    name: "Disponibilidad",
    icon: FiUsers,
    path: "/dashboard/servicio-tecnico/disponibilidad",
  },
  {
    name: "Capacitaciones",
    icon: FiBookOpen,
    path: "/dashboard/servicio-tecnico/capacitaciones",
  },
  {
    name: "Equipos",
    icon: FiCpu,
    path: "/dashboard/servicio-tecnico/equipos",
  },
  {
    name: "Aprobaciones",
    icon: FiCheckCircle,
    path: "/dashboard/servicio-tecnico/aprobaciones",
  },
  {
    name: "Aplicaciones",
    icon: FiFileText,
    path: "/dashboard/servicio-tecnico/aplicaciones",
  },
  {
    name: "Desinfección",
    icon: FiShield,
    path: "/dashboard/servicio-tecnico/desinfeccion",
  },
  {
    name: "Asistencia",
    icon: FiCheckCircle,
    path: "/dashboard/servicio-tecnico/asistencia",
  },
  {
    name: "Verificación",
    icon: FiClipboard,
    path: "/dashboard/servicio-tecnico/verificacion",
  },
];

const deliveryActsLink = {
  name: "Compras privadas",
  icon: FiFileText,
  path: "/dashboard/servicio-tecnico/compras-privadas",
};

const privateDeliveriesLink = {
  name: "Entregas privadas",
  icon: FiTruck,
  path: "/dashboard/servicio-tecnico/entregas-privadas",
};

// Sistema de prioridades por rol
const getPriorityGroups = (scope, role, auditActive) => {
  const groups = {
    critical: [], // ðŸ”¥ Funciones crÃ­ticas diarias - siempre visibles
    primary: [],  // ðŸŸ¡ Funciones principales del rol
    secondary: [], // ðŸ”µ Funciones especÃ­ficas/secundarias
    admin: []     // âš« Funciones administrativas/menos usadas
  };

  // Siempre incluir inicio como crÃ­tico
  groups.critical.push(getHomeLink(scope));

  // 📊 GERENCIA - Enfoque en control y supervisión
  if (["gerencia", "gerencia_general", "gerente_general", "director"].includes(scope)) {
    groups.critical.push(businessCaseLink, aprobacionesPlanLink); // Estrategia y Control
    groups.primary.push(gerenciaContractApprovalsLink, permisosLink, auditLinks[0]); // Gestión de personal y Auditoría
    groups.secondary.push(auditPrepLink); // Preparación
    groups.admin.push(...talentoLinks); // Gestión administrativa
  }

  // ðŸ’° FINANZAS - Control presupuestario
  else if (["finanzas", "jefe_finanzas", "jefe_financiero", "financiero"].includes(scope)) {
    groups.primary.push(viaticosLink, asistenciaReportesLink, businessCaseLink, permisosLink); // Control financiero principal
    if (auditActive) groups.secondary.push(auditPrepLink);
  }

  // ðŸ’¼ COMERCIAL - Flujo de ventas completo
  else if (comercialScopes.includes(scope)) {
    groups.critical.push(...comercialLinks); // Solicitudes y clientes cr????ticos
    // Ocultar planificación para backoffice y acp_comercial (sea por scope o por rol)
    const isBackoffice = String(scope || "").includes("backoffice") || role.includes("backoffice");
    const isAcp = scope === "acp_comercial" || role.includes("acp_comercial");

    if (!isBackoffice && !isAcp) {
      groups.primary.push(planificacionLink); // Planificación mensual
    }

    // UNIFICACIÃ“N: Solo Workspace de Compras - Roles segÃºn AppRoutes.jsx
    const workspaceAllowedRoles = [
      "comercial", "jefe_comercial", "acp_comercial", "gerencia",
      "gerencia_general", "jefe_operaciones", "jefe_logistica", "backoffice_comercial"
    ];

    if (workspaceAllowedRoles.includes(scope) || role.includes("backoffice")) {
      groups.primary.unshift(purchasesWorkspaceLink); // Workspace primero en primary
    }

    if (["jefe_comercial"].includes(scope)) {
      groups.primary.push(aprobacionesPlanLink);
    }

    groups.secondary.push(businessCaseLink); // Business Case queda en secondary
    groups.admin.push(permisosLink, viaticosLink);
  }

  // ðŸ”§ SERVICIO TÃ‰CNICO - Operaciones tÃ©cnicas
  else if (["servicio_tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "tecnico"].includes(scope)) {
    groups.critical.push(
      servicioLinks.find(l => l.name === "Workspace Procedimiento"),
      purchasesWorkspaceLink,
    );
    groups.primary.push(
      privateDeliveriesLink,
      deliveryActsLink,
    );
    groups.secondary.push(viaticosLink);
  }

  // TALENTO HUMANO - Gestión de personal
  else if (["talento-humano", "talento_humano", "jefe_talento_humano"].includes(scope)) {
    groups.primary.push(permisosLink, asistenciaReportesLink, ...talentoLinks);
  }

  // ðŸŽ¯ TI - TecnologÃ­a y auditorÃ­a
  else if (["ti", "jefe_ti", "admin_ti"].includes(scope)) {
    groups.critical.push(tiWorkspaceLink);
    groups.primary.push(...talentoLinks, ...auditLinks);
    if (auditActive) groups.primary.push(auditPrepLink);
  }

  // âš™ï¸ OPERACIONES - Procesos operativos
  else if (["operaciones", "jefe_operaciones"].includes(scope)) {
    groups.primary.push(purchasesWorkspaceLink);
    groups.secondary.push(businessCaseLink);
    if (auditActive) groups.secondary.push(auditPrepLink);
  }

  // 📦 LOGISTICA - Despachos y actas
  else if (["logistica", "jefe_logistica"].includes(scope)) {
    groups.primary.push(logisticaPurchasesLink);
  }

  // ðŸŽ¨ CALIDAD - Control de calidad
  else if (["calidad"].includes(scope)) {
    if (auditActive) groups.primary.push(auditPrepLink);
  }

  // ðŸ¢ BACKOFFICE - Soporte administrativo
  else if (role.includes("backoffice")) {
    groups.primary.push(privatePurchasesLink, publicPurchasesLink);
    groups.secondary.push(...comercialLinks);
  }

  groups.secondary.push(linksInteresLink);

  // Filtrar elementos vacÃ­os y aplanar arrays
  Object.keys(groups).forEach(key => {
    groups[key] = groups[key].filter(Boolean);
  });

  return groups;
};





// Componente para botones de navegación
const NavButton = ({ link, variant = "primary", mobile = false, onClick }) => {
  const baseClasses = mobile
    ? "flex items-center px-3 py-2 text-base font-medium rounded-md transition-colors duration-200"
    : "inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800";

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
              "mr-3 flex-shrink-0",
              mobile ? "h-5 w-5" : "h-4 w-4",
              isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
            )
          })}
          <span className="truncate">{link.name}</span>
        </>
      )}
    </NavLink>
  );
};

// Separador visual entre grupos
const GroupSeparator = () => (
  <div className="mx-1 h-6 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent dark:via-slate-600 sm:mx-2 sm:h-8" />
);

const renderGroup = (links, variant, onClick, isMobile) =>
  links.map((link) => (
    <NavButton
      key={link.path}
      link={link}
      variant={variant}
      mobile={isMobile}
      onClick={onClick}
    />
  ));

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

  const priorityGroups = React.useMemo(
    () => getPriorityGroups(scope, role, auditActive),
    [scope, role, auditActive]
  );

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <nav className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-700">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-2 text-xs md:text-sm">
            <span className="text-lg font-semibold text-slate-900 dark:text-white">FAMSPI</span>
            <span className="hidden md:inline text-slate-500 dark:text-slate-300">Panel</span>
          </div>

          <div
            className="hidden md:flex flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap py-2"
            aria-label="Navegación principal"
          >
            <div className="flex items-center gap-1">
              {renderGroup(priorityGroups.critical, "critical")}
            </div>
            {priorityGroups.primary.length > 0 && (
              <>
                <GroupSeparator />
                <div className="flex items-center gap-1">
                  {renderGroup(priorityGroups.primary, "primary")}
                </div>
              </>
            )}
            {priorityGroups.secondary.length > 0 && (
              <>
                <GroupSeparator />
                <div className="flex items-center gap-1">
                  {renderGroup(priorityGroups.secondary, "secondary")}
                </div>
              </>
            )}
            {priorityGroups.admin.length > 0 && (
              <>
                <GroupSeparator />
                <div className="flex items-center gap-1">
                  {renderGroup(priorityGroups.admin, "admin")}
                </div>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden ml-auto">
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="bg-gray-100 dark:bg-gray-800 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-controls="mobile-menu"
              aria-expanded={mobileMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
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
          <div className="px-2 pt-2 pb-3 space-y-1 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            {renderGroup(priorityGroups.critical, "critical", closeMobileMenu, true)}

            {priorityGroups.primary.length > 0 && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-600 my-2" />
                {renderGroup(priorityGroups.primary, "primary", closeMobileMenu, true)}
              </>
            )}

            {priorityGroups.secondary.length > 0 && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-600 my-2" />
                {renderGroup(priorityGroups.secondary, "secondary", closeMobileMenu, true)}
              </>
            )}

            {priorityGroups.admin.length > 0 && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-600 my-2" />
                {renderGroup(priorityGroups.admin, "admin", closeMobileMenu, true)}
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default NavigationBar;


