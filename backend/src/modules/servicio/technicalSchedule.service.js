const db = require("../../config/db");

const SCHEDULE_LEADERSHIP_ROLES = new Set([
  "jefe_tecnico",
  "jefe_servicio",
  "jefe_servicio_tecnico",
  "gerencia",
  "gerencia_general",
  "director",
]);

const SOURCE_CONFIG = {
  manual: {
    label: "Bloqueo manual",
    category: "manual",
    path: "/dashboard/servicio-tecnico/cronograma",
  },
  actividad_tecnica: {
    label: "Actividad tecnica",
    category: "manual",
    path: "/dashboard/servicio-tecnico/cronograma",
  },
  mantenimiento: {
    label: "Mantenimiento",
    category: "maintenance",
    path: "/dashboard/servicio-tecnico/mantenimientos",
  },
  capacitacion: {
    label: "Capacitacion",
    category: "training",
    path: "/dashboard/servicio-tecnico/capacitaciones",
  },
  inspeccion_compra_publica: {
    label: "Inspeccion publica",
    category: "inspection",
    path: "/dashboard/servicio-tecnico/inspecciones?tab=public",
  },
  inspeccion_compra_privada: {
    label: "Inspeccion privada",
    category: "inspection",
    path: "/dashboard/servicio-tecnico/inspecciones?tab=private",
  },
  public_purchase_reinspection: {
    label: "Reinspeccion publica",
    category: "inspection",
    path: "/dashboard/servicio-tecnico/inspecciones?tab=public",
  },
  private_purchase_reinspection: {
    label: "Reinspeccion privada",
    category: "inspection",
    path: "/dashboard/servicio-tecnico/inspecciones?tab=private",
  },
  solicitud_inspeccion: {
    label: "Solicitud de inspeccion",
    category: "inspection",
    path: "/dashboard/servicio-tecnico/inspecciones",
  },
  inspeccion_bc: {
    label: "Inspeccion de ambiente (BC)",
    category: "inspection",
    path: "/dashboard/servicio-tecnico/solicitudes",
  },
};

const normalizeTokens = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const getUserRoleTokens = (user = {}) =>
  Array.from(new Set([...normalizeTokens(user?.role), ...normalizeTokens(user?.scope)]));

const canSeeTeamSchedule = (user = {}) =>
  getUserRoleTokens(user).some((role) => SCHEDULE_LEADERSHIP_ROLES.has(role));

const resolveScope = (user = {}, requestedScope = null) => {
  const normalized = String(requestedScope || "").trim().toLowerCase();
  if (normalized === "team" && canSeeTeamSchedule(user)) return "team";
  if (normalized === "mine") return "mine";
  return canSeeTeamSchedule(user) ? "team" : "mine";
};

const relationExists = async (qualifiedName) => {
  const { rows } = await db.query(`SELECT to_regclass($1) IS NOT NULL AS exists`, [qualifiedName]);
  return Boolean(rows?.[0]?.exists);
};

const normalizeDateKey = (value) => String(value || "").slice(0, 10);

const normalizeEvent = (row, overrides = {}) => {
  const sourceType = String(overrides.source_type || row.source_type || "manual").toLowerCase();
  const sourceConfig = SOURCE_CONFIG[sourceType] || {
    label: "Evento tecnico",
    category: "manual",
    path: "/dashboard/servicio-tecnico/cronograma",
  };

  return {
    id: overrides.id || `${sourceType}:${row.source_id || row.id || row.activity_date || Date.now()}`,
    activity_date: normalizeDateKey(overrides.activity_date || row.activity_date),
    title: String(overrides.title || row.title || row.summary || "Evento tecnico").trim(),
    notes: String(overrides.notes || row.notes || "").trim() || null,
    status: String(overrides.status || row.status || "programado").trim().toLowerCase(),
    source_type: sourceType,
    source_label: overrides.source_label || sourceConfig.label,
    category: overrides.category || sourceConfig.category,
    source_id: overrides.source_id || row.source_id || row.id || null,
    user_id: Number.isFinite(Number(overrides.user_id ?? row.user_id)) ? Number(overrides.user_id ?? row.user_id) : null,
    user_name: overrides.user_name || row.user_name || null,
    source_path: overrides.source_path || sourceConfig.path,
  };
};

