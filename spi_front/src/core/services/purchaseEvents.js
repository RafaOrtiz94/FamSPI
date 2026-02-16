import { API_BASE_URL, getAccessToken } from "../api";

const EVENTS_PATH = `${API_BASE_URL}/equipment-purchases/events`;
const MAX_RETRY_DELAY_MS = 60000;

const subscribers = new Set();
let eventSource = null;
let reconnectTimer = null;
let reconnectAttempts = 0;

const notifySubscribers = (payload) => {
  if (!payload) return;
  subscribers.forEach((callback) => {
    try {
      callback(payload);
    } catch (error) {
      console.error("Error en listener de actualizaciones de compras:", error);
    }
  });
};

const scheduleReconnect = () => {
  if (reconnectTimer) return;
  const delay = Math.min(5000 * Math.max(1, reconnectAttempts), MAX_RETRY_DELAY_MS);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectAttempts += 1;
    startEventStream();
  }, delay);
};

const cleanupEventSource = () => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
};

const startEventStream = () => {
  if (eventSource) return;
  if (typeof window === "undefined") return;
  if (!API_BASE_URL) return;
  const token = getAccessToken();
  if (!token) return;

  const url = `${EVENTS_PATH}?token=${encodeURIComponent(token)}`;
  try {
    eventSource = new window.EventSource(url);
  } catch (error) {
    console.warn("No se pudo abrir stream de eventos de compras:", error);
    scheduleReconnect();
    return;
  }

  eventSource.addEventListener("purchase-update", (event) => {
    try {
      const data = JSON.parse(event.data);
      notifySubscribers(data);
    } catch (err) {
      console.warn("Evento de compras inválido:", err);
    }
  });

  eventSource.addEventListener("error", (error) => {
    console.warn("Evento SSE cerrado, reintentando:", error);
    cleanupEventSource();
    scheduleReconnect();
  });

  eventSource.addEventListener("open", () => {
    reconnectAttempts = 0;
    console.info("Conexión a stream de compras establecida");
  });
};

export const subscribeToPurchaseUpdates = (callback) => {
  if (typeof window === "undefined") return () => {};
  subscribers.add(callback);
  startEventStream();
  return () => {
    subscribers.delete(callback);
    if (!subscribers.size) {
      cleanupEventSource();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }
  };
};
