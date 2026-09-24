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
import {
  WORKSPACE_2COL_CLASS,
  WORKSPACE_MAIN_CLASS,
  WORKSPACE_PAGE_CLASS,
  WORKSPACE_SIDEBAR_CLASS,
} from "../../../core/ui/workspaceLayout";
import ServicioCard from "../design/ServicioCard";
import ServicioBadge from "../design/ServicioBadge";
import ServicioMetric from "../design/ServicioMetric";
import ServicioEmptyState from "../design/ServicioEmptyState";
import ServicioCalendarGrid from "../design/ServicioCalendarGrid";
import { scheduleCategoryTone } from "../components/dashboard/dashboardViewShared";
import "../design/tokens.css";

const inputClass = "rounded-[var(--st-radius-md)] border px-3 py-2 text-sm outline-none";
const inputStyle = { borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" };

const SCHEDULE_CATEGORY_OPTIONS = [
  { value: "all", label: "Todos los tipos" },
  { value: "inspection", label: "Inspecciones" },
  { value: "maintenance", label: "Mantenimientos" },
  { value: "training", label: "Capacitaciones" },
  { value: "withdrawal", label: "Retiros" },
  { value: "corrective", label: "Correctivos" },
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

const LEAD_ROLES = new Set(["jefe_tecnico", "jefe_servicio", "jefe_servicio_tecnico", "gerencia", "gerencia_general", "director"]);

const normalizeTokens = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item || "").toLowerCase()).filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
};

const canSeeTeamScope = (user) => {
  const tokens = new Set([...normalizeTokens(user?.role), ...normalizeTokens(user?.scope)]);
  return Array.from(tokens).some((token) => LEAD_ROLES.has(token));
};

const availabilityTone = (status) => {
  const value = String(status || "").toLowerCase();
  if (["disponible", "available", "on", "true"].includes(value)) return "success";
  if (["ocupado", "busy"].includes(value)) return "warning";
  return "danger";
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
    return new Date(`${safeValue}T00:00:00`).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return safeValue;
  }
};

const normalizeText = (value) =>
  String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const buildDefaultRange = () => {
  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const toDate = new Date(today);
  toDate.setDate(toDate.getDate() + 60);
  return { from, to: toDate.toISOString().slice(0, 10) };
};

const buildMonthRange = (anchor = new Date()) => {
  const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).toISOString().slice(0, 10);
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
    withdrawal: rows.filter((item) => item.category === "withdrawal").length,
    corrective: rows.filter((item) => item.category === "corrective").length,
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
      map.set(key, { key, userId: userId || null, sourcePath: "", title: userName || "Sin asignar", assignee: userName || "Sin responsable visible", rows: [], backlog: [] });
    }
    return map.get(key);
  };

  teamMembers.forEach((member) => getGroup(member.id ?? member.userId, member.name || member.fullname));
  rows.forEach((item) => getGroup(item.user_id, item.user_name).rows.push(item));
  backlog.forEach((item) => getGroup(item.user_id, item.user_name).backlog.push(item));

  return Array.from(map.values())
    .map((group) => {
      const manualRows = group.rows.filter((item) => item.category === "manual");
      const nextDate = group.rows.map((item) => String(item.activity_date || "").slice(0, 10)).filter(Boolean).sort()[0];
      return { ...group, nextDate, totalRows: group.rows.length, totalBacklog: group.backlog.length, totalManual: manualRows.length };
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
    nextDate: rows.map((item) => String(item.activity_date || "").slice(0, 10)).filter(Boolean).sort()[0],
    totalRows: rows.length,
    totalBacklog: backlog.length,
    totalManual: rows.filter((item) => item.category === "manual").length,
  },
];

const ActivityList = ({ activities }) => (
  <div className="space-y-2">
    {activities.length ? (
      activities.map((activity) => (
        <div key={activity.id} className="flex flex-col gap-1 rounded-[var(--st-radius-md)] border px-3 py-3 text-sm md:flex-row md:items-center md:justify-between" style={{ borderColor: "var(--st-border)", background: "var(--st-surface-sunken)" }}>
          <div>
            <p className="font-medium" style={{ color: "var(--st-text)" }}>{activity.title}</p>
            <p className="text-xs" style={{ color: "var(--st-text-faint)" }}>{activity.activity_date} · {activity.user_name || "Equipo técnico"}</p>
          </div>
          <p className="text-xs" style={{ color: "var(--st-text-muted)" }}>{activity.notes || "Sin notas"}</p>
        </div>
      ))
    ) : (
      <p className="text-sm" style={{ color: "var(--st-text-faint)" }}>No hay actividades registradas en los próximos 60 días.</p>
    )}
  </div>
);

