import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCheckSquare,
  FiAward,
  FiCalendar,
  FiDollarSign,
  FiChevronRight,
  FiUser,
  FiAlertCircle,
  FiBell,
} from "react-icons/fi";
import { useAuth } from "../../../core/auth/AuthContext";
import { DashboardLayout } from "../../../core/ui/layouts/DashboardLayout";
import { listNotifications } from "../../../core/api/notificationsApi";

const ROLE_LABELS = {
  ing_servicio_ext: "Ingeniero de Servicio",
  esp_app_ext: "Especialista de Aplicaciones",
};

const COLOR_MAP = {
  blue:   { bg: "bg-blue-50 dark:bg-blue-900/20",     icon: "text-blue-600 dark:text-blue-400",     hover: "hover:border-blue-300 dark:hover:border-blue-600",   badge: "bg-blue-600" },
  purple: { bg: "bg-purple-50 dark:bg-purple-900/20", icon: "text-purple-600 dark:text-purple-400", hover: "hover:border-purple-300 dark:hover:border-purple-600", badge: "bg-purple-600" },
  green:  { bg: "bg-emerald-50 dark:bg-emerald-900/20", icon: "text-emerald-600 dark:text-emerald-400", hover: "hover:border-emerald-300 dark:hover:border-emerald-600", badge: "bg-emerald-600" },
  amber:  { bg: "bg-amber-50 dark:bg-amber-900/20",   icon: "text-amber-600 dark:text-amber-400",   hover: "hover:border-amber-300 dark:hover:border-amber-600",   badge: "bg-amber-600" },
};

const MODULES = [
  {
    id: "famsign",
    icon: FiCheckSquare,
    title: "Firma Digital (FamSign)",
    description: "Documentos pendientes de tu firma",
    path: "/dashboard/signatures/inbox",
    color: "blue",
    highlight: true,
  },
  {
    id: "capacitaciones",
    icon: FiAward,
    title: "Capacitaciones",
    description: "Capacitaciones asignadas y en curso",
    path: "/dashboard/capacitaciones",
    color: "purple",
  },
  {
    id: "permisos",
    icon: FiCalendar,
    title: "Permisos",
    description: "Solicitar y consultar permisos",
    path: "/dashboard/talento-humano/permisos",
    color: "green",
  },
  {
    id: "viaticos",
    icon: FiDollarSign,
    title: "Viáticos",
    description: "Registrar salidas operacionales y gastos",
    path: "/dashboard/finanzas/viaticos",
    color: "amber",
  },
];

export default function ExtUserDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingNotifications, setPendingNotifications] = useState(0);

  const roleLabel = ROLE_LABELS[user?.role] ?? "Usuario Externo";
  const firstName = (user?.fullname || "").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";

  useEffect(() => {
    listNotifications()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.data ?? []);
        setPendingNotifications(list.filter((n) => !n.read_at).length);
      })
      .catch(() => {});
  }, []);

  return (
    <DashboardLayout includeWidgets={false}>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
              <FiUser className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{greeting},</p>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white leading-tight">
                {firstName || user?.email}
              </h1>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{roleLabel}</p>
            </div>
          </div>

          {pendingNotifications > 0 && (
            <button
              onClick={() => navigate("/dashboard/notificaciones")}
              className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 text-sm font-medium hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
            >
              <FiBell className="w-4 h-4" />
              {pendingNotifications} sin leer
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-500" />
            </button>
          )}
        </div>

        {/* Firma Digital — destacada */}
        <div
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-5 cursor-pointer shadow-md hover:shadow-lg transition-shadow"
          onClick={() => navigate("/dashboard/signatures/inbox")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <FiCheckSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-base">Firma Digital</p>
                <p className="text-blue-100 text-sm mt-0.5">Revisa y firma documentos pendientes</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-white/80">
              <span className="text-sm">Abrir</span>
              <FiChevronRight className="w-5 h-5" />
            </div>
          </div>
          {/* Decoración */}
          <div className="absolute right-0 top-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
        </div>

        {/* Módulos secundarios */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
            Otros módulos
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MODULES.filter((m) => m.id !== "famsign").map((mod) => {
              const c = COLOR_MAP[mod.color];
              const Icon = mod.icon;
              return (
                <button
                  key={mod.id}
                  onClick={() => navigate(mod.path)}
                  className={[
                    "group flex flex-col items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700",
                    "bg-white dark:bg-gray-800 text-left transition-all duration-150 hover:shadow-sm",
                    c.hover,
                  ].join(" ")}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg}`}>
                    <Icon className={`w-4.5 h-4.5 ${c.icon}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{mod.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{mod.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Aviso de acceso */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <FiAlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Tu perfil tiene acceso a los módulos de firma digital, capacitaciones, permisos y viáticos.
            Para acceder a otros módulos del sistema, comunícate con el administrador.
          </p>
        </div>

      </div>
    </DashboardLayout>
  );
}
