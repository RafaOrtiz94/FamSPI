const DEFAULT_NAMESPACE = "spi_pwa";

const buildQualifiedKey = (key, namespace = DEFAULT_NAMESPACE) => `${namespace}:${key}`;

const safeNowIso = () => new Date().toISOString();

const readStorage = (key, { namespace = DEFAULT_NAMESPACE } = {}) => {
  try {
    const raw = localStorage.getItem(buildQualifiedKey(key, namespace));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
};

const emitStorageEvent = (eventName, detail) => {
  try {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  } catch (_error) {
    // Entorno sin window/CustomEvent: no bloquea la funcionalidad local.
  }
};

export const writePwaStorage = (
  key,
  data,
  { namespace = DEFAULT_NAMESPACE, eventName = null, meta = {} } = {},
) => {
  try {
    const payload = {
      data,
      savedAt: safeNowIso(),
      meta: meta && typeof meta === "object" ? meta : {},
    };
    localStorage.setItem(buildQualifiedKey(key, namespace), JSON.stringify(payload));
    if (eventName) {
      emitStorageEvent(eventName, {
        key,
        namespace,
        data,
        meta: payload.meta,
        ...(payload.meta || {}),
      });
    }
    return payload;
  } catch (_error) {
    return null;
  }
};

export const readPwaStorage = (key, options = {}) => readStorage(key, options);

export const readPwaStorageData = (
  key,
  { namespace = DEFAULT_NAMESPACE, maxAgeMs = null } = {},
) => {
  const parsed = readStorage(key, { namespace });
  if (!parsed) return null;

  const savedAtMs = parsed.savedAt ? new Date(parsed.savedAt).getTime() : null;
  const ageMs =
    Number.isFinite(savedAtMs) && savedAtMs > 0
      ? Math.max(0, Date.now() - savedAtMs)
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
};

export const removePwaStorage = (
  key,
  { namespace = DEFAULT_NAMESPACE, eventName = null } = {},
) => {
  try {
    localStorage.removeItem(buildQualifiedKey(key, namespace));
    if (eventName) {
      emitStorageEvent(eventName, { key, namespace, removed: true });
    }
    return true;
  } catch (_error) {
    return false;
  }
};

export const subscribePwaStorageEvent = (eventName, handler) => {
  window.addEventListener(eventName, handler);
  return () => window.removeEventListener(eventName, handler);
};
