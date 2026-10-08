import React from "react";
import { useNavigate } from "react-router-dom";
import { FiUser, FiGrid } from "react-icons/fi";
import { useAuth } from "../../../core/auth/AuthContext";
import { DashboardLayout } from "../../../core/ui/layouts/DashboardLayout";
import { MODULE_PATH_PREFIXES } from "../../../core/auth/moduleAccess";

// Labels amigables por modulo -- MODULE_PATH_PREFIXES solo tiene key+prefix
// (suficiente para el guard de rutas), sin nombre para mostrar. Si falta un
// override aca, se usa un fallback automatico (humanizeModuleKey) en vez de
// bloquear el modulo hasta agregar el label -- un pasante con un modulo
// recien asignado no debe ver una tarjeta vacia por un label faltante.
const MODULE_LABELS = {
  inicio: "Inicio",
  servicio_capacitaciones: "Capacitaciones",
  servicio_aplicaciones: "Aplicaciones técnicas",
  talento_permisos: "Permisos y vacaciones",
  finanzas_viaticos: "Viáticos",
  auditoria: "Auditoría",
  business_case: "Business Case",
  work_management: "Work Management",
};

const humanizeModuleKey = (key = "") =>
  key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

// Dashboard dinamico por diseno: la lista de tarjetas cambia segun lo que
// TI vaya habilitando en user_module_access (/dashboard/ti/modulos), sin
// tocar codigo -- es la pieza central del requerimiento "funciones que se
// podran ir asignando". Mismo patron visual que ExtUserDashboard.jsx (roles
// externos), pero ese tiene la lista de modulos hardcodeada porque su set de
// 4 modulos es fijo; aca no puede serlo.
export default function PasanteDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const firstName = (user?.fullname || "").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";

  const enabledKeys = new Set(
    (user?.module_access || [])
      .filter((entry) => entry?.is_enabled !== false)
      .map((entry) => entry?.module_key),
  );

  const enabledModules = MODULE_PATH_PREFIXES.filter(
    (item) => item.key !== "inicio" && enabledKeys.has(item.key) && item.prefixes?.[0],
  );

  return (
    // includeWidgets=true (a diferencia de ExtUserDashboard): monta el
    // AttendanceWidget flotante estandar de toda la app (entrada/salida/
    // almuerzo) -- es el componente real que ya maneja todo el flujo de
    // asistencia: crear una tarjeta/link propio hacia una ruta generica
    // habria sido reinventar peor lo que ya existe y funciona.
    <DashboardLayout includeWidgets>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
            <FiUser className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{greeting},</p>
            <h1 className="text-2xl font-semibold leading-tight text-gray-900 dark:text-white">
              {firstName || user?.username || "Pasante"}
            </h1>
            <p className="mt-0.5 text-sm text-gray-400 dark:text-gray-500">Pasante</p>
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Otros módulos
          </p>
          {enabledModules.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {enabledModules.map((item) => (
                <button
                  key={item.key}
                  onClick={() => navigate(item.prefixes[0])}
                  className="group flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-all duration-150 hover:border-blue-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <FiGrid className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {MODULE_LABELS[item.key] || humanizeModuleKey(item.key)}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
              Aún no tienes módulos adicionales asignados. Cuando el administrador te habilite alguno, aparecerá aquí automáticamente.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
