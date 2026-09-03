/**
 * public/service-worker.js corre en el scope de un Service Worker (self,
 * caches, fetch globales de ese contexto), no en jsdom. Este test lo carga
 * con vm.runInNewContext contra un `self` simulado para verificar las reglas
 * de seguridad sin necesitar un navegador real.
 */
import fs from "fs";
import path from "path";
import vm from "vm";

const loadServiceWorker = ({ networkResponses = {}, networkError = null } = {}) => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../../../../public/service-worker.js"),
    "utf8",
  );

  const stores = new Map();
  const cacheApi = {
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        match: async (req) => {
          const key = typeof req === "string" ? req : req.url;
          return store.get(key) || undefined;
        },
        put: async (req, res) => {
          const key = typeof req === "string" ? req : req.url;
          store.set(key, res);
        },
        addAll: async (urls) => {
          for (const url of urls) {
            const response = await fetchMock(url);
            store.set(url, response);
          }
        },
        keys: async () => [...store.keys()].map((url) => ({ url })),
        delete: async (req) => {
          const key = typeof req === "string" ? req : req.url;
          return store.delete(key);
        },
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
  };

  const fetchMock = jest.fn(async (request) => {
    const url = typeof request === "string" ? request : request.url;
    if (networkError) throw networkError;
    return networkResponses[url] || { ok: true, clone: () => ({ ok: true }) };
  });

  let fetchHandler = null;
  const listeners = {};
  const sandbox = {
    self: {
      addEventListener: (evt, cb) => {
        listeners[evt] = cb;
        if (evt === "fetch") fetchHandler = cb;
      },
      skipWaiting: jest.fn(),
      clients: {
        claim: jest.fn(),
        matchAll: jest.fn(async () => []),
      },
      location: { origin: "https://fam-spi-front.web.app" },
    },
    caches: cacheApi,
    fetch: fetchMock,
    URL,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  return { stores, fetchMock, fetchHandler: () => fetchHandler, listeners };
};

const dispatchFetch = (fetchHandler, request) => {
  let respondedWith = null;
  fetchHandler({
    request,
    respondWith: (promise) => {
      respondedWith = promise;
    },
  });
  return respondedWith;
};

describe("public/service-worker.js - reglas de seguridad", () => {
  test("install: precachea el shell minimo y recursos criticos de la PWA", async () => {
    const response = { ok: true, clone: () => response };
    const { listeners, stores } = loadServiceWorker({
      networkResponses: {
        "/index.html": response,
        "/offline.html": response,
        "/manifest.json": response,
        "/favicon.ico": response,
        "/apple-touch-icon.png": response,
        "/logo192.png": response,
        "/logo512.png": response,
      },
    });

    let installWork = null;
    listeners.install({
      waitUntil: (promise) => {
        installWork = promise;
      },
    });

    await installWork;

    const shellCache = stores.get("spi-shell-v1");
    expect(shellCache.get("/index.html")).toBeDefined();
    expect(shellCache.get("/offline.html")).toBeDefined();
    expect(shellCache.get("/manifest.json")).toBeDefined();
  });

  test("HTML de navegacion: network-first, sirve fresco cuando hay internet y lo guarda", async () => {
    const okResponse = { ok: true, clone: () => okResponse };
    const { fetchHandler, fetchMock, stores } = loadServiceWorker({
      networkResponses: { "https://fam-spi-front.web.app/dashboard": okResponse },
    });

    const request = { method: "GET", mode: "navigate", url: "https://fam-spi-front.web.app/dashboard" };
    const result = await dispatchFetch(fetchHandler(), request);

    expect(fetchMock).toHaveBeenCalledWith(request);
    expect(result).toBe(okResponse);
    expect(stores.get("spi-shell-v1").get("/index.html")).toBeDefined();
  });

  test("HTML de navegacion sin internet: sirve el shell guardado en vez de fallar", async () => {
    const { fetchHandler, stores } = loadServiceWorker({ networkError: new TypeError("Failed to fetch") });
    const cachedShell = { ok: true, cached: true };
    stores.set("spi-shell-v1", new Map([["/index.html", cachedShell]]));

    const request = { method: "GET", mode: "navigate", url: "https://fam-spi-front.web.app/dashboard/comercial" };
    const result = await dispatchFetch(fetchHandler(), request);

    expect(result).toBe(cachedShell);
  });

  test("HTML de navegacion sin internet y sin shell guardado: sirve el fallback offline", async () => {
    const networkError = new TypeError("Failed to fetch");
    const offlineFallback = { ok: true, offline: true };
    const { fetchHandler, stores } = loadServiceWorker({ networkError });
    stores.set("spi-shell-v1", new Map([["/offline.html", offlineFallback]]));

    const request = { method: "GET", mode: "navigate", url: "https://fam-spi-front.web.app/dashboard" };
    const result = await dispatchFetch(fetchHandler(), request);

    expect(result).toBe(offlineFallback);
  });

  test("assets con hash en /static/: cache-first, no vuelve a pedir red si ya esta cacheado", async () => {
    const { fetchHandler, fetchMock, stores } = loadServiceWorker();
    const url = "https://fam-spi-front.web.app/static/js/main.abc123.js";
    const request = { method: "GET", mode: "no-cors", url };

    await dispatchFetch(fetchHandler(), request);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(stores.get("spi-assets-v1").get(url)).toBeDefined();

    fetchMock.mockClear();
    await dispatchFetch(fetchHandler(), request);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("nunca intercepta llamadas a la API (otro origen)", () => {
    const { fetchHandler } = loadServiceWorker();
    const request = {
      method: "GET",
      mode: "cors",
      url: "https://spi-backend-983537733948.us-central1.run.app/api/v1/clients",
    };
    const result = dispatchFetch(fetchHandler(), request);
    expect(result).toBeNull();
  });

  test("nunca intercepta POST/PUT/DELETE (marcaciones de asistencia deben ir directo a la red)", () => {
    const { fetchHandler } = loadServiceWorker();
    const request = { method: "POST", mode: "cors", url: "https://fam-spi-front.web.app/static/does-not-matter" };
    const result = dispatchFetch(fetchHandler(), request);
    expect(result).toBeNull();
  });
});