const normalizeBacklog = (row, overrides = {}) => {
  const sourceType = String(overrides.source_type || row.source_type || "solicitud_inspeccion").toLowerCase();
  const sourceConfig = SOURCE_CONFIG[sourceType] || SOURCE_CONFIG.solicitud_inspeccion;
  return {
    id: overrides.id || `${sourceType}:${row.source_id || row.id}`,
    source_type: sourceType,
    source_label: overrides.source_label || sourceConfig.label,
    category: "pending_coordination",
    source_id: overrides.source_id || row.source_id || row.id || null,
    title: String(overrides.title || row.title || "Coordinar inspeccion").trim(),
    status: String(overrides.status || row.status || "pending_proposal").trim().toLowerCase(),
    source_path: overrides.source_path || sourceConfig.path,
    user_id: Number.isFinite(Number(overrides.user_id ?? row.user_id)) ? Number(overrides.user_id ?? row.user_id) : null,
    user_name: overrides.user_name || row.user_name || null,
    window_min_date: normalizeDateKey(overrides.window_min_date || row.window_min_date || row.inspection_min_date),
    window_max_date: normalizeDateKey(overrides.window_max_date || row.window_max_date || row.inspection_max_date),
    request_id: Number.isFinite(Number(overrides.request_id ?? row.request_id)) ? Number(overrides.request_id ?? row.request_id) : null,
    coordination_status: String(
      overrides.coordination_status || row.coordination_status || row.inspection_coordination_status || "pending_proposal",
    ).trim().toLowerCase(),
    notes: String(overrides.notes || row.notes || "").trim() || null,
  };
};

const sortEvents = (rows = []) =>
  [...rows].sort((left, right) => {
    const byDate = String(left.activity_date || "").localeCompare(String(right.activity_date || ""));
    if (byDate !== 0) return byDate;
    return String(left.title || "").localeCompare(String(right.title || ""), "es", { sensitivity: "base" });
  });

const sortBacklog = (rows = []) =>
  [...rows].sort((left, right) => {
    const byMin = String(left.window_min_date || "").localeCompare(String(right.window_min_date || ""));
    if (byMin !== 0) return byMin;
    return String(left.title || "").localeCompare(String(right.title || ""), "es", { sensitivity: "base" });
  });

async function listManualActivities({ from, to, scope, user }) {
  const params = [from, to];
  const where = [
    `a.activity_date BETWEEN $1::date AND $2::date`,
    `COALESCE(lower(a.status), 'programado') NOT IN ('cancelado', 'cancelada', 'completado', 'finalizado')`,
    `COALESCE(lower(a.source_type), 'manual') NOT IN ('public_purchase_inspection', 'private_purchase_inspection')`,
  ];

  if (scope === "mine") {
    params.push(user?.id || null);
    where.push(`a.user_id = $3`);
  }

  const { rows } = await db.query(
    `
      SELECT
        a.id,
        a.activity_date,
        a.title,
        a.notes,
        a.status,
        a.source_type,
        a.source_id,
        a.user_id,
        COALESCE(u.fullname, u.name, u.email) AS user_name
      FROM servicio.cronograma_actividades_tecnicas a
      LEFT JOIN public.users u ON u.id = a.user_id
      WHERE ${where.join(" AND ")}
    `,
    params,
  );

  return rows.map((row) =>
    normalizeEvent(row, {
      source_type: row.source_type === "manual" ? "manual" : row.source_type,
    }),
  );
}

