const CACHE_PREFIX = "spi_pwa_cache:";

const buildKey = (key) => `${CACHE_PREFIX}${key}`;

export const writeCachedResource = (key, data) => {
  try {
    const payload = {
      data,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(buildKey(key), JSON.stringify(payload));
    return payload;
  } catch (_error) {
    return null;
  }
};

export const readCachedResource = (key, { maxAgeMs = null } = {}) => {
  try {
    const raw = localStorage.getItem(buildKey(key));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const cachedAtMs = parsed.cachedAt ? new Date(parsed.cachedAt).getTime() : null;
    const ageMs =
      Number.isFinite(cachedAtMs) && cachedAtMs > 0
        ? Math.max(0, Date.now() - cachedAtMs)
        : null;

    if (Number.isFinite(maxAgeMs) && Number.isFinite(ageMs) && ageMs > maxAgeMs) {
      return {
        ...parsed,
        stale: true,
        ageMs,
      };
    }

    return {
      ...parsed,
      stale: false,
      ageMs,
    };
  } catch (_error) {
    return null;
  }
};

export const clearCachedResource = (key) => {
  try {
    localStorage.removeItem(buildKey(key));
  } catch (_error) {
    // no-op
  }
};
