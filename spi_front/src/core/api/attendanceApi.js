// src/core/api/attendanceApi.js
import api from "./index";

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
 const { data } = await api.post(
 "/attendance/clock-in",
 { location }
 );

 return data;
};

/**
 * Clock Out for Lunch - Record lunch start time
 */
export const clockOutLunch = async (location = null) => {
 const { data } = await api.post(
 "/attendance/clock-out-lunch",
 { location }
 );

 return data;
};

/**
 * Clock In from Lunch - Record lunch end time
 */
export const clockInLunch = async (location = null) => {
 const { data } = await api.post(
 "/attendance/clock-in-lunch",
 { location }
 );

 return data;
};

/**
 * Clock Out - Record exit time
 */
export const clockOut = async (location = null) => {
 const { data } = await api.post(
 "/attendance/clock-out",
 { location }
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

export const marcarEntrada = async (location = null) => {
 const { data } = await api.post("/attendance/marcar/entrada", { location });
 return data;
};

export const marcarAlmuerzoSalida = async (location = null) => {
 const { data } = await api.post("/attendance/marcar/almuerzo-salida", { location });
 return data;
};

export const marcarAlmuerzoEntrada = async (location = null) => {
 const { data } = await api.post("/attendance/marcar/almuerzo-entrada", { location });
 return data;
};

export const marcarSalida = async (location = null) => {
 const { data } = await api.post("/attendance/marcar/salida", { location });
 return data;
};

/**
 * Attach location to an already saved attendance or exception mark
 */
export const syncAttendanceLocation = async (target, location) => {
 const { data } = await api.post(
 "/attendance/location-sync",
 { target, location }
 );

 return data;
};

/**
 * Register Exception (Salida Inesperada)
 */
export const registerException = async (type, description, location = null, options = {}) => {
 const { isJustified } = options || {};
 const { data } = await api.post(
 "/attendance/exception",
 { type, description, location, ...(isJustified !== undefined ? { isJustified } : {}) }
 );

 return data;
};

/**
 * Update Exception Status (ON_SITE, RETURNING, COMPLETED)
 */
export const updateExceptionStatus = async (status, location = null) => {
 const { data } = await api.post(
 "/attendance/exception/status",
 { status, location }
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
 const { data } = await api.post(
 "/attendance/overtime",
 { hours, reason, location }
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
