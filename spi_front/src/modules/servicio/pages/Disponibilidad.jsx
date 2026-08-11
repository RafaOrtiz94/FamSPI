import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiExternalLink,
  FiFilter,
  FiRefreshCw,
  FiToggleLeft,
  FiToggleRight,
  FiUsers,
} from "react-icons/fi";

import { useAuth } from "../../../core/auth/AuthContext";
import {
  createTechnicalActivity,
  getTeamAvailability,
  getTechnicalActivities,
  getTechnicalScheduleFeed,
  updateAvailabilityStatus,
} from "../../../core/api/availabilityApi";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import {
  WORKSPACE_2COL_CLASS,
  WORKSPACE_MAIN_CLASS,
  WORKSPACE_PAGE_CLASS,
  WORKSPACE_SIDEBAR_CLASS,
} from "../../../core/ui/workspaceLayout";

const PAGE_COPY = {
  combined: {
    eyebrow: "Panel operativo del area tecnica",
    title: "Disponibilidad del equipo",
    description:
      "Consulta el estado visible del equipo y registra actividades para bloquear agenda tecnica.",
    availabilityTitle: "Disponibilidad actual",
    activitiesTitle: "Cronograma de actividades tecnicas",
    activitiesDescription:
      "Registra actividades para bloquear fechas en coordinacion de inspecciones y otras tareas del area.",
  },
  cronograma: {
    eyebrow: "Agenda operativa y coordinacion",
    title: "Cronograma tecnico",
    description:
      "Concentra agenda fechada, inspecciones por coordinar y bloqueos manuales del area tecnica.",
    availabilityTitle: "Disponibilidad visible del equipo",
    activitiesTitle: "Agenda tecnica consolidada",
    activitiesDescription:
      "La agenda une bloqueos manuales, inspecciones, mantenimientos y capacitaciones ya verificadas en el sistema.",
  },
};

const INPUT_CLASS =
  "rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20";

const SCHEDULE_BADGES = {
  inspection: "border-blue-200 bg-blue-50 text-blue-700",
  maintenance: "border-amber-200 bg-amber-50 text-amber-700",
  training: "border-emerald-200 bg-emerald-50 text-emerald-700",
  manual: "border-slate-200 bg-slate-100 text-slate-700",
  pending_coordination: "border-rose-200 bg-rose-50 text-rose-700",
};

const SCHEDULE_CATEGORY_OPTIONS = [
  { value: "all", label: "Todos los tipos" },
  { value: "inspection", label: "Inspecciones" },
  { value: "maintenance", label: "Mantenimientos" },
  { value: "training", label: "Capacitaciones" },
  { value: "manual", label: "Bloqueos manuales" },
  { value: "pending_coordination", label: "Por coordinar" },
];

const STATUS_LABELS = {
  accepted: "Aceptada",
  approved: "Aprobada",
  assigned: "Asignada",
  confirmed: "Confirmada",
  completed: "Completada",
  completado: "Completado",
  en_proceso: "En proceso",
  finalizado: "Finalizado",
  pending: "Pendiente",
  pending_proposal: "Pendiente de propuesta",
  programado: "Programado",
};

const LEAD_ROLES = new Set([
  "jefe_tecnico",
  "jefe_servicio",
  "jefe_servicio_tecnico",
  "gerencia",
  "gerencia_general",
  "director",
]);

const normalizeTokens = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item || "").toLowerCase()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const canSeeTeamScope = (user) => {
  const tokens = new Set([...(normalizeTokens(user?.role)), ...(normalizeTokens(user?.scope))]);
  return Array.from(tokens).some((token) => LEAD_ROLES.has(token));
};

