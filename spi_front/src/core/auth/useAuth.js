// src/core/auth/useAuth.js
import { useContext } from "react";
import { AuthContext } from "./AuthContext";

/**
 * Hook global de acceso rápido al contexto de autenticación
 * Incluye atajos comunes como isGerencia(), isTecnico(), etc.
 */
export const useAuth = () => {
  const { user, isAuthenticated, login, logout, refresh, loading } = useContext(AuthContext);

  const role = user?.role?.toLowerCase?.() || "";
  const scope = user?.scope?.toLowerCase?.() || role;

  const isGerencia = scope === "gerencia";
  const isTecnico = scope === "servicio_tecnico";
  const isComercial = scope === "comercial";
  const isFinanzas = scope === "finanzas";
  const isTalento = scope === "talento_humano";
  const isAdmin = scope === "ti" || scope === "admin";

  return {
    user,
    role,
    loading,
    isAuthenticated,
    login,
    logout,
    refresh,
    scope,
    isGerencia,
    isTecnico,
    isComercial,
    isFinanzas,
    isTalento,
    isAdmin,
  };
};
