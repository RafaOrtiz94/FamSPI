const db = require("../../config/db");
const {
  buildAttendanceRangeQuery,
} = require("./attendanceReports.service");
const {
  normalizeAttendanceRangeFilters,
} = require("./attendanceRangeFilters");

const ATTENDANCE_TIMEZONE = "America/Guayaquil";
const LATE_BASE_MINUTES = 9 * 60;
const LATE_TOLERANCE_MINUTES = 5;
const OPERATIONAL_EXCEPTION_TYPES = new Set([
  "operacion_campo",
  "operacion_de_campo",
  "salida_oficina",
  "viaje",
  "campo",
]);

const normalizeToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const normalizeDateKey = (value) => String(value || "").slice(0, 10);

const formatClockInTimezone = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // hourCycle explicito: hour12:false por si solo no garantiza 0-23 en todas
  // las versiones de ICU (puede devolver "24" para la medianoche).
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ATTENDANCE_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
};

const computeLateMinutes = (entryTime) => {
  const clock = formatClockInTimezone(entryTime);
  if (!clock) return null;
  return (clock.hour * 60 + clock.minute) - LATE_BASE_MINUTES;
};

const computeLunchMinutes = (row = {}) => {
  const start = row?.lunch_start_time ? new Date(row.lunch_start_time) : null;
  const end = row?.lunch_end_time ? new Date(row.lunch_end_time) : null;
  if (!(start instanceof Date) || !(end instanceof Date)) return null;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  return Math.round((end.getTime() - start.getTime()) / 60000);
};

const isOperationalExceptionType = (value) => OPERATIONAL_EXCEPTION_TYPES.has(normalizeToken(value));
const isUnexpectedExitType = (value) => normalizeToken(value) === "imprevisto";

const buildCollaboratorWhereClause = ({
  search,
  departmentId,
  includeInactive,
}) => {
  const where = [
    // Allow users without a collaborator_profiles row (LEFT JOIN); only exclude google-forms applicants when a profile exists
    "(cp.user_id IS NULL OR (COALESCE(cp.profile->'extra'->>'applicant_source','') <> 'google_forms' AND COALESCE((cp.profile->'extra' ? 'preguntas_adicionales'), false) = false))",
  ];
  const params = [];

  if (!includeInactive) {
    where.push("u.active = true");
  }

  if (search) {
    params.push(`%${String(search).trim().toLowerCase()}%`);
    const placeholder = `$${params.length}`;
    where.push(`(
      LOWER(COALESCE(u.fullname, u.name, u.email)) LIKE ${placeholder}
      OR LOWER(COALESCE(u.email, '')) LIKE ${placeholder}
      OR LOWER(COALESCE(cp.profile->'personal'->>'cedula', '')) LIKE ${placeholder}
      OR LOWER(COALESCE(cp.profile->'laboral'->>'cargo', '')) LIKE ${placeholder}
    )`);
  }

  if (departmentId) {
    params.push(departmentId);
    where.push(`u.department_id = $${params.length}`);
  }

  return {
    whereClause: `WHERE ${where.join(" AND ")}`,
    params,
  };
};

const listScopedCollaborators = async ({
  search,
  departmentId,
  includeInactive = false,
}) => {
  const { whereClause, params } = buildCollaboratorWhereClause({
    search,
    departmentId,
    includeInactive,
  });

  const query = `
    SELECT
      u.id AS user_id,
      COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email) AS fullname,
      u.email,
      u.role,
      u.active,
      u.department_id,
      d.name AS department_name,
      cp.profile->'laboral'->>'cargo' AS cargo,
      cp.profile->'personal'->>'cedula' AS cedula
    FROM users u
    LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
    LEFT JOIN departments d ON d.id = u.department_id
    ${whereClause}
    ORDER BY COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email) ASC
  `;

  const result = await db.query(query, params);
  return result.rows || [];
};

