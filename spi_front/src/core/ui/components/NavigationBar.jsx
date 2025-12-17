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
  FiUser,
} from "react-icons/fi";
import clsx from "clsx";

import { useAuth } from "../../auth/AuthContext";

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
const planificacionRoles = new Set(["comercial", "jefe_comercial", "gerencia", "gerencia_general"]);

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

const businessCaseLink = {
  name: "Business Case",
  icon: FiFileText,
  path: "/dashboard/business-case",
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

const myProfileLink = {
  name: "Mi Perfil",
  icon: FiUser,
  path: "/dashboard/mi-perfil",
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

const buildLinks = (scope, role) => {
  const links = [getHomeLink(scope), permisosLink, myProfileLink];

  // Comercial links
  if (comercialScopes.includes(scope)) {
    links.push(...comercialLinks);
  }

  const privatePurchaseScopes = new Set([
    "comercial",
    "jefe_comercial",
    "acp_comercial",
    "backoffice",
    "backoffice_comercial",
    "gerencia",
    "gerencia_general",
  ]);
  if (privatePurchaseScopes.has(scope) || role.includes("backoffice")) {
    links.push(privatePurchasesLink);
  }

  if (planificacionRoles.has(role)) {
    links.push(planificacionLink);
  }

  if (scope.includes("acp") || role.includes("acp")) {
    links.push(...acpLinks);
  }

  const businessCaseRoles = [
    "comercial",
    "acp_comercial",
    "jefe_comercial",
    "gerencia",
    "gerencia_general",
    "operaciones",
    "jefe_operaciones",
    "servicio_tecnico",
    "jefe_tecnico",
    "jefe_servicio_tecnico",
  ];

  if (businessCaseRoles.includes(scope)) {
    links.push(businessCaseLink);
  }

  // Talento Humano links
  if (["talento-humano", "talento_humano", "ti", "gerencia"].includes(scope)) {
    links.push(...talentoLinks);
  }

  // Audit links
  if (["ti", "gerencia"].includes(scope)) {
    links.push(...auditLinks);
  }

  if (["servicio_tecnico", "jefe_tecnico", "jefe_servicio_tecnico"].includes(scope)) {
    links.push(...servicioLinks);
  }

  if (["jefe_comercial", "gerencia", "gerencia_general", "admin", "administrador"].includes(scope)) {
    links.push(aprobacionesPlanLink);
  }

  return links;
};

const NavigationBar = () => {
  const { user } = useAuth();
  const role = (user?.role || "").toLowerCase();
  const scope = (user?.scope || role || "").toLowerCase();
  const links = React.useMemo(() => buildLinks(scope, role), [scope, role]);

  return (
    <nav className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 py-3 sm:gap-3">
        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end
            className={({ isActive }) =>
              clsx(
                "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition",
                isActive
                  ? "border-primary bg-primary text-white shadow-md shadow-primary/30"
                  : "border-slate-200 bg-white text-slate-600 hover:border-primary hover:text-primary dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              )
            }
          >
            {React.createElement(link.icon, { className: "text-base" })}
            <span className="whitespace-nowrap">{link.name}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default NavigationBar;