const PendingCoordinationList = ({ items, onOpen }) => (
  <ServicioCard className="space-y-4 p-5">
    <div>
      <h2 className="text-lg font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Inspecciones por coordinar</h2>
      <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Estas solicitudes ya existen y todavía no tienen fecha cerrada dentro del cronograma técnico.</p>
    </div>

    {items.length ? (
      <div className="space-y-3">
        {items.map((item) => (
          <ServicioCard key={item.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium" style={{ color: "var(--st-text)" }}>{item.title}</p>
                <ServicioBadge tone="warning">{item.coordination_status || "pending_proposal"}</ServicioBadge>
              </div>
              <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>Ventana: {formatDateLabel(item.window_min_date)} - {formatDateLabel(item.window_max_date)}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--st-text-faint)" }}>{item.user_name ? `Técnico sugerido: ${item.user_name}` : "Técnico aún no visible en esta solicitud"}</p>
            </div>
            <Button variant="secondary" icon={FiExternalLink} onClick={() => onOpen(item.source_path)}>Abrir origen</Button>
          </ServicioCard>
        ))}
      </div>
    ) : (
      <p className="text-sm" style={{ color: "var(--st-text-faint)" }}>No hay inspecciones pendientes de coordinación en este rango.</p>
    )}
  </ServicioCard>
);

const CRONOGRAMA_TABS = [
  { key: "agenda", label: "Agenda" },
  { key: "calendario", label: "Calendario" },
  { key: "coordinar", label: "Por coordinar" },
  { key: "bloqueos", label: "Bloqueos" },
  { key: "equipo", label: "Equipo" },
];

