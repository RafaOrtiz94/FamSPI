import React from "react";
import axios from "axios";
export * from "./signatureApi";

/**
 * ==========================================================
 * 🌐 API centralizada con soporte JWT en headers
 * ----------------------------------------------------------
 * - Usa Authorization: Bearer <accessToken>
 * - Refresca tokens automáticamente con x-refresh-token
 * - Compatible con localStorage (persistente entre sesiones)
 * - Sin cookies, sin CSRF
 * ==========================================================
 */

const DEFAULT_PROD_API_ORIGIN = "https://spi-backend-983537733948.us-central1.run.app";

const normalizeApiBase = (rawValue) => {
  const raw = String(rawValue || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  if (/\/api\/v1$/i.test(raw)) return raw;
  if (/\/api$/i.test(raw)) return `${raw}/v1`;
  return `${raw}/api/v1`;
};

const envBase =
  process.env.REACT_APP_API_ABSOLUTE_URL ||
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  "";

const isLocalhost =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

export const API_BASE_URL = normalizeApiBase(
  envBase || (isLocalhost ? "http://localhost:3001" : DEFAULT_PROD_API_ORIGIN),
);

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false, // ❌ Sin cookies
});

// ==========================================================
// 🔑 Manejo de tokens
// ==========================================================
let accessToken = localStorage.getItem("accessToken") || null;
let refreshToken = localStorage.getItem("refreshToken") || null;
let refreshPromise = null;

/** Guarda tokens en memoria + localStorage */
export const setTokens = (access, refresh) => {
  if (access) {
    accessToken = access;
    localStorage.setItem("accessToken", access);
  }
  if (refresh) {
    refreshToken = refresh;
    localStorage.setItem("refreshToken", refresh);
  }
};

/** Limpia tokens al cerrar sesión */
export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
};

export const getAccessToken = () => accessToken;

const redirectToLogin = () => {
  if (!window.location.pathname.startsWith("/login")) {
    window.location.replace("/login");
  }
};

const handleSessionExpiration = () => {
  try {
    window.dispatchEvent(new CustomEvent("auth:session-expired"));
  } catch (_err) {
    // no-op
  }
  clearTokens();
  redirectToLogin();
};

const refreshAccessTokenSingleFlight = async () => {
  if (!refreshToken) {
    throw new Error("No refresh token");
  }

  if (!refreshPromise) {
    const cleanBaseUrl = API_BASE_URL.replace(/\/$/, "");
    refreshPromise = axios
      .post(
        `${cleanBaseUrl}/auth/refresh`,
        {},
        { headers: { "x-refresh-token": refreshToken } },
      )
      .then((res) => {
        const newAccess = res.data?.accessToken;
        const newRefresh = res.data?.refreshToken || refreshToken;
        if (!newAccess) {
          throw new Error("Refresh sin access token");
        }
        setTokens(newAccess, newRefresh);
        return newAccess;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

// ==========================================================
// 🚀 Interceptor de request — agrega Authorization
// ==========================================================
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ==========================================================
// ♻️ Interceptor de respuesta — refresh automático
// ==========================================================
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config || {};

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      refreshToken &&
      !String(originalRequest.url || "").includes("/auth/refresh")
    ) {
      originalRequest._retry = true;
      try {
        const newAccess = await refreshAccessTokenSingleFlight();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest); // reintenta
      } catch (refreshErr) {
        console.warn("⚠️ Token expirado, requiere login:", refreshErr.message);
        handleSessionExpiration();
        return Promise.reject(refreshErr);
      }
    }

    if (error.response?.status === 401 && accessToken && !refreshToken) {
      console.warn("⚠️ Sesión inválida sin refresh token, redirigiendo a login");
      handleSessionExpiration();
    }

    return Promise.reject(error);
  }
);

api.interceptors.request.use(
  async (config) => {
    if (!accessToken) {
      const stored = localStorage.getItem("accessToken");
      if (stored) accessToken = stored;
    }
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ==========================================================
// 📡 Sistema de Eventos para Actualizaciones Automáticas
// ==========================================================
class EventEmitter {
  constructor() {
    this.events = {};
    this.debounceTimers = new Map();
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`Error in event callback for ${event}:`, err);
      }
    });
  }

  // Método para emitir eventos con debounce (evita loops)
  emitDebounced(event, data, delay = 1000) {
    const key = `${event}:${JSON.stringify(data)}`;

    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }

    const timer = setTimeout(() => {
      this.emit(event, data);
      this.debounceTimers.delete(key);
    }, delay);

    this.debounceTimers.set(key, timer);
  }
}

