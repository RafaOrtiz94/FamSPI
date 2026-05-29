import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiClock, FiCoffee, FiSun, FiMoon, FiAlertTriangle, FiTrendingUp, FiChevronDown, FiChevronUp, FiCheckCircle } from "react-icons/fi";
import confetti from "canvas-confetti";

import Button, { actionBtnClass, actionBtnNeutralClass } from "../components/Button";
import Modal from "../components/Modal";
import { useUI } from "../useUI";
import { getAttendanceErrorInfo } from "../attendanceErrorUtils";
import { isOperationalFlow } from "../attendanceFlowUtils";

import {
  clockIn,
  clockOutLunch,
  clockInLunch,
  clockOut,
  marcarVisitaEntrada,
  marcarVisitaSalida,
  marcarSalidaOficina,
  marcarEntradaOficina,
  marcarLlegadaDestino,
  marcarCierreViaje,
  markOvertime,
  justifyLateArrival,
  registerException,
  updateExceptionStatus,
  getActiveException,
  getTodayAttendance,
  getAttendanceRange,
  syncAttendanceLocation,
} from "../../api/attendanceApi";
import { getMisSolicitudes } from "../../api/permisosApi";
import { useAutoUpdate } from "../../api/index";
import { fetchClients } from "../../api/clientsApi";
import { formatDateSafe, formatTimeSafe, formatDateTimeSafe, toDate } from "../../../shared/utils/dateUtils";
import { useAuth } from "../../auth/useAuth";
import {
  getLocationForAction as getSharedLocation,
  startLocationPrewarm,
  stopLocationPrewarm,
} from "../../../shared/utils/attendanceLocationCache";

const EXCEPTION_PRESETS = Object.freeze({
  permiso: "Salida por permiso personal",
  medico: "Salida por cita medica",
  proveedor: "Salida por reunion con proveedor",
  otro: "Salida inesperada",
});