const statusClass = (status) => {
  const value = String(status || "").toLowerCase();
  if (["disponible", "available", "on", "true"].includes(value)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["ocupado", "busy"].includes(value)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-rose-200 bg-rose-50 text-rose-700";
};

const statusLabel = (status) => {
  const value = String(status || "").toLowerCase();
  if (["disponible", "available", "on", "true"].includes(value)) return "Disponible";
  if (["ocupado", "busy"].includes(value)) return "Ocupado";
  return "No disponible";
};

const formatDateLabel = (value) => {
  if (!value) return "Sin fecha";
  const safeValue = String(value).slice(0, 10);
  try {
    return new Date(`${safeValue}T00:00:00`).toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return safeValue;
  }
};

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const buildDefaultRange = () => {
  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const toDate = new Date(today);
  toDate.setDate(toDate.getDate() + 60);
  return {
    from,
    to: toDate.toISOString().slice(0, 10),
  };
};

const buildMonthRange = () => {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
};

const formatScheduleStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Sin estado";
  return STATUS_LABELS[normalized] || normalized.replace(/_/g, " ");
};

const buildScheduleSummaryFromRows = (rows = [], backlog = []) => ({
  total_events: rows.length,
  pending_coordination: backlog.length,
  by_category: {
    inspection: rows.filter((item) => item.category === "inspection").length,
    maintenance: rows.filter((item) => item.category === "maintenance").length,
    training: rows.filter((item) => item.category === "training").length,
    manual: rows.filter((item) => item.category === "manual").length,
  },
});

// Vista de jefe_servicio: agrupa por colaborador (no por tipo de expediente),
// para poder revisar el calendario completo de cada tecnico/esp_app de uno en
// uno y agregarle actividades directamente.
const buildCollaboratorGroups = (rows = [], backlog = [], teamMembers = []) => {
  const map = new Map();

  const getGroup = (userId, userName) => {
    const key = String(userId || normalizeText(userName) || "sin-asignar");
    if (!map.has(key)) {
      map.set(key, {
        key,
        userId: userId || null,
        sourcePath: "",
        title: userName || "Sin asignar",
        assignee: userName || "Sin responsable visible",
        rows: [],
        backlog: [],
      });
    }
    return map.get(key);
  };

  teamMembers.forEach((member) => {
    getGroup(member.id ?? member.userId, member.name || member.fullname);
  });

  rows.forEach((item) => {
    getGroup(item.user_id, item.user_name).rows.push(item);
  });
  backlog.forEach((item) => {
    getGroup(item.user_id, item.user_name).backlog.push(item);
  });

  return Array.from(map.values())
    .map((group) => {
      const manualRows = group.rows.filter((item) => item.category === "manual");
      const nextDate = group.rows
        .map((item) => String(item.activity_date || "").slice(0, 10))
        .filter(Boolean)
        .sort()[0];
      return {
        ...group,
        nextDate,
        totalRows: group.rows.length,
        totalBacklog: group.backlog.length,
        totalManual: manualRows.length,
      };
    })
    .sort((left, right) => {
      const leftWeight = left.totalBacklog > 0 ? 0 : 1;
      const rightWeight = right.totalBacklog > 0 ? 0 : 1;
      if (leftWeight !== rightWeight) return leftWeight - rightWeight;
      return String(left.title).localeCompare(String(right.title), "es", { sensitivity: "base" });
    });
};

// Vista de ing_servicio / esp_app: no necesitan navegar por expediente ni por
// colaborador, solo ver todas sus tareas asignadas en el rango (mes).
const buildFlatGroup = (rows = [], backlog = [], user = null) => [
  {
    key: "mis-actividades",
    userId: user?.id || null,
    sourcePath: "",
    title: "Mis tareas del mes",
    assignee: user?.fullname || user?.name || "",
    rows,
    backlog,
    nextDate: rows
      .map((item) => String(item.activity_date || "").slice(0, 10))
      .filter(Boolean)
      .sort()[0],
    totalRows: rows.length,
    totalBacklog: backlog.length,
    totalManual: rows.filter((item) => item.category === "manual").length,
  },
];

const ActivityList = ({ activities }) => (
  <div className="space-y-2">
    {activities.length ? (
      activities.map((activity) => (
        <div
          key={activity.id}
          className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p className="font-medium text-slate-900">{activity.title}</p>
            <p className="text-xs text-slate-500">
              {activity.activity_date} · {activity.user_name || "Equipo tecnico"}
            </p>
          </div>
          <p className="text-xs text-slate-600">{activity.notes || "Sin notas"}</p>
        </div>
      ))
    ) : (
      <p className="text-sm text-slate-500">No hay actividades registradas en los proximos 60 dias.</p>
    )}
  </div>
);