async function listMaintenances({ from, to, scope, user }) {
  const params = [from, to];
  const where = [
    `m.fecha_programada BETWEEN $1::date AND $2::date`,
    `COALESCE(lower(m.estado), 'pendiente') NOT IN ('cancelado', 'cancelada', 'completado', 'finalizado')`,
  ];

  if (scope === "mine") {
    params.push(
      String(user?.fullname || "").trim().toLowerCase() || null,
      String(user?.name || "").trim().toLowerCase() || null,
      String(user?.email || "").trim().toLowerCase() || null,
      user?.id || null,
    );
    where.push(`
      (
        lower(COALESCE(m.responsable, '')) = lower(COALESCE($3, ''))
        OR lower(COALESCE(m.responsable, '')) = lower(COALESCE($4, ''))
        OR lower(COALESCE(m.responsable, '')) = lower(COALESCE($5, ''))
        OR m.created_by = $6
      )
    `);
  }

  const { rows } = await db.query(
    `
      SELECT
        m.id,
        m.fecha_programada AS activity_date,
        COALESCE(m.descripcion, CONCAT('Mantenimiento ', COALESCE(m.tipo, 'programado'))) AS title,
        m.observaciones AS notes,
        m.estado AS status,
        m.responsable AS user_name
      FROM servicio.cronograma_mantenimientos m
      WHERE ${where.join(" AND ")}
    `,
    params,
  );

  return rows.map((row) => normalizeEvent(row, { source_type: "mantenimiento" }));
}

async function listTrainings({ from, to }) {
  const { rows } = await db.query(
    `
      SELECT
        c.id_capacitacion AS id,
        c.fecha AS activity_date,
        COALESCE(c.titulo, 'Capacitacion tecnica') AS title,
        CONCAT_WS(' · ', NULLIF(c.modalidad, ''), NULLIF(c.instructor, ''), NULLIF(c.ubicacion, '')) AS notes,
        COALESCE(c.estado, 'programada') AS status
      FROM servicio.cronograma_capacitacion c
      WHERE c.fecha BETWEEN $1::date AND $2::date
        AND COALESCE(lower(c.estado), 'programada') NOT IN ('cancelada', 'cancelado')
    `,
    [from, to],
  );

  return rows.map((row) => normalizeEvent(row, { source_type: "capacitacion" }));
}

async function listPublicInspections({ from, to, scope, user }) {
  const params = [from, to];
  const where = [
    `epr.inspection_scheduled_date BETWEEN $1::date AND $2::date`,
    `COALESCE(epr.status::text, '') NOT IN ('completed', 'cancelled', 'rejected')`,
  ];

  if (scope === "mine") {
    params.push(user?.id || null);
    where.push(`
      (
        NULLIF(epr.extra->>'inspection_assigned_technician_id', '')::int = $3
        OR epr.inspection_coordinated_by = $3
      )
    `);
  }

  const { rows } = await db.query(
    `
      SELECT
        epr.id,
        epr.client_name,
        epr.inspection_scheduled_date,
        epr.inspection_coordination_status,
        epr.status,
        epr.extra,
        NULLIF(epr.extra->>'inspection_assigned_technician_id', '')::int AS technician_id,
        COALESCE(
          NULLIF(epr.extra->>'inspection_assigned_technician_name', ''),
          NULLIF(epr.extra->>'inspection_assigned_technician_email', '')
        ) AS technician_name
      FROM equipment_purchase_requests epr
      WHERE ${where.join(" AND ")}
    `,
    params,
  );

  return rows.map((row) =>
    normalizeEvent(row, {
      source_type: "inspeccion_compra_publica",
      activity_date: row.inspection_scheduled_date,
      title: `Inspeccion de ambiente - ${row.client_name || "cliente"}`,
      notes: row.technician_name ? `Tecnico asignado: ${row.technician_name}` : null,
      status: row.inspection_coordination_status || row.status || "accepted",
      user_id: row.technician_id,
      user_name: row.technician_name,
      source_id: row.id,
    }),
  );
}

