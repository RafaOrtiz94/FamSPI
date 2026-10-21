const ATTENDANCE_STATUS_ALIASES = Object.freeze({
  no_entry: "no_entry",
  sin_entrada: "no_entry",
  pending_entry: "no_entry",
  entry_pending: "no_entry",
  working: "working",
  jornada_abierta: "working",
  abierta: "working",
  lunch_open: "lunch_open",
  almuerzo_abierto: "lunch_open",
  lunch: "lunch_open",
  completed: "completed",
  complete: "completed",
  jornada_cerrada: "completed",
  closed: "completed",
  cerrada: "completed",
});

const ATTENDANCE_TIMEZONE = "America/Guayaquil";

const QUICK_RANGE_ALIASES = Object.freeze({
  today: "today",
  hoy: "today",
  week: "week",
  esta_semana: "week",
  semana: "week",
  month: "month",
  este_mes: "month",
  mes: "month",
  year: "year",
  este_ano: "year",
  este_anio: "year",
  año: "year",
  anio: "year",
});

const normalizeString = (value) =>
  String(value ?? "")
    .trim();

const normalizeStatus = (value) => {
  const normalized = normalizeString(value).toLowerCase().replace(/[\s-]+/g, "_");
  return ATTENDANCE_STATUS_ALIASES[normalized] || null;
};

const normalizeQuickRange = (value) => {
  const normalized = normalizeString(value).toLowerCase().replace(/[\s-]+/g, "_");
  return QUICK_RANGE_ALIASES[normalized] || null;
};

const normalizeTargetUserId = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const normalized = normalizeString(value).toLowerCase();
  if (!normalized || normalized === "me") return null;
  if (normalized === "all") return "all";

  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeTargetUserIds = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const rawValues = Array.isArray(value)
    ? value
    : String(value)
        .split(",");

  const normalized = rawValues
    .map((item) => Number(normalizeString(item)))
    .filter((item) => Number.isInteger(item) && item > 0);

  const uniqueValues = [...new Set(normalized)];
  return uniqueValues;
};

const normalizeDepartmentId = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(normalizeString(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeBooleanFlag = (value) => {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  const normalized = normalizeString(value).toLowerCase();
  return ["1", "true", "si", "yes", "y", "on"].includes(normalized);
};

const normalizeDateRangeError = (start, end) => {
  if (!start || !end) return null;
  return end < start ? "END_BEFORE_START" : null;
};

const normalizeRangeDays = (start, end) => {
  if (!start || !end) return null;
  if (normalizeDateRangeError(start, end)) return null;

  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;

  const diffMs = endMs - startMs;
  const diffDays = Math.floor(diffMs / 86400000);
  return diffDays + 1;
};

const normalizeAttendanceRangeFilters = (query = {}) => {
  const start = normalizeString(query.start);
  const end = normalizeString(query.end);
  const status = normalizeStatus(query.status);
  const quickRange = normalizeQuickRange(query.quickRange);
  const userId = normalizeTargetUserId(query.userId);
  const userIds = normalizeTargetUserIds(query.userIds);
  const departmentId = normalizeDepartmentId(query.departmentId);
  const onlyDiscrepancies = normalizeBooleanFlag(query.onlyDiscrepancies);
  const onlyWithGeo = normalizeBooleanFlag(query.onlyWithGeo);
  const dateRangeError = normalizeDateRangeError(start, end);
  const rangeDays = normalizeRangeDays(start, end);
  const exceedsRecommendedRange = Number.isInteger(rangeDays) ? rangeDays > 31 : false;
  const isGlobalScope = userId === "all";

  return {
    start,
    end,
    status,
    quickRange,
    userId,
    userIds,
    departmentId,
    onlyDiscrepancies,
    onlyWithGeo,
    dateRangeError,
    rangeDays,
    exceedsRecommendedRange,
    timezone: ATTENDANCE_TIMEZONE,
    isGlobalScope,
  };
};

module.exports = {
  ATTENDANCE_STATUS_ALIASES,
  ATTENDANCE_TIMEZONE,
  normalizeAttendanceRangeFilters,
  normalizeStatus,
  normalizeQuickRange,
  normalizeTargetUserId,
  normalizeTargetUserIds,
  normalizeDepartmentId,
  normalizeBooleanFlag,
  normalizeDateRangeError,
  normalizeRangeDays,
};
