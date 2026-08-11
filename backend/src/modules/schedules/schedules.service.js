const db = require("../../config/db");
const logger = require("../../config/logger");
const { columnExists } = require("../../utils/dbMeta");
const HOLIDAYS_EC = require("../../config/holidays.ec.json");
const axios = require("axios");
const { createEvents } = require("ics");
const { Readable } = require("stream");
const { createOrUpdateSharedAllDayEvent } = require("../../utils/calendar");
const notificationManager = require("../notifications/notificationManager");

const GOOGLE_DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";
const metadataCache = new Map();

const MANAGER_ROLES = new Set([
  "jefe_comercial",
  "jefe_de_comercial",
  "gerencia",
  "gerencia_general",
  "admin",
  "administrador",
]);

const ADVISOR_ROLES = new Set([
  "comercial",
  "asesor_comercial",
  "analista_comercial",
  "acp_comercial",
  "backoffice",
  "backoffice_comercial",
]);

function isManager(user) {
  return MANAGER_ROLES.has((user?.role || "").toLowerCase());
}

function isAdvisor(user) {
  return ADVISOR_ROLES.has((user?.role || "").toLowerCase());
}

function isCommercialUser(user) {
  return isAdvisor(user) || isManager(user);
}

function assertAdvisor(user) {
  if (!isAdvisor(user)) {
    const error = new Error("No tienes permisos para gestionar cronogramas");
    error.status = 403;
    throw error;
  }
}

function assertManager(user) {
  if (!isManager(user)) {
    const error = new Error("Solo los jefes pueden realizar esta acciÃ³n");
    error.status = 403;
    throw error;
  }
}

function assertCommercial(user) {
  if (!isCommercialUser(user)) {
    const error = new Error("No tienes permisos para consultar cronogramas");
    error.status = 403;
    throw error;
  }
}

function getCurrentMonthYearInAppTimezone() {
  const timeZone = process.env.APP_TIMEZONE || process.env.TZ || "America/Guayaquil";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value || 0);
  const month = Number(parts.find((part) => part.type === "month")?.value || 0);
  return { year, month };
}

function toDateTuple(dateValue) {
  const normalized = String(dateValue || "").slice(0, 10);
  const [year, month, day] = normalized.split("-").map(Number);
  if (!year || !month || !day) return null;
  return [year, month, day];
}

function shiftDateTuple(tuple, days) {
  if (!Array.isArray(tuple) || tuple.length < 3) return null;
  const [year, month, day] = tuple;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
}

function createEventsAsync(events) {
  return new Promise((resolve, reject) => {
    createEvents(events, (error, value) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(value);
    });
  });
}

function quoteIdentifier(identifier) {
  return `"${String(identifier || "").replace(/"/g, '""')}"`;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDistanceMeters(meters = 0) {
  const safeMeters = Number(meters || 0);
  if (!Number.isFinite(safeMeters) || safeMeters <= 0) return "0 km";
  if (safeMeters >= 1000) return `${(safeMeters / 1000).toFixed(1)} km`;
  return `${Math.round(safeMeters)} m`;
}

function formatDurationSeconds(seconds = 0) {
  const safeSeconds = Number(seconds || 0);
  if (!Number.isFinite(safeSeconds) || safeSeconds <= 0) return "0 min";
  const minutes = Math.round(safeSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} h ${remaining} min` : `${hours} h`;
}

function normalizeReviewNotes(notes) {
  return String(notes || "").trim();
}

function buildAuditNote({ action, notes, user }) {
  const safeAction = String(action || "review").toUpperCase();
  const safeUser = String(user?.email || "unknown");
  const stamp = new Date().toISOString();
  return `[AUDIT ${safeAction}] ${stamp} ${safeUser}: ${String(notes || "").trim()}`;
}

async function ensureVisitScheduleReviewNotesColumn() {
  const cacheKey = "public.visit_schedules.review_notes";
  if (metadataCache.has(cacheKey)) return metadataCache.get(cacheKey);

  const exists = await columnExists("public", "visit_schedules", "review_notes");
  if (exists) {
    metadataCache.set(cacheKey, true);
    return true;
  }

  try {
    await db.query("ALTER TABLE visit_schedules ADD COLUMN IF NOT EXISTS review_notes TEXT");
    await db.query("ALTER TABLE visit_schedules ADD COLUMN IF NOT EXISTS general_justification TEXT");
    metadataCache.set(cacheKey, true);
    return true;
  } catch (error) {
    logger.warn({ error }, "No se pudo crear la columna review_notes en visit_schedules");
    metadataCache.set(cacheKey, false);
    return false;
  }
}

async function ensureScheduledVisitsExternalSyncColumns() {
  const cacheKey = "public.scheduled_visits.external_synced_at";
  if (metadataCache.has(cacheKey)) return metadataCache.get(cacheKey);

  const exists = await columnExists("public", "scheduled_visits", "external_synced_at");
  if (exists) {
    metadataCache.set(cacheKey, true);
    return true;
  }

  try {
    await db.query(`
      ALTER TABLE scheduled_visits
        ADD COLUMN IF NOT EXISTS crm_meeting_id TEXT,
        ADD COLUMN IF NOT EXISTS crm_activity_id UUID,
        ADD COLUMN IF NOT EXISTS calendar_event_id TEXT,
        ADD COLUMN IF NOT EXISTS calendar_event_link TEXT,
        ADD COLUMN IF NOT EXISTS calendar_event_calendar_id TEXT,
        ADD COLUMN IF NOT EXISTS external_synced_at TIMESTAMPTZ
    `);
    metadataCache.set(cacheKey, true);
    return true;
  } catch (error) {
    logger.warn({ error }, "No se pudieron crear columnas de sincronizacion externa en scheduled_visits");
    metadataCache.set(cacheKey, false);
    return false;
  }
}

async function tableExists(schema, table) {
  const key = `table:${schema}.${table}`.toLowerCase();
  if (metadataCache.has(key)) return metadataCache.get(key);
  try {
    const { rows } = await db.query(
      `
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name = $2
        LIMIT 1
      `,
      [schema, table],
    );
    const exists = rows.length > 0;
    metadataCache.set(key, exists);
    return exists;
  } catch (error) {
    logger.warn({ error, schema, table }, "No se pudo validar existencia de tabla");
    metadataCache.set(key, false);
    return false;
  }
}

async function firstExistingColumn(schema, table, candidates = []) {
  for (const candidate of candidates) {
    // columnExists ya tiene cache interno por columna.
     
    const exists = await columnExists(schema, table, candidate);
    if (exists) return candidate;
  }
  return null;
}

async function getCatalogClientsGeoConfig() {
  const cacheKey = "catalog_clients_geo_config";
  if (metadataCache.has(cacheKey)) return metadataCache.get(cacheKey);

  const hasCatalogTable = await tableExists("public", "catalog_clients");
  if (!hasCatalogTable) {
    metadataCache.set(cacheKey, null);
    return null;
  }

  const relationColumn = await firstExistingColumn("public", "catalog_clients", [
    "client_request_id",
    "request_id",
    "client_id",
  ]);
  const latitudeColumn = await firstExistingColumn("public", "catalog_clients", [
    "latitude",
    "latitud",
    "shipping_latitude",
    "geo_latitude",
    "lat",
  ]);
  const longitudeColumn = await firstExistingColumn("public", "catalog_clients", [
    "longitude",
    "longitud",
    "shipping_longitude",
    "geo_longitude",
    "lng",
  ]);
  const nameColumn = await firstExistingColumn("public", "catalog_clients", [
    "commercial_name",
    "nombre_comercial",
    "name",
    "client_name",
    "razon_social",
  ]);

  if (!relationColumn || !latitudeColumn || !longitudeColumn) {
    const partial = {
      relationColumn,
      latitudeColumn,
      longitudeColumn,
      nameColumn,
    };
    logger.warn(
      { partial },
      "catalog_clients no tiene columnas geoespaciales suficientes para optimizar rutas",
    );
    metadataCache.set(cacheKey, null);
    return null;
  }

  const config = {
    relationColumn,
    latitudeColumn,
    longitudeColumn,
    nameColumn,
  };
  metadataCache.set(cacheKey, config);
  return config;
}

async function getClientRequestsGeoConfig() {
  const cacheKey = "client_requests_geo_config";
  if (metadataCache.has(cacheKey)) return metadataCache.get(cacheKey);

  const hasClientRequests = await tableExists("public", "client_requests");
  if (!hasClientRequests) {
    metadataCache.set(cacheKey, null);
    return null;
  }

  const latitudeColumn = await firstExistingColumn("public", "client_requests", [
    "shipping_latitude",
    "latitude",
    "latitud",
    "geo_latitude",
    "lat",
  ]);
  const longitudeColumn = await firstExistingColumn("public", "client_requests", [
    "shipping_longitude",
    "longitude",
    "longitud",
    "geo_longitude",
    "lng",
  ]);

  if (!latitudeColumn || !longitudeColumn) {
    metadataCache.set(cacheKey, null);
    return null;
  }

  const config = { latitudeColumn, longitudeColumn };
  metadataCache.set(cacheKey, config);
  return config;
}

function getMapsApiKeyOrThrow() {
  const apiKey =
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    const error = new Error(
      "No hay API key de Google Maps configurada. Define GOOGLE_MAPS_SERVER_API_KEY.",
    );
    error.status = 500;
    throw error;
  }
  return apiKey;
}

function normalizeScheduleIds(scheduleIds) {
  const source = Array.isArray(scheduleIds)
    ? scheduleIds
    : scheduleIds !== undefined && scheduleIds !== null
      ? [scheduleIds]
      : [];
  return [...new Set(source.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
}

function buildVisitAddress(visit = {}) {
  const parts = [
    visit.shipping_address,
    visit.establishment_address,
    visit.city,
    visit.shipping_city,
    visit.establishment_city,
    visit.shipping_province,
    visit.establishment_province,
    "Ecuador",
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (!parts.length) return null;
  return Array.from(new Set(parts)).join(", ");
}

function resolveVisitLocation(visit = {}) {
  const latitude = toFiniteNumber(
    visit.catalog_latitude ?? visit.request_latitude ?? visit.client_latitude ?? visit.latitude,
  );
  const longitude = toFiniteNumber(
    visit.catalog_longitude ?? visit.request_longitude ?? visit.client_longitude ?? visit.longitude,
  );

  if (latitude !== null && longitude !== null) {
    return {
      latitude,
      longitude,
      locationQuery: `${latitude},${longitude}`,
      source: "coordinates",
      address: buildVisitAddress(visit),
    };
  }

  const address = buildVisitAddress(visit);
  if (!address) return null;
  return {
    latitude: null,
    longitude: null,
    locationQuery: address,
    source: "address",
    address,
  };
}

function buildGoogleMapsDeepLink(orderedStops = []) {
  if (!orderedStops.length) return null;
  const first = orderedStops[0]?.locationQuery;
  const last = orderedStops[orderedStops.length - 1]?.locationQuery;
  if (!first || !last) return null;

  const params = new URLSearchParams({
    api: "1",
    travelmode: "driving",
    origin: first,
    destination: last,
  });
  const waypointValues = orderedStops
    .slice(1, -1)
    .map((stop) => stop.locationQuery)
    .filter(Boolean);
  if (waypointValues.length) {
    params.set("waypoints", waypointValues.join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildWazeDeepLink(orderedStops = []) {
  const lastStop = orderedStops[orderedStops.length - 1];
  if (!lastStop) return null;
  const latitude = toFiniteNumber(lastStop.latitude);
  const longitude = toFiniteNumber(lastStop.longitude);
  if (latitude === null || longitude === null) return null;
  return `https://waze.com/ul?ll=${encodeURIComponent(`${latitude},${longitude}`)}&navigate=yes`;
}

async function requestGoogleOptimizedRoute(points, apiKey) {
  if (!Array.isArray(points) || points.length < 2) return null;
  if (points.length > 24) {
    const error = new Error(
      "Google Directions permite optimizar hasta 23 waypoints por solicitud. Divide la ruta diaria.",
    );
    error.status = 400;
    throw error;
  }

  const origin = points[0].locationQuery;
  const waypointQueries = points.slice(1).map((point) => point.locationQuery);
  const waypointsParam = `optimize:true|${waypointQueries.join("|")}`;

  const { data } = await axios.get(GOOGLE_DIRECTIONS_URL, {
    params: {
      origin,
      destination: origin,
      waypoints: waypointsParam,
      mode: "driving",
      units: "metric",
      language: "es",
      region: "ec",
      key: apiKey,
    },
    timeout: 20000,
  });

  if (!data || data.status !== "OK") {
    const detail = data?.error_message || data?.status || "UNKNOWN";
    const error = new Error(`Google Directions devolvio un error: ${detail}`);
    error.status = 502;
    throw error;
  }

  const route = data.routes?.[0];
  if (!route) {
    const error = new Error("Google Directions no devolvio una ruta utilizable");
    error.status = 502;
    throw error;
  }
  return route;
}

async function findScheduleOrThrow(id) {
  const { rows } = await db.query("SELECT * FROM visit_schedules WHERE id = $1", [id]);
  if (!rows.length) {
    const error = new Error("Cronograma no encontrado");
    error.status = 404;
    throw error;
  }
  return rows[0];
}

let holidaySetCache = null;
function getHolidaySet() {
  if (holidaySetCache) return holidaySetCache;
  const source = HOLIDAYS_EC && typeof HOLIDAYS_EC === "object" ? HOLIDAYS_EC : {};
  const flatDates = Object.values(source)
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .filter(Boolean);
  holidaySetCache = new Set(flatDates);
  return holidaySetCache;
}

// Las semanas del cronograma comercial son de 5 dias habiles (lun-vie) -- los
// fines de semana no cuentan como semana y los feriados reducen los dias
// disponibles de esa semana, pero no se planifican visitas en ellos. Antes
// esta funcion solo validaba mes/anio: no habia ningun chequeo de dia habil,
// por eso cronogramas aprobados (ej. karen.barberan agosto 2026) terminaron
// con visitas en sabado/domingo.
function validateVisitDateWithinSchedule(plannedDate, schedule) {
  if (!plannedDate) {
    const error = new Error("La fecha planificada es obligatoria");
    error.status = 400;
    throw error;
  }

  const parsed = new Date(plannedDate);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error("La fecha planificada no es vÃ¡lida");
    error.status = 400;
    throw error;
  }

  const visitMonth = parsed.getUTCMonth() + 1;
  const visitYear = parsed.getUTCFullYear();

  if (visitMonth !== Number(schedule.month) || visitYear !== Number(schedule.year)) {
    const error = new Error("La fecha de visita debe estar dentro del mes del cronograma");
    error.status = 400;
    throw error;
  }

  const weekday = parsed.getUTCDay(); // 0 = domingo, 6 = sabado
  if (weekday === 0 || weekday === 6) {
    const error = new Error("No se pueden planificar visitas en fin de semana. Elige un dia habil (lunes a viernes).");
    error.status = 400;
    throw error;
  }

  const dateOnly = toDateOnlyString(plannedDate);
  if (dateOnly && getHolidaySet().has(dateOnly)) {
    const error = new Error("La fecha seleccionada es feriado en Ecuador. Elige otro dia habil.");
    error.status = 400;
    throw error;
  }
}

