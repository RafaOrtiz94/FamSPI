import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../core/auth/AuthContext";

const ADMIN_ROLES = ["jefe_ti", "jefe_de_ti", "admin", "administrador"];

const BASE_TABS = [
  { label: "Dashboard", path: "/dashboard/crm-fam", exact: true },
  { label: "Cuentas", path: "/dashboard/crm-fam/accounts" },
  { label: "Contactos", path: "/dashboard/crm-fam/contacts" },
  { label: "Leads", path: "/dashboard/crm-fam/leads" },
  { label: "Embudo de ventas", path: "/dashboard/crm-fam/opportunities" },
  { label: "Actividades", path: "/dashboard/crm-fam/activities" },
  { label: "Reportes", path: "/dashboard/crm-fam/reports" },
];

const ADMIN_TAB = { label: "Configuracion", path: "/dashboard/crm-fam/settings" };

const CrmShell = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const userRoles = String(user?.role || "")
    .split(",")
    .map((r) => r.trim().toLowerCase());
  const isAdmin = userRoles.some((r) => ADMIN_ROLES.includes(r));

  const tabs = isAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  const isActive = (tab) => {
    if (tab.exact) return location.pathname === tab.path;
    return location.pathname.startsWith(tab.path);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB]">
        <div className="overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <div className="flex min-w-max">
            {tabs.map((tab) => {
              const active = isActive(tab);
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={[
                    "px-4 py-3 text-sm font-medium cursor-pointer whitespace-nowrap border-b-2 transition-colors",
                    active
                      ? "text-[#2563EB] border-[#2563EB]"
                      : "text-[#6B7280] border-transparent hover:text-[#1F2937]",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};

export default CrmShell;
