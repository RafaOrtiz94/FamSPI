// src/core/auth/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
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

  /* ============================================================
     🚀 Sincronizar sesión desde tokens locales o refresh
  ============================================================ */
const refresh = async () => {
  if (!hasRefreshToken()) {
    console.warn("⚠️ No se pudo sincronizar sesión: No hay refresh token");
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

    console.log(`✅ Sesión sincronizada: ${profile.email}`);
    return profile; // 👈 importante
  } catch (err) {
    console.warn("⚠️ No se pudo sincronizar sesión:", err.message);
    setIsAuthenticated(false);
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
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem("user");
      console.log("👋 Sesión finalizada correctamente");
    }
  };

  /* ============================================================
     🔄 Verificar sesión al cargar la app
  ============================================================ */
  useEffect(() => {
    const init = async () => {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
        setLoading(false);
      } else {
        await refresh();
      }
    };
    init();
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
