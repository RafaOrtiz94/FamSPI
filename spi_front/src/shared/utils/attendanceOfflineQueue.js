// Cola offline de marcaciones de asistencia sin archivo adjunto.
//
// ponytail: NO cubre marcaciones con foto (salida/cierre operacional con
// vehiculo personal) -- un File/Blob no se puede serializar a localStorage.
// Esas siguen usando el reintento en memoria (boton "Reintentar" en
// AttendanceAction, reintento manual en el widget). Si en el futuro se
// necesita cubrir tambien esas, el camino es IndexedDB (soporta Blob), no
// localStorage.
const QUEUE_STORAGE_KEY = "spi_attendance_offline_queue";
const QUEUE_CHANGED_EVENT = "attendance-offline-queue-changed";

const readQueue = () => {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (items) => {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage lleno o no disponible -- la marca ya se intento en vivo,
    // no hay mucho mas que hacer sin IndexedDB.
  }
  try {
    window.dispatchEvent(new CustomEvent(QUEUE_CHANGED_EVENT, { detail: { size: items.length } }));
  } catch {
    // entorno sin CustomEvent (tests, SSR) -- no bloqueante
  }
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
  window.addEventListener(QUEUE_CHANGED_EVENT, handler);
  return () => window.removeEventListener(QUEUE_CHANGED_EVENT, handler);
};

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

  return { flushed, failed, stillQueued: getQueueSize() };
};