const getApprovedJustificationsMap = async ({ userIds, start, end }) => {
  const normalizedUserIds = [...new Set((Array.isArray(userIds) ? userIds : []).map(Number).filter((value) => Number.isInteger(value) && value > 0))];
  if (!normalizedUserIds.length || !start || !end) return new Map();

  const result = await db.query(
    `
      SELECT
        user_id,
        attendance_date,
        COUNT(*)::int AS total
      FROM attendance_late_justifications
      WHERE user_id = ANY($1::int[])
        AND attendance_date BETWEEN $2::date AND $3::date
        AND LOWER(COALESCE(status, 'approved')) IN ('approved', 'aprobado')
      GROUP BY user_id, attendance_date
    `,
    [normalizedUserIds, start, end],
  );

  return (result.rows || []).reduce((map, row) => {
    map.set(`${row.user_id}:${normalizeDateKey(row.attendance_date)}`, Number(row.total || 0));
    return map;
  }, new Map());
};

const listCollaboratorApprovedPermissions = async ({
  userId,
  userEmail,
  start,
  end,
}) => {
  const normalizedUserId = Number(userId);
  const normalizedEmail = String(userEmail || "").trim().toLowerCase();
  if (!start || !end || (!Number.isInteger(normalizedUserId) && !normalizedEmail)) return [];

  const result = await db.query(
    `
      SELECT
        id,
        user_id,
        user_email,
        tipo_solicitud,
        tipo_permiso,
        es_emergencia,
        status,
        fecha_inicio,
        fecha_fin,
        fecha_inicio_hora,
        fecha_fin_hora,
        duracion_horas,
        duracion_dias,
        created_at
      FROM permisos_vacaciones
      WHERE (
        ($1::int IS NOT NULL AND user_id = $1)
        OR ($2::text <> '' AND LOWER(COALESCE(user_email, '')) = $2)
      )
        AND LOWER(COALESCE(tipo_solicitud, '')) = 'permiso'
        AND (
          LOWER(COALESCE(status, '')) IN ('approved', 'aprobado')
          OR (
            LOWER(COALESCE(status, '')) = 'partially_approved'
            AND aprobacion_final_at IS NOT NULL
          )
        )
        AND (
          (
            fecha_inicio_hora IS NOT NULL
            AND fecha_fin_hora IS NOT NULL
            AND fecha_fin_hora >= $3::date
            AND fecha_inicio_hora < ($4::date + INTERVAL '1 day')
          )
          OR (
            (fecha_inicio_hora IS NULL OR fecha_fin_hora IS NULL)
            AND daterange(
              COALESCE(fecha_inicio, $3::date),
              COALESCE(fecha_fin + 1, COALESCE(fecha_inicio, $4::date) + 1),
              '[)'
            ) && daterange($3::date, ($4::date + 1), '[)')
          )
        )
      ORDER BY COALESCE(fecha_inicio_hora, fecha_inicio::timestamptz) DESC, id DESC
    `,
    [Number.isInteger(normalizedUserId) ? normalizedUserId : null, normalizedEmail, start, end],
  );

  return (result.rows || []).map((row) => ({
    ...row,
    is_hourly: Boolean(row?.fecha_inicio_hora && row?.fecha_fin_hora),
  }));
};

const buildBaseMetrics = () => ({
  attendance_days: 0,
  completed_days: 0,
  open_days: 0,
  discrepancy_days: 0,
  days_with_geo: 0,
  breaches_total: 0,
  late_breaches: 0,
  lunch_breaches: 0,
  unexpected_exits: 0,
  irregular_exits: 0,
  real_overtime_hours: 0,
  operational_hours: 0,
});

