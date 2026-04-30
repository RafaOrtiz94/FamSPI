import React, { useCallback, useEffect, useMemo, useState, lazy, Suspense } from "react";
import { FiChevronDown, FiChevronUp, FiClock, FiDownload, FiFilter, FiMapPin, FiPieChart, FiTarget, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";

import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import Select from "../../../core/ui/components/Select";
import { DashboardLayout, DashboardHeader } from "../../../core/ui/layouts/DashboardLayout";
import { getUsers } from "../../../core/api/usersApi";
import { downloadAttendancePDF } from "../../../core/api/attendanceApi";
import AttendanceReportsSummaryCards from "../components/attendance-reports/AttendanceReportsSummaryCards";
import AttendanceOvertimeSummary from "../components/attendance-reports/AttendanceOvertimeSummary";
import AttendanceReportsEmptyState from "../components/attendance-reports/AttendanceReportsEmptyState";
import AttendanceReportsTableView from "../components/attendance-reports/AttendanceReportsTableView";
import AttendanceReportsLoadingState from "../components/attendance-reports/AttendanceReportsLoadingState";
import AttendanceReportsToolbar from "../components/attendance-reports/AttendanceReportsToolbar";
import useAttendanceFilters, { ATTENDANCE_REPORT_MODES, ATTENDANCE_REPORT_VIEWS } from "../hooks/useAttendanceFilters";
import useAttendanceReportsQuery from "../hooks/useAttendanceReportsQuery";
import { formatDateSafe, formatTimeSafe } from "../../../shared/utils/dateUtils";
import { useAuth } from "../../../core/auth/AuthContext";

const AttendanceMapView = lazy(() =>
  import("../components/attendance-reports/AttendanceMapView").catch(() => ({
    default: () => <div className="p-4 text-red-500">Error loading map</div>,
  }))
);

const STATUS_OPTIONS = [
 { label: "Todos los estados", value: "" },
 { label: "Sin entrada", value: "no_entry" },
 { label: "Jornada abierta", value: "working" },
 { label: "Almuerzo abierto", value: "lunch_open" },
 { label: "Jornada cerrada", value: "completed" },
];

const OFFICIAL_PDF_PERIOD_OPTIONS = [
 { label: "Mensual", value: "monthly" },
 { label: "Anual (12 meses)", value: "annual" },
];

const getEcuadorDateParts = (baseDate = new Date()) => {
 const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Guayaquil",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
 }).formatToParts(baseDate);

 const map = parts.reduce((acc, part) => {
  if (part.type !== "literal") acc[part.type] = part.value;
  return acc;
 }, {});

 return {
  year: map.year,
  month: map.month,
  day: map.day,
 };
};

const getTodayInputDate = () => {
 const { year, month, day } = getEcuadorDateParts();
 return `${year}-${month}-${day}`;
};

const getMonthStartInputDate = () => {
 const { year, month } = getEcuadorDateParts();
 return `${year}-${month}-01`;
};

const getIsoWeekInputValue = (baseDate = new Date()) => {
 const utcDate = new Date(Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()));
 const day = utcDate.getUTCDay() || 7;
 utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
 const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
 const weekNo = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
 return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const toIsoFromUtcDate = (date) => {
 const year = date.getUTCFullYear();
 const month = String(date.getUTCMonth() + 1).padStart(2, "0");
 const day = String(date.getUTCDate()).padStart(2, "0");
 return `${year}-${month}-${day}`;
};

const getWeekRangeFromInput = (weekValue) => {
 const match = String(weekValue || "").match(/^(\d{4})-W(\d{2})$/);
 if (!match) return null;
 const year = Number(match[1]);
 const week = Number(match[2]);
 if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) return null;

 const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
 const dow = simple.getUTCDay();
 const monday = new Date(simple);
 if (dow <= 4) {
  monday.setUTCDate(simple.getUTCDate() - dow + 1);
 } else {
  monday.setUTCDate(simple.getUTCDate() + 8 - dow);
 }
 const sunday = new Date(monday);
 sunday.setUTCDate(monday.getUTCDate() + 6);

 return {
  startDate: toIsoFromUtcDate(monday),
  endDate: toIsoFromUtcDate(sunday),
 };
};

const getMonthRangeFromInput = (monthValue) => {
 const match = String(monthValue || "").match(/^(\d{4})-(\d{2})$/);
 if (!match) return null;
 const year = Number(match[1]);
 const month = Number(match[2]);
 if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

 const first = new Date(Date.UTC(year, month - 1, 1));
 const last = new Date(Date.UTC(year, month, 0));
 return {
  startDate: toIsoFromUtcDate(first),
  endDate: toIsoFromUtcDate(last),
 };
};

const getYearRangeFromInput = (yearValue) => {
 const year = Number(yearValue);
 if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
 return {
  startDate: `${year}-01-01`,
  endDate: `${year}-12-31`,
 };
};

const ATTENDANCE_STATUS_LABELS = {
 no_entry: "Sin entrada",
 working: "Jornada abierta",
 lunch_open: "Almuerzo abierto",
 completed: "Jornada cerrada",
};

const PROFILE_TIMELINE_CONFIG = [
 { key: "entry", label: "Entrada", timeKey: "entry_time", locationKey: "entry_location" },
 { key: "lunch_start", label: "Inicio almuerzo", timeKey: "lunch_start_time", locationKey: "lunch_start_location" },
 { key: "lunch_end", label: "Fin almuerzo", timeKey: "lunch_end_time", locationKey: "lunch_end_location" },
 { key: "exit", label: "Salida", timeKey: "exit_time", locationKey: "exit_location" },
];
const FIELD_EVENT_LABELS = Object.freeze({
 field_out: "Salida de campo",
 office_entry: "Entrada a oficina o viaje",
 office_exit: "Salida de oficina o viaje",
 client_entry: "Entrada cliente",
 client_exit: "Salida cliente",
});

const WEEKDAY_SHORT_ES = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const PUNCTUALITY_BASE_MINUTES = 9 * 60;
const PUNCTUALITY_TOLERANCE_MINUTES = 5;
const RANKING_SCOPE = Object.freeze({
 WEEK: "week",
 RANGE: "range",
});

const getInitials = (value) => {
 const full = String(value || "").trim();
 if (!full) return "??";
 const parts = full.split(/\s+/);
 if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
 return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
};

const parseCoord = (value) => {
 if (!value || typeof value !== "string") return null;
 const [latRaw, lngRaw] = value.split(",");
 const lat = Number(latRaw?.trim());
 const lng = Number(lngRaw?.trim());
 if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
 if (Math.abs(lat) <= 0.0005 && Math.abs(lng) <= 0.0005) return null;
 if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
 return { lat, lng };
};

const toISODate = (value) => String(value || "").slice(0, 10);

const getWeekStartMonday = (value) => {
 const base = new Date(value);
 if (Number.isNaN(base.getTime())) return null;
 const copy = new Date(base);
 copy.setHours(0, 0, 0, 0);
 const day = copy.getDay();
 const diffToMonday = day === 0 ? -6 : 1 - day;
 copy.setDate(copy.getDate() + diffToMonday);
 return copy;
};

const addDays = (date, days) => {
 const copy = new Date(date);
 copy.setDate(copy.getDate() + days);
 return copy;
};

const formatIsoDay = (date) => {
 const year = date.getFullYear();
 const month = String(date.getMonth() + 1).padStart(2, "0");
 const day = String(date.getDate()).padStart(2, "0");
 return `${year}-${month}-${day}`;
};

const isWeekendDay = (value) => {
 const date = value instanceof Date ? value : new Date(`${toISODate(value)}T00:00:00`);
 if (Number.isNaN(date.getTime())) return false;
 const day = date.getDay();
 return day === 0 || day === 6;
};

