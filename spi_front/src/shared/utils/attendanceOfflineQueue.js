// Cola offline de marcaciones de asistencia sin archivo adjunto.
//
// ponytail: NO cubre marcaciones con foto (salida/cierre operacional con
// vehiculo personal) -- un File/Blob no se puede serializar a localStorage.
// Esas siguen usando el reintento en memoria (boton "Reintentar" en
// AttendanceAction, reintento manual en el widget). Si en el futuro se
// necesita cubrir tambien esas, el camino es IndexedDB (soporta Blob), no
// localStorage.
import {
  readPwaStorage,
  readPwaStorageData,
  subscribePwaStorageEvent,
  writePwaStorage,
} from "../../core/pwa/storage";

const QUEUE_STORAGE_KEY = "attendance_offline_queue";
const QUEUE_CHANGED_EVENT = "attendance-offline-queue-changed";
const QUEUE_STATUS_STORAGE_KEY = "attendance_offline_queue_status";
const QUEUE_STATUS_CHANGED_EVENT = "attendance-offline-queue-status-changed";

const buildDefaultStatus = () => ({
  pendingCount: 0,
  syncing: false,
  lastFlushAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastResult: null,
  flushedCount: 0,
  failedCount: 0,
});

const readStatus = () => {
  const cached = readPwaStorage(QUEUE_STATUS_STORAGE_KEY, { namespace: "spi_pwa_queue" });
  return cached?.data && typeof cached.data === "object"
    ? { ...buildDefaultStatus(), ...cached.data }
    : buildDefaultStatus();
};

const readQueue = () => {
  const cached = readPwaStorageData(QUEUE_STORAGE_KEY, { namespace: "spi_pwa_queue" });
  return Array.isArray(cached?.data) ? cached.data : [];
};

const writeStatus = (status) => {
  writePwaStorage(QUEUE_STATUS_STORAGE_KEY, status, {
    namespace: "spi_pwa_queue",
    eventName: QUEUE_STATUS_CHANGED_EVENT,
    meta: {
      pendingCount: Number(status?.pendingCount || 0),
      syncing: Boolean(status?.syncing),
      lastResult: status?.lastResult || null,
      flushedCount: Number(status?.flushedCount || 0),
      failedCount: Number(status?.failedCount || 0),
    },
  });
};

const syncStatusWithQueue = (items, partial = {}) => {
  const previous = readStatus();
  writeStatus({
    ...previous,
    pendingCount: items.length,
    ...partial,
  });
};

const writeQueue = (items) => {
  writePwaStorage(QUEUE_STORAGE_KEY, items, {
    namespace: "spi_pwa_queue",
    eventName: QUEUE_CHANGED_EVENT,
    meta: { size: items.length },
  });
  syncStatusWithQueue(items);
};

export const getQueuedMarks = () => readQueue();

export const getQueueSize = () => readQueue().length;

// Evita duplicar una marca: si el mismo endpoint ya tiene una entrada sin
// enviar en la cola, no tiene sentido encolar otra (el usuario probablemente
// volvio a tocar el mismo boton porque la UI no reflejo el primer intento).
export const hasQueuedMarkForEndpoint = (endpoint) =>
  readQueue().some((item) => item.endpoint === endpoint);

export const enqueueOfflineMark = ({ endpoint, payload, label }) => {
  const items = readQueue();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    endpoint,
    payload,
    label: label || endpoint,
    queuedAt: new Date().toISOString(),
  };
  items.push(entry);
  writeQueue(items);
  return entry;
};

export const removeQueuedMark = (id) => {
  const items = readQueue().filter((item) => item.id !== id);
  writeQueue(items);
};

export const clearOfflineQueue = () => writeQueue([]);

export const onOfflineQueueChanged = (handler) => {
  return subscribePwaStorageEvent(QUEUE_CHANGED_EVENT, handler);
};

export const getOfflineQueueSyncStatus = () => readStatus();

export const onOfflineQueueStatusChanged = (handler) =>
  subscribePwaStorageEvent(QUEUE_STATUS_CHANGED_EVENT, handler);

/**
 * Reintenta cada marca encolada, en el orden en que se guardaron (importa:
 * una entrada debe llegar antes que su salida).
 *
 * `post(endpoint, payload)` se inyecta para no crear un ciclo de imports con
 * attendanceApi.js/la instancia de axios.
 *
 * Se detiene en el primer fallo de RED (probablemente sigue sin conexion —
 * seguir intentando las siguientes desordenaria las marcas). Un fallo de
 * SERVIDOR (409/400/etc, la marca ya no aplica) se descarta y se sigue,
 * porque reintentarla no va a cambiar el resultado.
 */
export const flushOfflineQueue = async ({ post }) => {
  const items = readQueue();
  if (!items.length) return { flushed: [], failed: [], stillQueued: 0 };

  const startedAt = new Date().toISOString();
  syncStatusWithQueue(items, {
    syncing: true,
    lastFlushAt: startedAt,
    lastResult: "syncing",
    flushedCount: 0,
    failedCount: 0,
  });

  const flushed = [];
  const failed = [];
  let stoppedEarly = false;

  for (const item of items) {
    if (stoppedEarly) break;
    try {
      await post(item.endpoint, item.payload);
      removeQueuedMark(item.id);
      flushed.push(item);
    } catch (err) {
      const isNetworkError = !err?.response;
      if (isNetworkError) {
        stoppedEarly = true;
        break;
      }
      removeQueuedMark(item.id);
      failed.push({ item, err });
    }
  }

  const completedAt = new Date().toISOString();
  const stillQueued = getQueueSize();
  const previous = readStatus();
  const lastResult =
    failed.length > 0 ? "partial-failure" : stillQueued > 0 ? "deferred" : "success";

  syncStatusWithQueue(readQueue(), {
    syncing: false,
    lastFlushAt: completedAt,
    lastSuccessAt: flushed.length > 0 ? completedAt : previous.lastSuccessAt,
    lastFailureAt: failed.length > 0 || stillQueued > 0 ? completedAt : previous.lastFailureAt,
    lastResult,
    flushedCount: flushed.length,
    failedCount: failed.length,
  });

  return { flushed, failed, stillQueued };
};
