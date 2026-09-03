import { readPwaStorageData, removePwaStorage, writePwaStorage } from "./storage";

export const writeCachedResource = (key, data) => {
  const payload = writePwaStorage(key, data, { namespace: "spi_pwa_cache" });
  if (!payload) return null;
  return {
    data: payload.data,
    cachedAt: payload.savedAt,
  };
};

export const readCachedResource = (key, { maxAgeMs = null } = {}) => {
  const parsed = readPwaStorageData(key, { namespace: "spi_pwa_cache", maxAgeMs });
  if (!parsed) return null;
  return {
    data: parsed.data,
    cachedAt: parsed.savedAt,
    stale: parsed.stale,
    ageMs: parsed.ageMs,
    meta: parsed.meta,
  };
};

export const clearCachedResource = (key) => {
  removePwaStorage(key, { namespace: "spi_pwa_cache" });
};
