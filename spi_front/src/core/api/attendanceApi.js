// src/core/api/attendanceApi.js
import api, { isTransientApiError } from "./index";
import {
  enqueueOfflineMark,
  flushOfflineQueue,
  getQueueSize,
  hasQueuedMarkForEndpoint,
  onOfflineQueueChanged,
} from "../../shared/utils/attendanceOfflineQueue";
import { readCachedResource, writeCachedResource } from "../pwa/localCache";

const ATTENDANCE_TODAY_CACHE_KEY = "attendance_today_snapshot";
const ATTENDANCE_LIVE_PRESENCE_CACHE_KEY = "attendance_live_presence_snapshot";
const ATTENDANCE_PUNCTUALITY_CACHE_KEY = "attendance_punctuality_summary_snapshot";
const ATTENDANCE_TODAY_CACHE_MAX_AGE_MS = 1000 * 60 * 30;
const ATTENDANCE_LIVE_PRESENCE_CACHE_MAX_AGE_MS = 1000 * 60 * 10;
const ATTENDANCE_PUNCTUALITY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 6;

const normalizeLocation = (location) => {
  if (!location) return null;

  if (typeof location === "string") {
    const trimmed = location.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(",");
    if (parts.length === 2) {
      const lat = Number(parts[0]?.trim());
      const lng = Number(parts[1]?.trim());
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      if (Math.abs(lat) <= 0.0005 && Math.abs(lng) <= 0.0005) return null;
    }
    return trimmed;
  }

  if (typeof location === "object") {
    const latitude = Number(location.latitude ?? location.lat);
    const longitude = Number(location.longitude ?? location.lng);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
      if (Math.abs(latitude) <= 0.0005 && Math.abs(longitude) <= 0.0005) return null;
      return `${latitude},${longitude}`;
    }
  }

  return null;
};

const ensureLocationOrThrow = (location) => {
  const normalized = normalizeLocation(location);
  if (!normalized) {
    throw new Error("Ubicacion obligatoria para marcar asistencia");
  }
  return normalized;
};

const extractLocationAccuracy = (location) => {
  if (!location || typeof location !== "object") return null;
  const accuracy = Number(location.accuracy ?? location.location_accuracy);
  return Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null;
};

const appendOccurredAt = (payload = {}, markMeta = {}) => {
  const occurredAt = markMeta?.occurred_at || markMeta?.occurredAt;
  if (!occurredAt) return payload;
  const parsed = new Date(occurredAt);
  if (Number.isNaN(parsed.getTime())) return payload;
  return { ...payload, occurred_at: parsed.toISOString() };
};

const postAttendancePayload = async (endpoint, payload = {}) => {
  const hasFile = Object.values(payload || {}).some((value) => value instanceof File);
  if (hasFile) {
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (value instanceof File) {
        formData.append(key, value);
        return;
      }
      formData.append(key, value);
    });
    const { data } = await api.post(endpoint, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }

  const { data } = await api.post(endpoint, payload);
  return data;
};

const payloadHasBinary = (payload = {}) =>
  Object.values(payload || {}).some((value) => value instanceof File);

// Cola offline: solo para marcas cuyo payload es 100% JSON-serializable (sin
// File/Blob) -- ver src/shared/utils/attendanceOfflineQueue.js. Las marcas con
// foto (salida/cierre operacional con vehiculo personal) pasan por
// postAttendancePayload y NO se encolan; siguen dependiendo del reintento en
// memoria del componente.
const isNetworkError = (err) => !err?.response;

// `api` (src/core/api/index.js) no define timeout global -- con senal mala
// (viva pero muy lenta/intermitente) una marcacion se quedaria esperando
// indefinidamente sin lanzar error de red, asi que nunca se encolaria.
// Este timeout acota ese caso al mismo camino de "sin conexion": si no hay
// respuesta en MARK_TIMEOUT_MS, se trata como fallo de red y se encola.
// Es seguro reintentarla despues aunque el POST original si haya llegado al
// servidor: los endpoints de marcacion devuelven 409/400 en ese caso y
// flushOfflineQueue/resolveAttendanceConflict ya descartan ese resultado sin
// duplicar nada.
const MARK_TIMEOUT_MS = 10000;

