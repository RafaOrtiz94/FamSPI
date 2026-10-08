import React, { useEffect, useState } from "react";
import { useLocation, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiDownload, FiLoader, FiShare2, FiUser, FiWifiOff } from "react-icons/fi";
import { useAuth } from "../../../core/auth/AuthContext";
import { googleLogin, sandboxLogin, localLogin } from "../../../core/api/authApi";
import { usePwaStatus } from "../../../core/pwa/PwaStatusContext";
import Modal from "../../../core/ui/components/Modal";
import famLogo from "../../../assets/famproject_logo.png";

const SANDBOX_AUTH = process.env.REACT_APP_SANDBOX_AUTH === "true";

const INSTALL_STEPS_IOS = [
 "Abre Compartir en Safari.",
 "Toca Anadir a pantalla de inicio.",
 "Abre FamSPI desde el icono instalado y vuelve a iniciar sesion.",
];

const INSTALL_STEPS_DEFAULT = [
 "Pulsa Instalar app.",
 "Confirma la instalacion del sistema.",
 "Abre FamSPI desde el acceso directo y continua.",
];

const getLoginErrorMessage = (errorCode) => {
 switch (errorCode) {
  case "domain_not_allowed":
   return "Acceso denegado. Utiliza una cuenta corporativa FamProject.";
  case "missing_tokens":
   return "No se recibieron credenciales del proveedor. Intenta de nuevo.";
  case "missing_refresh_token":
   return "Tu sesion no quedo lista para renovacion automatica. Debes iniciar sesion otra vez.";
  case "session_expired":
   return "Tu sesion vencio. Vuelve a iniciar sesion para continuar donde quedaste.";
  case "auth_failed":
   return "No se pudo completar la autenticacion. Reintenta en unos segundos.";
  default:
   return errorCode ? "Error durante la autenticacion. Intenta de nuevo." : "";
 }
};

