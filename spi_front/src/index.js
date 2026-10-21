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

// Registra el Service Worker propio (public/service-worker.js). Antes este
// mismo archivo desregistraba CUALQUIER service worker que encontrara --
// remanente de un SW mal configurado que dejo usuarios atascados con una
// version vieja/rota. El nuevo service-worker.js es network-first para el
// HTML (nunca sirve un shell viejo mientras haya internet) y cache-first
// solo para los archivos con hash de /static/ (inmutables por construccion),
// asi que no deberia repetir ese problema. El navegador reemplaza
// automaticamente cualquier SW anterior registrado en la misma URL en
// cuanto detecta que el contenido del archivo cambio.
const registerServiceWorker = () => {
 if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
 window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        const emitUpdateAvailable = () => {
          window.dispatchEvent(new CustomEvent("app:update-available"));
        };

        if (registration.waiting) {
          emitUpdateAvailable();
        }

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              emitUpdateAvailable();
            }
          });
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          window.dispatchEvent(new CustomEvent("app:sw-activated"));
          window.location.reload();
        });

        navigator.serviceWorker.addEventListener("message", (event) => {
          const type = event?.data?.type;
          if (type === "SW_ACTIVATED") {
            window.dispatchEvent(new CustomEvent("app:sw-activated"));
          }
          if (type === "SW_UPDATE_READY") {
            emitUpdateAvailable();
          }
        });
      })
      .catch((error) => {
        console.warn("No se pudo registrar el service worker:", error);
      });
  });
};

installChunkLoadRecovery();
registerServiceWorker();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