const ALREADY_QUEUED_MESSAGE = "Ya se guardó esta marcación y está pendiente de enviar. No hace falta repetirla.";

// Si el mismo endpoint ya tiene una marca sin enviar en la cola offline, no
// se intenta de nuevo (ni siquiera contra la red): la UI no siempre refleja
// de inmediato que la marca anterior quedo guardada, y sin este guard un
// segundo toque del mismo boton generaria una segunda marca duplicada en
// cuanto vuelva la conexion.
const postQueueableMark = async (endpoint, payload = {}, label) => {
  if (hasQueuedMarkForEndpoint(endpoint)) {
    return { ok: true, queued: true, alreadyQueued: true, message: ALREADY_QUEUED_MESSAGE };
  }

  try {
    const { data } = await api.post(endpoint, payload, { timeout: MARK_TIMEOUT_MS });
    return data;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    enqueueOfflineMark({ endpoint, payload, label });
    return {
      ok: true,
      queued: true,
      message: "Sin conexión: se guardó en este dispositivo y se enviará automáticamente cuando vuelva la señal.",
    };
  }
};

const getWithCacheFallback = async ({
  endpoint,
  cacheKey,
  maxAgeMs,
}) => {
  try {
    const { data } = await api.get(endpoint);
    writeCachedResource(cacheKey, data);
    return data;
  } catch (error) {
    const cached = readCachedResource(cacheKey, { maxAgeMs });
    if (cached?.data && isTransientApiError(error)) {
      return cached.data;
    }
    throw error;
  }
};

/**
 * Reintenta las marcas guardadas offline, en orden. Pensado para llamarse al
 * volver la conexion (evento "online") o al abrir el widget/AttendanceAction.
 */
export const flushAttendanceOfflineQueue = () =>
  flushOfflineQueue({ post: (endpoint, payload) => api.post(endpoint, payload) });

export const getAttendanceOfflineQueueSize = () => getQueueSize();

export const subscribeAttendanceOfflineQueue = (handler) => onOfflineQueueChanged(handler);

const looksLikeMarkMeta = (value) =>
  Boolean(
    value &&
    typeof value === "object" &&
    !(value instanceof File) &&
    (
      Object.prototype.hasOwnProperty.call(value, "occurred_at") ||
      Object.prototype.hasOwnProperty.call(value, "occurredAt")
    ) &&
    !Object.prototype.hasOwnProperty.call(value, "odometer_end_km") &&
    !Object.prototype.hasOwnProperty.call(value, "odometerEndKm") &&
    !Object.prototype.hasOwnProperty.call(value, "end_odometer_photo") &&
    !Object.prototype.hasOwnProperty.call(value, "endOdometerPhoto")
  );

const normalizeOperationalStartPayload = (location, descriptionOrPayload, markMeta = {}) => {
  const normalizedLocation = ensureLocationOrThrow(location);
  const accuracy = extractLocationAccuracy(location);
  const rawPayload =
    descriptionOrPayload && typeof descriptionOrPayload === "object" && !(descriptionOrPayload instanceof File)
      ? { ...descriptionOrPayload }
      : { description: descriptionOrPayload };
  const payload = appendOccurredAt(
    {
      ...rawPayload,
      location: normalizedLocation,
      ...(accuracy !== null ? { location_accuracy: accuracy } : {}),
    },
    markMeta
  );
  return payload;
};

const normalizeOperationalEndPayload = (location, payloadOrMarkMeta = {}, maybeMarkMeta = {}) => {
  const normalizedLocation = ensureLocationOrThrow(location);
  const accuracy = extractLocationAccuracy(location);
  const rawPayload =
    payloadOrMarkMeta && typeof payloadOrMarkMeta === "object" && !(payloadOrMarkMeta instanceof File) && !looksLikeMarkMeta(payloadOrMarkMeta)
      ? { ...payloadOrMarkMeta }
      : {};
  const markMeta =
    payloadOrMarkMeta && typeof payloadOrMarkMeta === "object" && !(payloadOrMarkMeta instanceof File) && !looksLikeMarkMeta(payloadOrMarkMeta)
      ? maybeMarkMeta
      : payloadOrMarkMeta;
  return appendOccurredAt(
    {
      ...rawPayload,
      location: normalizedLocation,
      ...(accuracy !== null ? { location_accuracy: accuracy } : {}),
    },
    markMeta
  );
};

