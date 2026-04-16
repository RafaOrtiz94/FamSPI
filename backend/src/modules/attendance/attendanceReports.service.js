const { parseCoordinatePair } = require("./attendanceGeo.utils");

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

const normalizeAttendanceStateFilter = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return ATTENDANCE_STATUS_ALIASES[normalized] || null;
};

const deriveAttendanceState = (record = {}) => {
  if (!record?.entry_time) return "no_entry";
  if (record?.exit_time) return "completed";
  if (record?.lunch_start_time && !record?.lunch_end_time) return "lunch_open";
  return "working";
};

const normalizeCoordinateString = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, "");

const sanitizeHtmlText = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const isValidCoordinatePair = (value) => {
  const normalized = normalizeCoordinateString(value);
  if (!normalized || !normalized.includes(",")) return false;

  const [latRaw, lngRaw] = normalized.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const deriveHasGeo = (record = {}) => {
  const geoCandidates = [
    record.entry_location,
    record.lunch_start_location,
    record.lunch_end_location,
    record.exit_location,
    record.start_location,
    record.arrival_location,
    record.departure_location,
    record.return_location,
  ];

  return geoCandidates.some(isValidCoordinatePair);
};

const deriveHasDiscrepancy = (record = {}) => {
  const missingCorePunch =
    !record.entry_time ||
    !record.exit_time ||
    (record.lunch_start_time && !record.lunch_end_time);

  const hasException =
    Boolean(record.exception_id) ||
    String(record.exception_status || "").trim().toUpperCase() === "ACTIVE";

  return missingCorePunch || hasException;
};

const ATTENDANCE_GEO_FIELDS = Object.freeze([
  { key: "entry_location", type: "entry", label: "Entrada", timeKey: "entry_time" },
  { key: "lunch_start_location", type: "lunch_start", label: "Almuerzo salida", timeKey: "lunch_start_time" },
  { key: "lunch_end_location", type: "lunch_end", label: "Almuerzo regreso", timeKey: "lunch_end_time" },
  { key: "exit_location", type: "exit", label: "Salida", timeKey: "exit_time" },
  { key: "start_location", type: "start", label: "Inicio", timeKey: "start_time" },
  { key: "arrival_location", type: "arrival", label: "Llegada", timeKey: "arrival_time" },
  { key: "departure_location", type: "departure", label: "Salida", timeKey: "departure_time" },
  { key: "return_location", type: "return", label: "Regreso", timeKey: "return_time" },
]);

const ATTENDANCE_POLYLINE_ORDER = Object.freeze([
  "entry",
  "lunch_start",
  "lunch_end",
  "exit",
]);

const buildGeoPoints = (record = {}) =>
  ATTENDANCE_GEO_FIELDS.reduce((points, field) => {
    const parsed = parseCoordinatePair(record[field.key]);
    if (!parsed) return points;

    points.push({
      type: field.type,
      label: sanitizeHtmlText(field.label),
      time: record[field.timeKey] || null,
      lat: parsed.lat,
      lng: parsed.lng,
    });
    return points;
  }, []);

const buildPolylinePoints = (record = {}) => {
  const geoPointsByType = new Map(buildGeoPoints(record).map((point) => [point.type, point]));
  return ATTENDANCE_POLYLINE_ORDER
    .map((type) => geoPointsByType.get(type))
    .filter(Boolean)
    .map(({ lat, lng, type, label, time }) => ({ lat, lng, type, label, time }));
};

const filterAttendanceRowsByStatus = (rows = [], status) => {
  const normalizedStatus = normalizeAttendanceStateFilter(status);
  if (!normalizedStatus) return rows;
  return rows.filter((row) => deriveAttendanceState(row) === normalizedStatus);
};

const enrichAttendanceRowGeo = (record = {}) => ({
  ...record,
  fullname: sanitizeHtmlText(record.fullname),
  email: sanitizeHtmlText(record.email),
  department_name: sanitizeHtmlText(record.department_name),
  has_geo: deriveHasGeo(record),
  geo_points: buildGeoPoints(record),
  polyline_points: buildPolylinePoints(record),
  has_discrepancy: deriveHasDiscrepancy(record),
});

const enrichAttendanceRowsGeo = (rows = []) => rows.map((row) => enrichAttendanceRowGeo(row));

const buildAttendanceSummary = (rows = []) => {
  const initialSummary = {
    total: 0,
    filteredTotal: rows.length,
    withGeo: 0,
    withDiscrepancy: 0,
    byStatus: {
      no_entry: 0,
      working: 0,
      lunch_open: 0,
      completed: 0,
    },
  };

  return rows.reduce((acc, row) => {
    acc.total += 1;
    acc.byStatus[row.attendance_status] = (acc.byStatus[row.attendance_status] || 0) + 1;
    if (row.has_geo) acc.withGeo += 1;
    if (row.has_discrepancy) acc.withDiscrepancy += 1;
    return acc;
  }, initialSummary);
};

const buildAttendanceRangeQuery = ({
  isAdminScope,
  hasExplicitTarget,
  targetUserId,
  userIds,
  departmentId,
  requesterId,
  status,
  onlyDiscrepancies,
  onlyWithGeo,
}) => {
  let query = `
      SELECT 
        a.*,
        u.fullname,
        u.email,
        u.role,
        d.name AS department_name
      FROM user_attendance_records a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE a.date BETWEEN $1 AND $2
    `;

  const params = [];
  const normalizedStatus = normalizeAttendanceStateFilter(status);
  const normalizedOnlyWithGeo = Boolean(onlyWithGeo);
  const normalizedOnlyDiscrepancies = Boolean(onlyDiscrepancies);
  const normalizedUserIds = Array.isArray(userIds)
    ? [...new Set(userIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))]
    : [];
  const normalizedDepartmentId = Number.isInteger(Number(departmentId)) && Number(departmentId) > 0
    ? Number(departmentId)
    : null;

  if (isAdminScope && hasExplicitTarget) {
    query += " AND a.user_id = $3";
    params.push(targetUserId);
  } else if (isAdminScope && normalizedUserIds.length) {
    const placeholders = normalizedUserIds.map((_, index) => `$${index + 3}`).join(", ");
    query += ` AND a.user_id IN (${placeholders})`;
    params.push(...normalizedUserIds);
  } else if (!isAdminScope) {
    query += " AND a.user_id = $3";
    params.push(requesterId);
  }

  if (normalizedDepartmentId) {
    query += ` AND u.department_id = $${params.length + 3}`;
    params.push(normalizedDepartmentId);
  }

  query += " ORDER BY a.date DESC, u.fullname ASC";

  const isGlobalQuery = Boolean(isAdminScope && !hasExplicitTarget);
  const summarizeRows = (rows = []) => buildAttendanceSummary(rows);

  return {
    query,
    params,
    normalizedStatus,
    isGlobalQuery,
    summarizeRows,
    filterRows: (rows = []) => {
      const rowsByStatus = filterAttendanceRowsByStatus(rows, normalizedStatus);
      const enrichedRows = enrichAttendanceRowsGeo(rowsByStatus);
      const rowsByDiscrepancy = normalizedOnlyDiscrepancies
        ? enrichedRows.filter((row) => row.has_discrepancy)
        : enrichedRows;
      const finalRows = normalizedOnlyWithGeo
        ? rowsByDiscrepancy.filter((row) => row.has_geo)
        : rowsByDiscrepancy;
      return finalRows;
    },
  };
};

module.exports = {
  ATTENDANCE_STATUS_ALIASES,
  buildAttendanceRangeQuery,
  deriveAttendanceState,
  deriveHasGeo,
  deriveHasDiscrepancy,
  buildAttendanceSummary,
  buildGeoPoints,
  buildPolylinePoints,
  enrichAttendanceRowGeo,
  enrichAttendanceRowsGeo,
  filterAttendanceRowsByStatus,
  normalizeAttendanceStateFilter,
  isValidCoordinatePair,
  normalizeCoordinateString,
  sanitizeHtmlText,
};