const buildMetricsFromRows = (rows = [], justificationMap = new Map()) => {
  const metrics = buildBaseMetrics();

  rows.forEach((row) => {
    metrics.attendance_days += 1;
    if (row.attendance_status === "completed") metrics.completed_days += 1;
    if (row.attendance_status !== "completed") metrics.open_days += 1;
    if (row.has_discrepancy) metrics.discrepancy_days += 1;
    if (row.has_geo) metrics.days_with_geo += 1;

    const userId = Number(row.user_id || 0);
    const dateKey = normalizeDateKey(row.date);
    const approvedJustificationCount = justificationMap.get(`${userId}:${dateKey}`) || 0;
    const lateMinutes = computeLateMinutes(row.entry_time);
    const lunchMinutes = computeLunchMinutes(row);
    const exceptionType = normalizeToken(row.exception_type);
    const isOperational = isOperationalExceptionType(exceptionType);

    if (Number.isFinite(lateMinutes) && lateMinutes > LATE_TOLERANCE_MINUTES && approvedJustificationCount === 0) {
      metrics.breaches_total += 1;
      metrics.late_breaches += 1;
    }

    if (Number.isFinite(lunchMinutes) && lunchMinutes > 60) {
      metrics.breaches_total += 1;
      metrics.lunch_breaches += 1;
    }

    if (exceptionType && !isOperational) {
      metrics.breaches_total += 1;
      metrics.irregular_exits += 1;
      if (isUnexpectedExitType(exceptionType)) {
        metrics.unexpected_exits += 1;
      }
    }

    metrics.real_overtime_hours += Number(row.real_overtime_hours || 0);
    metrics.operational_hours += Number(row.operational_elapsed_hours || 0);
  });

  metrics.real_overtime_hours = Number(metrics.real_overtime_hours.toFixed(2));
  metrics.operational_hours = Number(metrics.operational_hours.toFixed(2));

  return metrics;
};

const buildIncidentEntries = ({
  rows = [],
  justificationMap = new Map(),
  collaboratorMap = new Map(),
}) =>
  rows.flatMap((row) => {
    const incidents = [];
    const userId = Number(row.user_id || 0);
    const collaborator = collaboratorMap.get(userId) || {};
    const dateKey = normalizeDateKey(row.date);
    const approvedJustificationCount = justificationMap.get(`${userId}:${dateKey}`) || 0;
    const lateMinutes = computeLateMinutes(row.entry_time);
    const lunchMinutes = computeLunchMinutes(row);
    const exceptionType = normalizeToken(row.exception_type);
    const isOperational = isOperationalExceptionType(exceptionType);

    const baseIncident = {
      user_id: userId,
      fullname: collaborator.fullname || row.fullname || null,
      email: collaborator.email || row.email || null,
      department_name: collaborator.department_name || row.department_name || null,
      cargo: collaborator.cargo || null,
      cedula: collaborator.cedula || null,
      date: row.date,
      attendance_status: row.attendance_status || null,
      entry_time: row.entry_time || null,
      lunch_start_time: row.lunch_start_time || null,
      lunch_end_time: row.lunch_end_time || null,
      exit_time: row.exit_time || null,
      exception_type: row.exception_type || null,
      exception_description: row.exception_description || null,
      operational_hours: Number(row.operational_elapsed_hours || 0),
      real_overtime_hours: Number(row.real_overtime_hours || 0),
    };

    if (Number.isFinite(lateMinutes) && lateMinutes > LATE_TOLERANCE_MINUTES && approvedJustificationCount === 0) {
      incidents.push({
        ...baseIncident,
        breach_type: "late_without_justification",
        breach_label: "Llegada tarde sin justificacion",
        detail: `Entrada registrada con ${lateMinutes} minutos de atraso.`,
        late_minutes: lateMinutes,
        lunch_minutes: lunchMinutes,
      });
    }

    if (Number.isFinite(lunchMinutes) && lunchMinutes > 60) {
      incidents.push({
        ...baseIncident,
        breach_type: "lunch_over_60",
        breach_label: "Almuerzo mayor a 60 minutos",
        detail: `El almuerzo registrado fue de ${lunchMinutes} minutos.`,
        late_minutes: lateMinutes,
        lunch_minutes: lunchMinutes,
      });
    }

    if (exceptionType && !isOperational) {
      incidents.push({
        ...baseIncident,
        breach_type: isUnexpectedExitType(exceptionType) ? "unexpected_exit" : "irregular_exit",
        breach_label: isUnexpectedExitType(exceptionType)
          ? "Salida imprevista"
          : "Salida irregular",
        detail: row.exception_description || `Excepcion registrada con tipo ${exceptionType}.`,
        late_minutes: lateMinutes,
        lunch_minutes: lunchMinutes,
      });
    }

    if (row.attendance_status && row.attendance_status !== "completed") {
      incidents.push({
        ...baseIncident,
        breach_type: "open_shift",
        breach_label: "Jornada abierta o incompleta",
        detail: "La jornada no quedo cerrada correctamente para la fecha consultada.",
        late_minutes: lateMinutes,
        lunch_minutes: lunchMinutes,
      });
    }

    return incidents;
  });

