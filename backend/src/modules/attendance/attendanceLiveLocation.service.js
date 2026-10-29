const db = require("../../config/db");
const { parseCoordinatePair } = require("./attendanceGeo.utils");
const { getLatestPings } = require("./attendanceLocationPings.service");

/**
 * Ultima ubicacion conocida de quienes estan en salida operacional activa.
 *
 * No hay seguimiento continuo: la posicion es la de la ultima marcacion que
 * guardo coordenadas (inicio, llegada, salida o regreso de la salida; entrada a
 * una visita de cliente o prospecto; almuerzo operacional). Por eso cada punto
 * trae su hora y su origen: nunca debe leerse como "donde esta ahora".
 */

const SOURCE_LABELS = Object.freeze({
  start: "Inicio de la salida",
  arrival: "Llegada al destino",
  departure: "Salida del destino",
  return: "Regreso",
  client_visit_entry: "Entrada a visita de cliente",
  prospect_visit_entry: "Entrada a visita de prospecto",
  op_lunch_start: "Inicio de almuerzo operacional",
  op_lunch_end: "Fin de almuerzo operacional",
  shortcut_ping: "Ubicación enviada por el Atajo",
});

// De mas reciente a mas antiguo dentro del ciclo de la salida.
// La hora del punto es la de la propia marcacion (*_time); *_location_timestamp,
// cuando existe, es la hora en que el dispositivo tomo la lectura y manda sobre ella.
const LIFECYCLE = Object.freeze([
  { source: "return", location: "return_location", at: "return_location_timestamp", fallbackAt: "return_time" },
  { source: "departure", location: "departure_location", at: "departure_location_timestamp", fallbackAt: "departure_time" },
  { source: "arrival", location: "arrival_location", at: "arrival_location_timestamp", fallbackAt: "arrival_time" },
  { source: "start", location: "start_location", at: "start_location_timestamp", fallbackAt: "start_time" },
]);

const toMs = (value) => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

function pointFromPair(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  return parseCoordinatePair({ lat: Number(lat), lng: Number(lng) });
}

/** Elige la posicion mas reciente de una fila de salida activa. */
function pickLatestPosition(row = {}) {
  const candidates = [];
  const add = (source, point, at) => {
    const atMs = toMs(at);
    if (point && atMs !== null) candidates.push({ source, ...point, atMs });
  };

  for (const event of LIFECYCLE) {
    add(event.source, parseCoordinatePair(row[event.location]), row[event.at] || row[event.fallbackAt]);
  }
  add("op_lunch_start", parseCoordinatePair(row.op_lunch_start_location), row.op_lunch_start_time);
  add("op_lunch_end", parseCoordinatePair(row.op_lunch_end_location), row.op_lunch_end_time);
  add("client_visit_entry", pointFromPair(row.client_lat, row.client_lng), row.client_at);
  add("prospect_visit_entry", pointFromPair(row.prospect_lat, row.prospect_lng), row.prospect_at);
  add("shortcut_ping", pointFromPair(row.ping_lat, row.ping_lng), row.ping_at);

  if (!candidates.length) return null;
  const latest = candidates.reduce((best, item) => (item.atMs >= best.atMs ? item : best));
  return {
    lat: latest.lat,
    lng: latest.lng,
    at: new Date(latest.atMs).toISOString(),
    source: latest.source,
    source_label: SOURCE_LABELS[latest.source],
  };
}

async function getLiveMapRows({ operationalTypes }) {
  const { rows } = await db.query(
    `
    SELECT
      ae.id AS exception_id,
      ae.user_id,
      u.email,
      COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email) AS display_name,
      u.role,
      ae.operational_category,
      ae.operational_destination_label,
      ae.operational_destination_city,
      ae.description,
      CASE
        WHEN ae.op_lunch_start_time IS NOT NULL AND ae.op_lunch_end_time IS NULL THEN 'ON_LUNCH'
        ELSE UPPER(COALESCE(ae.status, ''))
      END AS operational_status,
      ae.start_time, ae.arrival_time, ae.departure_time, ae.return_time,
      ae.start_location, ae.start_location_timestamp,
      ae.arrival_location, ae.arrival_location_timestamp,
      ae.departure_location, ae.departure_location_timestamp,
      ae.return_location, ae.return_location_timestamp,
      ae.op_lunch_start_location, ae.op_lunch_start_time,
      ae.op_lunch_end_location, ae.op_lunch_end_time,
      cv.lat_entrada AS client_lat, cv.lng_entrada AS client_lng, cv.hora_entrada AS client_at,
      pv.check_in_lat AS prospect_lat, pv.check_in_lng AS prospect_lng, pv.check_in_time AS prospect_at
    FROM attendance_exceptions ae
    INNER JOIN users u ON u.id = ae.user_id
    LEFT JOIN LATERAL (
      SELECT lat_entrada, lng_entrada, hora_entrada
        FROM client_visit_logs
       WHERE LOWER(COALESCE(user_email, '')) = LOWER(u.email) AND status = 'in_visit'
       ORDER BY hora_entrada DESC NULLS LAST
       LIMIT 1
    ) cv ON TRUE
    LEFT JOIN LATERAL (
      SELECT check_in_lat, check_in_lng, check_in_time
        FROM prospect_visits
       WHERE LOWER(COALESCE(user_email, '')) = LOWER(u.email) AND status = 'in_visit'
       ORDER BY check_in_time DESC NULLS LAST
       LIMIT 1
    ) pv ON TRUE
    WHERE LOWER(COALESCE(ae.type, '')) = ANY($1::text[])
      AND UPPER(COALESCE(ae.status, '')) <> 'COMPLETED'
      AND COALESCE(u.active, TRUE) = TRUE
      -- Teletrabajo no es una salida: su ubicacion no se muestra.
      AND LOWER(COALESCE(ae.operational_category, '')) <> 'teletrabajo'
    ORDER BY display_name ASC
    `,
    [operationalTypes],
  );
  return rows;
}

async function getLiveMap({ operationalTypes, now = Date.now() }) {
  const rows = await getLiveMapRows({ operationalTypes });
  const pings = await getLatestPings(rows.map((row) => row.exception_id));
  return rows.map((baseRow) => {
    const ping = pings.get(Number(baseRow.exception_id));
    const row = ping
      ? { ...baseRow, ping_lat: ping.latitude, ping_lng: ping.longitude, ping_at: ping.recorded_at }
      : baseRow;
    const position = pickLatestPosition(row);
    return {
      row,
      position: position
        ? { ...position, age_minutes: Math.max(0, Math.round((now - new Date(position.at).getTime()) / 60000)) }
        : null,
    };
  });
}

module.exports = { getLiveMap, pickLatestPosition, SOURCE_LABELS };