const parseTimeMinutes = (value) => {
 if (!value) return null;
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return null;
 return date.getHours() * 60 + date.getMinutes();
};

const parseFieldEventType = (value) =>
 String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[\s-]+/g, "_");

const isValidGpsCoordinate = (lat, lng) => {
 if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
 if (Math.abs(lat) <= 0.0005 && Math.abs(lng) <= 0.0005) return false;
 return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const buildMapGeoPoints = (row = {}) => {
 const basePoints = Array.isArray(row?.geo_points) ? row.geo_points : [];
  const normalizedBase = basePoints
   .map((point = {}) => {
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);
    if (!isValidGpsCoordinate(lat, lng)) return null;
    return {
     type: point?.type || "entry",
     label: point?.label || point?.type || "Marca",
    time: point?.time || point?.timestamp || null,
    lat,
    lng,
   };
  })
  .filter(Boolean);

 const fieldEvents = Array.isArray(row?.field_events) ? row.field_events : [];
  const normalizedField = fieldEvents
   .map((event = {}) => {
    const lat = Number(event?.lat);
    const lng = Number(event?.lng);
    if (!isValidGpsCoordinate(lat, lng)) return null;

    const type = parseFieldEventType(event?.type || event?.event_type);
    return {
    type,
    label: FIELD_EVENT_LABELS[type] || "Evento de campo",
    time: event?.time || event?.timestamp || event?.occurred_at || null,
    lat,
    lng,
   };
  })
  .filter(Boolean);

 const merged = [...normalizedBase, ...normalizedField];
 const seen = new Set();
 return merged.filter((point) => {
  const uniqueKey = `${point.type}|${point.time || ""}|${point.lat.toFixed(6)}|${point.lng.toFixed(6)}`;
  if (seen.has(uniqueKey)) return false;
  seen.add(uniqueKey);
  return true;
 });
};

const toDateOrNull = (value) => {
 const parsed = new Date(value);
 return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildFieldOpsEvents = (row = {}) => {
  const normalizeEvent = (event = {}, index = 0) => {
  const type = parseFieldEventType(event.type || event.event_type || event.kind);
  const label = FIELD_EVENT_LABELS[type];
  if (!label) return null;

  const rawTime = event.time || event.timestamp || event.occurred_at || event.at;
  const parsedDate = toDateOrNull(rawTime);
   const eventLat = Number(event.lat);
   const eventLng = Number(event.lng);
   const coord = isValidGpsCoordinate(eventLat, eventLng)
    ? { lat: eventLat, lng: eventLng }
    : parseCoord(event.coord || event.location);

  return {
   key: `${type}-${rawTime || "no-time"}-${index}`,
   type,
   label,
   rawTime: rawTime || null,
   parsedDate,
   timeLabel: rawTime ? formatTimeSafe(rawTime) : "--",
   coord,
   source: event.source || event.origin || null,
  };
 };

 const explicitEvents = [
  ...(Array.isArray(row.field_events) ? row.field_events : []),
  ...(Array.isArray(row.client_visit_events) ? row.client_visit_events : []),
  ...(Array.isArray(row.mobility_events) ? row.mobility_events : []),
 ]
  .map((event, index) => normalizeEvent(event, index))
  .filter(Boolean);

 if (explicitEvents.length > 0) {
  return explicitEvents.sort((a, b) => {
   if (!a.parsedDate && !b.parsedDate) return 0;
   if (!a.parsedDate) return 1;
   if (!b.parsedDate) return -1;
   return a.parsedDate.getTime() - b.parsedDate.getTime();
  });
 }

 const fallbackEvents = [
  { type: "office_exit", time: row.start_time, location: row.start_location },
  { type: "client_entry", time: row.arrival_time, location: row.arrival_location },
  { type: "client_exit", time: row.departure_time, location: row.departure_location },
  { type: "office_entry", time: row.return_time, location: row.return_location },
 ]
  .map((event, index) =>
   normalizeEvent(
    {
     event_type: event.type,
     time: event.time,
     location: event.location,
    },
    index
   )
  )
  .filter(Boolean);

 return fallbackEvents;
};

const classifyPunctuality = (entryTime) => {
 const entryMinutes = parseTimeMinutes(entryTime);
 if (entryMinutes === null) {
  return { status: "no_entry", lateMinutes: null };
 }

 const delta = entryMinutes - PUNCTUALITY_BASE_MINUTES;
 if (delta <= PUNCTUALITY_TOLERANCE_MINUTES) {
  return { status: "on_time", lateMinutes: 0 };
 }

 return { status: "late", lateMinutes: delta };
};

const getRewardTier = (score) => {
 if (score >= 90) return { key: "platinum", label: "Elite Platino", color: "text-indigo-700 bg-indigo-50 border-indigo-200" };
 if (score >= 75) return { key: "gold", label: "Oro", color: "text-amber-700 bg-amber-50 border-amber-200" };
 if (score >= 60) return { key: "silver", label: "Plata", color: "text-slate-700 bg-slate-100 border-slate-300" };
 return { key: "bronze", label: "Bronce", color: "text-orange-700 bg-orange-50 border-orange-200" };
};

const extractRowGeoPoints = (row = {}) => {
 const points = Array.isArray(row.geo_points) ? row.geo_points : [];
 const fromGeoPoints = points
  .map((point) => {
   if (Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng))) {
    return { lat: Number(point.lat), lng: Number(point.lng) };
   }
   if (typeof point?.coord === "string") {
    return parseCoord(point.coord);
   }
   return null;
  })
  .filter(Boolean);

 if (fromGeoPoints.length > 0) {
  return fromGeoPoints;
 }

 return [
  parseCoord(row.entry_location),
  parseCoord(row.lunch_start_location),
  parseCoord(row.lunch_end_location),
  parseCoord(row.exit_location),
 ].filter(Boolean);
};