const resolveWorkspaceRows = async ({
  start,
  end,
  requesterId,
  userIds,
}) => {
  if (!Array.isArray(userIds) || !userIds.length) return [];
  const { query, params, filterRows } = await buildAttendanceRangeQuery({
    start,
    end,
    isAdminScope: true,
    hasExplicitTarget: false,
    targetUserId: null,
    userIds,
    departmentId: null,
    requesterId,
    status: null,
    onlyDiscrepancies: false,
    onlyWithGeo: false,
  });
  const result = await db.query(query, params);
  return filterRows(result.rows) || [];
};

const validateWorkspaceFilters = (filters = {}) => {
  const normalized = normalizeAttendanceRangeFilters(filters);
  if (!normalized.start || !normalized.end) {
    const error = new Error("Fechas de inicio y fin requeridas");
    error.status = 400;
    throw error;
  }
  if (normalized.dateRangeError) {
    const error = new Error("La fecha de fin no puede ser anterior a la fecha de inicio");
    error.status = 400;
    throw error;
  }
  return normalized;
};

const buildOverviewSummary = ({ collaborators = [], breaches = [], metricsByUser = new Map() }) => {
  let realOvertimeHours = 0;
  let operationalHours = 0;
  let unexpectedExits = 0;
  let collaboratorsWithBreaches = 0;

  collaborators.forEach((collaborator) => {
    const metrics = metricsByUser.get(Number(collaborator.user_id)) || buildBaseMetrics();
    realOvertimeHours += Number(metrics.real_overtime_hours || 0);
    operationalHours += Number(metrics.operational_hours || 0);
    unexpectedExits += Number(metrics.unexpected_exits || 0);
    if (Number(metrics.breaches_total || 0) > 0) collaboratorsWithBreaches += 1;
  });

  return {
    collaborators_total: collaborators.length,
    collaborators_with_breaches: collaboratorsWithBreaches,
    breaches_total: breaches.length,
    real_overtime_hours: Number(realOvertimeHours.toFixed(2)),
    operational_hours: Number(operationalHours.toFixed(2)),
    unexpected_exits: unexpectedExits,
  };
};

