import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiCoffee,
  FiLogIn,
  FiLogOut,
  FiMapPin,
  FiNavigation,
  FiUserCheck,
} from "react-icons/fi";
import { useAuth } from "../../../core/auth/AuthContext";
import { getAttendanceActionMeta } from "../../../core/ui/attendanceFlowUtils";

const FIELD_OPERATION_ROLES = new Set([
  "comercial",
  "acp_comercial",
  "jefe_comercial",
  "asesor_comercial",
  "backoffice_comercial",
  "backoffice",
  "tecnico",
  "ing_servicio",
  "esp_app",
  "servicio_tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "ti",
  "jefe_ti",
  "logistica",
  "jefe_logistica",
  "operaciones",
  "jefe_operaciones",
  "gerencia",
  "gerencia_general",
  "admin",
  "administrador",
]);

const buildRoleTokens = (user = {}) =>
  [user?.role, user?.scope, user?.role_name, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const shortcutHref = (action, params = {}) => {
  const search = new URLSearchParams(params);
  const query = search.toString();
  return `/asistencia/marcar/${action}${query ? `?${query}` : ""}`;
};

const withShortcutMeta = (action, icon, tone) => {
  const meta = getAttendanceActionMeta(action);
  return {
    label: meta?.shortcutLabel || meta?.actionLabel || action,
    detail: meta?.shortcutDetail || "",
    action,
    icon,
    tone,
  };
};

const baseShortcuts = [
  withShortcutMeta("entrada", FiLogIn, "bg-emerald-600 text-white"),
  withShortcutMeta("almuerzo-salida", FiCoffee, "bg-amber-500 text-white"),
  withShortcutMeta("almuerzo-entrada", FiCoffee, "bg-lime-600 text-white"),
  withShortcutMeta("salida", FiLogOut, "bg-rose-600 text-white"),
];

const fieldShortcuts = [
  withShortcutMeta("salida-oficina", FiBriefcase, "bg-sky-700 text-white"),
  withShortcutMeta("llegada-destino", FiMapPin, "bg-cyan-700 text-white"),
  withShortcutMeta("cliente-entrada", FiUserCheck, "bg-violet-700 text-white"),
  withShortcutMeta("cliente-salida", FiCheckCircle, "bg-indigo-700 text-white"),
  withShortcutMeta("retorno-operacional", FiNavigation, "bg-slate-800 text-white"),
  withShortcutMeta("entrada-oficina", FiArrowLeft, "bg-teal-700 text-white"),
  withShortcutMeta("cierre-viaje", FiCheckCircle, "bg-fuchsia-700 text-white"),
];

const ShortcutButton = ({ item }) => {
  const Icon = item.icon || FiClock;
  return (
    <Link
      to={shortcutHref(item.action, item.params)}
      className={`flex min-h-[86px] items-center gap-4 rounded-2xl px-4 py-4 shadow-sm transition active:scale-[0.98] ${item.tone}`}
    >
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/18 ring-1 ring-white/20">
        <Icon size={24} />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-base font-bold leading-5">{item.label}</span>
        <span className="mt-1 block text-xs font-medium leading-4 text-white/82">{item.detail}</span>
      </span>
    </Link>
  );
};

const ShortcutSection = ({ title, items }) => {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <ShortcutButton key={item.action} item={item} />
        ))}
      </div>
    </section>
  );
};

const MobileShortcuts = () => {
  const { user } = useAuth();
  const canUseFieldOperations = useMemo(
    () => buildRoleTokens(user).some((role) => FIELD_OPERATION_ROLES.has(role)),
    [user],
  );
  const visibleOperationalShortcuts = useMemo(
    () => canUseFieldOperations
      ? fieldShortcuts
      : fieldShortcuts.filter((item) => !["cliente-entrada", "cliente-salida"].includes(item.action)),
    [canUseFieldOperations],
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">FamSPI</p>
          <h1 className="mt-1 text-2xl font-black leading-tight text-slate-950">Atajos moviles</h1>
          <p className="mt-2 text-sm leading-5 text-slate-600">
            Accesos rapidos para marcar asistencia con ubicacion.
          </p>
        </header>

        <ShortcutSection title="Jornada" items={baseShortcuts} />
        <ShortcutSection title="Salidas y visitas" items={visibleOperationalShortcuts} />
      </div>
    </main>
  );
};

export default MobileShortcuts;