const RECENT_HISTORY_DAYS = 5;
const LUNCH_REMINDER_MINUTES = 50;
const LUNCH_SUGGESTION_AFTER_HOURS = 4;
const EXIT_REMINDER_AFTER_HOURS = 8;
const PUNCTUALITY_BASE_MINUTES = 9 * 60;
const PUNCTUALITY_TOLERANCE_MINUTES = 5;
const RECENT_LOCATION_STORAGE_KEY = "attendance_recent_valid_location";
const RECENT_LOCATION_MAX_AGE_MS = 90 * 1000;
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
const ATTENDANCE_STATUS_LABELS = Object.freeze({
  no_entry: "Sin entrada",
  working: "Jornada abierta",
  lunch_open: "Almuerzo abierto",
  completed: "Jornada cerrada",
});
const FIELD_VISIT_TYPE_OPTIONS = Object.freeze([
  { value: "cronograma", label: "Cliente de cronograma", helper: "Visita planificada del dia" },
  { value: "prospecto", label: "Prospecto", helper: "Gestion comercial nueva" },
  { value: "emergencia", label: "Emergencia", helper: "Atencion urgente en cliente" },
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
const SECTION_PANEL_CLASS = "rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]";
const SECTION_TITLE_CLASS = "text-sm font-bold uppercase tracking-wide text-slate-800";

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

const getOperationalTrackingLabel = (exception) => {
  const spanDays = Number(exception?.operational_span_days || 0);
  const elapsedHours = Number(exception?.operational_elapsed_hours || 0);
  if (!Number.isFinite(spanDays) || spanDays <= 0) return null;
  if (spanDays <= 1) {
    return `Operacion abierta hoy (${elapsedHours.toFixed(1)} h acumuladas)`;
  }
  return `Operacion abierta hace ${spanDays} dias (${elapsedHours.toFixed(1)} h acumuladas)`;
};

const deriveAttendanceState = (record = {}) => {
  if (!record?.entry_time) return "no_entry";
  if (record?.exit_time) return "completed";
  if (record?.lunch_start_time && !record?.lunch_end_time) return "lunch_open";
  return "working";
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

const getBrowserLocationFallback = () =>
  new Promise((resolve) => {
    if (!navigator?.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number(position.coords.accuracy || 0),
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  });

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
  const { user, logout } = useAuth();

  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCelebration, setShowCelebration] = useState(false);

  const [activeException, setActiveException] = useState(null);
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
  const [exceptionType, setExceptionType] = useState("");
  const [exceptionDescription, setExceptionDescription] = useState("");
  const [exceptionLoading, setExceptionLoading] = useState(false);

  // Geolocation state
  const [locationLoading, setLocationLoading] = useState(false);
  const [cachedLocation, setCachedLocation] = useState(null);
  const [cachedLocationAccuracy, setCachedLocationAccuracy] = useState(null);
  const [locationTimestamp, setLocationTimestamp] = useState(null);
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [showTimelineDetails, setShowTimelineDetails] = useState(false);
  const [showExceptionTools, setShowExceptionTools] = useState(false);
  const [recentHistory, setRecentHistory] = useState([]);
  const [exceptionSuggestion, setExceptionSuggestion] = useState(null);
  const [reminderMessage, setReminderMessage] = useState(null);
  const [overtimePrompt, setOvertimePrompt] = useState(null);
  const [overtimeReason, setOvertimeReason] = useState("");
  const [overtimeSubmitting, setOvertimeSubmitting] = useState(false);
  const [lateJustificationModalOpen, setLateJustificationModalOpen] = useState(false);
  const [lateJustificationReason, setLateJustificationReason] = useState("");
  const [lateJustificationSubmitting, setLateJustificationSubmitting] = useState(false);
  const [showFieldTools, setShowFieldTools] = useState(true);
  const [fieldVisitType, setFieldVisitType] = useState("cronograma");
  const [selectedFieldAction, setSelectedFieldAction] = useState("office_exit");
  const [fieldExitMode, setFieldExitMode] = useState("continue_operation");
  const [fieldClientId, setFieldClientId] = useState("");
  const [fieldClientSearch, setFieldClientSearch] = useState("");
  const [fieldProspectName, setFieldProspectName] = useState("");
  const [fieldEmergencyReason, setFieldEmergencyReason] = useState("");
  const [fieldVisitNotes, setFieldVisitNotes] = useState("");
  const [tripClosureReason, setTripClosureReason] = useState("");
  const [fieldVisitSubmitting, setFieldVisitSubmitting] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const doClockOutRef = useRef(null);
  const [scheduledClientsToday, setScheduledClientsToday] = useState([]);
  const [scheduledClientsLoading, setScheduledClientsLoading] = useState(false);
  const [emergencyClients, setEmergencyClients] = useState([]);
  const [emergencyClientsLoading, setEmergencyClientsLoading] = useState(false);
  const [fieldEmergencyClientId, setFieldEmergencyClientId] = useState("");
  const [fieldEmergencyClientSearch, setFieldEmergencyClientSearch] = useState("");
  const autoOpenSessionRef = useRef(null);
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
          await logout?.();
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
      setActiveException(res.data);
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
      return;
    }

    setScheduledClientsLoading(true);
    try {
      const dateKey = attendance?.date || getLocalDateKey(new Date());
      const result = await fetchClients({
        date: dateKey,
        include_schedule_info: true,
        filter_by_schedule: true,
      });
      const clients = Array.isArray(result?.clients) ? result.clients : [];
      const planned = clients
        .filter((client) => !client?.is_prospect)
        .map((client) => ({
          id: Number(client.id),
          name: client.commercial_name || client.nombre || `Cliente #${client.id}`,
          city: client.shipping_city || "Sin ciudad",
        }));

      setScheduledClientsToday(planned);
    } catch (_error) {
      setScheduledClientsToday([]);
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

  const persistRecentLocation = (locationPayload) => {
    try {
      localStorage.setItem(RECENT_LOCATION_STORAGE_KEY, JSON.stringify(locationPayload));
    } catch {
      // noop
    }
  };

  const readRecentLocation = () => {
    try {
      const raw = localStorage.getItem(RECENT_LOCATION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const latitude = Number(parsed?.latitude);
      const longitude = Number(parsed?.longitude);
      const accuracy = Number(parsed?.accuracy);
      const timestamp = Number(parsed?.timestamp || 0);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      if (Math.abs(latitude) <= 0.0005 && Math.abs(longitude) <= 0.0005) return null;
      if (!Number.isFinite(timestamp) || (Date.now() - timestamp) > RECENT_LOCATION_MAX_AGE_MS) return null;
      return {
        latitude,
        longitude,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        timestamp,
        source: parsed?.source || "cached_recent",
      };
    } catch {
      return null;
    }
  };

  const getLocation = async (showErrors = true) => {
    const inMemoryRecent =
      cachedLocation &&
        locationTimestamp &&
        (Date.now() - locationTimestamp) <= RECENT_LOCATION_MAX_AGE_MS
        ? {
          latitude: Number(cachedLocation?.latitude),
          longitude: Number(cachedLocation?.longitude),
          accuracy: Number(cachedLocationAccuracy),
          timestamp: Number(locationTimestamp),
          source: "memory_cache",
        }
        : null;

    if (inMemoryRecent && Number.isFinite(inMemoryRecent.latitude) && Number.isFinite(inMemoryRecent.longitude)) {
      return inMemoryRecent;
    }

    const persisted = readRecentLocation();
    if (persisted) {
      setCachedLocation({ latitude: persisted.latitude, longitude: persisted.longitude });
      setCachedLocationAccuracy(persisted.accuracy);
      setLocationTimestamp(persisted.timestamp);
      return persisted;
    }

    setLocationLoading(true);
    try {
      const precise = await getSharedLocation({ forceRefresh: true });

      const preciseLatitude = Number(precise?.latitude);
      const preciseLongitude = Number(precise?.longitude);
      if (!Number.isFinite(preciseLatitude) || !Number.isFinite(preciseLongitude)) {
        throw new Error("GPS_SIN_COORDENADAS");
      }

      const payload = {
        latitude: preciseLatitude,
        longitude: preciseLongitude,
        accuracy: Number(precise?.accuracy || 0),
        timestamp: Date.now(),
        source: precise?.source || "precise",
      };
      setCachedLocation({ latitude: payload.latitude, longitude: payload.longitude });
      setCachedLocationAccuracy(payload.accuracy);
      setLocationTimestamp(payload.timestamp);
      persistRecentLocation(payload);
      return payload;
    } catch (err) {
      const fallback = await getBrowserLocationFallback();
      const fallbackLat = Number(fallback?.latitude);
      const fallbackLng = Number(fallback?.longitude);
      if (Number.isFinite(fallbackLat) && Number.isFinite(fallbackLng)) {
        const payload = {
          latitude: fallbackLat,
          longitude: fallbackLng,
          accuracy: Number(fallback?.accuracy || 0),
          timestamp: Date.now(),
          source: "browser_fallback",
        };
        setCachedLocation({ latitude: payload.latitude, longitude: payload.longitude });
        setCachedLocationAccuracy(payload.accuracy);
        setLocationTimestamp(payload.timestamp);
        persistRecentLocation(payload);
        return payload;
      }

      if (showErrors) {
        showToast("No se pudo obtener ubicacion valida. Verifica GPS y reintenta.", "warning");
      }
      throw err;
    } finally {
      setLocationLoading(false);
    }
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

  const handleExceptionTypeChange = (value) => {
    setExceptionType(value);

    const presetDescription = EXCEPTION_PRESETS[value] || "";
    if (!exceptionDescription || Object.values(EXCEPTION_PRESETS).includes(exceptionDescription)) {
      setExceptionDescription(presetDescription);
    }
  };
  const formatTime = (ts) => {
    return formatTimeSafe(ts);
  };

  const formatDateTime = (ts) => {
    return formatDateTimeSafe(ts, 'dd/MM/yyyy HH:mm');
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
  * Optimized exception registration with background geolocation
  */
  const handleRegisterException = async () => {
    const finalType = exceptionType || "otro";
    const finalDescription = exceptionDescription || "Salida inesperada";
    const syncTarget = "start";

    setExceptionLoading(true);
    let actionLocation = null;
    try {
      const activeResponse = await getActiveException();
      const currentActive = activeResponse?.data || null;
      if (currentActive && isOperationalFlow(currentActive)) {
        showToast("Tienes una salida operacional activa. Cierrala antes de registrar una salida inesperada.", "warning");
        return;
      }

      actionLocation = await getLocationForAction();
      const res = await registerException(finalType, finalDescription, actionLocation);
      if (res.ok) {
        await ensureSyncExceptionTargetLocation(syncTarget, actionLocation);
        showToast("Salida registrada. Notifica tu llegada.", "success");
        setExceptionModalOpen(false);
        setExceptionType("");
        setExceptionDescription("");
        await refreshAll();
      } else {
        showToast("Error registrando salida", "error");
      }
    } catch (err) {
      console.error("Exception registration error:", err);
      const status = Number(err?.response?.status || 0);
      if (status === 400 || status === 409 || status === 404) {
        const recovered = await resolveExceptionConflict(syncTarget, actionLocation || cachedLocation || null);
        if (recovered) {
          showToast("La salida ya existia. Se actualizo el estado operativo.", "warning");
          await refreshAll();
          return;
        }
      }
      const info = getAttendanceErrorInfo(err, "Error registrando salida", "error");
      showToast(info.message, info.type);
    } finally {
      setExceptionLoading(false);
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
      "jefe_tecnico",
      "ti",
      "jefe_ti",
      "logistica",
      "jefe_logistica",
    ].includes(role);
  }, [user?.role]);

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

  const buildFieldVisitPayload = async ({ includeObservations = false, mode = "entry" } = {}) => {
    const payload = {};
    const location = await getLocationForAction();
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
      if (kind === "exit") {
        payload.return_to_office = fieldExitMode === "return_to_office";
        payload.post_visit_action = fieldExitMode;
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
          setSelectedFieldAction(fieldExitMode === "return_to_office" ? "office_entry" : "client_entry");
        }
        await refreshAll();
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

  const handleOfficeDepartureQuick = async () => {
    if (hasActiveException) {
      if (isFieldOperationFlow) {
        showToast("Ya tienes una operacion de campo activa.", "info");
      } else {
        showToast("Tienes una salida inesperada activa. Debes cerrarla antes de iniciar una salida operacional.", "warning");
      }
      return;
    }

    const emergencyDetail = String(fieldEmergencyReason || "").trim();
    const description = emergencyDetail
      ? `Salida de oficina para atencion: ${emergencyDetail}`
      : "Salida de oficina para gestion de campo";

    setFieldVisitSubmitting(true);
    let actionLocation = null;
    try {
      actionLocation = await getLocationForAction();
      const res = await marcarSalidaOficina(actionLocation, description);
      if (res?.ok) {
        await ensureSyncExceptionTargetLocation("start", actionLocation);
        showToast("Salida de oficina registrada.", "success");
        setSelectedFieldAction("client_entry");
        await refreshAll();
      } else {
        showToast("No se pudo registrar la salida de oficina.", "error");
      }
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 400 || status === 404 || status === 409) {
        const recovered = await resolveExceptionConflict("start", actionLocation || cachedLocation || null);
        if (recovered) {
          showToast("La salida operacional ya existia. Estado actualizado.", "warning");
          await refreshAll();
          return;
        }
      }
      const info = getAttendanceErrorInfo(err, "Error registrando salida de oficina", "error");
      showToast(info.message, info.type);
    } finally {
      setFieldVisitSubmitting(false);
    }
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

    setFieldVisitSubmitting(true);
    let actionLocation = null;
    try {
      actionLocation = await getLocationForAction();
      const res = await marcarEntradaOficina(actionLocation);
      if (res?.ok) {
        await ensureSyncExceptionTargetLocation("return", actionLocation);
        showToast("Entrada a oficina registrada.", "success");
        setSelectedFieldAction("office_exit");
        await refreshAll();
      } else {
        showToast("No se pudo registrar la entrada a oficina.", "error");
      }
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 400 || status === 404 || status === 409) {
        const recovered = await resolveExceptionConflict("return", actionLocation || cachedLocation || null);
        if (recovered) {
          showToast("La entrada operacional ya existia. Estado actualizado.", "warning");
          await refreshAll();
          return;
        }
      }
      const info = getAttendanceErrorInfo(err, "Error registrando entrada a oficina", "error");
      showToast(info.message, info.type);
    } finally {
      setFieldVisitSubmitting(false);
    }
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

  const handleCierreViaje = async () => {
    if (!isFieldOperationFlow) {
      showToast("No tienes una salida operacional activa.", "warning");
      return;
    }
    setFieldVisitSubmitting(true);
    let actionLocation = null;
    try {
      actionLocation = await getLocationForAction();
      const reason = String(tripClosureReason || "").trim() || null;
      const res = await marcarCierreViaje(actionLocation, reason);
      if (res?.ok) {
        showToast("Viaje cerrado correctamente desde fuera de oficina.", "success");
        setTripClosureReason("");
        await refreshAll();
      } else {
        showToast("No se pudo cerrar el viaje.", "error");
      }
    } catch (err) {
      const info = getAttendanceErrorInfo(err, "Error cerrando viaje", "error");
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

  const progress = calculateProgress();
  const status = getStatusInfo();
  const attendanceState = attendance?.attendance_status || deriveAttendanceState(attendance);
  const attendanceStateLabel = attendance?.attendance_status_label || ATTENDANCE_STATUS_LABELS[attendanceState] || "Sin estado";
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

  const hasActiveException = Boolean(activeException);
  const isFieldOperationFlow = hasActiveException && isOperationalFlow(activeException);
  const exceptionStatus = activeException?.status || "NONE";
  const hasOpenFieldVisit = String(attendance?.active_field_visit?.status || "").trim().toLowerCase() === "in_visit";

  useEffect(() => {
    if (isFieldOperationFlow) {
      if (exceptionStatus === "RETURNING") {
        if (selectedFieldAction !== "office_entry") {
          setSelectedFieldAction("office_entry");
        }
        return;
      }
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
    if (!isFieldOperationFlow && exceptionStatus === "NONE" && selectedFieldAction === "office_entry") {
      setSelectedFieldAction("office_exit");
    }
  }, [exceptionStatus, hasOpenFieldVisit, isFieldOperationFlow, selectedFieldAction]);
  const exceptionStepLabel =
    {
      ACTIVE: "Operacion abierta",
      ON_SITE: hasOpenFieldVisit ? "En cliente" : "Operacion abierta",
      RETURNING: "Regresando",
      COMPLETED: "Completada",
      NONE: "Sin salidas inesperadas",
    }[exceptionStatus] || "Sin salidas inesperadas";

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

    const exceptionLabel = isFieldOperationFlow ? "Salida operacional" : "Salida inesperada";

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
  }, [
    activeException?.arrival_time,
    activeException?.departure_time,
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

  const lastRecordedEntry = useMemo(() => {
    const populatedEntries = timeEntries.filter((entry) => entry.value).map((entry) => ({
      ...entry,
      timestamp: toDate(entry.value)?.getTime() || 0,
    }));

    populatedEntries.sort((a, b) => b.timestamp - a.timestamp);
    return populatedEntries[0] || null;
  }, [timeEntries]);

  const nextActionMeta = useMemo(() => {
    if (isFieldOperationFlow) {
      if (exceptionStatus === "RETURNING") {
        return {
          label: "Llegar a oficina",
          detail: "Completa la entrada a oficina o viaje cuando regreses.",
        };
      }

      if (hasOpenFieldVisit) {
        return {
          label: "Salir de cliente",
          detail: "Cierra la visita actual y define si la operacion sigue abierta o si ya vuelves a oficina.",
        };
      }

      return {
        label: "Entrar a cliente",
        detail: "Selecciona el cliente, prospecto o emergencia para registrar la llegada al destino.",
      };
    }

    if (hasActiveException) {
      if (activeException.status === "ACTIVE") {
        return {
          label: "Llegar a destino",
          detail: "Confirma cuando hayas llegado al destino de la salida.",
        };
      }

      if (activeException.status === "ON_SITE") {
        return {
          label: "Salir de destino",
          detail: "Registra la salida del sitio cuando termines la gestion.",
        };
      }

      if (activeException.status === "RETURNING") {
        return {
          label: "Llegar a oficina",
          detail: "Cierra el ciclo cuando regreses a la oficina.",
        };
      }
    }

    if (!attendance?.entry_time) {
      return {
        label: "Marcar entrada",
        detail: "Tu jornada inicia con el login y puede ajustarse aqui si hace falta.",
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

    return {
      label: "Salir a almuerzo",
      detail: "Tu siguiente paso operativo es registrar la salida a almuerzo.",
    };
  }, [
    activeException?.status,
    attendance?.entry_time,
    attendance?.exit_time,
    attendance?.lunch_end_time,
    attendance?.lunch_start_time,
    exceptionStatus,
    hasActiveException,
    hasOpenFieldVisit,
    isFieldOperationFlow,
  ]);

  const reminderMeta = useMemo(() => {
    const now = currentTime;

    if (hasActiveException) {
      const flowLabel = isFieldOperationFlow ? "salida operacional" : "salida inesperada";
      const operationalTracking = isFieldOperationFlow ? getOperationalTrackingLabel(activeException) : null;
      const operationalElapsedHours = Number(activeException?.operational_elapsed_hours || 0);
      if (isFieldOperationFlow) {
        if (Number.isFinite(operationalElapsedHours) && operationalElapsedHours >= 12) {
          return {
            key: "field-operation-over-12h",
            text: `${operationalTracking || "Operacion abierta"} superíor a 12h. Regulariza para acta y continúa con entrada a cliente al día siguiente o cierra con retorno operacional.`,
          };
        }
        if (activeException?.status === "RETURNING") {
          return {
            key: "field-operation-returning",
            text: "Ya marcaste el retorno desde cliente. Solo falta la entrada a oficina o viaje para cerrar el ciclo.",
          };
        }

        if (hasOpenFieldVisit) {
          return {
            key: "field-operation-client-open",
            text: "Tienes una visita de cliente abierta. Registra la salida del cliente al terminar esa gestion.",
          };
        }

        return {
          key: "field-operation-open",
          text: operationalTracking
            ? `${operationalTracking}. Puedes registrar la entrada del siguiente cliente o dejar la operacion abierta hasta mañana.`
            : "La salida operacional sigue abierta. Registra la entrada del siguiente cliente o deja la operacion abierta hasta mañana.",
        };
      }

      if (activeException?.status === "ACTIVE") {
        return {
          key: "exception-active",
          text: operationalTracking
            ? `${operationalTracking}. Confirma la llegada al destino cuando corresponda.`
            : `Tienes una ${flowLabel} en curso. Confirma la llegada al destino cuando corresponda.`,
        };
      }

      if (activeException?.status === "ON_SITE") {
        return {
          key: "exception-on-site",
          text: `La ${flowLabel} sigue abierta. Registra la salida del destino cuando termines la gestión.`,
        };
      }

      if (activeException?.status === "RETURNING") {
        return {
          key: "exception-returning",
          text: "El ciclo de salida sigue abierto. Falta confirmar tu regreso a la oficina.",
        };
      }
    }

    if (attendance?.lunch_start_time && !attendance?.lunch_end_time) {
      const lunchOpenMinutes = getElapsedMinutes(attendance.lunch_start_time, now);
      return {
        key: lunchOpenMinutes >= LUNCH_REMINDER_MINUTES ? "lunch-open-delayed" : "lunch-open",
        text:
          lunchOpenMinutes >= LUNCH_REMINDER_MINUTES
            ? "Tu almuerzo sigue abierto desde hace un rato. Registra el regreso para retomar la jornada."
            : "Tu almuerzo sigue abierto. Registra el regreso para retomar la jornada.",
      };
    }

    if (attendance?.entry_time && attendance?.lunch_end_time && !attendance?.exit_time) {
      const workedHours = Number(attendance?.total_hours || 0);
      const entryHours = getElapsedMinutes(attendance.entry_time, now) / 60;
      return {
        key: workedHours >= EXIT_REMINDER_AFTER_HOURS || entryHours >= EXIT_REMINDER_AFTER_HOURS
          ? "shift-open-final"
          : "shift-open",
        text:
          workedHours >= EXIT_REMINDER_AFTER_HOURS || entryHours >= EXIT_REMINDER_AFTER_HOURS
            ? "Tu jornada ya deberia estar cerrada. Registra la salida final para completar el dia."
            : "Tu jornada sigue abierta. Registra la salida final cuando corresponda.",
      };
    }

    if (attendance?.entry_time && !attendance?.lunch_start_time && !attendance?.lunch_end_time) {
      const entryHours = getElapsedMinutes(attendance.entry_time, now) / 60;
      if (entryHours >= LUNCH_SUGGESTION_AFTER_HOURS) {
        return {
          key: "lunch-suggestion",
          text: "Ya tienes varias horas continuas desde la entrada. Si saliste a almuerzo, registra esa marca.",
        };
      }
    }

    if (!attendance?.entry_time) {
      return {
        key: "missing-entry",
        text: "Aun no hay entrada registrada hoy. Marca tu entrada para iniciar la jornada.",
      };
    }

    return null;
  }, [
    activeException,
    attendance?.entry_time,
    attendance?.exit_time,
    attendance?.lunch_end_time,
    attendance?.lunch_start_time,
    attendance?.total_hours,
    currentTime,
    hasActiveException,
    hasOpenFieldVisit,
    isFieldOperationFlow,
  ]);

  useEffect(() => {
    setReminderMessage(reminderMeta?.text || null);

    if (!reminderMeta?.key) return;

    const todayKey = attendance?.date || getLocalDateKey(new Date());
    const storageKey = `attendance-reminder:${todayKey}:${reminderMeta.key}`;
    if (localStorage.getItem(storageKey)) return;

    showToast(reminderMeta.text, "info");
    localStorage.setItem(storageKey, "1");
  }, [attendance?.date, reminderMeta, showToast]);

  useEffect(() => {
    if (!nextActionMeta?.label || nextActionMeta.label === "Sin acciones pendientes") return;
    if (widgetModalOpen) return;
    const todayKey = attendance?.date || getLocalDateKey(new Date());
    const autoOpenSessionKey = `attendance-auto-open-session:${todayKey}`;
    const autoOpenKey = `attendance-auto-open:${todayKey}:${hasActiveException ? exceptionStatus : nextActionMeta.label}`;
    if (autoOpenSessionRef.current === autoOpenSessionKey) return;
    if (sessionStorage.getItem(autoOpenSessionKey)) return;
    if (localStorage.getItem(autoOpenKey)) return;

    autoOpenSessionRef.current = autoOpenSessionKey;
    sessionStorage.setItem(autoOpenSessionKey, "1");

    const timeoutId = window.setTimeout(() => {
      setWidgetModalOpen(true);
      localStorage.setItem(autoOpenKey, "1");
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [attendance?.date, exceptionStatus, hasActiveException, nextActionMeta?.label, widgetModalOpen]);

  const summaryCards = [
    {
      label: "Estado actual",
      value: status.text,
      hint: hasActiveException ? exceptionStepLabel : "Jornada del dia",
    },
    {
      label: "Ultimo registro",
      value: lastRecordedEntry?.label || "Sin registros",
      hint: lastRecordedEntry?.value ? formatDateTime(lastRecordedEntry.value) : "Aun no hay marcas hoy",
    },
    {
      label: "Siguiente accion",
      value: nextActionMeta.label,
      hint: nextActionMeta.detail,
    },
    {
      label: "Estado tecnico",
      value: attendanceStateLabel,
      hint: attendance?.attendance_status ? "Estado calculado desde el backend" : "Estado derivado localmente",
    },
  ];

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

  const renderExceptionBanner = () => {
    if (isFieldOperationFlow) return null;
    if (!hasActiveException) return null;
    const items = [
      { label: "Salida de oficina", value: activeException.start_time, icon: "1" },
      { label: "Llegada a destino", value: activeException.arrival_time, icon: "2" },
      { label: "Salida de destino", value: activeException.departure_time, icon: "3" },
      { label: "Regreso a oficina", value: activeException.return_time, icon: "4" },
    ];

    return (
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiAlertTriangle className="flex-shrink-0 text-amber-600" size={14} />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Salida Inesperada Activa</span>
              <span className="ml-2 text-xs text-amber-700">{exceptionStepLabel}</span>
            </div>
          </div>
          <span className="rounded-full border border-amber-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
            {activeException.type}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="rounded-lg border border-amber-100 bg-white px-3 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-amber-700">{item.label}</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-amber-900">{formatDateTime(item.value)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderExceptionControls = () => {
    if (isFieldOperationFlow) {
      // Field operation is managed by renderFieldOperationsControls below no duplicate controls here
      return null;
    }
    if (!hasActiveException) {
      return (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <FiAlertTriangle size={13} />
            </span>
            <span className="text-sm font-semibold text-slate-800">Salida inesperada</span>
          </div>
          <p className="mb-3 text-xs leading-5 text-slate-500">
            Registra una salida inesperada solo cuando aplique una excepcion fuera del flujo normal.
          </p>
          <Button
            variant="warning"
            onClick={() => setExceptionModalOpen(true)}
            className={ACTION_BTN_BASE_CLASS}
            disabled={loading}
          >
            Registrar salida inesperada
          </Button>
        </div>
      );
    }

    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-amber-200 bg-white">
        <div className="flex items-center gap-2.5 border-b border-amber-100 bg-amber-50 px-4 py-2.5">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-amber-200 text-amber-700">
            <FiAlertTriangle size={12} />
          </span>
          <span className="text-xs font-semibold text-amber-900">
            Salida en curso: {String(activeException.type).replace(/_/g, " ")}
          </span>
        </div>

        <div className="p-4 space-y-3">
          {activeException.status === "ACTIVE" && (
            <>
              <p className="text-xs leading-5 text-slate-500">Estás en camino a tu destino.</p>
              <Button
                variant="warning"
                onClick={() => handleExceptionUpdate("ON_SITE", "Has llegado a tu destino")}
                className={ACTION_BTN_BASE_CLASS}
                disabled={loading}
              >
                Llegué a destino
              </Button>
            </>
          )}

          {activeException.status === "ON_SITE" && (
            <>
              <p className="text-xs leading-5 text-slate-500">Estás en el sitio. Registra cuando salgas.</p>
              <Button
                variant="warning"
                onClick={() => handleExceptionUpdate("RETURNING", "Has salido del destino")}
                className={ACTION_BTN_BASE_CLASS}
                disabled={loading}
              >
                Salir de destino
              </Button>
            </>
          )}

          {activeException.status === "RETURNING" && (
            <>
              <p className="text-xs leading-5 text-slate-500">Estás regresando a la oficina.</p>
              <Button
                variant="success"
                onClick={() => handleExceptionUpdate("COMPLETED", "Ciclo de salida completado")}
                className={ACTION_BTN_BASE_CLASS}
                disabled={loading}
              >
                Llegué a oficina
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderFieldOperationsControls = () => {
    if (!canUseFieldOperations) {
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Este bloque aplica solo para personal de campo autorizado.</p>
        </div>
      );
    }

    const TripStep = ({ label, time, done, active }) => (
      <div className={`flex items-start gap-2 py-1 ${active ? "opacity-100" : done ? "opacity-70" : "opacity-40"}`}>
        <div className={`mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full border-2 ${done ? "border-emerald-500 bg-emerald-500" : active ? "border-blue-500 bg-blue-100 animate-pulse" : "border-slate-300 bg-white"}`} />
        <div className="min-w-0">
          <p className={`text-[11px] font-semibold ${active ? "text-blue-800" : done ? "text-emerald-800" : "text-slate-400"}`}>{label}</p>
          {time ? <p className="text-[10px] text-slate-500">{formatTimeSafe(time)}</p> : null}
        </div>
      </div>
    );

    const renderClientPickerSection = () => (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Tipo de gestion</p>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">Paso 1</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {FIELD_VISIT_TYPE_OPTIONS.map((option) => {
            const active = fieldVisitType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setFieldVisitType(option.value)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${active
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
          <input
            type="text"
            value={fieldProspectName}
            onChange={(e) => setFieldProspectName(e.target.value)}
            placeholder="Nombre del prospecto"
            className={CONTROL_INPUT_SUBTLE_CLASS}
            aria-label="Nombre del prospecto"
          />
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

    if (!isFieldOperationFlow) {
      return (
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-sky-100">
                <FiTrendingUp size={13} className="text-sky-700" />
              </div>
              <span className={SECTION_TITLE_CLASS}>Operacion de campo</span>
              <span className="ml-auto flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Sin viaje activo</span>
            </div>
            <p className="mt-1.5 text-sm leading-5 text-slate-600">
              Registra tu salida, visita a cliente y retorno. El acta se regulariza automaticamente.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            {renderClientPickerSection()}
          </div>
          <input
            type="text"
            value={fieldEmergencyReason}
            onChange={(e) => setFieldEmergencyReason(e.target.value)}
            placeholder="Motivo del viaje (opcional)"
            className={CONTROL_INPUT_CLASS}
            aria-label="Motivo del viaje operacional"
          />
          <Button
            variant="primary"
            onClick={handleOfficeDepartureQuick}
            disabled={fieldVisitSubmitting}
            className={ACTION_BTN_BASE_CLASS}
          >
            {fieldVisitSubmitting ? "Registrando..." : "Salida de oficina / Inicio de viaje"}
          </Button>
        </div>
      );
    }

    // Trip timeline data
    const tripSteps = [
      { label: "Salida de oficina", time: activeException?.start_time, done: Boolean(activeException?.start_time), active: exceptionStatus === "ACTIVE" && !activeException?.arrival_time },
      { label: "Llegada a destino", time: activeException?.arrival_time, done: Boolean(activeException?.arrival_time), active: exceptionStatus === "ACTIVE" && !activeException?.arrival_time },
      { label: "En sitio / con cliente", time: null, done: exceptionStatus === "ON_SITE" || exceptionStatus === "RETURNING" || exceptionStatus === "COMPLETED", active: exceptionStatus === "ON_SITE" },
      { label: "Regresando", time: activeException?.departure_time, done: Boolean(activeException?.departure_time), active: exceptionStatus === "RETURNING" },
      { label: "Cierre de viaje", time: activeException?.return_time, done: exceptionStatus === "COMPLETED", active: false },
    ];

    const tripTypeLabel = String(activeException?.type || "viaje").replace(/_/g, " ");
    const elapsedHours = Number(activeException?.operational_elapsed_hours || 0);

    if (exceptionStatus === "ACTIVE") {
      return (
        <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm">
          <div className="flex items-center justify-between bg-sky-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <FiTrendingUp size={14} className="text-white" />
              <span className="text-sm font-bold uppercase tracking-wide text-white">Viaje en curso</span>
            </div>
            <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-semibold text-white capitalize">{tripTypeLabel}</span>
          </div>
          <div className="p-4 space-y-4">
            <div className="rounded-xl bg-sky-50/60 p-3">
              {tripSteps.slice(0, 2).map((s) => (
                <TripStep key={s.label} {...s} />
              ))}
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">Estás en camino al destino. Registra tu llegada cuando estés ahí.</p>
            </div>
            <Button
              variant="success"
              onClick={handleLlegadaDestino}
              disabled={fieldVisitSubmitting}
              className={ACTION_BTN_BASE_CLASS}
            >
              {fieldVisitSubmitting ? "Registrando..." : "Llegué al destino"}
            </Button>
          </div>
        </div>
      );
    }

    if (exceptionStatus === "ON_SITE") {
      const clientEntryDisabled =
        fieldVisitSubmitting ||
        (fieldVisitType === "cronograma" && !fieldClientId) ||
        (fieldVisitType === "prospecto" && !fieldProspectName.trim());

      return (
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
          <div className="flex items-center justify-between bg-emerald-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <FiCheckCircle size={14} className="text-white" />
              <span className="text-sm font-bold uppercase tracking-wide text-white">En sitio</span>
            </div>
            {elapsedHours > 0 ? (
              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">{elapsedHours.toFixed(1)} h</span>
            ) : null}
          </div>
          <div className="p-4 space-y-4">
            <div className="rounded-xl bg-emerald-50/60 p-3">
              {tripSteps.slice(0, 3).map((s) => (
                <TripStep key={s.label} {...s} />
              ))}
            </div>

            {hasOpenFieldVisit ? (
              <>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-800">Tienes una visita de cliente abierta. Ciérrala antes de continuar.</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                  <label className="text-[11px] font-semibold text-slate-600">Después de salir del cliente</label>
                  <select
                    value={fieldExitMode}
                    onChange={(e) => setFieldExitMode(e.target.value)}
                    className={`${CONTROL_INPUT_CLASS} mt-2`}
                    aria-label="Accion despues de salir del cliente"
                  >
                    <option value="continue_operation">Continuar operacion (puede ir a otro cliente)</option>
                    <option value="return_to_office">Iniciar retorno a oficina</option>
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
                  {renderClientPickerSection()}
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
                <Button
                  variant="ghost"
                  onClick={() => handleExceptionUpdate("RETURNING", "Retorno iniciado desde destino")}
                  disabled={fieldVisitSubmitting}
                  className={ACTION_BTN_NEUTRAL_CLASS}
                >
                  Iniciar retorno a oficina (sin cliente)
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
              <span className="text-sm font-bold uppercase tracking-wide text-white">Regresando</span>
            </div>
            {elapsedHours > 0 ? (
              <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] font-semibold text-white">{elapsedHours.toFixed(1)} h total</span>
            ) : null}
          </div>
          <div className="p-4 space-y-4">
            <div className="rounded-xl bg-indigo-50/50 p-3">
              {tripSteps.map((s) => (
                <TripStep key={s.label} {...s} />
              ))}
            </div>

            <Button
              variant="success"
              onClick={handleOfficeArrivalQuick}
              disabled={fieldVisitSubmitting}
              className={ACTION_BTN_BASE_CLASS}
            >
              {fieldVisitSubmitting ? "Registrando..." : "Llegué a la oficina"}
            </Button>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-700">¿Cierras el viaje fuera de la oficina?</p>
              <input
                type="text"
                value={tripClosureReason}
                onChange={(e) => setTripClosureReason(e.target.value)}
                placeholder="Motivo del cierre fuera de oficina (opcional)"
                className={CONTROL_INPUT_CLASS}
                aria-label="Motivo del cierre fuera de oficina"
              />
              <Button
                variant="warning"
                onClick={handleCierreViaje}
                disabled={fieldVisitSubmitting}
                className={ACTION_BTN_BASE_CLASS}
              >
                {fieldVisitSubmitting ? "Cerrando..." : "Cerrar viaje fuera de oficina"}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <FiCheckCircle size={14} className="text-emerald-600" />
          <span className="text-xs font-bold uppercase tracking-wide text-emerald-800">Viaje completado</span>
        </div>
        <div className="space-y-0.5">
          {tripSteps.map((s) => (
            <TripStep key={s.label} {...s} />
          ))}
        </div>
        <p className="mt-3 text-xs text-emerald-700">El viaje fue cerrado correctamente. El acta formal fue regularizada.</p>
      </div>
    );
  };

  const launcherMode = !attendance?.entry_time
    ? "pending_entry"
    : attendance?.exit_time
      ? "exit_marked"
      : attendance?.lunch_start_time && !attendance?.lunch_end_time
        ? "lunch_marked"
        : attendance?.lunch_end_time
          ? "return_marked"
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
    const elapsedMins = hasEntry && !isDayComplete
      ? getElapsedMinutes(attendance.entry_time, currentTime)
      : 0;
    const elapsedDisplay = elapsedMins >= 60
      ? `${Math.floor(elapsedMins / 60)}h ${elapsedMins % 60}m`
      : `${elapsedMins}m`;

    const statusZoneBg = hasActiveException
      ? "bg-amber-50 border-b border-amber-200"
      : isDayComplete
        ? "bg-slate-50 border-b border-slate-200"
        : isOnLunch
          ? "bg-amber-50 border-b border-amber-200"
          : hasEntry
            ? "bg-green-50 border-b border-green-200"
            : "bg-white border-b border-gray-200";

    const statusIconBg = hasActiveException
      ? "bg-amber-100 text-amber-700"
      : isDayComplete
        ? "bg-slate-200 text-slate-600"
        : isOnLunch
          ? "bg-amber-100 text-amber-700"
          : hasEntry
            ? "bg-green-100 text-green-700"
            : "bg-slate-100 text-slate-500";

    const primaryBtnClass = !hasEntry
      ? "bg-green-600 hover:bg-green-700 text-white"
      : isOnLunch
        ? "bg-blue-600 hover:bg-blue-700 text-white"
        : attendance?.lunch_end_time
          ? "bg-[#1E293B] hover:bg-[#0F172A] text-white"
          : "bg-amber-500 hover:bg-amber-600 text-white";

    const primaryBtnLabel = loading
      ? "Registrando..."
      : locationLoading
        ? "Obteniendo ubicacion..."
        : !hasEntry
          ? "Marcar entrada"
          : isOnLunch
            ? "Regresar de almuerzo"
            : attendance?.lunch_end_time
              ? "Finalizar jornada"
              : "Salir a almuerzo";

    doClockOutRef.current = () => handle(clockOut, "Buen trabajo!", true, {
      syncTarget: "exit",
      onSuccess: async (res) => {
        if (Number(res?.overtime?.hours || 0) > 0) {
          setOvertimePrompt({ hours: Number(res.overtime.hours) });
          setOvertimeReason("");
        }
      },
    });

    const handlePrimaryAction = !hasEntry
      ? () => handle(clockIn, "Entrada registrada", false, { syncTarget: "entry" })
      : isOnLunch
        ? () => handle(clockInLunch, "Regresaste del almuerzo", false, { syncTarget: "lunch_end" })
        : attendance?.lunch_end_time
          ? () => setExitConfirmOpen(true)
          : () => handle(clockOutLunch, "Buen provecho", false, { syncTarget: "lunch_start" });

    return (
      <div className={SECTION_PANEL_CLASS}>
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
                {hasActiveException ? "Excepción activa" : status.text}
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
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  className={`h-full rounded-full ${isOnLunch ? "bg-amber-400" : "bg-emerald-500"}`}
                />
              </div>
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

          {renderExceptionBanner()}

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
            <div>
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
            </div>
          )}
        </div>

        {/* ACCORDIONS */}
        <div className="border-t border-slate-100 px-4 pb-4 pt-2 sm:px-5">
          <div className="space-y-1.5">

            {/* Jornada del día */}
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setShowTimelineDetails((prev) => !prev)}
                className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50"
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
                <div className="border-t border-slate-100 px-4 pb-4 pt-3">
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

            {/* Operaciones de campo */}
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setShowFieldTools((prev) => !prev)}
                className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center gap-2.5">
                  <FiTrendingUp size={14} className="flex-shrink-0 text-slate-400" />
                  <div>
                    <span className="text-xs font-semibold text-slate-700">Operaciones de campo</span>
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
                <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                  {renderFieldOperationsControls()}
                </div>
              )}
            </div>

            {/* Salidas inesperadas */}
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setShowExceptionTools((prev) => !prev)}
                className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center gap-2.5">
                  <FiAlertTriangle size={14} className={`flex-shrink-0 ${hasActiveException && !isFieldOperationFlow ? "text-amber-500" : "text-slate-400"}`} />
                  <div>
                    <span className="text-xs font-semibold text-slate-700">Salidas inesperadas</span>
                    {hasActiveException && !isFieldOperationFlow && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Activa
                      </span>
                    )}
                  </div>
                </div>
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-slate-400">
                  {showExceptionTools ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                </span>
              </button>
              {showExceptionTools && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                  {renderExceptionControls()}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* PUNTUALIDAD + HISTORIAL */}
        <div className="border-t border-slate-100 px-4 pb-6 pt-4 sm:px-5">
          <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
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
            <div className="overflow-hidden rounded-xl border border-slate-200">
              {recentHistory.length ? recentHistory.map((row, idx) => (
                <div
                  key={`${row.date}-${row.id}`}
                  className={`grid grid-cols-[60px_minmax(0,1fr)_52px] items-center gap-3 px-3 py-2.5 ${idx < recentHistory.length - 1 ? "border-b border-slate-100" : ""}`}
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
        isOpen={exceptionModalOpen}
        onClose={() => setExceptionModalOpen(false)}
        title="Registrar salida inesperada"
        maxWidth="max-w-md"
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              Registra tu salida por motivos excepcionales para mantener trazabilidad.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-800">
              Tipo de salida
            </label>
            <select
              className={CONTROL_INPUT_CLASS}
              value={exceptionType}
              onChange={(e) => handleExceptionTypeChange(e.target.value)}
              aria-label="Tipo de salida inesperada"
            >
              <option value="">Selecciona un motivo...</option>
              <option value="permiso">Permiso personal</option>
              <option value="medico">Cita medica</option>
              <option value="proveedor">Reunion con proveedor</option>
              <option value="otro">Otro motivo</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-800">
              Descripcion detallada
            </label>
            <textarea
              className={CONTROL_TEXTAREA_CLASS}
              rows="3"
              placeholder="Describe brevemente el motivo de tu salida..."
              value={exceptionDescription}
              onChange={(e) => setExceptionDescription(e.target.value)}
              aria-label="Descripcion de la salida inesperada"
            />
            <p className="mt-1 text-xs text-gray-500">
              Incluye detalles como destino y duracion aproximada.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              onClick={() => setExceptionModalOpen(false)}
              className={ACTION_BTN_MODAL_SECONDARY_CLASS}
            >
              Cancelar
            </button>
            <Button
              variant="warning"
              onClick={handleRegisterException}
              disabled={exceptionLoading}
              className={ACTION_BTN_MODAL_PRIMARY_CLASS}
            >
              {exceptionLoading ? "Registrando..." : "Registrar salida"}
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


