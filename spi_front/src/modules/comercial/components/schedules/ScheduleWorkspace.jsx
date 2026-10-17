import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, PolylineF } from "@react-google-maps/api";
import { useGoogleMaps } from "../../../../core/contexts/GoogleMapsContext";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiDownload,
  FiEdit2,
  FiMapPin,
  FiNavigation,
  FiPlus,
  FiRefreshCw,
  FiSend,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import Button from "../../../../core/ui/components/Button";
import Modal from "../../../../core/ui/components/Modal";
import ScheduleMapErrorBoundary from "./ScheduleMapErrorBoundary";
import ScheduleStatusBadge from "./ScheduleStatusBadge";
import {
  WORKSPACE_2COL_CLASS,
  WORKSPACE_SIDEBAR_CLASS,
  WORKSPACE_MAIN_CLASS,
} from "../../../../core/ui/workspaceLayout";
import { useAuth } from "../../../../core/auth/useAuth";
import { useUI } from "../../../../core/ui/useUI";
import { fetchClients } from "../../../../core/api/clientsApi";
import { fetchLeads } from "../../../../core/api/crmFamApi";
import {
  justifySchedule,
  justifyScheduledVisit,
  optimizeRoute,
} from "../../../../core/api/schedulesApi";

// ── Constants ──────────────────────────────────────────────────────────────────

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
const GOOGLE_MAPS_MAP_ID  = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID  || "DEMO_MAP_ID";
const DEFAULT_MAP_CENTER  = { lat: -1.831239, lng: -78.183406 };

const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const PRIORITY_LABELS = { 1: "Baja", 2: "Media", 3: "Alta" };
const PRIORITY_CLS    = {
  1: "bg-[#F3F4F6] text-[#6B7280]",
  2: "bg-[#FEF3C7] text-[#D97706]",
  3: "bg-[#FEE2E2] text-[#DC2626]",
};
const STATUS_FILTER_OPTS = [
  { key: "all",             label: "Todos" },
  { key: "draft",           label: "Borrador" },
  { key: "pending_approval",label: "Pendiente" },
  { key: "approved",        label: "Aprobado" },
  { key: "rejected",        label: "Rechazado" },
];
const VISIT_STATUS_CLS = {
  visited:   "bg-[#DCFCE7] text-[#16A34A]",
  skipped:   "bg-[#FEE2E2] text-[#DC2626]",
  in_visit:  "bg-[#DBEAFE] text-[#1D4ED8]",
  pending:   "bg-[#F3F4F6] text-[#6B7280]",
};
const VISIT_STATUS_LABELS = {
  visited:  "Visitado",
  skipped:  "Omitido",
  in_visit: "En visita",
  pending:  "Pendiente",
};
const CURRENT_DATE  = new Date();
const DEFAULT_MONTH = CURRENT_DATE.getMonth() + 1;
const DEFAULT_YEAR  = CURRENT_DATE.getFullYear();

const getVisitDisplayName = (visit) => (
  visit?.client_name
  || visit?.prospect_name
  || (visit?.client_request_id ? `Cliente #${visit.client_request_id}` : "Visita sin nombre")
);

// ── Helpers ────────────────────────────────────────────────────────────────────

const monthLabel = (month, year) =>
  `${MONTHS[(Number(month) || 1) - 1]} ${year}`;

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = String(dateStr).slice(0, 10).split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString("es-EC", { weekday: "short", day: "numeric", month: "short" });
};

const formatFullDate = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = String(dateStr).slice(0, 10).split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

const normalizeCityKey = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-EC");

const formatCityLabel = (value) =>
  normalizeCityKey(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("es-EC") + word.slice(1))
    .join(" ");

const sameCity = (left, right) => normalizeCityKey(left) === normalizeCityKey(right);

const uniqCities = (clients = [], leads = []) => {
  const cityMap = new Map();
  [
    ...clients.map((client) => client?.shipping_city || client?.shipping_province || ""),
    ...leads.map((lead) => lead?.city || ""),
  ]
    .map((city) => String(city || "").trim())
    .filter(Boolean)
    .forEach((city) => {
      const key = normalizeCityKey(city);
      if (!key || cityMap.has(key)) return;
      cityMap.set(key, formatCityLabel(city));
    });

  return [...cityMap.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((left, right) => left.label.localeCompare(right.label, "es", { sensitivity: "base" }));
};

const toDateKey = (date) => {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safeDate.getTime())) return "";
  return safeDate.toISOString().slice(0, 10);
};

const buildFourWeekBlocks = (month, year) => {
  const safeMonth = Number(month || 0);
  const safeYear = Number(year || 0);
  if (!safeMonth || !safeYear) return [];

  const lastDay = new Date(safeYear, safeMonth, 0).getDate();
  const ranges = [
    [1, Math.min(7, lastDay)],
    [8, Math.min(14, lastDay)],
    [15, Math.min(21, lastDay)],
    [22, lastDay],
  ].filter(([start, end]) => start <= end);

  return ranges.map(([startDay, endDay], index) => {
    const dates = [];
    for (let day = startDay; day <= endDay; day += 1) {
      dates.push(toDateKey(new Date(safeYear, safeMonth - 1, day)));
    }
    return {
      key: `week-${index + 1}`,
      index: index + 1,
      label: `Semana ${index + 1}`,
      start: dates[0],
      end: dates[dates.length - 1],
      dates,
    };
  });
};

const canEditStatus = (status) =>
  ["draft", "rejected", "approved", "pending_approval"].includes(String(status || "").toLowerCase());
const canSubmitStatus = (status) => status === "draft" || status === "rejected";
const canDeleteStatus = (status) => status === "draft" || status === "rejected";
const canPlanByCityStatus = (status) => ["draft", "rejected"].includes(String(status || "").toLowerCase());
const canMoveBetweenWeeksStatus = (status) => ["approved", "pending_approval"].includes(String(status || "").toLowerCase());

const remapVisitDateToWeekBlock = (plannedDate, weekBlocks = [], targetBlock = null) => {
  const safeDate = String(plannedDate || "").slice(0, 10);
  if (!safeDate || !targetBlock?.dates?.length) return safeDate;
  const sourceBlock = weekBlocks.find((block) => block.dates.includes(safeDate));
  if (!sourceBlock) return targetBlock.dates[0];
  if (sourceBlock.key === targetBlock.key) return safeDate;

  const sourceIndex = Math.max(0, sourceBlock.dates.indexOf(safeDate));
  const targetIndex = Math.min(sourceIndex, targetBlock.dates.length - 1);
  return targetBlock.dates[targetIndex] || targetBlock.dates[0];
};

const buildWeekSwapPlan = ({
  sourceBlock,
  targetBlock,
  weekBlocks = [],
  visits = [],
}) => {
  if (!sourceBlock?.key || !targetBlock?.key || sourceBlock.key === targetBlock.key) return [];

  const sourceVisits = visits.filter((visit) =>
    sourceBlock.dates.includes(String(visit?.planned_date || "").slice(0, 10)),
  );
  const targetVisits = visits.filter((visit) =>
    targetBlock.dates.includes(String(visit?.planned_date || "").slice(0, 10)),
  );

  return [
    ...sourceVisits.map((visit) => ({
      visit,
      nextPlannedDate: remapVisitDateToWeekBlock(visit.planned_date, weekBlocks, targetBlock),
    })),
    ...targetVisits.map((visit) => ({
      visit,
      nextPlannedDate: remapVisitDateToWeekBlock(visit.planned_date, weekBlocks, sourceBlock),
    })),
  ].filter(
    ({ visit, nextPlannedDate }) =>
      nextPlannedDate && nextPlannedDate !== String(visit?.planned_date || "").slice(0, 10),
  );
};

