// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const installChunkLoadRecovery = () => {
  if (typeof window === "undefined") return;
  const reloadFlag = "spi_chunk_reload_done";

  const recoverFromChunkError = (reason) => {
    const text = String(reason || "");
    const isChunkFailure =
      text.includes("ChunkLoadError") ||
      text.includes("Loading chunk") ||
      text.includes("failed") ||
      text.includes("CSS_CHUNK_LOAD_FAILED");

    if (!isChunkFailure) return;
    if (sessionStorage.getItem(reloadFlag)) return;

    sessionStorage.setItem(reloadFlag, "1");
    const url = new URL(window.location.href);
    url.searchParams.set("_chunk_recover", Date.now().toString());
    window.location.replace(url.toString());
  };

  window.addEventListener("error", (event) => {
    recoverFromChunkError(event?.message || event?.error?.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    recoverFromChunkError(reason?.message || reason);
  });
};

const cleanupLegacyServiceWorkers = () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const reloadFlag = "spi_sw_cleanup_done";

  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (!Array.isArray(registrations) || registrations.length === 0) return;

      await Promise.all(registrations.map((registration) => registration.unregister()));

      // If a SW is controlling this page, force a single reload after unregister.
      if (navigator.serviceWorker.controller && !sessionStorage.getItem(reloadFlag)) {
        sessionStorage.setItem(reloadFlag, "1");
        window.location.reload();
      }
    } catch (error) {
      // Non-blocking: app should keep working even if cleanup fails.
      console.warn("No se pudo limpiar service workers legados:", error);
    }
  });
};

installChunkLoadRecovery();
cleanupLegacyServiceWorkers();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
