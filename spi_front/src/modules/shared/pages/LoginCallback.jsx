import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiLoader } from "react-icons/fi";
import { handleGoogleCallback } from "../../../core/api/authApi";
import { useAuth } from "../../../core/auth/AuthContext";
import { clockIn, getTodayAttendance } from "../../../core/api/attendanceApi";

/**
 * LoginCallback.jsx
 * ------------------------------------------------------------
 * - Procesa el fragmento (#accessToken & refreshToken)
 * - Guarda tokens y actualiza el contexto global
 * - Redirige automáticamente al dashboard según el rol
 * - Verifica si el usuario tiene firma registrada
 */
const LoginCallback = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  useEffect(() => {
    let processed = false;

    const processCallback = async () => {
      if (processed) return;
      processed = true;

      try {
        const hash = window.location.hash;
        if (!hash) throw new Error("No se encontró información de tokens.");

        const { accessToken, refreshToken } = handleGoogleCallback(hash);

        if (!accessToken || !refreshToken) {
          throw new Error("Tokens inválidos o incompletos.");
        }

        console.log("✅ Tokens recibidos y guardados en localStorage.");
        console.log("🔑 Access:", accessToken.slice(0, 15) + "...");

        // 2️⃣ Refrescar el contexto (esto actualiza el 'user' global)
        const ok = await refresh();
        if (!ok) throw new Error("No se pudo sincronizar sesión.");

        try {
          const attendance = await getTodayAttendance();
          if (!attendance?.data?.entry_time) {
            await clockIn(null);
          }
        } catch (attendanceErr) {
          console.warn("No se pudo garantizar la entrada automatica en login:", attendanceErr?.message || attendanceErr);
        }
        window.history.replaceState(null, "", window.location.pathname);

        // 3️⃣ Acceder al usuario directamente desde AuthContext
        const stored = JSON.parse(localStorage.getItem("user") || "{}");

        // 🆕 Check if user has signature - redirect to signature page if not
        if (!stored.has_signature) {
          console.log("⚠️ Usuario sin firma registrada, redirigiendo a captura de firma");
          navigate("/first-login-signature", { replace: true });
          return;
        }

        const role = (stored.role || "pendiente").toLowerCase();
        const scope = (stored.scope || role).toLowerCase();
        const isPendingRole = !role || role === "pendiente" || role === "pending" || scope === "pendiente" || scope === "pending";

        const roleRoutes = {
          gerencia: "/dashboard/gerencia",
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

        const target = isPendingRole
          ? "/registro-en-proceso"
          : stored.dashboard || roleRoutes[scope] || roleRoutes[role] || "/unauthorized";
        console.log(`🚀 Redirigiendo a: ${target}`);
        navigate(target, { replace: true });
      } catch (err) {
        console.error("❌ Error procesando callback:", err);
        navigate("/login?error=auth_failed", { replace: true });
      }
    };

    processCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <FiLoader className="animate-spin text-blue-600 dark:text-blue-400 text-4xl mx-auto mb-4" />
        <h1 className="text-lg font-semibold">Procesando inicio de sesión...</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Por favor espera un momento.
        </p>
      </motion.div>
    </div>
  );
};

export default LoginCallback;


