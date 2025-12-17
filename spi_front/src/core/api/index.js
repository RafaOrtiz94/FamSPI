import React from "react";
import axios from "axios";

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

const api = axios.create({
  baseURL: "/api/v1", // Proxy configurado en setupProxy.js
  withCredentials: false, // ❌ Sin cookies
});

// ==========================================================
// 🔑 Manejo de tokens
// ==========================================================
let accessToken = localStorage.getItem("accessToken") || null;
let refreshToken = localStorage.getItem("refreshToken") || null;

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

const redirectToLogin = () => {
  if (!window.location.pathname.startsWith("/login")) {
    window.location.replace("/login");
  }
};

const handleSessionExpiration = () => {
  clearTokens();
  redirectToLogin();
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
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      refreshToken &&
      !originalRequest.url.includes("/auth/refresh")
    ) {
      originalRequest._retry = true;
      try {
        const res = await axios.post(
          "/api/v1/auth/refresh",
          {},
          {
            headers: { "x-refresh-token": refreshToken },
          }
        );

        const newAccess = res.data?.accessToken;
        const newRefresh = res.data?.refreshToken || refreshToken;

        if (newAccess) {
          setTokens(newAccess, newRefresh);
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return api(originalRequest); // reintenta
        }
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
export const useAutoUpdate = (callback, dependencies = []) => {
  React.useEffect(() => {
    const unsubscribe = eventEmitter.on('auto-update', callback);
    return unsubscribe;
  }, dependencies);

  React.useEffect(() => {
    const unsubscribe = eventEmitter.on('data-updated', callback);
    return unsubscribe;
  }, dependencies);
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
