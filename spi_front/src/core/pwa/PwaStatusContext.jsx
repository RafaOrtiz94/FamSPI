import React, {
 createContext,
 useCallback,
 useContext,
 useEffect,
 useMemo,
 useRef,
 useState,
} from "react";
import { onlineManager } from "@tanstack/react-query";
import {
 getOfflineQueueSyncStatus,
 onOfflineQueueStatusChanged,
} from "../../shared/utils/attendanceOfflineQueue";

const PwaStatusContext = createContext(null);
const INSTALL_BANNER_STORAGE_KEY = "famspi:pwa-install-banner-dismissed-at";
const INSTALL_BANNER_HIDE_MS = 1000 * 60 * 60 * 12;

const getConnectionSnapshot = () => {
 const connection =
 navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
 if (!connection) {
 return {
 effectiveType: null,
 downlink: null,
 rtt: null,
 saveData: false,
 };
 }

 return {
 effectiveType: connection.effectiveType || null,
 downlink: Number.isFinite(Number(connection.downlink)) ? Number(connection.downlink) : null,
 rtt: Number.isFinite(Number(connection.rtt)) ? Number(connection.rtt) : null,
 saveData: Boolean(connection.saveData),
 };
};

const isStandalonePwa = () =>
 window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;

const readServiceWorkerStatus = () => {
 if (typeof window === "undefined") {
 return { supported: false, controlling: false };
 }

 return {
 supported: "serviceWorker" in navigator,
 controlling: Boolean(navigator.serviceWorker?.controller),
 };
};

const buildSnapshot = (prev = {}) => {
 const connection = getConnectionSnapshot();
 const isOnline = navigator.onLine !== false;
 const effectiveType = String(connection.effectiveType || "").toLowerCase();
 const isSlowConnection =
 !isOnline ||
 connection.saveData ||
 effectiveType === "slow-2g" ||
 effectiveType === "2g" ||
 (Number.isFinite(connection.rtt) && connection.rtt >= 900);

 return {
 ...prev,
 supported: true,
 isOnline,
 effectiveType: connection.effectiveType,
 downlink: connection.downlink,
 rtt: connection.rtt,
 saveData: connection.saveData,
 isSlowConnection,
 standalone: isStandalonePwa(),
 ...readServiceWorkerStatus(),
 };
};

