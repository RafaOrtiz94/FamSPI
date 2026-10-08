import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiCoffee,
  FiLogIn,
  FiLogOut,
  FiHome,
  FiMapPin,
  FiNavigation,
  FiUserCheck,
} from "react-icons/fi";
import { useAuth } from "../../../core/auth/AuthContext";
import { getTodayAttendance } from "../../../core/api/attendanceApi";
import {
  getAttendanceActionMeta,
  getAttendanceIntentMeta,
  resolveAttendanceFlowStep,
  resolveAttendanceShortcutIntent,
} from "../../../core/ui/attendanceFlowUtils";

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

const withIntentMeta = (intent, icon, tone) => {
  const meta = getAttendanceIntentMeta(intent);
  return {
    label: meta?.title || intent,
    detail: meta?.detail || "",
    action: intent,
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

const intentShortcuts = [
  withIntentMeta("iniciar-jornada", FiLogIn, "bg-emerald-600 text-white"),
  withIntentMeta("continuar-jornada", FiClock, "bg-slate-800 text-white"),
  withIntentMeta("gestionar-permiso-activo", FiUserCheck, "bg-cyan-700 text-white"),
  withIntentMeta("iniciar-salida-operacional", FiBriefcase, "bg-sky-700 text-white"),
  withIntentMeta("continuar-salida-operacional", FiNavigation, "bg-indigo-700 text-white"),
  withIntentMeta("resolver-entrada-tardia", FiAlertCircle, "bg-amber-500 text-white"),
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
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [todayLoaded, setTodayLoaded] = useState(false);
  const canUseFieldOperations = useMemo(
    () => buildRoleTokens(user).some((role) => FIELD_OPERATION_ROLES.has(role)),
    [user],
  );
  const flowStep = useMemo(
    () => resolveAttendanceFlowStep(todayAttendance?.canonical_flow || todayAttendance?.data?.canonical_flow || null),
    [todayAttendance],
  );
  const allowedActionKeys = useMemo(
    () => new Set(Array.isArray(flowStep.allowedActionKeys) ? flowStep.allowedActionKeys : []),
    [flowStep.allowedActionKeys],
  );
  const isActiveTelework = Boolean(
    todayAttendance?.canonical_flow?.context_flags?.has_active_telework
      || todayAttendance?.context_flags?.has_active_telework
      || todayAttendance?.data?.context_flags?.has_active_telework,
  );
  const visibleBaseShortcuts = useMemo(() => {
    if (!todayLoaded) return baseShortcuts;
    if (!allowedActionKeys.size) return [];
    return baseShortcuts.filter((item) => allowedActionKeys.has(item.action));
  }, [allowedActionKeys, todayLoaded]);
  const visibleOperationalShortcuts = useMemo(
    () => {
      const roleFiltered = canUseFieldOperations
        ? fieldShortcuts
        : fieldShortcuts.filter((item) => !["cliente-entrada", "cliente-salida"].includes(item.action));
      if (!todayLoaded) return roleFiltered;
      if (!allowedActionKeys.size) return [];
      const available = roleFiltered.filter((item) => allowedActionKeys.has(item.action));
      if (!isActiveTelework) return available;

      const closeAction = available.find((item) => item.action === "entrada-oficina");
      return closeAction
        ? [{
            ...closeAction,
            label: "Finalizar teletrabajo",
            detail: "Cerrar tu jornada remota",
            icon: FiHome,
            tone: "bg-emerald-600 text-white",
          }]
        : [];
    },
    [allowedActionKeys, canUseFieldOperations, isActiveTelework, todayLoaded],
  );
  const resolvedIntentShortcuts = useMemo(() => {
    if (!todayLoaded) return [];
    return intentShortcuts
      .filter((item) => {
        if (!canUseFieldOperations && item.action?.includes("salida-operacional")) return false;
        return true;
      })
      .map((item) => {
        const resolution = resolveAttendanceShortcutIntent({
          rawIntent: item.action,
          attendanceData: todayAttendance || {},
        });
        if (!resolution.isAvailable || !resolution.resolvedActionKey) return null;
        const actionMeta = getAttendanceActionMeta(resolution.resolvedActionKey);
        return {
          ...item,
          detail: actionMeta?.shortcutDetail || item.detail,
          params: { resolved: resolution.resolvedActionKey },
        };
      })
      .filter(Boolean);
  }, [canUseFieldOperations, todayAttendance, todayLoaded]);

  useEffect(() => {
    let cancelled = false;
    const loadToday = async () => {
      try {
        const response = await getTodayAttendance();
        if (!cancelled) {
          setTodayAttendance(response?.data || response || null);
          setTodayLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setTodayAttendance(null);
          setTodayLoaded(false);
        }
      }
    };

    loadToday();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">FamSPI</p>
          <h1 className="mt-1 text-2xl font-black leading-tight text-slate-950">Atajos moviles</h1>
          <p className="mt-2 text-sm leading-5 text-slate-600">
            Accesos rapidos para marcar asistencia con ubicacion.
          </p>
          {flowStep.nextStepLabel ? (
            <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
              Siguiente paso sugerido: {flowStep.nextStepLabel}
            </p>
          ) : null}
        </header>

        <ShortcutSection title="Atajos inteligentes" items={resolvedIntentShortcuts} />
        <ShortcutSection title="Jornada" items={visibleBaseShortcuts} />
        <ShortcutSection title="Salidas y visitas" items={visibleOperationalShortcuts} />
      </div>
    </main>
  );
};

export default MobileShortcuts;
