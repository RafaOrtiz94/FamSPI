import React from "react";
import { NavLink } from "react-router-dom";
import {
  FiHome,
  FiUsers,
  FiBriefcase,
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
  operaciones: "/dashboard/operaciones",
  jefe_operaciones: "/dashboard/operaciones",
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

const acpLinks = [
  {
    name: "Compras de equipos",
    icon: FiShoppingCart,
    path: "/dashboard/comercial/acp-compras",
  },
];

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

const purchasesWorkspaceLink = {
  name: "Workspace de Compras",
  icon: FiShoppingCart,
  path: "/dashboard/purchases/workspace",
};

const talentoLinks = [
  {
    name: "Gestión de Usuarios",
    icon: FiUsers,
    path: "/dashboard/talento-humano/usuarios",
  },
  {
    name: "Departamentos",
    icon: FiBriefcase,
    path: "/dashboard/talento-humano/departamentos",
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

const auditPrepLink = {
  name: "Preparación Auditoría",
  icon: FiShield,
  path: "/dashboard/auditoria/preparacion",
};

const servicioLinks = [
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
];

// Sistema de prioridades por rol
const getPriorityGroups = (scope, role, auditActive) => {
  const groups = {
    critical: [], // 🔥 Funciones críticas diarias - siempre visibles
    primary: [],  // 🟡 Funciones principales del rol
    secondary: [], // 🔵 Funciones específicas/secundarias
    admin: []     // ⚫ Funciones administrativas/menos usadas
  };

  // Siempre incluir inicio como crítico
  groups.critical.push(getHomeLink(scope));

  // 📊 GERENCIA - Enfoque en control y supervisión
  if (["gerencia", "gerente_general", "director"].includes(scope)) {
    groups.critical.push(aprobacionesPlanLink); // Aprobaciones críticas
    groups.primary.push(businessCaseLink, auditPrepLink);
    groups.secondary.push(auditLinks[0]); // Auditoría y trazabilidad
    groups.admin.push(permisosLink, ...talentoLinks);
  }

  // 💰 FINANZAS - Control presupuestario
  else if (["finanzas", "jefe_finanzas", "financiero"].includes(scope)) {
    groups.primary.push(businessCaseLink); // Control financiero principal
    groups.secondary.push(auditPrepLink);
    if (auditActive) groups.secondary.push(auditPrepLink);
  }

  // 💼 COMERCIAL - Flujo de ventas completo
  else if (comercialScopes.includes(scope)) {
    groups.critical.push(...comercialLinks); // Solicitudes y clientes críticos
    groups.primary.push(planificacionLink); // Planificación mensual

    // UNIFICACIÓN: Solo Workspace de Compras - Roles según AppRoutes.jsx
    const workspaceAllowedRoles = [
      "comercial", "jefe_comercial", "acp_comercial", "gerencia",
      "gerencia_general", "jefe_operaciones", "jefe_logistica", "backoffice_comercial"
    ];

    if (workspaceAllowedRoles.includes(scope) || role.includes("backoffice")) {
      groups.primary.unshift(purchasesWorkspaceLink); // Workspace primero en primary
      console.log("[PURCHASES_WORKSPACE][FASE6][NAVBAR] workspace_visible", {
        role: scope,
        allowedRoles: workspaceAllowedRoles
      });
    }

    if (scope.includes("acp") || role.includes("acp")) {
      groups.primary.unshift(...acpLinks); // ACP pone compras primero
    }

    if (["jefe_comercial"].includes(scope)) {
      groups.primary.push(aprobacionesPlanLink);
    }

    groups.secondary.push(businessCaseLink); // Business Case queda en secondary
    groups.admin.push(permisosLink);
  }

  // 🔧 SERVICIO TÉCNICO - Operaciones técnicas
  else if (["servicio_tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "tecnico"].includes(scope)) {
    groups.critical.push(
      servicioLinks.find(l => l.name === "Mantenimientos"),
      servicioLinks.find(l => l.name === "Solicitudes"),
      servicioLinks.find(l => l.name === "Equipos")
    );
    groups.primary.push(
      servicioLinks.find(l => l.name === "Disponibilidad"),
      servicioLinks.find(l => l.name === "Aprobaciones")
    );
    groups.secondary.push(
      servicioLinks.find(l => l.name === "Capacitaciones"),
      servicioLinks.find(l => l.name === "Aplicaciones")
    );
  }

  // 👥 TALENTO HUMANO - Gestión de personal
  else if (["talento-humano", "talento_humano", "jefe_talento_humano"].includes(scope)) {
    groups.primary.push(permisosLink, ...talentoLinks);
  }

  // 🎯 TI - Tecnología y auditoría
  else if (["ti", "jefe_ti", "admin_ti"].includes(scope)) {
    groups.primary.push(...talentoLinks, ...auditLinks);
    if (auditActive) groups.primary.push(auditPrepLink);
  }

  // ⚙️ OPERACIONES - Procesos operativos
  else if (["operaciones", "jefe_operaciones"].includes(scope)) {
    groups.primary.push(businessCaseLink);
    if (auditActive) groups.secondary.push(auditPrepLink);
  }

  // 🎨 CALIDAD - Control de calidad
  else if (["calidad"].includes(scope)) {
    if (auditActive) groups.primary.push(auditPrepLink);
  }

  // 🏢 BACKOFFICE - Soporte administrativo
  else if (role.includes("backoffice")) {
    groups.primary.push(privatePurchasesLink, publicPurchasesLink);
    groups.secondary.push(...comercialLinks);
  }

  // Filtrar elementos vacíos y aplanar arrays
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
  const role = (user?.role || "").toLowerCase();
  const scope = (user?.scope || role || "").toLowerCase();
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
            <span className="text-lg font-semibold text-slate-900 dark:text-white">FamSPI</span>
            <span className="hidden md:inline text-slate-500 dark:text-slate-300">Panel integrado</span>
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