export function PwaStatusProvider({ children }) {
 const lastOfflineAtRef = useRef(null);
 const installPromptEventRef = useRef(null);
 const [state, setState] = useState(() => ({
 ...buildSnapshot(),
 updateAvailable: false,
 updating: false,
 installPromptAvailable: false,
 installPromptPending: false,
 installBannerDismissedAt:
  typeof window !== "undefined" ? window.localStorage.getItem(INSTALL_BANNER_STORAGE_KEY) : null,
 lastOnlineAt: navigator.onLine !== false ? new Date().toISOString() : null,
 lastOfflineAt: null,
 offlineQueueStatus: getOfflineQueueSyncStatus(),
 }));

 const refreshSnapshot = useCallback(() => {
 setState((prev) => {
 const next = buildSnapshot(prev);
 if (!prev.isOnline && next.isOnline) {
 return {
 ...next,
 lastOfflineAt: prev.lastOfflineAt,
 lastOnlineAt: new Date().toISOString(),
 };
 }
 if (prev.isOnline && !next.isOnline) {
 const offlineAt = new Date().toISOString();
 lastOfflineAtRef.current = offlineAt;
 return {
 ...next,
 lastOfflineAt: offlineAt,
 lastOnlineAt: prev.lastOnlineAt,
 };
 }
 return {
 ...next,
 lastOfflineAt: prev.lastOfflineAt || lastOfflineAtRef.current,
 lastOnlineAt: prev.lastOnlineAt,
 };
 });
 }, []);

 useEffect(() => {
  const handleBeforeInstallPrompt = (event) => {
   event.preventDefault();
   installPromptEventRef.current = event;
   setState((prev) => ({
    ...prev,
    installPromptAvailable: true,
   }));
  };

  const handleAppInstalled = () => {
   installPromptEventRef.current = null;
   try {
    window.localStorage.removeItem(INSTALL_BANNER_STORAGE_KEY);
   } catch (_error) {
    // Ignore storage failures and keep the app usable.
   }
   setState((prev) => ({
    ...prev,
    installPromptAvailable: false,
    installPromptPending: false,
    installBannerDismissedAt: null,
    ...buildSnapshot(prev),
   }));
  };

  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);

  return () => {
   window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
   window.removeEventListener("appinstalled", handleAppInstalled);
  };
 }, []);

 useEffect(() => {
 const markOnline = () => refreshSnapshot();
 const markOffline = () => refreshSnapshot();

 window.addEventListener("online", markOnline);
 window.addEventListener("offline", markOffline);

 const connection =
 navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
 if (connection?.addEventListener) {
 connection.addEventListener("change", refreshSnapshot);
 }

 return () => {
 window.removeEventListener("online", markOnline);
 window.removeEventListener("offline", markOffline);
 if (connection?.removeEventListener) {
 connection.removeEventListener("change", refreshSnapshot);
 }
 };
 }, [refreshSnapshot]);

 useEffect(() => {
 onlineManager.setEventListener((setOnline) => {
 const sync = () => setOnline(navigator.onLine !== false);
 window.addEventListener("online", sync);
 window.addEventListener("offline", sync);
 sync();
 return () => {
 window.removeEventListener("online", sync);
 window.removeEventListener("offline", sync);
 };
 });
 }, []);

 useEffect(() => {
 const handleUpdateAvailable = () => {
 setState((prev) => ({ ...prev, updateAvailable: true, updating: false, ...readServiceWorkerStatus() }));
 };

 const handleControllerChanged = () => {
 setState((prev) => ({
 ...prev,
 updateAvailable: false,
 updating: false,
 ...buildSnapshot(prev),
 lastOnlineAt: navigator.onLine !== false ? new Date().toISOString() : prev.lastOnlineAt,
 }));
 };

 window.addEventListener("app:update-available", handleUpdateAvailable);
 window.addEventListener("app:sw-activated", handleControllerChanged);

 return () => {
 window.removeEventListener("app:update-available", handleUpdateAvailable);
 window.removeEventListener("app:sw-activated", handleControllerChanged);
 };
 }, []);

 useEffect(() => {
  const unsubscribe = onOfflineQueueStatusChanged(() => {
   setState((prev) => ({
    ...prev,
    offlineQueueStatus: getOfflineQueueSyncStatus(),
   }));
  });

  setState((prev) => ({
   ...prev,
   offlineQueueStatus: getOfflineQueueSyncStatus(),
  }));

  return unsubscribe;
 }, []);

 const applyAppUpdate = useCallback(async () => {
  if (!("serviceWorker" in navigator)) return false;
  setState((prev) => ({ ...prev, updating: true }));
  try {
   const registration = await navigator.serviceWorker.getRegistration("/service-worker.js");
   const waitingWorker = registration?.waiting || registration?.installing || null;
   if (waitingWorker) {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
   } else {
    window.location.reload();
   }
   return true;
  } catch (_error) {
   setState((prev) => ({ ...prev, updating: false }));
   return false;
  }
 }, []);

 const dismissInstallBanner = useCallback(() => {
  const dismissedAt = new Date().toISOString();
  try {
   window.localStorage.setItem(INSTALL_BANNER_STORAGE_KEY, dismissedAt);
  } catch (_error) {
   // Ignore storage failures and keep the app usable.
  }
  setState((prev) => ({
   ...prev,
   installBannerDismissedAt: dismissedAt,
  }));
 }, []);

 const requestInstall = useCallback(async () => {
  const deferredPrompt = installPromptEventRef.current;
  if (!deferredPrompt) return { supported: false, installed: false };

  setState((prev) => ({ ...prev, installPromptPending: true }));
  try {
   await deferredPrompt.prompt();
   const outcome = await deferredPrompt.userChoice;
   installPromptEventRef.current = null;
   setState((prev) => ({
    ...prev,
    installPromptAvailable: false,
    installPromptPending: false,
   }));
   return {
    supported: true,
    installed: outcome?.outcome === "accepted",
    outcome: outcome?.outcome || null,
   };
  } catch (_error) {
   setState((prev) => ({ ...prev, installPromptPending: false }));
   return { supported: true, installed: false, outcome: "error" };
  }
 }, []);

 const installBannerVisible = useMemo(() => {
  if (state.standalone) return false;
  if (!state.supported) return false;
  if (!state.installBannerDismissedAt) return true;

  const dismissedAt = new Date(state.installBannerDismissedAt);
  if (Number.isNaN(dismissedAt.getTime())) return true;
  return Date.now() - dismissedAt.getTime() >= INSTALL_BANNER_HIDE_MS;
 }, [state.installBannerDismissedAt, state.standalone, state.supported]);

 const value = useMemo(
 () => ({
 ...state,
 installBannerVisible,
 refreshSnapshot,
 applyAppUpdate,
 dismissInstallBanner,
 requestInstall,
 }),
 [applyAppUpdate, dismissInstallBanner, installBannerVisible, refreshSnapshot, requestInstall, state],
 );

 return <PwaStatusContext.Provider value={value}>{children}</PwaStatusContext.Provider>;
}

export function usePwaStatus() {
 const context = useContext(PwaStatusContext);
 if (!context) {
  throw new Error("usePwaStatus debe usarse dentro de PwaStatusProvider");
 }
 return context;
}