const PendingCoordinationList = ({ items, onOpen }) => (
  <Card className="space-y-4 p-5">
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Inspecciones por coordinar</h2>
      <p className="text-sm text-slate-600">
        Estas solicitudes ya existen y todavia no tienen fecha cerrada dentro del cronograma tecnico.
      </p>
    </div>

    {items.length ? (
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">{item.title}</p>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                    SCHEDULE_BADGES.pending_coordination
                  }`}
                >
                  {item.coordination_status || "pending_proposal"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Ventana: {formatDateLabel(item.window_min_date)} - {formatDateLabel(item.window_max_date)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {item.user_name ? `Tecnico sugerido: ${item.user_name}` : "Tecnico aun no visible en esta solicitud"}
              </p>
            </div>

            <Button variant="secondary" icon={FiExternalLink} onClick={() => onOpen(item.source_path)}>
              Abrir origen
            </Button>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-sm text-slate-500">No hay inspecciones pendientes de coordinacion en este rango.</p>
    )}
  </Card>
);

const CRONOGRAMA_TABS = [
  { key: "agenda", label: "Agenda" },
  { key: "coordinar", label: "Por coordinar" },
  { key: "bloqueos", label: "Bloqueos" },
  { key: "equipo", label: "Equipo" },
];

const ScheduleToolbar = ({
  summary,
  range,
  filters,
  memberOptions,
  scope,
  canSwitchScope,
  onScopeChange,
  onRangeChange,
  onFilterChange,
  onReset,
  onRefresh,
  loading,
}) => (
  <Card className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-slate-500">
          <FiFilter className="text-sm" />
          <span className="text-xs font-semibold uppercase tracking-[0.22em]">Vista operativa</span>
        </div>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">Expedientes tecnicos</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          La agenda se agrupa por expediente para abrir el origen correcto y revisar coordinacion, bloqueos y responsables.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {canSwitchScope ? (
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => onScopeChange("team")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                scope === "team" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Equipo
            </button>
            <button
              type="button"
              onClick={() => onScopeChange("mine")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                scope === "mine" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Mi agenda
            </button>
          </div>
        ) : null}
        <Button variant="secondary" icon={FiRefreshCw} onClick={onRefresh} disabled={loading}>
          Actualizar
        </Button>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[
        { label: "Expedientes", value: summary?.expedientes || 0 },
        { label: "Eventos", value: summary?.total_events || 0 },
        { label: "Por coordinar", value: summary?.pending_coordination || 0 },
        { label: "Bloqueos", value: summary?.by_category?.manual || 0 },
      ].map((card) => (
        <div key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Desde</span>
        <input
          type="date"
          className={INPUT_CLASS}
          value={range.from}
          onChange={(event) => onRangeChange("from", event.target.value)}
        />
      </label>

      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Hasta</span>
        <input
          type="date"
          className={INPUT_CLASS}
          value={range.to}
          onChange={(event) => onRangeChange("to", event.target.value)}
        />
      </label>

      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Tipo</span>
        <select
          className={INPUT_CLASS}
          value={filters.category}
          onChange={(event) => onFilterChange("category", event.target.value)}
        >
          {SCHEDULE_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Estado</span>
        <input
          type="text"
          className={INPUT_CLASS}
          placeholder="programado, en proceso, pendiente"
          value={filters.status}
          onChange={(event) => onFilterChange("status", event.target.value)}
        />
      </label>

      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Responsable</span>
        <select
          className={INPUT_CLASS}
          value={filters.assignee}
          onChange={(event) => onFilterChange("assignee", event.target.value)}
        >
          <option value="all">Todo el equipo visible</option>
          {memberOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>

    <div className="flex justify-end">
      <Button variant="ghost" onClick={onReset}>
        Limpiar filtros
      </Button>
    </div>
  </Card>
);

const ExpedienteSidebar = ({ expedientes, selectedKey, onSelect, entityLabel = "Expedientes" }) => (
  <aside className={`${WORKSPACE_SIDEBAR_CLASS} lg:col-span-4`}>
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200 px-4 py-4 lg:px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{entityLabel}</p>
        <h3 className="mt-2 text-lg font-semibold text-slate-900">Consolidado tecnico</h3>
        <p className="mt-1 text-sm text-slate-600">
          {entityLabel === "Colaboradores"
            ? "Selecciona un colaborador para revisar todo su calendario y agregarle actividades."
            : "Selecciona un expediente para revisar agenda, pendientes y bloqueos manuales."}
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 lg:px-5">
        {expedientes.length ? (
          expedientes.map((expediente) => {
            const isActive = expediente.key === selectedKey;
            return (
              <button
                key={expediente.key}
                type="button"
                onClick={() => onSelect(expediente.key)}
                className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                  isActive
                    ? "border-[#2563EB]/20 bg-[#EFF6FF] shadow-[0_12px_32px_rgba(37,99,235,0.12)]"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{expediente.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {expediente.assignee || "Sin responsable visible"}
                    </p>
                  </div>
                  {expediente.totalBacklog ? (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                      {expediente.totalBacklog} por coordinar
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {expediente.totalRows} eventos
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {expediente.totalManual} bloqueos
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {expediente.nextDate ? formatDateLabel(expediente.nextDate) : "Sin fecha"}
                  </span>
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">No hay expedientes en el rango consultado.</p>
            <p className="mt-1 text-sm text-slate-500">Ajusta fechas o filtros para encontrar actividad tecnica.</p>
          </div>
        )}
      </div>
    </div>
  </aside>
);

const AgendaItemsList = ({ items = [], onOpen }) => (
  <div className="space-y-3">
    {items.length ? (
      items.map((item) => (
        <div
          key={item.id}
          className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_25px_rgba(15,23,42,0.05)]"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {formatDateLabel(item.activity_date)}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    SCHEDULE_BADGES[item.category] || SCHEDULE_BADGES.manual
                  }`}
                >
                  {item.category === "manual" ? "Bloqueo" : item.source_label}
                </span>
              </div>
              <p className="mt-3 text-base font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.notes || "Sin observaciones adicionales"}</p>
              <p className="mt-2 text-xs text-slate-500">
                {item.user_name ? `Responsable: ${item.user_name}` : "Sin responsable visible"} · Estado:{" "}
                {formatScheduleStatus(item.status || "programado")}
              </p>
            </div>

            {item.source_path ? (
              <Button variant="secondary" icon={FiExternalLink} onClick={() => onOpen(item.source_path)}>
                Abrir origen
              </Button>
            ) : null}
          </div>
        </div>
      ))
    ) : (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        No hay elementos para esta pestaña.
      </div>
    )}
  </div>
);

