import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiClock, FiCoffee, FiSun, FiMoon, FiTrendingUp, FiChevronDown, FiChevronUp, FiCheckCircle } from "react-icons/fi";
import confetti from "canvas-confetti";

import Button, { actionBtnClass, actionBtnNeutralClass } from "../components/Button";
import Modal from "../components/Modal";
import CameraCaptureField from "../components/CameraCaptureField";
import { useUI } from "../useUI";
import { getAttendanceErrorInfo } from "../attendanceErrorUtils";
import { isOperationalFlow, resolveAttendancePendingActions } from "../attendanceFlowUtils";

import {
  clockIn,
  clockOutLunch,
  clockInLunch,
  clockOut,
  marcarVisitaEntrada,
  marcarVisitaSalida,
  marcarSalidaOficina,
  marcarEntradaOficina,
  marcarAlmuerzoSalidaOperacional,
  marcarAlmuerzoEntradaOperacional,
  marcarLlegadaDestino,
  marcarCierreViaje,
  markOvertime,
  justifyLateArrival,
  requestEntryRegularization,
  registerException,
  startPermissionEntry,
  finishPermissionExit,
  updateExceptionStatus,
  getActiveException,
  getTodayAttendance,
  getAttendanceRange,
  syncAttendanceLocation,
} from "../../api/attendanceApi";
import { getMisSolicitudes } from "../../api/permisosApi";
import { useAutoUpdate } from "../../api/index";
import { fetchClients } from "../../api/clientsApi";
import { formatDateSafe, formatTimeSafe, toDate } from "../../../shared/utils/dateUtils";
import { useAuth } from "../../auth/useAuth";
import {
  getLocationForAction as getSharedLocation,
  startLocationPrewarm,
  stopLocationPrewarm,
} from "../../../shared/utils/attendanceLocationCache";

const RECENT_HISTORY_DAYS = 5;
const PUNCTUALITY_BASE_MINUTES = 9 * 60;
const PUNCTUALITY_TOLERANCE_MINUTES = 6;
const ENTRY_MARK_CUTOFF_MINUTES = 9 * 60 + 20; // 09:20 — after this, entry is blocked
const ATTENDANCE_LOCATION_FIELDS = Object.freeze({
  entry: "entry_location",
  lunch_start: "lunch_start_location",
  lunch_end: "lunch_end_location",
  exit: "exit_location",
});
const EXCEPTION_LOCATION_FIELDS = Object.freeze({
  start: "start_location",
  arrival: "arrival_location",
  departure: "departure_location",
  return: "return_location",
});

const APPROVED_PERMISSION_STATUSES = new Set(["approved", "aprobado", "partially_approved"]);
const FIELD_VISIT_TYPE_OPTIONS = Object.freeze([
  { value: "cronograma", label: "Cliente de cronograma", helper: "Visita planificada del dia" },
  { value: "prospecto", label: "Prospecto", helper: "Gestion comercial nueva" },
  { value: "emergencia", label: "Emergencia", helper: "Atencion urgente en cliente" },
]);
const OPERATIONAL_CATEGORY_OPTIONS = Object.freeze([
  { value: "cliente", label: "Visita a cliente", helper: "Cliente, prospecto o atencion tecnica" },
  { value: "reunion", label: "Reunion externa", helper: "Reunion de trabajo fuera de oficina" },
  { value: "banco", label: "Gestion bancaria", helper: "Depositos, tramites o diligencias" },
  { value: "ministerio", label: "Entidad publica", helper: "Ministerio u otra institucion" },
  { value: "proveedor", label: "Visita a proveedor", helper: "Compras, entregas o coordinacion" },
  { value: "gestion_oficina", label: "Gestion operativa", helper: "Diligencia administrativa externa" },
  { value: "otro", label: "Otra salida", helper: "Cualquier otra gestion laboral" },
]);
const COMMERCIAL_SCHEDULE_ROLES = new Set([
  "comercial",
  "asesor_comercial",
  "acp_comercial",
  "jefe_comercial",
  "backoffice",
  "backoffice_comercial",
]);
const TECHNICAL_SCHEDULE_ROLES = new Set([
  "tecnico",
  "ing_servicio",
  "esp_app",
  "servicio_tecnico",
  "jefe_tecnico",
  "jefe_servicio",
  "jefe_servicio_tecnico",
]);
const CONTROL_INPUT_CLASS =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200";
const CONTROL_INPUT_SUBTLE_CLASS =
  "h-11 w-full rounded-lg border border-blue-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 transition placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200";
const CONTROL_TEXTAREA_CLASS = `${CONTROL_INPUT_CLASS} resize-none`;
const ACTION_BTN_BASE_CLASS = actionBtnClass;
const ACTION_BTN_NEUTRAL_CLASS = actionBtnNeutralClass;
const ACTION_BTN_MODAL_PRIMARY_CLASS =
  "w-full sm:w-auto min-h-[44px] rounded-xl px-6 py-2 font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70";
const ACTION_BTN_MODAL_SECONDARY_CLASS =
  "w-full sm:w-auto min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-70";

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getClientDisplayLabel = (client) => {
  const name = String(client?.name || "").trim() || `Cliente ${client?.id || ""}`;
  const city = String(client?.city || "").trim();
  return [name, city].filter(Boolean).join(" · ");
};

const getPlannedVisitTypeMeta = ({ isCommercial, isTechnical }) => {
  if (isCommercial && isTechnical) {
    return {
      label: "Comercial y tecnica",
      badgeClass: "bg-[#DBEAFE] text-[#1D4ED8]",
    };
  }
  if (isTechnical) {
    return {
      label: "Tecnica",
      badgeClass: "bg-[#DCFCE7] text-[#166534]",
    };
  }
  return {
    label: "Comercial",
    badgeClass: "bg-[#E0F2FE] text-[#0C4A6E]",
  };
};

const normalizeClientSearchValue = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const resolveClientIdFromInput = (inputValue, clients = []) => {
  const raw = String(inputValue || "").trim();
  const normalizedRaw = normalizeClientSearchValue(raw);
  if (!raw) return null;

  const exact = clients.find((client) => getClientDisplayLabel(client).toLowerCase() === raw.toLowerCase());
  if (exact?.id != null) return Number(exact.id);

  const byName = clients.filter((client) => String(client?.name || "").trim().toLowerCase() === raw.toLowerCase());
  if (byName.length === 1 && byName[0]?.id != null) return Number(byName[0].id);

  const contains = clients.filter((client) => {
    const haystack = [
      String(client?.name || ""),
      String(client?.city || ""),
      getClientDisplayLabel(client),
    ].join(" ");
    return normalizeClientSearchValue(haystack).includes(normalizedRaw);
  });
  if (contains.length === 1 && contains[0]?.id != null) return Number(contains[0].id);

  return null;
};

const resolveLeadIdFromInput = (inputValue, leads = []) => {
  const raw = String(inputValue || "").trim();
  if (!raw) return null;

  const exact = leads.find((lead) => getClientDisplayLabel(lead).toLowerCase() === raw.toLowerCase());
  if (exact?.id != null) return String(exact.id);

  const byName = leads.filter((lead) => String(lead?.name || "").trim().toLowerCase() === raw.toLowerCase());
  if (byName.length === 1 && byName[0]?.id != null) return String(byName[0].id);

  return null;
};

const normalizeDateKey = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return getLocalDateKey(parsed);
};

const isDateWithinRange = (dateKey, startValue, endValue = null) => {
  const startKey = normalizeDateKey(startValue);
  const endKey = normalizeDateKey(endValue || startValue);
  if (!dateKey || !startKey) return false;
  return dateKey >= startKey && dateKey <= (endKey || startKey);
};

const getElapsedMinutes = (value, now = new Date()) => {
  const parsed = toDate(value);
  if (!parsed) return 0;
  return Math.max(0, Math.round((now.getTime() - parsed.getTime()) / 60000));
};

const ECUADOR_TZ = "America/Guayaquil";

const getPunctualityState = (entryTime) => {
  const parsed = toDate(entryTime);
  if (!parsed) {
    return { state: "no_entry", minutesLate: null, points: 0 };
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ECUADOR_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(parsed);
  const partMap = parts.reduce((acc, p) => { if (p.type !== "literal") acc[p.type] = Number(p.value); return acc; }, {});
  const minutes = (partMap.hour || 0) * 60 + (partMap.minute || 0);
  const delta = minutes - PUNCTUALITY_BASE_MINUTES;
  if (delta <= PUNCTUALITY_TOLERANCE_MINUTES) {
    return { state: "on_time", minutesLate: 0, points: 3 };
  }

  if (delta <= 15) {
    return { state: "slight_late", minutesLate: delta, points: 2 };
  }

  return { state: "late", minutesLate: delta, points: 1 };
};

const getEcuadorEntryMinutes = (entryTime) => {
  const parsed = toDate(entryTime);
  if (!parsed) return Number.POSITIVE_INFINITY;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ECUADOR_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(parsed);
  const partMap = parts.reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = Number(p.value);
    return acc;
  }, {});
  const hour = Number(partMap.hour);
  const minute = Number(partMap.minute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.POSITIVE_INFINITY;
  return (hour * 60) + minute;
};

const mapPermisoToExceptionSuggestion = (permiso) => {
  if (!permiso || permiso.tipo_solicitud !== "permiso") return null;
  const tipoPermiso = String(permiso.tipo_permiso || "").toLowerCase();

  if (tipoPermiso === "salud") {
    return {
      type: "medico",
      description: "Salida por permiso de salud aprobado para hoy",
      source: "permiso_aprobado_hoy",
    };
  }

  if (["personal", "estudios", "calamidad"].includes(tipoPermiso)) {
    return {
      type: "permiso",
      description: `Salida por permiso de ${tipoPermiso} aprobado para hoy`,
      source: "permiso_aprobado_hoy",
    };
  }

  return null;
};

const mapActiveTimeOffToExceptionPreset = (timeOff) => {
  if (!timeOff || String(timeOff?.tipo_solicitud || "").toLowerCase() !== "permiso") return null;
  const tipoPermiso = String(timeOff?.tipo_permiso || "").toLowerCase();
  if (tipoPermiso === "salud") {
    return {
      type: "medico",
      description: "Salida por permiso de salud aprobado",
      actionLabel: "Salida a permiso",
      returnLabel: "Entrada de permiso",
    };
  }
  return {
    type: "permiso",
    description: `Salida por permiso de ${tipoPermiso || "colaborador"} aprobado`,
    actionLabel: "Salida a permiso",
    returnLabel: "Entrada de permiso",
  };
};

const isPermissionLikeException = (exception) => {
  const type = String(exception?.type || "").trim().toLowerCase();
  return type === "permiso" || type === "medico";
};

const permissionCoincidesWithEntryStart = (timeOff) => {
  const tipoSolicitud = String(timeOff?.tipo_solicitud || "").trim().toLowerCase();
  if (tipoSolicitud !== "permiso") return false;
  const startMinutes = getEcuadorEntryMinutes(timeOff?.fecha_inicio_hora);
  return Number.isFinite(startMinutes) && startMinutes <= PUNCTUALITY_BASE_MINUTES;
};

const permissionEndsWithWorkdayClose = (timeOff) => {
  const tipoSolicitud = String(timeOff?.tipo_solicitud || "").trim().toLowerCase();
  if (tipoSolicitud !== "permiso") return false;
  const endMinutes = getEcuadorEntryMinutes(timeOff?.fecha_fin_hora);
  return Number.isFinite(endMinutes) && endMinutes >= (18 * 60);
};

const parseLocationCoord = (value) => {
  if (!value || typeof value !== "string") return null;
  const [latRaw, lngRaw] = value.split(",");
  const lat = Number(latRaw?.trim());
  const lng = Number(lngRaw?.trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (Math.abs(lat) <= 0.0005 && Math.abs(lng) <= 0.0005) return null;
  return { lat, lng };
};

const hasValidAttendanceLocation = (record, target) => {
  const field = ATTENDANCE_LOCATION_FIELDS[target];
  if (!field) return true;
  return Boolean(parseLocationCoord(record?.[field]));
};

const hasValidExceptionLocation = (record, target) => {
  const field = EXCEPTION_LOCATION_FIELDS[target];
  if (!field) return true;
  return Boolean(parseLocationCoord(record?.[field]));
};

const mapExceptionStatusToSyncTarget = (status) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "ON_SITE") return "arrival";
  if (normalized === "RETURNING") return "departure";
  if (normalized === "COMPLETED") return "return";
  return null;
};

const selectBestTodayAttendance = (rows = []) => {
  const normalized = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!normalized.length) return null;

  const toRank = (row) => {
    const hasEntry = row?.entry_time ? 1 : 0;
    const hasExit = row?.exit_time ? 1 : 0;
    const hasGeo =
      (parseLocationCoord(row?.entry_location) ? 1 : 0) +
      (parseLocationCoord(row?.lunch_start_location) ? 1 : 0) +
      (parseLocationCoord(row?.lunch_end_location) ? 1 : 0) +
      (parseLocationCoord(row?.exit_location) ? 1 : 0);
    const updatedAt = toDate(row?.updated_at || row?.created_at)?.getTime() || 0;
    const idRank = Number(row?.id) || 0;
    return [hasEntry, hasExit, hasGeo, updatedAt, idRank];
  };

  return normalized.sort((a, b) => {
    const aRank = toRank(a);
    const bRank = toRank(b);
    for (let i = 0; i < aRank.length; i += 1) {
      if (aRank[i] !== bRank[i]) return bRank[i] - aRank[i];
    }
    return 0;
  })[0];
};

