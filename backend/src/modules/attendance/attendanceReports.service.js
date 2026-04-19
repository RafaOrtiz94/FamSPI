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
  start,
  end,
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
        d.name AS department_name,
        ex.exception_id,
        ex.exception_type,
        ex.exception_status,
        ex.start_time,
        ex.start_location,
        ex.arrival_time,
        ex.arrival_location,
        ex.departure_time,
        ex.departure_location,
        ex.return_time,
        ex.return_location,
        COALESCE(field_ops.field_events, '[]'::json) AS field_events,
        timeoff.tipo_solicitud AS time_off_type,
        timeoff.tipo_permiso AS time_off_subtype
      FROM user_attendance_records a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN LATERAL (
        SELECT
          e.id AS exception_id,
          e.type AS exception_type,
          e.status AS exception_status,
          e.start_time,
          e.start_location,
          e.arrival_time,
          e.arrival_location,
          e.departure_time,
          e.departure_location,
          e.return_time,
          e.return_location
        FROM attendance_exceptions e
        WHERE e.user_id = a.user_id
          AND e.date = a.date
        ORDER BY COALESCE(e.start_time, e.created_at) DESC, e.id DESC
        LIMIT 1
      ) ex ON true
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(
            json_agg(
              json_build_object(
                'type', event_rows.event_type,
                'time', event_rows.event_time,
                'lat', event_rows.lat,
                'lng', event_rows.lng,
                'source', event_rows.source,
                'client_request_id', event_rows.client_request_id,
                'prospect_name', event_rows.prospect_name
              )
              ORDER BY event_rows.event_time ASC
            ),
            '[]'::json
          ) AS field_events
        FROM (
          SELECT
            'client_entry'::text AS event_type,
            cvl.hora_entrada AS event_time,
            cvl.lat_entrada AS lat,
            cvl.lng_entrada AS lng,
            CASE
              WHEN cvl.is_planned IS TRUE THEN 'cronograma_cliente'
              ELSE 'cliente_emergencia'
            END AS source,
            cvl.client_request_id,
            NULL::text AS prospect_name
          FROM client_visit_logs cvl
          WHERE LOWER(COALESCE(cvl.user_email, '')) = LOWER(COALESCE(u.email, ''))
            AND cvl.visit_date = a.date
            AND cvl.hora_entrada IS NOT NULL

          UNION ALL

          SELECT
            'client_exit'::text AS event_type,
            cvl.hora_salida AS event_time,
            cvl.lat_salida AS lat,
            cvl.lng_salida AS lng,
            CASE
              WHEN cvl.is_planned IS TRUE THEN 'cronograma_cliente'
              ELSE 'cliente_emergencia'
            END AS source,
            cvl.client_request_id,
            NULL::text AS prospect_name
          FROM client_visit_logs cvl
          WHERE LOWER(COALESCE(cvl.user_email, '')) = LOWER(COALESCE(u.email, ''))
            AND cvl.visit_date = a.date
            AND cvl.hora_salida IS NOT NULL

          UNION ALL

          SELECT
            'client_entry'::text AS event_type,
            pv.check_in_time AS event_time,
            pv.check_in_lat AS lat,
            pv.check_in_lng AS lng,
            'prospecto'::text AS source,
            NULL::integer AS client_request_id,
            pv.prospect_name
          FROM prospect_visits pv
          WHERE LOWER(COALESCE(pv.user_email, '')) = LOWER(COALESCE(u.email, ''))
            AND pv.visit_date = a.date
            AND pv.check_in_time IS NOT NULL

          UNION ALL

          SELECT
            'client_exit'::text AS event_type,
            pv.check_out_time AS event_time,
            pv.check_out_lat AS lat,
            pv.check_out_lng AS lng,
            'prospecto'::text AS source,
            NULL::integer AS client_request_id,
            pv.prospect_name
          FROM prospect_visits pv
          WHERE LOWER(COALESCE(pv.user_email, '')) = LOWER(COALESCE(u.email, ''))
            AND pv.visit_date = a.date
            AND pv.check_out_time IS NOT NULL

          UNION ALL

          SELECT
            'office_exit'::text AS event_type,
            e.start_time AS event_time,
            NULL::double precision AS lat,
            NULL::double precision AS lng,
            'salida_campo'::text AS source,
            NULL::integer AS client_request_id,
            NULL::text AS prospect_name
          FROM attendance_exceptions e
          WHERE e.user_id = a.user_id
            AND e.date = a.date
            AND e.start_time IS NOT NULL

          UNION ALL

          SELECT
            'client_entry'::text AS event_type,
            e.arrival_time AS event_time,
            NULL::double precision AS lat,
            NULL::double precision AS lng,
            'llegada_cliente'::text AS source,
            NULL::integer AS client_request_id,
            NULL::text AS prospect_name
          FROM attendance_exceptions e
          WHERE e.user_id = a.user_id
            AND e.date = a.date
            AND e.arrival_time IS NOT NULL

          UNION ALL

          SELECT
            'client_exit'::text AS event_type,
            e.departure_time AS event_time,
            NULL::double precision AS lat,
            NULL::double precision AS lng,
            'salida_cliente'::text AS source,
            NULL::integer AS client_request_id,
            NULL::text AS prospect_name
          FROM attendance_exceptions e
          WHERE e.user_id = a.user_id
            AND e.date = a.date
            AND e.departure_time IS NOT NULL

          UNION ALL

          SELECT
            'office_entry'::text AS event_type,
            e.return_time AS event_time,
            NULL::double precision AS lat,
            NULL::double precision AS lng,
            'retorno_oficina'::text AS source,
            NULL::integer AS client_request_id,
            NULL::text AS prospect_name
          FROM attendance_exceptions e
          WHERE e.user_id = a.user_id
            AND e.date = a.date
            AND e.return_time IS NOT NULL
        ) event_rows
      ) field_ops ON true
      LEFT JOIN LATERAL (
        SELECT
          LOWER(COALESCE(p.tipo_solicitud, '')) AS tipo_solicitud,
          p.tipo_permiso
        FROM permisos_vacaciones p
        WHERE LOWER(COALESCE(p.user_email, '')) = LOWER(COALESCE(u.email, ''))
          AND LOWER(COALESCE(p.status, '')) IN ('approved', 'aprobado')
          AND a.date BETWEEN COALESCE(p.fecha_inicio, a.date) AND COALESCE(p.fecha_fin, a.date)
        ORDER BY COALESCE(p.fecha_inicio_hora, p.fecha_inicio::timestamptz) DESC, p.id DESC
        LIMIT 1
      ) timeoff ON true
      WHERE a.date BETWEEN $1 AND $2
    `;

  const params = [start, end];
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
    query += ` AND a.user_id = $${params.length + 1}`;
    params.push(targetUserId);
  } else if (isAdminScope && normalizedUserIds.length) {
    const placeholders = normalizedUserIds
      .map((_, index) => `$${params.length + index + 1}`)
      .join(", ");
    query += ` AND a.user_id IN (${placeholders})`;
    params.push(...normalizedUserIds);
  } else if (!isAdminScope) {
    query += ` AND a.user_id = $${params.length + 1}`;
    params.push(requesterId);
  }

  if (normalizedDepartmentId) {
    query += ` AND u.department_id = $${params.length + 1}`;
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
