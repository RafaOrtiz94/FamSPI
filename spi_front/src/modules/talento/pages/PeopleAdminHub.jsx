import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiSettings, FiUsers } from "react-icons/fi";

import Usuarios from "./Usuarios";
import Departamentos from "./Departamentos";

const ADMIN_TABS = [
  {
    key: "usuarios",
    path: "/dashboard/talento-humano/usuarios",
    label: "Usuarios",
    icon: FiUsers,
  },
  {
    key: "departamentos",
    path: "/dashboard/talento-humano/departamentos",
    label: "Departamentos",
    icon: FiSettings,
  },
];

const normalizeTab = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return ADMIN_TABS.some((tab) => tab.key === normalized) ? normalized : "usuarios";
};

const PeopleAdminHub = ({ initialTab = "usuarios" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const normalizedInitialTab = useMemo(() => normalizeTab(initialTab), [initialTab]);
  const [activeTab, setActiveTab] = useState(normalizedInitialTab);

  useEffect(() => {
    setActiveTab(normalizedInitialTab);
  }, [normalizedInitialTab]);

  const handleChangeTab = (key) => {
    const targetTab = ADMIN_TABS.find((tab) => tab.key === key) || ADMIN_TABS[0];
    if (location.pathname !== targetTab.path) {
      navigate(targetTab.path);
      return;
    }
    setActiveTab(targetTab.key);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado del módulo */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
          Talento Humano
        </p>
        <h1 className="text-xl font-semibold text-slate-900">Usuarios y Departamentos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Administra identidades internas y la estructura organizacional desde una sola consola.
        </p>
      </div>

      {/* Navegación por pestañas */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleChangeTab(tab.key)}
                className="flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
                style={isActive
                  ? { borderColor: "#2563EB", color: "#2563EB" }
                  : { borderColor: "transparent", color: "#6B7280" }
                }
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenido */}
      {activeTab === "usuarios" ? <Usuarios /> : <Departamentos />}
    </div>
  );
};

export default PeopleAdminHub;