export const eventEmitter = new EventEmitter();

export const DATA_UPDATE_SCOPES = Object.freeze({
  REQUESTS: "requests",
  CLIENT_REQUESTS: "client-requests",
  ATTENDANCE: "attendance",
  BUSINESS_CASE: "business-case",
  PERMISOS: "permisos",
  VACACIONES: "vacaciones",
  PERSONNEL_REQUESTS: "personnel-requests",
  SCHEDULES: "schedules",
  VIATICOS: "viaticos",
});

const normalizeUpdateUrl = (url = "") =>
  String(url || "")
    .trim()
    .toLowerCase()
    .split("?")[0];

const resolveDataUpdateScopes = (url = "") => {
  const normalized = normalizeUpdateUrl(url);
  const scopes = [];

  if (normalized.includes("/requests/new-client")) {
    scopes.push(DATA_UPDATE_SCOPES.CLIENT_REQUESTS);
  } else if (normalized.includes("/requests")) {
    scopes.push(DATA_UPDATE_SCOPES.REQUESTS);
  }

  if (normalized.includes("/attendance")) scopes.push(DATA_UPDATE_SCOPES.ATTENDANCE);
  if (normalized.includes("/business-case")) scopes.push(DATA_UPDATE_SCOPES.BUSINESS_CASE);
  if (normalized.includes("/permisos")) scopes.push(DATA_UPDATE_SCOPES.PERMISOS);
  if (normalized.includes("/vacaciones")) scopes.push(DATA_UPDATE_SCOPES.VACACIONES);
  if (normalized.includes("/personnel-requests")) scopes.push(DATA_UPDATE_SCOPES.PERSONNEL_REQUESTS);
  if (normalized.includes("/schedules")) scopes.push(DATA_UPDATE_SCOPES.SCHEDULES);
  if (normalized.includes("/viaticos")) scopes.push(DATA_UPDATE_SCOPES.VIATICOS);

  return Array.from(new Set(scopes));
};

export const emitDataUpdate = (scope, payload = {}, delay = 300) => {
  if (!scope) return;
  eventEmitter.emitDebounced(
    "data-updated",
    {
      scope,
      timestamp: Date.now(),
      ...payload,
    },
    delay,
  );
};

const emitResponseDataUpdates = (response) => {
  const method = String(response?.config?.method || "").toLowerCase();
  if (!["post", "put", "patch", "delete"].includes(method)) return;

  const endpoint = normalizeUpdateUrl(response?.config?.url);
  const scopes = resolveDataUpdateScopes(endpoint);
  scopes.forEach((scope) => emitDataUpdate(scope, { endpoint, method }));
};

api.interceptors.response.use(
  (response) => {
    emitResponseDataUpdates(response);
    return response;
  },
  (error) => Promise.reject(error),
);

// ==========================================================
// 🔄 Funciones de actualización automática optimizadas
// ==========================================================

// Cache para evitar requests duplicados
const requestCache = new Map();
const CACHE_DURATION = 30000; // 30 segundos

const getCacheKey = (method, url, params) => {
  return `${method}:${url}:${JSON.stringify(params)}`;
};

const getCachedResponse = (key) => {
  const cached = requestCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  requestCache.delete(key);
  return null;
};

const setCachedResponse = (key, data) => {
  requestCache.set(key, {
    data,
    timestamp: Date.now()
  });

  // Limpiar cache antiguo cada 100 requests
  if (requestCache.size > 100) {
    const keysToDelete = Array.from(requestCache.keys()).slice(0, 20);
    keysToDelete.forEach(key => requestCache.delete(key));
  }
};

