import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiLoader } from "react-icons/fi";
import { handleGoogleCallback } from "../../../core/api/authApi";
import { useAuth } from "../../../core/auth/AuthContext";

const LoginCallback = () => {
 const navigate = useNavigate();
 const { refresh, bootstrapSessionFromToken } = useAuth();

 useEffect(() => {
  let processed = false;

  const processCallback = async () => {
   if (processed) return;
   processed = true;

   try {
    const hash = window.location.hash;
    if (!hash) throw new Error("No se encontro informacion de tokens.");

    const { accessToken, refreshToken } = handleGoogleCallback(hash);
    if (!accessToken || !refreshToken) {
      throw new Error("Tokens invalidos o incompletos.");
    }

    const bootstrappedUser = bootstrapSessionFromToken?.(accessToken);
    if (!bootstrappedUser) {
     throw new Error("No se pudo hidratar la sesion inicial.");
    }

    window.history.replaceState(null, "", window.location.pathname);

    const role = (bootstrappedUser.role || "pendiente").toLowerCase();
    const scope = (bootstrappedUser.scope || role).toLowerCase();
    const isPendingRole =
      !role ||
      role === "pendiente" ||
      role === "pending" ||
      scope === "pendiente" ||
      scope === "pending";

    const roleRoutes = {
     gerencia: "/dashboard/gerencia",
     gerencia_general: "/dashboard/gerencia",
     gerente_general: "/dashboard/gerencia",
     director: "/dashboard/gerencia",
     finanzas: "/dashboard/finanzas",
     jefe_finanzas: "/dashboard/finanzas",
     jefe_financiero: "/dashboard/finanzas",
     financiero: "/dashboard/finanzas",
     comercial: "/dashboard/comercial",
     jefe_comercial: "/dashboard/comercial",
     backoffice_comercial: "/dashboard/comercial",
     acp_comercial: "/dashboard/comercial",
     analista_comercial: "/dashboard/comercial",
     servicio_tecnico: "/dashboard/servicio-tecnico",
     "servicio-tecnico": "/dashboard/servicio-tecnico",
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
      sessionStorage.getItem("redirectTo") ||
      (isPendingRole
       ? "/registro-en-proceso"
       : bootstrappedUser.dashboard || roleRoutes[role] || roleRoutes[scope] || "/unauthorized");
    sessionStorage.removeItem("redirectTo");

    void refresh().catch((syncError) => {
     console.warn("La sincronizacion completa del perfil fallo tras el login:", syncError);
    });

    navigate(target, { replace: true });
   } catch (err) {
    console.error("Error procesando callback:", err);
    navigate("/login?error=auth_failed", { replace: true });
   }
  };

  processCallback();
 }, [bootstrapSessionFromToken, navigate, refresh]);

 return (
  <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-200">
   <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5 }}
    className="text-center"
   >
    <FiLoader className="mx-auto mb-4 animate-spin text-4xl text-blue-600 dark:text-blue-400" />
    <h1 className="text-lg font-semibold">Procesando inicio de sesion...</h1>
    <p className="text-sm text-gray-500 dark:text-gray-400">
     Por favor espera un momento.
    </p>
   </motion.div>
  </div>
 );
};

export default LoginCallback;