const ScheduleToolbar = ({ summary, range, filters, memberOptions, scope, canSwitchScope, onScopeChange, onRangeChange, onFilterChange, onReset, onRefresh, loading }) => (
  <ServicioCard className="space-y-4 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2" style={{ color: "var(--st-text-faint)" }}>
          <FiFilter className="text-sm" />
          <span className="text-xs font-semibold uppercase tracking-[0.22em]">Vista operativa</span>
        </div>
        <h2 className="mt-2 text-xl font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Expedientes técnicos</h2>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--st-text-muted)" }}>La agenda se agrupa por expediente para abrir el origen correcto y revisar coordinación, bloqueos y responsables.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canSwitchScope ? (
          <div className="flex overflow-hidden rounded-[var(--st-radius-md)] border text-xs font-semibold" style={{ borderColor: "var(--st-border)" }}>
            <button type="button" onClick={() => onScopeChange("team")} className="px-3 py-2 transition-colors" style={scope === "team" ? { background: "var(--st-accent)", color: "#fff" } : { background: "var(--st-surface)", color: "var(--st-text-muted)" }}>Equipo</button>
            <button type="button" onClick={() => onScopeChange("mine")} className="px-3 py-2 transition-colors" style={scope === "mine" ? { background: "var(--st-accent)", color: "#fff" } : { background: "var(--st-surface)", color: "var(--st-text-muted)" }}>Mi agenda</button>
          </div>
        ) : null}
        <Button variant="secondary" icon={FiRefreshCw} onClick={onRefresh} disabled={loading}>Actualizar</Button>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <ServicioMetric label="Expedientes" value={summary?.expedientes || 0} />
      <ServicioMetric label="Eventos" value={summary?.total_events || 0} />
      <ServicioMetric label="Por coordinar" value={summary?.pending_coordination || 0} />
      <ServicioMetric label="Bloqueos" value={summary?.by_category?.manual || 0} />
    </div>

    <div className={`grid grid-cols-1 gap-3 ${canSwitchScope ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>
      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: "var(--st-text-faint)" }}>Desde</span>
        <input type="date" className={inputClass} style={inputStyle} value={range.from} onChange={(event) => onRangeChange("from", event.target.value)} />
      </label>
      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: "var(--st-text-faint)" }}>Hasta</span>
        <input type="date" className={inputClass} style={inputStyle} value={range.to} onChange={(event) => onRangeChange("to", event.target.value)} />
      </label>
      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: "var(--st-text-faint)" }}>Tipo</span>
        <select className={inputClass} style={inputStyle} value={filters.category} onChange={(event) => onFilterChange("category", event.target.value)}>
          {SCHEDULE_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: "var(--st-text-faint)" }}>Estado</span>
        <input type="text" className={inputClass} style={inputStyle} placeholder="programado, en proceso, pendiente" value={filters.status} onChange={(event) => onFilterChange("status", event.target.value)} />
      </label>
      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: "var(--st-text-faint)" }}>Responsable</span>
        <select className={inputClass} style={inputStyle} value={filters.assignee} onChange={(event) => onFilterChange("assignee", event.target.value)}>
          <option value="all">Todo el equipo visible</option>
          {memberOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      {canSwitchScope ? (
        // T10: jefe_servicio necesita comparar carga de ing_servicio vs
        // esp_app para decidir a quien asignar un caso nuevo -- antes no
        // habia forma de aislar el cronograma por especialidad, solo por
        // responsable individual.
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: "var(--st-text-faint)" }}>Especialidad</span>
          <select className={inputClass} style={inputStyle} value={filters.specialty} onChange={(event) => onFilterChange("specialty", event.target.value)}>
            <option value="all">Todas</option>
            <option value="ing_servicio">Ingeniería</option>
            <option value="esp_app">Aplicaciones</option>
          </select>
        </label>
      ) : null}
    </div>

    <div className="flex justify-end">
      <Button variant="ghost" onClick={onReset}>Limpiar filtros</Button>
    </div>
  </ServicioCard>
);

// Roster clicable con inicial tipo avatar -- mismo lenguaje que
// TechnicianRoster (AssignInspectionPanel, Fase 2) y la lista "Equipo" del
// Dashboard (Fase 1). Antes cada expediente era una card con borde propio +
// sombra al seleccionar, que es el mismo patron de card-grid generico que ya
// se reemplazo en el resto del rework.
const ExpedienteSidebar = ({ expedientes, selectedKey, onSelect, entityLabel = "Expedientes" }) => (
  <aside className={`${WORKSPACE_SIDEBAR_CLASS} lg:col-span-4`}>
    <div className="flex h-full flex-col" style={{ background: "var(--st-surface)" }}>
      <div className="px-4 py-4 lg:px-5" style={{ borderBottom: "1px solid var(--st-border)" }}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--st-text-faint)" }}>{entityLabel}</p>
        <h3 className="mt-2 text-lg font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Consolidado técnico</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>
          {entityLabel === "Colaboradores" ? "Selecciona un colaborador para revisar todo su calendario y agregarle actividades." : "Selecciona un expediente para revisar agenda, pendientes y bloqueos manuales."}
        </p>
      </div>

      <div className="flex-1 divide-y overflow-y-auto" style={{ borderColor: "var(--st-border)" }}>
        {expedientes.length ? (
          expedientes.map((expediente) => {
            const isActive = expediente.key === selectedKey;
            const initial = String(expediente.title || "?").trim().charAt(0).toUpperCase();
            return (
              <button
                key={expediente.key}
                type="button"
                onClick={() => onSelect(expediente.key)}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors duration-100 lg:px-5"
                style={isActive ? { background: "var(--st-accent-soft)" } : { background: "var(--st-surface)" }}
              >
                <span
                  className="font-mono-data mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: isActive ? "var(--st-accent)" : "var(--st-surface-sunken)", color: isActive ? "#fff" : "var(--st-text-faint)" }}
                >
                  {initial}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold" style={{ color: isActive ? "var(--st-accent-strong)" : "var(--st-text)" }}>{expediente.title}</p>
                    {expediente.totalBacklog ? <ServicioBadge tone="danger">{expediente.totalBacklog}</ServicioBadge> : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs" style={{ color: "var(--st-text-muted)" }}>{expediente.assignee || "Sin responsable visible"}</p>
                  <p className="font-mono-data mt-1 text-[11px] tabular-nums" style={{ color: "var(--st-text-faint)" }}>
                    {expediente.totalRows} eventos · {expediente.totalManual} bloqueos · {expediente.nextDate ? formatDateLabel(expediente.nextDate) : "sin fecha"}
                  </p>
                </div>
              </button>
            );
          })
        ) : (
          <ServicioEmptyState title="No hay expedientes en el rango consultado." description="Ajusta fechas o filtros para encontrar actividad técnica." />
        )}
      </div>
    </div>
  </aside>
);

const AGENDA_TYPE_TAG = {
  inspection: "INS",
  withdrawal: "RET",
  corrective: "COR",
  maintenance: "MNT",
  training: "CAP",
  manual: "GEN",
};

const AGENDA_TONE_COLOR = {
  danger: "var(--st-danger)",
  warning: "var(--st-warning)",
  info: "var(--st-info)",
  accent: "var(--st-accent-strong)",
  success: "var(--st-success)",
  neutral: "var(--st-text-faint)",
};

// Fila tipo docket -- mismo lenguaje que DispatchLog del Dashboard (Fase 1):
// tag mono de 3 letras en vez de badge+icono repetido, sin caja por fila,
// solo divisor fino. Antes cada actividad era una ServicioCard completa
// apilada, mismo patron generico "card por item" que el resto del rework ya
// abandono.
const AgendaItemsList = ({ items = [], onOpen }) => (
  <div className="divide-y" style={{ borderColor: "var(--st-border)" }}>
    {items.length ? (
      items.map((item) => {
        const tone = scheduleCategoryTone(item.category);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => item.source_path && onOpen(item.source_path)}
            className="group flex w-full items-start gap-3 py-3 text-left transition-colors duration-150 hover:bg-[var(--st-surface-sunken)]"
          >
            <span
              className="font-mono-data mt-0.5 shrink-0 rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
              style={{ background: "var(--st-surface-sunken)", color: AGENDA_TONE_COLOR[tone] || AGENDA_TONE_COLOR.neutral }}
            >
              {AGENDA_TYPE_TAG[item.category] || "GEN"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono-data text-xs tabular-nums" style={{ color: "var(--st-text-faint)" }}>{formatDateLabel(item.activity_date)}</span>
                <span className="truncate text-sm font-semibold" style={{ color: "var(--st-text)" }}>{item.title}</span>
              </span>
              <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--st-text-muted)" }}>{item.notes || "Sin observaciones adicionales"}</span>
              <span className="mt-1 block text-[11px]" style={{ color: "var(--st-text-faint)" }}>
                {item.user_name ? `${item.user_name} · ` : ""}{formatScheduleStatus(item.status || "programado")}
              </span>
            </span>
            {item.source_path ? (
              <FiExternalLink size={13} className="mt-1 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100" style={{ color: "var(--st-text-faint)" }} />
            ) : null}
          </button>
        );
      })
    ) : (
      <ServicioEmptyState title="No hay elementos para esta pestaña." />
    )}
  </div>
);

const CalendarTabView = ({ items = [], calendarMonth, onPrevMonth, onNextMonth, onToday, onOpen }) => {
  const events = useMemo(
    () => items.map((item) => ({ date: item.activity_date, label: item.title, tone: scheduleCategoryTone(item.category), href: item.source_path })),
    [items],
  );
  return (
    <ServicioCard className="p-5">
      <ServicioCalendarGrid
        month={calendarMonth}
        events={events}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onToday={onToday}
        onSelectDate={(_dateKey, dayEvents) => {
          const first = dayEvents?.[0];
          if (first?.href) onOpen(first.href);
        }}
      />
    </ServicioCard>
  );
};

const AvailabilityPanel = ({ availability, loading }) => (
  <div className="space-y-3">
    {loading ? (
      <ServicioCard className="px-4 py-6 text-sm" style={{ color: "var(--st-text-muted)" }}>Cargando disponibilidad...</ServicioCard>
    ) : availability.length ? (
      availability.map((member) => (
        <ServicioCard key={member.id || member.userId || member.name} className="flex items-start justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <p className="font-semibold" style={{ color: "var(--st-text)" }}>{member.name || member.fullname || "Técnico"}</p>
            <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>{member.updatedAt ? `Actualizado ${new Date(member.updatedAt).toLocaleString()}` : "Sin registro reciente"}</p>
          </div>
          <ServicioBadge tone={availabilityTone(member.status)}>{statusLabel(member.status)}</ServicioBadge>
        </ServicioCard>
      ))
    ) : (
      <ServicioEmptyState title="Sin técnicos registrados." />
    )}
  </div>
);

const CronogramaWorkspace = ({
  summary, expedientes, selectedKey, selectedTab, onSelectExpediente, onSelectTab, selectedExpediente,
  availability, loading, onOpenSource, activityForm, setActivityForm, handleCreateActivity, savingActivity,
  entityLabel = "Expedientes", showSidebar = true, calendarMonth, onPrevMonth, onNextMonth, onToday,
}) => {
  const agendaRows = selectedExpediente?.rows.filter((item) => item.category !== "manual") || [];
  const backlogRows = selectedExpediente?.backlog || [];
  const manualRows = selectedExpediente?.rows.filter((item) => item.category === "manual") || [];
  const calendarRows = selectedExpediente?.rows || [];

  return (
    <div className={showSidebar ? WORKSPACE_2COL_CLASS : "grid grid-cols-1"}>
      {showSidebar ? <ExpedienteSidebar expedientes={expedientes} selectedKey={selectedKey} onSelect={onSelectExpediente} entityLabel={entityLabel} /> : null}

      <main className={showSidebar ? `${WORKSPACE_MAIN_CLASS} lg:col-span-8` : WORKSPACE_MAIN_CLASS}>
        <div className="space-y-5 p-4 lg:p-5">
          <ServicioCard className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ServicioBadge tone="accent">Expediente activo</ServicioBadge>
                  {selectedExpediente?.totalBacklog ? <ServicioBadge tone="danger">{selectedExpediente.totalBacklog} por coordinar</ServicioBadge> : null}
                </div>
                <h2 className="mt-3 text-2xl font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>{selectedExpediente?.title || "Sin expediente seleccionado"}</h2>
                <p className="mt-2 text-sm" style={{ color: "var(--st-text-muted)" }}>
                  {selectedExpediente?.assignee ? `Responsable visible: ${selectedExpediente.assignee}` : "Este expediente no expone un responsable visible en el feed."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
                <ServicioMetric label="Eventos" value={selectedExpediente?.totalRows || 0} />
                <ServicioMetric label="Bloqueos" value={selectedExpediente?.totalManual || 0} />
                <ServicioMetric label="Coordinar" value={selectedExpediente?.totalBacklog || 0} />
                <ServicioMetric label="Próxima fecha" value={selectedExpediente?.nextDate ? formatDateLabel(selectedExpediente.nextDate) : "Sin fecha"} />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center border-y" style={{ borderColor: "var(--st-border)" }}>
                {CRONOGRAMA_TABS.map((tab, index) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onSelectTab(tab.key)}
                    className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors duration-150"
                    style={{ color: selectedTab === tab.key ? "var(--st-accent-strong)" : "var(--st-text-muted)", borderLeft: index > 0 ? "1px solid var(--st-border)" : undefined }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {selectedExpediente?.sourcePath ? (
                <Button variant="secondary" icon={FiExternalLink} onClick={() => onOpenSource(selectedExpediente.sourcePath)}>Abrir origen</Button>
              ) : null}
            </div>
          </ServicioCard>

          {selectedTab === "agenda" ? <AgendaItemsList items={agendaRows} onOpen={onOpenSource} /> : null}
          {selectedTab === "calendario" ? (
            <CalendarTabView items={calendarRows} calendarMonth={calendarMonth} onPrevMonth={onPrevMonth} onNextMonth={onNextMonth} onToday={onToday} onOpen={onOpenSource} />
          ) : null}
          {selectedTab === "coordinar" ? <PendingCoordinationList items={backlogRows} onOpen={onOpenSource} /> : null}
          {selectedTab === "bloqueos" ? (
            <div className="space-y-4">
              <AgendaItemsList items={manualRows} onOpen={onOpenSource} />
              <ServicioCard className="space-y-4 p-5">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Registrar bloqueo manual</h3>
                  <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>Cuando una tarea todavía no nace desde otro módulo, puedes bloquear la agenda técnica desde aquí.</p>
                  {selectedExpediente?.userId ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--st-accent)" }}>Se asignará a: {selectedExpediente.title}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: "var(--st-text-faint)" }}>Fecha</span>
                    <input type="date" className={inputClass} style={inputStyle} value={activityForm.activity_date} onChange={(event) => setActivityForm((prev) => ({ ...prev, activity_date: event.target.value }))} />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: "var(--st-text-faint)" }}>Título</span>
                    <input type="text" className={inputClass} style={inputStyle} placeholder="Ej. soporte en sitio o visita interna" value={activityForm.title} onChange={(event) => setActivityForm((prev) => ({ ...prev, title: event.target.value }))} />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: "var(--st-text-faint)" }}>Notas</span>
                    <input type="text" className={inputClass} style={inputStyle} placeholder="Detalle opcional para coordinación" value={activityForm.notes} onChange={(event) => setActivityForm((prev) => ({ ...prev, notes: event.target.value }))} />
                  </label>
                </div>

                <div>
                  <Button onClick={handleCreateActivity} disabled={savingActivity || !activityForm.activity_date || !activityForm.title.trim()}>
                    {savingActivity ? "Guardando..." : "Agregar bloqueo manual"}
                  </Button>
                </div>
              </ServicioCard>
            </div>
          ) : null}
          {selectedTab === "equipo" ? <AvailabilityPanel availability={availability} loading={loading} /> : null}

          {!selectedExpediente && expedientes.length ? (
            <ServicioCard className="p-8 text-center text-sm" style={{ color: "var(--st-text-muted)" }}>Selecciona un expediente para revisar su detalle.</ServicioCard>
          ) : null}

          {!expedientes.length ? <ServicioEmptyState icon={FiUsers} title="Sin expedientes visibles" description="No hay agenda técnica ni pendientes por coordinar con los filtros actuales." /> : null}
        </div>
      </main>
    </div>
  );
};

// T7 del plan de rework: "Mi disponibilidad" y "Cronograma del equipo" eran
// 2 rutas separadas que renderizaban arboles de UI completamente distintos
// segun el prop `mode` -- practicamente 2 paginas con el mismo header. Ahora
// es 1 pantalla con 2 pestanas reales (mismo patron de tag mono + tabs de
// texto que Mantenimientos PLAN/CASO); `mode` solo decide la pestana inicial
// segun por que URL entro el usuario, las rutas /disponibilidad y
// /cronograma se mantienen intactas (no rompen enlaces guardados).
const AREA_COPY = {
  mine: {
    tag: "AGENDA",
    title: "Mi disponibilidad",
    description: "Consulta tu estado visible para el equipo y registra actividades que bloqueen tu agenda.",
  },
  team: {
    tag: "EQUIPO",
    title: "Cronograma del equipo",
    description: "Concentra agenda fechada, inspecciones por coordinar y bloqueos manuales del area tecnica.",
  },
};

const DisponibilidadTecnicos = ({ mode = "combined" }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canSwitchScope = canSeeTeamScope(user);
  const [activeArea, setActiveArea] = useState(mode === "cronograma" ? "team" : "mine");
  const isCronogramaMode = activeArea === "team";
  const pageCopy = AREA_COPY[activeArea];
  const showActivitiesFirst = isCronogramaMode;

  const [availability, setAvailability] = useState([]);
  const [activities, setActivities] = useState([]);
  const [scheduleFeed, setScheduleFeed] = useState({ rows: [], backlog: [], summary: {} });
  const [scheduleScope, setScheduleScope] = useState(canSwitchScope ? "team" : "mine");
  const [dateRange, setDateRange] = useState(() => buildDefaultRange());
  const [scheduleFilters, setScheduleFilters] = useState({ category: "all", status: "", assignee: "all", specialty: "all" });
  const [selectedExpedienteKey, setSelectedExpedienteKey] = useState("");
  const [selectedCronogramaTab, setSelectedCronogramaTab] = useState("agenda");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityForm, setActivityForm] = useState({ activity_date: "", title: "", notes: "" });

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

  const openSource = useCallback((path) => {
    if (!path) return;
    navigate(path);
  }, [navigate]);

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

  // Al navegar el calendario a otro mes, el rango de consulta se mueve con
  // el para traer los eventos reales de ese mes (si el usuario coordina
  // equipo con ventana de 60 dias, esto solo aplica dentro de esa ventana).
  const goToMonth = useCallback((nextMonth) => {
    setCalendarMonth(nextMonth);
    setDateRange(buildMonthRange(nextMonth));
  }, []);

  const myAvailability = useMemo(() => {
    if (!user) return null;
    return availability.find((item) => item.userId === user.id || item.user_id === user.id || item.name === user.fullname || item.fullname === user.fullname) || null;
  }, [availability, user]);

  const myCalendarEvents = useMemo(
    () => activities.map((activity) => ({ date: activity.activity_date, label: activity.title, tone: "accent" })),
    [activities],
  );

  const scheduleMemberOptions = useMemo(() => {
    const map = new Map();
    [...scheduleFeed.rows, ...scheduleFeed.backlog].forEach((item) => {
      const normalizedValue = normalizeText(item.user_name || item.user_id);
      if (!normalizedValue) return;
      if (!map.has(normalizedValue)) map.set(normalizedValue, { value: normalizedValue, label: item.user_name || `Usuario ${item.user_id}` });
    });
    return Array.from(map.values()).sort((left, right) => String(left.label).localeCompare(String(right.label), "es", { sensitivity: "base" }));
  }, [scheduleFeed.backlog, scheduleFeed.rows]);

  const roleByUserId = useMemo(() => {
    const map = new Map();
    availability.forEach((member) => {
      const id = member.userId ?? member.user_id;
      if (id != null) map.set(String(id), String(member.role || "").toLowerCase());
    });
    return map;
  }, [availability]);

  const filteredSchedule = useMemo(() => {
    if (!isCronogramaMode) return { rows: [], backlog: [], summary: {} };

    const normalizedStatus = normalizeText(scheduleFilters.status);
    const assignee = scheduleFilters.assignee;
    const category = scheduleFilters.category;
    const specialty = scheduleFilters.specialty;

    const matchesCommon = (item) => {
      const categoryMatch = category === "all" ? true : item.category === category;
      const statusMatch = !normalizedStatus ? true : normalizeText(item.status || item.coordination_status).includes(normalizedStatus);
      const assigneeValue = normalizeText(item.user_name || item.user_id);
      const assigneeMatch = assignee === "all" ? true : assigneeValue === assignee;
      const specialtyMatch = specialty === "all" || !specialty ? true : roleByUserId.get(String(item.user_id)) === specialty;
      return categoryMatch && statusMatch && assigneeMatch && specialtyMatch;
    };

    const rows = scheduleFeed.rows.filter(matchesCommon);
    const backlog = scheduleFeed.backlog.filter(matchesCommon);

    return { rows, backlog, summary: buildScheduleSummaryFromRows(rows, backlog) };
  }, [isCronogramaMode, scheduleFeed.backlog, scheduleFeed.rows, scheduleFilters.assignee, scheduleFilters.category, scheduleFilters.status, scheduleFilters.specialty, roleByUserId]);

  const groupingMode = scheduleScope === "team" ? "collaborator" : "flat";

  const expedientes = useMemo(() => {
    if (groupingMode === "collaborator") return buildCollaboratorGroups(filteredSchedule.rows, filteredSchedule.backlog, availability);
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

  const selectedExpediente = useMemo(() => expedientes.find((item) => item.key === selectedExpedienteKey) || null, [expedientes, selectedExpedienteKey]);

  const cronogramaSummary = useMemo(() => ({ ...filteredSchedule.summary, expedientes: expedientes.length }), [expedientes.length, filteredSchedule.summary]);

  const handleRangeChange = useCallback((field, value) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleScheduleFilterChange = useCallback((field, value) => {
    setScheduleFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const resetScheduleFilters = useCallback(() => {
    setDateRange(buildDefaultRange());
    setScheduleFilters({ category: "all", status: "", assignee: "all", specialty: "all" });
  }, []);

  const toggleMine = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const currentValue = String(myAvailability?.status || "").toLowerCase();
      const nextStatus = ["disponible", "available", "on", "true"].includes(currentValue) ? "no_disponible" : "disponible";
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
        calendarMonth={calendarMonth}
        onPrevMonth={() => goToMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
        onNextMonth={() => goToMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
        onToday={() => goToMonth(new Date())}
      />
    </div>
  ) : (
    <div className="space-y-5">
      {/* Fase G aplicada tambien a la vista personal: antes solo el
          cronograma de equipo tenia calendario real (ServicioCalendarGrid),
          "Mi disponibilidad" era unicamente una lista plana. */}
      <ServicioCard className="p-5">
        <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Mi calendario</h2>
        <ServicioCalendarGrid
          month={calendarMonth}
          events={myCalendarEvents}
          onPrevMonth={() => goToMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
          onNextMonth={() => goToMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
          onToday={() => goToMonth(new Date())}
        />
      </ServicioCard>

      <ServicioCard className="space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Cronograma de actividades técnicas</h2>
          <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Registra actividades para bloquear fechas en coordinación de inspecciones y otras tareas del área.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: "var(--st-text-faint)" }}>Fecha</span>
            <input type="date" className={inputClass} style={inputStyle} value={activityForm.activity_date} onChange={(event) => setActivityForm((prev) => ({ ...prev, activity_date: event.target.value }))} />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: "var(--st-text-faint)" }}>Título</span>
            <input type="text" className={inputClass} style={inputStyle} placeholder="Ej. reunión operativa o bloqueo de agenda" value={activityForm.title} onChange={(event) => setActivityForm((prev) => ({ ...prev, title: event.target.value }))} />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: "var(--st-text-faint)" }}>Notas</span>
            <input type="text" className={inputClass} style={inputStyle} placeholder="Detalle opcional" value={activityForm.notes} onChange={(event) => setActivityForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </label>
        </div>

        <div>
          <Button onClick={handleCreateActivity} disabled={savingActivity || !activityForm.activity_date || !activityForm.title.trim()}>
            {savingActivity ? "Guardando..." : "Agregar actividad"}
          </Button>
        </div>

        <ActivityList activities={activities} />
      </ServicioCard>
    </div>
  );

  const availabilityCard = (
    <ServicioCard className="p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Disponibilidad visible del equipo</h2>
        <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>El estado visible aquí alimenta la coordinación diaria del área técnica.</p>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Cargando disponibilidad...</p>
      ) : availability.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {availability.map((member) => (
            <ServicioCard key={member.id || member.userId || member.name} className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="font-semibold" style={{ color: "var(--st-text)" }}>{member.name || member.fullname || "Técnico"}</p>
                <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>{member.updatedAt ? `Actualizado ${new Date(member.updatedAt).toLocaleString()}` : "Sin registro reciente"}</p>
              </div>
              <ServicioBadge tone={availabilityTone(member.status)}>{statusLabel(member.status)}</ServicioBadge>
            </ServicioCard>
          ))}
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Sin técnicos registrados.</p>
      )}
    </ServicioCard>
  );

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} st-scope gap-6 px-3 pb-6 sm:px-0`} style={{ background: "var(--st-bg)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="font-mono-data inline-block rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
            style={{ background: "var(--st-accent-soft)", color: "var(--st-accent-strong)" }}
          >
            {pageCopy.tag}
          </span>
          <h1 className="mt-2 text-2xl font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>{pageCopy.title}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>{pageCopy.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center border-y" style={{ borderColor: "var(--st-border)" }}>
            <button
              type="button"
              onClick={() => setActiveArea("mine")}
              className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors duration-150"
              style={{ color: activeArea === "mine" ? "var(--st-accent-strong)" : "var(--st-text-muted)" }}
            >
              Mi agenda
            </button>
            <button
              type="button"
              onClick={() => setActiveArea("team")}
              className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors duration-150"
              style={{ color: activeArea === "team" ? "var(--st-accent-strong)" : "var(--st-text-muted)", borderLeft: "1px solid var(--st-border)" }}
            >
              Cronograma equipo
            </button>
          </div>
          {user ? (
            <Button
              variant="primary"
              icon={myAvailability && ["disponible", "available", "on", "true"].includes(String(myAvailability.status || "").toLowerCase()) ? FiToggleLeft : FiToggleRight}
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