const toFinite = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const haversineKm = (a, b) => {
  if (!a || !b) return 0;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const fmtDist = (m = 0) => {
  const v = Number(m || 0);
  if (!Number.isFinite(v) || v <= 0) return "0 km";
  return v >= 1000 ? `${(v / 1000).toFixed(1)} km` : `${Math.round(v)} m`;
};
const fmtTime = (s = 0) => {
  const v = Number(s || 0);
  if (!Number.isFinite(v) || v <= 0) return "0 min";
  const m = Math.round(v / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
};

// ── Shared UI atoms ────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20 disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#6B7280]";
const labelCls = "block mb-1 text-[12px] font-medium text-[#1F2937] tracking-[0.01em]";

const Field = ({ label, children, required }) => (
  <div>
    <label className={labelCls}>
      {label}
      {required && <span className="ml-0.5 text-[#DC2626]">*</span>}
    </label>
    {children}
  </div>
);

const EmptyPanel = ({ icon: Icon, title, subtitle, action }) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
    <Icon size={36} className="text-[#D1D5DB]" />
    <div>
      <p className="text-sm font-medium text-[#1F2937]">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs text-[#6B7280]">{subtitle}</p>}
    </div>
    {action}
  </div>
);

// ── Modal: Crear cronograma ────────────────────────────────────────────────────

const CreateScheduleModal = ({ open, onClose, onSubmit, busy, schedules = [] }) => {
  const [month, setMonth]   = useState(String(DEFAULT_MONTH));
  const [year, setYear]     = useState(String(DEFAULT_YEAR));
  const [notes, setNotes]   = useState("");

  const existingMonths = useMemo(
    () => new Set(schedules.map((s) => `${s.month}-${s.year}`)),
    [schedules],
  );

  const yearOptions = useMemo(() => {
    const years = [DEFAULT_YEAR - 1, DEFAULT_YEAR, DEFAULT_YEAR + 1];
    return years;
  }, []);

  const conflict = existingMonths.has(`${month}-${year}`);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (conflict) return;
    await onSubmit({ month: Number(month), year: Number(year), notes: notes.trim() || null });
    setNotes("");
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo cronograma" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Mes" required>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={inputCls}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1)}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Año" required>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={inputCls}
            >
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </Field>
        </div>

        {conflict && (
          <div className="flex items-center gap-2 rounded-xl bg-[#FEF3C7] px-3 py-2 text-xs text-[#D97706]">
            <FiAlertCircle size={13} />
            Ya existe un cronograma para {MONTHS[Number(month) - 1]} {year}.
          </div>
        )}

        <Field label="Notas iniciales">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Observaciones generales del mes (opcional)"
            className={inputCls}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={busy || conflict}>
            {busy ? <FiRefreshCw size={14} className="animate-spin" /> : <FiPlus size={14} />}
            Crear cronograma
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ── Modal: Agregar / editar visita ─────────────────────────────────────────────

const VisitFormModal = ({
  open,
  onClose,
  onSubmit,
  busy,
  clients = [],
  schedule,
  visit = null,
  weekContext = null,
}) => {
  const isEdit = Boolean(visit);
  const isProspectVisit = !isEdit || Boolean(visit?.prospect_name);

  const [clientId,    setClientId]    = useState(String(visit?.client_request_id || ""));
  const [prospectName, setProspectName] = useState(visit?.prospect_name || "");
  const [plannedDate, setPlannedDate] = useState(String(visit?.planned_date || "").slice(0, 10));
  const [priority,    setPriority]    = useState(String(visit?.priority || 1));
  const [city,        setCity]        = useState(visit?.city || weekContext?.city || "");
  const [notes,       setNotes]       = useState(visit?.notes || "");

  useEffect(() => {
    if (open) {
      setClientId(String(visit?.client_request_id || ""));
      setProspectName(visit?.prospect_name || "");
      setPlannedDate(String(visit?.planned_date || "").slice(0, 10));
      setPriority(String(visit?.priority || 1));
      setCity(visit?.city || weekContext?.city || "");
      setNotes(visit?.notes || "");
    }
  }, [open, visit, weekContext]);

  const minDate = schedule ? `${schedule.year}-${String(schedule.month).padStart(2, "0")}-01` : "";
  const maxDate = schedule
    ? (() => {
        const last = new Date(schedule.year, schedule.month, 0);
        return `${schedule.year}-${String(schedule.month).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
      })()
    : "";

  // No se filtra por ciudad: una semana puede tener varias ciudades, asi que el
  // cliente a agregar manualmente puede ser de cualquiera de ellas (o una nueva).
  const filteredClients = clients;

  const selectedClient = filteredClients.find((c) => String(c.id) === clientId)
    || clients.find((c) => String(c.id) === clientId);
  const allowedDates = Array.isArray(weekContext?.dates) ? weekContext.dates : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!isProspectVisit && !clientId) || (isProspectVisit && !prospectName.trim()) || !plannedDate) return;
    await onSubmit({
      client_request_id: isProspectVisit ? null : Number(clientId),
      prospect_name: isProspectVisit ? prospectName.trim() : null,
      planned_date: plannedDate,
      priority: Number(priority),
      city: city.trim() || selectedClient?.shipping_city || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar visita" : "Agregar visita manual"}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isProspectVisit ? (
          <Field label="Nombre del prospecto o cliente" required>
            <input
              value={prospectName}
              onChange={(e) => setProspectName(e.target.value)}
              placeholder="Ingresa el nombre del prospecto o cliente no registrado"
              className={inputCls}
              maxLength={180}
            />
          </Field>
        ) : (
          <Field label="Cliente" required>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                const c = filteredClients.find((cl) => String(cl.id) === e.target.value)
                  || clients.find((cl) => String(cl.id) === e.target.value);
                if (c && !city) setCity(c.shipping_city || "");
              }}
              className={inputCls}
              disabled={isEdit}
            >
              <option value="">Selecciona un cliente</option>
              {filteredClients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.commercial_name || c.nombre || `Cliente #${c.id}`}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Fecha planificada" required>
            {allowedDates.length ? (
              <select
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className={inputCls}
              >
                <option value="">Selecciona un dia</option>
                {allowedDates.map((dateValue) => (
                  <option key={dateValue} value={dateValue}>
                    {formatFullDate(dateValue)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="date"
                value={plannedDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className={inputCls}
              />
            )}
          </Field>
          <Field label="Prioridad">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
              <option value="1">Baja</option>
              <option value="2">Media</option>
              <option value="3">Alta</option>
            </select>
          </Field>
        </div>

        <Field label="Ciudad">
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={selectedClient?.shipping_city || "Ciudad de la visita"}
            className={inputCls}
          />
        </Field>

        {weekContext?.label && (
          <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-2 text-xs text-[#1D4ED8]">
            {weekContext.label}
            {weekContext.city ? ` · ${weekContext.city}` : ""}
          </div>
        )}

        <Field label="Notas">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Observaciones de la visita (opcional)"
            className={inputCls}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || (isProspectVisit ? !prospectName.trim() : !clientId) || !plannedDate}
          >
            {busy ? <FiRefreshCw size={14} className="animate-spin" /> : null}
            {isEdit ? "Guardar cambios" : "Agregar visita manual"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ── Modal: Justificar visita ───────────────────────────────────────────────────

const JustifyVisitModal = ({ open, onClose, onSubmit, busy, visit }) => {
  const [text, setText] = useState(visit?.justification || "");
  useEffect(() => { if (open) setText(visit?.justification || ""); }, [open, visit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await onSubmit(text.trim());
  };

  return (
    <Modal open={open} onClose={onClose} title="Justificar visita" maxWidth="max-w-md">
      {visit && (
        <p className="mb-3 text-xs text-[#6B7280]">
          {getVisitDisplayName(visit)}
          {visit.planned_date ? ` — ${formatFullDate(visit.planned_date)}` : ""}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Justificacion" required>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Explica el motivo de la desviacion respecto al plan"
            className={inputCls}
            autoFocus
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={busy || !text.trim()}>
            {busy ? <FiRefreshCw size={14} className="animate-spin" /> : null}
            Guardar justificacion
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ── Modal: Justificar cronograma ───────────────────────────────────────────────

const JustifyScheduleModal = ({ open, onClose, onSubmit, busy, schedule }) => {
  const [text, setText] = useState(schedule?.general_justification || "");
  useEffect(() => { if (open) setText(schedule?.general_justification || ""); }, [open, schedule]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await onSubmit(text.trim());
  };

  return (
    <Modal open={open} onClose={onClose} title="Justificacion general" maxWidth="max-w-md">
      <p className="mb-3 text-xs text-[#6B7280]">
        Justifica desviaciones generales del cronograma completo del mes.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Justificacion" required>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Describe las razones de las desviaciones del mes"
            className={inputCls}
            autoFocus
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={busy || !text.trim()}>
            {busy ? <FiRefreshCw size={14} className="animate-spin" /> : null}
            Guardar justificacion
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ── Modal: Confirmar eliminacion ───────────────────────────────────────────────

const DeleteConfirmModal = ({ open, onClose, onConfirm, busy, title, description }) => (
  <Modal open={open} onClose={onClose} title={title || "Eliminar"} maxWidth="max-w-sm">
    <p className="mb-5 text-sm text-[#6B7280]">
      {description || "Esta accion no se puede deshacer."}
    </p>
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
      <Button type="button" variant="danger" onClick={onConfirm} disabled={busy}>
        {busy ? <FiRefreshCw size={14} className="animate-spin" /> : null}
        Eliminar
      </Button>
    </div>
  </Modal>
);

// ── Componente: Sidebar item de cronograma ─────────────────────────────────────

const ScheduleSidebarItem = ({ schedule, selected, onClick }) => {
  const visitCount = Number(schedule.visits_count || 0);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full cursor-pointer rounded-xl border px-3 py-3 text-left transition-all active:scale-[0.98] ${
        selected
          ? "border-[#2563EB]/20 bg-[#EFF6FF] shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
          : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[#1F2937]">
          {monthLabel(schedule.month, schedule.year)}
        </span>
        <ScheduleStatusBadge status={schedule.status} size="xs" />
      </div>
      <p className="mt-1 text-[11px] text-[#6B7280]">
        {visitCount === 0 ? "Sin visitas" : `${visitCount} visita${visitCount !== 1 ? "s" : ""}`}
      </p>
    </button>
  );
};

// ── Tab: Visitas ───────────────────────────────────────────────────────────────

const TabVisitas = ({
  schedule,
  clients,
  leads = [],
  canEdit,
  onAddVisit,
  onSyncWeekCity,
  onRemoveWeekCity,
  syncingWeekKey,
  onEditVisit,
  onMoveWeek,
  onDeleteVisit,
  onJustifyVisit,
}) => {
  const visits = useMemo(() => Array.isArray(schedule?.visits) ? schedule.visits : [], [schedule]);
  const weekBlocks = useMemo(
    () => buildFourWeekBlocks(schedule?.month, schedule?.year),
    [schedule?.month, schedule?.year],
  );
  const cityOptions = useMemo(() => uniqCities(clients, leads), [clients, leads]);
  // Ciudad elegida en el selector "agregar ciudad" de cada semana -- es solo el
  // valor pendiente de cargar, no "la" ciudad de la semana (una semana puede
  // tener varias ciudades ya cargadas, ver weekCities mas abajo).
  const [selectedCities, setSelectedCities] = useState({});
  const [draggingWeekKey, setDraggingWeekKey] = useState(null);
  const planningByCityEnabled = canPlanByCityStatus(schedule?.status);
  const moveBetweenWeeksEnabled = canMoveBetweenWeeksStatus(schedule?.status);

  const summary = useMemo(() => {
    const plannedCities = new Set(visits.map((visit) => normalizeCityKey(visit?.city)).filter(Boolean));
    return {
      totalVisits: visits.length,
      totalCities: plannedCities.size,
      availableCities: cityOptions.length,
    };
  }, [cityOptions.length, visits]);

  if (!weekBlocks.length) {
    return (
      <EmptyPanel
        icon={FiCalendar}
        title="No se pudo preparar el cronograma"
        subtitle="Verifica el mes y el anio del expediente."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Visitas planificadas</p>
          <p className="mt-1 text-2xl font-semibold text-[#1F2937]">{summary.totalVisits}</p>
        </div>
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Ciudades en el plan</p>
          <p className="mt-1 text-2xl font-semibold text-[#1F2937]">{summary.totalCities}</p>
        </div>
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Ciudades asignadas</p>
          <p className="mt-1 text-2xl font-semibold text-[#1F2937]">{summary.availableCities}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {weekBlocks.map((block) => {
          const weekVisits = visits
            .filter((visit) => block.dates.includes(String(visit?.planned_date || "").slice(0, 10)))
            .sort((a, b) => {
              const aDate = String(a?.planned_date || "");
              const bDate = String(b?.planned_date || "");
              if (aDate !== bDate) return aDate.localeCompare(bDate);
              return Number(b?.priority || 1) - Number(a?.priority || 1);
            });

          const selectedCity = selectedCities[block.key] || "";
          const selectedCityLabel = cityOptions.find((option) => option.key === selectedCity)?.label || "";
          // Una semana puede tener varias ciudades cargadas a la vez.
          const weekCityEntries = [...new Map(
            weekVisits
              .filter((visit) => visit?.city)
              .map((visit) => [normalizeCityKey(visit.city), formatCityLabel(visit.city)]),
          ).entries()].map(([key, label]) => ({
            key,
            label,
            visits: weekVisits.filter((visit) => normalizeCityKey(visit?.city) === key),
          }));
          const weekCityLabels = weekCityEntries.map((entry) => entry.label);
          const clientsInCity = selectedCity
            ? clients.filter((client) =>
                sameCity(client?.shipping_city || client?.shipping_province || "", selectedCity),
              )
            : [];
          const leadsInCity = selectedCity
            ? leads.filter((lead) => sameCity(lead?.city || "", selectedCity))
            : [];

          return (
            <div
              key={block.key}
              className={`overflow-hidden rounded-2xl border bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition-colors ${
                draggingWeekKey === block.key
                  ? "border-[#2563EB]"
                  : "border-[#E5E7EB]"
              }`}
              onDragOver={(event) => {
                if (!moveBetweenWeeksEnabled || !draggingWeekKey) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                if (!moveBetweenWeeksEnabled || !draggingWeekKey) return;
                event.preventDefault();
                const sourceBlock = weekBlocks.find((item) => item.key === draggingWeekKey);
                setDraggingWeekKey(null);
                if (!sourceBlock || !onMoveWeek || sourceBlock.key === block.key) return;
                onMoveWeek(sourceBlock, block, weekBlocks, visits);
              }}
            >
              <div className="border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-[#1F2937]">{block.label}</p>
                    <p className="text-xs text-[#6B7280]">
                      {formatDate(block.start)} al {formatDate(block.end)}
                    </p>
                  </div>
                  <span className="inline-flex rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px] font-medium text-[#6B7280]">
                    {weekVisits.length} visita{weekVisits.length === 1 ? "" : "s"}
                  </span>
                </div>

                {weekCityLabels.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-[#C7F9CC] bg-[linear-gradient(135deg,#F4FFF4_0%,#ECFDF3_55%,#E0F2FE_100%)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14532D] text-white shadow-[0_6px_14px_rgba(20,83,45,0.18)]">
                        <FiMapPin size={14} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#166534]">
                          {weekCityLabels.length === 1 ? "Ciudad asignada" : "Ciudades asignadas"}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {weekCityEntries.map((entry) => (
                            <span
                              key={entry.key}
                              className="inline-flex items-center gap-1.5 rounded-full bg-white/70 py-0.5 pl-2.5 pr-1.5 text-sm font-semibold text-[#14532D]"
                            >
                              {entry.label}
                              {canEdit && planningByCityEnabled && onRemoveWeekCity && (
                                <button
                                  type="button"
                                  onClick={() => onRemoveWeekCity(block, entry.label, entry.visits)}
                                  title={`Quitar ${entry.label} de esta semana`}
                                  className="rounded-full p-0.5 text-[#166534] hover:bg-[#166534]/10 hover:text-[#0F3D1E]"
                                >
                                  <FiX size={12} />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {moveBetweenWeeksEnabled && canEdit && weekVisits.length > 0 && (
                  <div className="mt-3">
                    <div
                      draggable
                      onDragStart={() => setDraggingWeekKey(block.key)}
                      onDragEnd={() => setDraggingWeekKey(null)}
                      className="inline-flex cursor-grab items-center rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[11px] font-medium text-[#1D4ED8] active:cursor-grabbing"
                    >
                      Mover semana completa
                    </div>
                  </div>
                )}

                {canEdit && planningByCityEnabled && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div>
                      <label className={labelCls}>Ciudad de destino</label>
                      <select
                        value={selectedCity}
                        onChange={(event) => {
                          const nextCity = event.target.value;
                          setSelectedCities((current) => ({
                            ...current,
                            [block.key]: nextCity,
                          }));
                          if (!nextCity || !onSyncWeekCity) return;
                          onSyncWeekCity(block, cityOptions.find((option) => option.key === nextCity)?.label || nextCity);
                        }}
                        className={inputCls}
                      >
                        <option value="">
                          {weekCityLabels.length ? "Agregar otra ciudad" : "Selecciona una ciudad"}
                        </option>
                        {cityOptions.map((cityOption) => (
                          <option key={cityOption.key} value={cityOption.key}>
                            {cityOption.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end">
                      <Button
                        variant="secondary"
                        disabled={!selectedCity}
                        onClick={() =>
                          onAddVisit({
                            city: selectedCityLabel,
                            label: `${block.label} · ${formatDate(block.start)} al ${formatDate(block.end)}`,
                            start: block.start,
                            end: block.end,
                            dates: block.dates,
                          })
                        }
                      >
                        <FiPlus size={14} /> Agregar visita manual
                      </Button>
                    </div>
                  </div>
                )}

                {selectedCity && planningByCityEnabled && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
                    <span>
                      {clientsInCity.length} cliente{clientsInCity.length === 1 ? "" : "s"} y {leadsInCity.length} lead{leadsInCity.length === 1 ? "" : "s"} asignados en {selectedCityLabel}
                    </span>
                    {syncingWeekKey === block.key && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[#1D4ED8]">
                        <FiRefreshCw size={11} className="animate-spin" />
                        Sincronizando semana
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4">
                {!selectedCity && weekCityLabels.length === 0 && canEdit && planningByCityEnabled && (
                  <div className="mb-3 rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-3 py-3 text-sm text-[#6B7280]">
                    Selecciona una ciudad para cargar los clientes y leads asignados de esta semana. Puedes agregar mas de una ciudad por semana.
                  </div>
                )}
                {moveBetweenWeeksEnabled && canEdit && (
                  <div className="mb-3 rounded-xl border border-dashed border-[#BFDBFE] bg-[#EFF6FF] px-3 py-3 text-sm text-[#1D4ED8]">
                    Mueve la semana completa arrastrando el bloque para intercambiar todos los clientes de esa ciudad con otra semana.
                  </div>
                )}

                {!weekVisits.length ? (
                  <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-3 py-6 text-center text-sm text-[#6B7280]">
                    No hay visitas registradas en {block.label.toLowerCase()}.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {weekVisits.map((visit) => (
                      <VisitCard
                        key={visit.id}
                        visit={visit}
                        canEdit={canEdit}
                        onEdit={() => onEditVisit(visit)}
                        onDelete={() => onDeleteVisit(visit)}
                        onJustify={() => onJustifyVisit(visit)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const VisitCard = ({ visit, canEdit, onEdit, onDelete, onJustify }) => {
  const visitStatus = visit.visit_status;
  const hasLog = Boolean(visitStatus);

  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
    >
      {/* Priority dot */}
      <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
        Number(visit.priority) === 3 ? "bg-[#DC2626]" :
        Number(visit.priority) === 2 ? "bg-[#D97706]" : "bg-[#D1D5DB]"
      }`} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-[#1F2937]">
            {getVisitDisplayName(visit)}
          </span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_CLS[visit.priority || 1]}`}>
            {PRIORITY_LABELS[visit.priority || 1]}
          </span>
          {hasLog && (
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${VISIT_STATUS_CLS[visitStatus] || VISIT_STATUS_CLS.pending}`}>
              {VISIT_STATUS_LABELS[visitStatus] || visitStatus}
            </span>
          )}
        </div>

        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-[#6B7280]">
          {visit.city && (
            <span className="flex items-center gap-1">
              <FiMapPin size={10} />
              {formatCityLabel(visit.city)}
            </span>
          )}
          {visit.hora_entrada && visit.hora_salida && (
            <span>{visit.hora_entrada} — {visit.hora_salida}</span>
          )}
          {visit.duracion_minutos && (
            <span>{visit.duracion_minutos} min</span>
          )}
        </div>

        {visit.notes && (
          <p className="mt-1 text-[11px] text-[#6B7280]">{visit.notes}</p>
        )}
        {visit.justification && (
          <p className="mt-1 rounded-lg bg-[#FEF3C7] px-2 py-1 text-[11px] text-[#D97706]">
            Justificacion: {visit.justification}
          </p>
        )}
      </div>

      {canEdit && (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onJustify}
            title="Justificar visita"
            className="rounded-lg p-1.5 text-[#6B7280] transition-colors hover:bg-[#FEF3C7] hover:text-[#D97706]"
          >
            <FiAlertCircle size={13} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            title="Editar visita"
            className="rounded-lg p-1.5 text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#1F2937]"
          >
            <FiEdit2 size={13} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Eliminar visita"
            className="rounded-lg p-1.5 text-[#6B7280] transition-colors hover:bg-[#FEE2E2] hover:text-[#DC2626]"
          >
            <FiTrash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
};

// ── Tab: Ejecución ─────────────────────────────────────────────────────────────

const TabEjecucion = ({ schedule }) => {
  const visits               = useMemo(() => Array.isArray(schedule?.visits) ? schedule.visits : [], [schedule]);
  const unexpectedVisits     = useMemo(() => Array.isArray(schedule?.unexpected_visits) ? schedule.unexpected_visits : [], [schedule]);
  const unexpectedClients    = useMemo(() => Array.isArray(schedule?.unexpected_client_visits) ? schedule.unexpected_client_visits : [], [schedule]);

  const visited  = visits.filter((v) => v.visit_status === "visited").length;
  const skipped  = visits.filter((v) => v.visit_status === "skipped").length;
  const pending  = visits.filter((v) => !v.visit_status || v.visit_status === "pending").length;
  const total    = visits.length;

  const statsItems = [
    { label: "Visitadas", value: visited, cls: "text-[#16A34A]" },
    { label: "Omitidas", value: skipped, cls: "text-[#DC2626]" },
    { label: "Pendientes", value: pending, cls: "text-[#6B7280]" },
    { label: "No planificadas", value: unexpectedVisits.length + unexpectedClients.length, cls: "text-[#D97706]" },
  ];

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-5">
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {statsItems.map((s) => (
          <div key={s.label} className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
            <p className="text-[11px] text-[#6B7280]">{s.label}</p>
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            {total > 0 && s.label !== "No planificadas" && (
              <p className="text-[10px] text-[#9CA3AF]">{Math.round((s.value / total) * 100)}% del total</p>
            )}
          </div>
        ))}
      </div>

      {/* Visits with logs */}
      {visits.filter((v) => v.visit_status).length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Visitas ejecutadas</p>
          <div className="flex flex-col gap-2">
            {visits
              .filter((v) => v.visit_status)
              .sort((a, b) => String(a.planned_date).localeCompare(String(b.planned_date)))
              .map((v) => (
                <div key={v.id} className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${VISIT_STATUS_CLS[v.visit_status] || VISIT_STATUS_CLS.pending}`}>
                    {VISIT_STATUS_LABELS[v.visit_status] || v.visit_status}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1F2937]">{getVisitDisplayName(v)}</p>
                    <p className="text-[11px] text-[#6B7280]">
                      {formatDate(v.planned_date)}
                      {v.hora_entrada && v.hora_salida ? ` — ${v.hora_entrada} a ${v.hora_salida}` : ""}
                      {v.duracion_minutos ? ` (${v.duracion_minutos} min)` : ""}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Unexpected client visits */}
      {unexpectedClients.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#D97706]">
            Visitas a clientes no planificadas
          </p>
          <div className="flex flex-col gap-2">
            {unexpectedClients.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-xl border border-[#FEF3C7] bg-[#FFFBEB] p-3">
                <FiAlertCircle size={14} className="shrink-0 text-[#D97706]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#1F2937]">{getVisitDisplayName(v)}</p>
                  <p className="text-[11px] text-[#6B7280]">
                    {formatDate(v.visit_date)}
                    {v.hora_entrada && v.hora_salida ? ` — ${v.hora_entrada} a ${v.hora_salida}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unexpected prospect visits */}
      {unexpectedVisits.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#D97706]">
            Visitas a prospectos no planificadas
          </p>
          <div className="flex flex-col gap-2">
            {unexpectedVisits.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-xl border border-[#FEF3C7] bg-[#FFFBEB] p-3">
                <FiAlertCircle size={14} className="shrink-0 text-[#D97706]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#1F2937]">{v.prospect_name || "Prospecto"}</p>
                  <p className="text-[11px] text-[#6B7280]">
                    {formatDate(v.visit_date)}
                    {v.check_in_time && v.check_out_time ? ` — ${v.check_in_time} a ${v.check_out_time}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!visits.some((v) => v.visit_status) && !unexpectedClients.length && !unexpectedVisits.length && (
        <EmptyPanel
          icon={FiCheck}
          title="Sin datos de ejecucion aun"
          subtitle="Los registros de visitas aparecen aqui una vez que el asesor comience las visitas del mes."
        />
      )}
    </div>
  );
};

// ── Tab: Ruta ──────────────────────────────────────────────────────────────────

const TabRuta = ({ schedule }) => {
  const { isLoaded: mapsLoaded, loadError } = useGoogleMaps();
  const [map, setMap]               = useState(null);
  const [routeData, setRouteData]   = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const advancedMarkersRef          = useRef([]);

  const visits = useMemo(() => Array.isArray(schedule?.visits) ? schedule.visits : [], [schedule]);

  const handleOptimize = useCallback(async () => {
    if (!schedule?.id) return;
    setOptimizing(true);
    setRouteError(null);
    try {
      const result = await optimizeRoute({ schedule_ids: [schedule.id] });
      setRouteData(result);
    } catch (err) {
      setRouteError(err.message || "No se pudo optimizar la ruta");
    } finally {
      setOptimizing(false);
    }
  }, [schedule?.id]);

  const markers = useMemo(() => {
    if (!routeData?.routes_by_date?.length) return [];
    return routeData.routes_by_date
      .flatMap((d) => d.ordered_visits || [])
      .filter((v) => toFinite(v.latitude) !== null && toFinite(v.longitude) !== null)
      .map((v) => ({ lat: toFinite(v.latitude), lng: toFinite(v.longitude), label: v.route_order, name: getVisitDisplayName(v) }));
  }, [routeData]);

  const polylinePath = useMemo(() => markers.map((m) => ({ lat: m.lat, lng: m.lng })), [markers]);
  const mapCenter    = polylinePath[0] || DEFAULT_MAP_CENTER;

  const totalDist = routeData
    ? fmtDist(routeData.total_distance_meters)
    : (() => {
        let total = 0;
        for (let i = 0; i < markers.length - 1; i += 1) {
          total += haversineKm(markers[i], markers[i + 1]);
        }
        return total > 0 ? `${total.toFixed(1)} km` : null;
      })();
  const totalTime = routeData ? fmtTime(routeData.total_travel_time_seconds) : null;

  useEffect(() => {
    if (!map || !mapsLoaded || !window.google?.maps?.marker?.AdvancedMarkerElement) return;
    advancedMarkersRef.current.forEach((item) => { try { item.marker.map = null; } catch {} });
    advancedMarkersRef.current = [];

    markers.forEach((point) => {
      const badge = document.createElement("div");
      Object.assign(badge.style, {
        minWidth: "22px", height: "22px", padding: "0 6px",
        borderRadius: "9999px", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#0F172A", color: "#ffffff",
        fontSize: "11px", fontWeight: "700", border: "2px solid #ffffff",
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
      });
      badge.textContent = String(point.label || "");

      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map, position: { lat: point.lat, lng: point.lng },
        title: `${point.label}. ${point.name}`, content: badge,
      });
      advancedMarkersRef.current.push({ marker });
    });

    return () => {
      advancedMarkersRef.current.forEach((item) => { try { item.marker.map = null; } catch {} });
      advancedMarkersRef.current = [];
    };
  }, [map, mapsLoaded, markers]);

  const firstRoute = routeData?.routes_by_date?.[0];

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-5">
      {/* Action row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#6B7280]">
          {visits.length === 0
            ? "Agrega visitas al cronograma para optimizar la ruta."
            : `${visits.length} visita${visits.length !== 1 ? "s" : ""} en el cronograma.`}
        </p>
        <Button className="w-full sm:w-auto" variant="secondary" onClick={handleOptimize} disabled={optimizing || visits.length < 2}>
          {optimizing ? <FiRefreshCw size={14} className="animate-spin" /> : <FiNavigation size={14} />}
          Optimizar ruta
        </Button>
      </div>

      {routeError && (
        <div className="flex items-center gap-2 rounded-xl bg-[#FEE2E2] px-3 py-2 text-xs text-[#DC2626]">
          <FiAlertCircle size={13} /> {routeError}
        </div>
      )}

      {/* Stats */}
      {(totalDist || totalTime) && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {totalDist && (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-3">
              <p className="text-[11px] text-[#6B7280]">Distancia total</p>
              <p className="text-lg font-bold text-[#1F2937]">{totalDist}</p>
            </div>
          )}
          {totalTime && (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-3">
              <p className="text-[11px] text-[#6B7280]">Tiempo estimado</p>
              <p className="text-lg font-bold text-[#1F2937]">{totalTime}</p>
            </div>
          )}
        </div>
      )}

      {/* Map */}
      {!GOOGLE_MAPS_API_KEY ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-[#FEF3C7] bg-[#FFFBEB] text-xs text-[#D97706]">
          Configura REACT_APP_GOOGLE_MAPS_API_KEY para visualizar el mapa.
        </div>
      ) : loadError ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] text-xs text-[#DC2626]">
          No se pudo cargar Google Maps.
        </div>
      ) : !mapsLoaded ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
          Cargando mapa...
        </div>
      ) : (
        <ScheduleMapErrorBoundary>
          <div className="h-64 overflow-hidden rounded-xl border border-[#E5E7EB]">
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={mapCenter}
              zoom={polylinePath.length > 1 ? 9 : 6}
              onLoad={setMap}
              onUnmount={() => {
                advancedMarkersRef.current.forEach((item) => { try { item.marker.map = null; } catch {} });
                advancedMarkersRef.current = [];
                setMap(null);
              }}
              mapId={GOOGLE_MAPS_MAP_ID}
              options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false }}
            >
              {polylinePath.length >= 2 && (
                <PolylineF
                  path={polylinePath}
                  options={{ geodesic: true, strokeColor: "#0F172A", strokeOpacity: 0.8, strokeWeight: 3 }}
                />
              )}
            </GoogleMap>
          </div>
        </ScheduleMapErrorBoundary>
      )}

      {/* External links */}
      {firstRoute?.google_maps_url && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={firstRoute.google_maps_url}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium text-[#1F2937] transition-colors hover:bg-[#F9FAFB]"
          >
            <FiMapPin size={12} /> Abrir en Google Maps
          </a>
          {firstRoute?.waze_url && (
            <a
              href={firstRoute.waze_url}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium text-[#1F2937] transition-colors hover:bg-[#F9FAFB]"
            >
              <FiNavigation size={12} /> Abrir en Waze
            </a>
          )}
        </div>
      )}

      {/* Route segments */}
      {routeData?.routes_by_date?.map((routeDay) => (
        <div key={routeDay.planned_date}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
            {formatFullDate(routeDay.planned_date)}
          </p>
          {routeDay.ordered_visits?.map((v, i) => (
            <div key={v.visit_id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0F172A] text-[10px] font-bold text-white">
                {v.route_order}
              </span>
              <span className="text-[#1F2937]">{getVisitDisplayName(v)}</span>
              {routeDay.segments?.[i] && (
                <span className="ml-auto text-[11px] text-[#6B7280]">
                  {routeDay.segments[i].estimated_distance_label}
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

// ── Panel de detalle del expediente ────────────────────────────────────────────

const TABS = [
  { key: "visitas",   label: "Visitas" },
  { key: "ejecucion", label: "Ejecucion" },
  { key: "ruta",      label: "Ruta" },
];

const ScheduleDetail = ({
  schedule,
  clients,
  leads = [],
  canEdit,
  onSubmit,
  onDelete,
  onAddVisit,
  onSyncWeekCity,
  onRemoveWeekCity,
  syncingWeekKey,
  onEditVisit,
  onMoveWeek,
  onDeleteVisit,
  onJustifyVisit,
  onJustifySchedule,
}) => {
  const [activeTab, setActiveTab] = useState("visitas");

  const handleExportIcs = () => {
    const base = process.env.REACT_APP_API_URL || "";
    const url  = `${base}/api/v1/schedules/my-calendar.ics`;
    window.open(url, "_blank");
  };

  const isApproved = schedule.status === "approved";
  const isRejected = schedule.status === "rejected";
  const isDraft    = schedule.status === "draft";

  const visitsCount = Array.isArray(schedule.visits) ? schedule.visits.length : 0;

  const summaryItems = [
    { label: "Estado", value: <ScheduleStatusBadge status={schedule.status} /> },
    { label: "Visitas", value: visitsCount },
    schedule.submitted_at && {
      label: "Enviado",
      value: new Date(schedule.submitted_at).toLocaleDateString("es-EC", { day: "numeric", month: "short" }),
    },
    schedule.reviewed_by_email && {
      label: "Revisado por",
      value: schedule.reviewed_by_email,
    },
  ].filter(Boolean);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] bg-white px-4 py-4 lg:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[#1F2937] tracking-tight">
              {monthLabel(schedule.month, schedule.year)}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-4">
              {summaryItems.map((item) => (
                <div key={item.label} className="flex min-w-0 items-center gap-1.5">
                  <span className="text-[11px] text-[#6B7280]">{item.label}:</span>
                  <span className="min-w-0 break-all text-[11px] font-medium text-[#1F2937]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
            {canEdit && isApproved && (
              <button
                type="button"
                onClick={handleExportIcs}
                title="Exportar a calendario"
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium text-[#1F2937] transition-colors hover:bg-[#F9FAFB]"
              >
                <FiDownload size={13} /> Exportar .ics
              </button>
            )}
            {canEdit && (isDraft || isRejected) && (
              <button
                type="button"
                onClick={onJustifySchedule}
                title="Justificacion general"
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium text-[#1F2937] transition-colors hover:bg-[#F9FAFB]"
              >
                <FiEdit2 size={13} /> Justificar
              </button>
            )}
            {canEdit && canSubmitStatus(schedule.status) && (
              <button
                type="button"
                onClick={onSubmit}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] active:scale-[0.97]"
              >
                <FiSend size={13} /> Enviar para aprobacion
              </button>
            )}
            {canEdit && canDeleteStatus(schedule.status) && (
              <button
                type="button"
                onClick={onDelete}
                title="Eliminar cronograma"
                className="flex min-h-[44px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[#6B7280] transition-colors hover:bg-[#FEE2E2] hover:text-[#DC2626]"
              >
                <FiTrash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Rejection banner */}
        {isRejected && schedule.rejection_reason && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#FEE2E2] px-3 py-2.5">
            <FiAlertCircle size={14} className="mt-0.5 shrink-0 text-[#DC2626]" />
            <div>
              <p className="text-xs font-semibold text-[#DC2626]">Cronograma rechazado</p>
              <p className="text-xs text-[#DC2626]">{schedule.rejection_reason}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-4 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`min-h-[40px] whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-[#1E293B] text-white"
                    : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1F2937]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto bg-[#F9FAFB]">
        {activeTab === "visitas" && (
          <TabVisitas
            schedule={schedule}
            clients={clients}
            leads={leads}
            canEdit={canEdit && canEditStatus(schedule.status)}
            onAddVisit={onAddVisit}
            onSyncWeekCity={onSyncWeekCity}
            onRemoveWeekCity={onRemoveWeekCity}
            syncingWeekKey={syncingWeekKey}
            onEditVisit={onEditVisit}
            onMoveWeek={onMoveWeek}
            onDeleteVisit={onDeleteVisit}
            onJustifyVisit={onJustifyVisit}
          />
        )}
        {activeTab === "ejecucion" && <TabEjecucion schedule={schedule} />}
        {activeTab === "ruta" && <TabRuta schedule={schedule} />}
      </div>
    </div>
  );
};

// ── Workspace principal ────────────────────────────────────────────────────────

const ScheduleWorkspace = ({
  schedules = [],
  activeSchedule,
  loading,
  error,
  loadScheduleDetail,
  create,
  update,
  remove,
  submit,
  addVisit,
  syncWeekCity,
  updateVisit,
  removeVisit,
}) => {
  const { role } = useAuth();
  const { showToast } = useUI();
  const roleLower = (role || "").toLowerCase();
  const canEdit = ["comercial", "acp_comercial", "backoffice", "backoffice_comercial"].includes(roleLower);

  // Sidebar filter
  const [statusFilter,  setStatusFilter]  = useState("all");

  // Clients / leads list
  const [clients,        setClients]        = useState([]);
  const [leads,          setLeads]          = useState([]);

  // Modal states
  const [modalCreate, setModalCreate] = useState(false);
  const [modalVisit, setModalVisit] = useState(null); // null | { type: "add", weekContext } | { type: "edit", visit }
  const [modalJustifyVisit, setModalJustifyVisit] = useState(null); // null | visit-object
  const [modalJustifySched, setModalJustifySched] = useState(false);
  const [modalDelete, setModalDelete] = useState(false);
  const [modalDeleteVisit, setModalDeleteVisit] = useState(null); // null | visit-object

  // Busy states per action
  const [busy, setBusy] = useState("");
  const [syncingWeekKey, setSyncingWeekKey] = useState("");

  // Load clients + leads once
  useEffect(() => {
    let alive = true;
    fetchClients({ limit: 1500 })
      .then((p) => { if (alive) setClients(Array.isArray(p?.clients) ? p.clients : []); })
      .catch(() => { if (alive) setClients([]); });
    fetchLeads({ limit: 1500 })
      .then((res) => { if (alive) setLeads(Array.isArray(res?.data) ? res.data : []); })
      .catch(() => { if (alive) setLeads([]); });
    return () => { alive = false; };
  }, []);

  // Select schedule
  const handleSelect = useCallback((schedule) => {
    loadScheduleDetail(schedule.id);
  }, [loadScheduleDetail]);

  // Filtered sidebar list
  const filteredSchedules = useMemo(() => {
    const list = statusFilter === "all" ? schedules : schedules.filter((s) => s.status === statusFilter);
    return [...list].sort((a, b) => {
      if (a.year !== b.year) return Number(b.year) - Number(a.year);
      return Number(b.month) - Number(a.month);
    });
  }, [schedules, statusFilter]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCreate = useCallback(async (payload) => {
    setBusy("create");
    try {
      await create(payload);
      setModalCreate(false);
      showToast("Cronograma creado", "success");
    } catch (err) {
      showToast(err.message || "No se pudo crear el cronograma", "error");
    } finally {
      setBusy("");
    }
  }, [create, showToast]);

  const handleSubmit = useCallback(async () => {
    if (!activeSchedule) return;
    setBusy("submit");
    try {
      await submit(activeSchedule.id);
      showToast("Cronograma enviado para aprobacion", "success");
    } catch (err) {
      showToast(err.message || "No se pudo enviar el cronograma", "error");
    } finally {
      setBusy("");
    }
  }, [activeSchedule, submit, showToast]);

  const handleDelete = useCallback(async () => {
    if (!activeSchedule) return;
    setBusy("delete");
    try {
      await remove(activeSchedule.id);
      setModalDelete(false);
      showToast("Cronograma eliminado", "success");
    } catch (err) {
      showToast(err.message || "No se pudo eliminar el cronograma", "error");
    } finally {
      setBusy("");
    }
  }, [activeSchedule, remove, showToast]);

  const handleAddVisit = useCallback(async (payload) => {
    if (!activeSchedule) return;
    setBusy("visit");
    try {
      await addVisit(activeSchedule.id, payload);
      setModalVisit(null);
      showToast("Visita agregada", "success");
    } catch (err) {
      showToast(err.message || "No se pudo agregar la visita", "error");
    } finally {
      setBusy("");
    }
  }, [activeSchedule, addVisit, showToast]);

  const handleSyncWeekCity = useCallback(async (block, city) => {
    if (!activeSchedule?.id || !block?.key || !Array.isArray(block?.dates)) return;
    setSyncingWeekKey(block.key);
    try {
      const result = await syncWeekCity(activeSchedule.id, {
        city,
        dates: block.dates,
      });
      showToast(
        `${result?.inserted || 0} visita${Number(result?.inserted || 0) === 1 ? "" : "s"} cargada${Number(result?.inserted || 0) === 1 ? "" : "s"} para ${city}`,
        "success",
      );
    } catch (err) {
      showToast(err.message || "No se pudo cargar la ciudad en la semana", "error");
    } finally {
      setSyncingWeekKey("");
    }
  }, [activeSchedule?.id, showToast, syncWeekCity]);

  const handleRemoveWeekCity = useCallback(async (block, cityLabel, visitsToRemove) => {
    if (!activeSchedule?.id || !Array.isArray(visitsToRemove) || !visitsToRemove.length) return;
    if (!window.confirm(`Quitar ${cityLabel} de ${block.label}? Se eliminaran ${visitsToRemove.length} visita(s) de esa ciudad en la semana.`)) {
      return;
    }
    setSyncingWeekKey(block.key);
    try {
      // Se eliminan una por una (reutiliza el mismo endpoint que "Eliminar visita")
      // para no duplicar logica de borrado en el backend.
      for (const visit of visitsToRemove) {
        // eslint-disable-next-line no-await-in-loop
        await removeVisit(activeSchedule.id, visit.id);
      }
      showToast(`${cityLabel} eliminada de ${block.label}`, "success");
    } catch (err) {
      showToast(err.message || "No se pudo quitar la ciudad de la semana", "error");
    } finally {
      setSyncingWeekKey("");
    }
  }, [activeSchedule?.id, removeVisit, showToast]);

  const handleEditVisit = useCallback(async (payload) => {
    if (!activeSchedule || modalVisit?.type !== "edit" || !modalVisit?.visit?.id) return;
    setBusy("visit");
    try {
      await updateVisit(activeSchedule.id, modalVisit.visit.id, payload);
      setModalVisit(null);
      showToast("Visita actualizada", "success");
    } catch (err) {
      showToast(err.message || "No se pudo actualizar la visita", "error");
    } finally {
      setBusy("");
    }
  }, [activeSchedule, modalVisit, updateVisit, showToast]);

  const handleMoveWeek = useCallback(async (sourceBlock, targetBlock, weekBlocks, visits) => {
    if (!activeSchedule?.id || !sourceBlock?.key || !targetBlock?.key || sourceBlock.key === targetBlock.key) return;
    const movePlan = buildWeekSwapPlan({
      sourceBlock,
      targetBlock,
      weekBlocks,
      visits: Array.isArray(visits) ? visits : [],
    });
    if (!movePlan.length) return;

    setBusy("moveWeek");
    try {
      for (const { visit, nextPlannedDate } of movePlan) {
        await updateVisit(activeSchedule.id, visit.id, {
          client_request_id: visit.client_request_id || null,
          prospect_name: visit.prospect_name || null,
          planned_date: nextPlannedDate,
          priority: Number(visit.priority || 1),
          city: visit.city || null,
          notes: visit.notes || null,
          preserve_approved_status: true,
        });
      }
      showToast("Semana intercambiada correctamente", "success");
    } catch (err) {
      showToast(err.message || "No se pudo mover la semana", "error");
    } finally {
      setBusy("");
    }
  }, [activeSchedule?.id, showToast, updateVisit]);

  const handleDeleteVisit = useCallback(async () => {
    if (!activeSchedule || !modalDeleteVisit?.id) return;
    setBusy("deleteVisit");
    try {
      await removeVisit(activeSchedule.id, modalDeleteVisit.id);
      setModalDeleteVisit(null);
      showToast("Visita eliminada", "success");
    } catch (err) {
      showToast(err.message || "No se pudo eliminar la visita", "error");
    } finally {
      setBusy("");
    }
  }, [activeSchedule, modalDeleteVisit, removeVisit, showToast]);

  const handleJustifyVisit = useCallback(async (text) => {
    if (!modalJustifyVisit?.id) return;
    setBusy("justifyVisit");
    try {
      await justifyScheduledVisit(activeSchedule.id, modalJustifyVisit.id, text);
      await loadScheduleDetail(activeSchedule.id);
      setModalJustifyVisit(null);
      showToast("Justificacion guardada", "success");
    } catch (err) {
      showToast(err.message || "No se pudo guardar la justificacion", "error");
    } finally {
      setBusy("");
    }
  }, [activeSchedule, modalJustifyVisit, loadScheduleDetail, showToast]);

  const handleJustifySchedule = useCallback(async (text) => {
    if (!activeSchedule) return;
    setBusy("justifySchedule");
    try {
      await justifySchedule(activeSchedule.id, text);
      await loadScheduleDetail(activeSchedule.id);
      setModalJustifySched(false);
      showToast("Justificacion guardada", "success");
    } catch (err) {
      showToast(err.message || "No se pudo guardar la justificacion", "error");
    } finally {
      setBusy("");
    }
  }, [activeSchedule, loadScheduleDetail, showToast]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className={WORKSPACE_2COL_CLASS}>
        {/* ── Sidebar ── */}
        <aside className={`${WORKSPACE_SIDEBAR_CLASS} col-span-12 lg:col-span-3`}>
          {/* Sidebar header */}
          <div className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-sm font-semibold text-[#1E293B]">Mis cronogramas</h1>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setModalCreate(true)}
                  className="flex items-center gap-1 rounded-xl bg-[#2563EB] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] active:scale-[0.97]"
                >
                  <FiPlus size={12} /> Nuevo
                </button>
              )}
            </div>

            {/* Status filter */}
            <div className="mt-2 flex flex-wrap gap-1">
              {STATUS_FILTER_OPTS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setStatusFilter(opt.key)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    statusFilter === opt.key
                      ? "bg-[#1E293B] text-white"
                      : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule list */}
          <div className="p-3">
            {loading && !schedules.length && (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-[#F3F4F6]" />
                ))}
              </div>
            )}

            {!loading && !filteredSchedules.length && (
              <div className="py-8 text-center">
                <FiCalendar size={28} className="mx-auto mb-2 text-[#D1D5DB]" />
                <p className="text-xs text-[#6B7280]">
                  {statusFilter === "all"
                    ? "No tienes cronogramas aun."
                    : "Sin cronogramas con este estado."}
                </p>
              </div>
            )}

            {error && (
              <p className="mt-2 text-xs text-[#DC2626]">{error}</p>
            )}

            <div className="flex flex-col gap-2">
              {filteredSchedules.map((s) => (
                <ScheduleSidebarItem
                  key={s.id}
                  schedule={s}
                  selected={activeSchedule?.id === s.id}
                  onClick={() => handleSelect(s)}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* ── Main panel ── */}
        <main className={`${WORKSPACE_MAIN_CLASS} col-span-12 lg:col-span-9`}>
          {!activeSchedule ? (
            <EmptyPanel
              icon={FiCalendar}
              title="Selecciona un cronograma"
              subtitle="Elige un mes del panel izquierdo para ver el expediente."
              action={
                canEdit ? (
                  <Button variant="primary" onClick={() => setModalCreate(true)}>
                    <FiPlus size={14} /> Crear primer cronograma
                  </Button>
                ) : null
              }
            />
          ) : (
            <ScheduleDetail
              schedule={activeSchedule}
              clients={clients}
              leads={leads}
              canEdit={canEdit}
              onSubmit={handleSubmit}
              onDelete={() => setModalDelete(true)}
              onAddVisit={(weekContext) => setModalVisit({ type: "add", weekContext: weekContext || null })}
              onSyncWeekCity={handleSyncWeekCity}
              onRemoveWeekCity={handleRemoveWeekCity}
              syncingWeekKey={syncingWeekKey}
              onEditVisit={(visit) => setModalVisit({ type: "edit", visit })}
              onMoveWeek={handleMoveWeek}
              onDeleteVisit={(visit) => setModalDeleteVisit(visit)}
              onJustifyVisit={(visit) => setModalJustifyVisit(visit)}
              onJustifySchedule={() => setModalJustifySched(true)}
            />
          )}
        </main>
      </div>

      {/* ── Modals ── */}

      <CreateScheduleModal
        open={modalCreate}
        onClose={() => setModalCreate(false)}
        onSubmit={handleCreate}
        busy={busy === "create"}
        schedules={schedules}
      />

      <VisitFormModal
        open={Boolean(modalVisit)}
        onClose={() => setModalVisit(null)}
        onSubmit={modalVisit?.type === "edit" ? handleEditVisit : handleAddVisit}
        busy={busy === "visit"}
        clients={clients}
        schedule={activeSchedule}
        visit={modalVisit?.type === "edit" ? modalVisit.visit : null}
        weekContext={modalVisit?.type === "add" ? modalVisit.weekContext : null}
      />

      <JustifyVisitModal
        open={Boolean(modalJustifyVisit)}
        onClose={() => setModalJustifyVisit(null)}
        onSubmit={handleJustifyVisit}
        busy={busy === "justifyVisit"}
        visit={modalJustifyVisit}
      />

      <JustifyScheduleModal
        open={modalJustifySched}
        onClose={() => setModalJustifySched(false)}
        onSubmit={handleJustifySchedule}
        busy={busy === "justifySchedule"}
        schedule={activeSchedule}
      />

      <DeleteConfirmModal
        open={modalDelete}
        onClose={() => setModalDelete(false)}
        onConfirm={handleDelete}
        busy={busy === "delete"}
        title="Eliminar cronograma"
        description={
          activeSchedule
            ? `Eliminar el cronograma de ${monthLabel(activeSchedule.month, activeSchedule.year)}. Esta accion no se puede deshacer.`
            : "Esta accion no se puede deshacer."
        }
      />

      <DeleteConfirmModal
        open={Boolean(modalDeleteVisit)}
        onClose={() => setModalDeleteVisit(null)}
        onConfirm={handleDeleteVisit}
        busy={busy === "deleteVisit"}
        title="Eliminar visita"
        description={
          modalDeleteVisit
            ? `Eliminar la visita a ${getVisitDisplayName(modalDeleteVisit)}. Esta accion no se puede deshacer.`
            : "Esta accion no se puede deshacer."
        }
      />
    </>
  );
};

export default ScheduleWorkspace;