const getAttendanceWorkspaceOverview = async (filters = {}, requesterUser = {}) => {
  const normalized = validateWorkspaceFilters(filters);
  const collaborators = await listScopedCollaborators({
    search: filters.search,
    departmentId: normalized.departmentId,
    includeInactive: String(filters.includeInactive || "").toLowerCase() === "true",
  });

  const collaboratorIds = collaborators.map((row) => Number(row.user_id)).filter((value) => Number.isInteger(value) && value > 0);
  const rows = await resolveWorkspaceRows({
    start: normalized.start,
    end: normalized.end,
    requesterId: Number(requesterUser?.id || 0),
    userIds: collaboratorIds,
  });
  const justifications = await getApprovedJustificationsMap({
    userIds: collaboratorIds,
    start: normalized.start,
    end: normalized.end,
  });

  const groupedRows = rows.reduce((map, row) => {
    const key = Number(row.user_id || 0);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());

  const metricsByUser = new Map();
  collaborators.forEach((collaborator) => {
    const userRows = groupedRows.get(Number(collaborator.user_id)) || [];
    metricsByUser.set(Number(collaborator.user_id), buildMetricsFromRows(userRows, justifications));
  });

  const collaboratorMap = new Map(
    collaborators.map((collaborator) => [Number(collaborator.user_id), collaborator]),
  );
  const breaches = buildIncidentEntries({
    rows,
    justificationMap: justifications,
    collaboratorMap,
  });

  return {
    ok: true,
    data: collaborators.map((collaborator) => ({
      ...collaborator,
      metrics: metricsByUser.get(Number(collaborator.user_id)) || buildBaseMetrics(),
    })),
    summary: buildOverviewSummary({
      collaborators,
      breaches,
      metricsByUser,
    }),
    meta: {
      start: normalized.start,
      end: normalized.end,
      rangeDays: normalized.rangeDays,
      exceedsRecommendedRange: normalized.exceedsRecommendedRange,
      warnings: normalized.exceedsRecommendedRange
        ? ["El rango seleccionado supera los 31 dias recomendados"]
        : [],
    },
  };
};

const getAttendanceWorkspaceCollaborator = async (userId, filters = {}, requesterUser = {}) => {
  const normalized = validateWorkspaceFilters(filters);
  const collaboratorRes = await db.query(
    `
      SELECT
        u.id AS user_id,
        COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email) AS fullname,
        u.email,
        u.role,
        u.active,
        u.department_id,
        d.name AS department_name,
        cp.profile->'laboral'->>'cargo' AS cargo,
        cp.profile->'personal'->>'cedula' AS cedula
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId],
  );

  const collaborator = collaboratorRes.rows?.[0];
  if (!collaborator) {
    const error = new Error("Colaborador no encontrado");
    error.status = 404;
    throw error;
  }

  const rows = await resolveWorkspaceRows({
    start: normalized.start,
    end: normalized.end,
    requesterId: Number(requesterUser?.id || 0),
    userIds: [Number(userId)],
  });
  const justifications = await getApprovedJustificationsMap({
    userIds: [Number(userId)],
    start: normalized.start,
    end: normalized.end,
  });
  const collaboratorMap = new Map([[Number(userId), collaborator]]);
  const incidents = buildIncidentEntries({
    rows,
    justificationMap: justifications,
    collaboratorMap,
  });
  const permissions = await listCollaboratorApprovedPermissions({
    userId: Number(userId),
    userEmail: collaborator.email,
    start: normalized.start,
    end: normalized.end,
  });

  return {
    ok: true,
    data: {
      collaborator,
      summary: buildMetricsFromRows(rows, justifications),
      rows,
      incidents,
      permissions,
    },
    meta: {
      start: normalized.start,
      end: normalized.end,
      rangeDays: normalized.rangeDays,
      exceedsRecommendedRange: normalized.exceedsRecommendedRange,
      warnings: normalized.exceedsRecommendedRange
        ? ["El rango seleccionado supera los 31 dias recomendados"]
        : [],
    },
  };
};

const getAttendanceWorkspaceBreaches = async (filters = {}, requesterUser = {}) => {
  const normalized = validateWorkspaceFilters(filters);
  const collaborators = await listScopedCollaborators({
    search: filters.search,
    departmentId: normalized.departmentId,
    includeInactive: String(filters.includeInactive || "").toLowerCase() === "true",
  });

  const scopedIds = collaborators.map((row) => Number(row.user_id));
  const requestedIds = Array.isArray(normalized.userIds) && normalized.userIds.length
    ? normalized.userIds.filter((value) => scopedIds.includes(value))
    : scopedIds;

  const rows = await resolveWorkspaceRows({
    start: normalized.start,
    end: normalized.end,
    requesterId: Number(requesterUser?.id || 0),
    userIds: requestedIds,
  });
  const justifications = await getApprovedJustificationsMap({
    userIds: requestedIds,
    start: normalized.start,
    end: normalized.end,
  });
  const collaboratorMap = new Map(
    collaborators.map((collaborator) => [Number(collaborator.user_id), collaborator]),
  );
  const incidents = buildIncidentEntries({
    rows,
    justificationMap: justifications,
    collaboratorMap,
  });

  return {
    ok: true,
    data: incidents,
    summary: {
      breaches_total: incidents.length,
      collaborators_total: requestedIds.length,
      collaborators_with_breaches: new Set(incidents.map((incident) => incident.user_id)).size,
    },
    meta: {
      start: normalized.start,
      end: normalized.end,
      userIds: requestedIds,
    },
  };
};

module.exports = {
  getAttendanceWorkspaceOverview,
  getAttendanceWorkspaceCollaborator,
  getAttendanceWorkspaceBreaches,
  listScopedCollaborators,
};
