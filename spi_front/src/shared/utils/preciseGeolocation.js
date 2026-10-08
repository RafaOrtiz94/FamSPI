const DEFAULT_PRECISION_CONFIG = Object.freeze({
  desiredAccuracyMeters: 30,
  goodAccuracyMeters: 18,
  highAccuracyTimeoutMs: 6500,
  sampleWindowMs: 4200,
  sampleCount: 2,
  quickCoarseTimeoutMs: 2200,
});

const hasGeo = () =>
  typeof navigator !== "undefined" && navigator?.geolocation;

const toLocationString = (coords) =>
  `${Number(coords.latitude).toFixed(8)},${Number(coords.longitude).toFixed(8)}`;

const asPoint = (position, source) => ({
  location: toLocationString(position.coords),
  latitude: Number(position.coords.latitude),
  longitude: Number(position.coords.longitude),
  accuracy: Number(position.coords.accuracy),
  timestamp: Number(position.timestamp || Date.now()),
  source,
});

const getCurrentPosition = (options) =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

const getCurrentPositionSafe = async (options = {}) => {
  try {
    return await getCurrentPosition(options);
  } catch {
    return null;
  }
};

const sampleBestPosition = (config) =>
  new Promise((resolve, reject) => {
    const points = [];
    let watchId = null;
    let finished = false;

    const stop = () => {
      if (watchId !== null && hasGeo()) {
        navigator.geolocation.clearWatch(watchId);
      }
    };

    const finalize = (result, shouldReject = false) => {
      if (finished) return;
      finished = true;
      stop();
      if (shouldReject) {
        reject(result);
      } else {
        resolve(result);
      }
    };

    const timeout = setTimeout(() => {
      const best = points.sort((a, b) => a.accuracy - b.accuracy)[0] || null;
      clearTimeout(timeout);
      if (best) {
        finalize(best);
      } else {
        finalize(new Error("No se obtuvo muestra de geolocalizacion"), true);
      }
    }, config.sampleWindowMs);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point = asPoint(position, "watch");
        points.push(point);
        const best = points.sort((a, b) => a.accuracy - b.accuracy)[0];

        if (
          points.length >= config.sampleCount ||
          best.accuracy <= config.goodAccuracyMeters
        ) {
          clearTimeout(timeout);
          finalize(best);
        }
      },
      (error) => {
        clearTimeout(timeout);
        finalize(error, true);
      },
      {
        enableHighAccuracy: true,
        timeout: config.sampleWindowMs,
        maximumAge: 0,
      }
    );
  });

export const getPreciseLocation = async (overrides = {}) => {
  if (!hasGeo()) {
    return null;
  }

  const config = { ...DEFAULT_PRECISION_CONFIG, ...overrides };

  // Fast coarse fallback in parallel so UX is not blocked on strict GPS locks.
  const quickCoarsePromise = getCurrentPositionSafe({
    enableHighAccuracy: false,
    timeout: config.quickCoarseTimeoutMs,
    maximumAge: 60 * 1000,
  }).then((pos) => (pos ? asPoint(pos, "quick_coarse") : null));

  try {
    const first = await getCurrentPosition({
      enableHighAccuracy: true,
      timeout: config.highAccuracyTimeoutMs,
      maximumAge: 0,
    });
    const firstPoint = asPoint(first, "current");

    if (firstPoint.accuracy <= config.desiredAccuracyMeters) {
      return firstPoint;
    }

    try {
      const sampled = await sampleBestPosition(config);
      return sampled.accuracy < firstPoint.accuracy ? sampled : firstPoint;
    } catch {
      return firstPoint;
    }
  } catch (initialError) {
    const quickCoarse = await quickCoarsePromise;
    if (quickCoarse) return quickCoarse;
    try {
      return await sampleBestPosition(config);
    } catch {
      throw initialError;
    }
  }
};
