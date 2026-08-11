/**
 * Service Worker minimo para permitir que la PWA (guardada en pantalla de
 * inicio de iOS/Android) cargue el shell de la app sin internet.
 *
 * Reglas de seguridad (evitan repetir el problema anterior de usuarios
 * atascados con una version vieja/rota):
 * 1. El HTML (index.html) es siempre "network-first": si hay internet,
 *    SIEMPRE se pide fresco al servidor. Solo se usa la copia guardada
 *    cuando el fetch de red falla por completo (sin conexion).
 * 2. Los archivos de /static/ (JS/CSS con hash en el nombre) son
 *    inmutables por construccion -- un build nuevo genera nombres de
 *    archivo distintos, nunca sobreescribe uno viejo -- asi que cachearlos
 *    "para siempre" es seguro y nunca sirve un archivo desactualizado.
 * 3. Nunca se intercepta nada que no sea GET del mismo origen -- las
 *    llamadas a la API (otro origen) y todos los POST/PUT/DELETE pasan de
 *    largo sin tocar el Service Worker.
 */

const SHELL_CACHE = "spi-shell-v1";
const ASSETS_CACHE = "spi-assets-v1";
const MAX_ASSET_ENTRIES = 80;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== ASSETS_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      clients.forEach((client) => {
        client.postMessage({ type: "SW_ACTIVATED" });
      });
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put("/index.html", response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match("/index.html");
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(ASSETS_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
    trimCache(ASSETS_CACHE, MAX_ASSET_ENTRIES);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstShell(request));
    return;
  }

  if (url.pathname.startsWith("/static/")) {
    event.respondWith(cacheFirstAsset(request));
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (_error) {
    payload = { title: "FamSPI", body: event.data.text() };
  }

  const title = payload.title || "FamSPI";
  const options = {
    body: payload.body || "Tienes una nueva notificacion",
    icon: "/logo192.png",
    badge: "/apple-touch-icon.png",
    tag: payload.tag || "famspi-notification",
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/";
  const normalizedTarget = new URL(targetUrl, self.location.origin).toString();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === normalizedTarget && "focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(normalizedTarget);
      }
      return undefined;
    }),
  );
});
