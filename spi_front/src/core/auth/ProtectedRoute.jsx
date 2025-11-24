import React, { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useUI } from "../ui/UIContext";

/**
 * ============================================================
 * 🔒 ProtectedRoute — Protección global por token y rol
 * ------------------------------------------------------------
 * - Verifica si el usuario está autenticado y su rol es válido.
 * - Usa AuthContext (controla JWT + perfil).
 * - Muestra mensajes solo una vez (evita loops).
 * - Redirige automáticamente según permisos.
 * ============================================================
 */
export const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const { showToast } = useUI();
  const toastShownRef = useRef(false);
  const lopdpToastShownRef = useRef(false);
  const location = useLocation();
  const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
  const userRole = (user?.role || "").toLowerCase();
  const userScope = (user?.scope || userRole).toLowerCase();
  const hasPermission =
    normalizedAllowed.length === 0 ||
    normalizedAllowed.includes(userScope) ||
    normalizedAllowed.includes(userRole) ||
    userScope === "gerencia" ||
    userRole === "gerencia";
  const lopdpPending = (user?.lopdp_internal_status || "").toLowerCase() !== "granted";

  useEffect(() => {
    if (loading || toastShownRef.current) return;

    if (!isAuthenticated) {
      showToast("Debes iniciar sesión primero.", "warning");
      toastShownRef.current = true;
    } else if (
      isAuthenticated &&
      !hasPermission
    ) {
      showToast("No tienes permisos para acceder a esta sección.", "error");
      toastShownRef.current = true;
    } else if (lopdpPending && !lopdpToastShownRef.current) {
      showToast("Debes firmar el acuerdo interno de datos para continuar.", "warning");
      lopdpToastShownRef.current = true;
    }
  }, [loading, isAuthenticated, hasPermission, showToast, lopdpPending]);

  // 🕐 Mientras se verifica sesión
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
        <div className="animate-spin h-10 w-10 rounded-full border-4 border-blue-600 border-t-transparent mb-3"></div>
        <p className="text-sm font-medium">Verificando sesión...</p>
      </div>
    );
  }

  // 🚫 Si no está autenticado y no está en rutas públicas
  if (
    !isAuthenticated &&
    !["/login", "/login/callback"].includes(location.pathname)
  ) {
    console.warn("🚫 Usuario no autenticado, redirigiendo a /login");
    return <Navigate to="/login" replace />;
  }

  // 🎫 Validar roles permitidos
  if (isAuthenticated && !hasPermission && normalizedAllowed.length > 0) {
    console.warn(`🚫 Acceso denegado. Rol actual: ${userRole}`);
    return <Navigate to="/unauthorized" replace />;
  }

  // ✅ Acceso permitido
  return <Outlet />;
};

/**
 * ============================================================
 * 🔀 RoleRedirect — Redirige automáticamente al dashboard correcto
 * ------------------------------------------------------------
 * - Detecta el rol actual desde el contexto Auth.
 * - Usa el mapeo de roles → rutas configurado en AppRoutes.jsx.
 * ============================================================
 */
export const RoleRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Cargando panel...
        </p>
      </div>
    );
  }

  if (!user) {
    console.warn("⚠️ No hay usuario en sesión, redirigiendo a /login");
    return <Navigate to="/login" replace />;
  }

  const role = (user.role || "").toLowerCase();
  const scope = (user.scope || role).toLowerCase();
  const roleRoutes = {
    gerencia: "/dashboard/gerencia",
    gerente_general: "/dashboard/gerencia",
    director: "/dashboard/gerencia",
    finanzas: "/dashboard/finanzas",
    jefe_finanzas: "/dashboard/finanzas",
    comercial: "/dashboard/comercial",
    jefe_comercial: "/dashboard/comercial",
    backoffice_comercial: "/dashboard/comercial",
    acp_comercial: "/dashboard/comercial",
    servicio_tecnico: "/dashboard/servicio-tecnico",
    "servicio-tecnico": "/dashboard/servicio-tecnico",
    jefe_tecnico: "/dashboard/servicio-tecnico",
    jefe_servicio_tecnico: "/dashboard/servicio-tecnico",
    tecnico: "/dashboard/servicio-tecnico",
    talento_humano: "/dashboard/talento-humano",
    "talento-humano": "/dashboard/talento-humano",
    jefe_talento_humano: "/dashboard/talento-humano",
    ti: "/dashboard/ti",
    jefe_ti: "/dashboard/ti",
    operaciones: "/dashboard/operaciones",
    jefe_operaciones: "/dashboard/operaciones",
    calidad: "/dashboard/calidad",
    jefe_calidad: "/dashboard/calidad",
  };

  const target =
    roleRoutes[scope] ||
    roleRoutes[role] ||
    "/unauthorized";
  console.log(`🎯 Redirigiendo según rol [${role}] → ${target}`);

  return <Navigate to={target} replace />;
};

export default ProtectedRoute;
