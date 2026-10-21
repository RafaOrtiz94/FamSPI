import React, { useState } from "react";
import {
 FiAlertTriangle,
 FiBell,
 FiDownload,
 FiInbox,
 FiList,
 FiRefreshCw,
 FiRotateCw,
 FiShare2,
 FiSmartphone,
 FiWifi,
 FiWifiOff,
 FiX,
} from "react-icons/fi";
import Modal from "./Modal";
import { usePwaStatus } from "../../pwa/PwaStatusContext";
import { useNotifications } from "../NotificationContext";
import { getQueuedMarks } from "../../../shared/utils/attendanceOfflineQueue";

const formatRelativeTimestamp = (isoValue) => {
 if (!isoValue) return null;
 const date = new Date(isoValue);
 if (Number.isNaN(date.getTime())) return null;
 return date.toLocaleTimeString("es-EC", {
  hour: "2-digit",
  minute: "2-digit",
 });
};

const formatDetailedTimestamp = (isoValue) => {
 if (!isoValue) return null;
 const date = new Date(isoValue);
 if (Number.isNaN(date.getTime())) return null;
 return date.toLocaleString("es-EC", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
 });
};

const RESULT_META = {
 success: {
  label: "Sincronizacion completada",
  badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
 },
 deferred: {
  label: "Pendiente por red",
  badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
 },
 "partial-failure": {
  label: "Sincronizacion parcial",
  badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
 },
 syncing: {
  label: "Sincronizando",
  badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
 },
};

const INSTALL_STEPS_IOS = [
 "Toca Compartir en Safari.",
 "Elige Anadir a pantalla de inicio.",
 "Abre FamSPI desde el icono nuevo en tu pantalla de inicio.",
];

const INSTALL_STEPS_DEFAULT = [
 "Pulsa Instalar app en este aviso.",
 "Confirma la instalacion del sistema.",
 "Abre FamSPI desde el icono instalado para continuar con push.",
];

const getPushStatusLabel = (pushState) => {
 if (pushState.subscribed) return "Push activo";
 if (!pushState.enabled) return "Push no configurado";
 if (!pushState.supported) return "Push no disponible";
 if (pushState.permission === "denied") return "Permiso bloqueado";
 return "Push pendiente";
};

