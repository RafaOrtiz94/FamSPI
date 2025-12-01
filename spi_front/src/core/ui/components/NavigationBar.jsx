import React from "react";
import { NavLink } from "react-router-dom";
import {
  FiHome,
  FiUsers,
  FiBriefcase,
  FiPackage,
  FiClipboard,
  FiShoppingCart,
  FiFileText,
} from "react-icons/fi";
import clsx from "clsx";

import { useAuth } from "../../auth/AuthContext";

const baseLinks = [
  { name: "Inicio", icon: FiHome, path: "/dashboard" },
];

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
  {
    name: "Inventario",
    icon: FiPackage,
    path: "/dashboard/comercial/inventario",
  },
];

const acpLinks = [
  {
    name: "Compras de equipos",
    icon: FiShoppingCart,
    path: "/dashboard/comercial/equipment-purchases",
  },
];

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

const buildLinks = (scope) => {
  const links = [...baseLinks];

  // Comercial links
  if (["comercial", "gerencia", "ti"].includes(scope)) {
    links.push(...comercialLinks);
  }

  if (["acp_comercial"].includes(scope)) {
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

  return links;
};

const NavigationBar = () => {
  const { user } = useAuth();
  const scope = (user?.scope || user?.role || "").toLowerCase();
  const links = React.useMemo(() => buildLinks(scope), [scope]);

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