const TalentoAsistenciaReportes = () => {
const { user } = useAuth();
const normalizedRole = String(user?.role || user?.role_name || user?.scope || "").toLowerCase().replace(/[\s-]+/g, "_");
const canViewTeamAttendance = normalizedRole.includes("jefe");
const {
   startDate,
   endDate,
   mode,
   view,
   status: selectedStatus,
   userIds,
   quickRange,
   onlyDiscrepancies,
   onlyWithGeo,
   departmentId,
   departmentOptions,
   setStartDate,
   setEndDate,
   setMode,
   setView,
   setStatus: setSelectedStatus,
   setOnlyDiscrepancies,
   setOnlyWithGeo,
   setDepartmentId,
  clearFilters,
  } = useAttendanceFilters({
  mode: ATTENDANCE_REPORT_MODES.OFFICIAL,
  view: "table",
 });
 const isTeamMode = mode === ATTENDANCE_REPORT_MODES.TEAM;
 const isAdminLikeMode = mode === ATTENDANCE_REPORT_MODES.ADMIN || isTeamMode;
 const [loadingPdf, setLoadingPdf] = useState(false);
 const [selectedUserId, setSelectedUserId] = useState("");
 const [officialPdfPeriod, setOfficialPdfPeriod] = useState("monthly");
 const [annualYear, setAnnualYear] = useState(String(new Date().getFullYear()));
 const [userOptions, setUserOptions] = useState([]);
 const [reportRows, setReportRows] = useState([]);
 const [reportSummary, setReportSummary] = useState(null);
 const [reportMeta, setReportMeta] = useState(null);
 const [adminDayFilter, setAdminDayFilter] = useState("");
 const [adminPeriodMode, setAdminPeriodMode] = useState("month");
 const [adminDayValue, setAdminDayValue] = useState(getTodayInputDate());
 const [adminWeekValue, setAdminWeekValue] = useState(getIsoWeekInputValue(new Date()));
 const [adminMonthValue, setAdminMonthValue] = useState(getTodayInputDate().slice(0, 7));
 const [adminYearValue, setAdminYearValue] = useState(String(new Date().getFullYear()));
 const [mapDayFilter, setMapDayFilter] = useState("");
 const [isMapDayFilterEnabled, setIsMapDayFilterEnabled] = useState(false);
 const [selectedDailyProfile, setSelectedDailyProfile] = useState(null);
 const [rankingScope, setRankingScope] = useState(RANKING_SCOPE.WEEK);
 const [isFieldOpsExpanded, setIsFieldOpsExpanded] = useState(false);
 const reportQueryFilters = useMemo(
  () => ({
   startDate,
   endDate,
   userId: isTeamMode ? "" : (selectedUserId === "all" ? "all" : selectedUserId),
   userIds,
   departmentId,
   status: selectedStatus || "",
   quickRange,
   onlyDiscrepancies,
   onlyWithGeo,
   mode,
   view,
  }),
  [departmentId, endDate, isTeamMode, mode, onlyDiscrepancies, onlyWithGeo, quickRange, selectedStatus, selectedUserId, startDate, userIds, view]
 );
const { refetch: refetchAttendanceReports, isFetching: loadingQuery, isInitialLoading, isRefetching } = useAttendanceReportsQuery({
   filters: reportQueryFilters,
   enabled: false,
  });

 const loadUsers = useCallback(async () => {
 try {
 const rows = await getUsers();
 setUserOptions(
 (Array.isArray(rows) ? rows : []).map((user) => ({
 id: user.id,
 nombre: user.fullname || user.email || `Usuario #${user.id}`,
 })),
 );
 } catch (err) {
 console.error("Error cargando usuarios:", err);
 toast.error("Error cargando usuarios");
 }
 }, []);

 useEffect(() => {
 loadUsers();
 setStartDate(getMonthStartInputDate());
 setEndDate(getTodayInputDate());
 }, [loadUsers, setStartDate, setEndDate]);

 useEffect(() => {
 if (mode === ATTENDANCE_REPORT_MODES.ADMIN && !selectedUserId) {
 setSelectedUserId("all");
 }
 if ((mode === ATTENDANCE_REPORT_MODES.OFFICIAL || isTeamMode) && selectedUserId === "all") {
 setSelectedUserId("");
 }
 }, [isTeamMode, mode, selectedUserId]);

 const userSelectOptions = useMemo(() => {
 const baseOptions = userOptions.map((u) => ({ label: u.nombre, value: String(u.id) }));
 if (mode === ATTENDANCE_REPORT_MODES.ADMIN) {
 return [{ label: "Todos los usuarios", value: "all" }, ...baseOptions];
 }
 return [{ label: "Selecciona un usuario", value: "" }, ...baseOptions];
 }, [mode, userOptions]);

 const statusSelectOptions = useMemo(() => STATUS_OPTIONS, []);

 const applyAdminPeriod = useCallback(() => {
  if (!isAdminLikeMode) return;

  if (adminPeriodMode === "day") {
   if (!adminDayValue) return;
   setStartDate(adminDayValue);
   setEndDate(adminDayValue);
   setAdminDayFilter(adminDayValue);
   setMapDayFilter(adminDayValue);
   setIsMapDayFilterEnabled(true);
   return;
  }

  let range = null;
  if (adminPeriodMode === "week") {
   range = getWeekRangeFromInput(adminWeekValue);
  } else if (adminPeriodMode === "month") {
   range = getMonthRangeFromInput(adminMonthValue);
  } else if (adminPeriodMode === "year") {
   range = getYearRangeFromInput(adminYearValue);
  }

  if (!range) return;
  setStartDate(range.startDate);
  setEndDate(range.endDate);
  setAdminDayFilter("");
  setIsMapDayFilterEnabled(false);
  setMapDayFilter("");
 }, [
  adminDayValue,
  adminMonthValue,
  adminPeriodMode,
  adminWeekValue,
  adminYearValue,
  isAdminLikeMode,
  setEndDate,
  setStartDate,
 ]);

const selectedStatusLabel = useMemo(() => {
 if (!selectedStatus) return "Todos los estados";
 return ATTENDANCE_STATUS_LABELS[selectedStatus] || "Estado personalizado";
 }, [selectedStatus]);

 const rangeWarningText = useMemo(() => {
  if (!reportSummary?.meta?.exceedsRecommendedRange) return "";
  return "El rango supera 31 dias. La consulta puede tardar mas de lo normal.";
 }, [reportSummary]);

 useEffect(() => {
  applyAdminPeriod();
 }, [applyAdminPeriod]);

 const handleDownloadPDF = useCallback(async () => {
  if (officialPdfPeriod === "monthly" && (!startDate || !endDate)) {
  return toast.error("Selecciona un rango de fechas.");
  }

  if (!selectedUserId || selectedUserId === "all") {
  return toast.error("Selecciona un usuario especifico.");
  }

  if (officialPdfPeriod === "annual") {
  const parsedYear = Number.parseInt(annualYear, 10);
  if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
  return toast.error("Ingresa un anio valido para el reporte anual.");
  }
  }

  setLoadingPdf(true);
  try {
  const result = await downloadAttendancePDF(selectedUserId, startDate, endDate, {
  periodType: officialPdfPeriod,
  year: annualYear,
  });
  if (result?.hash) {
  toast.success(`PDF generado. Hash SHA-256: ${result.hash.slice(0, 16)}...`);
  } else {
  toast.success("PDF generado correctamente");
  }
  } catch (err) {
  console.error("Error descargando PDF:", err);
  toast.error("No se pudo generar el PDF.");
  } finally {
  setLoadingPdf(false);
  }
 }, [selectedUserId, startDate, endDate, officialPdfPeriod, annualYear]);

 const handleConsultRange = useCallback(async ({ silent = false } = {}) => {
 if (!startDate || !endDate) {
 if (!silent) toast.error("Selecciona un rango de fechas.");
 return;
 }

 if (!isTeamMode && !selectedUserId) {
 if (!silent) toast.error("Selecciona un usuario especifico.");
 return;
 }

 try {
 const response = await refetchAttendanceReports();
 if (response?.error) {
  throw response.error;
 }
 const res = response?.data || null;
 const rows = Array.isArray(res?.data) ? res.data : [];
 setReportRows(rows);
 setReportSummary(res?.summary || null);
 setReportMeta(res?.meta || null);
 if (!silent) {
  toast.success(`Consulta cargada: ${rows.length} registros`);
 }
 } catch (err) {
 console.error("Error consultando asistencia:", err);
 if (!silent) {
  toast.error(err.response?.data?.message || "No se pudo consultar el rango.");
 }
 }
 }, [endDate, isTeamMode, refetchAttendanceReports, selectedUserId, startDate]);

 useEffect(() => {
  if (!isAdminLikeMode) return;
  if ((!isTeamMode && !selectedUserId) || !startDate || !endDate) return;

  const timeoutId = window.setTimeout(() => {
   handleConsultRange({ silent: true });
  }, 180);

  return () => window.clearTimeout(timeoutId);
 }, [
  departmentId,
  endDate,
  handleConsultRange,
  isAdminLikeMode,
  isTeamMode,
  onlyDiscrepancies,
  onlyWithGeo,
  selectedStatus,
  selectedUserId,
  startDate,
 ]);

 useEffect(() => {
  if (view !== ATTENDANCE_REPORT_VIEWS.MAP) return;
  if (!isMapDayFilterEnabled) return;
  if (mapDayFilter) return;
  if (adminDayFilter) {
   setMapDayFilter(adminDayFilter);
   return;
  }
  if (!endDate) return;
  setMapDayFilter(endDate);
 }, [adminDayFilter, endDate, isMapDayFilterEnabled, mapDayFilter, view]);

 const adminFilteredRows = useMemo(() => {
  if (mode !== ATTENDANCE_REPORT_MODES.ADMIN) return reportRows;
  if (!adminDayFilter) return reportRows;
  return reportRows.filter((row) => toISODate(row?.date) === adminDayFilter);
 }, [adminDayFilter, mode, reportRows]);

 const mapRows = useMemo(() => {
  if (view !== ATTENDANCE_REPORT_VIEWS.MAP) return adminFilteredRows;
  if (!isMapDayFilterEnabled || !mapDayFilter) return adminFilteredRows;

  return adminFilteredRows.filter((row) => String(row?.date || "").slice(0, 10) === mapDayFilter);
 }, [adminFilteredRows, isMapDayFilterEnabled, mapDayFilter, view]);

 const mapRowsWithGeo = useMemo(
  () =>
   mapRows
    .map((row) => ({
     ...row,
     map_geo_points: buildMapGeoPoints(row),
    }))
    .filter((row) => row.map_geo_points.length > 0),
  [mapRows]
 );