/**
 * ==========================================================
 * 📋 Attendance API Client
 * ----------------------------------------------------------
 * Handles all attendance-related API calls
 * ==========================================================
 */

/**
 * Clock In - Record entry time
 */
/**
 * Clock In - Record entry time
 */
export const clockIn = async (location = null) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 return postQueueableMark(
   "/attendance/clock-in",
   { location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) },
   "Entrada"
 );
};

/**
 * Clock Out for Lunch - Record lunch start time
 */
export const clockOutLunch = async (location = null) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 return postQueueableMark(
   "/attendance/clock-out-lunch",
   { location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) },
   "Salida a almuerzo"
 );
};

/**
 * Clock In from Lunch - Record lunch end time
 */
export const clockInLunch = async (location = null) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 return postQueueableMark(
   "/attendance/clock-in-lunch",
   { location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) },
   "Entrada de almuerzo"
 );
};

/**
 * Clock Out - Record exit time
 */
export const clockOut = async (location = null) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 return postQueueableMark(
   "/attendance/clock-out",
   { location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) },
   "Salida final"
 );
};

/**
 * ==========================================================
 * 📱 iPhone Shortcut Aliases (Spanish)
 * ----------------------------------------------------------
 * Use simplified paths for iOS Shortcuts integration
 * ==========================================================
 */

export const marcarEntrada = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 return postQueueableMark("/attendance/marcar/entrada", payload, "Entrada");
};

export const marcarAlmuerzoSalida = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 return postQueueableMark("/attendance/marcar/almuerzo-salida", payload, "Salida a almuerzo");
};

export const marcarAlmuerzoEntrada = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 return postQueueableMark("/attendance/marcar/almuerzo-entrada", payload, "Entrada de almuerzo");
};

export const marcarSalida = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 return postQueueableMark("/attendance/marcar/salida", payload, "Salida final");
};

export const marcarSalidaImprevista = async (location = null, description = null, markMeta = {}) => {
 let payload = { location: ensureLocationOrThrow(location) };
 const accuracy = extractLocationAccuracy(location);
 if (accuracy !== null) payload.location_accuracy = accuracy;
 if (description) payload.description = description;
 payload = appendOccurredAt(payload, markMeta);
 return postQueueableMark("/attendance/marcar/salida-imprevista", payload, "Salida imprevista");
};

export const marcarRegresoImprevisto = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 return postQueueableMark("/attendance/marcar/regreso-imprevisto", payload, "Regreso imprevisto");
};

export const marcarLlegadaImprevista = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 return postQueueableMark("/attendance/marcar/llegada-imprevista", payload, "Llegada imprevista");
};

export const marcarRetornoImprevisto = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 return postQueueableMark("/attendance/marcar/retorno-imprevisto", payload, "Retorno imprevisto");
};

export const marcarSalidaOficina = async (location = null, description = null, markMeta = {}) => {
 const payload = normalizeOperationalStartPayload(location, description, markMeta);
 if (payloadHasBinary(payload)) {
  return postAttendancePayload("/attendance/marcar/salida-oficina", payload);
 }
 return postQueueableMark("/attendance/marcar/salida-oficina", payload, "Salida operacional");
};

export const createTeleworkRequest = async ({ city, location, locationAccuracy = null, reason = "", requestDate = "" } = {}) => {
  const normalizedLocation = ensureLocationOrThrow(location);
  const { data } = await api.post("/attendance/telework/requests", {
    city: String(city || "").trim(),
    ...(String(requestDate || "").trim() ? { request_date: String(requestDate).trim() } : {}),
    location: normalizedLocation,
    ...(locationAccuracy !== null && locationAccuracy !== undefined ? { location_accuracy: locationAccuracy } : {}),
    ...(String(reason || "").trim() ? { reason: String(reason).trim() } : {}),
  });
  return data;
};

