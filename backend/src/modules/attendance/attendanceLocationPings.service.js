const db = require("../../config/db");
const logger = require("../../config/logger");
const { parseCoordinatePair } = require("./attendanceGeo.utils");

/**
 * Ubicaciones periodicas enviadas por el Atajo de iPhone.
 *
 * El Atajo corre en el telefono a horas fijas, tenga o no una salida operacional
 * la persona. Para que eso no despierte ni cargue la base de datos:
 *   - quien tiene salida activa se resuelve desde una lista en memoria, renovada
 *     con UNA consulta cada ACTIVE_CACHE_TTL_MS; un ping sin salida no toca la base;
 *   - con salida activa se guarda como maximo un punto por persona cada
 *     MIN_STORE_INTERVAL_MS (los demas se descartan en memoria);
 *   - los puntos viejos se borran solos (RETENTION_DAYS).
 */

const ACTIVE_CACHE_TTL_MS = 2 * 60 * 1000;
const MIN_STORE_INTERVAL_MS = 4 * 60 * 1000;
const RETENTION_DAYS = Number(process.env.ATTENDANCE_LOCATION_PINGS_RETENTION_DAYS) || 30;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const UNDEFINED_TABLE = "42P01";

// ponytail: cache por instancia. Con varias instancias cada una hace su propia
// consulta cada 2 min y una salida recien iniciada tarda hasta 2 min en verse;
// si eso pesa, invalidar al marcar inicio/cierre o mover la lista a Redis.
let activeByUser = new Map();
let activeLoadedAt = 0;
let activeLoading = null;
const lastStoredAt = new Map();
let lastCleanupAt = 0;

async function loadActiveExceptions(operationalTypes) {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (user_id) user_id, id
       FROM attendance_exceptions
      WHERE LOWER(COALESCE(type, '')) = ANY($1::text[])
        AND UPPER(COALESCE(status, '')) <> 'COMPLETED'
        AND LOWER(COALESCE(operational_category, '')) <> 'teletrabajo'
      ORDER BY user_id, id DESC`,
    [operationalTypes],
  );
  return new Map(rows.map((row) => [Number(row.user_id), Number(row.id)]));
}

async function getActiveExceptionId(userId, operationalTypes, now = Date.now()) {
  if (now - activeLoadedAt > ACTIVE_CACHE_TTL_MS) {
    // Una sola consulta aunque lleguen muchos pings a la vez.
    activeLoading = activeLoading || loadActiveExceptions(operationalTypes)
      .then((map) => { activeByUser = map; activeLoadedAt = now; })
      .finally(() => { activeLoading = null; });
    await activeLoading;
  }
  return activeByUser.get(Number(userId)) || null;
}

function cleanupOldPings(now) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  db.query(
    `DELETE FROM attendance_location_pings WHERE recorded_at < NOW() - ($1::int * INTERVAL '1 day')`,
    [RETENTION_DAYS],
  ).catch((error) => logger.warn({ error: error?.message }, "No se pudieron depurar ubicaciones antiguas"));
}

/**
 * Registra un ping. Nunca lanza por datos del telefono: el Atajo corre sin que
 * nadie lo mire y un error solo generaria avisos inutiles en el iPhone.
 */
async function recordPing({ userId, location, accuracy, operationalTypes, now = Date.now() }) {
  // Number(null) es 0: sin este filtro un cuerpo vacio se guardaria como el punto 0,0.
  const blank = (value) => value === null || value === undefined || value === "";
  const incomplete = location && typeof location === "object" && (blank(location.lat) || blank(location.lng));
  const point = incomplete ? null : parseCoordinatePair(location);
  if (!point) return { tracking: false, stored: false, reason: "invalid_location" };

  let exceptionId;
  try {
    exceptionId = await getActiveExceptionId(userId, operationalTypes, now);
  } catch (error) {
    logger.warn({ error: error?.message }, "No se pudo resolver salidas operacionales activas");
    return { tracking: false, stored: false, reason: "unavailable" };
  }
  if (!exceptionId) return { tracking: false, stored: false, reason: "no_active_exit" };

  const key = Number(userId);
  if (now - (lastStoredAt.get(key) || 0) < MIN_STORE_INTERVAL_MS) {
    return { tracking: true, stored: false, reason: "too_soon" };
  }

  const accuracyMeters = Number(accuracy);
  try {
    await db.query(
      `INSERT INTO attendance_location_pings (user_id, exception_id, latitude, longitude, accuracy_meters)
       VALUES ($1, $2, $3, $4, $5)`,
      [key, exceptionId, point.lat, point.lng, Number.isFinite(accuracyMeters) && accuracyMeters >= 0 ? accuracyMeters : null],
    );
  } catch (error) {
    // Migracion 312 sin aplicar: el Atajo no debe fallar por eso.
    if (error.code === UNDEFINED_TABLE) return { tracking: true, stored: false, reason: "not_ready" };
    logger.warn({ error: error?.message, userId: key }, "No se pudo guardar la ubicacion del Atajo");
    return { tracking: true, stored: false, reason: "unavailable" };
  }
  lastStoredAt.set(key, now);
  cleanupOldPings(now);
  return { tracking: true, stored: true };
}

/** Ultimo punto por salida, para el mapa. Sin la tabla devuelve vacio. */
async function getLatestPings(exceptionIds) {
  const ids = [...new Set((exceptionIds || []).map(Number).filter(Number.isFinite))];
  const latest = new Map();
  if (!ids.length) return latest;
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT ON (exception_id) exception_id, latitude, longitude, accuracy_meters, recorded_at
         FROM attendance_location_pings
        WHERE exception_id = ANY($1::int[])
        ORDER BY exception_id, recorded_at DESC`,
      [ids],
    );
    rows.forEach((row) => latest.set(Number(row.exception_id), row));
  } catch (error) {
    if (error.code !== UNDEFINED_TABLE) throw error;
  }
  return latest;
}

function resetForTests() {
  activeByUser = new Map();
  activeLoadedAt = 0;
  activeLoading = null;
  lastStoredAt.clear();
  lastCleanupAt = 0;
}

module.exports = { recordPing, getLatestPings, MIN_STORE_INTERVAL_MS, ACTIVE_CACHE_TTL_MS, __resetForTests: resetForTests };
