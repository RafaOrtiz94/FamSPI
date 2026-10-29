const db = require("../../config/db");

const DEFAULT_RADIUS_METERS = Number(process.env.ATTENDANCE_GEOFENCE_RADIUS_METERS || 200);
const LEARNING_THRESHOLD = Number(process.env.ATTENDANCE_GEOFENCE_LEARNING_THRESHOLD || 5);

const toRad = (value) => (Number(value) * Math.PI) / 180;
const haversineMeters = ({ lat1, lon1, lat2, lon2 }) => {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const parseLatLng = (value) => {
  if (!value) return null;
  const parts = String(value).split(",");
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]?.trim());
  const lng = Number(parts[1]?.trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
};

const upsertLearningPoint = async ({ scopeType, scopeId, location, sourceContext = null }) => {
  const parsed = parseLatLng(location);
  if (!parsed) return null;

  const existingRes = await db.query(
    `SELECT * FROM attendance_geofence_reference_points WHERE scope_type = $1 AND scope_id = $2 LIMIT 1`,
    [scopeType, String(scopeId)],
  ).catch(() => ({ rows: [] }));

  const existing = existingRes.rows[0];
  if (!existing) {
    const created = await db.query(
      `INSERT INTO attendance_geofence_reference_points (
        scope_type, scope_id, latitude, longitude, radius_meters, sample_count, status, learned_from
      ) VALUES ($1,$2,$3,$4,$5,1,'learning',$6::jsonb)
      RETURNING *`,
      [scopeType, String(scopeId), parsed.lat, parsed.lng, DEFAULT_RADIUS_METERS, JSON.stringify(sourceContext || {})],
    ).catch(() => ({ rows: [] }));
    return created.rows[0] || null;
  }

  const currentSamples = Number(existing.sample_count || 1);
  const nextSamples = currentSamples + 1;
  const nextLat = ((Number(existing.latitude) * currentSamples) + parsed.lat) / nextSamples;
  const nextLng = ((Number(existing.longitude) * currentSamples) + parsed.lng) / nextSamples;
  const nextStatus = existing.status === "official" ? "official" : (nextSamples >= LEARNING_THRESHOLD ? "official" : "learning");

  const updated = await db.query(
    `UPDATE attendance_geofence_reference_points
        SET latitude = $3,
            longitude = $4,
            sample_count = $5,
            status = $6,
            promoted_to_official_at = CASE WHEN $6 = 'official' AND promoted_to_official_at IS NULL THEN NOW() ELSE promoted_to_official_at END,
            updated_at = NOW()
      WHERE scope_type = $1 AND scope_id = $2
      RETURNING *`,
    [scopeType, String(scopeId), nextLat, nextLng, nextSamples, nextStatus],
  ).catch(() => ({ rows: [] }));

  return updated.rows[0] || null;
};

const validateLocationAgainstOfficialGeofence = async ({ scopeType, scopeId, location }) => {
  const parsed = parseLatLng(location);
  if (!parsed) return { ok: false, code: "LOCATION_INVALID_COORDINATES", distanceMeters: null };

  const referenceRes = await db.query(
    `SELECT * FROM attendance_geofence_reference_points
      WHERE scope_type = $1 AND scope_id = $2 AND status = 'official'
      LIMIT 1`,
    [scopeType, String(scopeId)],
  ).catch(() => ({ rows: [] }));

  const reference = referenceRes.rows[0];
  if (!reference) {
    return { ok: true, code: "GEOFENCE_OFFICIAL_NOT_READY", distanceMeters: null, enforced: false };
  }

  const distanceMeters = haversineMeters({
    lat1: Number(reference.latitude),
    lon1: Number(reference.longitude),
    lat2: parsed.lat,
    lon2: parsed.lng,
  });

  const allowedRadius = Number(reference.radius_meters || DEFAULT_RADIUS_METERS || 200);
  if (distanceMeters > allowedRadius) {
    return {
      ok: false,
      code: "LOCATION_OUTSIDE_GEOFENCE",
      distanceMeters: Number(distanceMeters.toFixed(2)),
      allowedRadiusMeters: allowedRadius,
      enforced: true,
    };
  }

  return {
    ok: true,
    code: "LOCATION_WITHIN_GEOFENCE",
    distanceMeters: Number(distanceMeters.toFixed(2)),
    allowedRadiusMeters: allowedRadius,
    enforced: true,
  };
};

module.exports = {
  DEFAULT_RADIUS_METERS,
  LEARNING_THRESHOLD,
  parseLatLng,
  upsertLearningPoint,
  validateLocationAgainstOfficialGeofence,
};