export const getTeleworkRequests = async (query = {}) => {
  const params = new URLSearchParams();
  if (query?.scope) params.set("scope", String(query.scope));
  if (query?.mode) params.set("mode", String(query.mode));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const { data } = await api.get(`/attendance/telework/requests${suffix}`);
  return data;
};

export const decideTeleworkRequest = async (requestId, decision, reason = "") => {
  const { data } = await api.post(`/attendance/telework/requests/${requestId}/decision`, {
    decision,
    ...(String(reason || "").trim() ? { reason: String(reason).trim() } : {}),
  });
  return data;
};

export const marcarEntradaOficina = async (location = null, payloadOrMarkMeta = {}, maybeMarkMeta = {}) => {
 const payload = normalizeOperationalEndPayload(location, payloadOrMarkMeta, maybeMarkMeta);
 return postAttendancePayload("/attendance/marcar/entrada-oficina", payload);
};

export const marcarSalidaCampo = async (location = null, description = null, markMeta = {}) => {
 const payload = normalizeOperationalStartPayload(location, description, markMeta);
 if (payloadHasBinary(payload)) {
  return postAttendancePayload("/attendance/marcar/salida-campo", payload);
 }
 return postQueueableMark("/attendance/marcar/salida-campo", payload, "Salida operacional");
};

export const marcarEntradaCampo = async (location = null, payloadOrMarkMeta = {}, maybeMarkMeta = {}) => {
 const payload = normalizeOperationalEndPayload(location, payloadOrMarkMeta, maybeMarkMeta);
 return postAttendancePayload("/attendance/marcar/entrada-campo", payload);
};

export const marcarLlegadaDestino = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 return postQueueableMark("/attendance/marcar/llegada-destino", payload, "Llegada a destino");
};

export const marcarAlmuerzoSalidaOperacional = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 return postQueueableMark("/attendance/marcar/almuerzo-salida-operacional", payload, "Salida a almuerzo operacional");
};

export const marcarAlmuerzoEntradaOperacional = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 return postQueueableMark("/attendance/marcar/almuerzo-entrada-operacional", payload, "Entrada de almuerzo operacional");
};

export const marcarCierreViaje = async (location = null, reason = null, markMeta = {}) => {
 const rawPayload =
  reason && typeof reason === "object" && !(reason instanceof File)
   ? { ...reason }
   : { closure_reason: reason };
 const payload = normalizeOperationalEndPayload(location, rawPayload, markMeta);
 return postAttendancePayload("/attendance/marcar/cierre-viaje", payload);
};

/**
 * Field visit marks (cliente / prospecto / emergencia)
 */
export const marcarVisitaEntrada = async (payload = {}) => {
 const normalizedPayload = { ...payload };
 const accuracy = extractLocationAccuracy(normalizedPayload.location);
 normalizedPayload.location = ensureLocationOrThrow(normalizedPayload.location);
 if (accuracy !== null) normalizedPayload.location_accuracy = accuracy;
 const payloadWithOccurredAt = appendOccurredAt(normalizedPayload, normalizedPayload);
 return postQueueableMark("/attendance/marcar/visita-entrada", payloadWithOccurredAt, "Entrada cliente");
};

export const justifyLateArrival = async ({ reason, date } = {}) => {
 const payload = {
  reason: String(reason || "").trim(),
 };
 if (date) payload.date = date;
 const { data } = await api.post("/attendance/late-justification", payload);
 return data;
};

export const requestEntryRegularization = async ({ reason } = {}) => {
 const { data } = await api.post("/attendance/regularize-entry", {
  reason: String(reason || "").trim(),
 });
 return data;
};

export const marcarVisitaSalida = async (payload = {}) => {
 const normalizedPayload = { ...payload };
 const accuracy = extractLocationAccuracy(normalizedPayload.location);
 normalizedPayload.location = ensureLocationOrThrow(normalizedPayload.location);
 if (accuracy !== null) normalizedPayload.location_accuracy = accuracy;
 const payloadWithOccurredAt = appendOccurredAt(normalizedPayload, normalizedPayload);
 return postQueueableMark("/attendance/marcar/visita-salida", payloadWithOccurredAt, "Salida cliente");
};

