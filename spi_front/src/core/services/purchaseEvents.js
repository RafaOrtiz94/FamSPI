import { getAccessToken } from "../api";

const BASE_API_URL = (process.env.REACT_APP_API_ABSOLUTE_URL || "/api/v1").replace(/\/$/, "");
const EVENTS_PATH = `${BASE_API_URL}/equipment-purchases/events`;

const subscribers = new Set();
let eventSource = null;
let reconnectTimer = null;

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
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startEventStream();
  }, 5000);
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
