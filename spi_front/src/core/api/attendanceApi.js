// src/core/api/attendanceApi.js
import api from "./index";
import { getAccessToken } from "./authApi";

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
    const token = getAccessToken();
    if (!token) throw new Error("No hay token activo");

    const { data } = await api.post(
        "/attendance/clock-in",
        { location },
        { headers: { Authorization: `Bearer ${token}` } }
    );

    return data;
};

/**
 * Clock Out for Lunch - Record lunch start time
 */
export const clockOutLunch = async (location = null) => {
    const token = getAccessToken();
    if (!token) throw new Error("No hay token activo");

    const { data } = await api.post(
        "/attendance/clock-out-lunch",
        { location },
        { headers: { Authorization: `Bearer ${token}` } }
    );

    return data;
};

/**
 * Clock In from Lunch - Record lunch end time
 */
export const clockInLunch = async (location = null) => {
    const token = getAccessToken();
    if (!token) throw new Error("No hay token activo");

    const { data } = await api.post(
        "/attendance/clock-in-lunch",
        { location },
        { headers: { Authorization: `Bearer ${token}` } }
    );

    return data;
};

/**
 * Clock Out - Record exit time
 */
export const clockOut = async (location = null) => {
    const token = getAccessToken();
    if (!token) throw new Error("No hay token activo");

    const { data } = await api.post(
        "/attendance/clock-out",
        { location },
        { headers: { Authorization: `Bearer ${token}` } }
    );

    return data;
};

/**
 * Register Exception (Salida Inesperada)
 */
export const registerException = async (type, description, location = null) => {
    const token = getAccessToken();
    if (!token) throw new Error("No hay token activo");

    const { data } = await api.post(
        "/attendance/exception",
        { type, description, location },
        { headers: { Authorization: `Bearer ${token}` } }
    );

    return data;
};

/**
 * Update Exception Status (ON_SITE, RETURNING, COMPLETED)
 */
export const updateExceptionStatus = async (status, location = null) => {
    const token = getAccessToken();
    if (!token) throw new Error("No hay token activo");

    const { data } = await api.post(
        "/attendance/exception/status",
        { status, location },
        { headers: { Authorization: `Bearer ${token}` } }
    );

    return data;
};

/**
 * Get active exception for current user
 */
export const getActiveException = async () => {
    const token = getAccessToken();
    if (!token) throw new Error("No hay token activo");

    const { data } = await api.get("/attendance/exception/active", {
        headers: { Authorization: `Bearer ${token}` },
    });

    return data;
};

/**
 * Get Today's Attendance - For current user
 */
export const getTodayAttendance = async () => {
    const token = getAccessToken();
    if (!token) throw new Error("No hay token activo");

    const { data } = await api.get("/attendance/today", {
        headers: { Authorization: `Bearer ${token}` },
    });

    return data;
};

/**
 * Get User Attendance - For specific date
 */
export const getUserAttendance = async (userId, date) => {
    const token = getAccessToken();
    if (!token) throw new Error("No hay token activo");

    const { data } = await api.get(`/attendance/user/${userId}?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    return data;
};

/**
 * Get Attendance Range - For reporting
 */
export const getAttendanceRange = async (startDate, endDate, userId = null) => {
    const token = getAccessToken();
    if (!token) throw new Error("No hay token activo");

    let url = `/attendance/range?start=${startDate}&end=${endDate}`;
    if (userId) {
        url += `&userId=${userId}`;
    }

    const { data } = await api.get(url, {
        headers: { Authorization: `Bearer ${token}` },
    });

    return data;
};

/**
 * Download Attendance PDF
 */
export const downloadAttendancePDF = async (userId, startDate, endDate) => {
    const token = getAccessToken();
    if (!token) throw new Error("No hay token activo");

    const response = await api.get(
        `/attendance/pdf/${userId}?start=${startDate}&end=${endDate}`,
        {
            headers: { Authorization: `Bearer ${token}` },
            responseType: "blob",
        }
    );

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `asistencia-${userId}-${startDate}-${endDate}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return true;
};

/**
 * Mark Overtime - Register additional work time
 * POST /api/attendance/overtime
 * Body: { hours: number, reason: string, location: string }
 */
export const markOvertime = async (hours, reason, location = null) => {
    const token = getAccessToken();
    if (!token) throw new Error("No hay token activo");

    const { data } = await api.post(
        "/attendance/overtime",
        { hours, reason, location },
        { headers: { Authorization: `Bearer ${token}` } }
    );

    return data;
};

/**
 * Get Overtime Records - Get overtime history
 * GET /api/attendance/overtime?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
export const getOvertimeRecords = async (startDate, endDate) => {
    const token = getAccessToken();
    if (!token) throw new Error("No hay token activo");

    const { data } = await api.get(
        `/attendance/overtime?start=${startDate}&end=${endDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    return data;
};