/**
 * Attach location to an already saved attendance or exception mark
 */
export const syncAttendanceLocation = async (target, location) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const { data } = await api.post(
 "/attendance/location-sync",
 { target, location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }
 );

 return data;
};

/**
 * Register Exception (Salida Inesperada)
 */
export const registerException = async (type, description, location = null, options = {}) => {
  const { isJustified } = options || {};
  const normalizedLocation = ensureLocationOrThrow(location);
  const accuracy = extractLocationAccuracy(location);
  const { data } = await api.post(
  "/attendance/exception",
  {
   type,
   description,
   location: normalizedLocation,
   ...(accuracy !== null ? { location_accuracy: accuracy } : {}),
   ...(isJustified !== undefined ? { isJustified } : {}),
  }
 );

 return data;
};

export const startPermissionEntry = async (location = null) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const { data } = await api.post(
 "/attendance/permission-entry-start",
 {
  location: normalizedLocation,
  ...(accuracy !== null ? { location_accuracy: accuracy } : {}),
 }
 );

 return data;
};

export const finishPermissionExit = async (location = null) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const { data } = await api.post(
 "/attendance/permission-exit-finish",
 {
  location: normalizedLocation,
  ...(accuracy !== null ? { location_accuracy: accuracy } : {}),
 }
 );

 return data;
};

/**
 * Update Exception Status (ON_SITE, ACTIVE, RETURNING, COMPLETED)
 */
export const updateExceptionStatus = async (status, location = null, extraPayload = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = { status, location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}), ...(extraPayload || {}) };
 return postQueueableMark("/attendance/exception/status", payload, `Estado operacional: ${status}`);
};

/**
 * Get active exception for current user
 */
export const getActiveException = async () => {
 const { data } = await api.get("/attendance/exception/active");

 return data;
};

/**
 * Get Today's Attendance - For current user
 */
export const getTodayAttendance = async () => {
  return getWithCacheFallback({
    endpoint: "/attendance/today",
    cacheKey: ATTENDANCE_TODAY_CACHE_KEY,
    maxAgeMs: ATTENDANCE_TODAY_CACHE_MAX_AGE_MS,
  });
};

export const getAttendanceLivePresence = async () => {
  return getWithCacheFallback({
    endpoint: "/attendance/live-presence",
    cacheKey: ATTENDANCE_LIVE_PRESENCE_CACHE_KEY,
    maxAgeMs: ATTENDANCE_LIVE_PRESENCE_CACHE_MAX_AGE_MS,
  });
};

export const getAttendancePunctualitySummary = async () => {
  return getWithCacheFallback({
    endpoint: "/attendance/punctuality/summary",
    cacheKey: ATTENDANCE_PUNCTUALITY_CACHE_KEY,
    maxAgeMs: ATTENDANCE_PUNCTUALITY_CACHE_MAX_AGE_MS,
  });
};

/**
 * Get User Attendance - For specific date
 */
export const getUserAttendance = async (userId, date) => {
 const { data } = await api.get(`/attendance/user/${userId}?date=${date}`);

 return data;
};

/**
 * Get Attendance Range - For reporting
 */