const AvailabilityPanel = ({ availability, loading }) => (
  <div className="space-y-3">
    {loading ? (
      <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
        Cargando disponibilidad...
      </div>
    ) : availability.length ? (
      availability.map((member) => (
        <div
          key={member.id || member.userId || member.name}
          className="flex items-start justify-between gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-4"
        >
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{member.name || member.fullname || "Tecnico"}</p>
            <p className="mt-1 text-sm text-slate-500">
              {member.updatedAt
                ? `Actualizado ${new Date(member.updatedAt).toLocaleString()}`
                : "Sin registro reciente"}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusClass(member.status)}`}>
            {statusLabel(member.status)}
          </span>
        </div>
      ))
    ) : (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        Sin tecnicos registrados.
      </div>
    )}
  </div>
);

const CronogramaWorkspace = ({
  summary,
  expedientes,
  selectedKey,
  selectedTab,
  onSelectExpediente,
  onSelectTab,
  selectedExpediente,
  availability,
  loading,
  onOpenSource,
  activityForm,
  setActivityForm,
  handleCreateActivity,
  savingActivity,
  entityLabel = "Expedientes",
  showSidebar = true,
}) => {
  const agendaRows = selectedExpediente?.rows.filter((item) => item.category !== "manual") || [];
  const backlogRows = selectedExpediente?.backlog || [];
  const manualRows = selectedExpediente?.rows.filter((item) => item.category === "manual") || [];

  return (
    <div className={showSidebar ? WORKSPACE_2COL_CLASS : "grid grid-cols-1"}>
      {showSidebar ? (
        <ExpedienteSidebar
          expedientes={expedientes}
          selectedKey={selectedKey}
          onSelect={onSelectExpediente}
          entityLabel={entityLabel}
        />
      ) : null}

      <main className={showSidebar ? `${WORKSPACE_MAIN_CLASS} lg:col-span-8` : WORKSPACE_MAIN_CLASS}>
        <div className="space-y-5 p-4 lg:p-5">
          <Card className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2563EB]">
                    Expediente activo
                  </span>
                  {selectedExpediente?.totalBacklog ? (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700">
                      {selectedExpediente.totalBacklog} por coordinar
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-slate-900">
                  {selectedExpediente?.title || "Sin expediente seleccionado"}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {selectedExpediente?.assignee
                    ? `Responsable visible: ${selectedExpediente.assignee}`
                    : "Este expediente no expone un responsable visible en el feed."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
                {[
                  { label: "Eventos", value: selectedExpediente?.totalRows || 0 },
                  { label: "Bloqueos", value: selectedExpediente?.totalManual || 0 },
                  { label: "Coordinar", value: selectedExpediente?.totalBacklog || 0 },
                  { label: "Proxima fecha", value: selectedExpediente?.nextDate ? formatDateLabel(selectedExpediente.nextDate) : "Sin fecha" },
                ].map((card) => (
                  <div key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{card.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                {CRONOGRAMA_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onSelectTab(tab.key)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      selectedTab === tab.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {selectedExpediente?.sourcePath ? (
                <Button variant="secondary" icon={FiExternalLink} onClick={() => onOpenSource(selectedExpediente.sourcePath)}>
                  Abrir origen
                </Button>
              ) : null}
            </div>
          </Card>

          {selectedTab === "agenda" ? <AgendaItemsList items={agendaRows} onOpen={onOpenSource} /> : null}
          {selectedTab === "coordinar" ? <PendingCoordinationList items={backlogRows} onOpen={onOpenSource} /> : null}
          {selectedTab === "bloqueos" ? (
            <div className="space-y-4">
              <AgendaItemsList items={manualRows} onOpen={onOpenSource} />
              <Card className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Registrar bloqueo manual</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Cuando una tarea todavia no nace desde otro modulo, puedes bloquear la agenda tecnica desde aqui.
                  </p>
                  {selectedExpediente?.userId ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
                      Se asignara a: {selectedExpediente.title}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Fecha</span>
                    <input
                      type="date"
                      className={INPUT_CLASS}
                      value={activityForm.activity_date}
                      onChange={(event) =>
                        setActivityForm((prev) => ({ ...prev, activity_date: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Titulo</span>
                    <input
                      type="text"
                      className={INPUT_CLASS}
                      placeholder="Ej. soporte en sitio o visita interna"
                      value={activityForm.title}
                      onChange={(event) => setActivityForm((prev) => ({ ...prev, title: event.target.value }))}
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Notas</span>
                    <input
                      type="text"
                      className={INPUT_CLASS}
                      placeholder="Detalle opcional para coordinacion"
                      value={activityForm.notes}
                      onChange={(event) => setActivityForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                  </label>
                </div>

                <div>
                  <Button
                    onClick={handleCreateActivity}
                    disabled={savingActivity || !activityForm.activity_date || !activityForm.title.trim()}
                  >
                    {savingActivity ? "Guardando..." : "Agregar bloqueo manual"}
                  </Button>
                </div>
              </Card>
            </div>
          ) : null}
          {selectedTab === "equipo" ? <AvailabilityPanel availability={availability} loading={loading} /> : null}

          {!selectedExpediente && expedientes.length ? (
            <Card className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Selecciona un expediente para revisar su detalle.
            </Card>
          ) : null}

          {!expedientes.length ? (
            <Card className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <FiUsers />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Sin expedientes visibles</h3>
              <p className="mt-2 text-sm text-slate-500">
                No hay agenda tecnica ni pendientes por coordinar con los filtros actuales.
              </p>
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  );
};

const DisponibilidadTecnicos = ({ mode = "combined" }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pageCopy = PAGE_COPY[mode] || PAGE_COPY.combined;
  const isCronogramaMode = mode === "cronograma";
  const showActivitiesFirst = isCronogramaMode;
  const canSwitchScope = canSeeTeamScope(user);

  const [availability, setAvailability] = useState([]);
  const [activities, setActivities] = useState([]);
  const [scheduleFeed, setScheduleFeed] = useState({ rows: [], backlog: [], summary: {} });
  const [scheduleScope, setScheduleScope] = useState(canSwitchScope ? "team" : "mine");
  const [dateRange, setDateRange] = useState(() => buildDefaultRange());
  const [scheduleFilters, setScheduleFilters] = useState({
    category: "all",
    status: "",
    assignee: "all",
  });
  const [selectedExpedienteKey, setSelectedExpedienteKey] = useState("");
  const [selectedCronogramaTab, setSelectedCronogramaTab] = useState("agenda");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityForm, setActivityForm] = useState({
    activity_date: "",
    title: "",
    notes: "",
  });

  useEffect(() => {
    setScheduleScope(canSwitchScope ? "team" : "mine");
  }, [canSwitchScope]);

  useEffect(() => {
    // ing_servicio / esp_app no coordinan equipo: su vista por defecto es el
    // mes en curso con todas sus tareas asignadas, no la ventana de 60 dias
    // pensada para coordinacion de jefe_servicio.
    if (!isCronogramaMode || canSwitchScope) return;
    setDateRange(buildMonthRange());
  }, [canSwitchScope, isCronogramaMode]);

  const openSource = useCallback(
    (path) => {
      if (!path) return;
      navigate(path);
    },
    [navigate],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const from = dateRange.from;
      const to = dateRange.to;

      const requests = [getTeamAvailability()];
      if (isCronogramaMode) {
        requests.push(getTechnicalScheduleFeed({ from, to, scope: scheduleScope }));
      } else {
        requests.push(getTechnicalActivities({ from, to }));
      }

      const [availabilityData, secondPayload] = await Promise.all(requests);
      setAvailability(Array.isArray(availabilityData) ? availabilityData : []);

      if (isCronogramaMode) {
        setScheduleFeed(secondPayload || { rows: [], backlog: [], summary: {} });
        setActivities([]);
      } else {
        setActivities(Array.isArray(secondPayload) ? secondPayload : []);
        setScheduleFeed({ rows: [], backlog: [], summary: {} });
      }
    } catch (error) {
      console.warn("No se pudo cargar disponibilidad tecnica", error);
      setAvailability([]);
      setActivities([]);
      setScheduleFeed({ rows: [], backlog: [], summary: {} });
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to, isCronogramaMode, scheduleScope]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const myAvailability = useMemo(() => {
    if (!user) return null;
    return (
      availability.find(
        (item) =>
          item.userId === user.id ||
          item.user_id === user.id ||
          item.name === user.fullname ||
          item.fullname === user.fullname,
      ) || null
    );
  }, [availability, user]);

  const scheduleMemberOptions = useMemo(() => {
    const map = new Map();
    [...scheduleFeed.rows, ...scheduleFeed.backlog].forEach((item) => {
      const normalizedValue = normalizeText(item.user_name || item.user_id);
      if (!normalizedValue) return;
      if (!map.has(normalizedValue)) {
        map.set(normalizedValue, {
          value: normalizedValue,
          label: item.user_name || `Usuario ${item.user_id}`,
        });
      }
    });
    return Array.from(map.values()).sort((left, right) =>
      String(left.label).localeCompare(String(right.label), "es", { sensitivity: "base" }),
    );
  }, [scheduleFeed.backlog, scheduleFeed.rows]);

  const filteredSchedule = useMemo(() => {
    if (!isCronogramaMode) {
      return { rows: [], backlog: [], summary: {} };
    }

    const normalizedStatus = normalizeText(scheduleFilters.status);
    const assignee = scheduleFilters.assignee;
    const category = scheduleFilters.category;

    const matchesCommon = (item) => {
      const categoryMatch = category === "all" ? true : item.category === category;
      const statusMatch = !normalizedStatus
        ? true
        : normalizeText(item.status || item.coordination_status).includes(normalizedStatus);
      const assigneeValue = normalizeText(item.user_name || item.user_id);
      const assigneeMatch = assignee === "all" ? true : assigneeValue === assignee;
      return categoryMatch && statusMatch && assigneeMatch;
    };

    const rows = scheduleFeed.rows.filter(matchesCommon);
    const backlog = scheduleFeed.backlog.filter(matchesCommon);

    return {
      rows,
      backlog,
      summary: buildScheduleSummaryFromRows(rows, backlog),
    };
  }, [isCronogramaMode, scheduleFeed.backlog, scheduleFeed.rows, scheduleFilters.assignee, scheduleFilters.category, scheduleFilters.status]);

  const groupingMode = scheduleScope === "team" ? "collaborator" : "flat";

  const expedientes = useMemo(() => {
    if (groupingMode === "collaborator") {
      return buildCollaboratorGroups(filteredSchedule.rows, filteredSchedule.backlog, availability);
    }
    return buildFlatGroup(filteredSchedule.rows, filteredSchedule.backlog, user);
  }, [availability, filteredSchedule.backlog, filteredSchedule.rows, groupingMode, user]);

  useEffect(() => {
    if (!isCronogramaMode) return;
    if (!expedientes.length) {
      setSelectedExpedienteKey("");
      return;
    }
    if (!expedientes.some((item) => item.key === selectedExpedienteKey)) {
      setSelectedExpedienteKey(expedientes[0].key);
    }
  }, [expedientes, isCronogramaMode, selectedExpedienteKey]);

  const selectedExpediente = useMemo(
    () => expedientes.find((item) => item.key === selectedExpedienteKey) || null,
    [expedientes, selectedExpedienteKey],
  );

  const cronogramaSummary = useMemo(
    () => ({
      ...filteredSchedule.summary,
      expedientes: expedientes.length,
    }),
    [expedientes.length, filteredSchedule.summary],
  );

  const handleRangeChange = useCallback((field, value) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleScheduleFilterChange = useCallback((field, value) => {
    setScheduleFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const resetScheduleFilters = useCallback(() => {
    setDateRange(buildDefaultRange());
    setScheduleFilters({
      category: "all",
      status: "",
      assignee: "all",
    });
  }, []);

  const toggleMine = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const currentValue = String(myAvailability?.status || "").toLowerCase();
      const nextStatus = ["disponible", "available", "on", "true"].includes(currentValue)
        ? "no_disponible"
        : "disponible";
      await updateAvailabilityStatus(nextStatus);
      await refresh();
    } catch (error) {
      console.warn("No se pudo actualizar tu disponibilidad", error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateActivity = async () => {
    if (!activityForm.activity_date || !activityForm.title.trim()) return;
    try {
      setSavingActivity(true);
      await createTechnicalActivity({
        activity_date: activityForm.activity_date,
        title: activityForm.title.trim(),
        notes: activityForm.notes.trim(),
        // En modo colaborador (jefe_servicio navegando por tecnico) la
        // actividad se asigna al colaborador seleccionado; en modo plano
        // (ing_servicio/esp_app viendo su propio mes) se omite y el backend
        // la asigna al usuario autenticado.
        user_id: groupingMode === "collaborator" ? selectedExpediente?.userId || undefined : undefined,
      });
      setActivityForm({ activity_date: "", title: "", notes: "" });
      await refresh();
    } catch (error) {
      console.warn("No se pudo crear actividad tecnica", error);
    } finally {
      setSavingActivity(false);
    }
  };

  const activityCard = isCronogramaMode ? (
    <div className="space-y-5">
      <ScheduleToolbar
        summary={cronogramaSummary}
        range={dateRange}
        filters={scheduleFilters}
        memberOptions={scheduleMemberOptions}
        scope={scheduleScope}
        canSwitchScope={canSwitchScope}
        onScopeChange={setScheduleScope}
        onRangeChange={handleRangeChange}
        onFilterChange={handleScheduleFilterChange}
        onReset={resetScheduleFilters}
        onRefresh={refresh}
        loading={loading}
      />
      <CronogramaWorkspace
        summary={cronogramaSummary}
        expedientes={expedientes}
        selectedKey={selectedExpedienteKey}
        selectedTab={selectedCronogramaTab}
        onSelectExpediente={setSelectedExpedienteKey}
        onSelectTab={setSelectedCronogramaTab}
        selectedExpediente={selectedExpediente}
        availability={availability}
        loading={loading}
        onOpenSource={openSource}
        activityForm={activityForm}
        setActivityForm={setActivityForm}
        handleCreateActivity={handleCreateActivity}
        savingActivity={savingActivity}
        entityLabel={groupingMode === "collaborator" ? "Colaboradores" : "Mi agenda"}
        showSidebar={groupingMode === "collaborator"}
      />
    </div>
  ) : (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{pageCopy.activitiesTitle}</h2>
        <p className="text-sm text-slate-600">{pageCopy.activitiesDescription}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Fecha</span>
          <input
            type="date"
            className={INPUT_CLASS}
            value={activityForm.activity_date}
            onChange={(event) =>
              setActivityForm((prev) => ({ ...prev, activity_date: event.target.value }))
            }
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Titulo</span>
          <input
            type="text"
            className={INPUT_CLASS}
            placeholder="Ej. reunion operativa o bloqueo de agenda"
            value={activityForm.title}
            onChange={(event) => setActivityForm((prev) => ({ ...prev, title: event.target.value }))}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Notas</span>
          <input
            type="text"
            className={INPUT_CLASS}
            placeholder="Detalle opcional"
            value={activityForm.notes}
            onChange={(event) => setActivityForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </label>
      </div>

      <div>
        <Button
          onClick={handleCreateActivity}
          disabled={savingActivity || !activityForm.activity_date || !activityForm.title.trim()}
        >
          {savingActivity ? "Guardando..." : "Agregar actividad"}
        </Button>
      </div>

      <ActivityList activities={activities} />
    </Card>
  );

  const availabilityCard = (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{pageCopy.availabilityTitle}</h2>
        <p className="text-sm text-slate-600">
          El estado visible aqui alimenta la coordinacion diaria del area tecnica.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando disponibilidad...</p>
      ) : availability.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {availability.map((member) => (
            <div
              key={member.id || member.userId || member.name}
              className={`flex items-start justify-between gap-3 rounded-xl border p-4 ${statusClass(member.status)}`}
            >
              <div>
                <p className="font-semibold">{member.name || member.fullname || "Tecnico"}</p>
                <p className="text-sm opacity-80">
                  {member.updatedAt
                    ? `Actualizado ${new Date(member.updatedAt).toLocaleString()}`
                    : "Sin registro reciente"}
                </p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide">
                {statusLabel(member.status)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Sin tecnicos registrados.</p>
      )}
    </Card>
  );

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} gap-6 px-3 pb-6 sm:px-0`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{pageCopy.eyebrow}</p>
          <h1 className="text-2xl font-semibold text-slate-900">{pageCopy.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{pageCopy.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {user ? (
            <Button
              variant="primary"
              icon={
                myAvailability &&
                ["disponible", "available", "on", "true"].includes(
                  String(myAvailability.status || "").toLowerCase(),
                )
                  ? FiToggleLeft
                  : FiToggleRight
              }
              onClick={toggleMine}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Cambiar mi estado"}
            </Button>
          ) : null}
        </div>
      </div>

      {showActivitiesFirst ? activityCard : availabilityCard}
      {!isCronogramaMode ? activityCard : null}
    </div>
  );
};

export default DisponibilidadTecnicos;
