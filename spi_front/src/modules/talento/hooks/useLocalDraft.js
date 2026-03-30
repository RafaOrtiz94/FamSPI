import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_PREFIX = "spi:talento:profile-draft";

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const safeSerialize = (value) => {
  try {
    return JSON.stringify(value ?? {});
  } catch (_error) {
    return "{}";
  }
};

const safeParse = (rawValue) => {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.data || typeof parsed.data !== "object") return null;
    return parsed;
  } catch (_error) {
    return null;
  }
};

/**
 * Persistencia local de borradores para formularios largos.
 * Guarda cada N segundos para reducir perdida de informacion ante recargas.
 */
export default function useLocalDraft({
  draftId,
  value,
  intervalMs = 30000,
  enabled = true,
}) {
  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}:${String(draftId || "default")}`,
    [draftId],
  );
  const serializedValue = useMemo(() => safeSerialize(value || {}), [value]);
  const lastSavedSnapshotRef = useRef("");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [draftInfo, setDraftInfo] = useState(null);

  const persistDraft = useCallback(() => {
    if (!enabled || !isBrowser()) return false;
    if (!serializedValue || serializedValue === "{}") return false;
    if (serializedValue === lastSavedSnapshotRef.current) return false;

    const payload = {
      updatedAt: new Date().toISOString(),
      data: value || {},
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
      lastSavedSnapshotRef.current = serializedValue;
      setLastSavedAt(payload.updatedAt);
      return true;
    } catch (_error) {
      return false;
    }
  }, [enabled, serializedValue, storageKey, value]);

  const clearDraft = useCallback(() => {
    if (!isBrowser()) return;
    window.localStorage.removeItem(storageKey);
    setDraftInfo(null);
  }, [storageKey]);

  const restoreDraft = useCallback(() => {
    if (!isBrowser()) return null;
    const parsed = safeParse(window.localStorage.getItem(storageKey));
    if (!parsed?.data) return null;
    return parsed.data;
  }, [storageKey]);

  useEffect(() => {
    if (!enabled || !isBrowser()) return;
    const parsed = safeParse(window.localStorage.getItem(storageKey));
    if (parsed?.data) {
      setDraftInfo(parsed);
      if (parsed.updatedAt) setLastSavedAt(parsed.updatedAt);
    }
  }, [enabled, storageKey]);

  useEffect(() => {
    if (!enabled || !isBrowser()) return undefined;
    persistDraft();
    const interval = window.setInterval(() => {
      persistDraft();
    }, Math.max(Number(intervalMs) || 30000, 10000));
    return () => window.clearInterval(interval);
  }, [enabled, intervalMs, persistDraft]);

  return {
    draftExists: Boolean(draftInfo?.data),
    draftUpdatedAt: draftInfo?.updatedAt || null,
    lastSavedAt,
    persistDraft,
    restoreDraft,
    clearDraft,
  };
}