export const getAttendanceRange = async (...args) => {
  const [firstArg, secondArg, thirdArg, fourthArg] = args;
  const query =
   firstArg && typeof firstArg === "object" && !Array.isArray(firstArg)
    ? firstArg
    : {
       startDate: firstArg,
       endDate: secondArg,
       userId: thirdArg,
       status: fourthArg,
      };

  const params = new URLSearchParams();
  const startDate = query?.startDate ?? query?.start ?? "";
  const endDate = query?.endDate ?? query?.end ?? "";

  if (startDate) params.set("start", startDate);
  if (endDate) params.set("end", endDate);

  if (query?.userId !== null && query?.userId !== undefined && query?.userId !== "") {
   params.set("userId", query.userId);
  }

  if (Array.isArray(query?.userIds) && query.userIds.length) {
   params.set("userIds", query.userIds.join(","));
  }

  if (query?.departmentId !== null && query?.departmentId !== undefined && query?.departmentId !== "") {
   params.set("departmentId", query.departmentId);
  }

  if (query?.status) {
   params.set("status", query.status);
  }

  if (query?.quickRange) {
   params.set("quickRange", query.quickRange);
  }

  if (query?.onlyDiscrepancies) {
   params.set("onlyDiscrepancies", "1");
  }

  if (query?.onlyWithGeo) {
   params.set("onlyWithGeo", "1");
  }

  if (query?.mode) {
   params.set("mode", query.mode);
  }

  if (query?.view) {
   params.set("view", query.view);
  }

  const { data } = await api.get(`/attendance/range?${params.toString()}`);

  return data;
};

export const getAttendanceTeamRange = async (...args) => {
  const [firstArg, secondArg, thirdArg, fourthArg] = args;
  const query =
    firstArg && typeof firstArg === "object" && !Array.isArray(firstArg)
      ? firstArg
      : {
          startDate: firstArg,
          endDate: secondArg,
          status: thirdArg,
          quickRange: fourthArg,
        };

  const params = new URLSearchParams();
  const startDate = query?.startDate ?? query?.start ?? "";
  const endDate = query?.endDate ?? query?.end ?? "";
  if (startDate) params.set("start", startDate);
  if (endDate) params.set("end", endDate);
  if (query?.status) params.set("status", query.status);
  if (query?.quickRange) params.set("quickRange", query.quickRange);
  if (query?.onlyDiscrepancies) params.set("onlyDiscrepancies", "1");
  if (query?.onlyWithGeo) params.set("onlyWithGeo", "1");
  if (query?.view) params.set("view", query.view);
  if (Array.isArray(query?.userIds) && query.userIds.length) {
    params.set("userIds", query.userIds.join(","));
  }

  const { data } = await api.get(`/attendance/team-range?${params.toString()}`);
  return data;
};

export const getAttendanceNonCompliance = async (days = 7) => {
  const query = new URLSearchParams();
  query.set("days", String(days));
  const { data } = await api.get(`/attendance/non-compliance?${query.toString()}`);
  return data;
};

export const getAttendanceWorkspaceOverview = async (query = {}) => {
  const params = new URLSearchParams();
  if (query?.startDate || query?.start) params.set("start", query.startDate || query.start);
  if (query?.endDate || query?.end) params.set("end", query.endDate || query.end);
  if (query?.search) params.set("search", query.search);
  if (query?.departmentId) params.set("departmentId", String(query.departmentId));
  if (query?.includeInactive) params.set("includeInactive", "true");
  const { data } = await api.get(`/attendance/workspace/overview?${params.toString()}`);
  return data;
};

export const getAttendanceWorkspaceCollaborator = async (userId, query = {}) => {
  const params = new URLSearchParams();
  if (query?.startDate || query?.start) params.set("start", query.startDate || query.start);
  if (query?.endDate || query?.end) params.set("end", query.endDate || query.end);
  const { data } = await api.get(`/attendance/workspace/collaborators/${userId}?${params.toString()}`);
  return data;
};

export const getAttendanceWorkspaceBreaches = async (query = {}) => {
  const params = new URLSearchParams();
  if (query?.startDate || query?.start) params.set("start", query.startDate || query.start);
  if (query?.endDate || query?.end) params.set("end", query.endDate || query.end);
  if (query?.search) params.set("search", query.search);
  if (query?.departmentId) params.set("departmentId", String(query.departmentId));
  if (Array.isArray(query?.userIds) && query.userIds.length) {
    params.set("userIds", query.userIds.join(","));
  }
  if (query?.includeInactive) params.set("includeInactive", "true");
  const { data } = await api.get(`/attendance/workspace/breaches?${params.toString()}`);
  return data;
};

export const scheduleAttendanceFollowUpMeeting = async (userId, payload = {}) => {
  const normalizedPayload = {
    ...payload,
    date: payload.date || payload.meeting_date,
    start_time: payload.start_time || payload.meeting_time,
    reason: payload.reason || payload.notes,
  };
  const { data } = await api.post(`/attendance/non-compliance/${userId}/schedule-meeting`, normalizedPayload);
  return data;
};