async function triggerReapprovalIfNeeded(schedule) {
  if (!schedule || !["approved", "rejected"].includes(schedule.status)) return schedule;

  const { rows } = await db.query(
    `UPDATE visit_schedules
     SET status = 'pending_approval',
         reviewed_by_email = NULL,
         reviewed_at = NULL,
         rejection_reason = NULL,
         submitted_at = COALESCE(submitted_at, NOW()),
         updated_at = NOW()
     WHERE id = $1
       AND status IN ('approved', 'rejected')
     RETURNING *`,
    [schedule.id],
  );

  return rows[0] || schedule;
}

function ensureOwner(schedule, user) {
  if (schedule.user_email !== user.email && !isManager(user)) {
    const error = new Error("No puedes modificar cronogramas de otros asesores");
    error.status = 403;
    throw error;
  }
}

async function assertClientAccessibleToAdvisor({ clientRequestId, user }) {
  const { rows } = await db.query(
    `SELECT 1
       FROM client_requests cr
      WHERE cr.id = $1
        AND (
          LOWER(COALESCE(cr.created_by, '')) = LOWER($2)
          OR EXISTS (
            SELECT 1
              FROM client_assignments ca
             WHERE ca.client_request_id = cr.id
               AND ca.is_active = TRUE
               AND (ca.starts_at IS NULL OR ca.starts_at <= NOW())
               AND (ca.ends_at IS NULL OR ca.ends_at >= NOW())
               AND LOWER(COALESCE(ca.assigned_to_email, '')) = LOWER($2)
          )
        )
      LIMIT 1`,
    [clientRequestId, user?.email || ""],
  );

  if (!rows.length) {
    const error = new Error("El cliente no esta asignado al asesor");
    error.status = 403;
    throw error;
  }
}

async function getClientOrThrow(clientRequestId) {
  const { rows } = await db.query(
    `SELECT id, commercial_name, shipping_city, shipping_province, shipping_address
       FROM client_requests
      WHERE id = $1
      LIMIT 1`,
    [clientRequestId],
  );
  if (!rows.length) {
    const error = new Error("Cliente no encontrado");
    error.status = 404;
    throw error;
  }
  return rows[0];
}

async function listAccessibleClientsByCity({ city, user }) {
  const { rows } = await db.query(
    `SELECT cr.id, cr.commercial_name, cr.shipping_city, cr.shipping_province, cr.shipping_address
       FROM client_requests cr
      WHERE (
        LOWER(COALESCE(cr.created_by, '')) = LOWER($1)
        OR EXISTS (
          SELECT 1
            FROM client_assignments ca
           WHERE ca.client_request_id = cr.id
             AND ca.is_active = TRUE
             AND (ca.starts_at IS NULL OR ca.starts_at <= NOW())
             AND (ca.ends_at IS NULL OR ca.ends_at >= NOW())
             AND LOWER(COALESCE(ca.assigned_to_email, '')) = LOWER($1)
        )
      )
        AND LOWER(TRIM(COALESCE(cr.shipping_city, cr.shipping_province, ''))) = LOWER(TRIM($2))
      ORDER BY COALESCE(NULLIF(TRIM(cr.commercial_name), ''), ('Cliente #' || cr.id::text)) ASC`,
    [user?.email || "", city || ""],
  );
  return rows;
}

async function listAccessibleLeadsByCity({ city, user }) {
  const ownerUserId = await getOwnerUserIdByEmail(user?.email);
  if (!ownerUserId) return [];
  const { rows } = await db.query(
    `SELECT l.id, l.full_name, l.company_name, l.city
       FROM crm.crm_leads l
      WHERE l.owner_user_id = $1
        AND l.deleted_at IS NULL
        AND l.status NOT IN ('converted', 'disqualified', 'unqualified')
        AND LOWER(TRIM(COALESCE(l.city, ''))) = LOWER(TRIM($2))
      ORDER BY COALESCE(NULLIF(TRIM(l.full_name), ''), NULLIF(TRIM(l.company_name), ''), ('Lead #' || l.id::text)) ASC`,
    [ownerUserId, city || ""],
  );
  return rows;
}

function resolveCity({ city, client }) {
  return (
    city ||
    client?.shipping_city ||
    client?.shipping_province ||
    client?.shipping_address ||
    null
  );
}

function normalizeProspectName(value) {
  return String(value || "").trim();
}

function getVisitDisplayName(visit = {}) {
  const clientName = String(visit.client_name || "").trim();
  if (clientName) return clientName;
  const prospectName = normalizeProspectName(visit.prospect_name);
  if (prospectName) return prospectName;
  if (visit.client_request_id) return `Cliente #${visit.client_request_id}`;
  return `Visita #${visit.id || "sin nombre"}`;
}

async function getOwnerUserIdByEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;
  const { rows } = await db.query(
    `SELECT id
       FROM public.users
      WHERE LOWER(COALESCE(email, '')) = LOWER($1)
      LIMIT 1`,
    [normalizedEmail],
  );
  return rows[0]?.id || null;
}