async function listPrivateInspections({ from, to, scope, user }) {
  const params = [from, to];
  const where = [
    `ppr.inspection_scheduled_date BETWEEN $1::date AND $2::date`,
    `COALESCE(ppr.status::text, '') NOT IN ('completed', 'cancelled', 'rejected', 'delivered_signed')`,
  ];

  if (scope === "mine") {
    params.push(user?.id || null);
    where.push(`
      (
        NULLIF(ppr.extra->>'inspection_assigned_technician_id', '')::int = $3
        OR ppr.inspection_coordinated_by = $3
      )
    `);
  }

  const { rows } = await db.query(
    `
      SELECT
        ppr.id,
        COALESCE(
          ppr.client_snapshot->>'commercial_name',
          ppr.client_snapshot->>'name',
          ppr.client_snapshot->>'client_name',
          'cliente'
        ) AS client_name,
        ppr.inspection_scheduled_date,
        ppr.inspection_coordination_status,
        ppr.status,
        ppr.extra,
        NULLIF(ppr.extra->>'inspection_assigned_technician_id', '')::int AS technician_id,
        COALESCE(
          NULLIF(ppr.extra->>'inspection_assigned_technician_name', ''),
          NULLIF(ppr.extra->>'inspection_assigned_technician_email', '')
        ) AS technician_name
      FROM private_purchase_requests ppr
      WHERE ${where.join(" AND ")}
    `,
    params,
  );

  return rows.map((row) =>
    normalizeEvent(row, {
      source_type: "inspeccion_compra_privada",
      activity_date: row.inspection_scheduled_date,
      title: `Inspeccion de ambiente - ${row.client_name || "cliente"}`,
      notes: row.technician_name ? `Tecnico asignado: ${row.technician_name}` : null,
      status: row.inspection_coordination_status || row.status || "accepted",
      user_id: row.technician_id,
      user_name: row.technician_name,
      source_id: row.id,
    }),
  );
}

async function listPendingPublicInspections({ from, to, scope, user }) {
  const params = [from, to];
  const where = [
    `epr.inspection_request_id IS NOT NULL`,
    `epr.inspection_scheduled_date IS NULL`,
    `COALESCE(epr.status::text, '') NOT IN ('completed', 'cancelled', 'rejected')`,
    `COALESCE(epr.inspection_min_date, epr.inspection_max_date) <= $2::date`,
    `COALESCE(epr.inspection_max_date, epr.inspection_min_date) >= $1::date`,
  ];

  if (scope === "mine") {
    params.push(user?.id || null);
    where.push(`NULLIF(epr.extra->>'inspection_assigned_technician_id', '')::int = $3`);
  }

  const { rows } = await db.query(
    `
      SELECT
        epr.id,
        epr.client_name,
        epr.inspection_request_id AS request_id,
        epr.inspection_min_date,
        epr.inspection_max_date,
        epr.inspection_coordination_status,
        epr.extra,
        NULLIF(epr.extra->>'inspection_assigned_technician_id', '')::int AS technician_id,
        COALESCE(
          NULLIF(epr.extra->>'inspection_assigned_technician_name', ''),
          NULLIF(epr.extra->>'inspection_assigned_technician_email', '')
        ) AS technician_name
      FROM equipment_purchase_requests epr
      WHERE ${where.join(" AND ")}
    `,
    params,
  );

  return rows.map((row) =>
    normalizeBacklog(row, {
      source_type: "inspeccion_compra_publica",
      title: `Coordinar inspeccion publica - ${row.client_name || "cliente"}`,
      request_id: row.request_id,
      user_id: row.technician_id,
      user_name: row.technician_name,
      window_min_date: row.inspection_min_date,
      window_max_date: row.inspection_max_date,
      coordination_status: row.inspection_coordination_status,
      source_id: row.id,
    }),
  );
}