export const getCollaboratorJustificationsPanel = async (userId, query = {}) => {
  const params = new URLSearchParams();
  if (query?.startDate || query?.start) params.set("start", query.startDate || query.start);
  if (query?.endDate || query?.end) params.set("end", query.endDate || query.end);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const { data } = await api.get(`/attendance/admin/collaborator/${userId}/justifications-panel${suffix}`);
  return data;
};

export const getAttendanceRegularizationsPanel = async (query = {}) => {
  const params = new URLSearchParams();
  if (query?.search) params.set("search", query.search);
  if (query?.startDate || query?.start) params.set("start", query.startDate || query.start);
  if (query?.endDate || query?.end) params.set("end", query.endDate || query.end);
  if (query?.regularizationType) params.set("regularizationType", query.regularizationType);
  const { data } = await api.get(`/attendance/admin/regularizations-panel?${params.toString()}`);
  return data;
};

export const applyEntryRegularization = async ({ userId, date, entryTime }) => {
  const { data } = await api.post("/attendance/admin/apply-entry-regularization", { userId, date, entryTime });
  return data;
};

export const transitionAttendanceRegularization = async (id, { status, comment }) => {
  const { data } = await api.post(`/attendance/regularizations/${id}/status`, { status, comment });
  return data;
};

export const getCollaboratorBirthdayBenefit = async (userId) => {
  const { data } = await api.get(`/attendance/admin/collaborator/${userId}/birthday-benefit`);
  return data;
};

export const generateCollaboratorBirthdayBenefitQr = async (userId) => {
  const { data } = await api.post(`/attendance/admin/collaborator/${userId}/birthday-benefit/qr`);
  return data;
};

export const validateBirthdayBenefitQr = async (token) => {
  const { data } = await api.get(`/attendance/birthday-benefit/qr/${token}`);
  return data;
};