export default function PwaAvailabilityBanner() {
 const [detailsOpen, setDetailsOpen] = useState(false);
 const [installGuideOpen, setInstallGuideOpen] = useState(false);
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
  offlineQueueStatus,
  applyAppUpdate,
  dismissInstallBanner,
  requestInstall,
  refreshSnapshot,
 } = usePwaStatus();
 const {
  pushState,
  enableDevicePush,
  refreshPushState,
 } = useNotifications();

 const pendingOfflineActions = Number(offlineQueueStatus?.pendingCount || 0);
 const isSyncingOfflineActions = Boolean(offlineQueueStatus?.syncing);
 const queuedMarks = getQueuedMarks();
 const showInstallBanner = installBannerVisible && !standalone;
 const showOfflineQueueBanner = pendingOfflineActions > 0 || isSyncingOfflineActions;
 const showPushSetupBanner =
  standalone &&
  Boolean(pushState?.enabled) &&
  !Boolean(pushState?.subscribed);
 const showBanner =
  !isOnline ||
  isSlowConnection ||
  updateAvailable ||
  showInstallBanner ||
  showOfflineQueueBanner ||
  showPushSetupBanner;
 if (!showBanner) return null;

 const recoveredAt = formatRelativeTimestamp(lastOnlineAt);
 const disconnectedAt = formatRelativeTimestamp(lastOfflineAt);
 const lastFlushAt = formatRelativeTimestamp(offlineQueueStatus?.lastFlushAt);
 const lastFlushDetailed = formatDetailedTimestamp(offlineQueueStatus?.lastFlushAt);
 const lastSuccessDetailed = formatDetailedTimestamp(offlineQueueStatus?.lastSuccessAt);
 const lastFailureDetailed = formatDetailedTimestamp(offlineQueueStatus?.lastFailureAt);
 const resultMeta = RESULT_META[offlineQueueStatus?.lastResult] || null;
 const canEnablePushNow =
  isOnline &&
  standalone &&
  Boolean(pushState?.supported) &&
  Boolean(pushState?.enabled) &&
  !Boolean(pushState?.subscribed);
 const installSteps = pushState?.isIos ? INSTALL_STEPS_IOS : INSTALL_STEPS_DEFAULT;

 let panelClass = "border-amber-200 bg-white text-slate-900";
 let iconClass = "bg-amber-50 text-amber-700";
 let badgeClass = "border-amber-200 bg-amber-50 text-amber-700";
 let icon = <FiAlertTriangle size={18} className="text-amber-600" />;
 let title = "Red inestable";
 let description = "La app sigue operativa, pero algunas acciones pueden tardar o reintentarse.";
 let actions = null;

 if (showInstallBanner) {
  panelClass = "border-emerald-200 bg-white text-slate-900";
  iconClass = "bg-emerald-50 text-emerald-700";
  badgeClass = "border-emerald-200 bg-emerald-50 text-emerald-700";
  icon = <FiSmartphone size={18} className="text-emerald-700" />;
  title = "Instala la app y prepara las notificaciones";
  description = installPromptAvailable
   ? "FamSPI puede instalarse ahora en este dispositivo. Al abrir la app instalada podras activar las notificaciones push."
   : pushState?.isIos
   ? "En iPhone debes agregar FamSPI a tu pantalla de inicio desde Safari. Luego abre la app instalada para habilitar push."
   : "Tu navegador no expuso el instalador automatico en este momento. Revisa la guia y abre la app instalada para habilitar push.";
  actions = (
   <>
    {installPromptAvailable ? (
     <button
      type="button"
      onClick={requestInstall}
      disabled={installPromptPending}
      className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition duration-150 ease-out hover:bg-[#1D4ED8] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9] disabled:cursor-not-allowed disabled:opacity-60"
     >
      <FiDownload size={14} />
      {installPromptPending ? "Abriendo instalador..." : "Instalar app"}
     </button>
    ) : null}
    <button
     type="button"
     onClick={() => setInstallGuideOpen(true)}
     className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition duration-150 ease-out hover:bg-slate-50 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9]"
    >
      <FiShare2 size={14} />
      Ver pasos
     </button>
    <button
      type="button"
      onClick={dismissInstallBanner}
      className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition duration-150 ease-out hover:bg-slate-50 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9]"
     >
      <FiX size={14} />
      Recordar mas tarde
     </button>
   </>
  );
 } else if (showPushSetupBanner) {
  panelClass = "border-sky-200 bg-white text-slate-900";
  iconClass = "bg-sky-50 text-sky-700";
  badgeClass = "border-sky-200 bg-sky-50 text-sky-700";
  icon = <FiBell size={18} className="text-sky-700" />;
  title = "Activa las notificaciones push";
  description = canEnablePushNow
   ? "La PWA ya esta instalada en este dispositivo. Activa push ahora para recibir avisos aunque FamSPI este cerrada."
   : pushState?.permission === "denied"
   ? "El permiso del navegador esta bloqueado. Debes volver a habilitar notificaciones para esta app y luego reintentar."
   : "La app instalada ya esta lista. Revisa los pasos y activa push cuando el sistema lo permita.";
  actions = (
   <>
    <button
     type="button"
     onClick={() => setInstallGuideOpen(true)}
     className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition duration-150 ease-out hover:bg-slate-50 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9]"
    >
      <FiList size={14} />
      Ver guia
    </button>
    <button
      type="button"
      onClick={enableDevicePush}
      disabled={!canEnablePushNow || pushState?.loading}
      className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition duration-150 ease-out hover:bg-[#1D4ED8] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9] disabled:cursor-not-allowed disabled:opacity-60"
     >
      <FiBell size={14} />
      {pushState?.loading ? "Activando..." : "Activar push"}
     </button>
   </>
  );
 } else if (showOfflineQueueBanner) {
  panelClass = "border-sky-200 bg-white text-slate-900";
  iconClass = "bg-sky-50 text-sky-700";
  badgeClass = "border-sky-200 bg-sky-50 text-sky-700";
  icon = <FiRotateCw size={18} className={`text-indigo-700 ${isSyncingOfflineActions ? "animate-spin" : ""}`} />;
  title = isSyncingOfflineActions ? "Sincronizando acciones pendientes" : "Hay acciones pendientes de enviar";
  description = isSyncingOfflineActions
   ? `FamSPI esta reintentando ${pendingOfflineActions || "las"} accion(es) guardada(s) offline.`
   : `${pendingOfflineActions} accion(es) siguen guardadas en este dispositivo y se enviaran cuando la red sea estable.`;
  actions = (
   <button
    type="button"
    onClick={() => setDetailsOpen(true)}
    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition duration-150 ease-out hover:bg-slate-50 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9]"
   >
    <FiList size={14} />
    Ver cola
   </button>
  );
 } else if (!isOnline) {
  panelClass = "border-rose-200 bg-white text-slate-900";
  iconClass = "bg-rose-50 text-rose-700";
  badgeClass = "border-rose-200 bg-rose-50 text-rose-700";
  icon = <FiWifiOff size={18} className="text-rose-600" />;
  title = "Sin conexion";
  description = disconnectedAt
   ? `Se perdio la conexion alrededor de las ${disconnectedAt}. La PWA mantendra lo ya cargado y reintentara cuando vuelva la red.`
   : "La PWA mantendra lo ya cargado y reintentara cuando vuelva la red.";
 } else if (updateAvailable) {
  panelClass = "border-sky-200 bg-white text-slate-900";
  iconClass = "bg-sky-50 text-sky-700";
  badgeClass = "border-sky-200 bg-sky-50 text-sky-700";
  icon = <FiRefreshCw size={18} className={`text-sky-600 ${updating ? "animate-spin" : ""}`} />;
  title = "Nueva version disponible";
  description =
   "Hay una actualizacion lista. Recargar ahora reduce fallos por archivos viejos y mejora la estabilidad de la PWA.";
  actions = (
   <button
    type="button"
    onClick={applyAppUpdate}
    disabled={updating}
    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition duration-150 ease-out hover:bg-[#1D4ED8] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9] disabled:cursor-not-allowed disabled:opacity-60"
   >
    <FiRefreshCw size={14} className={updating ? "animate-spin" : ""} />
    {updating ? "Actualizando..." : "Actualizar ahora"}
   </button>
  );
 } else if (isSlowConnection) {
  description = `Conexion ${effectiveType || "limitada"}${saveData ? " con ahorro de datos" : ""}. La app degradara algunas recargas para mantenerse usable.`;
 }

 return (
  <>
   <div className={`mx-2 mt-2 rounded-2xl border px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:mx-4 lg:mx-6 2xl:mx-8 ${panelClass}`}>
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
     <div className="flex min-w-0 items-start gap-3">
      <div className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
       {icon}
      </div>
      <div className="min-w-0">
       <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClass}`}>
         {isOnline ? "Operando" : "Offline"}
        </span>
        {resultMeta ? (
         <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${resultMeta.badgeClass}`}>
          {resultMeta.label}
         </span>
        ) : null}
        {(showInstallBanner || showPushSetupBanner) && pushState ? (
         <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
          {getPushStatusLabel(pushState)}
         </span>
        ) : null}
       </div>
       <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
       {isOnline && recoveredAt && !updateAvailable && !showInstallBanner && !showOfflineQueueBanner && !showPushSetupBanner ? (
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
         Ultima reconexion: {recoveredAt}
        </p>
       ) : null}
       {showOfflineQueueBanner && lastFlushAt ? (
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
         Ultimo intento: {lastFlushAt}
        </p>
       ) : null}
       {showPushSetupBanner && pushState?.error ? (
        <p className="mt-2 text-xs font-medium text-rose-600">{pushState.error}</p>
       ) : null}
      </div>
     </div>

     <div className="flex shrink-0 flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
       {isOnline ? <FiWifi size={12} /> : <FiWifiOff size={12} />}
       {isOnline ? "PWA activa" : "Sin red"}
      </span>
      {showOfflineQueueBanner ? (
       <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
        <FiRotateCw size={12} className={isSyncingOfflineActions ? "animate-spin" : ""} />
        {pendingOfflineActions} pendiente{pendingOfflineActions === 1 ? "" : "s"}
       </span>
      ) : null}
      {actions}
     </div>
    </div>
   </div>

   <Modal open={installGuideOpen} onClose={() => setInstallGuideOpen(false)} title="Instalacion y notificaciones de la PWA" maxWidth="max-w-3xl">
    <div className="flex flex-col gap-4">
     <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
       <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Instalacion</p>
       <p className="mt-2 text-sm font-semibold text-slate-900">
        {standalone ? "App instalada" : installPromptAvailable ? "Lista para instalar" : pushState?.isIos ? "Instalacion manual en Safari" : "Instalacion no detectada"}
       </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
       <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Push</p>
       <p className="mt-2 text-sm font-semibold text-slate-900">{getPushStatusLabel(pushState)}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
       <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Dispositivo</p>
       <p className="mt-2 text-sm font-semibold text-slate-900">{pushState?.isIos ? "iPhone o iPad" : "Android o navegador compatible"}</p>
      </div>
     </div>

     <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
       <h3 className="text-sm font-semibold text-slate-900">Paso 1. Instala FamSPI</h3>
       <p className="mt-1 text-xs leading-5 text-slate-500">
        El flujo de push depende del navegador. La instalacion solo se automatiza cuando el sistema expone el instalador.
       </p>
      </div>
      <div className="flex flex-col gap-3 px-4 py-4">
       {installSteps.map((step, index) => (
        <div key={step} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
         <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {index + 1}
         </span>
         <p className="text-sm leading-6 text-slate-700">{step}</p>
        </div>
       ))}
       <div className="flex flex-wrap gap-2">
        {installPromptAvailable ? (
         <button
          type="button"
          onClick={requestInstall}
          disabled={installPromptPending}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition duration-150 ease-out hover:bg-[#1D4ED8] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9] disabled:cursor-not-allowed disabled:opacity-60"
         >
          <FiDownload size={14} />
          {installPromptPending ? "Abriendo instalador..." : "Instalar app ahora"}
         </button>
        ) : null}
        <button
         type="button"
         onClick={() => {
          refreshSnapshot();
          refreshPushState();
         }}
         className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition duration-150 ease-out hover:bg-slate-50 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9]"
        >
          <FiRefreshCw size={14} />
          Volver a comprobar
        </button>
       </div>
      </div>
     </div>

     <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
       <h3 className="text-sm font-semibold text-slate-900">Paso 2. Activa las notificaciones push</h3>
       <p className="mt-1 text-xs leading-5 text-slate-500">
        Este paso solo se puede ejecutar cuando FamSPI ya corre como app instalada y el navegador permite push.
       </p>
      </div>
      <div className="flex flex-col gap-3 px-4 py-4">
       <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">
         {canEnablePushNow
          ? "Tu dispositivo ya esta listo para pedir permiso."
          : standalone
          ? pushState?.permission === "denied"
            ? "El permiso fue bloqueado y debes habilitarlo otra vez en el navegador."
            : "La app instalada esta abierta. Revisa si tu navegador permite push en este estado."
          : "Primero instala y abre FamSPI desde su icono. En la pestaña normal del navegador no siempre se puede activar push."}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
         Permiso actual: {pushState?.permission || "desconocido"} · Suscripciones activas: {pushState?.activeSubscriptions || 0}
        </p>
        {pushState?.error ? <p className="mt-2 text-xs font-medium text-rose-600">{pushState.error}</p> : null}
       </div>
       <div className="flex flex-wrap gap-2">
        <button
         type="button"
         onClick={enableDevicePush}
         disabled={!canEnablePushNow || pushState?.loading}
         className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition duration-150 ease-out hover:bg-[#1D4ED8] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9] disabled:cursor-not-allowed disabled:opacity-60"
        >
         <FiBell size={14} />
         {pushState?.loading ? "Activando..." : "Activar notificaciones push"}
        </button>
        <button
         type="button"
         onClick={refreshPushState}
         className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition duration-150 ease-out hover:bg-slate-50 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0EA5E9]"
        >
         <FiRefreshCw size={14} />
         Actualizar estado push
        </button>
       </div>
      </div>
     </div>
    </div>
   </Modal>

   <Modal open={detailsOpen} onClose={() => setDetailsOpen(false)} title="Cola offline de asistencia" maxWidth="max-w-2xl">
    <div className="flex flex-col gap-4">
     <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
       <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Pendientes</p>
       <p className="mt-2 font-mono text-2xl font-semibold text-slate-900">{pendingOfflineActions}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
       <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Ultimo intento</p>
       <p className="mt-2 text-sm font-semibold text-slate-900">{lastFlushDetailed || "Sin intentos aun"}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
       <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Resultado</p>
       <p className="mt-2 text-sm font-semibold text-slate-900">{resultMeta?.label || "Pendiente"}</p>
      </div>
     </div>

     <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
       <h3 className="text-sm font-semibold text-slate-900">Acciones en espera</h3>
       <p className="mt-1 text-xs leading-5 text-slate-500">
        Esta vista muestra solo la cola offline ya persistida para asistencia. No inventa otros tipos de outbox.
       </p>
      </div>

      {queuedMarks.length ? (
       <div className="divide-y divide-slate-200">
        {queuedMarks.map((item) => (
         <div key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
           <p className="text-sm font-semibold text-slate-900">{item.label || item.endpoint}</p>
           <p className="mt-1 break-all font-mono text-xs text-slate-500">{item.endpoint}</p>
          </div>
          <div className="shrink-0 text-left sm:text-right">
           <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Guardada</p>
           <p className="mt-1 text-xs text-slate-700">{formatDetailedTimestamp(item.queuedAt) || "Fecha no disponible"}</p>
          </div>
         </div>
        ))}
       </div>
      ) : (
       <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
         <FiInbox size={22} />
        </div>
        <p className="text-sm font-semibold text-slate-900">No hay acciones pendientes</p>
        <p className="max-w-md text-xs leading-5 text-slate-500">
         Cuando la asistencia guarde acciones offline, apareceran aqui con su intento de sincronizacion.
        </p>
       </div>
      )}
     </div>

     <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
       <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Ultimo exito</p>
       <p className="mt-2 text-sm text-slate-900">{lastSuccessDetailed || "Sin sincronizaciones completas aun"}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
       <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Ultima incidencia</p>
       <p className="mt-2 text-sm text-slate-900">{lastFailureDetailed || "Sin incidencias registradas"}</p>
      </div>
     </div>
    </div>
   </Modal>
  </>
 );
}
