// src/core/auth/AuthContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  getProfile,
  refreshAccessToken,
  logout,
  hasRefreshToken,
} from "../api/authApi";

/**
 * ============================================================
 * 🌐 AuthContext
 * ------------------------------------------------------------
 * - Mantiene el estado global de autenticación.
 * - Gestiona tokens, sesión y datos del usuario.
 * - Expone métodos login(), logout(), refresh().
 * ============================================================
 */
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const sessionTimerRef = useRef(null);

  const redirectToLogin = () => {
    if (!window.location.pathname.startsWith("/login")) {
      window.location.replace("/login");
    }
  };

  const clearSessionTimer = () => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
  };

  const decodeJwtExp = (token) => {
    try {
      const [, payload] = token.split(".");
      if (!payload) return null;
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      return decoded?.exp ? Number(decoded.exp) : null;
    } catch (err) {
      return null;
    }
  };

  const scheduleSessionExpiry = async () => {
    clearSessionTimer();
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) return;

    const exp = decodeJwtExp(accessToken);
    if (!exp) return;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const delayMs = Math.max((exp - nowSeconds) * 1000, 0);

    if (delayMs === 0) {
      try {
        if (hasRefreshToken()) {
          await refreshAccessToken();
          scheduleSessionExpiry();
          return;
        }
      } catch (err) {
        // fall through
      }
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      redirectToLogin();
      return;
    }

    sessionTimerRef.current = setTimeout(async () => {
      try {
        if (hasRefreshToken()) {
          await refreshAccessToken();
          scheduleSessionExpiry();
          return;
        }
      } catch (err) {
        // ignore and redirect
      }
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      redirectToLogin();
    }, delayMs);
  };

  /* ============================================================
     🚀 Sincronizar sesión desde tokens locales o refresh
  ============================================================ */
  const refresh = async () => {
    console.log("🧭 AuthContext.refresh start", {
      hasRefreshToken: hasRefreshToken(),
      hasAccessToken: Boolean(localStorage.getItem("accessToken")),
      hasUser: Boolean(localStorage.getItem("user")),
    });
    if (!hasRefreshToken()) {
      setLoading(false);
      return false;
    }

    try {
      const newAccess = await refreshAccessToken();
      if (!newAccess) return false;

      const profile = await getProfile();
      setUser(profile);
      setIsAuthenticated(true);
      localStorage.setItem("user", JSON.stringify(profile));
      console.log("✅ AuthContext.refresh profile set", {
        email: profile?.email,
        role: profile?.role,
        scope: profile?.scope,
      });
      scheduleSessionExpiry();

      console.log(`✅ Sesión sincronizada: ${profile.email}`);
      return profile; // 👈 importante
    } catch (err) {
      console.warn("⚠️ No se pudo sincronizar sesión:", err.message);
      setIsAuthenticated(false);
      console.warn("⚠️ AuthContext.refresh failed", err);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      redirectToLogin();
      return false;
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     🧹 Cerrar sesión
  ============================================================ */
  const signOut = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("❌ Error cerrando sesión:", err);
    } finally {
      clearSessionTimer();
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem("user");
      redirectToLogin();
      console.log("👋 Sesión finalizada correctamente");
    }
  };

  const reloadProfile = async () => {
    try {
      const profile = await getProfile();
      setUser(profile);
      setIsAuthenticated(true);
      localStorage.setItem("user", JSON.stringify(profile));
      return profile;
    } catch (err) {
      // Silent error
      return null;
    }
  };

  /* ============================================================
     🔄 Verificar sesión al cargar la app
  ============================================================ */
  useEffect(() => {
    const init = async () => {
      const storedUser = localStorage.getItem("user");
      console.log("🧭 AuthContext.init", {
        storedUser: Boolean(storedUser),
        accessToken: Boolean(localStorage.getItem("accessToken")),
        refreshToken: Boolean(localStorage.getItem("refreshToken")),
      });
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
        setLoading(false);
        // Sincronizar en segundo plano para actualizar avatar/datos
        refresh();
        scheduleSessionExpiry();
      } else {
        await refresh();
      }
    };
    init();
    return () => clearSessionTimer();
  }, []);

  // ✅ Alias esperados por otros componentes
  const login = refresh;
  const logoutFn = signOut;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        refresh,
        reloadProfile,
        login,
        logout: logoutFn, // alias usado por Header y navegación
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * ============================================================
 * 🧠 Hook de acceso rápido
 * ------------------------------------------------------------
 * Permite obtener user, login, logout, etc. desde cualquier parte.
 * ============================================================
 */
export const useAuth = () => useContext(AuthContext);
