import React from "react";
import {
 FiAlertTriangle,
 FiDownload,
 FiRefreshCw,
 FiSmartphone,
 FiWifi,
 FiWifiOff,
 FiX,
} from "react-icons/fi";
import { usePwaStatus } from "../../pwa/PwaStatusContext";

const formatRelativeTimestamp = (isoValue) => {
 if (!isoValue) return null;
 const date = new Date(isoValue);
 if (Number.isNaN(date.getTime())) return null;
 return date.toLocaleTimeString("es-EC", {
  hour: "2-digit",
  minute: "2-digit",
 });
};

export default function PwaAvailabilityBanner() {
 const {
  isOnline,
  isSlowConnection,
  effectiveType,
  saveData,
  standalone,
  updateAvailable,
  updating,
  installPromptAvailable,
  installPromptPending,
  installBannerVisible,
  lastOnlineAt,
  lastOfflineAt,
  applyAppUpdate,
  dismissInstallBanner,
  requestInstall,
 } = usePwaStatus();

 const showInstallBanner = installBannerVisible && !standalone;
 const showBanner = !isOnline || isSlowConnection || updateAvailable || showInstallBanner;
 if (!showBanner) return null;

 const recoveredAt = formatRelativeTimestamp(lastOnlineAt);
 const disconnectedAt = formatRelativeTimestamp(lastOfflineAt);

 let toneClass =
  "border-amber-200 bg-[linear-gradient(135deg,#fff7ed_0%,#fffbeb_45%,#ffffff_100%)] text-amber-900";
 let icon = <FiAlertTriangle size={18} className="text-amber-600" />;
 let title = "Red inestable";
 let description = "La app sigue operativa, pero algunas acciones pueden tardar o reintentarse.";
 let actions = null;

 if (showInstallBanner) {
  toneClass =
   "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#f0fdf4_45%,#ffffff_100%)] text-emerald-950";
  icon = <FiSmartphone size={18} className="text-emerald-700" />;
  title = "Instala la app para mejorar estabilidad y notificaciones";
  description = installPromptAvailable
   ? "Estás usando FamSPI desde el navegador. Instalar la PWA mejora acceso rápido, notificaciones y continuidad cuando la red falla."
   : "Estás usando FamSPI desde el navegador. En iPhone usa Compartir y luego 'Añadir a pantalla de inicio'. En Android abre el menú del navegador y toca 'Instalar app'.";
  actions = (
   <>
    {installPromptAvailable && (
     <button
      type="button"
      onClick={requestInstall}
      disabled={installPromptPending}
      className="inline-flex min-h-[38px] items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
     >
      <FiDownload size={14} />
      {installPromptPending ? "Abriendo instalador..." : "Instalar app"}
     </button>
    )}
    <button
      type="button"
      onClick={dismissInstallBanner}
      className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-emerald-300 bg-white/80 px-4 py-2 text-xs font-semibold text-emerald-900 transition hover:bg-white"
    >
      <FiX size={14} />
      Recordar más tarde
    </button>
   </>
  );
 } else if (!isOnline) {
  toneClass =
   "border-rose-200 bg-[linear-gradient(135deg,#fff1f2_0%,#fff7ed_50%,#ffffff_100%)] text-rose-900";
  icon = <FiWifiOff size={18} className="text-rose-600" />;
  title = "Sin conexión";
  description = disconnectedAt
   ? `Se perdió la conexión alrededor de las ${disconnectedAt}. La PWA mantendrá lo ya cargado y reintentará cuando vuelva la red.`
   : "La PWA mantendrá lo ya cargado y reintentará cuando vuelva la red.";
 } else if (updateAvailable) {
  toneClass =
   "border-sky-200 bg-[linear-gradient(135deg,#eff6ff_0%,#f0f9ff_45%,#ffffff_100%)] text-sky-900";
  icon = <FiRefreshCw size={18} className={`text-sky-600 ${updating ? "animate-spin" : ""}`} />;
  title = "Nueva versión disponible";
  description =
   "Hay una actualización lista. Recargar ahora reduce fallos por archivos viejos y mejora la estabilidad de la PWA.";
  actions = (
   <button
    type="button"
    onClick={applyAppUpdate}
    disabled={updating}
    className="inline-flex min-h-[38px] items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
   >
    <FiRefreshCw size={14} className={updating ? "animate-spin" : ""} />
    {updating ? "Actualizando..." : "Actualizar ahora"}
   </button>
  );
 } else if (isSlowConnection) {
  description = `Conexión ${effectiveType || "limitada"}${saveData ? " con ahorro de datos" : ""}. La app degradará algunas recargas para mantenerse usable.`;
 }

 return (
  <div className={`mx-2 mt-2 rounded-2xl border px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)] sm:mx-4 lg:mx-6 2xl:mx-8 ${toneClass}`}>
   <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div className="flex min-w-0 items-start gap-3">
     <div className="mt-0.5 shrink-0">{icon}</div>
     <div className="min-w-0">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 opacity-90">{description}</p>
      {isOnline && recoveredAt && !updateAvailable && !showInstallBanner && (
       <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] opacity-70">
        Última reconexión: {recoveredAt}
       </p>
      )}
     </div>
    </div>

    <div className="flex shrink-0 flex-wrap items-center gap-2">
     <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
      {isOnline ? <FiWifi size={12} /> : <FiWifiOff size={12} />}
      {isOnline ? "Operando" : "Offline"}
     </span>
     {actions}
    </div>
   </div>
  </div>
 );
}
