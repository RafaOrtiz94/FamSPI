// src/core/api/attendanceApi.js
import api from "./index";

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
 const { data } = await api.post(
 "/attendance/clock-in",
 { location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }
 );

 return data;
};

/**
 * Clock Out for Lunch - Record lunch start time
 */
export const clockOutLunch = async (location = null) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const { data } = await api.post(
 "/attendance/clock-out-lunch",
 { location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }
 );

 return data;
};

/**
 * Clock In from Lunch - Record lunch end time
 */
export const clockInLunch = async (location = null) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const { data } = await api.post(
 "/attendance/clock-in-lunch",
 { location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }
 );

 return data;
};

/**
 * Clock Out - Record exit time
 */
export const clockOut = async (location = null) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const { data } = await api.post(
 "/attendance/clock-out",
 { location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }
 );

 return data;
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
 const { data } = await api.post("/attendance/marcar/entrada", payload);
 return data;
};

export const marcarAlmuerzoSalida = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 const { data } = await api.post("/attendance/marcar/almuerzo-salida", payload);
 return data;
};

export const marcarAlmuerzoEntrada = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 const { data } = await api.post("/attendance/marcar/almuerzo-entrada", payload);
 return data;
};

export const marcarSalida = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 const { data } = await api.post("/attendance/marcar/salida", payload);
 return data;
};

export const marcarSalidaImprevista = async (location = null, description = null, markMeta = {}) => {
 let payload = { location: ensureLocationOrThrow(location) };
 const accuracy = extractLocationAccuracy(location);
 if (accuracy !== null) payload.location_accuracy = accuracy;
 if (description) payload.description = description;
 payload = appendOccurredAt(payload, markMeta);
 const { data } = await api.post("/attendance/marcar/salida-imprevista", payload);
 return data;
};

export const marcarRegresoImprevisto = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 const { data } = await api.post("/attendance/marcar/regreso-imprevisto", payload);
 return data;
};

export const marcarLlegadaImprevista = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 const { data } = await api.post("/attendance/marcar/llegada-imprevista", payload);
 return data;
};

export const marcarRetornoImprevisto = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 const { data } = await api.post("/attendance/marcar/retorno-imprevisto", payload);
 return data;
};

export const marcarSalidaOficina = async (location = null, description = null, markMeta = {}) => {
 let payload = { location: ensureLocationOrThrow(location) };
 const accuracy = extractLocationAccuracy(location);
 if (accuracy !== null) payload.location_accuracy = accuracy;
 if (description) payload.description = description;
 payload = appendOccurredAt(payload, markMeta);
 const { data } = await api.post("/attendance/marcar/salida-oficina", payload);
 return data;
};

export const marcarEntradaOficina = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 const { data } = await api.post("/attendance/marcar/entrada-oficina", payload);
 return data;
};

export const marcarSalidaCampo = async (location = null, description = null, markMeta = {}) => {
 let payload = { location: ensureLocationOrThrow(location) };
 const accuracy = extractLocationAccuracy(location);
 if (accuracy !== null) payload.location_accuracy = accuracy;
 if (description) payload.description = description;
 payload = appendOccurredAt(payload, markMeta);
 const { data } = await api.post("/attendance/marcar/salida-campo", payload);
 return data;
};

export const marcarEntradaCampo = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 const { data } = await api.post("/attendance/marcar/entrada-campo", payload);
 return data;
};

export const marcarLlegadaDestino = async (location = null, markMeta = {}) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const payload = appendOccurredAt({ location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }, markMeta);
 const { data } = await api.post("/attendance/marcar/llegada-destino", payload);
 return data;
};

export const marcarCierreViaje = async (location = null, reason = null, markMeta = {}) => {
 let payload = { location: ensureLocationOrThrow(location) };
 const accuracy = extractLocationAccuracy(location);
 if (accuracy !== null) payload.location_accuracy = accuracy;
 if (reason) payload.closure_reason = reason;
 payload = appendOccurredAt(payload, markMeta);
 const { data } = await api.post("/attendance/marcar/cierre-viaje", payload);
 return data;
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
 const { data } = await api.post("/attendance/marcar/visita-entrada", payloadWithOccurredAt);
 return data;
};

export const justifyLateArrival = async ({ reason, date } = {}) => {
 const payload = {
  reason: String(reason || "").trim(),
 };
 if (date) payload.date = date;
 const { data } = await api.post("/attendance/late-justification", payload);
 return data;
};

export const marcarVisitaSalida = async (payload = {}) => {
 const normalizedPayload = { ...payload };
 const accuracy = extractLocationAccuracy(normalizedPayload.location);
 normalizedPayload.location = ensureLocationOrThrow(normalizedPayload.location);
 if (accuracy !== null) normalizedPayload.location_accuracy = accuracy;
 const payloadWithOccurredAt = appendOccurredAt(normalizedPayload, normalizedPayload);
 const { data } = await api.post("/attendance/marcar/visita-salida", payloadWithOccurredAt);
 return data;
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

/**
 * Update Exception Status (ON_SITE, RETURNING, COMPLETED)
 */
export const updateExceptionStatus = async (status, location = null) => {
 const normalizedLocation = ensureLocationOrThrow(location);
 const accuracy = extractLocationAccuracy(location);
 const { data } = await api.post(
 "/attendance/exception/status",
 { status, location: normalizedLocation, ...(accuracy !== null ? { location_accuracy: accuracy } : {}) }
 );

 return data;
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
 const { data } = await api.get("/attendance/today");

 return data;
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

export const scheduleAttendanceFollowUpMeeting = async (userId, payload = {}) => {
  const { data } = await api.post(`/attendance/non-compliance/${userId}/schedule-meeting`, payload);
  return data;
};

/**
 * Download Attendance PDF
 */
export const downloadAttendancePDF = async (userId, startDate, endDate, options = {}) => {
 const reportType = String(options?.periodType || "monthly").toLowerCase() === "annual" ? "annual" : "monthly";
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
 params.set("periodType", "monthly");
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
