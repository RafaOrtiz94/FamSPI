import React, { useEffect, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiLoader } from "react-icons/fi";
import { useAuth } from "../../../core/auth/AuthContext";
import { googleLogin } from "../../../core/api/authApi";
import famLogo from "../../../assets/famproject_logo.png";

/* ============================================================
   🔐 Login — Versión Corporativa Ampliada
   ------------------------------------------------------------
   • Formato más ancho y centrado visualmente
   • Mejor balance en pantallas grandes
   • Fondo degradado profesional con blur y gradiente institucional
   • Conserva animaciones y compatibilidad dark mode
   ============================================================ */
export default function Login() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const err = params.get("error");
    if (err) {
      switch (err) {
        case "domain_not_allowed":
          setError("Acceso denegado. Utiliza una cuenta corporativa FamProject.");
          break;
        case "missing_tokens":
          setError("Error: no se recibieron credenciales. Inténtalo de nuevo.");
          break;
        default:
          setError("Error durante la autenticación. Inténtalo de nuevo.");
      }
    }
  }, [location]);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleGoogleLogin = () => {
    setLoading(true);
    try {
      window.location.replace(googleLogin());
    } catch (err) {
      console.error("❌ Error iniciando login:", err);
      setError("No se pudo conectar con el servidor de autenticación.");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary-dark via-primary to-primary-light dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* 🌈 Fondo animado suave */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.25 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.25),transparent_70%)]"
      />

      {/* 🪟 Tarjeta principal (más grande y centrada) */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-[90%] max-w-[480px] bg-white/95 dark:bg-gray-800/90 backdrop-blur-2xl rounded-3xl shadow-2xl px-10 py-12 text-center border border-white/40 dark:border-gray-700/40"
      >
        {/* Logo */}
        <motion.img
          src={famLogo}
          alt="FamProject Logo"
          className="mx-auto w-28 mb-4 drop-shadow-md"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6 }}
        />

        {/* Título */}
        <h2 className="text-3xl font-bold text-neutral-800 dark:text-white tracking-tight mb-1">
          Portal Corporativo
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400 mb-8">
          Sistema Interno — Departamento de TI
        </p>

        {/* Error */}
        {error && (
          <div className="bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300 rounded-xl py-2 px-3 text-sm mb-5">
            {error}
          </div>
        )}

        {/* Botón Google */}
        <motion.button
          onClick={handleGoogleLogin}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          disabled={loading}
          className="w-full py-3 bg-white dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 text-neutral-700 dark:text-neutral-200 rounded-full shadow-sm font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-60"
        >
          {loading ? (
            <>
              <FiLoader className="animate-spin text-primary" />
              Conectando con Google...
            </>
          ) : (
            <>
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                width="22"
              />
              Iniciar sesión con Google
            </>
          )}
        </motion.button>

        {/* Texto inferior */}
        <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-8">
          © {new Date().getFullYear()}{" "}
          <span className="font-semibold text-primary dark:text-primary-light">
            FamProject
          </span>{" "}
          · Todos los derechos reservados
        </p>
      </motion.div>
    </div>
  );
}
