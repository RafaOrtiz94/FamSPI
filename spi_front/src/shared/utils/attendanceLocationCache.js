import { getPreciseLocation } from "./preciseGeolocation";

const STORAGE_KEY = "attendance_recent_valid_location";
const CACHE_MAX_AGE_MS = 90 * 1000; // fix #20: reduced from 3 min to 90s

const PRECISE_OPTS = Object.freeze({
  desiredAccuracyMeters: 40,
  goodAccuracyMeters: 25,
  highAccuracyTimeoutMs: 7000,
  sampleWindowMs: 4500,
  sampleCount: 2,
});
const EXTENDED_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const QUICK_STAGE_TIMEOUT_MS = 2200;
const PRECISE_STAGE_TIMEOUT_MS = 7500;
const STRATEGY_GUARD_TIMEOUT_MS = 12000;

// Module-level in-memory cache shared across all consumers in the same tab session
let _memCache = null;
let _prewarmWatchId = null;

const isValidCoord = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  !(Math.abs(lat) <= 0.0005 && Math.abs(lng) <= 0.0005) &&
  lat >= -90 && lat <= 90 &&
  lng >= -180 && lng <= 180;

export const readCachedLocation = () => {
  // 1. In-memory first (fastest)
  if (_memCache && Date.now() - _memCache.timestamp <= CACHE_MAX_AGE_MS) {
    return _memCache;
  }
  _memCache = null;

  // 2. localStorage fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lat = Number(parsed?.latitude);
    const lng = Number(parsed?.longitude);
    const ts = Number(parsed?.timestamp || 0);
    if (!isValidCoord(lat, lng)) return null;
    if (!Number.isFinite(ts) || Date.now() - ts > CACHE_MAX_AGE_MS) return null;
    _memCache = { latitude: lat, longitude: lng, accuracy: Number(parsed?.accuracy ?? 0), timestamp: ts, source: parsed?.source || "cached" };
    return _memCache;
  } catch {
    return null;
  }
};

const readCachedLocationExtended = () => {
  if (_memCache && Date.now() - _memCache.timestamp <= EXTENDED_CACHE_MAX_AGE_MS) {
    return { ..._memCache, source: _memCache.source || "cache_extended" };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lat = Number(parsed?.latitude);
    const lng = Number(parsed?.longitude);
    const ts = Number(parsed?.timestamp || 0);
    if (!isValidCoord(lat, lng)) return null;
    if (!Number.isFinite(ts) || Date.now() - ts > EXTENDED_CACHE_MAX_AGE_MS) return null;
    return {
      latitude: lat,
      longitude: lng,
      accuracy: Number(parsed?.accuracy ?? 0),
      timestamp: ts,
      source: "cache_extended",
    };
  } catch {
    return null;
  }
};

export const writeCachedLocation = (payload) => {
  if (!payload) return;
  const lat = Number(payload.latitude);
  const lng = Number(payload.longitude);
  if (!isValidCoord(lat, lng)) return;
  const entry = {
    latitude: lat,
    longitude: lng,
    accuracy: Number.isFinite(Number(payload.accuracy)) ? Number(payload.accuracy) : 0,
    timestamp: payload.timestamp || Date.now(),
    source: payload.source || "gps",
  };
  _memCache = entry;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage unavailable — in-memory cache still works
  }
};

export const invalidateLocationCache = () => {
  _memCache = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
};

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("GPS_STRATEGY_TIMEOUT")), ms);
    Promise.resolve(promise)
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });

const getBrowserLocation = ({ highAccuracy = false, timeoutMs = 6000, maximumAgeMs = 5 * 60 * 1000 } = {}) =>
  new Promise((resolve) => {
    if (!navigator?.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Number(pos.coords.accuracy || 0),
          timestamp: Date.now(),
          source: highAccuracy ? "browser_high_accuracy" : "browser_quick",
        }),
      () => resolve(null),
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: maximumAgeMs },
    );
  });

const getBrowserFallback = ({ highAccuracy = false, timeoutMs = 6000 } = {}) =>
  getBrowserLocation({ highAccuracy, timeoutMs, maximumAgeMs: 5 * 60 * 1000 });

export const startLocationPrewarm = () => {
  if (_prewarmWatchId !== null) return;
  if (!navigator?.geolocation) return;

  _prewarmWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const lat = Number(pos?.coords?.latitude);
      const lng = Number(pos?.coords?.longitude);
      if (!isValidCoord(lat, lng)) return;
      writeCachedLocation({
        latitude: lat,
        longitude: lng,
        accuracy: Number(pos?.coords?.accuracy || 0),
        timestamp: Date.now(),
        source: "prewarm_watch",
      });
    },
    () => {
      // ignore prewarm failures; marking flow has its own fallbacks
    },
    {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 30 * 1000,
    },
  );
};

export const stopLocationPrewarm = () => {
  if (_prewarmWatchId !== null && navigator?.geolocation) {
    navigator.geolocation.clearWatch(_prewarmWatchId);
  }
  _prewarmWatchId = null;
};

/**
 * Shared GPS-fetch-with-cache for all attendance marking surfaces.
 * fix #11: replaces duplicated logic in AttendanceWidget and AttendanceAction.
 */
export const getLocationForAction = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh) {
    const cached = readCachedLocation();
    if (cached) return cached;
  }

  const strategies = [
    async () => getBrowserLocation({ highAccuracy: false, timeoutMs: QUICK_STAGE_TIMEOUT_MS, maximumAgeMs: 20 * 1000 }),
    async () => {
      let lastError = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const result = await withTimeout(getPreciseLocation(PRECISE_OPTS), PRECISE_STAGE_TIMEOUT_MS);
          const lat = Number(result?.latitude);
          const lng = Number(result?.longitude);
          if (!isValidCoord(lat, lng)) throw new Error("GPS_SIN_COORDENADAS");
          return {
            latitude: lat,
            longitude: lng,
            accuracy: Number(result?.accuracy || 0),
            timestamp: Date.now(),
            source: result?.source || "gps_precise",
          };
        } catch (err) {
          lastError = err;
          if (attempt < 2) await new Promise((r) => setTimeout(r, 900));
        }
      }
      throw lastError || new Error("GPS_PRECISE_FAILED");
    },
    async () => getBrowserFallback({ highAccuracy: true, timeoutMs: 8000 }),
    async () => getBrowserFallback({ highAccuracy: false, timeoutMs: 7000 }),
    async () => readCachedLocation(),
    async () => readCachedLocationExtended(),
  ];

  let lastError = null;
  for (const strategy of strategies) {
    try {
      const candidate = await withTimeout(strategy(), STRATEGY_GUARD_TIMEOUT_MS);
      const lat = Number(candidate?.latitude);
      const lng = Number(candidate?.longitude);
      if (!candidate || !isValidCoord(lat, lng)) {
        throw new Error("GPS_INVALID_CANDIDATE");
      }
      const payload = {
        latitude: lat,
        longitude: lng,
        accuracy: Number(candidate?.accuracy || 0),
        timestamp: Number(candidate?.timestamp || Date.now()),
        source: candidate?.source || "gps_fallback",
      };
      writeCachedLocation(payload);
      return payload;
    } catch (err) {
      lastError = err;
    }
  }

  const err = new Error("Ubicacion obligatoria. No se pudo obtener GPS tras multiples metodos de fallback.");
  err.cause = lastError;
  throw err;
};