const statusCounters = useMemo(() => {
  const byStatus = reportSummary?.byStatus || {};
  return [
   { label: "Registros", value: reportSummary?.total ?? reportRows.length },
   { label: "Coincidencias", value: adminFilteredRows.length },
   { label: "Sin entrada", value: byStatus.no_entry ?? 0 },
   { label: "Jornada abierta", value: byStatus.working ?? 0 },
   { label: "Almuerzo abierto", value: byStatus.lunch_open ?? 0 },
   { label: "Jornada cerrada", value: byStatus.completed ?? 0 },
 ];
}, [adminFilteredRows.length, reportRows.length, reportSummary]);

 const modalProfile = useMemo(() => selectedDailyProfile || null, [selectedDailyProfile]);

 const dailyTimeline = useMemo(() => {
  if (!modalProfile) return [];
  return PROFILE_TIMELINE_CONFIG.map((item) => {
   const rawLocation = modalProfile?.[item.locationKey];
   const coord = parseCoord(rawLocation);
   const time = modalProfile?.[item.timeKey];
   return {
    ...item,
    time,
    timeLabel: time ? formatTimeSafe(time) : "--",
    location: rawLocation,
    coord,
   };
  });
 }, [modalProfile]);

 const fieldOpsEvents = useMemo(() => buildFieldOpsEvents(modalProfile || {}), [modalProfile]);

 useEffect(() => {
  setIsFieldOpsExpanded(fieldOpsEvents.length > 0);
 }, [fieldOpsEvents.length, selectedDailyProfile]);

 const dailyProfileScore = useMemo(() => {
  if (!modalProfile) return 0;
  const hasEntry = Boolean(modalProfile.entry_time);
  const hasLunchStart = Boolean(modalProfile.lunch_start_time);
  const hasLunchEnd = Boolean(modalProfile.lunch_end_time);
  const hasExit = Boolean(modalProfile.exit_time);
  const hasAnyGeo = dailyTimeline.some((item) => Boolean(item.coord));

  const score =
   (hasEntry ? 30 : 0) +
   (hasLunchStart ? 15 : 0) +
   (hasLunchEnd ? 15 : 0) +
   (hasExit ? 30 : 0) +
   (hasAnyGeo ? 10 : 0);

  return Math.min(100, score);
 }, [dailyTimeline, modalProfile]);

 const dailyProfileScoreLabel = useMemo(() => {
  if (dailyProfileScore >= 85) return "Excelente trazabilidad";
  if (dailyProfileScore >= 60) return "Seguimiento parcial";
  return "Jornada con vacios";
 }, [dailyProfileScore]);

 const weeklyComparative = useMemo(() => {
  const weekAnchorDate = modalProfile?.date || selectedDailyProfile?.date;
  if (!weekAnchorDate) return null;

  const weekStart = getWeekStartMonday(weekAnchorDate);
  if (!weekStart) return null;
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekKeys = weekDays.map((day) => formatIsoDay(day));

  const ownerId = String(modalProfile?.user_id || selectedDailyProfile?.user_id || "");
  if (!ownerId) return null;

  const currentUserRows = reportRows.filter(
   (row) => String(row?.user_id) === ownerId
  );
  const rowsByDay = new Map(currentUserRows.map((row) => [toISODate(row.date), row]));

  const punctualityDaily = weekDays.map((day, index) => {
   const dayKey = weekKeys[index];
   const row = rowsByDay.get(dayKey) || null;
   const isWeekend = isWeekendDay(day);
   const punctuality = classifyPunctuality(row?.entry_time);
   const status = isWeekend ? "weekend" : punctuality.status;

   return {
    key: dayKey,
    weekday: WEEKDAY_SHORT_ES[index],
    dateLabel: formatDateSafe(day, "dd/MM"),
    row,
    status,
    isWeekend,
    lateMinutes: punctuality.lateMinutes,
    entryLabel: row?.entry_time ? formatTimeSafe(row.entry_time) : "--",
   };
  });

  const businessDays = punctualityDaily.filter((item) => !item.isWeekend);
  const onTimeCount = businessDays.filter((item) => item.status === "on_time").length;
  const lateCount = businessDays.filter((item) => item.status === "late").length;
  const noEntryCount = businessDays.filter((item) => item.status === "no_entry").length;
  const lateMinutesValues = punctualityDaily
   .map((item) => item.lateMinutes)
   .filter((value) => Number.isFinite(value) && value > 0);
  const avgLateMinutes = lateMinutesValues.length
   ? Math.round(lateMinutesValues.reduce((acc, value) => acc + value, 0) / lateMinutesValues.length)
   : 0;

  const geoCellCounter = new Map();
  weekKeys.forEach((dayKey) => {
   const row = rowsByDay.get(dayKey);
   if (!row) return;
   const coords = extractRowGeoPoints(row);
   coords.forEach((coord) => {
    const latCell = Number(coord.lat).toFixed(3);
    const lngCell = Number(coord.lng).toFixed(3);
    const cellKey = `${latCell},${lngCell}`;
    const current = geoCellCounter.get(cellKey) || {
     key: cellKey,
     lat: Number(latCell),
     lng: Number(lngCell),
     count: 0,
    };
    current.count += 1;
    geoCellCounter.set(cellKey, current);
   });
  });

  const geoHeatmap = [...geoCellCounter.values()]
   .sort((a, b) => b.count - a.count)
   .slice(0, 8);
  const maxGeoCount = geoHeatmap[0]?.count || 1;

  return {
   weekStartKey: weekKeys[0],
   weekEndKey: weekKeys[6],
   punctualityDaily,
   punctualitySummary: {
    onTimeCount,
    lateCount,
    noEntryCount,
    avgLateMinutes,
   },
   geoHeatmap,
   maxGeoCount,
  };
 }, [modalProfile, reportRows, selectedDailyProfile]);

 const punctualityRanking = useMemo(() => {
  if (!selectedDailyProfile) return null;

  const rowsSource =
   rankingScope === RANKING_SCOPE.WEEK && weeklyComparative
    ? reportRows.filter((row) => {
       const dayKey = toISODate(row?.date);
       return dayKey >= weeklyComparative.weekStartKey && dayKey <= weeklyComparative.weekEndKey;
      })
    : reportRows;

  const byUser = new Map();

  rowsSource.forEach((row) => {
   const userId = String(row?.user_id || "");
   if (!userId) return;

   if (!byUser.has(userId)) {
    byUser.set(userId, {
     userId,
     fullname: row?.fullname || row?.email || `Usuario ${userId}`,
     onTime: 0,
     late: 0,
     noEntry: 0,
     total: 0,
     lateMinutesTotal: 0,
     streak: 0,
     bestStreak: 0,
     points: 0,
     days: [],
    });
   }

   const current = byUser.get(userId);
    if (isWeekendDay(row?.date)) return;
    const punctuality = classifyPunctuality(row?.entry_time);

   current.total += 1;
   if (punctuality.status === "on_time") {
    current.onTime += 1;
    current.points += 3;
   } else if (punctuality.status === "late") {
    current.late += 1;
    current.points += 1;
    current.lateMinutesTotal += punctuality.lateMinutes || 0;
   } else {
    current.noEntry += 1;
   }

   if (row?.has_geo) {
    current.points += 0.5;
   }

   current.days.push({
    date: toISODate(row?.date),
    status: punctuality.status,
   });
  });

  const ranking = [...byUser.values()].map((entry) => {
   const sortedDays = [...entry.days].sort((a, b) => (a.date > b.date ? 1 : -1));
   let runningStreak = 0;
   sortedDays.forEach((day) => {
    if (day.status === "on_time") {
     runningStreak += 1;
     entry.bestStreak = Math.max(entry.bestStreak, runningStreak);
    } else {
     runningStreak = 0;
    }
   });

   const effectiveDays = entry.onTime + entry.late;
   const punctualityRate = effectiveDays > 0 ? Math.round((entry.onTime / effectiveDays) * 100) : 0;
   const avgLateMinutes = entry.late > 0 ? Math.round(entry.lateMinutesTotal / entry.late) : 0;
   const score = Math.min(
    100,
    Math.round(
     punctualityRate * 0.7 +
      Math.min(entry.bestStreak, 5) * 4 +
      Math.min(entry.points, 30) * 0.6
    )
   );

   return {
    ...entry,
    avgLateMinutes,
    punctualityRate,
    score,
    rewardTier: getRewardTier(score),
   };
  });

  ranking.sort((a, b) => {
   if (b.score !== a.score) return b.score - a.score;
   if (b.onTime !== a.onTime) return b.onTime - a.onTime;
   return a.avgLateMinutes - b.avgLateMinutes;
  });

  const ranked = ranking.map((item, index) => ({ ...item, rank: index + 1 }));
  const rankingOwnerId = String(modalProfile?.user_id || selectedDailyProfile?.user_id || "");
  const selectedUser = ranked.find(
   (item) => String(item.userId) === rankingOwnerId
  ) || null;

  return {
   scope: rankingScope,
   totalParticipants: ranked.length,
   top: ranked.slice(0, 8),
   selectedUser,
   maxScore: ranked[0]?.score || 100,
  };
 }, [modalProfile, rankingScope, reportRows, selectedDailyProfile, weeklyComparative]);

 const openDailyProfile = useCallback((row) => {
  if (!row) return;
  setSelectedDailyProfile(row);
 }, []);

 const closeDailyProfile = useCallback(() => {
  setSelectedDailyProfile(null);
 }, []);

 const openProfileFromMarker = useCallback(
  (marker) => {
   if (!marker) return;
   const row = reportRows.find(
    (item) =>
     String(item?.user_id) === String(marker.userId) &&
     toISODate(item?.date) === toISODate(marker.date)
   );
   if (row) {
    setSelectedDailyProfile(row);
   }
  },
  [reportRows]
 );

 const focusDailyMap = useCallback(() => {
  if (!modalProfile) return;
  setView(ATTENDANCE_REPORT_VIEWS.MAP);
  setIsMapDayFilterEnabled(true);
  setMapDayFilter(toISODate(modalProfile.date));
  setSelectedUserId(String(modalProfile.user_id || ""));
 }, [modalProfile, setView]);

 return (
 <DashboardLayout includeWidgets={false}>
 <DashboardHeader
 title="Reportes de Asistencia"
 subtitle="Reporte oficial RH-09, consulta administrativa y consulta por equipo"
 />

 <Card className="space-y-6 p-6">
 <div className="border-b border-slate-200 pb-4">
 <h2 className="text-xl font-semibold text-slate-950">
 Reportes de asistencia
 </h2>
 <p className="mt-1 text-sm text-slate-600">
 El modo oficial descarga el RH-09 por usuario. El modo administrativo y de equipo consultan rangos y estados operativos.
 </p>
 </div>

<div className={`grid grid-cols-1 gap-3 ${canViewTeamAttendance ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
  <button
  type="button"
  onClick={() => setMode(ATTENDANCE_REPORT_MODES.OFFICIAL)}
  className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${
   mode === ATTENDANCE_REPORT_MODES.OFFICIAL
   ? "border-blue-200 bg-blue-50 text-blue-900"
   : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
  }`}
  >
  <FiDownload className="text-xl" />
  <div>
  <div className="text-sm font-semibold">Reporte oficial RH-09</div>
  <div className="text-xs opacity-75">PDF por usuario y rango especifico.</div>
  </div>
  </button>

  <button
  type="button"
  onClick={() => setMode(ATTENDANCE_REPORT_MODES.ADMIN)}
  className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${
   mode === ATTENDANCE_REPORT_MODES.ADMIN
   ? "border-emerald-200 bg-emerald-50 text-emerald-900"
   : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
  }`}
  >
  <FiPieChart className="text-xl" />
  <div>
  <div className="text-sm font-semibold">Consulta administrativa</div>
  <div className="text-xs opacity-75">Usuario, rango y estado derivado de jornada.</div>
  </div>
  </button>

  {canViewTeamAttendance ? (
    <button
    type="button"
    onClick={() => setMode(ATTENDANCE_REPORT_MODES.TEAM)}
    className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${
     mode === ATTENDANCE_REPORT_MODES.TEAM
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
    }`}
    >
    <FiTarget className="text-xl" />
    <div>
    <div className="text-sm font-semibold">Consulta de mi equipo</div>
    <div className="text-xs opacity-75">Solo colaboradores de tu área (sin horas extra).</div>
    </div>
    </button>
  ) : null}
 </div>

 {mode === ATTENDANCE_REPORT_MODES.OFFICIAL ? (
 <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
 <div>
 <label className="mb-2 block text-sm font-medium text-slate-700">
 Fecha inicio
 </label>
 <input
 type="date"
 value={startDate}
 onChange={(e) => setStartDate(e.target.value)}
 className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
 />
 </div>

 <div>
 <label className="mb-2 block text-sm font-medium text-slate-700">
 Fecha fin
 </label>
 <input
 type="date"
 value={endDate}
 onChange={(e) => setEndDate(e.target.value)}
 className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
 />
 </div>

 <div>
 <label className="mb-2 block text-sm font-medium text-slate-700">
 Usuario
 </label>
 <Select
 value={selectedUserId}
 options={userSelectOptions}
 onChange={(e) => setSelectedUserId(e.target.value)}
 className="w-full"
 />
 </div>

 <div className="flex items-end">
 <Button
 variant="primary"
 icon={FiDownload}
 onClick={handleDownloadPDF}
 disabled={loadingPdf}
 className="w-full py-2.5"
 >
 {loadingPdf ? "Generando..." : "Descargar PDF"}
 </Button>
 </div>
 </div>
 ) : null}

 {isAdminLikeMode ? (
 <div className="space-y-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50 p-4 md:p-5">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div>
 <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Filtro unificado de consulta</p>
 <p className="mt-1 text-sm text-emerald-900/85">
  {isTeamMode
   ? "Consulta por periodo para colaboradores de tu área. El alcance se aplica automáticamente por rol."
   : "Selecciona colaborador y periodo (dia, semana, mes o anio) desde un solo panel."}
 </p>
 </div>
 <div className="inline-flex rounded-xl border border-emerald-300 bg-white p-1 text-xs font-semibold">
 {[
  { key: "day", label: "Dia" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "year", label: "Anio" },
 ].map((item) => (
  <button
   key={item.key}
   type="button"
   onClick={() => setAdminPeriodMode(item.key)}
   className={`rounded-lg px-3 py-1.5 transition ${
    adminPeriodMode === item.key
     ? "bg-emerald-600 text-white"
     : "text-slate-600 hover:text-slate-900"
   }`}
  >
   {item.label}
  </button>
 ))}
 </div>
 </div>

 <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
 {!isTeamMode ? (
 <div className="md:col-span-2">
 <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Colaborador</label>
 <Select
 value={selectedUserId}
 options={userSelectOptions}
 onChange={(e) => setSelectedUserId(e.target.value)}
 className="w-full"
 />
 </div>
 ) : null}
 {!isTeamMode ? (
 <div>
 <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Departamento</label>
 <select
  value={departmentId}
  onChange={(event) => setDepartmentId(event.target.value)}
  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
 >
  <option value="">Todos los departamentos</option>
  {departmentOptions.map((option) => (
   <option key={option.value} value={option.value}>
    {option.label}
   </option>
  ))}
 </select>
 </div>
 ) : null}
 <div>
 <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estado</label>
 <Select
  value={selectedStatus}
  options={statusSelectOptions}
  onChange={(e) => setSelectedStatus(e.target.value)}
  className="w-full"
 />
 </div>
 </div>

 <div className="grid grid-cols-1 gap-3 md:grid-cols-[240px,auto] md:items-end">
 <label className="block">
 <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
  Calendario visual
 </span>
 {adminPeriodMode === "day" ? (
  <input
   type="date"
   value={adminDayValue}
   onChange={(event) => setAdminDayValue(event.target.value)}
   className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-800"
  />
 ) : null}
 {adminPeriodMode === "week" ? (
  <input
   type="week"
   value={adminWeekValue}
   onChange={(event) => setAdminWeekValue(event.target.value)}
   className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-800"
  />
 ) : null}
 {adminPeriodMode === "month" ? (
  <input
   type="month"
   value={adminMonthValue}
   onChange={(event) => setAdminMonthValue(event.target.value)}
   className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-800"
  />
 ) : null}
 {adminPeriodMode === "year" ? (
  <input
   type="number"
   min="2000"
   max="2100"
   value={adminYearValue}
   onChange={(event) => setAdminYearValue(event.target.value)}
   className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-800"
  />
 ) : null}
 </label>

 <div className="flex flex-wrap items-center gap-2">
 <button
  type="button"
  onClick={() => {
   const today = getTodayInputDate();
   setAdminPeriodMode("day");
   setAdminDayValue(today);
  }}
  className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
 >
  Hoy
 </button>
 <button
  type="button"
  onClick={() => setAdminPeriodMode("week")}
  className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
 >
  Esta semana
 </button>
 <button
  type="button"
  onClick={() => setAdminPeriodMode("month")}
  className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
 >
  Este mes
 </button>
 <button
  type="button"
  onClick={() => setAdminPeriodMode("year")}
  className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
 >
  Este anio
 </button>
 <button
  type="button"
  onClick={() => setAdminDayFilter("")}
  className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
 >
  Limpiar dia adicional
 </button>
 <button
  type="button"
  onClick={() => setOnlyDiscrepancies(!onlyDiscrepancies)}
  className={`rounded-full border px-3 py-2 text-xs font-semibold ${
   onlyDiscrepancies
    ? "border-emerald-300 bg-emerald-100 text-emerald-900"
    : "border-slate-300 bg-white text-slate-600"
  }`}
 >
  Solo discrepancias
 </button>
 <button
  type="button"
  onClick={() => setOnlyWithGeo(!onlyWithGeo)}
  className={`rounded-full border px-3 py-2 text-xs font-semibold ${
   onlyWithGeo
    ? "border-cyan-300 bg-cyan-100 text-cyan-900"
    : "border-slate-300 bg-white text-slate-600"
  }`}
 >
  Solo geolocalizacion
 </button>
 </div>
 </div>

 <p className="text-sm text-emerald-900/80">
  {adminDayFilter
   ? `Mostrando dia puntual ${adminDayFilter} dentro del periodo seleccionado.`
   : `Periodo activo: ${startDate || "--"} a ${endDate || "--"}.`}
 </p>
 </div>
 ) : null}

 {false ? (
 <div className="grid grid-cols-1 gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 md:grid-cols-[260px,auto] md:items-end">
 <label className="block">
 <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
 Filtro diario adicional
 </span>
 <input
 type="date"
 value={adminDayFilter}
 min={startDate || undefined}
 max={endDate || undefined}
 onChange={(event) => setAdminDayFilter(event.target.value)}
 className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-800"
 />
 </label>
 <div className="flex flex-wrap items-center gap-2 text-sm text-emerald-900">
 <button
 type="button"
 onClick={() => {
  const today = getTodayInputDate();
  setAdminDayFilter(today);
  setMapDayFilter(today);
  setIsMapDayFilterEnabled(true);
 }}
 className="rounded-lg border border-emerald-300 bg-white px-3 py-2 font-medium hover:bg-emerald-100"
 >
 Ver hoy
 </button>
 <button
 type="button"
 onClick={() => setAdminDayFilter("")}
 className="rounded-lg border border-emerald-300 bg-white px-3 py-2 font-medium hover:bg-emerald-100"
 >
 Limpiar día
 </button>
 <span>
 {adminDayFilter
  ? `Mostrando asistencias del ${adminDayFilter} para el colaborador/filtro seleccionado.`
  : "Sin filtro diario adicional (se muestra todo el rango)."}
 </span>
 </div>
 </div>
 ) : null}

 {mode === ATTENDANCE_REPORT_MODES.OFFICIAL ? (
 <div className="grid grid-cols-1 gap-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 md:grid-cols-2">
 <div>
 <label className="mb-2 block text-sm font-medium text-blue-900">
 Tipo de reporte oficial
 </label>
 <Select
 value={officialPdfPeriod}
 options={OFFICIAL_PDF_PERIOD_OPTIONS}
 onChange={(e) => setOfficialPdfPeriod(e.target.value)}
 className="w-full"
 />
 </div>
 <div>
 <label className="mb-2 block text-sm font-medium text-blue-900">
 Anio (solo anual)
 </label>
 <input
 type="number"
 min="2000"
 max="2100"
 value={annualYear}
 onChange={(e) => setAnnualYear(e.target.value)}
 disabled={officialPdfPeriod !== "annual"}
 className="w-full rounded-lg border-2 border-blue-200 bg-white px-3 py-2 text-sm transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
 />
 <p className="mt-1 text-xs text-blue-800">
 En anual se genera un acta con 12 meses para el colaborador.
 </p>
 </div>
 </div>
 ) : null}

 <AttendanceReportsSummaryCards items={statusCounters} />
 {mode === ATTENDANCE_REPORT_MODES.ADMIN ? (
  <AttendanceOvertimeSummary rows={adminFilteredRows} meta={reportMeta} />
 ) : null}

 <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
 <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
 <FiFilter className="text-slate-500" />
 <span className="font-semibold">Filtro activo:</span>
 <span>{isAdminLikeMode ? selectedStatusLabel : "PDF oficial por usuario"}</span>
 <span className="text-slate-400">|</span>
 <span>
 {mode === ATTENDANCE_REPORT_MODES.OFFICIAL && officialPdfPeriod === "annual"
 ? `Periodo anual: ${annualYear || "anio"}`
 : `Periodo: ${startDate || "fecha inicio"} a ${endDate || "fecha fin"}`}
 </span>
 <span className="text-slate-400">|</span>
 <span>Hora visible: Ecuador (UTC-5, 24h)</span>
 </div>
 </div>