async function getScheduleOwner(schedule) {
  const normalizedEmail = String(schedule?.user_email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;
  const { rows } = await db.query(
    `SELECT id, email, COALESCE(fullname, name, email) AS fullname
       FROM public.users
      WHERE LOWER(COALESCE(email, '')) = LOWER($1)
        AND active IS DISTINCT FROM FALSE
      LIMIT 1`,
    [normalizedEmail],
  );
  return rows[0] || null;
}

async function listScheduleManagers() {
  const roles = [...MANAGER_ROLES];
  const { rows } = await db.query(
    `SELECT id, email, COALESCE(fullname, name, email) AS fullname, role
       FROM public.users
      WHERE active IS DISTINCT FROM FALSE
        AND LOWER(REPLACE(REPLACE(COALESCE(role, ''), ' ', '_'), '-', '_')) = ANY($1::text[])
      ORDER BY COALESCE(fullname, name, email) ASC`,
    [roles],
  );
  const seen = new Set();
  return rows.filter((row) => {
    const key = String(row.email || row.id).trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getScheduleNotificationSummary(scheduleId) {
  const { rows } = await db.query(
    `SELECT
       COUNT(*)::int AS total_visits,
       COALESCE(
         json_agg(DISTINCT city ORDER BY city)
           FILTER (WHERE NULLIF(TRIM(COALESCE(city, '')), '') IS NOT NULL),
         '[]'::json
       ) AS cities
       FROM scheduled_visits
      WHERE schedule_id = $1`,
    [scheduleId],
  );
  const row = rows[0] || {};
  const cities = Array.isArray(row.cities) ? row.cities : [];
  return {
    totalVisits: Number(row.total_visits || 0),
    cities,
    citiesLabel: cities.length ? cities.join(", ") : "Sin ciudades registradas",
  };
}

function formatSchedulePeriod(schedule) {
  return `${String(schedule?.month || "").padStart(2, "0")}/${schedule?.year || ""}`;
}

async function notifyScheduleSubmitted(schedule, actorUser) {
  const managers = await listScheduleManagers();
  if (!managers.length) return { sent: 0, reason: "no_managers" };

  const owner = await getScheduleOwner(schedule);
  const summary = await getScheduleNotificationSummary(schedule.id);
  const period = formatSchedulePeriod(schedule);
  const processKey = `schedule:${schedule.id}`;
  const subject = `Cronograma ${period} - revision de planificacion`;
  const message =
    `${owner?.fullname || schedule.user_email} envio el cronograma ${period} para aprobacion. ` +
    `Incluye ${summary.totalVisits} visita(s). Ciudades: ${summary.citiesLabel}.`;

  await Promise.all(
    managers.map((manager) => notificationManager.sendNotification({
      userId: manager.id,
      template: "schedule_submitted",
      customTitle: "Cronograma pendiente de aprobacion",
      customMessage: message,
      type: "task",
      priority: 2,
      source: "schedules.submit_for_approval",
      email: true,
      data: {
        email_subject: subject,
        target_path: "/dashboard/comercial/aprobaciones-planificacion",
        cta_label: "Revisar cronograma",
        schedule_id: schedule.id,
        advisor_email: schedule.user_email,
        advisor_name: owner?.fullname || schedule.user_email,
        period,
        total_visits: summary.totalVisits,
        cities: summary.citiesLabel,
      },
      meta: {
        process_key: processKey,
        schedule_id: schedule.id,
        actor_email: actorUser?.email || null,
        advisor_email: schedule.user_email,
        email_subject: subject,
        target_path: "/dashboard/comercial/aprobaciones-planificacion",
        cta_label: "Revisar cronograma",
      },
    })),
  );

  return { sent: managers.length };
}

async function notifyScheduleReviewed(schedule, { approved, notes, actorUser }) {
  const owner = await getScheduleOwner(schedule);
  if (!owner?.id) return { sent: 0, reason: "owner_not_found" };

  const summary = await getScheduleNotificationSummary(schedule.id);
  const period = formatSchedulePeriod(schedule);
  const processKey = `schedule:${schedule.id}`;
  const subject = `Cronograma ${period} - resultado de revision`;
  const title = approved ? "Cronograma aprobado" : "Cronograma rechazado";
  const message = approved
    ? `Tu cronograma ${period} fue aprobado por ${actorUser?.fullname || actorUser?.name || actorUser?.email || "jefatura"}. ${notes ? `Comentario: ${notes}` : ""}`
    : `Tu cronograma ${period} fue rechazado por ${actorUser?.fullname || actorUser?.name || actorUser?.email || "jefatura"}. Motivo: ${notes || "Sin detalle"}`;

  await notificationManager.sendNotification({
    userId: owner.id,
    template: approved ? "schedule_approved" : "schedule_rejected",
    customTitle: title,
    customMessage: message,
    type: approved ? "task" : "alert",
    priority: approved ? 1 : 2,
    source: approved ? "schedules.approved" : "schedules.rejected",
    email: true,
    data: {
      email_subject: subject,
      target_path: "/dashboard/comercial/planificacion",
      cta_label: "Abrir planificacion",
      schedule_id: schedule.id,
      period,
      total_visits: summary.totalVisits,
      cities: summary.citiesLabel,
      review_notes: notes || "",
    },
    meta: {
      process_key: processKey,
      schedule_id: schedule.id,
      actor_email: actorUser?.email || null,
      advisor_email: schedule.user_email,
      email_subject: subject,
      target_path: "/dashboard/comercial/planificacion",
      cta_label: "Abrir planificacion",
    },
  });

  return { sent: 1 };
}

async function notifyScheduleReapprovalRequired(schedule, actorUser) {
  const managers = await listScheduleManagers();
  if (!managers.length) return { sent: 0, reason: "no_managers" };

  const owner = await getScheduleOwner(schedule);
  const summary = await getScheduleNotificationSummary(schedule.id);
  const period = formatSchedulePeriod(schedule);
  const subject = `Cronograma ${period} - cambios requieren nueva revision`;
  const message =
    `${owner?.fullname || schedule.user_email} modifico el cronograma ${period}; ` +
    `requiere nueva aprobacion. Visitas: ${summary.totalVisits}. Ciudades: ${summary.citiesLabel}.`;

  await Promise.all(
    managers.map((manager) => notificationManager.sendNotification({
      userId: manager.id,
      template: "schedule_reapproval_required",
      customTitle: "Cronograma requiere nueva revision",
      customMessage: message,
      type: "alert",
      priority: 2,
      source: "schedules.reapproval_required",
      email: true,
      data: {
        email_subject: subject,
        target_path: "/dashboard/comercial/aprobaciones-planificacion",
        cta_label: "Revisar cambios",
        schedule_id: schedule.id,
        advisor_email: schedule.user_email,
        advisor_name: owner?.fullname || schedule.user_email,
        period,
        total_visits: summary.totalVisits,
        cities: summary.citiesLabel,
      },
      meta: {
        process_key: `schedule:${schedule.id}`,
        schedule_id: schedule.id,
        actor_email: actorUser?.email || null,
        advisor_email: schedule.user_email,
        email_subject: subject,
        target_path: "/dashboard/comercial/aprobaciones-planificacion",
        cta_label: "Revisar cambios",
      },
    })),
  );

  return { sent: managers.length };
}

async function notifyReapprovalIfTransitioned(previousSchedule, currentSchedule, actorUser) {
  const previousStatus = String(previousSchedule?.status || "");
  const currentStatus = String(currentSchedule?.status || "");
  if (!["approved", "rejected"].includes(previousStatus) || currentStatus !== "pending_approval") {
    return { sent: 0, reason: "no_reapproval_transition" };
  }
  return notifyScheduleReapprovalRequired(currentSchedule, actorUser);
}

function toDateOnlyString(value) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function buildScheduledVisitTimestamp(plannedDate) {
  const normalized = toDateOnlyString(plannedDate);
  if (!normalized) return null;
  return `${normalized}T09:00:00-05:00`;
}

async function upsertCrmFamActivityForScheduledVisit({ schedule, visit, ownerUserId }) {
  const hasCrmActivities = await tableExists("crm", "crm_activities");
  if (!hasCrmActivities || !ownerUserId) return null;

  const visitLabel = getVisitDisplayName(visit);
  const subject = `Visita planificada · ${visitLabel}`;
  const description = [
    `Origen: cronograma comercial aprobado`,
    `Asesor: ${schedule.user_email}`,
    `Cronograma: ${String(schedule.month).padStart(2, "0")}/${schedule.year}`,
    `Visita planificada: ${toDateOnlyString(visit.planned_date)}`,
    visit.city ? `Ciudad: ${visit.city}` : null,
    visit.notes ? `Notas: ${visit.notes}` : null,
    `Schedule ID: ${schedule.id}`,
    `Scheduled Visit ID: ${visit.id}`,
  ].filter(Boolean).join("\n");
  const scheduledAt = buildScheduledVisitTimestamp(visit.planned_date);

  if (visit.crm_activity_id) {
    const { rows } = await db.query(
      `UPDATE crm.crm_activities
          SET activity_type = 'visita',
              subject = $2,
              description = $3,
              scheduled_at = $4,
              owner_user_id = $5,
              status = CASE
                WHEN status IN ('visited_pending_followup', 'completed', 'cancelled') THEN status
                ELSE 'scheduled'
              END,
              updated_by = $5,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id`,
      [visit.crm_activity_id, subject, description, scheduledAt, ownerUserId],
    );
    if (rows[0]?.id) return rows[0].id;
  }

  const { rows } = await db.query(
    `INSERT INTO crm.crm_activities (
        opportunity_id,
        account_id,
        contact_id,
        activity_type,
        subject,
        description,
        scheduled_at,
        owner_user_id,
        status,
        created_by,
        updated_by
      )
      VALUES (NULL, NULL, NULL, 'visita', $1, $2, $3, $4, 'scheduled', $4, $4)
      RETURNING id`,
    [subject, description, scheduledAt, ownerUserId],
  );
  return rows[0]?.id || null;
}

async function listMySchedules(user) {
  assertCommercial(user);
  const { rows } = await db.query(
    `SELECT * FROM visit_schedules WHERE user_email = $1 ORDER BY year DESC, month DESC`,
    [user.email],
  );
  return rows;
}

async function getHolidays(user) {
  assertCommercial(user);
  const source = HOLIDAYS_EC && typeof HOLIDAYS_EC === "object" ? HOLIDAYS_EC : {};
  const flatDates = Object.values(source)
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .filter(Boolean);
  const uniqueDates = [...new Set(flatDates)].sort();
  return {
    by_year: source,
    dates: uniqueDates,
  };
}

async function listPendingApproval(user) {
  assertManager(user);
  const { rows } = await db.query(
    `SELECT
       vs.id,
       vs.user_email,
       COALESCE(u.fullname, u.name, vs.user_email) AS user_name,
       vs.month,
       vs.year,
       vs.status,
       vs.submitted_at,
       vs.notes,
       vs.reviewed_by_email,
       vs.reviewed_at,
       vs.rejection_reason,
       COUNT(DISTINCT sv.id) AS visits_count,
       COUNT(vl.id) FILTER (WHERE vl.status = 'visited') AS visits_visited,
       COUNT(vl.id) FILTER (WHERE vl.status = 'skipped') AS visits_skipped,
       COUNT(vl.id) FILTER (WHERE vl.status = 'pending') AS visits_pending,
       COUNT(vl.id) FILTER (WHERE vl.status = 'in_visit') AS visits_in_visit,
       COUNT(vl.id) FILTER (
         WHERE vl.hora_entrada IS NOT NULL
           AND vl.hora_salida IS NOT NULL
           AND vl.lat_entrada IS NOT NULL
           AND vl.lng_entrada IS NOT NULL
           AND vl.lat_salida IS NOT NULL
           AND vl.lng_salida IS NOT NULL
       ) AS visits_with_details,
       AVG(vl.duracion_minutos) FILTER (WHERE vl.duracion_minutos IS NOT NULL) AS avg_duration_minutes,
       COALESCE(array_remove(array_agg(DISTINCT sv.city), NULL), '{}') AS cities,
       COALESCE(
         json_agg(
           DISTINCT jsonb_build_object(
             'id', sv.id,
             'client_request_id', sv.client_request_id,
             'client_name', COALESCE(cr.commercial_name, sv.prospect_name),
             'prospect_name', sv.prospect_name,
             'planned_date', sv.planned_date,
             'city', sv.city,
             'priority', sv.priority
           )
         ) FILTER (WHERE sv.id IS NOT NULL),
         '[]'
       ) AS visits
     FROM visit_schedules vs
     LEFT JOIN scheduled_visits sv ON sv.schedule_id = vs.id
     LEFT JOIN client_requests cr ON cr.id = sv.client_request_id
     LEFT JOIN client_visit_logs vl
       ON vl.client_request_id = sv.client_request_id
      AND vl.user_email = vs.user_email
      AND EXTRACT(MONTH FROM vl.visit_date) = vs.month
      AND EXTRACT(YEAR FROM vl.visit_date) = vs.year
     LEFT JOIN users u ON u.email = vs.user_email
     WHERE vs.status = 'pending_approval'
     GROUP BY vs.id, u.fullname, u.name
     ORDER BY vs.submitted_at DESC NULLS LAST`,
  );
  return rows.map((row) => ({
    ...row,
    visits_count: Number(row.visits_count || 0),
    visits_visited: Number(row.visits_visited || 0),
    visits_skipped: Number(row.visits_skipped || 0),
    visits_pending: Number(row.visits_pending || 0),
    visits_in_visit: Number(row.visits_in_visit || 0),
    visits_with_details: Number(row.visits_with_details || 0),
    avg_duration_minutes: row.avg_duration_minutes !== null ? Number(row.avg_duration_minutes) : null,
    efficiency_ratio:
      Number(row.visits_count || 0) > 0
        ? Number(row.visits_visited || 0) / Number(row.visits_count || 0)
        : null,
    details_completion_ratio:
      Number(row.visits_count || 0) > 0
        ? Number(row.visits_with_details || 0) / Number(row.visits_count || 0)
        : null,
    cities: Array.isArray(row.cities) ? row.cities : [],
    visits: Array.isArray(row.visits) ? row.visits : [],
  }));
}

async function listTeamSchedules(user) {
  assertManager(user);
  const { rows } = await db.query(
    `SELECT
       vs.*,
       COALESCE(u.fullname, u.name, vs.user_email) AS user_name,
       COUNT(DISTINCT sv.id) AS visits_count,
       COUNT(vl.id) FILTER (WHERE vl.status = 'visited') AS visits_visited,
       COUNT(vl.id) FILTER (WHERE vl.status = 'skipped') AS visits_skipped,
       COUNT(vl.id) FILTER (WHERE vl.status = 'pending') AS visits_pending,
       COUNT(vl.id) FILTER (WHERE vl.status = 'in_visit') AS visits_in_visit,
       COUNT(vl.id) FILTER (
         WHERE vl.hora_entrada IS NOT NULL
           AND vl.hora_salida IS NOT NULL
           AND vl.lat_entrada IS NOT NULL
           AND vl.lng_entrada IS NOT NULL
           AND vl.lat_salida IS NOT NULL
           AND vl.lng_salida IS NOT NULL
       ) AS visits_with_details,
       AVG(vl.duracion_minutos) FILTER (WHERE vl.duracion_minutos IS NOT NULL) AS avg_duration_minutes,
       COALESCE(array_remove(array_agg(DISTINCT sv.city), NULL), '{}') AS cities,
       (
         SELECT COUNT(1)
         FROM client_visit_logs cvl
         WHERE cvl.user_email = vs.user_email
           AND EXTRACT(MONTH FROM cvl.visit_date) = vs.month
           AND EXTRACT(YEAR FROM cvl.visit_date) = vs.year
           AND NOT EXISTS (
             SELECT 1
             FROM scheduled_visits sv2
             WHERE sv2.schedule_id = vs.id
               AND sv2.client_request_id = cvl.client_request_id
           )
       ) AS unexpected_client_visits
     FROM visit_schedules vs
     LEFT JOIN scheduled_visits sv ON sv.schedule_id = vs.id
     LEFT JOIN client_visit_logs vl
       ON vl.client_request_id = sv.client_request_id
      AND vl.user_email = vs.user_email
      AND EXTRACT(MONTH FROM vl.visit_date) = vs.month
      AND EXTRACT(YEAR FROM vl.visit_date) = vs.year
     LEFT JOIN users u ON u.email = vs.user_email
     WHERE COALESCE(LOWER(u.role), '') IN ('comercial','acp_comercial','backoffice','backoffice_comercial','asesor_comercial')
     GROUP BY vs.id, u.fullname, u.name
     ORDER BY vs.user_email ASC, vs.year DESC, vs.month DESC
     LIMIT 500`,
  );
  return rows.map((row) => ({
    ...row,
    visits_count: Number(row.visits_count || 0),
    visits_visited: Number(row.visits_visited || 0),
    visits_skipped: Number(row.visits_skipped || 0),
    visits_pending: Number(row.visits_pending || 0),
    visits_in_visit: Number(row.visits_in_visit || 0),
    visits_with_details: Number(row.visits_with_details || 0),
    avg_duration_minutes: row.avg_duration_minutes !== null ? Number(row.avg_duration_minutes) : null,
    unexpected_client_visits: Number(row.unexpected_client_visits || 0),
    efficiency_ratio:
      Number(row.visits_count || 0) > 0
        ? Number(row.visits_visited || 0) / Number(row.visits_count || 0)
        : null,
    details_completion_ratio:
      Number(row.visits_count || 0) > 0
        ? Number(row.visits_with_details || 0) / Number(row.visits_count || 0)
        : null,
    cities: Array.isArray(row.cities) ? row.cities : [],
  }));
}

async function getScheduleDetail({ id, user }) {
  assertCommercial(user);
  const schedule = await findScheduleOrThrow(id);
  if (!isManager(user)) {
    ensureOwner(schedule, user);
  }
  const { rows: visits } = await db.query(
    `SELECT
       sv.id,
       sv.schedule_id,
       sv.client_request_id,
       sv.lead_id,
       sv.prospect_name,
       COALESCE(sv.city, cr.shipping_city, cr.shipping_province, cr.shipping_address) AS city,
       sv.planned_date,
       sv.priority,
       sv.notes,
       sv.justification,
       sv.created_at,
       sv.updated_at,
       cr.commercial_name AS client_name,
       cr.shipping_city AS client_city,
       cr.shipping_province AS client_province,
       cr.shipping_address AS client_address,
       COALESCE(vl.status, pv.status) AS visit_status,
       COALESCE(vl.hora_entrada, pv.check_in_time) AS hora_entrada,
       COALESCE(vl.hora_salida, pv.check_out_time) AS hora_salida,
       COALESCE(vl.lat_entrada, pv.check_in_lat) AS lat_entrada,
       COALESCE(vl.lng_entrada, pv.check_in_lng) AS lng_entrada,
       COALESCE(vl.lat_salida, pv.check_out_lat) AS lat_salida,
       COALESCE(vl.lng_salida, pv.check_out_lng) AS lng_salida,
       COALESCE(vl.observaciones, pv.observations) AS observaciones,
       vl.duracion_minutos
     FROM scheduled_visits sv
     LEFT JOIN client_requests cr ON cr.id = sv.client_request_id
     LEFT JOIN client_visit_logs vl
       ON vl.client_request_id = sv.client_request_id
      AND vl.user_email = $2
      AND EXTRACT(MONTH FROM vl.visit_date) = $3
      AND EXTRACT(YEAR FROM vl.visit_date) = $4
     LEFT JOIN prospect_visits pv
       ON pv.lead_id = sv.lead_id
      AND sv.lead_id IS NOT NULL
      AND LOWER(COALESCE(pv.user_email, '')) = LOWER($2)
      AND EXTRACT(MONTH FROM pv.visit_date) = $3
      AND EXTRACT(YEAR FROM pv.visit_date) = $4
     WHERE sv.schedule_id = $1
     ORDER BY sv.planned_date ASC, sv.priority ASC`,
    [id, schedule.user_email, Number(schedule.month), Number(schedule.year)],
  );
  const startDate = new Date(Number(schedule.year), Number(schedule.month) - 1, 1);
  const endDate = new Date(Number(schedule.year), Number(schedule.month), 1);

  const { rows: unexpectedVisits } = await db.query(
    `SELECT
       id,
       prospect_name,
       visit_date,
       status,
       check_in_time,
       check_out_time,
       check_in_lat,
       check_in_lng,
       check_out_lat,
       check_out_lng,
       observations
     FROM prospect_visits
     WHERE user_email = $1
       AND visit_date >= $2
       AND visit_date < $3
     ORDER BY visit_date DESC`,
    [schedule.user_email, startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)],
  );

  const { rows: unexpectedClientVisits } = await db.query(
    `SELECT
       vl.id,
       vl.client_request_id,
       cr.commercial_name AS client_name,
       vl.visit_date,
       vl.status,
       vl.hora_entrada,
       vl.hora_salida,
       vl.lat_entrada,
       vl.lng_entrada,
       vl.lat_salida,
       vl.lng_salida,
       vl.observaciones
     FROM client_visit_logs vl
     JOIN client_requests cr ON cr.id = vl.client_request_id
     WHERE vl.user_email = $1
       AND vl.visit_date >= $2
       AND vl.visit_date < $3
       AND NOT EXISTS (
         SELECT 1
         FROM scheduled_visits sv
         WHERE sv.schedule_id = $4
           AND sv.client_request_id = vl.client_request_id
       )
     ORDER BY vl.visit_date DESC, vl.hora_entrada DESC NULLS LAST`,
    [
      schedule.user_email,
      startDate.toISOString().slice(0, 10),
      endDate.toISOString().slice(0, 10),
      schedule.id,
    ],
  );

  return {
    ...schedule,
    visits,
    unexpected_visits: unexpectedVisits,
    unexpected_client_visits: unexpectedClientVisits,
  };
}

async function listScheduleVisitsForExternalSync(scheduleId) {
  const { rows } = await db.query(
    `SELECT
       sv.id,
       sv.schedule_id,
       sv.client_request_id,
       sv.prospect_name,
       sv.planned_date,
       sv.city,
       sv.priority,
       sv.notes,
       sv.crm_meeting_id,
       sv.crm_activity_id,
       sv.calendar_event_id,
       sv.calendar_event_link,
       sv.calendar_event_calendar_id,
       cr.commercial_name AS client_name
     FROM scheduled_visits sv
     LEFT JOIN client_requests cr ON cr.id = sv.client_request_id
     WHERE sv.schedule_id = $1
     ORDER BY sv.planned_date ASC, sv.priority DESC, sv.id ASC`,
    [scheduleId],
  );
  return rows;
}

function buildScheduleVisitCalendarPayload({ schedule, visit }) {
  const visitLabel = getVisitDisplayName(visit);
  const summary = `CRM-FAM · ${visitLabel}`;
  const description = [
    `Actividad aprobada desde cronograma comercial`,
    `Asesor: ${schedule.user_email}`,
    `Cliente: ${visitLabel}`,
    visit.city ? `Ciudad: ${visit.city}` : null,
    visit.notes ? `Notas: ${visit.notes}` : null,
    `Cronograma: ${String(schedule.month).padStart(2, "0")}/${schedule.year}`,
    `Visita planificada: ${toDateOnlyString(visit.planned_date)}`,
  ].filter(Boolean).join("\n");

  return {
    summary,
    description,
    date: toDateOnlyString(visit.planned_date),
    attendees: schedule.user_email ? [schedule.user_email] : [],
  };
}

async function syncApprovedScheduleArtifacts(schedule) {
  const hasSyncColumns = await ensureScheduledVisitsExternalSyncColumns();
  const visits = await listScheduleVisitsForExternalSync(schedule.id);
  const ownerUserId = await getOwnerUserIdByEmail(schedule.user_email);
  const summary = {
    total_visits: visits.length,
    crm_fam: { synced: 0, failed: 0 },
    calendar: { synced: 0, failed: 0 },
  };

  for (const visit of visits) {
    try {
      const crmActivityId = await upsertCrmFamActivityForScheduledVisit({ schedule, visit, ownerUserId });
      if (hasSyncColumns && crmActivityId) {
        await db.query(
          `UPDATE scheduled_visits
              SET crm_activity_id = $2,
                  external_synced_at = NOW(),
                  updated_at = NOW()
            WHERE id = $1`,
          [visit.id, crmActivityId],
        );
      }
      if (crmActivityId) {
        summary.crm_fam.synced += 1;
      } else {
        summary.crm_fam.failed += 1;
      }
    } catch (error) {
      summary.crm_fam.failed += 1;
      logger.warn(
        { schedule_id: schedule.id, visit_id: visit.id, error: error?.message },
        "[SCHEDULES] Error creando actividad aprobada en CRM-FAM",
      );
    }

    try {
      const calendarEvent = await createOrUpdateSharedAllDayEvent({
        eventId: visit.calendar_event_id || null,
        ...buildScheduleVisitCalendarPayload({ schedule, visit }),
      });
      if (hasSyncColumns && calendarEvent?.id) {
        await db.query(
          `UPDATE scheduled_visits
              SET calendar_event_id = $2,
                  calendar_event_link = $3,
                  calendar_event_calendar_id = $4,
                  external_synced_at = NOW(),
                  updated_at = NOW()
            WHERE id = $1`,
          [visit.id, calendarEvent.id, calendarEvent.htmlLink || null, calendarEvent.calendarId || null],
        );
      }
      summary.calendar.synced += 1;
    } catch (error) {
      summary.calendar.failed += 1;
      logger.warn(
        { schedule_id: schedule.id, visit_id: visit.id, error: error?.message },
        "[SCHEDULES] Error creando evento de Google Calendar para actividad aprobada",
      );
    }
  }

  return summary;
}

async function createSchedule({ month, year, notes, user }) {
  assertAdvisor(user);
  if (!month || !year) {
    const error = new Error("Mes y aÃ±o son obligatorios");
    error.status = 400;
    throw error;
  }

  const { rows: existing } = await db.query(
    `SELECT id FROM visit_schedules WHERE user_email = $1 AND month = $2 AND year = $3 LIMIT 1`,
    [user.email, month, year],
  );
  if (existing.length) {
    const error = new Error("Ya existe un cronograma para ese mes");
    error.status = 409;
    throw error;
  }

  const { rows } = await db.query(
    `INSERT INTO visit_schedules (user_email, month, year, notes) VALUES ($1,$2,$3,$4) RETURNING *`,
    [user.email, month, year, notes || null],
  );
  return rows[0];
}

async function updateSchedule({ id, notes, user }) {
  assertAdvisor(user);
  const schedule = await findScheduleOrThrow(id);
  ensureOwner(schedule, user);

  const needsReapproval = ["approved", "rejected"].includes(schedule.status);

  const { rows } = await db.query(
    `UPDATE visit_schedules
     SET notes = $1,
         status = CASE WHEN $3 THEN 'pending_approval' ELSE status END,
         reviewed_by_email = CASE WHEN $3 THEN NULL ELSE reviewed_by_email END,
         reviewed_at = CASE WHEN $3 THEN NULL ELSE reviewed_at END,
         rejection_reason = CASE WHEN $3 THEN NULL ELSE rejection_reason END,
         submitted_at = CASE WHEN $3 THEN NOW() ELSE submitted_at END,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [notes || null, id, needsReapproval],
  );

  const updatedSchedule = rows[0];
  const notifications = needsReapproval
    ? await notifyReapprovalIfTransitioned(schedule, updatedSchedule, user)
    : { sent: 0 };

  return { ...updatedSchedule, needs_reapproval: needsReapproval, notifications };
}

async function deleteSchedule({ id, user }) {
  assertAdvisor(user);
  const schedule = await findScheduleOrThrow(id);
  ensureOwner(schedule, user);
  if (schedule.status === "approved") {
    const error = new Error("No se puede eliminar un cronograma aprobado");
    error.status = 400;
    throw error;
  }
  if (schedule.status !== "draft" && schedule.status !== "rejected") {
    const error = new Error("Solo se pueden eliminar cronogramas en borrador o rechazados");
    error.status = 400;
    throw error;
  }
  await db.query("DELETE FROM visit_schedules WHERE id = $1", [id]);
  return { deleted: true };
}

async function submitForApproval({ id, user }) {
  assertAdvisor(user);
  const schedule = await findScheduleOrThrow(id);
  ensureOwner(schedule, user);
  if (schedule.status !== "draft" && schedule.status !== "rejected") {
    const error = new Error("Solo puedes enviar cronogramas en borrador o rechazados");
    error.status = 400;
    throw error;
  }
  const { rows: visits } = await db.query(
    `SELECT COUNT(1) AS total FROM scheduled_visits WHERE schedule_id = $1`,
    [id],
  );
  if (Number(visits[0]?.total || 0) === 0) {
    const error = new Error("Agrega al menos una visita antes de enviar");
    error.status = 400;
    throw error;
  }
  const { rows } = await db.query(
    `UPDATE visit_schedules
     SET status = 'pending_approval', submitted_at = NOW(), rejection_reason = NULL
     WHERE id = $1
     RETURNING *`,
    [id],
  );
  const submittedSchedule = rows[0];
  submittedSchedule.notifications = await notifyScheduleSubmitted(submittedSchedule, user);
  return submittedSchedule;
}

async function addVisit({ scheduleId, clientRequestId, prospectName, plannedDate, city, priority, notes, user }) {
  assertAdvisor(user);
  const schedule = await findScheduleOrThrow(scheduleId);
  ensureOwner(schedule, user);
  const normalizedProspectName = normalizeProspectName(prospectName);
  const hasClient = Number.isInteger(Number(clientRequestId)) && Number(clientRequestId) > 0;
  if (!plannedDate || (!hasClient && !normalizedProspectName)) {
    const error = new Error("La fecha y el nombre de la visita son obligatorios");
    error.status = 400;
    throw error;
  }
  validateVisitDateWithinSchedule(plannedDate, schedule);
  let client = null;
  if (hasClient) {
    await assertClientAccessibleToAdvisor({ clientRequestId: Number(clientRequestId), user });
    client = await getClientOrThrow(Number(clientRequestId));
  }
  const targetCity = resolveCity({ city, client }) || "Ciudad no especificada";
  const dedupeParams = [scheduleId, plannedDate];
  let existingVisitQuery = `
    SELECT id
      FROM scheduled_visits
     WHERE schedule_id = $1
       AND planned_date = $2
  `;
  if (hasClient) {
    dedupeParams.push(Number(clientRequestId));
    existingVisitQuery += ` AND client_request_id = $3 LIMIT 1`;
  } else {
    dedupeParams.push(normalizedProspectName);
    existingVisitQuery += ` AND client_request_id IS NULL AND LOWER(TRIM(COALESCE(prospect_name, ''))) = LOWER(TRIM($3)) LIMIT 1`;
  }
  const { rows: existingRows } = await db.query(existingVisitQuery, dedupeParams);
  if (existingRows.length) {
    const { rows } = await db.query(
      `UPDATE scheduled_visits
          SET city = $2,
              priority = $3,
              notes = $4,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [existingRows[0].id, targetCity, priority || 1, notes || null],
    );
    const updatedSchedule = await triggerReapprovalIfNeeded(schedule);
    await notifyReapprovalIfTransitioned(schedule, updatedSchedule, user);
    return { ...rows[0], schedule_status: updatedSchedule.status };
  }
  const { rows } = await db.query(
    `INSERT INTO scheduled_visits (schedule_id, client_request_id, prospect_name, planned_date, city, priority, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *`,
    [
      scheduleId,
      hasClient ? Number(clientRequestId) : null,
      hasClient ? null : normalizedProspectName,
      plannedDate,
      targetCity,
      priority || 1,
      notes || null,
    ],
  );

  const updatedSchedule = await triggerReapprovalIfNeeded(schedule);
  await notifyReapprovalIfTransitioned(schedule, updatedSchedule, user);

  return { ...rows[0], schedule_status: updatedSchedule.status };
}

async function syncWeekCity({ scheduleId, city, dates, user }) {
  assertAdvisor(user);
  const schedule = await findScheduleOrThrow(scheduleId);
  ensureOwner(schedule, user);

  const normalizedCity = String(city || "").trim();
  const normalizedDates = [...new Set((Array.isArray(dates) ? dates : []).map((value) => String(value || "").slice(0, 10)).filter(Boolean))];

  if (!normalizedCity) {
    const error = new Error("La ciudad es obligatoria");
    error.status = 400;
    throw error;
  }

  if (!normalizedDates.length) {
    const error = new Error("La semana no contiene fechas validas");
    error.status = 400;
    throw error;
  }

  normalizedDates.forEach((plannedDate) => validateVisitDateWithinSchedule(plannedDate, schedule));

  const [clients, leads] = await Promise.all([
    listAccessibleClientsByCity({ city: normalizedCity, user }),
    listAccessibleLeadsByCity({ city: normalizedCity, user }),
  ]);
  const targets = [
    ...clients.map((c) => ({ client_request_id: c.id, lead_id: null, prospect_name: null })),
    ...leads.map((l) => ({
      client_request_id: null,
      lead_id: l.id,
      prospect_name: l.full_name || l.company_name || `Lead #${l.id}`,
    })),
  ];
  if (!targets.length) {
    return {
      schedule_id: scheduleId,
      city: normalizedCity,
      inserted: 0,
      dates: normalizedDates,
      visits: [],
    };
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    // Solo se borran las visitas de ESTA ciudad en la semana (permite re-sincronizar
    // para refrescar) -- antes borraba TODA la semana, asi que cargar una segunda
    // ciudad eliminaba las visitas de la primera. Una semana puede tener varias ciudades.
    await client.query(
      `DELETE FROM scheduled_visits
        WHERE schedule_id = $1
          AND planned_date = ANY($2::date[])
          AND city = $3`,
      [scheduleId, normalizedDates, normalizedCity],
    );

    const insertedVisits = [];
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      const plannedDate = normalizedDates[index % normalizedDates.length];
      const { rows } = await client.query(
        `INSERT INTO scheduled_visits (schedule_id, client_request_id, lead_id, prospect_name, planned_date, city, priority, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [scheduleId, target.client_request_id, target.lead_id, target.prospect_name, plannedDate, normalizedCity, 1, null],
      );
      insertedVisits.push(rows[0]);
    }

    await client.query("COMMIT");
    const updatedSchedule = await triggerReapprovalIfNeeded(schedule);
    await notifyReapprovalIfTransitioned(schedule, updatedSchedule, user);
    return {
      schedule_id: scheduleId,
      city: normalizedCity,
      inserted: insertedVisits.length,
      dates: normalizedDates,
      schedule_status: updatedSchedule.status,
      visits: insertedVisits,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateVisit({
  scheduleId,
  visitId,
  clientRequestId,
  prospectName,
  city,
  plannedDate,
  priority,
  notes,
  preserveApprovedStatus = false,
  user,
}) {
  assertAdvisor(user);
  const schedule = await findScheduleOrThrow(scheduleId);
  ensureOwner(schedule, user);
  const { rows } = await db.query("SELECT * FROM scheduled_visits WHERE id = $1 AND schedule_id = $2", [visitId, scheduleId]);
  if (!rows.length) {
    const error = new Error("Visita no encontrada");
    error.status = 404;
    throw error;
  }
  const visit = rows[0];
  validateVisitDateWithinSchedule(plannedDate || visit.planned_date, schedule);
  const normalizedProspectName = normalizeProspectName(prospectName);
  const targetClientRequestId = clientRequestId || visit.client_request_id || null;
  const targetProspectName = targetClientRequestId ? null : (normalizedProspectName || normalizeProspectName(visit.prospect_name));
  if (!targetClientRequestId && !targetProspectName) {
    const error = new Error("La visita debe tener un cliente o un prospecto");
    error.status = 400;
    throw error;
  }
  let client = null;
  if (targetClientRequestId) {
    await assertClientAccessibleToAdvisor({ clientRequestId: targetClientRequestId, user });
    client = await getClientOrThrow(targetClientRequestId);
  }
  const targetCity = resolveCity({ city: city || visit.city, client }) || "Ciudad no especificada";
  const { rows: updated } = await db.query(
    `UPDATE scheduled_visits
     SET client_request_id = $1,
         prospect_name = $2,
         city = $3,
         planned_date = $4,
         priority = $5,
         notes = $6,
         updated_at = NOW()
    WHERE id = $7
    RETURNING *`,
    [
      targetClientRequestId,
      targetProspectName,
      targetCity,
      plannedDate || visit.planned_date,
      priority || visit.priority,
      notes !== undefined ? notes : visit.notes,
      visitId,
    ],
  );

  const preserveApprovedReorder =
    Boolean(preserveApprovedStatus) &&
    schedule.status === "approved" &&
    targetClientRequestId === (visit.client_request_id || null) &&
    (targetProspectName || null) === (visit.prospect_name || null) &&
    targetCity === (visit.city || null) &&
    Number(priority || visit.priority) === Number(visit.priority) &&
    (notes !== undefined ? notes : visit.notes) === visit.notes;

  const updatedSchedule = preserveApprovedReorder
    ? schedule
    : await triggerReapprovalIfNeeded(schedule);
  if (!preserveApprovedReorder) {
    await notifyReapprovalIfTransitioned(schedule, updatedSchedule, user);
  }

  return { ...updated[0], schedule_status: updatedSchedule.status };
}

async function deleteVisit({ scheduleId, visitId, user }) {
  assertAdvisor(user);
  const schedule = await findScheduleOrThrow(scheduleId);
  ensureOwner(schedule, user);
  await db.query("DELETE FROM scheduled_visits WHERE id = $1 AND schedule_id = $2", [visitId, scheduleId]);
  const updatedSchedule = await triggerReapprovalIfNeeded(schedule);
  await notifyReapprovalIfTransitioned(schedule, updatedSchedule, user);
  return { deleted: true };
}

async function justifyVisit({ visitId, justification, user }) {
  assertAdvisor(user);
  const { rows } = await db.query(
    `SELECT sv.*, vs.user_email 
     FROM scheduled_visits sv 
     JOIN visit_schedules vs ON vs.id = sv.schedule_id 
     WHERE sv.id = $1 LIMIT 1`,
    [visitId],
  );
  if (!rows.length) {
    const error = new Error("Visita no encontrada");
    error.status = 404;
    throw error;
  }
  const visit = rows[0];
  if (visit.user_email !== user.email) {
    const error = new Error("No tienes permiso para justificar esta visita");
    error.status = 403;
    throw error;
  }

  const { rows: updated } = await db.query(
    `UPDATE scheduled_visits SET justification = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [justification, visitId],
  );
  return updated[0];
}

async function justifySchedule({ id, justification, user }) {
  assertAdvisor(user);
  const schedule = await findScheduleOrThrow(id);
  ensureOwner(schedule, user);

  const { rows: updated } = await db.query(
    `UPDATE visit_schedules SET general_justification = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [justification, id],
  );
  return updated[0];
}

async function approveSchedule({ id, notes, user }) {
  assertManager(user);
  const reviewNotes = normalizeReviewNotes(notes);

  const schedule = await findScheduleOrThrow(id);
  if (schedule.status !== "pending_approval") {
    const error = new Error("Solo puedes aprobar cronogramas pendientes");
    error.status = 400;
    throw error;
  }

  const hasReviewNotesColumn = await ensureVisitScheduleReviewNotesColumn();
  if (hasReviewNotesColumn) {
    const { rows } = await db.query(
      `UPDATE visit_schedules
       SET status = 'approved',
           reviewed_by_email = $1,
           reviewed_at = NOW(),
           rejection_reason = NULL,
           review_notes = NULLIF($2, ''),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [user.email, reviewNotes, id],
    );
    const approvedSchedule = rows[0];
    approvedSchedule.external_sync = await syncApprovedScheduleArtifacts(approvedSchedule);
    approvedSchedule.notifications = await notifyScheduleReviewed(approvedSchedule, {
      approved: true,
      notes: reviewNotes,
      actorUser: user,
    });
    return approvedSchedule;
  }

  const auditNote = buildAuditNote({ action: "approve", notes: reviewNotes, user });
  const { rows } = await db.query(
    `UPDATE visit_schedules
     SET status = 'approved',
         reviewed_by_email = $1,
         reviewed_at = NOW(),
         rejection_reason = NULL,
         notes = CASE
           WHEN NULLIF($2, '') IS NULL THEN notes
           WHEN notes IS NULL OR btrim(notes) = '' THEN $2
           ELSE notes || E'\n' || $2
         END,
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [user.email, auditNote, id],
  );
  const approvedSchedule = rows[0];
  approvedSchedule.external_sync = await syncApprovedScheduleArtifacts(approvedSchedule);
  approvedSchedule.notifications = await notifyScheduleReviewed(approvedSchedule, {
    approved: true,
    notes: reviewNotes,
    actorUser: user,
  });
  return approvedSchedule;
}

async function rejectSchedule({ id, reason, notes, user }) {
  assertManager(user);
  const reviewNotes = normalizeReviewNotes(notes || reason);
  if (!reviewNotes) {
    const error = new Error("Debes incluir notes para rechazar el cronograma");
    error.status = 400;
    throw error;
  }

  const schedule = await findScheduleOrThrow(id);
  if (schedule.status !== "pending_approval") {
    const error = new Error("Solo puedes rechazar cronogramas pendientes");
    error.status = 400;
    throw error;
  }

  const hasReviewNotesColumn = await ensureVisitScheduleReviewNotesColumn();
  if (hasReviewNotesColumn) {
    const { rows } = await db.query(
      `UPDATE visit_schedules
       SET status = 'rejected',
           reviewed_by_email = $1,
           reviewed_at = NOW(),
           rejection_reason = $2,
           review_notes = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [user.email, reviewNotes, id],
    );
    const rejectedSchedule = rows[0];
    rejectedSchedule.notifications = await notifyScheduleReviewed(rejectedSchedule, {
      approved: false,
      notes: reviewNotes,
      actorUser: user,
    });
    return rejectedSchedule;
  }

  const auditNote = buildAuditNote({ action: "reject", notes: reviewNotes, user });
  const { rows } = await db.query(
    `UPDATE visit_schedules
     SET status = 'rejected',
         reviewed_by_email = $1,
         reviewed_at = NOW(),
         rejection_reason = $2,
         notes = CASE
           WHEN notes IS NULL OR btrim(notes) = '' THEN $3
           ELSE notes || E'\n' || $3
         END,
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [user.email, reviewNotes, auditNote, id],
  );
  const rejectedSchedule = rows[0];
  rejectedSchedule.notifications = await notifyScheduleReviewed(rejectedSchedule, {
    approved: false,
    notes: reviewNotes,
    actorUser: user,
  });
  return rejectedSchedule;
}

async function findApprovedScheduleForMonth({ userEmail, month, year, allowPendingReapproval = false }) {
  const statusFilter = allowPendingReapproval
    ? `status IN ('approved', 'pending_approval')`
    : `status = 'approved'`;
  const { rows } = await db.query(
    `SELECT *
       FROM visit_schedules
      WHERE user_email = $1
        AND ${statusFilter}
        AND month = $2
        AND year = $3
      ORDER BY
        CASE status WHEN 'approved' THEN 0 ELSE 1 END ASC,
        reviewed_at DESC NULLS LAST
      LIMIT 1`,
    [userEmail, month, year],
  );
  return rows[0] || null;
}

async function getApprovedScheduleCurrent({ userEmail, month, year, user }) {
  assertCommercial(user);
  const targetEmail = (userEmail || user.email || "").toLowerCase();
  const now = new Date();
  const targetMonth = Number(month || now.getMonth() + 1);
  const targetYear = Number(year || now.getFullYear());
  const schedule = await findApprovedScheduleForMonth({ userEmail: targetEmail, month: targetMonth, year: targetYear });
  if (!schedule) return null;
  const { rows: visits } = await db.query(
    `SELECT client_request_id, prospect_name, planned_date, city, priority, notes
       FROM scheduled_visits
      WHERE schedule_id = $1
      ORDER BY planned_date ASC, priority ASC`,
    [schedule.id],
  );
  return { ...schedule, schedule_id: schedule.id, visits };
}

async function getMyCalendarIcsStream({ user }) {
  assertCommercial(user);
  const targetEmail = String(user?.email || "").trim().toLowerCase();
  if (!targetEmail) {
    const error = new Error("No se pudo resolver el correo del usuario autenticado");
    error.status = 400;
    throw error;
  }

  const { month, year } = getCurrentMonthYearInAppTimezone();
  const { rows } = await db.query(
    `SELECT
       sv.id,
       sv.planned_date,
       sv.city,
       sv.priority,
       sv.notes,
       sv.prospect_name,
       cr.commercial_name AS client_name
     FROM visit_schedules vs
     JOIN scheduled_visits sv
       ON sv.schedule_id = vs.id
     LEFT JOIN client_requests cr
       ON cr.id = sv.client_request_id
     WHERE LOWER(vs.user_email) = LOWER($1)
       AND vs.status = 'approved'
       AND vs.month = $2
       AND vs.year = $3
     ORDER BY sv.planned_date ASC, sv.priority ASC, sv.id ASC`,
    [targetEmail, month, year],
  );

  const events = rows
    .map((visit) => {
      const start = toDateTuple(visit.planned_date);
      if (!start) return null;
      const end = shiftDateTuple(start, 1);
      if (!end) return null;
      const titleBase = getVisitDisplayName(visit);
      const descriptionParts = [
        `Tipo: Visita comercial`,
        `Cliente: ${titleBase}`,
        `Prioridad: ${visit.priority || 1}`,
      ];
      if (visit.notes) {
        descriptionParts.push(`Notas: ${String(visit.notes).trim()}`);
      }

      return {
        uid: `visit-${visit.id}-${year}${String(month).padStart(2, "0")}@famspi`,
        title: `Visita comercial - ${titleBase}`,
        start,
        end,
        startOutputType: "local",
        endOutputType: "local",
        status: "CONFIRMED",
        busyStatus: "BUSY",
        location: String(visit.city || "Sin ciudad definida"),
        description: descriptionParts.join("\n"),
        categories: ["Comercial", "Visitas"],
      };
    })
    .filter(Boolean);

  const icsContent = await createEventsAsync(events);
  const monthLabel = String(month).padStart(2, "0");
  const fileName = `my-calendar-${year}-${monthLabel}.ics`;
  const stream = Readable.from([icsContent], { encoding: "utf8" });
  return { stream, fileName, eventsCount: events.length, month, year };
}

async function optimizeRoute({ scheduleIds, user }) {
  assertCommercial(user);
  const normalizedScheduleIds = normalizeScheduleIds(scheduleIds);
  if (!normalizedScheduleIds.length) {
    const error = new Error("Debes enviar al menos un schedule_id valido para optimizar ruta");
    error.status = 400;
    throw error;
  }

  const { rows: schedules } = await db.query(
    `
      SELECT id, user_email, month, year
      FROM visit_schedules
      WHERE id = ANY($1::int[])
    `,
    [normalizedScheduleIds],
  );

  if (!schedules.length) {
    const error = new Error("No se encontraron cronogramas para los IDs enviados");
    error.status = 404;
    throw error;
  }

  const foundIds = new Set(schedules.map((row) => Number(row.id)));
  const missingIds = normalizedScheduleIds.filter((id) => !foundIds.has(id));
  if (missingIds.length) {
    const error = new Error(`No existen cronogramas para los IDs: ${missingIds.join(", ")}`);
    error.status = 404;
    throw error;
  }

  if (!isManager(user)) {
    const unauthorized = schedules.find(
      (schedule) => String(schedule.user_email || "").toLowerCase() !== String(user.email || "").toLowerCase(),
    );
    if (unauthorized) {
      const error = new Error("No puedes optimizar rutas de cronogramas que no te pertenecen");
      error.status = 403;
      throw error;
    }
  }

  const mapsApiKey = getMapsApiKeyOrThrow();
  const catalogGeoConfig = await getCatalogClientsGeoConfig();
  const requestGeoConfig = await getClientRequestsGeoConfig();

  const catalogJoinClause = catalogGeoConfig
    ? `
      LEFT JOIN public.catalog_clients cc
        ON cc.${quoteIdentifier(catalogGeoConfig.relationColumn)} = sv.client_request_id
    `
    : "";

  const catalogLatSelect = catalogGeoConfig
    ? `cc.${quoteIdentifier(catalogGeoConfig.latitudeColumn)} AS catalog_latitude`
    : `NULL::double precision AS catalog_latitude`;
  const catalogLngSelect = catalogGeoConfig
    ? `cc.${quoteIdentifier(catalogGeoConfig.longitudeColumn)} AS catalog_longitude`
    : `NULL::double precision AS catalog_longitude`;
  const catalogNameSelect = catalogGeoConfig?.nameColumn
    ? `cc.${quoteIdentifier(catalogGeoConfig.nameColumn)}`
    : `NULL`;

  const requestLatSelect = requestGeoConfig
    ? `cr.${quoteIdentifier(requestGeoConfig.latitudeColumn)} AS request_latitude`
    : `NULL::double precision AS request_latitude`;
  const requestLngSelect = requestGeoConfig
    ? `cr.${quoteIdentifier(requestGeoConfig.longitudeColumn)} AS request_longitude`
    : `NULL::double precision AS request_longitude`;

  const { rows: visits } = await db.query(
    `
      SELECT
        sv.id AS visit_id,
        sv.schedule_id,
        sv.client_request_id,
        sv.prospect_name,
        sv.planned_date,
        sv.priority,
        sv.notes,
        sv.city,
        vs.user_email,
        COALESCE(
          ${catalogNameSelect},
          cr.commercial_name,
          NULLIF(TRIM(sv.prospect_name), ''),
          cr.establishment_name,
          cr.shipping_contact_name,
          ('Cliente #' || sv.client_request_id::text)
        ) AS client_name,
        ${catalogLatSelect},
        ${catalogLngSelect},
        ${requestLatSelect},
        ${requestLngSelect},
        cr.shipping_address,
        cr.shipping_city,
        cr.shipping_province,
        cr.establishment_address,
        cr.establishment_city,
        cr.establishment_province
      FROM scheduled_visits sv
      INNER JOIN visit_schedules vs
        ON vs.id = sv.schedule_id
      LEFT JOIN client_requests cr
        ON cr.id = sv.client_request_id
      ${catalogJoinClause}
      WHERE sv.schedule_id = ANY($1::int[])
      ORDER BY sv.planned_date ASC, sv.priority DESC, sv.id ASC
    `,
    [normalizedScheduleIds],
  );

  if (!visits.length) {
    return {
      schedule_ids: normalizedScheduleIds,
      routes_by_date: [],
      total_visits: 0,
      message: "No hay visitas planificadas para optimizar en los cronogramas enviados",
    };
  }

  const groupedByDate = visits.reduce((acc, visit) => {
    const key = String(visit.planned_date || "").slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(visit);
    return acc;
  }, {});

  const routesByDate = [];
  let totalDistanceMeters = 0;
  let totalTravelSeconds = 0;

  for (const [plannedDate, visitsForDate] of Object.entries(groupedByDate)) {
    const mappable = [];
    const excluded = [];

    visitsForDate.forEach((visit) => {
      const location = resolveVisitLocation(visit);
      if (!location) {
        excluded.push({
          visit_id: visit.visit_id,
          schedule_id: visit.schedule_id,
          client_request_id: visit.client_request_id,
          prospect_name: visit.prospect_name,
          client_name: visit.client_name,
          reason: "No existe coordenada ni direccion para la visita",
        });
        return;
      }

      mappable.push({
        visit_id: visit.visit_id,
        schedule_id: visit.schedule_id,
        client_request_id: visit.client_request_id,
        prospect_name: visit.prospect_name,
        client_name: visit.client_name,
        planned_date: String(visit.planned_date || "").slice(0, 10),
        priority: Number(visit.priority || 1),
        notes: visit.notes || null,
        city: visit.city || null,
        ...location,
      });
    });

    if (mappable.length < 2) {
      routesByDate.push({
        planned_date: plannedDate,
        optimized: false,
        reason: "Se requieren al menos 2 visitas geolocalizables para optimizar la ruta",
        ordered_visit_ids: mappable.map((item) => item.visit_id),
        ordered_visits: mappable.map((visit, index) => ({ ...visit, route_order: index + 1 })),
        excluded_visits: excluded,
        segments: [],
        estimated_distance_meters: 0,
        estimated_distance_label: "0 km",
        estimated_travel_time_seconds: 0,
        estimated_travel_time_label: "0 min",
        google_maps_url: buildGoogleMapsDeepLink(mappable),
        waze_url: buildWazeDeepLink(mappable),
      });
       
      continue;
    }

    try {
      const route = await requestGoogleOptimizedRoute(mappable, mapsApiKey);
      const waypointOrder = Array.isArray(route.waypoint_order)
        ? route.waypoint_order
        : mappable.slice(1).map((_, index) => index);
      const orderedStops = [
        mappable[0],
        ...waypointOrder
          .map((waypointIndex) => mappable[Number(waypointIndex) + 1])
          .filter(Boolean),
      ];

      const orderedVisits = orderedStops.map((stop, index) => ({
        ...stop,
        route_order: index + 1,
      }));

      const legs = Array.isArray(route.legs) ? route.legs : [];
      const usableLegs = legs.slice(0, Math.max(orderedVisits.length - 1, 0));
      const segments = usableLegs.map((leg, index) => {
        const from = orderedVisits[index];
        const to = orderedVisits[index + 1];
        const estimatedDistanceMeters = Number(leg?.distance?.value || 0);
        const estimatedTravelSeconds = Number(leg?.duration?.value || 0);
        return {
          segment_order: index + 1,
          from_visit_id: from?.visit_id || null,
          from_client_name: from?.client_name || null,
          to_visit_id: to?.visit_id || null,
          to_client_name: to?.client_name || null,
          estimated_distance_meters: estimatedDistanceMeters,
          estimated_distance_label: leg?.distance?.text || formatDistanceMeters(estimatedDistanceMeters),
          estimated_travel_time_seconds: estimatedTravelSeconds,
          estimated_travel_time_label: leg?.duration?.text || formatDurationSeconds(estimatedTravelSeconds),
        };
      });

      const routeDistanceMeters = segments.reduce(
        (acc, segment) => acc + Number(segment.estimated_distance_meters || 0),
        0,
      );
      const routeTravelSeconds = segments.reduce(
        (acc, segment) => acc + Number(segment.estimated_travel_time_seconds || 0),
        0,
      );

      totalDistanceMeters += routeDistanceMeters;
      totalTravelSeconds += routeTravelSeconds;

      routesByDate.push({
        planned_date: plannedDate,
        optimized: true,
        ordered_visit_ids: orderedVisits.map((item) => item.visit_id),
        ordered_visits: orderedVisits,
        excluded_visits: excluded,
        segments,
        estimated_distance_meters: routeDistanceMeters,
        estimated_distance_label: formatDistanceMeters(routeDistanceMeters),
        estimated_travel_time_seconds: routeTravelSeconds,
        estimated_travel_time_label: formatDurationSeconds(routeTravelSeconds),
        google_maps_url: buildGoogleMapsDeepLink(orderedStops),
        waze_url: buildWazeDeepLink(orderedStops),
      });
    } catch (error) {
      logger.warn(
        {
          error: error.message,
          plannedDate,
          scheduleIds: normalizedScheduleIds,
          stops: mappable.length,
        },
        "No se pudo optimizar ruta diaria en schedules.optimizeRoute",
      );
      routesByDate.push({
        planned_date: plannedDate,
        optimized: false,
        reason: error.message || "No se pudo optimizar la ruta diaria",
        ordered_visit_ids: mappable.map((item) => item.visit_id),
        ordered_visits: mappable.map((visit, index) => ({ ...visit, route_order: index + 1 })),
        excluded_visits: excluded,
        segments: [],
        estimated_distance_meters: 0,
        estimated_distance_label: "0 km",
        estimated_travel_time_seconds: 0,
        estimated_travel_time_label: "0 min",
        google_maps_url: buildGoogleMapsDeepLink(mappable),
        waze_url: buildWazeDeepLink(mappable),
      });
    }
  }

  routesByDate.sort((a, b) => new Date(a.planned_date) - new Date(b.planned_date));

  return {
    schedule_ids: normalizedScheduleIds,
    optimized_by: user.email,
    routes_by_date: routesByDate,
    total_visits: visits.length,
    total_distance_meters: totalDistanceMeters,
    total_distance_label: formatDistanceMeters(totalDistanceMeters),
    total_travel_time_seconds: totalTravelSeconds,
    total_travel_time_label: formatDurationSeconds(totalTravelSeconds),
  };
}

async function getAnalytics(user) {
  assertManager(user);
  const { rows } = await db.query(
    `SELECT status, COUNT(*) AS total FROM visit_schedules GROUP BY status`,
  );
  const byStatus = rows.reduce((acc, row) => ({ ...acc, [row.status]: Number(row.total) }), {});
  const { rows: visits } = await db.query(
    `SELECT city, COUNT(*) AS total FROM scheduled_visits GROUP BY city ORDER BY total DESC LIMIT 10`,
  );
  return { byStatus, topCities: visits };
}

async function findTodayScheduledVisit({ userEmail, clientRequestId, leadId, date }) {
  if (!clientRequestId && !leadId) return null;
  // `date` puede llegar como objeto Date (p.ej. desde un RETURNING de Postgres
  // en attendance.controller.js) o como string "YYYY-MM-DD" (desde clients.service.js).
  // String(dateObj) da formato "Thu Jul 30 2026 ..." -- .slice(0,10) rompía el
  // cast ::date mas abajo y el sync silenciosamente nunca corria para ningun
  // cierre de visita hecho desde Asistencia.
  const normalizedDate = date instanceof Date
    ? date.toISOString().slice(0, 10)
    : String(date || "").slice(0, 10);
  const month = Number(normalizedDate.slice(5, 7));
  const year = Number(normalizedDate.slice(0, 4));
  const params = [String(userEmail || "").toLowerCase(), normalizedDate, month, year];
  const conditions = [
    "LOWER(COALESCE(vs.user_email, '')) = $1",
    "vs.status = 'approved'",
    "(sv.planned_date = $2::date OR (vs.month = $3 AND vs.year = $4))",
  ];
  if (clientRequestId) {
    params.push(clientRequestId);
    conditions.push(`sv.client_request_id = $${params.length}`);
  } else {
    params.push(leadId);
    conditions.push(`sv.lead_id = $${params.length}`);
  }
  const { rows } = await db.query(
    `SELECT sv.id, sv.crm_activity_id
       FROM scheduled_visits sv
       JOIN visit_schedules vs ON vs.id = sv.schedule_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY CASE WHEN sv.planned_date = $2::date THEN 0 ELSE 1 END, sv.planned_date ASC, sv.id ASC
      LIMIT 1`,
    params,
  );
  return rows[0] || null;
}

async function markCrmActivityCompleted(crmActivityId, userId, { visitLogId = null } = {}) {
  if (!crmActivityId) return;
  await db.query(
    `UPDATE crm.crm_activities
        SET status = CASE
              WHEN activity_type = 'visita' THEN 'visited_pending_followup'
              ELSE 'completed'
            END,
            completed_at = CASE
              WHEN activity_type = 'visita' THEN completed_at
              ELSE NOW()
            END,
            visit_log_id = COALESCE($3, visit_log_id),
            updated_by = $2,
            updated_at = NOW()
      WHERE id = $1
        AND status NOT IN ('completed', 'cancelled')`,
    [crmActivityId, userId || null, visitLogId],
  );
}

module.exports = {
  buildGoogleMapsDeepLink,
  listMySchedules,
  getHolidays,
  listPendingApproval,
  listTeamSchedules,
  getScheduleDetail,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  submitForApproval,
  addVisit,
  syncWeekCity,
  updateVisit,
  deleteVisit,
  approveSchedule,
  rejectSchedule,
  justifyVisit,
  optimizeRoute,
  getAnalytics,
  getApprovedScheduleCurrent,
  findApprovedScheduleForMonth,
  getMyCalendarIcsStream,
  findTodayScheduledVisit,
  markCrmActivityCompleted,
};