export default function Login() {
 const [error, setError] = useState("");
 const [loading, setLoading] = useState(false);
 const [sandboxEmail, setSandboxEmail] = useState("");
 const [sandboxPassword, setSandboxPassword] = useState("");
 const [pasanteUsername, setPasanteUsername] = useState("");
 const [pasantePassword, setPasantePassword] = useState("");
 const [showPasanteModal, setShowPasanteModal] = useState(false);
 const location = useLocation();
 const navigate = useNavigate();
 const { isAuthenticated, bootstrapSessionFromToken } = useAuth();
 const {
  isOnline,
  standalone,
  installPromptAvailable,
  installPromptPending,
  requestInstall,
 } = usePwaStatus();

 useEffect(() => {
  const params = new URLSearchParams(location.search);
  setError(getLoginErrorMessage(params.get("error")));
 }, [location.search]);

 const returnUrl = new URLSearchParams(location.search).get("returnUrl");
 const pendingRedirect = sessionStorage.getItem("redirectTo") || "";
 const isAttendanceShortcutPending = pendingRedirect.startsWith("/asistencia/marcar/");
 const installSteps = standalone ? [] : /iphone|ipad|ipod/i.test(navigator.userAgent || "") ? INSTALL_STEPS_IOS : INSTALL_STEPS_DEFAULT;

 if (isAuthenticated) {
  const dest = returnUrl ? decodeURIComponent(returnUrl) : "/dashboard";
  return <Navigate to={dest} replace />;
 }

 const handleGoogleLogin = () => {
  if (!isOnline) {
   setError("No se pudo iniciar sesion porque el dispositivo esta sin conexion.");
   return;
  }

  setLoading(true);
  try {
   if (returnUrl) sessionStorage.setItem("redirectTo", decodeURIComponent(returnUrl));
   window.location.replace(googleLogin());
  } catch (err) {
   console.error("Error iniciando login:", err);
   setError("No se pudo conectar con el servidor de autenticacion.");
   setLoading(false);
  }
 };

 const handleSandboxLogin = async (event) => {
  event.preventDefault();
  setError("");
  setLoading(true);
  try {
   const data = await sandboxLogin(sandboxEmail, sandboxPassword);
   const bootstrappedUser = bootstrapSessionFromToken?.(data?.accessToken);
   const dest = returnUrl ? decodeURIComponent(returnUrl) : (bootstrappedUser?.dashboard || "/dashboard");
   navigate(dest, { replace: true });
  } catch (err) {
   setError(err?.response?.data?.message || err.message || "Credenciales incorrectas");
  } finally {
   setLoading(false);
  }
 };

 const handleInstall = async () => {
  await requestInstall();
 };

 // Pasantes: login por credenciales propias, sin OAuth de Google (limitante
 // del requerimiento). Ver docs/plans/pasantes-access-plan.md. Distinto del
 // formulario sandbox de mas abajo (ese es solo para QA/desarrollo).
 const handlePasanteLogin = async (event) => {
  event.preventDefault();
  setError("");
  setLoading(true);
  try {
   const data = await localLogin(pasanteUsername, pasantePassword);
   const bootstrappedUser = bootstrapSessionFromToken?.(data?.accessToken);
   setShowPasanteModal(false);
   if (data?.must_change_password) {
    navigate("/cambiar-password", { replace: true });
    return;
   }
   const dest = returnUrl ? decodeURIComponent(returnUrl) : (bootstrappedUser?.dashboard || "/dashboard/pasante");
   navigate(dest, { replace: true });
  } catch (err) {
   setError(err?.response?.data?.message || err.message || "Usuario o contraseña incorrectos");
  } finally {
   setLoading(false);
  }
 };

 return (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary-dark via-primary to-primary-light dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
   <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 0.25 }}
    transition={{ duration: 1.5 }}
    className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.25),transparent_70%)]"
   />

   <motion.div
    initial={{ opacity: 0, y: 40 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.8, ease: "easeOut" }}
    className="relative z-10 w-[90%] max-w-[480px] rounded-3xl border border-white/40 bg-white/95 px-10 py-12 text-center shadow-2xl backdrop-blur-2xl dark:border-gray-700/40 dark:bg-gray-800/90"
   >
    <motion.img
     src={famLogo}
     alt="FamProject Logo"
     className="mx-auto mb-4 w-28 drop-shadow-md"
     initial={{ scale: 0.9, opacity: 0 }}
     animate={{ scale: 1, opacity: 1 }}
     transition={{ duration: 0.6 }}
    />

    <h2 className="mb-1 text-3xl font-bold tracking-tight text-neutral-800 dark:text-white">
     Portal Corporativo
    </h2>
    <p className="mb-8 text-neutral-500 dark:text-neutral-400">
     Sistema Interno — Departamento de TI
    </p>

    {error && (
     <div className="mb-5 rounded-xl bg-rose-100 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
      {error}
     </div>
    )}

    {isAttendanceShortcutPending && (
     <div className="mb-5 rounded-xl bg-sky-100 px-3 py-2 text-sm text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
      Vamos a continuar tu marcacion de asistencia despues de iniciar sesion.
     </div>
    )}

    {!isOnline && (
     <div className="mb-5 flex items-start gap-3 rounded-xl bg-rose-100 px-3 py-3 text-left text-sm text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
      <FiWifiOff className="mt-0.5 shrink-0" />
      <span>Google OAuth requiere conexion a internet. Cuando vuelva la red, podras iniciar sesion desde aqui.</span>
     </div>
    )}

    {!standalone && installSteps.length > 0 && (
     <div className="mb-5 rounded-xl bg-slate-100 px-4 py-3 text-left text-sm text-slate-700 dark:bg-gray-700/50 dark:text-slate-200">
      <div className="mb-2 flex items-center gap-2 font-semibold">
       <FiDownload size={14} />
       Instala FamSPI en este dispositivo
      </div>
      <div className="space-y-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
       {installSteps.map((step, index) => (
        <p key={step}>
         {index + 1}. {step}
        </p>
       ))}
      </div>
      {installPromptAvailable && (
       <button
        type="button"
        onClick={handleInstall}
        disabled={installPromptPending}
        className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-all hover:shadow-md disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-neutral-200"
       >
        {installPromptPending ? <FiLoader className="animate-spin" /> : <FiDownload />}
        {installPromptPending ? "Abriendo instalador..." : "Instalar app"}
       </button>
      )}
     </div>
    )}

    <motion.button
     onClick={handleGoogleLogin}
     whileHover={isOnline ? { scale: 1.03 } : undefined}
     whileTap={isOnline ? { scale: 0.97 } : undefined}
     disabled={loading || !isOnline}
     className="flex w-full items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white py-3 font-medium text-neutral-700 shadow-sm transition-all hover:shadow-lg disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-neutral-200"
    >
     {loading ? (
      <>
       <FiLoader className="text-primary animate-spin" />
       Conectando con Google...
      </>
     ) : (
      <>
       <img
        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
        alt="Google"
        width="22"
       />
       Iniciar sesion con Google
      </>
     )}
    </motion.button>

    {SANDBOX_AUTH && (
     <>
      <div className="my-6 flex items-center gap-3">
       <div className="h-px flex-1 bg-neutral-200 dark:bg-gray-700" />
       <span className="text-xs font-medium uppercase tracking-wider text-amber-500">
        Sandbox
       </span>
       <div className="h-px flex-1 bg-neutral-200 dark:bg-gray-700" />
      </div>

      <form onSubmit={handleSandboxLogin} className="space-y-3 text-left">
       <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-amber-500">
        <FiShare2 size={14} />
        Acceso de pruebas
       </div>
       <input
        type="email"
        required
        placeholder="correo@fam-project.com"
        value={sandboxEmail}
        onChange={(event) => setSandboxEmail(event.target.value)}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
       />
       <input
        type="password"
        required
        placeholder="Contraseña sandbox"
        value={sandboxPassword}
        onChange={(event) => setSandboxPassword(event.target.value)}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
       />
       <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
       >
        {loading ? "Ingresando..." : "Ingresar"}
       </button>
      </form>
     </>
    )}

    <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-500">
     © {new Date().getFullYear()}{" "}
     <span className="font-semibold text-primary dark:text-primary-light">
      FamProject
     </span>{" "}
     · Todos los derechos reservados
    </p>

    {/* Acceso discreto para pasantes: sin OAuth de Google, se autentican por
        usuario/contraseña propia. Deliberadamente no es un boton prominente
        junto al de Google -- es un enlace chico, casi invisible, para no
        confundir al resto de la organizacion (que siempre entra por Google)
        con un segundo metodo de login. Ver docs/plans/pasantes-access-plan.md. */}
    <button
     type="button"
     onClick={() => setShowPasanteModal(true)}
     className="mt-3 text-[11px] text-neutral-300 underline-offset-2 transition-colors hover:text-neutral-500 hover:underline dark:text-neutral-600 dark:hover:text-neutral-400"
    >
     Acceso pasantes
    </button>
   </motion.div>

   <Modal
    open={showPasanteModal}
    onClose={() => !loading && setShowPasanteModal(false)}
    title="Acceso pasantes"
    maxWidth="max-w-sm"
   >
    <form onSubmit={handlePasanteLogin} className="space-y-3 text-left">
     <p className="mb-1 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
      <FiUser size={14} />
      Ingresa con el usuario y contraseña que te entregó el administrador.
     </p>
     {showPasanteModal && error && (
      <div className="rounded-xl bg-rose-100 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
       {error}
      </div>
     )}
     <input
      type="text"
      required
      autoComplete="username"
      autoFocus
      placeholder="Usuario"
      value={pasanteUsername}
      onChange={(event) => setPasanteUsername(event.target.value)}
      className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
     />
     <input
      type="password"
      required
      autoComplete="current-password"
      placeholder="Contraseña"
      value={pasantePassword}
      onChange={(event) => setPasantePassword(event.target.value)}
      className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
     />
     <button
      type="submit"
      disabled={loading}
      className="w-full rounded-xl bg-neutral-700 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-600 dark:hover:bg-neutral-500"
     >
      {loading ? "Ingresando..." : "Ingresar como pasante"}
     </button>
    </form>
   </Modal>
  </div>
 );
}