{isAdminLikeMode ? (
   <AttendanceReportsToolbar
    onAction={() => handleConsultRange({ silent: false })}
   disabled={loadingQuery}
   actionLabel={loadingQuery ? "Consultando..." : "Consultar rango"}
  onClear={() => {
   clearFilters();
   setAdminDayFilter("");
   setAdminPeriodMode("month");
   setAdminDayValue(getTodayInputDate());
   setAdminWeekValue(getIsoWeekInputValue(new Date()));
   setAdminMonthValue(getTodayInputDate().slice(0, 7));
   setAdminYearValue(String(new Date().getFullYear()));
   setSelectedUserId("all");
   setIsMapDayFilterEnabled(false);
   setMapDayFilter("");
   setReportMeta(null);
  }}
   clearDisabled={loadingQuery}
    warningText={rangeWarningText}
    view={view}
    onViewChange={setView}
  >
  <AttendanceReportsLoadingState
    isLoading={loadingQuery}
    isInitialLoading={isInitialLoading}
    isRefetching={isRefetching}
  />
  {view === ATTENDANCE_REPORT_VIEWS.MAP && (
   <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
    <div className="mb-3 flex flex-wrap items-center gap-2">
     <button
      type="button"
      onClick={() => {
       setIsMapDayFilterEnabled(false);
       setMapDayFilter("");
      }}
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
       !isMapDayFilterEnabled
        ? "border-emerald-300 bg-emerald-100 text-emerald-900"
        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
      }`}
     >
      Rango completo
     </button>
     <button
      type="button"
      onClick={() => setIsMapDayFilterEnabled(true)}
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
       isMapDayFilterEnabled
        ? "border-blue-300 bg-blue-100 text-blue-900"
        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
      }`}
     >
      Filtrar por dia
     </button>
    </div>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px,auto,auto] md:items-end">
     {isMapDayFilterEnabled ? (
      <label className="block">
       <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Calendario (mapa por dia)
       </span>
       <input
        type="date"
        value={mapDayFilter}
        min={startDate || undefined}
        max={endDate || undefined}
        onChange={(event) => setMapDayFilter(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
       />
      </label>
     ) : (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-500">
       Calendario deshabilitado para analizar todo el rango.
      </div>
     )}
     <p className="text-sm text-slate-600">
      {isMapDayFilterEnabled && mapDayFilter
       ? `Mostrando ${mapRows.length} registros del ${mapDayFilter}.`
       : `Mostrando ${mapRows.length} registros del rango.`}
     </p>
     <div className="flex justify-start md:justify-end">
      <button
       type="button"
       onClick={() => {
        setIsMapDayFilterEnabled(false);
        setMapDayFilter("");
       }}
       className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
       Deshabilitar calendario
      </button>
     </div>
    </div>
   </div>
  )}
  {(view === ATTENDANCE_REPORT_VIEWS.MAP ? mapRows.length > 0 : adminFilteredRows.length > 0) ? (
    view === ATTENDANCE_REPORT_VIEWS.MAP ? (
      <Suspense fallback={<div className="flex h-[400px] items-center justify-center bg-slate-100">Cargando mapa...</div>}>
        <AttendanceMapView
          rows={mapRowsWithGeo}
          getGeoPoints={(row) => row.map_geo_points || row.geo_points || []}
          onProfileClick={openProfileFromMarker}
        />
      </Suspense>
    ) : (
      <AttendanceReportsTableView rows={adminFilteredRows} onProfileClick={openDailyProfile} />
    )
  ) : (
  <AttendanceReportsEmptyState onConsult={() => handleConsultRange({ silent: false })} />
  )}
  </AttendanceReportsToolbar>
 ) : (
  <div className="space-y-4">
  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">
  <h3 className="text-sm font-semibold text-blue-900">Reporte oficial RH-09</h3>
  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-800">
  <li>Genera un PDF por colaborador en formato mensual o anual.</li>
  <li>En anual se emiten 12 meses y, si aplica, se marca desde fecha de ingreso.</li>
  <li>El acta se descarga bloqueada (campos no editables) y con hash SHA-256.</li>
  <li>La consulta administrativa usa el mismo rango, pero no sustituye el PDF oficial.</li>
  </ul>
  </div>

  <div className="flex justify-end">
  <Button
  variant="primary"
  icon={FiDownload}
  onClick={handleDownloadPDF}
  disabled={loadingPdf}
  className="w-full md:w-auto"
  >
  {loadingPdf ? "Generando..." : "Descargar PDF oficial"}
  </Button>
  </div>
  </div>
 )}
 </Card>

 {selectedDailyProfile ? (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-3 md:p-6">
   <div className="flex min-h-full items-start justify-center md:items-center">
   <div className="flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[calc(100vh-1.5rem)] md:max-h-[calc(100vh-3rem)]">
    <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-4 text-white md:px-6 md:py-5">
     <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-sm font-semibold tracking-wide">
       {getInitials(modalProfile?.fullname || modalProfile?.email)}
      </div>
      <div>
       <h3 className="text-lg font-semibold">
        Perfil diario de asistencia
       </h3>
       <p className="text-sm text-slate-200">
        {modalProfile?.fullname || modalProfile?.email || "Usuario"} · {formatDateSafe(modalProfile?.date || selectedDailyProfile?.date, "dd/MM/yyyy")}
       </p>
      </div>
     </div>
     <button
      type="button"
      onClick={closeDailyProfile}
      className="rounded-lg border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20"
      aria-label="Cerrar perfil diario"
     >
      <FiX />
     </button>
    </div>

    <div className="overflow-y-auto p-4 md:p-6">
    <div className="grid gap-5 md:grid-cols-3">
     <div className="md:col-span-1">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
       <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Radar operativo</p>
       <div className="mt-3 flex items-end gap-3">
        <span className="text-3xl font-bold text-slate-900">{dailyProfileScore}</span>
        <span className="pb-1 text-sm text-slate-500">/100</span>
       </div>
       <p className="mt-2 text-sm font-medium text-slate-700">{dailyProfileScoreLabel}</p>
       <div className="mt-3 h-2 rounded-full bg-slate-200">
        <div
         className={`h-2 rounded-full transition-all ${dailyProfileScore >= 85 ? "bg-emerald-500" : dailyProfileScore >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
         style={{ width: `${dailyProfileScore}%` }}
        />
       </div>
       <div className="mt-4 space-y-2 text-sm text-slate-600">
        <p><span className="font-medium text-slate-800">Estado:</span> {modalProfile?.attendance_status_label || "Sin estado"}</p>
        <p><span className="font-medium text-slate-800">Departamento:</span> {modalProfile?.department_name || "-"}</p>
        <p><span className="font-medium text-slate-800">Horas registradas:</span> {modalProfile?.total_hours ? `${Number(modalProfile.total_hours).toFixed(1)}h` : "--"}</p>
       </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
       <button
        type="button"
        onClick={focusDailyMap}
        disabled={!modalProfile}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
       >
        <FiTarget className="text-base" />
        Enfocar en mapa diario
       </button>
       <a
        href={`/dashboard/talento-humano/asistencia?userId=${modalProfile?.user_id || selectedDailyProfile?.user_id || ""}&date=${toISODate(modalProfile?.date || selectedDailyProfile?.date)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
       >
        <FiDownload className="text-base" />
        Abrir detalle completo
       </a>
      </div>
     </div>

     <div className="md:col-span-2">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Timeline de jornada</p>
      <div className="mt-3 space-y-3">
       {dailyTimeline.map((item) => (
        <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-4">
         <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
           <FiClock className={item.time ? "text-emerald-600" : "text-slate-400"} />
           <p className="text-sm font-semibold text-slate-900">{item.label}</p>
          </div>
          <p className={`text-sm font-medium ${item.time ? "text-slate-800" : "text-slate-400"}`}>
           {item.timeLabel}
          </p>
         </div>
         <div className="mt-2">
          {item.coord ? (
           <a
            href={`https://www.google.com/maps?q=${item.coord.lat},${item.coord.lng}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
           >
            <FiMapPin />
            Ver punto GPS ({item.coord.lat.toFixed(5)}, {item.coord.lng.toFixed(5)})
           </a>
          ) : (
           <p className="text-sm text-slate-400">Sin coordenada para este evento.</p>
          )}
        </div>
       </div>
      ))}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white">
       <button
        type="button"
        onClick={() => setIsFieldOpsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
       >
        <div>
         <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Marcaciones de campo
         </p>
         <p className="mt-1 text-sm text-slate-700">
          Entrada/salida de oficina o viaje y cliente (multi-ciclo en el dia)
         </p>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
         {fieldOpsEvents.length} eventos
         {isFieldOpsExpanded ? <FiChevronUp /> : <FiChevronDown />}
        </span>
       </button>

       {isFieldOpsExpanded ? (
        <div className="border-t border-slate-200 px-4 py-3">
         {fieldOpsEvents.length > 0 ? (
          <div className="space-y-2">
           {fieldOpsEvents.map((event) => (
            <div key={event.key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
             <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{event.label}</p>
              <p className="text-sm font-medium text-slate-700">{event.timeLabel}</p>
             </div>
             <div className="mt-1 flex flex-wrap items-center gap-3">
              {event.coord ? (
               <a
                href={`https://www.google.com/maps?q=${event.coord.lat},${event.coord.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
               >
                <FiMapPin />
                {event.coord.lat.toFixed(5)}, {event.coord.lng.toFixed(5)}
               </a>
              ) : (
               <p className="text-xs text-slate-500">Sin coordenada</p>
              )}
              {event.source ? <p className="text-xs text-slate-500">Fuente: {String(event.source)}</p> : null}
             </div>
            </div>
           ))}
          </div>
         ) : (
          <p className="text-sm text-slate-500">
           Aun no hay marcaciones de campo para este dia.
          </p>
         )}
        </div>
       ) : null}
      </div>

      {weeklyComparative ? (
       <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
         <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Comparativo semanal
         </p>
         <p className="text-xs text-slate-500">
          {weeklyComparative.weekStartKey} al {weeklyComparative.weekEndKey}
         </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
         <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
           <p className="text-xs text-emerald-700">A tiempo</p>
           <p className="text-xl font-semibold text-emerald-900">{weeklyComparative.punctualitySummary.onTimeCount}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
           <p className="text-xs text-amber-700">Tarde</p>
           <p className="text-xl font-semibold text-amber-900">{weeklyComparative.punctualitySummary.lateCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
           <p className="text-xs text-slate-600">Sin entrada</p>
           <p className="text-xl font-semibold text-slate-900">{weeklyComparative.punctualitySummary.noEntryCount}</p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
           <p className="text-xs text-rose-700">Prom. atraso</p>
           <p className="text-xl font-semibold text-rose-900">{weeklyComparative.punctualitySummary.avgLateMinutes}m</p>
          </div>
         </div>

         <div className="mt-4 grid grid-cols-7 gap-2">
          {weeklyComparative.punctualityDaily.map((item) => {
           const toneClass =
            item.status === "on_time"
             ? "border-emerald-200 bg-emerald-50 text-emerald-800"
             : item.status === "late"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-slate-200 bg-white text-slate-500";

           const barPercent =
            item.status === "late"
             ? Math.min(100, Math.max(12, ((item.lateMinutes || 0) / 60) * 100))
             : item.status === "on_time"
              ? 100
              : 10;

           return (
            <div key={item.key} className={`rounded-lg border px-2 py-2 ${toneClass}`}>
             <p className="text-[11px] font-semibold">{item.weekday}</p>
             <p className="text-[10px] opacity-80">{item.dateLabel}</p>
             <div className="mt-2 h-1.5 rounded-full bg-black/10">
              <div className="h-1.5 rounded-full bg-current" style={{ width: `${barPercent}%` }} />
             </div>
             <p className="mt-2 text-[11px] font-medium">{item.entryLabel}</p>
            </div>
           );
          })}
         </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
         <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Heatmap de geolocalización (semana)</p>
          <p className="text-xs text-slate-500">Celdas aprox. 100m</p>
         </div>
         {weeklyComparative.geoHeatmap.length > 0 ? (
          <div className="space-y-2">
           {weeklyComparative.geoHeatmap.map((spot) => {
            const width = Math.round((spot.count / weeklyComparative.maxGeoCount) * 100);
            return (
             <div key={spot.key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
               <a
                href={`https://www.google.com/maps?q=${spot.lat},${spot.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-blue-600 hover:underline"
               >
                {spot.lat.toFixed(3)}, {spot.lng.toFixed(3)}
               </a>
               <span className="text-xs font-semibold text-slate-600">{spot.count} marcas</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200">
               <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${width}%` }} />
              </div>
             </div>
            );
           })}
          </div>
         ) : (
         <p className="text-sm text-slate-500">No hay puntos GPS suficientes en esta semana para construir heatmap.</p>
         )}
        </div>

        {punctualityRanking ? (
         <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
           <p className="text-sm font-semibold text-slate-900">Liga de puntualidad</p>
           <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1 text-xs">
            <button
             type="button"
             onClick={() => setRankingScope(RANKING_SCOPE.WEEK)}
             className={`rounded-md px-3 py-1.5 font-medium transition ${rankingScope === RANKING_SCOPE.WEEK ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
            >
             Semana
            </button>
            <button
             type="button"
             onClick={() => setRankingScope(RANKING_SCOPE.RANGE)}
             className={`rounded-md px-3 py-1.5 font-medium transition ${rankingScope === RANKING_SCOPE.RANGE ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
            >
             Rango
            </button>
           </div>
          </div>

          {punctualityRanking.selectedUser ? (
           <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
             <p className="text-sm font-semibold text-blue-900">
              Posición #{punctualityRanking.selectedUser.rank} de {punctualityRanking.totalParticipants}
             </p>
             <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${punctualityRanking.selectedUser.rewardTier.color}`}>
              {punctualityRanking.selectedUser.rewardTier.label}
             </span>
            </div>
            <p className="mt-1 text-xs text-blue-800">
             Score {punctualityRanking.selectedUser.score}/100 · Puntualidad {punctualityRanking.selectedUser.punctualityRate}% · Racha {punctualityRanking.selectedUser.bestStreak} dias
            </p>
           </div>
          ) : null}

          <div className="mt-4 space-y-2">
           <AnimatePresence mode="wait">
            <motion.div
             key={punctualityRanking.scope}
             initial={{ opacity: 0, y: 8 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -8 }}
             transition={{ duration: 0.22 }}
             className="space-y-2"
            >
             {punctualityRanking.top.map((entry, index) => {
              const width = Math.max(
               8,
               Math.round((entry.score / (punctualityRanking.maxScore || 100)) * 100)
              );
              const medal =
               index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${entry.rank}`;

              return (
               <div key={`${entry.userId}-${punctualityRanking.scope}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                 <div className="flex min-w-0 items-center gap-2">
                  <span className="text-sm">{medal}</span>
                  <span className="truncate text-sm font-medium text-slate-900">{entry.fullname}</span>
                 </div>
                 <span className="text-xs font-semibold text-slate-700">{entry.score}/100</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200">
                 <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className={`h-2 rounded-full ${index === 0 ? "bg-indigo-500" : index === 1 ? "bg-emerald-500" : "bg-blue-500"}`}
                 />
                </div>
                <p className="mt-1 text-[11px] text-slate-600">
                 A tiempo: {entry.onTime} · Tarde: {entry.late} · Prom atraso: {entry.avgLateMinutes}m · Racha: {entry.bestStreak}
                </p>
               </div>
              );
             })}
            </motion.div>
           </AnimatePresence>
          </div>
         </div>
        ) : null}
       </div>
      ) : null}
     </div>
    </div>
	    </div>
	   </div>
	  </div>
	 </div>
	 ) : null}
</DashboardLayout>
 );
};

export default TalentoAsistenciaReportes;