export const uploadBirthdayBenefitEvidence = async (token, files = []) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const { data } = await api.post(`/attendance/birthday-benefit/${token}/evidence`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const redeemBirthdayBenefit = async (token, redeemDate) => {
  const { data } = await api.post(`/attendance/birthday-benefit/${token}/redeem`, { redeemDate });
  return data;
};

/**
 * Download Attendance PDF
 */
export const downloadAttendancePDF = async (userId, startDate, endDate, options = {}) => {
 const reportType = String(options?.periodType || "monthly").toLowerCase() === "annual"
  ? "annual"
  : String(options?.periodType || "monthly").toLowerCase().startsWith("week")
   ? "weekly"
   : "monthly";
 const params = new URLSearchParams();

 if (reportType === "annual") {
 const reportYear = Number.parseInt(options?.year, 10);
 if (Number.isInteger(reportYear)) {
 params.set("year", String(reportYear));
 }
 params.set("periodType", "annual");
 } else {
 params.set("start", startDate);
 params.set("end", endDate);
 params.set("periodType", reportType);
 }

  const response = await api.get(
 `/attendance/pdf/${userId}?${params.toString()}`,
  {
  responseType: "blob",
  }
  );

 const fileNameByType = reportType === "annual"
 ? `asistencia-${userId}-anual-${options?.year || new Date().getFullYear()}.pdf`
 : `asistencia-${userId}-${startDate}-${endDate}.pdf`;
 const disposition = response.headers?.["content-disposition"] || "";
 const match = disposition.match(/filename=([^;]+)/i);
 const fileName = match ? String(match[1]).replace(/"/g, "").trim() : fileNameByType;

  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);

  return {
  ok: true,
  hash: response.headers?.["x-document-hash-sha256"] || null,
  hashAlgorithm: response.headers?.["x-document-hash-algorithm"] || null,
  notice: response.headers?.["x-document-integrity-notice"] || null,
  fileName,
  };
};

export const downloadAttendanceBulkPDF = async (query = {}) => {
 const reportType = String(query?.periodType || "monthly").toLowerCase() === "annual"
  ? "annual"
  : String(query?.periodType || "monthly").toLowerCase().startsWith("week")
   ? "weekly"
   : "monthly";
 const params = new URLSearchParams();

 if (reportType === "annual") {
  const reportYear = Number.parseInt(query?.year, 10);
  if (Number.isInteger(reportYear)) params.set("year", String(reportYear));
  params.set("periodType", "annual");
 } else {
  if (query?.startDate || query?.start) params.set("start", query.startDate || query.start);
  if (query?.endDate || query?.end) params.set("end", query.endDate || query.end);
  params.set("periodType", reportType);
 }

 if (query?.search) params.set("search", query.search);
 if (query?.departmentId) params.set("departmentId", String(query.departmentId));
 if (Array.isArray(query?.userIds) && query.userIds.length) params.set("userIds", query.userIds.join(","));
 if (query?.includeInactive) params.set("includeInactive", "true");

 const response = await api.get(`/attendance/pdf-bulk?${params.toString()}`, {
  responseType: "blob",
 });

 const fileNameByType = reportType === "annual"
  ? `asistencia-general-anual-${query?.year || new Date().getFullYear()}.pdf`
  : `asistencia-general-${query?.startDate || query?.start}-${query?.endDate || query?.end}.pdf`;
 const disposition = response.headers?.["content-disposition"] || "";
 const match = disposition.match(/filename=([^;]+)/i);
 const fileName = match ? String(match[1]).replace(/"/g, "").trim() : fileNameByType;

 const url = window.URL.createObjectURL(new Blob([response.data]));
 const link = document.createElement("a");
 link.href = url;
 link.setAttribute("download", fileName);
 document.body.appendChild(link);
 link.click();
 link.remove();
 window.URL.revokeObjectURL(url);

 return {
  ok: true,
  hash: response.headers?.["x-document-hash-sha256"] || null,
  hashAlgorithm: response.headers?.["x-document-hash-algorithm"] || null,
  notice: response.headers?.["x-document-integrity-notice"] || null,
  fileName,
 };
};

/**
 * Download the FamSPI-branded monthly attendance report (all collaborators,
 * combines normal/operational exits, permisos, overtime and a visual flag
 * for days where the acta (F.RH) time differs from the real clock time).
 */
export const downloadAttendanceMonthlyReport = async ({ start, end, search, departmentId, format = "pdf" } = {}) => {
 const params = new URLSearchParams();
 if (start) params.set("start", start);
 if (end) params.set("end", end);
 if (search) params.set("search", search);
 if (departmentId) params.set("departmentId", String(departmentId));
 params.set("format", format === "excel" ? "excel" : "pdf");

 const response = await api.get(`/attendance/monthly-report?${params.toString()}`, {
  responseType: "blob",
 });

 const fileExt = format === "excel" ? "xlsx" : "pdf";
 const disposition = response.headers?.["content-disposition"] || "";
 const match = disposition.match(/filename=([^;]+)/i);
 const fileName = match
  ? String(match[1]).replace(/"/g, "").trim()
  : `asistencia-reporte-mensual-${start}-${end}.${fileExt}`;

 const url = window.URL.createObjectURL(new Blob([response.data]));
 const link = document.createElement("a");
 link.href = url;
 link.setAttribute("download", fileName);
 document.body.appendChild(link);
 link.click();
 link.remove();
 window.URL.revokeObjectURL(url);

 return { ok: true, fileName };
};

/**
 * Mark Overtime - Register additional work time
 * POST /api/attendance/overtime
 * Body: { hours: number, reason: string, location: string }
 */
export const markOvertime = async (hours, reason, location = null) => {
 const normalizedLocation = normalizeLocation(location);
 const { data } = await api.post(
 "/attendance/overtime",
 { hours, reason, location: normalizedLocation }
 );

 return data;
};

/**
 * Get Overtime Records - Get overtime history
 * GET /api/attendance/overtime?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
export const getOvertimeRecords = async (startDate, endDate) => {
 const { data } = await api.get(`/attendance/overtime?start=${startDate}&end=${endDate}`);

 return data;
};