async function listPendingPrivateInspections({ from, to, scope, user }) {
  const params = [from, to];
  const where = [
    `ppr.inspection_request_id IS NOT NULL`,
    `ppr.inspection_scheduled_date IS NULL`,
    `COALESCE(ppr.status::text, '') NOT IN ('completed', 'cancelled', 'rejected', 'delivered_signed')`,
    `COALESCE(ppr.inspection_min_date, ppr.inspection_max_date) <= $2::date`,
    `COALESCE(ppr.inspection_max_date, ppr.inspection_min_date) >= $1::date`,
  ];

  if (scope === "mine") {
    params.push(user?.id || null);
    where.push(`NULLIF(ppr.extra->>'inspection_assigned_technician_id', '')::int = $3`);
  }

  const { rows } = await db.query(
    `
      SELECT
        ppr.id,
        COALESCE(
          ppr.client_snapshot->>'commercial_name',
          ppr.client_snapshot->>'name',
          ppr.client_snapshot->>'client_name',
          'cliente'
        ) AS client_name,
        ppr.inspection_request_id AS request_id,
        ppr.inspection_min_date,
        ppr.inspection_max_date,
        ppr.inspection_coordination_status,
        ppr.extra,
        NULLIF(ppr.extra->>'inspection_assigned_technician_id', '')::int AS technician_id,
        COALESCE(
          NULLIF(ppr.extra->>'inspection_assigned_technician_name', ''),
          NULLIF(ppr.extra->>'inspection_assigned_technician_email', '')
        ) AS technician_name
      FROM private_purchase_requests ppr
      WHERE ${where.join(" AND ")}
    `,
    params,
  );

  return rows.map((row) =>
    normalizeBacklog(row, {
      source_type: "inspeccion_compra_privada",
      title: `Coordinar inspeccion privada - ${row.client_name || "cliente"}`,
      request_id: row.request_id,
      user_id: row.technician_id,
      user_name: row.technician_name,
      window_min_date: row.inspection_min_date,
      window_max_date: row.inspection_max_date,
      coordination_status: row.inspection_coordination_status,
      source_id: row.id,
    }),
  );
}

const buildSummary = (rows = [], backlog = []) => {
  const byCategory = rows.reduce((acc, row) => {
    const key = row.category || "manual";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    total_events: rows.length,
    pending_coordination: backlog.length,
    by_category: byCategory,
  };
};

async function getTechnicalScheduleFeed({ user, from, to, scope }) {
  const normalizedFrom = normalizeDateKey(from);
  const normalizedTo = normalizeDateKey(to);
  if (!normalizedFrom || !normalizedTo) {
    const error = new Error("Parámetros from y to son obligatorios (YYYY-MM-DD)");
    error.status = 400;
    throw error;
  }

  const resolvedScope = resolveScope(user, scope);
  const rows = [];
  const backlog = [];

  if (await relationExists("servicio.cronograma_actividades_tecnicas")) {
    rows.push(...(await listManualActivities({ from: normalizedFrom, to: normalizedTo, scope: resolvedScope, user })));
  }

  if (await relationExists("servicio.cronograma_mantenimientos")) {
    rows.push(...(await listMaintenances({ from: normalizedFrom, to: normalizedTo, scope: resolvedScope, user })));
  }

  if (await relationExists("servicio.cronograma_capacitacion")) {
    rows.push(...(await listTrainings({ from: normalizedFrom, to: normalizedTo })));
  }

  if (await relationExists("public.equipment_purchase_requests")) {
    rows.push(...(await listPublicInspections({ from: normalizedFrom, to: normalizedTo, scope: resolvedScope, user })));
    backlog.push(...(await listPendingPublicInspections({ from: normalizedFrom, to: normalizedTo, scope: resolvedScope, user })));
  }

  if (await relationExists("public.private_purchase_requests")) {
    rows.push(...(await listPrivateInspections({ from: normalizedFrom, to: normalizedTo, scope: resolvedScope, user })));
    backlog.push(...(await listPendingPrivateInspections({ from: normalizedFrom, to: normalizedTo, scope: resolvedScope, user })));
  }

  const sortedRows = sortEvents(rows);
  const sortedBacklog = sortBacklog(backlog);

  return {
    ok: true,
    from: normalizedFrom,
    to: normalizedTo,
    scope: resolvedScope,
    rows: sortedRows,
    backlog: sortedBacklog,
    summary: buildSummary(sortedRows, sortedBacklog),
  };
}

module.exports = {
  canSeeTeamSchedule,
  getTechnicalScheduleFeed,
};