const AttendanceWidget = () => {
  const { showToast } = useUI();
  const { user, handleSessionExpired } = useAuth();

  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCelebration, setShowCelebration] = useState(false);

  const [activeException, setActiveException] = useState(null);
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
  const [exceptionType, setExceptionType] = useState("");
  const [exceptionDescription, setExceptionDescription] = useState("");

  // Geolocation state
  const [locationLoading, setLocationLoading] = useState(false);
  const [cachedLocation, setCachedLocation] = useState(null);
  const [, setCachedLocationAccuracy] = useState(null);
  const [, setLocationTimestamp] = useState(null);
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [showTimelineDetails, setShowTimelineDetails] = useState(false);
  const [, setShowExceptionTools] = useState(false);
  const [recentHistory, setRecentHistory] = useState([]);
  const [exceptionSuggestion, setExceptionSuggestion] = useState(null);
  const [reminderMessage] = useState(null);
  const [overtimePrompt, setOvertimePrompt] = useState(null);
  const [overtimeReason, setOvertimeReason] = useState("");
  const [overtimeSubmitting, setOvertimeSubmitting] = useState(false);
  const [lateJustificationModalOpen, setLateJustificationModalOpen] = useState(false);
  const [lateJustificationReason, setLateJustificationReason] = useState("");
  const [lateJustificationSubmitting, setLateJustificationSubmitting] = useState(false);
  const [entryRegularizationOpen, setEntryRegularizationOpen] = useState(false);
  const [entryRegularizationReason, setEntryRegularizationReason] = useState("");
  const [entryRegularizationLoading, setEntryRegularizationLoading] = useState(false);
  const [entryRegularizationSent, setEntryRegularizationSent] = useState(false);
  const [showFieldTools, setShowFieldTools] = useState(true);
  const [fieldVisitType, setFieldVisitType] = useState("cronograma");
  const [selectedFieldAction, setSelectedFieldAction] = useState("office_exit");
  const [fieldExitMode, setFieldExitMode] = useState("continue_operation");
  const [fieldClientId, setFieldClientId] = useState("");
  const [fieldClientSearch, setFieldClientSearch] = useState("");
  const [fieldProspectName, setFieldProspectName] = useState("");
  const [fieldLeadId, setFieldLeadId] = useState("");
  const [fieldEmergencyReason, setFieldEmergencyReason] = useState("");
  const [fieldVisitNotes, setFieldVisitNotes] = useState("");
  const [tripClosureReason, setTripClosureReason] = useState("");
  const [fieldVisitSubmitting, setFieldVisitSubmitting] = useState(false);
  const [destinationExitMode, setDestinationExitMode] = useState("continue_operation");
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const doClockOutRef = useRef(null);
  const [scheduledClientsToday, setScheduledClientsToday] = useState([]);
  const [scheduledLeadsToday, setScheduledLeadsToday] = useState([]);
  const [scheduledClientsLoading, setScheduledClientsLoading] = useState(false);
  const [plannedVisitAgenda, setPlannedVisitAgenda] = useState([]);
  const [emergencyClients, setEmergencyClients] = useState([]);
  const [emergencyClientsLoading, setEmergencyClientsLoading] = useState(false);
  const [fieldEmergencyClientId, setFieldEmergencyClientId] = useState("");
  const [fieldEmergencyClientSearch, setFieldEmergencyClientSearch] = useState("");
  const [operationalModalOpen, setOperationalModalOpen] = useState(false);
  const [operationalModalPhase, setOperationalModalPhase] = useState("start");
  const [operationalModalError, setOperationalModalError] = useState("");
  const [operationalCategory, setOperationalCategory] = useState("");
  const [operationalDetail, setOperationalDetail] = useState("");
  const [operationalVehicleMode, setOperationalVehicleMode] = useState("company");
  const [operationalStartKm, setOperationalStartKm] = useState("");
  const [operationalEndKm, setOperationalEndKm] = useState("");
  const [operationalStartPhoto, setOperationalStartPhoto] = useState(null);
  const [operationalEndPhoto, setOperationalEndPhoto] = useState(null);
  const initializedRef = useRef(false);
  const openLateJustificationFlow = useCallback(() => {
    setWidgetModalOpen(false);
    setExceptionModalOpen(false);
    setLateJustificationModalOpen(true);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    startLocationPrewarm();
    return () => stopLocationPrewarm();
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (activeException) {
      setShowExceptionTools(true);
    }
  }, [activeException]);

  useEffect(() => {
    if (!exceptionModalOpen || !exceptionSuggestion) return;
    if (exceptionType || exceptionDescription) return;
    setExceptionType(exceptionSuggestion.type);
    setExceptionDescription(exceptionSuggestion.description);
  }, [exceptionDescription, exceptionModalOpen, exceptionSuggestion, exceptionType]);

  // Sistema de actualizaciones automaticas sin loops
  useAutoUpdate(() => {
    refreshAll();
  }, []);

  const loadAttendance = async () => {
    try {
      const res = await getTodayAttendance();
      const todayData = res?.data || null;
      if (todayData) {
        setAttendance(todayData);
        return todayData;
      }
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 401) {
        showToast("Tu sesión expiró. Por favor inicia sesión nuevamente.", "warning");
        setAttendance(null);
        try {
          handleSessionExpired?.();
        } catch (logoutErr) {
          console.error("AttendanceWidget logout after 401 failed:", logoutErr);
        }
        return null;
      }
      if (status !== 409) {
        console.error(err);
      }
    }

    if (!user?.id) {
      setAttendance(null);
      return null;
    }

    try {
      const today = getLocalDateKey(new Date());
      const rangeRes = await getAttendanceRange(today, today, user.id);
      const rows = Array.isArray(rangeRes?.data) ? rangeRes.data : [];
      const best = selectBestTodayAttendance(rows);
      setAttendance(best || null);
      return best || null;
    } catch (fallbackErr) {
      console.error("Error loading attendance fallback:", fallbackErr);
      return null;
    }
  };

  const fetchException = async () => {
    try {
      const res = await getActiveException();
      setActiveException(res?.data || null);
    } catch (err) {
      console.error("Error fetching active exception:", err);
    }
  };

  const loadRecentHistory = async () => {
    if (!user?.id) {
      setRecentHistory([]);
      return;
    }

    try {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - (RECENT_HISTORY_DAYS - 1));

      const res = await getAttendanceRange(
        start.toISOString().slice(0, 10),
        end.toISOString().slice(0, 10),
        user.id,
      );

      const rows = Array.isArray(res?.data) ? res.data : [];
      setRecentHistory(rows.slice(0, RECENT_HISTORY_DAYS));
    } catch (err) {
      console.error("Error loading attendance history:", err);
      setRecentHistory([]);
    }
  };

  const loadExceptionSuggestion = async () => {
    const todayKey = attendance?.date || getLocalDateKey(new Date());
    const suggestionCandidates = [];

    try {
      const res = await getMisSolicitudes();
      const rows = Array.isArray(res?.data) ? res.data : [];

      const suggestion = rows
        .filter((row) => APPROVED_PERMISSION_STATUSES.has(String(row?.status || "").toLowerCase()))
        .find((row) =>
          row?.tipo_solicitud === "permiso" &&
          isDateWithinRange(
            todayKey,
            row?.fecha_inicio_hora || row?.fecha_inicio,
            row?.fecha_fin_hora || row?.fecha_fin || row?.fecha_inicio_hora || row?.fecha_inicio,
          )
        );

      const permisoSuggestion = mapPermisoToExceptionSuggestion(suggestion);
      if (permisoSuggestion) {
        suggestionCandidates.push(permisoSuggestion);
      }
    } catch (err) {
      console.error("Error loading permission suggestion:", err);
    }

    setExceptionSuggestion(suggestionCandidates[0] || null);
  };

  const loadScheduledClientsForToday = async () => {
    if (!canUseFieldOperations) {
      setScheduledClientsToday([]);
      setPlannedVisitAgenda([]);
      return;
    }

    setScheduledClientsLoading(true);
    try {
      const dateKey = attendance?.date || getLocalDateKey(new Date());
      const result = await fetchClients({
        date: dateKey,
        include_schedule_info: true,
        schedule_scope: "mine",
      });
      const clients = Array.isArray(result?.clients) ? result.clients : [];
      const agenda = clients
        .filter((client) => !client?.is_prospect)
        .map((client) => {
          const scheduleInfo = client?.scheduled_info || {};
          const isCommercial = Boolean(scheduleInfo?.is_planned_commercial || scheduleInfo?.is_planned);
          const isTechnical = Boolean(scheduleInfo?.is_planned_technical);
          const roleMatches =
            (canSeeCommercialScheduleAgenda && isCommercial) ||
            (canSeeTechnicalScheduleAgenda && isTechnical);

          if (!roleMatches) return null;

          const city =
            String(scheduleInfo?.planned_city || client?.shipping_city || "").trim() || "Sin ciudad";
          const name =
            String(client?.commercial_name || client?.nombre || `Cliente #${client?.id || ""}`).trim();
          return {
            id: Number(client.id),
            name,
            city,
            displayLabel: getClientDisplayLabel({ id: client.id, name, city }),
            plannedDate: scheduleInfo?.planned_date || scheduleInfo?.technical_date || dateKey,
            priority: Number(scheduleInfo?.priority || 0),
            notes: String(scheduleInfo?.notes || "").trim(),
            isCommercial,
            isTechnical,
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const byPriority = Number(b.priority || 0) - Number(a.priority || 0);
          if (byPriority !== 0) return byPriority;
          return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
        });

      setPlannedVisitAgenda(agenda);
      setScheduledClientsToday(
        agenda.map((item) => ({
          id: item.id,
          name: item.name,
          city: item.city,
        })),
      );

      const leadsToday = Array.isArray(result?.leads) ? result.leads : [];
      setScheduledLeadsToday(
        canSeeCommercialScheduleAgenda
          ? leadsToday.map((lead) => ({
              id: lead.lead_id,
              name: String(lead.full_name || lead.company_name || `Lead ${lead.lead_id}`).trim(),
              city: String(lead.city || "").trim() || "Sin ciudad",
            }))
          : [],
      );
    } catch (_error) {
      setScheduledClientsToday([]);
      setPlannedVisitAgenda([]);
      setScheduledLeadsToday([]);
    } finally {
      setScheduledClientsLoading(false);
    }
  };

  const loadAccessibleClientsForEmergency = async () => {
    if (!canUseFieldOperations) {
      setEmergencyClients([]);
      return;
    }

    setEmergencyClientsLoading(true);
    try {
      const result = await fetchClients();
      const clients = Array.isArray(result?.clients) ? result.clients : [];
      const available = clients
        .filter((client) => !client?.is_prospect)
        .map((client) => ({
          id: Number(client.id),
          name: client.commercial_name || client.nombre || `Cliente #${client.id}`,
          city: client.shipping_city || "Sin ciudad",
        }));

      setEmergencyClients(available);
    } catch (_error) {
      setEmergencyClients([]);
    } finally {
      setEmergencyClientsLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.allSettled([
      loadAttendance(),
      fetchException(),
      loadRecentHistory(),
      loadExceptionSuggestion(),
      loadScheduledClientsForToday(),
      loadAccessibleClientsForEmergency(),
    ]);
  };

  const getLocationForAction = async ({ forceRefresh = false } = {}) => {
    setLocationLoading(true);
    try {
      const result = await getSharedLocation({ forceRefresh });
      setCachedLocation({ latitude: result.latitude, longitude: result.longitude });
      setCachedLocationAccuracy(result.accuracy ?? null);
      setLocationTimestamp(result.timestamp);
      return result;
    } finally {
      setLocationLoading(false);
    }
  };

  const ensureSyncTargetLocation = async (target, locationPayload, baseRecord = null) => {
    if (!target || !locationPayload) return;
    const currentRecord = baseRecord || attendance || null;
    if (currentRecord && hasValidAttendanceLocation(currentRecord, target)) return;

    try {
      await syncAttendanceLocation(target, locationPayload);
    } catch (syncErr) {
      console.warn("Silent location sync failed:", syncErr?.response?.data?.message || syncErr?.message || syncErr);
    }
  };

  const resolveAttendanceConflict = async (target, locationPayload) => {
    const latest = await loadAttendance();
    if (!latest) return false;

    if (target && !hasValidAttendanceLocation(latest, target)) {
      await ensureSyncTargetLocation(target, locationPayload, latest);
      await loadAttendance();
    }
    return true;
  };

  const ensureSyncExceptionTargetLocation = async (target, locationPayload, baseException = null) => {
    if (!target || !locationPayload) return;
    const currentException = baseException || activeException || null;
    if (currentException && hasValidExceptionLocation(currentException, target)) return;

    try {
      await syncAttendanceLocation(target, locationPayload);
    } catch (syncErr) {
      console.warn("Silent exception location sync failed:", syncErr?.response?.data?.message || syncErr?.message || syncErr);
    }
  };

  const resolveExceptionConflict = async (target, locationPayload) => {
    try {
      const activeResponse = await getActiveException();
      const latestException = activeResponse?.data || null;
      setActiveException(latestException || null);
      if (!latestException) return false;

      if (target && !hasValidExceptionLocation(latestException, target)) {
        await ensureSyncExceptionTargetLocation(target, locationPayload, latestException);
        await fetchException();
      }
      return true;
    } catch (_err) {
      return false;
    }
  };

  const formatTime = (ts) => {
    return formatTimeSafe(ts);
  };

  const celebrate = () => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#3b82f6", "#22c55e", "#6366f1"],
    });
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 2500);
  };

  const calculateProgress = () => {
    const entryDate = toDate(attendance?.entry_time);
    if (!entryDate) return 0;

    const now = new Date();
    let workedMs = now.getTime() - entryDate.getTime();

    const lunchStart = toDate(attendance?.lunch_start_time);
    if (lunchStart) {
      const lunchEnd = toDate(attendance?.lunch_end_time);
      workedMs -= (lunchEnd ? lunchEnd.getTime() : now.getTime()) - lunchStart.getTime();
    }

    const hours = workedMs / (1000 * 60 * 60);
    return Math.min(Math.round((hours / 8) * 100), 100);
  };

  const getStatusInfo = () => {
    if (isPermissionFlowActive)
      return {
        text: permissionNeedsExitClose ? "Permiso cierra la jornada" : "Permiso en curso",
        icon: <FiTrendingUp className="text-sky-500" />,
      };

    if (permissionNeedsEntryStart)
      return {
        text: "Permiso activo al iniciar jornada",
        icon: <FiTrendingUp className="text-sky-500" />,
      };

    if (hasActiveApprovedPermission && !hasActiveException)
      return {
        text: activeTimeOff?.is_upcoming ? "Permiso programado hoy" : "Permiso aprobado activo",
        icon: <FiTrendingUp className="text-sky-500" />,
      };

    if (!attendance?.entry_time)
      return {
        text: "Marca tu entrada",
        icon: <FiSun className="text-yellow-500" />,
      };

    if (attendance.exit_time)
      return {
        text: "Jornada completada",
        icon: <FiMoon className="text-indigo-500" />,
      };

    if (attendance.lunch_start_time && !attendance.lunch_end_time)
      return {
        text: "En almuerzo",
        icon: <FiCoffee className="text-orange-500" />,
      };

    return {
      text: "Jornada en progreso",
      icon: <FiClock className="text-blue-500" />,
    };
  };

  /**
  * Optimized non-blocking attendance handler
  * - Starts geolocation in background
  * - Proceeds with attendance registration regardless of geolocation result
  * - Shows appropriate loading states and feedback
  */
  const handle = async (fn, successMsg, celebrateDay = false, options = {}) => {
    setLoading(true);
    let actionLocation = null;

    try {
      actionLocation = await getLocationForAction();
      const res = await fn(actionLocation);

      if (res.ok) {
        if (options?.syncTarget) {
          await ensureSyncTargetLocation(options.syncTarget, actionLocation);
        }
        if (typeof options.onSuccess === "function") {
          await options.onSuccess(res);
        }
        if (celebrateDay) celebrate();
        showToast(successMsg, "success");
        await refreshAll();
      } else {
        showToast("Error registrando asistencia", "error");
      }
    } catch (err) {
      console.error("Attendance registration error:", err);
      const status = Number(err?.response?.status || 0);
      // 422 = GPS required/accuracy low — no conflict recovery, just show error
      if (status !== 422 && (status === 400 || status === 409) && options?.syncTarget) {
        const recovered = await resolveAttendanceConflict(options.syncTarget, actionLocation || cachedLocation || null);
        if (recovered) {
          showToast("La marca ya existia. Se actualizo el estado de asistencia.", "warning");
          await refreshAll();
          return;
        }
      }
      const info = getAttendanceErrorInfo(err, "Error registrando asistencia", "error");
      showToast(info.message, info.type);
    } finally {
      setLoading(false);
    }
  };

  /**
  * Optimized exception status update with background geolocation
  */
  const handleExceptionUpdate = async (status, successMsg) => {
    setLoading(true);
    const syncTarget = mapExceptionStatusToSyncTarget(status);
    let actionLocation = null;
    try {
      const activeResponse = await getActiveException();
      const currentActive = activeResponse?.data || null;
      if (!currentActive) {
        showToast("No tienes una salida inesperada activa para continuar.", "warning");
        return;
      }
      if (isOperationalFlow(currentActive)) {
        showToast("La salida activa actual es operacional. Usa los controles operacionales para continuar.", "warning");
        return;
      }

      actionLocation = await getLocationForAction();
      const res = await updateExceptionStatus(status, actionLocation);
      if (res.ok) {
        if (syncTarget) {
          await ensureSyncExceptionTargetLocation(syncTarget, actionLocation);
        }
        showToast(successMsg, "success");
        await refreshAll();
      } else {
        showToast("Error actualizando estado", "error");
      }
    } catch (err) {
      console.error("Exception update error:", err);
      const httpStatus = Number(err?.response?.status || 0);
      if ((httpStatus === 400 || httpStatus === 404 || httpStatus === 409) && syncTarget) {
        const recovered = await resolveExceptionConflict(syncTarget, actionLocation || cachedLocation || null);
        if (recovered) {
          showToast("La marcacion ya existia. Se actualizo el estado operativo.", "warning");
          await refreshAll();
          return;
        }
      }
      const info = getAttendanceErrorInfo(err, "Error actualizando estado", "error");
      showToast(info.message, info.type);
    } finally {
      setLoading(false);
    }
  };

  const handleStartApprovedPermission = async () => {
    const preset = mapActiveTimeOffToExceptionPreset(attendance?.active_time_off);
    if (!preset) {
      showToast("No tienes un permiso activo para marcar.", "warning");
      return;
    }

    setLoading(true);
    let actionLocation = null;
    try {
      actionLocation = await getLocationForAction();
      const res = await registerException(preset.type, preset.description, actionLocation, { isJustified: true });
      if (res?.ok) {
        await ensureSyncExceptionTargetLocation("start", actionLocation);
        showToast(`Salida a permiso registrada a las ${formatTimeSafe(new Date(), "HH:mm")}.`, "success");
        await refreshAll();
      } else {
        showToast("No se pudo registrar la salida a permiso.", "error");
      }
    } catch (err) {
      const info = getAttendanceErrorInfo(err, "Error registrando salida a permiso", "error");
      showToast(info.message, info.type);
    } finally {
      setLoading(false);
    }
  };

  const handleStartPermissionWithEntry = async () => {
    setLoading(true);
    let actionLocation = null;
    try {
      actionLocation = await getLocationForAction();
      const res = await startPermissionEntry(actionLocation);
      if (res?.ok) {
        showToast("Entrada y salida a permiso registradas.", "success");
        await refreshAll();
      } else {
        showToast("No se pudo registrar la entrada y salida a permiso.", "error");
      }
    } catch (err) {
      const info = getAttendanceErrorInfo(err, "Error registrando entrada y salida a permiso", "error");
      showToast(info.message, info.type);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishPermissionWithExit = async () => {
    setLoading(true);
    let actionLocation = null;
    try {
      actionLocation = await getLocationForAction();
      const res = await finishPermissionExit(actionLocation);
      if (res?.ok) {
        showToast("Permiso y jornada finalizados.", "success");
        await refreshAll();
      } else {
        showToast("No se pudo finalizar el permiso y la jornada.", "error");
      }
    } catch (err) {
      const info = getAttendanceErrorInfo(err, "Error registrando salida del permiso y cierre de jornada", "error");
      showToast(info.message, info.type);
    } finally {
      setLoading(false);
    }
  };

  const canUseFieldOperations = useMemo(() => {
    const role = String(user?.role || "").toLowerCase();
    return [
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
      "jefe_servicio",
      "jefe_servicio_tecnico",
      "ti",
      "jefe_ti",
      "logistica",
      "jefe_logistica",
    ].includes(role);
  }, [user?.role]);
  const normalizedUserRole = useMemo(
    () => String(user?.role || "").trim().toLowerCase(),
    [user?.role],
  );
  const canSeeCommercialScheduleAgenda = useMemo(
    () => COMMERCIAL_SCHEDULE_ROLES.has(normalizedUserRole),
    [normalizedUserRole],
  );
  const canSeeTechnicalScheduleAgenda = useMemo(
    () => TECHNICAL_SCHEDULE_ROLES.has(normalizedUserRole),
    [normalizedUserRole],
  );

  useEffect(() => {
    if (fieldVisitType !== "cronograma") return;
    if (!scheduledClientsToday.length) {
      setFieldClientId("");
      return;
    }
    if (!fieldClientSearch) {
      setFieldClientId("");
      return;
    }
    const exists = scheduledClientsToday.some((client) => String(client.id) === String(fieldClientId));
    if (!exists) setFieldClientId("");
  }, [fieldClientId, fieldClientSearch, fieldVisitType, scheduledClientsToday]);

  const filteredScheduledClients = useMemo(() => {
    const term = String(fieldClientSearch || "").trim().toLowerCase();
    if (!term) return scheduledClientsToday;
    return scheduledClientsToday.filter((client) => {
      const haystack = [
        String(client?.name || ""),
        String(client?.city || ""),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [fieldClientSearch, scheduledClientsToday]);

  useEffect(() => {
    if (fieldVisitType !== "emergencia") return;
    if (!emergencyClients.length) {
      setFieldEmergencyClientId("");
      return;
    }
    if (!fieldEmergencyClientSearch) {
      setFieldEmergencyClientId("");
      return;
    }
    const exists = emergencyClients.some((client) => String(client.id) === String(fieldEmergencyClientId));
    if (!exists) setFieldEmergencyClientId("");
  }, [emergencyClients, fieldEmergencyClientId, fieldEmergencyClientSearch, fieldVisitType]);

  const filteredEmergencyClients = useMemo(() => {
    const term = normalizeClientSearchValue(fieldEmergencyClientSearch);
    if (!term) return emergencyClients;
    return emergencyClients.filter((client) => {
      const haystack = [
        String(client?.name || ""),
        String(client?.city || ""),
        getClientDisplayLabel(client),
      ].join(" ");
      return normalizeClientSearchValue(haystack).includes(term);
    });
  }, [emergencyClients, fieldEmergencyClientSearch]);

  const renderClientPickerSection = ({
    title = "Tipo de gestion",
    stepLabel = "Paso 1",
  } = {}) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</p>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">{stepLabel}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {FIELD_VISIT_TYPE_OPTIONS.map((option) => {
          const active = fieldVisitType === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setFieldVisitType(option.value)}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                active
                  ? "border-sky-500 bg-sky-50 text-sky-900 shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-sky-50/40"
              }`}
              aria-pressed={active}
              style={{ touchAction: "manipulation" }}
            >
              <p className="text-xs font-semibold">{option.label}</p>
              <p className={`text-[10px] ${active ? "text-sky-700" : "text-slate-500"}`}>{option.helper}</p>
            </button>
          );
        })}
      </div>

      {fieldVisitType === "cronograma" ? (
        <>
          <input
            type="text"
            value={fieldClientSearch}
            list="attendance-scheduled-clients-list"
            onChange={(e) => {
              const value = e.target.value;
              setFieldClientSearch(value);
              const resolvedId = resolveClientIdFromInput(value, scheduledClientsToday);
              setFieldClientId(resolvedId ? String(resolvedId) : "");
            }}
            placeholder="Buscar cliente por nombre o ciudad"
            className={CONTROL_INPUT_SUBTLE_CLASS}
            aria-label="Buscar cliente por nombre o ciudad"
          />
          <datalist id="attendance-scheduled-clients-list">
            {filteredScheduledClients.map((client) => (
              <option key={client.id} value={getClientDisplayLabel(client)}>{getClientDisplayLabel(client)}</option>
            ))}
          </datalist>
          {!scheduledClientsLoading && filteredScheduledClients.length === 0 && fieldClientSearch ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-700">Sin coincidencias con la busqueda.</p>
          ) : null}
          {fieldClientId ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-medium text-emerald-700">
              {getClientDisplayLabel(scheduledClientsToday.find((c) => String(c.id) === String(fieldClientId)))}
            </p>
          ) : null}
        </>
      ) : null}

      {fieldVisitType === "prospecto" ? (
        <>
          <input
            type="text"
            value={fieldProspectName}
            list="attendance-scheduled-leads-list"
            onChange={(e) => {
              const value = e.target.value;
              setFieldProspectName(value);
              setFieldLeadId(resolveLeadIdFromInput(value, scheduledLeadsToday) || "");
            }}
            placeholder="Nombre del prospecto o lead del cronograma"
            className={CONTROL_INPUT_SUBTLE_CLASS}
            aria-label="Nombre del prospecto"
          />
          <datalist id="attendance-scheduled-leads-list">
            {scheduledLeadsToday.map((lead) => (
              <option key={lead.id} value={getClientDisplayLabel(lead)}>{getClientDisplayLabel(lead)}</option>
            ))}
          </datalist>
          {fieldLeadId ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-medium text-emerald-700">
              Lead del cronograma: {getClientDisplayLabel(scheduledLeadsToday.find((l) => String(l.id) === String(fieldLeadId)))}
            </p>
          ) : null}
        </>
      ) : null}

      {fieldVisitType === "emergencia" ? (
        <>
          <input
            type="text"
            value={fieldEmergencyClientSearch}
            list="attendance-emergency-clients-list"
            onChange={(e) => {
              const value = e.target.value;
              setFieldEmergencyClientSearch(value);
              const resolvedId = resolveClientIdFromInput(value, emergencyClients);
              setFieldEmergencyClientId(resolvedId ? String(resolvedId) : "");
            }}
            placeholder="Buscar cliente para emergencia"
            className={CONTROL_INPUT_SUBTLE_CLASS}
            aria-label="Buscar cliente para emergencia"
          />
          <datalist id="attendance-emergency-clients-list">
            {filteredEmergencyClients.map((client) => (
              <option key={client.id} value={getClientDisplayLabel(client)}>{getClientDisplayLabel(client)}</option>
            ))}
          </datalist>
          {!emergencyClientsLoading && filteredEmergencyClients.length === 0 && fieldEmergencyClientSearch ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-700">Sin coincidencias.</p>
          ) : null}
          {fieldEmergencyClientId ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-medium text-emerald-700">
              {getClientDisplayLabel(emergencyClients.find((c) => String(c.id) === String(fieldEmergencyClientId)))}
            </p>
          ) : null}
          <input
            type="text"
            value={fieldEmergencyReason}
            onChange={(e) => setFieldEmergencyReason(e.target.value)}
            placeholder="Motivo de emergencia"
            className={CONTROL_INPUT_SUBTLE_CLASS}
            aria-label="Motivo de emergencia"
          />
        </>
      ) : null}

      <textarea
        rows={2}
        value={fieldVisitNotes}
        onChange={(e) => setFieldVisitNotes(e.target.value)}
        placeholder="Observaciones (opcional)"
        className={CONTROL_TEXTAREA_CLASS}
        aria-label="Observaciones opcionales de la gestion"
      />
    </div>
  );

  const buildFieldVisitPayload = async ({ includeObservations = false, mode = "entry", locationOverride = null } = {}) => {
    const payload = {};
    const location = locationOverride || await getLocationForAction();
    payload.location = `${location.latitude},${location.longitude}`;
    if (Number.isFinite(location.accuracy) && location.accuracy >= 0) {
      payload.location_accuracy = location.accuracy;
    }
    payload.location_meta = {
      accuracy: location.accuracy ?? null,
      timestamp: location.timestamp || Date.now(),
      source: location.source || "gps",
    };

    if (mode === "exit" && attendance?.active_field_visit) {
      const activeVisitScope = String(attendance.active_field_visit?.visit_scope || "").toLowerCase();
      const activeClientId = Number(attendance.active_field_visit?.client_id);
      const activeProspectName = String(attendance.active_field_visit?.prospect_name || "").trim();
      if (activeVisitScope === "client" && Number.isInteger(activeClientId) && activeClientId > 0) {
        payload.client_id = activeClientId;
      } else if (activeVisitScope === "prospect" && activeProspectName) {
        payload.prospect_name = activeProspectName;
      }
    }

    if (!payload.client_id && !payload.prospect_name && fieldVisitType === "cronograma") {
      const numericClientId = Number(fieldClientId || resolveClientIdFromInput(fieldClientSearch, scheduledClientsToday));
      if (!Number.isInteger(numericClientId) || numericClientId <= 0) {
        throw new Error("Debes seleccionar un cliente planificado del cronograma del dia.");
      }
      payload.client_id = numericClientId;
    } else if (!payload.client_id && !payload.prospect_name && fieldVisitType === "prospecto") {
      const normalizedName = String(fieldProspectName || "").trim();
      if (!normalizedName) {
        throw new Error("Para prospecto debes ingresar un nombre.");
      }
      payload.prospect_name = normalizedName;
      if (fieldLeadId) {
        payload.lead_id = fieldLeadId;
      }
    } else if (!payload.client_id && !payload.prospect_name) {
      const numericEmergencyClientId = Number(fieldEmergencyClientId || resolveClientIdFromInput(fieldEmergencyClientSearch, emergencyClients));
      if (!Number.isInteger(numericEmergencyClientId) || numericEmergencyClientId <= 0) {
        throw new Error("Para emergencia debes seleccionar un cliente registrado o asignado.");
      }
      const normalizedReason = String(fieldEmergencyReason || "").trim();
      if (!normalizedReason) {
        throw new Error("Para emergencia debes ingresar el motivo.");
      }
      payload.client_id = numericEmergencyClientId;
      payload.observations = normalizedReason;
    }

    if (includeObservations) {
      const normalizedNotes = String(fieldVisitNotes || "").trim();
      if (normalizedNotes) {
        payload.observations = payload.observations
          ? `${payload.observations}\nDetalle de cierre: ${normalizedNotes}`
          : normalizedNotes;
      }
    }

    return payload;
  };

  const handleFieldVisitMark = async (kind) => {
    setFieldVisitSubmitting(true);
    try {
      const payload = await buildFieldVisitPayload({ includeObservations: kind === "exit", mode: kind });
      const shouldCloseJourneyFromDestination = kind === "exit" && fieldExitMode === "end_jornada";
      if (kind === "exit") {
        if (shouldCloseJourneyFromDestination) {
          payload.return_to_office = false;
          payload.post_visit_action = "continue_operation";
        } else {
          payload.return_to_office = fieldExitMode === "return_to_office";
          payload.post_visit_action = fieldExitMode;
        }
      }
      const res =
        kind === "entry"
          ? await marcarVisitaEntrada(payload)
          : await marcarVisitaSalida(payload);

      if (res?.ok) {
        showToast(
          kind === "entry"
            ? "Entrada de cliente registrada correctamente."
            : "Salida de cliente registrada correctamente.",
          "success",
        );
        if (kind === "entry") {
          setSelectedFieldAction("client_exit");
        } else {
          setSelectedFieldAction(
            shouldCloseJourneyFromDestination
              ? "client_exit"
              : fieldExitMode === "return_to_office"
                ? "office_entry"
                : "client_entry"
          );
        }
        await refreshAll();
        if (shouldCloseJourneyFromDestination) {
          setTripClosureReason(String(fieldVisitNotes || "").trim());
          openOperationalModal("close");
        }
      } else {
        showToast("No se pudo registrar la visita de campo.", "error");
      }
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      const backendCode = String(err?.response?.data?.code || "").trim();
      const backendMessage = String(err?.response?.data?.message || "").trim();
      if (
        kind === "exit" &&
        status === 404 &&
        (
          backendCode === "NO_ACTIVE_VISIT" ||
          /no se encontró una visita activa/i.test(backendMessage)
        )
      ) {
        await refreshAll();
        setSelectedFieldAction(fieldExitMode === "return_to_office" ? "office_entry" : "client_entry");
        showToast("No habia una visita activa pendiente. El estado ya fue sincronizado.", "info");
        return;
      }
      if (status === 400 || status === 404 || status === 409) {
        await refreshAll();
      }
      const info = getAttendanceErrorInfo(err, "Error registrando visita de campo", "error");
      showToast(info.message, info.type);
    } finally {
      setFieldVisitSubmitting(false);
    }
  };

  const resetOperationalModal = useCallback(() => {
    setOperationalModalError("");
    setOperationalCategory("");
    setOperationalDetail("");
    setOperationalVehicleMode("company");
    setOperationalStartKm("");
    setOperationalEndKm("");
    setOperationalStartPhoto(null);
    setOperationalEndPhoto(null);
  }, []);

  const resetFieldVisitDraft = useCallback(() => {
    setFieldVisitType("cronograma");
    setFieldClientId("");
    setFieldClientSearch("");
    setFieldProspectName("");
    setFieldLeadId("");
    setFieldEmergencyClientId("");
    setFieldEmergencyClientSearch("");
    setFieldEmergencyReason("");
    setFieldVisitNotes("");
    setFieldExitMode("continue_operation");
    setDestinationExitMode("continue_operation");
  }, []);

  const openOperationalModal = useCallback((phase) => {
    setOperationalModalPhase(phase);
    setOperationalModalError("");
    if (phase === "start") {
      resetOperationalModal();
      resetFieldVisitDraft();
    } else {
      setOperationalDetail("");
      setOperationalEndKm("");
      setOperationalEndPhoto(null);
    }
    setOperationalModalOpen(true);
  }, [resetFieldVisitDraft, resetOperationalModal]);

  const submitOperationalModal = async () => {
    const requiresVehicleClosure = operationalModalPhase !== "start" && Boolean(activeException?.uses_personal_vehicle);
    const isClientVisitDraft = canUseFieldOperations && String(operationalCategory || "").trim().toLowerCase() === "cliente";

    if (operationalModalPhase === "start" && !operationalCategory) {
      setOperationalModalError("Selecciona la categoria de la salida operacional.");
      return;
    }
    if (operationalModalPhase === "start" && isClientVisitDraft) {
      if (fieldVisitType === "cronograma" && !fieldClientId) {
        setOperationalModalError("Selecciona el cliente del cronograma que vas a visitar.");
        return;
      }
      if (fieldVisitType === "prospecto" && !String(fieldProspectName || "").trim()) {
        setOperationalModalError("Ingresa el nombre del prospecto que vas a visitar.");
        return;
      }
      if (fieldVisitType === "emergencia") {
        if (!fieldEmergencyClientId) {
          setOperationalModalError("Selecciona el cliente relacionado con la atencion urgente.");
          return;
        }
        if (!String(fieldEmergencyReason || "").trim()) {
          setOperationalModalError("Ingresa el motivo de la atencion urgente.");
          return;
        }
      }
    }
    if (operationalModalPhase === "start" && operationalVehicleMode === "personal") {
      if (!String(operationalStartKm || "").trim()) {
        setOperationalModalError("Debes registrar el kilometraje inicial.");
        return;
      }
      if (!operationalStartPhoto) {
        setOperationalModalError("Debes tomar la foto del kilometraje inicial.");
        return;
      }
    }
    if (requiresVehicleClosure) {
      if (!String(operationalEndKm || "").trim()) {
        setOperationalModalError("Debes registrar el kilometraje final.");
        return;
      }
      if (!operationalEndPhoto) {
        setOperationalModalError("Debes tomar la foto del kilometraje final.");
        return;
      }
    }

    setOperationalModalError("");
    setFieldVisitSubmitting(true);
    let actionLocation = null;
    try {
      actionLocation = await getLocationForAction();
      if (operationalModalPhase === "start") {
        const description = String(operationalDetail || "").trim() || "Salida operacional de campo / oficina";
        const res = await marcarSalidaOficina(actionLocation, {
          description,
          operational_category: operationalCategory,
          uses_personal_vehicle: operationalVehicleMode === "personal",
          odometer_start_km: operationalStartKm,
          start_odometer_photo: operationalStartPhoto,
        });
        if (res?.ok) {
          await ensureSyncExceptionTargetLocation("start", actionLocation);
          showToast("Salida operacional registrada.", "success");
          setOperationalModalOpen(false);
          resetOperationalModal();
          setSelectedFieldAction(isClientVisitDraft ? "client_entry" : "office_exit");
          await refreshAll();
          return;
        }
        showToast("No se pudo registrar la salida operacional.", "error");
        return;
      }

      if (operationalModalPhase === "end") {
        const res = await marcarEntradaOficina(actionLocation, {
          odometer_end_km: operationalEndKm,
          end_odometer_photo: operationalEndPhoto,
        });
        if (res?.ok) {
          await ensureSyncExceptionTargetLocation("return", actionLocation);
          const allowanceId = res?.data?.travel_allowance_id;
          showToast(
            allowanceId
              ? `Salida operacional cerrada. Viatico #${allowanceId} preparado.`
              : "Salida operacional cerrada.",
            "success",
          );
          setOperationalModalOpen(false);
          setOperationalEndKm("");
          setOperationalEndPhoto(null);
          await refreshAll();
          return;
        }
        showToast("No se pudo cerrar la salida operacional.", "error");
        return;
      }

      const res = await marcarCierreViaje(actionLocation, {
        closure_reason: String(operationalDetail || tripClosureReason || "").trim() || null,
        odometer_end_km: operationalEndKm,
        end_odometer_photo: operationalEndPhoto,
      });
      if (res?.ok) {
        const allowanceId = res?.data?.travel_allowance_id;
        showToast(
          allowanceId
            ? `Viaje cerrado. Viatico #${allowanceId} preparado.`
            : "Viaje cerrado correctamente desde fuera de oficina.",
          "success",
        );
        setTripClosureReason("");
        setOperationalModalOpen(false);
        setOperationalEndKm("");
        setOperationalEndPhoto(null);
        await refreshAll();
        return;
      }
      showToast("No se pudo cerrar el viaje.", "error");
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (operationalModalPhase === "start" && (status === 400 || status === 404 || status === 409)) {
        const recovered = await resolveExceptionConflict("start", actionLocation || cachedLocation || null);
        if (recovered) {
          showToast("La salida operacional ya existia. Estado actualizado.", "warning");
          setOperationalModalOpen(false);
          await refreshAll();
          return;
        }
      }
      if (operationalModalPhase === "end" && (status === 400 || status === 404 || status === 409)) {
        const recovered = await resolveExceptionConflict("return", actionLocation || cachedLocation || null);
        if (recovered) {
          showToast("La entrada operacional ya existia. Estado actualizado.", "warning");
          setOperationalModalOpen(false);
          await refreshAll();
          return;
        }
      }
      const fallbackMessage = operationalModalPhase === "close"
        ? "Error cerrando viaje"
        : operationalModalPhase === "end"
          ? "Error registrando cierre operacional"
          : "Error registrando salida operacional";
      const info = getAttendanceErrorInfo(err, fallbackMessage, "error");
      showToast(info.message, info.type);
    } finally {
      setFieldVisitSubmitting(false);
    }
  };

  const handleOfficeDepartureQuick = async () => {
    if (hasActiveException) {
      if (isFieldOperationFlow) {
        showToast("Ya tienes una operacion de campo activa.", "info");
      } else {
        showToast("Tienes una salida inesperada activa. Debes cerrarla antes de iniciar una salida operacional.", "warning");
      }
      return;
    }
    openOperationalModal("start");
  };

  const handleOfficeArrivalQuick = async () => {
    if (!hasActiveException) {
      showToast("No tienes una salida de oficina activa para cerrar.", "warning");
      return;
    }
    if (!isFieldOperationFlow) {
      showToast("La salida activa actual es inesperada. Usa el flujo de salida inesperada para cerrarla.", "warning");
      return;
    }

    openOperationalModal("end");
  };

  const handleLlegadaDestino = async () => {
    if (!isFieldOperationFlow) {
      showToast("No tienes una salida operacional activa.", "warning");
      return;
    }
    setFieldVisitSubmitting(true);
    let actionLocation = null;
    try {
      actionLocation = await getLocationForAction();
      const res = await marcarLlegadaDestino(actionLocation);
      if (res?.ok) {
        showToast("Llegada a destino registrada.", "success");
        await refreshAll();
      } else {
        showToast("No se pudo registrar la llegada a destino.", "error");
      }
    } catch (err) {
      const info = getAttendanceErrorInfo(err, "Error registrando llegada a destino", "error");
      showToast(info.message, info.type);
    } finally {
      setFieldVisitSubmitting(false);
    }
  };

  const handleSalidaDestino = async () => {
    if (!isFieldOperationFlow) {
      showToast("No tienes una salida operacional activa.", "warning");
      return;
    }
    if (destinationExitMode === "end_jornada") {
      setTripClosureReason(String(fieldVisitNotes || "").trim());
      openOperationalModal("close");
      return;
    }
    setFieldVisitSubmitting(true);
    let actionLocation = null;
    try {
      actionLocation = await getLocationForAction();
      const res = await updateExceptionStatus("ACTIVE", actionLocation);
      if (res?.ok) {
        await ensureSyncExceptionTargetLocation("departure", actionLocation);
        showToast("Salida del destino registrada. Puedes continuar con otra gestion.", "success");
        await refreshAll();
      } else {
        showToast("No se pudo registrar la salida del destino.", "error");
      }
    } catch (err) {
      const recovered = await resolveExceptionConflict("departure", actionLocation || cachedLocation || null);
      if (recovered) {
        showToast("La salida del destino ya existia. Estado operativo sincronizado.", "warning");
        await refreshAll();
        return;
      }
      const info = getAttendanceErrorInfo(err, "Error registrando salida del destino", "error");
      showToast(info.message, info.type);
    } finally {
      setFieldVisitSubmitting(false);
    }
  };

  const handleOperationalLunchMark = async (direction) => {
    if (!isFieldOperationFlow) {
      showToast("No tienes una salida operacional activa.", "warning");
      return;
    }

    setFieldVisitSubmitting(true);
    try {
      const actionLocation = await getLocationForAction();
      const res = direction === "out"
        ? await marcarAlmuerzoSalidaOperacional(actionLocation)
        : await marcarAlmuerzoEntradaOperacional(actionLocation);

      if (res?.ok) {
        showToast(
          direction === "out"
            ? "Salida a almuerzo operacional registrada."
            : "Regreso de almuerzo operacional registrado.",
          "success",
        );
        await refreshAll();
        return;
      }

      showToast("No se pudo registrar la marcacion operacional de almuerzo.", "error");
    } catch (err) {
      const info = getAttendanceErrorInfo(
        err,
        direction === "out"
          ? "Error registrando salida a almuerzo operacional"
          : "Error registrando regreso de almuerzo operacional",
        "error",
      );
      showToast(info.message, info.type);
    } finally {
      setFieldVisitSubmitting(false);
    }
  };

  const handleLlegadaDestinoConVisita = async () => {
    if (!isFieldOperationFlow) {
      showToast("No tienes una salida operacional activa.", "warning");
      return;
    }
    if (!activeOperationRequiresClientVisitFlow) {
      await handleLlegadaDestino();
      return;
    }

    setFieldVisitSubmitting(true);
    let actionLocation = null;
    try {
      actionLocation = await getLocationForAction();
      const arrivalRes = await marcarLlegadaDestino(actionLocation);
      if (!arrivalRes?.ok) {
        showToast("No se pudo registrar la llegada a destino.", "error");
        return;
      }

      const payload = await buildFieldVisitPayload({
        mode: "entry",
        locationOverride: actionLocation,
      });
      const visitRes = await marcarVisitaEntrada(payload);
      if (visitRes?.ok) {
        showToast("Llegada a destino y entrada a cliente registradas.", "success");
        setSelectedFieldAction("client_exit");
        await refreshAll();
        return;
      }

      showToast("La llegada a destino se registro, pero no la entrada a cliente.", "warning");
      await refreshAll();
    } catch (err) {
      const info = getAttendanceErrorInfo(err, "Error registrando llegada y entrada a cliente", "error");
      showToast(info.message, info.type);
    } finally {
      setFieldVisitSubmitting(false);
    }
  };

  const handleOvertimeSubmit = async () => {
    if (!overtimePrompt?.hours) {
      setOvertimePrompt(null);
      return;
    }

    const normalizedReason = String(overtimeReason || "").trim();
    if (!normalizedReason) {
      showToast("Debes registrar la razon de las horas extra.", "warning");
      return;
    }

    setOvertimeSubmitting(true);
    try {
      const res = await markOvertime(overtimePrompt.hours, normalizedReason, await getLocationForAction());
      if (res?.ok) {
        showToast("Horas extra registradas correctamente.", "success");
        setOvertimePrompt(null);
        setOvertimeReason("");
      } else {
        showToast("No se pudo registrar el overtime.", "error");
      }
    } catch (err) {
      console.error("Overtime registration error:", err);
      const info = getAttendanceErrorInfo(err, "Error registrando overtime", "error");
      showToast(info.message, info.type);
    } finally {
      setOvertimeSubmitting(false);
    }
  };

  const handleLateJustificationSubmit = async () => {
    const normalizedReason = String(lateJustificationReason || "").trim();
    if (normalizedReason.length < 8) {
      showToast("Describe una justificación de al menos 8 caracteres.", "warning");
      return;
    }

    setLateJustificationSubmitting(true);
    try {
      const res = await justifyLateArrival({
        reason: normalizedReason,
        date: attendance?.date || undefined,
      });
      if (res?.ok) {
        showToast("Justificación de atraso registrada.", "success");
        setLateJustificationModalOpen(false);
        setLateJustificationReason("");
        await refreshAll();
      } else {
        showToast("No se pudo registrar la justificación.", "error");
      }
    } catch (err) {
      console.error("Late justification error:", err);
      const info = getAttendanceErrorInfo(err, "Error registrando justificación", "error");
      showToast(info.message, info.type);
    } finally {
      setLateJustificationSubmitting(false);
    }
  };

  const handleEntryRegularization = async () => {
    const normalizedReason = String(entryRegularizationReason || "").trim();
    if (normalizedReason.length < 8) {
      showToast("Describe el motivo con al menos 8 caracteres.", "warning");
      return;
    }
    setEntryRegularizationLoading(true);
    try {
      const res = await requestEntryRegularization({ reason: normalizedReason });
      if (res?.ok) {
        showToast("Solicitud enviada a Talento Humano.", "success");
        setEntryRegularizationOpen(false);
        setEntryRegularizationReason("");
        setEntryRegularizationSent(true);
      } else {
        showToast(res?.message || "No se pudo enviar la solicitud.", "error");
      }
    } catch (err) {
      const info = getAttendanceErrorInfo(err, "Error enviando solicitud", "error");
      showToast(info.message, info.type);
    } finally {
      setEntryRegularizationLoading(false);
    }
  };

  const hasActiveException = Boolean(activeException);
  const isFieldOperationFlow = hasActiveException && isOperationalFlow(activeException);
  const isPermissionFlowActive = hasActiveException && !isFieldOperationFlow && isPermissionLikeException(activeException);
  const activeTimeOff = attendance?.active_time_off || null;
  const activeTimeOffPreset = mapActiveTimeOffToExceptionPreset(activeTimeOff);
  const hasActiveApprovedPermission = Boolean(activeTimeOffPreset);
  const permissionNeedsEntryStart = Boolean(
    hasActiveApprovedPermission &&
    !activeTimeOff?.is_upcoming &&
    !attendance?.entry_time &&
    !hasActiveException &&
    permissionCoincidesWithEntryStart(activeTimeOff)
  );
  const permissionNeedsExitClose = Boolean(
    isPermissionFlowActive &&
    permissionEndsWithWorkdayClose(activeTimeOff)
  );
  const permissionEndsAtEndOfDay = (() => {
    const endRaw = activeTimeOff?.fecha_fin_hora;
    if (!endRaw) return false;
    const d = toDate(endRaw);
    return d ? d.getHours() >= 18 : false;
  })();
  const permissionStartHour = (() => {
    const d = toDate(activeTimeOff?.fecha_inicio_hora);
    return d ? d.getHours() : null;
  })();
  // True when all normal flow steps before the permission have been completed
  const permissionFlowReady = hasActiveApprovedPermission &&
    !!attendance?.entry_time &&
    !attendance?.exit_time &&
    !(attendance?.lunch_start_time && !attendance?.lunch_end_time) && (
      Boolean(attendance?.lunch_end_time) || (permissionStartHour !== null && permissionStartHour < 14)
    );

  const progress = calculateProgress();
  const status = getStatusInfo();
  const latePolicy = attendance?.late_policy || null;
  const shouldPromptLateJustification = Boolean(latePolicy?.justification?.canJustify);
  const punctualityInsights = useMemo(() => {
    const historyRows = Array.isArray(recentHistory) ? recentHistory : [];
    const todayKey = attendance?.date || getLocalDateKey(new Date());
    const historyByDate = new Map(historyRows.map((row) => [normalizeDateKey(row?.date), row]));

    if (!historyByDate.has(todayKey)) {
      historyByDate.set(todayKey, {
        date: todayKey,
        entry_time: attendance?.entry_time || null,
        total_hours: attendance?.total_hours || null,
      });
    }

    const rows = [...historyByDate.values()]
      .filter((row) => normalizeDateKey(row?.date))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const streak = rows.reduce((acc, row) => {
      if (acc.broken) return acc;
      const metrics = getPunctualityState(row?.entry_time);
      if (metrics.state === "on_time") {
        acc.value += 1;
        return acc;
      }
      acc.broken = true;
      return acc;
    }, { value: 0, broken: false }).value;

    const ranked = rows
      .map((row) => {
        const punctuality = getPunctualityState(row?.entry_time);
        return {
          ...row,
          punctuality,
          dateKey: normalizeDateKey(row?.date),
          entryMinutes: getEcuadorEntryMinutes(row?.entry_time),
          totalHoursNumeric: Number(row?.total_hours || 0),
        };
      })
      .sort((a, b) => (
        b.punctuality.points - a.punctuality.points
        || a.entryMinutes - b.entryMinutes
        || b.totalHoursNumeric - a.totalHoursNumeric
        || String(b.dateKey || "").localeCompare(String(a.dateKey || ""))
      ));

    const myIndex = ranked.findIndex((row) => row.dateKey === todayKey);
    const position = myIndex >= 0 ? myIndex + 1 : null;
    const total = ranked.length || 1;

    let league = "Liga Enfocada";
    let vibe = "Sigues en carrera.";
    if (position === 1) {
      league = "Liga Leyenda";
      vibe = "Vas liderando con puntualidad de alto nivel.";
    } else if (position && position <= 3) {
      league = "Liga Pro";
      vibe = "Top de puntualidad. Mantén la racha.";
    } else if (streak >= 3) {
      league = "Modo Constancia";
      vibe = "Racha sólida, estás escalando el ranking.";
    }

    return {
      streak,
      position,
      total,
      league,
      vibe,
    };
  }, [attendance?.date, attendance?.entry_time, attendance?.total_hours, recentHistory]);

  useEffect(() => {
    const dateKey = attendance?.date || getLocalDateKey(new Date());
    if (!dateKey) return;
    const hasBlockingModalOpen = widgetModalOpen || exceptionModalOpen || Boolean(overtimePrompt);

    if (shouldPromptLateJustification && attendance?.entry_time) {
      const promptKey = `late-justif-prompt:${dateKey}`;
      const modalKey = `late-justif-modal-auto-open:${dateKey}`;
      const alreadyPrompted = window.localStorage.getItem(promptKey);
      if (!alreadyPrompted) {
        window.localStorage.setItem(promptKey, "1");
        showToast(
          `Tienes atraso mayor a 5 minutos. Puedes justificar hoy (${latePolicy?.justification?.remainingMonthly ?? 0} disponibles este mes).`,
          "warning"
        );
      }
      if (!hasBlockingModalOpen && !window.sessionStorage.getItem(modalKey)) {
        window.sessionStorage.setItem(modalKey, "1");
        setLateJustificationModalOpen(true);
      }
      return;
    }

    if (latePolicy?.countsAsLate) {
      const key = `late-justif-exhausted:${dateKey}`;
      const alreadyWarned = window.localStorage.getItem(key);
      if (!alreadyWarned) {
        window.localStorage.setItem(key, "1");
        showToast("El atraso cuenta en acta (sin regularización o sin cupo mensual).", "warning");
      }
    }
  }, [
    attendance?.entry_time,
    attendance?.date,
    exceptionModalOpen,
    latePolicy?.countsAsLate,
    latePolicy?.justification?.remainingMonthly,
    overtimePrompt,
    shouldPromptLateJustification,
    showToast,
    widgetModalOpen,
  ]);

  const exceptionStatus = activeException?.status || "NONE";
  const hasOpenFieldVisit = String(attendance?.active_field_visit?.status || "").trim().toLowerCase() === "in_visit";
  const activeOperationalCategory = String(activeException?.operational_category || "").trim().toLowerCase();
  const activeOperationRequiresClientVisitFlow = canUseFieldOperations && activeOperationalCategory === "cliente";
  const draftOperationRequiresClientVisitFlow = canUseFieldOperations && String(operationalCategory || "").trim().toLowerCase() === "cliente";

  useEffect(() => {
    if (isFieldOperationFlow) {
      if (exceptionStatus === "RETURNING") {
        if (selectedFieldAction !== "office_entry") {
          setSelectedFieldAction("office_entry");
        }
        return;
      }
      if (activeOperationRequiresClientVisitFlow) {
        if (hasOpenFieldVisit) {
          if (selectedFieldAction !== "client_exit") {
            setSelectedFieldAction("client_exit");
          }
          return;
        }
        if (selectedFieldAction === "office_exit" || selectedFieldAction === "office_entry") {
          setSelectedFieldAction("client_entry");
        }
      }
      return;
    }
    if (!isFieldOperationFlow && exceptionStatus === "NONE" && selectedFieldAction === "office_entry") {
      setSelectedFieldAction("office_exit");
    }
  }, [activeOperationRequiresClientVisitFlow, exceptionStatus, hasOpenFieldVisit, isFieldOperationFlow, selectedFieldAction]);

  const timeEntries = useMemo(() => {
    const baseEntries = [
      ["Entrada", attendance?.entry_time, "bg-emerald-50 border-emerald-200 text-emerald-800"],
      ["Salida Almuerzo", attendance?.lunch_start_time, "bg-orange-50 border-orange-200 text-orange-800"],
      ["Entrada Almuerzo", attendance?.lunch_end_time, "bg-blue-50 border-blue-200 text-blue-800"],
      ["Salida", attendance?.exit_time, "bg-indigo-50 border-indigo-200 text-indigo-800"],
    ].map(([label, time, colors]) => ({ label, value: time, colors }));

    if (!hasActiveException) {
      return baseEntries;
    }

    const isPermEx = isPermissionLikeException(activeException);
    const exceptionLabel = isPermEx ? "Salida permiso" : "Salida o visita";

    if (isPermEx) {
      return [
        ...baseEntries,
        {
          label: exceptionLabel,
          value: activeException.start_time,
          colors: "bg-sky-50 border-sky-200 text-sky-800",
          note: activeException.type === "medico" ? "SALUD" : "PERMISO",
        },
        {
          label: "Regreso permiso",
          value: activeException.return_time || activeException.end_time,
          colors: "bg-emerald-50 border-emerald-200 text-emerald-800",
          note: activeException.status === "COMPLETED" ? "Completado" : "Pendiente",
        },
      ];
    }

    return [
      ...baseEntries,
      {
        label: exceptionLabel,
        value: activeException.start_time,
        colors: "bg-amber-50 border-amber-200 text-amber-800",
        note: activeException.type ? activeException.type.replace(/_/g, " ").toUpperCase() : "Sin motivo",
      },
      {
        label: "Arribo a destino",
        value: activeException.arrival_time,
        colors: "bg-orange-50 border-orange-200 text-orange-800",
        note: activeException.status === "ON_SITE" ? "Llegaste" : "Pendiente",
      },
      {
        label: "Salida del destino",
        value: activeException.departure_time,
        colors: "bg-yellow-50 border-yellow-200 text-yellow-800",
        note: activeException.status === "RETURNING" ? "Regresando" : "Pendiente",
      },
      {
        label: "Regreso a oficina",
        value: activeException.return_time,
        colors: "bg-emerald-50 border-emerald-200 text-emerald-800",
        note: activeException.status === "COMPLETED" ? "Completado" : "Pendiente",
      },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeException?.arrival_time,
    activeException?.departure_time,
    activeException?.end_time,
    activeException?.return_time,
    activeException?.start_time,
    activeException?.status,
    activeException?.type,
    attendance?.entry_time,
    attendance?.exit_time,
    attendance?.lunch_end_time,
    attendance?.lunch_start_time,
    hasActiveException,
    isFieldOperationFlow,
  ]);

  const timelineSteps = useMemo(() => {
    const firstPendingIndex = timeEntries.findIndex((entry) => !entry.value);

    return timeEntries.map((entry, index) => {
      let state = "upcoming";
      if (entry.value) {
        state = "done";
      } else if (firstPendingIndex === index) {
        state = "current";
      }

      return {
        ...entry,
        state,
      };
    });
  }, [timeEntries]);

  const dayStatusBadge = hasActiveException
    ? "bg-amber-100 text-amber-900 border-amber-200"
    : attendance?.exit_time
      ? "bg-indigo-100 text-indigo-900 border-indigo-200"
      : attendance?.entry_time
        ? "bg-blue-100 text-blue-900 border-blue-200"
        : "bg-emerald-100 text-emerald-900 border-emerald-200";

  const tripSteps = useMemo(() => ([
    {
      key: "office_departure",
      label: "Salida de oficina",
      time: activeException?.start_time || null,
      state: activeException?.start_time ? "done" : "current",
    },
    {
      key: "destination_arrival",
      label: "Llegada a destino",
      time: activeException?.arrival_time || null,
      state: activeException?.arrival_time
        ? "done"
        : exceptionStatus === "ACTIVE"
          ? "current"
          : "pending",
    },
    {
      key: "destination_departure",
      label: "Salida del destino",
      time: activeException?.departure_time || null,
      state: activeException?.departure_time
        ? "done"
        : exceptionStatus === "ON_SITE"
          ? "current"
          : "pending",
    },
    {
      key: "office_arrival",
      label: "Llegada a oficina",
      time: activeException?.return_time || null,
      state: activeException?.return_time
        ? "done"
        : exceptionStatus === "RETURNING"
          ? "current"
          : "pending",
    },
  ]), [
    activeException?.arrival_time,
    activeException?.departure_time,
    activeException?.return_time,
    activeException?.start_time,
    exceptionStatus,
  ]);

  const operationalLunchState = useMemo(() => {
    if (!isFieldOperationFlow) return { visible: false, next: null, completed: false };
    const hasLunchOut = Boolean(activeException?.op_lunch_start_time);
    const hasLunchIn = Boolean(activeException?.op_lunch_end_time);
    return {
      visible: true,
      hasLunchOut,
      hasLunchIn,
      completed: hasLunchOut && hasLunchIn,
      next: !hasLunchOut ? "out" : !hasLunchIn ? "in" : null,
    };
  }, [activeException?.op_lunch_end_time, activeException?.op_lunch_start_time, isFieldOperationFlow]);

  const renderOperationalLunchCard = () => {
    if (!operationalLunchState.visible) return null;

    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Almuerzo operacional opcional</p>
            <p className="mt-1 text-sm text-amber-800">
              Estas marcaciones solo dejan trazabilidad real. El acta sigue regularizada a las 14:00 y 15:00.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-amber-900">
              <span className="rounded-full bg-white/80 px-2 py-1">
                Salida: {activeException?.op_lunch_start_time ? formatTimeSafe(activeException.op_lunch_start_time) : "--"}
              </span>
              <span className="rounded-full bg-white/80 px-2 py-1">
                Regreso: {activeException?.op_lunch_end_time ? formatTimeSafe(activeException.op_lunch_end_time) : "--"}
              </span>
            </div>
          </div>
          {operationalLunchState.completed ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
              Completo
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
              Opcional
            </span>
          )}
        </div>

        {operationalLunchState.next ? (
          <Button
            variant={operationalLunchState.next === "out" ? "warning" : "primary"}
            onClick={() => handleOperationalLunchMark(operationalLunchState.next)}
            disabled={fieldVisitSubmitting}
            className={`mt-3 ${operationalLunchState.next === "out" ? ACTION_BTN_NEUTRAL_CLASS : ACTION_BTN_BASE_CLASS}`}
          >
            {fieldVisitSubmitting
              ? "Registrando..."
              : operationalLunchState.next === "out"
                ? "Salida a almuerzo operacional"
                : "Regreso de almuerzo operacional"}
          </Button>
        ) : null}
      </div>
    );
  };

  const nextActionMeta = useMemo(() => {
    if (isFieldOperationFlow) {
      if (exceptionStatus === "RETURNING") {
        return {
          label: "Llegada a oficina nuevamente",
          detail: "Cierra la salida operacional cuando regreses a la oficina.",
        };
      }

      if (exceptionStatus === "ON_SITE") {
        return {
          label: "Salida del destino",
          detail: "Registra la salida cuando termines la gestion en el destino.",
        };
      }

      return {
        label: "Llegada a destino",
        detail: "Confirma la llegada cuando completes el traslado.",
      };
    }

    if (isPermissionFlowActive) {
      return {
        label: permissionNeedsExitClose ? "Salida del permiso y jornada" : "Entrada de permiso",
        detail: permissionNeedsExitClose
          ? "Este permiso coincide con el cierre de jornada. Esta accion registra ambas marcaciones."
          : "Registra el regreso cuando termine el permiso aprobado.",
      };
    }

    if (permissionNeedsEntryStart) {
      return {
        label: "Entrada + salida a permiso",
        detail: "Tu permiso coincide con el inicio de jornada. Esta accion registra ambas marcaciones.",
      };
    }

    if (hasActiveApprovedPermission && !hasActiveException) {
      return {
        label: activeTimeOffPreset?.actionLabel || "Salida a permiso",
        detail: "Tienes un permiso aprobado activo. Registra tu salida para iniciar el permiso.",
      };
    }

    if (attendance?.exit_time) {
      return {
        label: "Sin acciones pendientes",
        detail: "La jornada de hoy ya fue completada.",
      };
    }

    if (attendance?.lunch_start_time && !attendance?.lunch_end_time) {
      return {
        label: "Regresar de almuerzo",
        detail: "Solo falta registrar el retorno del almuerzo.",
      };
    }

    if (attendance?.lunch_end_time) {
      return {
        label: "Finalizar jornada",
        detail: "Solo falta registrar tu salida final.",
      };
    }

    if (!attendance?.entry_time) {
      return {
        label: "Marcar entrada",
        detail: "Tu jornada inicia con la entrada.",
      };
    }

    return {
      label: "Salir a almuerzo",
      detail: "Tu siguiente paso operativo es registrar la salida a almuerzo.",
    };
  }, [
    attendance?.entry_time,
    attendance?.exit_time,
    attendance?.lunch_end_time,
    attendance?.lunch_start_time,
    exceptionStatus,
    hasActiveApprovedPermission,
    hasActiveException,
    isPermissionFlowActive,
    isFieldOperationFlow,
    permissionNeedsEntryStart,
    permissionNeedsExitClose,
    activeTimeOffPreset?.actionLabel,
  ]);

  // Fase 4 (Plan Maestro Asistencia): bandeja de pendientes derivada del mismo
  // payload de getTodayAttendance() (canonical_flow + late_policy), sin endpoint nuevo.
  const pendingActions = useMemo(() => resolveAttendancePendingActions(attendance || {}), [attendance]);

  const TripStep = ({ label, time, state }) => {
    const isDone = state === "done";
    const isCurrent = state === "current";

    return (
      <div className={`flex items-start gap-3 py-1.5 ${isDone ? "opacity-100" : isCurrent ? "opacity-100" : "opacity-45"}`}>
        <div
          className={`mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full border-2 ${
            isDone
              ? "border-emerald-500 bg-emerald-500"
              : isCurrent
                ? "border-blue-500 bg-blue-100"
                : "border-slate-300 bg-white"
          }`}
        />
        <div className="min-w-0">
          <p
            className={`text-[11px] font-semibold ${
              isDone
                ? "text-emerald-800"
                : isCurrent
                  ? "text-blue-800"
                  : "text-slate-400"
            }`}
          >
            {label}
          </p>
          {time ? <p className="text-[10px] text-slate-500">{formatTimeSafe(time)}</p> : null}
        </div>
      </div>
    );
  };

  const renderFieldOperationsControls = () => {
    const tripTypeLabel = String(activeException?.type || "operacion_campo").replace(/_/g, " ").trim();
    const elapsedHours = Number(activeException?.operational_elapsed_hours || 0);
    const canUseAdvancedFieldFlow = canUseFieldOperations;

    const renderAgendaPanel = () => {
      if (!plannedVisitAgenda.length) return null;

      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Cronograma del dia
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {plannedVisitAgenda.length} actividad{plannedVisitAgenda.length === 1 ? "" : "es"}
            </span>
          </div>
          <div className="space-y-2">
            {plannedVisitAgenda.slice(0, 3).map((item) => {
              const visitMeta = getPlannedVisitTypeMeta({
                isCommercial: item?.isCommercial,
                isTechnical: item?.isTechnical,
              });
              return (
                <div key={`${item.id}-${item.plannedDate}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{item.city}</p>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${visitMeta.badgeClass}`}>
                      {visitMeta.label}
                    </span>
                  </div>
                  {item.notes ? (
                    <p className="mt-2 text-xs leading-5 text-slate-600">{item.notes}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    if (!isFieldOperationFlow && hasActiveException) {
      const normalizedUnexpectedStatus = String(activeException?.status || "ACTIVE").trim().toUpperCase();
      const exceptionTypeLabel =
        activeException?.type === "medico"
          ? "Permiso de salud"
          : activeException?.type === "permiso"
            ? "Permiso aprobado"
            : String(activeException?.type || "salida").replace(/_/g, " ");

      const genericUnexpectedAction =
        normalizedUnexpectedStatus === "ACTIVE"
          ? {
              label: "Llegada a destino",
              action: () => handleExceptionUpdate("ON_SITE", "Llegada registrada correctamente."),
            }
          : normalizedUnexpectedStatus === "ON_SITE"
            ? {
                label: "Iniciar retorno",
                action: () => handleExceptionUpdate("RETURNING", "Retorno registrado correctamente."),
              }
            : {
                label: "Regreso final",
                action: () => handleExceptionUpdate("COMPLETED", "Regreso registrado correctamente."),
              };

      return (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm">
            <div className="flex items-center justify-between bg-sky-700 px-4 py-3">
              <div className="flex items-center gap-2">
                <FiTrendingUp size={14} className="text-white" />
                <span className="text-sm font-bold uppercase tracking-wide text-white">
                  {isPermissionFlowActive ? "Permiso en curso" : "Salida en curso"}
                </span>
              </div>
              <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-semibold text-white capitalize">
                {exceptionTypeLabel}
              </span>
            </div>
            <div className="space-y-4 p-4">
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
                <p className="text-sm text-sky-800">
                  {isPermissionFlowActive
                    ? "El permiso aprobado ya fue iniciado. Registra la entrada cuando termine."
                    : "Tienes una salida no operacional activa. Continúa el flujo desde aquí."}
                </p>
                {activeException?.start_time ? (
                  <p className="mt-2 font-mono text-xs text-sky-700">
                    Salida: {formatTimeSafe(activeException.start_time, "HH:mm")}
                    {activeException?.start_location
                      ? <span className="ml-2 text-sky-500">· {String(activeException.start_location).split(",").map(c => Number(c).toFixed(4)).join(", ")}</span>
                      : null}
                  </p>
                ) : null}
              </div>
              <Button
                variant={isPermissionFlowActive ? "primary" : "success"}
                onClick={
                  isPermissionFlowActive
                    ? async () => {
                        if (permissionNeedsExitClose) {
                          await handleFinishPermissionWithExit();
                          return;
                        }
                        await handleExceptionUpdate(
                          "COMPLETED",
                          permissionEndsAtEndOfDay
                            ? "Permiso finalizado. Tu jornada laboral ha concluido, recuerda registrar tu salida."
                            : "Permiso finalizado. Ya puedes continuar tu jornada."
                        );
                      }
                    : genericUnexpectedAction.action
                }
                disabled={loading || fieldVisitSubmitting}
                className={ACTION_BTN_BASE_CLASS}
              >
                {loading || fieldVisitSubmitting
                  ? "Registrando..."
                  : isPermissionFlowActive
                    ? (permissionNeedsExitClose ? "Finalizar permiso y jornada" : "Finalizar permiso")
                    : genericUnexpectedAction.label}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (!isFieldOperationFlow) {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <FiTrendingUp size={14} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Salida operacional</p>
                <p className="text-xs text-slate-500">
                  {canUseAdvancedFieldFlow
                    ? "Personal de campo autorizado puede vincular la salida con visitas, clientes y cronograma."
                    : "Inicia el flujo general de salida, destino, retorno y llegada a oficina."}
                </p>
              </div>
            </div>
          </div>
          {canUseAdvancedFieldFlow ? renderAgendaPanel() : null}
          <Button
            variant="primary"
            onClick={handleOfficeDepartureQuick}
            disabled={fieldVisitSubmitting}
            className={ACTION_BTN_BASE_CLASS}
          >
            {fieldVisitSubmitting ? "Registrando..." : "Salida de oficina"}
          </Button>
        </div>
      );
    }

    if (exceptionStatus === "ACTIVE") {
      const clientEntryDisabled =
        fieldVisitSubmitting ||
        (fieldVisitType === "cronograma" && !fieldClientId) ||
        (fieldVisitType === "prospecto" && !fieldProspectName.trim()) ||
        (fieldVisitType === "emergencia" && (!fieldEmergencyClientId || !String(fieldEmergencyReason || "").trim()));

      return (
        <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm">
          <div className="flex items-center justify-between bg-sky-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <FiTrendingUp size={14} className="text-white" />
              <span className="text-sm font-bold uppercase tracking-wide text-white">Salida operacional en curso</span>
            </div>
            <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-semibold text-white capitalize">
              {tripTypeLabel}
            </span>
          </div>
          <div className="space-y-4 p-4">
            <div className="rounded-xl bg-sky-50/70 p-3">
              {tripSteps.slice(0, 2).map((step) => (
                <TripStep key={step.key} label={step.label} time={step.time} state={step.state} />
              ))}
            </div>
            {renderOperationalLunchCard()}
            {activeOperationRequiresClientVisitFlow ? (
              <>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-800">
                    Estas en camino al destino. Al llegar, registra en una sola accion la llegada y la entrada al cliente.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  {renderClientPickerSection({ title: "Destino y visita a cliente", stepLabel: "Paso 1" })}
                </div>
                <Button
                  variant="success"
                  onClick={handleLlegadaDestinoConVisita}
                  disabled={clientEntryDisabled}
                  className={ACTION_BTN_BASE_CLASS}
                >
                  {fieldVisitSubmitting ? "Registrando..." : "Llegada a destino y entrada a cliente"}
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-800">Estas en camino al destino. Registra la llegada cuando completes el traslado.</p>
                </div>
                <Button
                  variant="success"
                  onClick={handleLlegadaDestino}
                  disabled={fieldVisitSubmitting}
                  className={ACTION_BTN_BASE_CLASS}
                >
                  {fieldVisitSubmitting ? "Registrando..." : "Llegada a destino"}
                </Button>
              </>
            )}
          </div>
        </div>
      );
    }

    if (exceptionStatus === "ON_SITE") {
      const clientEntryDisabled =
        fieldVisitSubmitting ||
        (fieldVisitType === "cronograma" && !fieldClientId) ||
        (fieldVisitType === "prospecto" && !fieldProspectName.trim()) ||
        (fieldVisitType === "emergencia" && (!fieldEmergencyClientId || !String(fieldEmergencyReason || "").trim()));

      return (
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
          <div className="flex items-center justify-between bg-emerald-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <FiCheckCircle size={14} className="text-white" />
              <span className="text-sm font-bold uppercase tracking-wide text-white">Gestion en destino</span>
            </div>
            {elapsedHours > 0 ? (
              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                {elapsedHours.toFixed(1)} h
              </span>
            ) : null}
          </div>
          <div className="space-y-4 p-4">
            <div className="rounded-xl bg-emerald-50/70 p-3">
              {tripSteps.slice(0, 3).map((step) => (
                <TripStep key={step.key} label={step.label} time={step.time} state={step.state} />
              ))}
            </div>
            {renderOperationalLunchCard()}

            {activeOperationRequiresClientVisitFlow ? (
              hasOpenFieldVisit ? (
                <>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-800">Tienes una visita de cliente abierta. Cierrala antes de continuar.</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                    <label className="text-[11px] font-semibold text-slate-600">Despues de salir del cliente</label>
                    <select
                      value={fieldExitMode}
                      onChange={(e) => setFieldExitMode(e.target.value)}
                      className={`${CONTROL_INPUT_CLASS} mt-2`}
                      aria-label="Accion despues de salir del cliente"
                    >
                      <option value="continue_operation">Continuar operacion (puede ir a otro cliente)</option>
                      <option value="end_jornada">Terminar operacion en este destino</option>
                    </select>
                  </div>
                  <Button
                    variant="warning"
                    onClick={() => handleFieldVisitMark("exit")}
                    disabled={fieldVisitSubmitting}
                    className={ACTION_BTN_BASE_CLASS}
                  >
                    {fieldVisitSubmitting ? "Registrando..." : "Salida de cliente"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-700">Registra la visita al cliente o prospecto en este destino.</p>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    {renderClientPickerSection({ title: "Tipo de visita a cliente", stepLabel: "Paso 1" })}
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => handleFieldVisitMark("entry")}
                    disabled={clientEntryDisabled}
                    className={ACTION_BTN_BASE_CLASS}
                  >
                    {fieldVisitSubmitting ? "Registrando..." : "Entrada a cliente"}
                  </Button>
                  <div className="h-px bg-slate-100" />
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <label className="text-[11px] font-semibold text-slate-600">Si no registraras cliente en este destino</label>
                    <select
                      value={destinationExitMode}
                      onChange={(e) => setDestinationExitMode(e.target.value)}
                      className={`${CONTROL_INPUT_CLASS} mt-2`}
                      aria-label="Accion despues de salir del destino sin cliente"
                    >
                      <option value="continue_operation">Seguir con otra salida operacional</option>
                      <option value="end_jornada">Terminar operacion en este destino</option>
                    </select>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={handleSalidaDestino}
                    disabled={fieldVisitSubmitting}
                    className={ACTION_BTN_NEUTRAL_CLASS}
                  >
                    {destinationExitMode === "continue_operation"
                      ? "Salir del destino y continuar"
                      : "Terminar operacion sin cliente"}
                  </Button>
                </>
              )
            ) : (
              <>
                <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
                  <p className="text-sm text-sky-800">La gestion sigue activa en el destino. Indica si vas a continuar con otra salida operacional o si aqui termina la operacion.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <label className="text-[11px] font-semibold text-slate-600">Despues de salir del destino</label>
                  <select
                    value={destinationExitMode}
                    onChange={(e) => setDestinationExitMode(e.target.value)}
                    className={`${CONTROL_INPUT_CLASS} mt-2`}
                    aria-label="Accion despues de salir del destino"
                  >
                    <option value="continue_operation">Seguir con otra salida operacional</option>
                    <option value="end_jornada">Terminar operacion en este destino</option>
                  </select>
                </div>
                <Button
                  variant="warning"
                  onClick={handleSalidaDestino}
                  disabled={fieldVisitSubmitting}
                  className={ACTION_BTN_BASE_CLASS}
                >
                  {fieldVisitSubmitting
                    ? "Registrando..."
                    : destinationExitMode === "continue_operation"
                      ? "Salida del destino y continuar"
                      : "Terminar operacion desde aqui"}
                </Button>
              </>
            )}
          </div>
        </div>
      );
    }

    if (exceptionStatus === "RETURNING") {
      return (
        <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
          <div className="flex items-center justify-between bg-indigo-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <FiClock size={14} className="text-white" />
              <span className="text-sm font-bold uppercase tracking-wide text-white">Retorno en curso</span>
            </div>
            {elapsedHours > 0 ? (
              <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                {elapsedHours.toFixed(1)} h total
              </span>
            ) : null}
          </div>
          <div className="space-y-4 p-4">
            <div className="rounded-xl bg-indigo-50/60 p-3">
              {tripSteps.map((step) => (
                <TripStep key={step.key} label={step.label} time={step.time} state={step.state} />
              ))}
            </div>
            {renderOperationalLunchCard()}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
              <p className="text-sm text-indigo-800">Ya saliste del destino. Solo falta registrar la llegada final a oficina.</p>
            </div>
            <Button
              variant="success"
              onClick={handleOfficeArrivalQuick}
              disabled={fieldVisitSubmitting}
              className={ACTION_BTN_BASE_CLASS}
            >
              {fieldVisitSubmitting ? "Registrando..." : "Llegada a oficina nuevamente"}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <FiCheckCircle size={14} className="text-emerald-600" />
          <span className="text-xs font-bold uppercase tracking-wide text-emerald-800">Salida operacional completada</span>
        </div>
        <div className="space-y-0.5">
          {tripSteps.map((step) => (
            <TripStep key={step.key} label={step.label} time={step.time} state={step.state} />
          ))}
        </div>
        <p className="mt-3 text-xs text-emerald-700">La salida operacional fue cerrada correctamente.</p>
      </div>
    );
  };

  const launcherMode = attendance?.exit_time
    ? "exit_marked"
    : attendance?.lunch_start_time && !attendance?.lunch_end_time
      ? "lunch_marked"
      : attendance?.lunch_end_time
        ? "return_marked"
        : !attendance?.entry_time
          ? "pending_entry"
          : "entry_marked";
  const launcherColorClass = launcherMode === "lunch_marked"
    ? "bg-amber-500 hover:bg-amber-600"
    : launcherMode === "return_marked"
      ? "bg-blue-600 hover:bg-blue-700"
      : launcherMode === "exit_marked"
        ? "bg-slate-700 hover:bg-slate-800"
        : launcherMode === "entry_marked"
          ? "bg-emerald-600 hover:bg-emerald-700"
          : "bg-primary hover:bg-primary-dark";
  const LauncherIcon = launcherMode === "lunch_marked"
    ? FiCoffee
    : launcherMode === "return_marked"
      ? FiClock
      : launcherMode === "exit_marked"
        ? FiMoon
        : launcherMode === "entry_marked"
          ? FiSun
          : FiClock;

  const renderWidgetContent = () => {
    const isOnLunch = attendance?.lunch_start_time && !attendance?.lunch_end_time;
    const isDayComplete = !!attendance?.exit_time;
    const hasEntry = !!attendance?.entry_time;
    const hasRecordedFlow = hasEntry || Boolean(attendance?.lunch_start_time) || Boolean(attendance?.lunch_end_time);
    const ecCurrentMins = getEcuadorEntryMinutes(currentTime);
    const isEntryCutoffPassed = !hasRecordedFlow && !isDayComplete && ecCurrentMins >= ENTRY_MARK_CUTOFF_MINUTES;
    const elapsedMins = hasEntry && !isDayComplete
      ? getElapsedMinutes(attendance.entry_time, currentTime)
      : 0;
    const elapsedDisplay = elapsedMins >= 60
      ? `${Math.floor(elapsedMins / 60)}h ${elapsedMins % 60}m`
      : `${elapsedMins}m`;

    const statusIconBg = hasActiveException
      ? "bg-amber-100 text-amber-700"
      : isDayComplete
        ? "bg-slate-200 text-slate-600"
        : isOnLunch
          ? "bg-amber-100 text-amber-700"
          : hasEntry
            ? "bg-green-100 text-green-700"
            : "bg-slate-100 text-slate-500";

    const primaryBtnClass = isEntryCutoffPassed
      ? "bg-amber-500 hover:bg-amber-600 text-white"
      : isOnLunch
        ? "bg-blue-600 hover:bg-blue-700 text-white"
        : attendance?.lunch_end_time
          ? "bg-[#1E293B] hover:bg-[#0F172A] text-white"
          : !hasEntry
            ? "bg-green-600 hover:bg-green-700 text-white"
            : "bg-amber-500 hover:bg-amber-600 text-white";

    const primaryBtnLabel = loading
      ? "Registrando..."
      : locationLoading
        ? "Obteniendo ubicacion..."
        : permissionNeedsEntryStart
          ? "Entrada + salida a permiso"
        : isEntryCutoffPassed
          ? "Salida al almuerzo"
          : isOnLunch
            ? "Retorno del almuerzo"
            : attendance?.lunch_end_time
              ? "Finalizar jornada"
              : !hasEntry
                ? "Registrar entrada"
                : "Salida al almuerzo";

    doClockOutRef.current = () => handle(clockOut, "Buen trabajo!", true, {
      syncTarget: "exit",
      onSuccess: async (res) => {
        if (Number(res?.overtime?.hours || 0) > 0) {
          setOvertimePrompt({ hours: Number(res.overtime.hours) });
          setOvertimeReason("");
        }
      },
    });

    const handlePrimaryAction = isEntryCutoffPassed
      ? permissionNeedsEntryStart
        ? handleStartPermissionWithEntry
        : () => handle(clockOutLunch, "Buen provecho", false, { syncTarget: "lunch_start" })
      : isOnLunch
        ? () => handle(clockInLunch, "Regresaste del almuerzo", false, { syncTarget: "lunch_end" })
        : permissionNeedsEntryStart
          ? handleStartPermissionWithEntry
        : attendance?.lunch_end_time
          ? () => setExitConfirmOpen(true)
          : !hasEntry
            ? () => handle(clockIn, "Entrada registrada", false, { syncTarget: "entry" })
            : () => handle(clockOutLunch, "Buen provecho", false, { syncTarget: "lunch_start" });

    return (
      <div>
        {/* HEADER: fecha + estado + reloj */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${statusIconBg}`}>
              {status.icon}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-slate-600">
                {formatDateSafe(attendance?.date || new Date(), "dd/MM/yyyy")}
              </span>
              <span className="text-slate-200">|</span>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${dayStatusBadge}`}>
                {isPermissionFlowActive ? "Permiso en curso" : hasActiveException ? "Excepción activa" : status.text}
              </span>
            </div>
          </div>
          <span className="font-mono text-sm font-bold text-slate-700 tabular-nums">
            {formatTimeSafe(currentTime, "HH:mm:ss")}
          </span>
        </div>

        {/* ESTADO OPERACIONAL */}
        <div className={`px-4 py-4 sm:px-5 ${hasActiveException ? "bg-amber-50" : isDayComplete ? "bg-slate-50" : isOnLunch ? "bg-amber-50" : hasEntry ? "bg-emerald-50/50" : "bg-white"}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Estado actual</div>
              <div className="mt-0.5 text-xl font-semibold text-slate-900">{status.text}</div>
              {hasEntry && !isDayComplete && (
                <div className="mt-0.5 font-mono text-sm text-slate-500">{elapsedDisplay} en jornada</div>
              )}
              {attendance?.entry_time && (
                <div className="mt-1 font-mono text-xs text-slate-400">
                  Entrada: {formatTime(attendance.entry_time)}
                  {attendance?.exit_time && ` · Salida: ${formatTime(attendance.exit_time)}`}
                </div>
              )}
            </div>
            <div className="min-w-0 sm:text-right">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Siguiente acción</div>
              <div className="mt-0.5 text-sm font-bold text-slate-800">{nextActionMeta.label}</div>
              {nextActionMeta.detail && (
                <p className="mt-0.5 text-xs leading-4 text-slate-500 sm:ml-auto sm:max-w-[200px]">{nextActionMeta.detail}</p>
              )}
            </div>
          </div>

          {hasEntry && !isDayComplete && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Progreso de jornada</span>
                <span className="font-mono text-xs font-bold text-slate-500">{progress}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-black/8">
                <div
                  style={{ width: `${progress}%`, transition: "width 600ms cubic-bezier(0.23,1,0.32,1)" }}
                  className={`h-full rounded-full ${isOnLunch ? "bg-amber-400" : "bg-emerald-500"}`}
                />
              </div>
            </div>
          )}

          {pendingActions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pendingActions.map((item) => (
                <span
                  key={item.id}
                  title={item.detail}
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    item.severity === "warning"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-sky-100 text-sky-800"
                  }`}
                >
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ACTION ZONE */}
        <div className="px-4 py-4 sm:px-5">
          {reminderMessage && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">Aviso operativo</div>
              <div className="mt-0.5 text-sm text-amber-900">{reminderMessage}</div>
            </div>
          )}

          {latePolicy?.isLate && (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-rose-700">Atraso registrado</div>
              <div className="mt-0.5 text-sm text-rose-900">
                {latePolicy.lateMinutes} min (tolerancia {latePolicy.toleranceMinutes} min tras 09:00).
              </div>
              <div className="mt-0.5 text-xs text-rose-700">
                {latePolicy?.justification?.exists
                  ? "Justificación registrada."
                  : attendance?.entry_time
                    ? `Cupo mensual disponible: ${latePolicy?.justification?.remainingMonthly ?? 0} / ${latePolicy?.monthlyLimit ?? 5}.`
                    : "Marca la entrada y luego justifica el atraso."}
              </div>
              {!latePolicy?.justification?.exists && shouldPromptLateJustification && (
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="danger"
                    onClick={openLateJustificationFlow}
                    disabled={!attendance?.entry_time}
                    className="min-h-[44px] text-sm active:scale-[0.98] [touch-action:manipulation]"
                  >
                    {attendance?.entry_time ? "Justificar atraso" : "Entrada pendiente"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {isEntryCutoffPassed && (
            <div className="mb-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-orange-700">Entrada bloqueada — 09:20</div>
              <div className="mt-0.5 text-sm text-orange-900">
                El plazo para marcar entrada ya paso. Tu siguiente accion es salir a almuerzo.
                Solicita a Talento Humano que regularice tu entrada de hoy.
              </div>
              {!latePolicy?.entryPendingRegularization && !entryRegularizationSent ? (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setEntryRegularizationOpen(true)}
                    className="min-h-[44px] rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 active:scale-[0.98] [touch-action:manipulation]"
                  >
                    Solicitar regularizacion
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-orange-700">
                  <FiCheckCircle size={12} />
                  Solicitud enviada a Talento Humano.
                </div>
              )}
            </div>
          )}

          {isDayComplete ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
                <FiCheckCircle size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">Jornada completada</div>
                <div className="font-mono text-xs text-slate-500">Salida registrada: {formatTime(attendance.exit_time)}</div>
              </div>
            </div>
          ) : !hasActiveException && (
            <div className="space-y-2">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Acción requerida
              </div>
              <button
                type="button"
                onClick={handlePrimaryAction}
                disabled={loading || locationLoading}
                className={`min-h-[52px] w-full rounded-xl px-5 py-3 text-base font-semibold shadow-sm transition-colors active:scale-[0.98] disabled:opacity-60 ${primaryBtnClass}`}
                style={{ touchAction: "manipulation" }}
              >
                {primaryBtnLabel}
              </button>
              {permissionFlowReady && (
                <button
                  type="button"
                  onClick={handleStartApprovedPermission}
                  disabled={loading || locationLoading}
                  className="min-h-[44px] w-full rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 active:scale-[0.98] disabled:opacity-60"
                  style={{ touchAction: "manipulation" }}
                >
                  {loading ? "Registrando..." : (
                    activeTimeOff?.is_upcoming
                      ? `Salida al permiso · ${formatTimeSafe(activeTimeOff.fecha_inicio_hora, "HH:mm")}`
                      : (activeTimeOffPreset?.actionLabel || "Salida al permiso")
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ACCORDIONS */}
        <div className="border-t border-slate-100">
          <div className="divide-y divide-slate-100">

            {/* Jornada del día */}
            <div>
              <button
                type="button"
                onClick={() => setShowTimelineDetails((prev) => !prev)}
                className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50 sm:px-5"
              >
                <div className="flex items-center gap-2.5">
                  <FiClock size={14} className="flex-shrink-0 text-slate-400" />
                  <div>
                    <span className="text-xs font-semibold text-slate-700">Jornada del día</span>
                    <span className="ml-2 text-[10px] text-slate-400">
                      {timeEntries.filter((e) => e.value).length}/{timeEntries.length} marcas
                    </span>
                  </div>
                </div>
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-slate-400">
                  {showTimelineDetails ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                </span>
              </button>
              {showTimelineDetails && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-5">
                  <div className="space-y-1">
                    {timelineSteps.map((entry, index) => (
                      <div
                        key={`${entry.label}-${entry.value ?? "pending"}`}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                          entry.state === "done"
                            ? "bg-emerald-50"
                            : entry.state === "current"
                              ? "bg-blue-50"
                              : "bg-slate-50"
                        }`}
                      >
                        <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                          entry.state === "done"
                            ? "bg-emerald-500 text-white"
                            : entry.state === "current"
                              ? "bg-blue-500 text-white"
                              : "bg-slate-200 text-slate-500"
                        }`}>
                          {entry.state === "done" ? <FiCheckCircle size={10} /> : index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={`text-xs font-semibold ${
                            entry.state === "done" ? "text-emerald-800" : entry.state === "current" ? "text-blue-800" : "text-slate-400"
                          }`}>{entry.label}</span>
                          {entry.note && (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400">{entry.note}</span>
                          )}
                        </div>
                        <span className={`flex-shrink-0 font-mono text-sm font-bold ${
                          entry.state === "done" ? "text-emerald-700" : entry.state === "current" ? "text-blue-600" : "text-slate-300"
                        }`}>
                          {formatTime(entry.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Salidas laborales y visitas */}
            <div>
              <button
                type="button"
                onClick={() => setShowFieldTools((prev) => !prev)}
                className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50 sm:px-5"
              >
                <div className="flex items-center gap-2.5">
                  <FiTrendingUp size={14} className="flex-shrink-0 text-slate-400" />
                  <div>
                    <span className="text-xs font-semibold text-slate-700">Salidas y visitas</span>
                    {isFieldOperationFlow && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                        Activo
                      </span>
                    )}
                  </div>
                </div>
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-slate-400">
                  {showFieldTools ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                </span>
              </button>
              {showFieldTools && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-5">
                  {renderFieldOperationsControls()}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* PUNTUALIDAD + HISTORIAL */}
        <div className="border-t border-slate-100 px-4 pb-6 pt-4 sm:px-5">
          <div className="mb-4 flex items-center justify-between py-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Puntualidad</div>
              <div className="mt-0.5 text-sm font-bold text-slate-800">{punctualityInsights.league}</div>
              <div className="text-xs text-slate-500">{punctualityInsights.vibe}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl font-black text-slate-800 tabular-nums">{punctualityInsights.streak}</div>
              <div className="text-[10px] text-slate-400">
                día{punctualityInsights.streak !== 1 ? "s" : ""} de racha
              </div>
              <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
                Puesto {punctualityInsights.position || "--"}/{punctualityInsights.total}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Historial reciente</span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                {recentHistory.length}/{RECENT_HISTORY_DAYS} días
              </span>
            </div>
            <div>
              {recentHistory.length ? recentHistory.map((row) => (
                <div
                  key={`${row.date}-${row.id}`}
                  className="grid grid-cols-[60px_minmax(0,1fr)_52px] items-center gap-3 border-b border-slate-100 px-3 py-2.5 last:border-b-0"
                >
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Fecha</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-slate-800">{formatDateSafe(row.date, "dd/MM")}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Jornada</div>
                    <div className="mt-0.5 truncate font-mono text-xs font-semibold text-slate-700">
                      {row.entry_time ? `${formatTime(row.entry_time)} — ${formatTime(row.exit_time)}` : "Sin entrada"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Total</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-slate-800">
                      {row.total_hours ? `${Number(row.total_hours).toFixed(1)}h` : "--"}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="px-4 py-4 text-sm text-slate-400">Sin historial reciente disponible.</div>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
            >
              <div className="rounded-2xl bg-white px-8 py-4 text-3xl font-bold text-[#1E293B] shadow-2xl">
                Listo
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <>
      {!widgetModalOpen && (
        <div className="fixed bottom-20 right-4 z-[49] sm:bottom-24 sm:right-6">
          <motion.button
            onClick={() => setWidgetModalOpen(true)}
            className={`relative flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg shadow-slate-900/20 transition focus-visible:ring-2 focus-visible:ring-accent ${launcherColorClass}`}
            aria-label={`Abrir asistencia - ${nextActionMeta.label}`}
            title={`Asistencia - ${nextActionMeta.label}`}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            animate={showCelebration ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={showCelebration ? { duration: 0.6 } : { duration: 0.7 }}
            style={{ touchAction: "manipulation" }}
          >
            <LauncherIcon className="text-white" size={20} />
          </motion.button>
        </div>
      )}
      <Modal
        isOpen={widgetModalOpen}
        onClose={() => setWidgetModalOpen(false)}
        title="Asistencia"
        maxWidth="max-w-lg"
      >
        {renderWidgetContent()}
      </Modal>
      <Modal
        isOpen={operationalModalOpen}
        onClose={() => {
          if (fieldVisitSubmitting) return;
          setOperationalModalOpen(false);
        }}
        title={operationalModalPhase === "start" ? "Registrar salida o visita" : "Cerrar salida o visita"}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">
              {operationalModalPhase === "start"
                ? "Selecciona el tipo de actividad laboral que realizaras fuera de la oficina y registra tu movilidad."
                : "Si la salida activa usa vehiculo personal, el cierre requiere kilometraje final y foto tomada en el momento."}
            </p>
          </div>

          {operationalModalPhase === "start" ? (
            <>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Tipo de salida
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {OPERATIONAL_CATEGORY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setOperationalCategory(option.value)}
                      aria-pressed={operationalCategory === option.value}
                      className={`min-h-[64px] rounded-2xl border px-3 py-2.5 text-left transition active:scale-[0.97] ${operationalCategory === option.value ? "border-[#2563EB] bg-[#DBEAFE] text-[#1D4ED8]" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}
                    >
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="mt-0.5 block text-[11px] font-normal opacity-75">{option.helper}</span>
                    </button>
                  ))}
                </div>
              </div>

              {draftOperationRequiresClientVisitFlow ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  {renderClientPickerSection({ title: "Tipo de visita a cliente", stepLabel: "Paso 2" })}
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Detalle
                </label>
                <textarea
                  value={operationalDetail}
                  onChange={(e) => setOperationalDetail(e.target.value)}
                  rows="3"
                  placeholder="Ejemplo: salida al banco, reunion o gestion ministerial"
                  className={CONTROL_TEXTAREA_CLASS}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setOperationalVehicleMode("company")}
                  className={`min-h-[52px] rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition active:scale-[0.97] ${operationalVehicleMode === "company" ? "border-[#2563EB] bg-[#DBEAFE] text-[#1D4ED8]" : "border-slate-200 bg-white text-slate-700"}`}
                >
                  Sin vehiculo personal
                </button>
                <button
                  type="button"
                  onClick={() => setOperationalVehicleMode("personal")}
                  className={`min-h-[52px] rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition active:scale-[0.97] ${operationalVehicleMode === "personal" ? "border-[#2563EB] bg-[#DBEAFE] text-[#1D4ED8]" : "border-slate-200 bg-white text-slate-700"}`}
                >
                  Con vehiculo personal
                </button>
              </div>

              {operationalVehicleMode === "personal" ? (
                <div className="grid gap-5">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Kilometraje inicial
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={operationalStartKm}
                      onChange={(e) => setOperationalStartKm(e.target.value)}
                      className={CONTROL_INPUT_CLASS}
                      placeholder="Ejemplo: 152340"
                    />
                  </div>
                  <CameraCaptureField
                    label="Foto de kilometraje inicial"
                    hint="La captura se toma en el momento de la salida."
                    value={operationalStartPhoto}
                    onChange={setOperationalStartPhoto}
                    fileNamePrefix="odometro_inicio"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className="grid gap-5">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {operationalModalPhase === "close" ? "Motivo del cierre fuera de oficina" : "Observacion de cierre"}
                </label>
                <textarea
                  value={operationalDetail}
                  onChange={(e) => setOperationalDetail(e.target.value)}
                  rows="3"
                  placeholder="Detalle final de la salida operacional"
                  className={CONTROL_TEXTAREA_CLASS}
                />
              </div>

              {activeException?.uses_personal_vehicle ? (
                <>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Kilometraje final
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={operationalEndKm}
                      onChange={(e) => setOperationalEndKm(e.target.value)}
                      className={CONTROL_INPUT_CLASS}
                      placeholder="Ejemplo: 152380"
                    />
                  </div>
                  <CameraCaptureField
                    label="Foto de kilometraje final"
                    hint="La captura se toma en el momento del cierre."
                    value={operationalEndPhoto}
                    onChange={setOperationalEndPhoto}
                    fileNamePrefix="odometro_fin"
                  />
                </>
              ) : null}
            </div>
          )}

          {operationalModalError ? <p className="text-sm text-[#DC2626]">{operationalModalError}</p> : null}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={() => setOperationalModalOpen(false)}
              className={ACTION_BTN_MODAL_SECONDARY_CLASS}
              disabled={fieldVisitSubmitting}
            >
              Cancelar
            </button>
            <Button
              variant="primary"
              onClick={submitOperationalModal}
              disabled={fieldVisitSubmitting}
              className={ACTION_BTN_MODAL_PRIMARY_CLASS}
            >
              {fieldVisitSubmitting ? "Guardando..." : "Registrar marcacion"}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={Boolean(overtimePrompt)}
        onClose={() => {
          if (overtimeSubmitting) return;
          setOvertimePrompt(null);
          setOvertimeReason("");
        }}
        title="Registrar horas extra"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-3">
            <p className="text-sm text-indigo-900">
              Se detectaron {Number(overtimePrompt?.hours || 0).toFixed(1)} horas extra al cerrar la jornada.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-800">
              Motivo de las horas extra
            </label>
            <textarea
              className={CONTROL_TEXTAREA_CLASS}
              rows="3"
              placeholder="Describe el motivo operativo del tiempo adicional..."
              value={overtimeReason}
              onChange={(e) => setOvertimeReason(e.target.value)}
              aria-label="Motivo de horas extra"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setOvertimePrompt(null);
                setOvertimeReason("");
              }}
              className={ACTION_BTN_MODAL_SECONDARY_CLASS}
              disabled={overtimeSubmitting}
            >
              Omitir
            </button>
            <Button
              variant="primary"
              onClick={handleOvertimeSubmit}
              disabled={overtimeSubmitting}
              className={ACTION_BTN_MODAL_PRIMARY_CLASS}
            >
              {overtimeSubmitting ? "Guardando..." : "Guardar horas extra"}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={lateJustificationModalOpen}
        onClose={() => {
          if (lateJustificationSubmitting) return;
          setLateJustificationModalOpen(false);
        }}
        title="Justificar atraso"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3">
            <p className="text-sm text-rose-900">
              Llegaste con {latePolicy?.lateMinutes ?? "--"} min de atraso. Tienes {latePolicy?.justification?.remainingMonthly ?? 0} justificaciones disponibles este mes.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-800">
              Motivo de la justificación
            </label>
            <textarea
              className={CONTROL_TEXTAREA_CLASS}
              rows="3"
              placeholder="Describe el motivo del atraso..."
              value={lateJustificationReason}
              onChange={(e) => setLateJustificationReason(e.target.value)}
              aria-label="Motivo de justificacion de atraso"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={() => setLateJustificationModalOpen(false)}
              className={ACTION_BTN_MODAL_SECONDARY_CLASS}
              disabled={lateJustificationSubmitting}
            >
              Cerrar
            </button>
            <Button
              variant="danger"
              onClick={handleLateJustificationSubmit}
              disabled={lateJustificationSubmitting || !latePolicy?.justification?.canJustify}
              className={ACTION_BTN_MODAL_PRIMARY_CLASS}
            >
              {lateJustificationSubmitting ? "Guardando..." : "Guardar justificación"}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={entryRegularizationOpen}
        onClose={() => {
          if (entryRegularizationLoading) return;
          setEntryRegularizationOpen(false);
        }}
        title="Solicitar regularizacion de entrada"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-3">
            <p className="text-sm text-orange-900">
              El plazo para marcar entrada (09:20) ya paso. Talento Humano recibira tu solicitud
              y regularizara la entrada de hoy en el sistema.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-800">
              Motivo de la solicitud
            </label>
            <textarea
              className={CONTROL_TEXTAREA_CLASS}
              rows="3"
              placeholder="Describe por que no pudiste marcar la entrada antes de las 09:20..."
              value={entryRegularizationReason}
              onChange={(e) => setEntryRegularizationReason(e.target.value)}
              aria-label="Motivo de solicitud de regularizacion de entrada"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={() => setEntryRegularizationOpen(false)}
              className={ACTION_BTN_MODAL_SECONDARY_CLASS}
              disabled={entryRegularizationLoading}
            >
              Cerrar
            </button>
            <Button
              variant="primary"
              onClick={handleEntryRegularization}
              disabled={entryRegularizationLoading || entryRegularizationReason.trim().length < 8}
              className={ACTION_BTN_MODAL_PRIMARY_CLASS}
            >
              {entryRegularizationLoading ? "Enviando..." : "Enviar a Talento Humano"}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={exitConfirmOpen}
        onClose={() => setExitConfirmOpen(false)}
        title="Confirmar salida"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            ¿Confirmas que deseas registrar tu <strong>salida final</strong> de hoy? Esta acción cerrará tu jornada.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={() => setExitConfirmOpen(false)}
              className={ACTION_BTN_MODAL_SECONDARY_CLASS}
              disabled={loading}
            >
              Cancelar
            </button>
            <Button
              variant="danger"
              onClick={() => { setExitConfirmOpen(false); doClockOutRef.current?.(); }}
              disabled={loading}
              className={ACTION_BTN_MODAL_PRIMARY_CLASS}
            >
              {loading ? "Registrando..." : "Sí, registrar salida"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default AttendanceWidget;
