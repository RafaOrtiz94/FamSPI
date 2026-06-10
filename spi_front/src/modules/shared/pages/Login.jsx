import React, { useEffect, useState } from "react";
import { useLocation, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiLoader } from "react-icons/fi";
import { useAuth } from "../../../core/auth/AuthContext";
import { googleLogin, sandboxLogin } from "../../../core/api/authApi";
import famLogo from "../../../assets/famproject_logo.png";

const SANDBOX_AUTH = process.env.REACT_APP_SANDBOX_AUTH === "true";

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
 const [sandboxEmail, setSandboxEmail] = useState("");
 const [sandboxPassword, setSandboxPassword] = useState("");
 const location = useLocation();
 const navigate = useNavigate();
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
 case "missing_refresh_token":
 setError("Tu sesión no tiene habilitada la renovación automática. Por favor, inicia sesión de nuevo para habilitarla (30 días).");
 break;
 default:
 setError("Error durante la autenticación. Inténtalo de nuevo.");
 }
 }
 }, [location]);

 // Preserve returnUrl for post-login redirect (used by QR and deep links)
 const returnUrl = new URLSearchParams(location.search).get("returnUrl");
 if (isAuthenticated) {
   const dest = returnUrl ? decodeURIComponent(returnUrl) : "/dashboard";
   return <Navigate to={dest} replace />;
 }

 const handleGoogleLogin = () => {
 setLoading(true);
 try {
   // Store returnUrl so LoginCallback can redirect there after OAuth
   if (returnUrl) sessionStorage.setItem("redirectTo", decodeURIComponent(returnUrl));
   window.location.replace(googleLogin());
 } catch (err) {
 console.error("❌ Error iniciando login:", err);
 setError("No se pudo conectar con el servidor de autenticación.");
 setLoading(false);
 }
 };

 const handleSandboxLogin = async (e) => {
 e.preventDefault();
 setError("");
 setLoading(true);
 try {
 await sandboxLogin(sandboxEmail, sandboxPassword);
 const dest = returnUrl ? decodeURIComponent(returnUrl) : "/dashboard";
 navigate(dest, { replace: true });
 } catch (err) {
 setError(err?.response?.data?.message || err.message || "Credenciales incorrectas");
 } finally {
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

 {/* Formulario sandbox (solo visible cuando REACT_APP_SANDBOX_AUTH=true) */}
 {SANDBOX_AUTH && (
 <>
 <div className="flex items-center gap-3 my-6">
 <div className="flex-1 h-px bg-neutral-200 dark:bg-gray-700" />
 <span className="text-xs text-amber-500 font-medium uppercase tracking-wider">
 Sandbox
 </span>
 <div className="flex-1 h-px bg-neutral-200 dark:bg-gray-700" />
 </div>

 <form onSubmit={handleSandboxLogin} className="text-left space-y-3">
 <input
 type="email"
 required
 placeholder="correo@fam-project.com"
 value={sandboxEmail}
 onChange={(e) => setSandboxEmail(e.target.value)}
 className="w-full px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-neutral-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
 />
 <input
 type="password"
 required
 placeholder="Contraseña sandbox"
 value={sandboxPassword}
 onChange={(e) => setSandboxPassword(e.target.value)}
 className="w-full px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-neutral-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
 />
 <button
 type="submit"
 disabled={loading}
 className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-60"
 >
 {loading ? "Ingresando..." : "Ingresar"}
 </button>
 </form>
 </>
 )}

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
