import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiClock, FiCoffee, FiSun, FiMoon, FiAlertTriangle, FiTrendingUp, FiChevronDown, FiChevronUp, FiCheckCircle } from "react-icons/fi";
import confetti from "canvas-confetti";

import Button from "../components/Button";
import Card from "../components/Card";
import Modal from "../components/Modal";
import { useUI } from "../useUI";

import {
 clockIn,
 clockOutLunch,
 clockInLunch,
 clockOut,
 marcarVisitaEntrada,
 marcarVisitaSalida,
 markOvertime,
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
import { getPreciseLocation } from "../../../shared/utils/preciseGeolocation";

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

const APPROVED_PERMISSION_STATUSES = new Set(["approved", "aprobado", "partially_approved"]);
const ATTENDANCE_STATUS_LABELS = Object.freeze({
 no_entry: "Sin entrada",
 working: "Jornada abierta",
 lunch_open: "Almuerzo abierto",
 completed: "Jornada cerrada",
});

const getLocalDateKey = (date = new Date()) => {
 const year = date.getFullYear();
 const month = String(date.getMonth() + 1).padStart(2, "0");
 const day = String(date.getDate()).padStart(2, "0");
 return `${year}-${month}-${day}`;
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

const deriveAttendanceState = (record = {}) => {
 if (!record?.entry_time) return "no_entry";
 if (record?.exit_time) return "completed";
 if (record?.lunch_start_time && !record?.lunch_end_time) return "lunch_open";
 return "working";
};

const getPunctualityState = (entryTime) => {
 const parsed = toDate(entryTime);
 if (!parsed) {
  return { state: "no_entry", minutesLate: null, points: 0 };
 }

 const minutes = parsed.getHours() * 60 + parsed.getMinutes();
 const delta = minutes - PUNCTUALITY_BASE_MINUTES;
 if (delta <= PUNCTUALITY_TOLERANCE_MINUTES) {
  return { state: "on_time", minutesLate: 0, points: 3 };
 }

 if (delta <= 15) {
  return { state: "slight_late", minutesLate: delta, points: 2 };
 }

 return { state: "late", minutesLate: delta, points: 1 };
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

const AttendanceWidget = () => {
 const { showToast } = useUI();
 const { user } = useAuth();

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
 const [showFieldTools, setShowFieldTools] = useState(true);
 const [fieldVisitType, setFieldVisitType] = useState("cronograma");
 const [selectedFieldAction, setSelectedFieldAction] = useState("office_exit");
 const [fieldClientId, setFieldClientId] = useState("");
 const [fieldProspectName, setFieldProspectName] = useState("");
 const [fieldEmergencyReason, setFieldEmergencyReason] = useState("");
 const [fieldVisitNotes, setFieldVisitNotes] = useState("");
 const [fieldVisitSubmitting, setFieldVisitSubmitting] = useState(false);
 const [scheduledClientsToday, setScheduledClientsToday] = useState([]);
 const [scheduledClientsLoading, setScheduledClientsLoading] = useState(false);
 const [emergencyClients, setEmergencyClients] = useState([]);
 const [emergencyClientsLoading, setEmergencyClientsLoading] = useState(false);
 const [fieldEmergencyClientId, setFieldEmergencyClientId] = useState("");
 const autoOpenSessionRef = useRef(null);
 const FIELD_OPERATION_EXCEPTION_TYPES = useMemo(
 () => new Set(["operacion_campo", "operacion_de_campo", "salida_oficina", "viaje", "campo"]),
 [],
 );

 useEffect(() => {
 const timer = setInterval(() => setCurrentTime(new Date()), 1000);
 return () => clearInterval(timer);
 }, []);

 useEffect(() => {
 refreshAll();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 useEffect(() => {
 if (user?.id) {
 refreshAll();
 }
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
 setAttendance(res.data);
 } catch (err) {
 console.error(err);
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

 /**
 * Geolocalizacion priorizando precision:
 * - GPS alta precision + muestreo corto
 * - cache corta solo si la precision sigue siendo aceptable
 * - fallback limpio sin bloquear el registro de asistencia
 */
  const getLocation = async (showErrors = true) => {
 const CACHE_DURATION_MS = 2 * 60 * 1000;
 const MAX_ACCEPTABLE_CACHE_ACCURACY = 50;
 if (
  cachedLocation &&
  locationTimestamp &&
  (Date.now() - locationTimestamp) < CACHE_DURATION_MS &&
  Number.isFinite(Number(cachedLocationAccuracy)) &&
  Number(cachedLocationAccuracy) <= MAX_ACCEPTABLE_CACHE_ACCURACY
 ) {
  return cachedLocation;
 }

  try {
  setLocationLoading(true);

  const precise = await getPreciseLocation({
   desiredAccuracyMeters: 40,
   goodAccuracyMeters: 25,
   highAccuracyTimeoutMs: 7000,
   sampleWindowMs: 4500,
   sampleCount: 2,
  });

  if (!precise?.location) {
   return null;
  }

  setCachedLocation(precise.location);
  setCachedLocationAccuracy(precise.accuracy ?? null);
  setLocationTimestamp(Date.now());

  if (showErrors && Number(precise.accuracy) > 120) {
   showToast(
    `Ubicacion registrada con precision baja (~${Math.round(precise.accuracy)}m).`,
    "warning"
   );
  }

  return precise.location;
 } catch (err) {
 console.warn("Geolocation warning:", err);

 // If precise GPS timed out/unavailable, try a faster/lower-precision browser fallback.
 if (err?.code === 3 || err?.code === 2) {
  const fallback = await getBrowserLocationFallback();
  if (fallback) {
   const normalizedLocation = {
    latitude: fallback.latitude,
    longitude: fallback.longitude,
   };
   setCachedLocation(normalizedLocation);
   setCachedLocationAccuracy(fallback.accuracy || null);
   setLocationTimestamp(Date.now());
   return normalizedLocation;
  }
 }

 // Handle different error types gracefully
 if (showErrors) {
 let msg = "No se pudo obtener ubicacion.";
 if (err.code === 1) {
 msg = "Permiso de ubicacion denegado. El registro continuara sin ubicacion.";
 } else if (err.code === 2) {
 msg = "Ubicacion no disponible. El registro continuara sin ubicacion.";
 } else if (err.code === 3) {
 msg = "Tiempo de espera agotado. El registro continuara sin ubicacion.";
 }
 showToast(msg, "warning");
 }

 return null; // Allow attendance without location
 } finally {
 setLocationLoading(false);
 }
  };

  const getLocationForAction = async () => {
 const ACTION_WAIT_LIMIT_MS = 4200;
 const precisePromise = getLocation(false);
 const timeoutPromise = new Promise((resolve) => {
 setTimeout(() => resolve(cachedLocation || null), ACTION_WAIT_LIMIT_MS);
 });

 const fastResult = await Promise.race([precisePromise, timeoutPromise]);
 if (fastResult) return fastResult;

 // Continue warming precise location in background for posterior sync.
 Promise.resolve()
 .then(() => getLocation(false))
 .catch(() => null);

 return null;
  };

 const queueLocationSync = (target) => {
 if (!target) return;

 Promise.resolve()
 .then(() => getLocation(false))
 .then((location) => {
 if (!location) return null;
 return syncAttendanceLocation(target, location);
 })
 .catch((err) => {
 console.warn("Silent location sync failed:", err?.message || err);
 });
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

 try {
 const res = await fn(await getLocationForAction());

 if (res.ok) {
 if (options.syncTarget) {
 queueLocationSync(options.syncTarget);
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
 showToast(err.response?.data?.message || err.message || "Error registrando asistencia", "error");
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

 setExceptionLoading(true);
 try {
 const res = await registerException(finalType, finalDescription, await getLocationForAction());
 if (res.ok) {
 queueLocationSync("start");
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
 const msg = err.response?.data?.message || err.message || "Error registrando salida";
 showToast(msg, "error");
 } finally {
 setExceptionLoading(false);
 }
 };

 /**
 * Optimized exception status update with background geolocation
 */
 const handleExceptionUpdate = async (status, successMsg) => {
 setLoading(true);
 try {
 const res = await updateExceptionStatus(status, await getLocationForAction());
 if (res.ok) {
 const targetMap = {
 ON_SITE: "arrival",
 RETURNING: "departure",
 COMPLETED: "return",
 };
 queueLocationSync(targetMap[status]);
 showToast(successMsg, "success");
 await refreshAll();
 } else {
 showToast("Error actualizando estado", "error");
 }
 } catch (err) {
 console.error("Exception update error:", err);
 const msg = err.response?.data?.message || err.message || "Error actualizando estado";
 showToast(msg, "error");
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
 const exists = scheduledClientsToday.some((client) => String(client.id) === String(fieldClientId));
 if (!exists) {
 setFieldClientId(String(scheduledClientsToday[0].id));
 }
 }, [fieldClientId, fieldVisitType, scheduledClientsToday]);

 useEffect(() => {
 if (fieldVisitType !== "emergencia") return;
 if (!emergencyClients.length) {
 setFieldEmergencyClientId("");
 return;
 }
 const exists = emergencyClients.some((client) => String(client.id) === String(fieldEmergencyClientId));
 if (!exists) {
 setFieldEmergencyClientId(String(emergencyClients[0].id));
 }
 }, [emergencyClients, fieldEmergencyClientId, fieldVisitType]);

 const buildFieldVisitPayload = async ({ includeObservations = false } = {}) => {
 const payload = {};
 const location = await getLocationForAction();
 if (location) {
 payload.location = `${location.latitude},${location.longitude}`;
 }

 if (fieldVisitType === "cronograma") {
 const numericClientId = Number(fieldClientId);
 if (!Number.isInteger(numericClientId) || numericClientId <= 0) {
 throw new Error("Debes seleccionar un cliente planificado del cronograma del dia.");
 }
 payload.client_id = numericClientId;
 } else if (fieldVisitType === "prospecto") {
 const normalizedName = String(fieldProspectName || "").trim();
 if (!normalizedName) {
 throw new Error("Para prospecto debes ingresar un nombre.");
 }
 payload.prospect_name = normalizedName;
 } else {
 const numericEmergencyClientId = Number(fieldEmergencyClientId);
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
 const payload = await buildFieldVisitPayload({ includeObservations: kind === "exit" });
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
 setSelectedFieldAction("office_entry");
 }
 await refreshAll();
 } else {
 showToast("No se pudo registrar la visita de campo.", "error");
 }
 } catch (err) {
 showToast(err?.response?.data?.message || err?.message || "Error registrando visita de campo", "error");
 } finally {
 setFieldVisitSubmitting(false);
 }
 };

 const handleOfficeDepartureQuick = async () => {
 if (hasActiveException) {
 showToast("Ya tienes una operacion de campo activa.", "info");
 return;
 }

 const emergencyDetail = String(fieldEmergencyReason || "").trim();
 const description = emergencyDetail
 ? `Salida de oficina para atencion: ${emergencyDetail}`
 : "Salida de oficina para gestion de campo";

 setFieldVisitSubmitting(true);
 try {
 const res = await registerException("operacion_campo", description, await getLocationForAction());
 if (res?.ok) {
 showToast("Salida de oficina registrada.", "success");
 setSelectedFieldAction("client_entry");
 await refreshAll();
 } else {
 showToast("No se pudo registrar la salida de oficina.", "error");
 }
 } catch (err) {
 showToast(err?.response?.data?.message || err?.message || "Error registrando salida de oficina", "error");
 } finally {
 setFieldVisitSubmitting(false);
 }
 };

 const handleOfficeArrivalQuick = async () => {
 if (!hasActiveException) {
 showToast("No tienes una salida de oficina activa para cerrar.", "warning");
 return;
 }

 setFieldVisitSubmitting(true);
 try {
 const res = await updateExceptionStatus("COMPLETED", await getLocationForAction());
 if (res?.ok) {
 showToast("Entrada a oficina registrada.", "success");
 setSelectedFieldAction("office_exit");
 await refreshAll();
 } else {
 showToast("No se pudo registrar la entrada a oficina.", "error");
 }
 } catch (err) {
 showToast(err?.response?.data?.message || err?.message || "Error registrando entrada a oficina", "error");
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
 showToast(err.response?.data?.message || err.message || "Error registrando overtime", "error");
 } finally {
 setOvertimeSubmitting(false);
 }
 };

 const progress = calculateProgress();
 const status = getStatusInfo();
 const attendanceState = attendance?.attendance_status || deriveAttendanceState(attendance);
 const attendanceStateLabel = attendance?.attendance_status_label || ATTENDANCE_STATUS_LABELS[attendanceState] || "Sin estado";
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
   entryMinutes: (() => {
    const parsed = toDate(row?.entry_time);
    return parsed ? (parsed.getHours() * 60 + parsed.getMinutes()) : Number.POSITIVE_INFINITY;
   })(),
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
 const hasActiveException = Boolean(activeException);
 const normalizedActiveExceptionType = String(activeException?.type || "").trim().toLowerCase();
 const isFieldOperationFlow = hasActiveException && FIELD_OPERATION_EXCEPTION_TYPES.has(normalizedActiveExceptionType);
 const exceptionStatus = activeException?.status || "NONE";

 useEffect(() => {
 if (isFieldOperationFlow && selectedFieldAction === "office_exit") {
 setSelectedFieldAction("client_entry");
 }
 if (!isFieldOperationFlow && exceptionStatus === "NONE" && selectedFieldAction === "office_entry") {
 setSelectedFieldAction("office_exit");
 }
 }, [exceptionStatus, isFieldOperationFlow, selectedFieldAction]);
 const exceptionStepLabel =
 {
 ACTIVE: "En ruta",
 ON_SITE: "En sitio",
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

 return [
 ...baseEntries,
 {
 label: "Salida inesperada",
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
 }, [activeException?.status, attendance?.entry_time, attendance?.exit_time, attendance?.lunch_end_time, attendance?.lunch_start_time, hasActiveException]);

 const reminderMeta = useMemo(() => {
 const now = currentTime;

 if (hasActiveException) {
 if (activeException?.status === "ACTIVE") {
 return {
 key: "exception-active",
 text: "Tienes una salida inesperada en curso. Confirma la llegada al destino cuando corresponda.",
 };
 }

 if (activeException?.status === "ON_SITE") {
 return {
 key: "exception-on-site",
 text: "La salida inesperada sigue abierta. Registra la salida del destino cuando termines la gestion.",
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
 text: "La entrada suele quedar registrada con el login. Si no aparece, puedes marcarla manualmente aqui.",
 };
 }

 return null;
 }, [
 activeException?.status,
 attendance?.entry_time,
 attendance?.exit_time,
 attendance?.lunch_end_time,
 attendance?.lunch_start_time,
 attendance?.total_hours,
 currentTime,
 hasActiveException,
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

 const primaryActionConfig = (() => {
 if (hasActiveException || attendance?.exit_time) return null;

 if (!attendance?.entry_time) {
 return {
 label: "Marcar entrada",
 detail: "Registra el inicio de tu jornada o corrige la entrada si el login no la reflejo.",
 action: () => handle(clockIn, "Entrada registrada", false, { syncTarget: "entry" }),
 tone: "from-emerald-600 via-emerald-500 to-green-500",
 accent: "border-emerald-200 bg-emerald-50 text-emerald-900",
 icon: <FiSun className="text-emerald-100" size={20} />,
 };
 }

 if (attendance?.lunch_start_time && !attendance?.lunch_end_time) {
 return {
 label: "Regresar de almuerzo",
 detail: "Vuelve a dejar constancia de tu jornada activa.",
 action: () => handle(clockInLunch, "Regresaste del almuerzo", false, { syncTarget: "lunch_end" }),
 tone: "from-blue-600 via-sky-500 to-cyan-500",
 accent: "border-sky-200 bg-sky-50 text-sky-900",
 icon: <FiCoffee className="text-sky-100" size={20} />,
 };
 }

 if (attendance?.lunch_end_time) {
 return {
 label: "Finalizar jornada",
 detail: "Cierra tu dia laboral y registra horas extra si el sistema las detecta.",
 action: () =>
 handle(
 clockOut,
 "Buen trabajo",
 true,
 {
 syncTarget: "exit",
 onSuccess: async (res) => {
 if (Number(res?.overtime?.hours || 0) > 0) {
 setOvertimePrompt({ hours: Number(res.overtime.hours) });
 setOvertimeReason("");
 }
 },
 },
 ),
 tone: "from-indigo-700 via-indigo-600 to-slate-700",
 accent: "border-indigo-200 bg-indigo-50 text-indigo-900",
 icon: <FiMoon className="text-indigo-100" size={20} />,
 };
 }

 return {
 label: "Salir a almuerzo",
 detail: "Registra la pausa de almuerzo cuando inicies ese tramo.",
 action: () => handle(clockOutLunch, "Buen provecho", false, { syncTarget: "lunch_start" }),
 tone: "from-amber-500 via-orange-500 to-amber-600",
 accent: "border-amber-200 bg-amber-50 text-amber-900",
 icon: <FiCoffee className="text-amber-100" size={20} />,
 };
 })();

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
 <div className="mb-6 p-5 rounded-2xl border-2 border-amber-200/60 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 shadow-sm">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-amber-100 rounded-xl">
 <FiAlertTriangle className="text-amber-600" size={20} />
 </div>
 <div>
 <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wider">
 Salida Inesperada Activa
 </h4>
 <p className="text-sm font-semibold text-amber-800">{exceptionStepLabel}</p>
 </div>
 </div>
 <div className="text-right">
 <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
 {activeException.type}
 </span>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 {items.map((item) => (
 <div
 key={item.label}
 className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-3 border border-amber-100/50 shadow-sm"
 >
 <span className="text-lg">{item.icon}</span>
 <div className="flex-1">
 <div className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
 {item.label}
 </div>
 <div className="text-sm font-mono font-bold text-amber-800">
 {formatDateTime(item.value)}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 );
 };

 const renderExceptionControls = () => {
 if (isFieldOperationFlow) return null;
 if (!hasActiveException) {
 return (
 <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 mt-2">
 <div className="flex items-center gap-2 text-amber-800 mb-2">
 <FiAlertTriangle size={14} />
 <span className="text-xs font-semibold uppercase">Salida inesperada</span>
 </div>
 <p className="text-xs text-amber-700 mb-3">
 Registra una salida inesperada solo cuando aplique una excepcion fuera del flujo normal.
 </p>
 <Button
 onClick={() => setExceptionModalOpen(true)}
 className="w-full text-xs py-2 bg-amber-500 hover:bg-amber-600"
 disabled={loading}
 >
 Registrar salida inesperada
 </Button>
 </div>
 );
 }

 return (
 <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
 <div className="flex items-center gap-2 mb-2 text-amber-800">
 <FiAlertTriangle size={14} />
 <span className="text-xs font-bold uppercase tracking-wider">
 Salida en curso: {activeException.type}
 </span>
 </div>

 {activeException.status === "ACTIVE" && (
 <>
 <p className="text-xs text-amber-700 mb-3">Estas en camino a tu destino.</p>
 <Button
 onClick={() => handleExceptionUpdate("ON_SITE", "Has llegado a tu destino")}
 className="w-full text-xs py-2 bg-amber-500 hover:bg-amber-600"
 disabled={loading}
 >
 Llegue a destino
 </Button>
 </>
 )}

 {activeException.status === "ON_SITE" && (
 <>
 <p className="text-xs text-amber-700 mb-3">Estas en el sitio. Registra cuando salgas.</p>
 <Button
 onClick={() => handleExceptionUpdate("RETURNING", "Has salido del destino")}
 className="w-full text-xs py-2 bg-amber-500 hover:bg-amber-600"
 disabled={loading}
 >
 Salir de destino
 </Button>
 </>
 )}

 {activeException.status === "RETURNING" && (
 <>
 <p className="text-xs text-amber-700 mb-3">Estas regresando a la oficina.</p>
 <Button
 onClick={() => handleExceptionUpdate("COMPLETED", "Ciclo de salida completado")}
 className="w-full text-xs py-2 bg-green-600 hover:bg-green-700"
 disabled={loading}
 >
 Llegue a oficina
 </Button>
 </>
 )}
 </div>
 );
 };

 const renderFieldOperationsControls = () => {
 if (!canUseFieldOperations) return null;
 const isClientAction = selectedFieldAction === "client_entry" || selectedFieldAction === "client_exit";
 const actionLabelMap = {
 office_exit: "Salida de oficina o viaje",
 office_entry: "Entrada a oficina o viaje",
 client_entry: "Entrada cliente",
 client_exit: "Salida cliente",
 };

 const executeSelectedFieldAction = async () => {
 if (selectedFieldAction === "office_exit") {
 await handleOfficeDepartureQuick();
 return;
 }
 if (selectedFieldAction === "office_entry") {
 await handleOfficeArrivalQuick();
 return;
 }
 if (selectedFieldAction === "client_entry") {
 await handleFieldVisitMark("entry");
 return;
 }
 await handleFieldVisitMark("exit");
 };

 return (
 <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
 <div className="mb-2 flex items-center gap-2 text-blue-800">
 <FiClock size={14} />
 <span className="text-xs font-semibold uppercase">Operacion de campo</span>
 </div>
 <p className="mb-3 text-xs text-blue-700">
 Marca salida/entrada de oficina o viaje y entrada/salida de cliente para cronograma, prospecto o emergencia.
 </p>

 <div className="space-y-2">
 <label className="text-[11px] font-semibold text-blue-800">Accion a registrar</label>
 {isFieldOperationFlow ? (
 <div className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-900">
 {actionLabelMap[selectedFieldAction] || "Operacion de campo activa"}
 </div>
 ) : (
 <select
 value={selectedFieldAction}
 onChange={(e) => setSelectedFieldAction(e.target.value)}
 className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
 >
 <option value="office_exit">Salida de oficina o viaje</option>
 <option value="office_entry">Entrada a oficina o viaje</option>
 <option value="client_entry">Entrada cliente</option>
 <option value="client_exit">Salida cliente</option>
 </select>
 )}

 {selectedFieldAction === "office_exit" ? (
 <input
 type="text"
 value={fieldEmergencyReason}
 onChange={(e) => setFieldEmergencyReason(e.target.value)}
 placeholder="Motivo de salida de oficina (opcional)"
 className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
 />
 ) : null}

 {isClientAction ? (
 <>
 <label className="text-[11px] font-semibold text-blue-800">Tipo de gestion</label>
 <select
 value={fieldVisitType}
 onChange={(e) => setFieldVisitType(e.target.value)}
 className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
 >
 <option value="cronograma">Cliente de cronograma</option>
 <option value="prospecto">Prospecto</option>
 <option value="emergencia">Emergencia</option>
 </select>

 {fieldVisitType === "cronograma" ? (
 <select
 value={fieldClientId}
 onChange={(e) => setFieldClientId(e.target.value)}
 className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
 >
 <option value="">
 {scheduledClientsLoading ? "Cargando clientes del cronograma..." : "Selecciona cliente planificado"}
 </option>
 {scheduledClientsToday.map((client) => (
 <option key={client.id} value={String(client.id)}>
 {client.name} · {client.city} · ID {client.id}
 </option>
 ))}
 </select>
 ) : null}

 {fieldVisitType === "prospecto" ? (
 <input
 type="text"
 value={fieldProspectName}
 onChange={(e) => setFieldProspectName(e.target.value)}
 placeholder="Nombre del prospecto"
 className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
 />
 ) : null}

 {fieldVisitType === "emergencia" ? (
 <select
 value={fieldEmergencyClientId}
 onChange={(e) => setFieldEmergencyClientId(e.target.value)}
 className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
 >
 <option value="">
 {emergencyClientsLoading
 ? "Cargando clientes registrados/asignados..."
 : "Selecciona cliente registrado o asignado"}
 </option>
 {emergencyClients.map((client) => (
 <option key={client.id} value={String(client.id)}>
 {client.name} · {client.city} · ID {client.id}
 </option>
 ))}
 </select>
 ) : null}

 {fieldVisitType === "emergencia" ? (
 <input
 type="text"
 value={fieldEmergencyReason}
 onChange={(e) => setFieldEmergencyReason(e.target.value)}
 placeholder="Motivo de emergencia"
 className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
 />
 ) : null}

 <textarea
 rows={2}
 value={fieldVisitNotes}
 onChange={(e) => setFieldVisitNotes(e.target.value)}
 placeholder="Observaciones (opcional)"
 className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
 />
 </>
 ) : null}
 </div>

 <div className="mt-3 grid grid-cols-1">
 <Button
 className="text-xs"
 onClick={executeSelectedFieldAction}
 disabled={fieldVisitSubmitting || (isClientAction && fieldVisitType === "cronograma" && !fieldClientId)}
 >
 {fieldVisitSubmitting ? "Registrando..." : `Registrar ${actionLabelMap[selectedFieldAction] || "accion"}`}
 </Button>
 </div>
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

 const renderWidgetContent = () => (
 <Card className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_35%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.98))] p-4 shadow-xl shadow-slate-200/60 sm:p-6">
 <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-blue-600/6 via-cyan-500/6 to-emerald-500/6" aria-hidden="true" />

 <div className="relative mb-5 flex flex-col gap-4 border-b border-slate-200/80 pb-5 md:flex-row md:items-start md:justify-between">
 <div className="flex items-center gap-3">
 <div className="rounded-[24px] bg-slate-900 p-3 text-white shadow-md shadow-slate-900/10">
 {status.icon}
 </div>
 <div>
 <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
 Asistencia diaria
 </div>
 <h3 className="text-xl font-bold tracking-tight text-slate-950">Control de jornada</h3>
 <p className="text-sm text-slate-600">
 {formatDateSafe(attendance?.date || new Date(), "dd/MM/yyyy")} - {status.text}
 </p>
 </div>
 </div>

 <div className="flex flex-wrap items-center gap-2">
 <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${dayStatusBadge}`}>
 {hasActiveException ? "Excepcion activa" : status.text}
 </span>
 <span className="inline-flex items-center justify-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-mono font-bold text-white">
 {formatTimeSafe(currentTime, "HH:mm:ss")}
 </span>
 </div>
 </div>

 <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
 {summaryCards.map((card) => (
 <div key={card.label} className="rounded-[24px] border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
 <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
 {card.label}
 </div>
 <div className="mt-2 text-sm font-bold text-slate-950">{card.value}</div>
 <div className="mt-1 text-xs leading-5 text-slate-600">{card.hint}</div>
 </div>
 ))}
 </div>

 {reminderMessage && (
 <div className="mb-4 rounded-[24px] border border-amber-200 bg-gradient-to-r from-amber-50 to-white px-4 py-3 shadow-sm">
 <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-700">
 Recordatorio operativo
 </div>
 <div className="mt-1 text-sm leading-6 text-amber-950">{reminderMessage}</div>
 </div>
 )}

 {/* Progress Section */}
 {attendance?.entry_time && !attendance?.exit_time && (
 <div className="mb-4 rounded-[26px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
 <div className="mb-3 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <FiTrendingUp className="text-blue-600" size={14} />
 <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600">Progreso</span>
 </div>
 <span className="text-lg font-bold text-slate-950">{progress}%</span>
 </div>
 <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
 <motion.div
 initial={{ width: 0 }}
 animate={{ width: `${progress}%` }}
 transition={{ type: "spring", stiffness: 120, damping: 20 }}
 className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"
 />
 </div>
 <div className="mt-2 text-[11px] font-medium text-slate-500">
 Jornada laboral de 8 horas
 </div>
 </div>
 )}

 {renderExceptionBanner()}

 {/* Primary Action Section */}
 {!attendance?.exit_time && !hasActiveException && (
 <div className={`mb-4 rounded-[28px] border px-4 py-4 shadow-sm ${primaryActionConfig?.accent || "border-slate-200 bg-white text-slate-900"}`}>
 <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
 <div>
 <h4 className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-70">Siguiente accion</h4>
 <div className="mt-2 text-xl font-bold tracking-tight">{nextActionMeta.label}</div>
 <p className="mt-2 text-sm leading-6 opacity-80">{nextActionMeta.detail}</p>
 </div>
 {primaryActionConfig && (
 <div className={`hidden rounded-2xl bg-gradient-to-br ${primaryActionConfig.tone} p-3 text-white shadow-lg sm:block`}>
 {primaryActionConfig.icon}
 </div>
 )}
 </div>
 {attendance?.entry_time ? (
 <Button
 onClick={() =>
 attendance?.lunch_start_time && !attendance?.lunch_end_time
 ? handle(clockInLunch, "Regresaste del almuerzo", false, { syncTarget: "lunch_end" })
 : attendance?.lunch_end_time
 ? handle(
 clockOut,
 "Buen trabajo!",
 true,
 {
 syncTarget: "exit",
 onSuccess: async (res) => {
 if (Number(res?.overtime?.hours || 0) > 0) {
 setOvertimePrompt({ hours: Number(res.overtime.hours) });
 setOvertimeReason("");
 }
 },
 },
 )
 : handle(clockOutLunch, "Buen provecho", false, { syncTarget: "lunch_start" })
 }
 disabled={loading || locationLoading}
 className={`min-h-[56px] w-full justify-center rounded-[22px] bg-gradient-to-r px-5 py-4 text-sm shadow-lg shadow-slate-200 ${primaryActionConfig?.tone || "from-blue-600 to-indigo-600"}`}
 >
 {loading ? "Registrando..." :
 locationLoading ? "Obteniendo ubicacion..." :
 attendance?.lunch_start_time && !attendance?.lunch_end_time
 ? "Regresar de almuerzo"
 : attendance?.lunch_end_time
 ? "Finalizar jornada"
 : "Salir a almuerzo"}
 </Button>
 ) : (
 <Button
 onClick={() => handle(clockIn, "Entrada registrada", false, { syncTarget: "entry" })}
 disabled={loading || locationLoading}
 className={`min-h-[56px] w-full justify-center rounded-[22px] bg-gradient-to-r px-5 py-4 text-sm shadow-lg shadow-slate-200 ${primaryActionConfig?.tone || "from-emerald-600 to-green-600"}`}
 >
 {loading ? "Registrando entrada..." :
 locationLoading ? "Obteniendo ubicacion..." :
 "Marcar entrada"}
 </Button>
 )}
 </div>
 )}
 <div className="space-y-4">
 <div className="rounded-[26px] border border-slate-200 bg-white shadow-sm">
 <button
 type="button"
 onClick={() => setShowTimelineDetails((prev) => !prev)}
 className="flex w-full items-center justify-between px-4 py-4 text-left"
 >
 <div>
 <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
 Secuencia de la jornada
 </div>
 <div className="text-sm text-slate-600">
 Consulta tus marcas de hoy.
 </div>
 </div>
 <span className="rounded-full border border-slate-200 bg-slate-50 p-2 text-slate-500">
 {showTimelineDetails ? <FiChevronUp className="text-slate-500" /> : <FiChevronDown className="text-slate-500" />}
 </span>
 </button>
 {showTimelineDetails && (
 <div className="border-t border-slate-200 px-4 pb-4 pt-3">
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
 {timelineSteps.map((entry, index) => (
 <motion.div
 key={`${entry.label}-${entry.value ?? "pending"}`}
 whileHover={{ y: -2, scale: 1.01 }}
 className={`rounded-[24px] border p-3 shadow-sm transition-all duration-200 ${
 entry.state === "done"
 ? "border-emerald-200 bg-emerald-50 text-emerald-900"
 : entry.state === "current"
 ? "border-blue-200 bg-blue-50 text-blue-900"
 : "border-slate-200 bg-slate-50 text-slate-800"
 }`}
 >
 <div className="mb-2 flex items-center gap-2">
 <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
 entry.state === "done"
 ? "bg-emerald-600 text-white"
 : entry.state === "current"
 ? "bg-blue-600 text-white"
 : "bg-slate-300 text-slate-700"
 }`}>
 {entry.state === "done" ? <FiCheckCircle size={14} /> : index + 1}
 </span>
 <div className="text-[10px] font-semibold uppercase tracking-[0.24em] opacity-75">
 {entry.label}
 </div>
 </div>
 <div className="text-sm font-mono font-bold">{formatTime(entry.value)}</div>
 {entry.note && (
 <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
 {entry.note}
 </div>
 )}
 </motion.div>
 ))}
 </div>
 </div>
 )}
 </div>

 <div className="rounded-[26px] border border-blue-200 bg-gradient-to-b from-blue-50/80 to-white shadow-sm">
 <button
 type="button"
 onClick={() => setShowFieldTools((prev) => !prev)}
 className="flex w-full items-center justify-between px-4 py-4 text-left"
 >
 <div>
 <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
 Operaciones de campo
 </div>
 <div className="text-sm text-slate-600">
 Entrada/salida de oficina o viaje y entrada/salida cliente.
 </div>
 </div>
 <span className="rounded-full border border-slate-200 bg-slate-50 p-2 text-slate-500">
 {showFieldTools ? <FiChevronUp className="text-slate-500" /> : <FiChevronDown className="text-slate-500" />}
 </span>
 </button>
 {showFieldTools && (
 <div className="border-t border-slate-200 px-4 pb-4 pt-3">
 {renderFieldOperationsControls()}
 </div>
 )}
 </div>

 <div className="rounded-[26px] border border-amber-200 bg-gradient-to-b from-amber-50/80 to-white shadow-sm">
 <button
 type="button"
 onClick={() => setShowExceptionTools((prev) => !prev)}
 className="flex w-full items-center justify-between px-4 py-4 text-left"
 >
 <div>
 <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
 Salidas inesperadas
 </div>
 <div className="text-sm text-slate-600">
 Usa este bloque solo para excepciones.
 </div>
 </div>
 <span className="rounded-full border border-slate-200 bg-slate-50 p-2 text-slate-500">
 {showExceptionTools ? <FiChevronUp className="text-slate-500" /> : <FiChevronDown className="text-slate-500" />}
 </span>
 </button>
 {showExceptionTools && (
 <div className="border-t border-slate-200 px-4 pb-4 pt-3">
 {renderExceptionControls()}
 </div>
 )}
 </div>

 <div className="rounded-[26px] border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-pink-50 to-rose-50 p-4 shadow-sm">
 <div className="mb-3 flex items-center justify-between gap-3">
 <div>
 <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-fuchsia-700">
 Ranking de puntualidad
 </div>
 <div className="mt-1 text-sm font-semibold text-fuchsia-900">
 {punctualityInsights.league}
 </div>
 </div>
 <span className="rounded-full border border-fuchsia-200 bg-white px-3 py-1 text-xs font-bold text-fuchsia-700">
 Puesto {punctualityInsights.position || "--"} / {punctualityInsights.total}
 </span>
 </div>
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
 <div className="rounded-[20px] border border-fuchsia-200 bg-white/90 px-3 py-3">
 <div className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-600">
 Racha actual
 </div>
 <div className="mt-1 text-lg font-black text-fuchsia-900">
 {punctualityInsights.streak} dia{punctualityInsights.streak === 1 ? "" : "s"}
 </div>
 <div className="text-xs text-fuchsia-700">
 Llegadas en hora consecutivas.
 </div>
 </div>
 <div className="rounded-[20px] border border-fuchsia-200 bg-white/90 px-3 py-3">
 <div className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-600">
 Estado del tablero
 </div>
 <div className="mt-1 text-sm font-bold text-fuchsia-900">
 {punctualityInsights.vibe}
 </div>
 <div className="text-xs text-fuchsia-700">
 Basado en tus ultimos {RECENT_HISTORY_DAYS} dias.
 </div>
 </div>
 </div>
 </div>

 <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
 <div className="mb-3 flex items-center justify-between gap-3">
 <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
 Historial reciente
 </div>
 <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
 {recentHistory.length}/{RECENT_HISTORY_DAYS}
 </span>
 </div>
 <div className="space-y-2">
 {recentHistory.length ? recentHistory.map((row) => (
 <div key={`${row.date}-${row.id}`} className="grid grid-cols-[72px_minmax(0,1fr)_64px] items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-3 py-3">
 <div className="rounded-[24px] bg-white px-2 py-2 text-center shadow-sm">
 <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Fecha</div>
 <div className="mt-1 text-sm font-bold text-slate-950">
 {formatDateSafe(row.date, "dd/MM")}
 </div>
 </div>
 <div className="min-w-0">
 <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
 Jornada
 </div>
 <div className="mt-1 truncate text-sm font-semibold text-slate-900">
 {row.entry_time ? `${formatTime(row.entry_time)} - ${formatTime(row.exit_time)}` : "Sin entrada"}
 </div>
 </div>
 <div className="text-right">
 <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Horas</div>
 <div className="mt-1 text-sm font-bold text-slate-950">
 {row.total_hours ? `${Number(row.total_hours).toFixed(1)}h` : "--"}
 </div>
 </div>
 </div>
 )) : (
 <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
 Aun no hay historial reciente disponible.
 </div>
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
 className="fixed inset-0 z-50 flex pointer-events-none items-center justify-center"
 >
 <div className="rounded-full bg-white px-8 py-4 text-3xl font-bold text-blue-600 shadow-2xl">Listo</div>
 </motion.div>
 )}
 </AnimatePresence>

 </Card>
 );

 return (
 <>
 <div className="fixed bottom-20 right-4 z-[60] sm:bottom-24 sm:right-6">
 <motion.button
 onClick={() => setWidgetModalOpen(true)}
 className={`relative flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg shadow-slate-900/20 transition focus-visible:ring-2 focus-visible:ring-accent ${launcherColorClass}`}
 aria-label={`Abrir asistencia - ${nextActionMeta.label}`}
 title={`Asistencia - ${nextActionMeta.label}`}
 whileHover={{ y: -1 }}
 whileTap={{ scale: 0.97 }}
 animate={showCelebration ? { scale: [1, 1.04, 1] } : { scale: 1 }}
 transition={showCelebration ? { duration: 0.6 } : { duration: 0.7 }}
 >
 <LauncherIcon className="text-white" size={20} />
 </motion.button>
 </div>
 <Modal
 isOpen={widgetModalOpen}
 onClose={() => setWidgetModalOpen(false)}
 title="Asistencia"
 maxWidth="max-w-5xl"
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
 className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
 value={exceptionType}
 onChange={(e) => handleExceptionTypeChange(e.target.value)}
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
 className="w-full resize-none rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
 rows="3"
 placeholder="Describe brevemente el motivo de tu salida..."
 value={exceptionDescription}
 onChange={(e) => setExceptionDescription(e.target.value)}
 />
 <p className="mt-1 text-xs text-gray-500">
 Incluye detalles como destino y duracion aproximada.
 </p>
 </div>

 <div className="flex justify-end gap-3 pt-2">
 <button
 onClick={() => setExceptionModalOpen(false)}
 className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-800"
 >
 Cancelar
 </button>
 <Button
 onClick={handleRegisterException}
 disabled={exceptionLoading}
 className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2 font-semibold text-white shadow-md transition-all hover:from-amber-600 hover:to-orange-600 hover:shadow-lg"
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
 className="w-full resize-none rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
 rows="3"
 placeholder="Describe el motivo operativo del tiempo adicional..."
 value={overtimeReason}
 onChange={(e) => setOvertimeReason(e.target.value)}
 />
 </div>

 <div className="flex justify-end gap-3">
 <button
 type="button"
 onClick={() => {
 setOvertimePrompt(null);
 setOvertimeReason("");
 }}
 className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-800"
 disabled={overtimeSubmitting}
 >
 Omitir
 </button>
 <Button
 onClick={handleOvertimeSubmit}
 disabled={overtimeSubmitting}
 className="rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-2 font-semibold text-white shadow-md transition-all hover:from-indigo-700 hover:to-blue-700 hover:shadow-lg"
 >
 {overtimeSubmitting ? "Guardando..." : "Guardar horas extra"}
 </Button>
 </div>
 </div>
 </Modal>
 </>
 );
};

export default AttendanceWidget;