// API wrapper con cache inteligente
export const cachedApiCall = async (method, url, config = {}) => {
  const cacheKey = getCacheKey(method, url, config.params || config.data);

  // Solo usar cache para GET requests
  if (method.toLowerCase() === 'get') {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    let response;
    switch (method.toLowerCase()) {
      case 'get':
        response = await api.get(url, config);
        break;
      case 'post':
        response = await api.post(url, config.data, config);
        break;
      case 'put':
        response = await api.put(url, config.data, config);
        break;
      case 'patch':
        response = await api.patch(url, config.data, config);
        break;
      case 'delete':
        response = await api.delete(url, config);
        break;
      default:
        throw new Error(`Método HTTP no soportado: ${method}`);
    }

    // Cachear respuesta exitosa para GET
    if (method.toLowerCase() === 'get' && response.status === 200) {
      setCachedResponse(cacheKey, response);
    }

    // Emitir evento de actualización para componentes suscritos
    if (response.config.url.includes('/requests/') ||
      response.config.url.includes('/attendance/') ||
      response.config.url.includes('/business-case/')) {
      eventEmitter.emitDebounced('data-updated', {
        endpoint: url,
        method,
        timestamp: Date.now()
      });
    }

    return response;
  } catch (error) {
    // En caso de error, invalidar cache
    requestCache.delete(cacheKey);
    throw error;
  }
};

// ==========================================================
// 🔄 Hook personalizado para actualizaciones automáticas
// ==========================================================
let updateIntervalId = null;
const UPDATE_INTERVAL = 30000; // 30 segundos

export const startAutoUpdates = () => {
  if (updateIntervalId) return; // Ya está ejecutándose

  updateIntervalId = setInterval(() => {
    // Emitir evento de polling para componentes que necesiten actualizarse
    eventEmitter.emit('auto-update', { timestamp: Date.now() });
  }, UPDATE_INTERVAL);
};

export const stopAutoUpdates = () => {
  if (updateIntervalId) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }
};

// Hook de React para suscripción a eventos
export const useAutoUpdate = (callback) => {
  const callbackRef = React.useRef(callback);

  React.useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  React.useEffect(() => {
    const handleAutoUpdate = (payload) => {
      if (typeof callbackRef.current === "function") {
        callbackRef.current(payload);
      }
    };
    const unsubscribe = eventEmitter.on('auto-update', handleAutoUpdate);
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    const handleDataUpdate = (payload) => {
      if (typeof callbackRef.current === "function") {
        callbackRef.current(payload);
      }
    };
    const unsubscribe = eventEmitter.on('data-updated', handleDataUpdate);
    return unsubscribe;
  }, []);
};

export const useScopedAutoUpdate = (scopes, callback) => {
  const callbackRef = React.useRef(callback);
  const scopeKey = (Array.isArray(scopes) ? scopes.filter(Boolean) : [scopes].filter(Boolean)).join("|");

  React.useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  React.useEffect(() => {
    const scopeList = scopeKey ? scopeKey.split("|").filter(Boolean) : [];

    const handleAutoUpdate = (payload) => {
      if (typeof callbackRef.current === "function") {
        callbackRef.current(payload);
      }
    };

    const handleDataUpdate = (payload) => {
      const payloadScopes = Array.isArray(payload?.scope)
        ? payload.scope.filter(Boolean)
        : [payload?.scope].filter(Boolean);

      if (!scopeList.length || !payloadScopes.length || payloadScopes.some((scope) => scopeList.includes(scope))) {
        if (typeof callbackRef.current === "function") {
          callbackRef.current(payload);
        }
      }
    };

    const unsubscribeAuto = eventEmitter.on("auto-update", handleAutoUpdate);
    const unsubscribeData = eventEmitter.on("data-updated", handleDataUpdate);

    return () => {
      unsubscribeAuto();
      unsubscribeData();
    };
  }, [scopeKey]);
};

// ==========================================================
// 🔓 Funciones auxiliares globales
// ==========================================================
export const loginWithGoogleResponse = (data) => {
  if (data.accessToken && data.refreshToken) {
    setTokens(data.accessToken, data.refreshToken);
    startAutoUpdates(); // Iniciar actualizaciones automáticas al hacer login
  }
};

export const logout = async () => {
  stopAutoUpdates(); // Detener actualizaciones automáticas al hacer logout
  try {
    await api.post("/auth/logout");
  } catch (err) {
    console.warn("Error cerrando sesión:", err.message);
  } finally {
    clearTokens();
    window.location.href = "/login";
  }
};

export default api;
export const hasRefreshToken = () => Boolean(refreshToken);
