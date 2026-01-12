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
          "/auth/refresh",
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
// 🔓 Funciones auxiliares globales
// ==========================================================
export const loginWithGoogleResponse = (data) => {
  if (data.accessToken && data.refreshToken) {
    setTokens(data.accessToken, data.refreshToken);
  }
};

export const logout = async () => {
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
