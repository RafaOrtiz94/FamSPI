/**
 * setupProxy.js
 * ------------------------------------------------------------
 * Proxy seguro para desarrollo local (CRA → Express backend)
 * - Redirige /api → http://localhost:3000
 * - Evita CORS
 * - Mantiene cabeceras reales (X-Forwarded-* habilitado)
 */

const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:3000", // 🧠 Backend Express
      changeOrigin: true,
      secure: false, // permite certificados locales
      xfwd: true, // mantiene IP original en req.ip
      logLevel: "warn", // o "debug" si necesitas depurar
      onProxyReq: (proxyReq, req) => {
        // Limpieza de cabeceras problemáticas
        proxyReq.removeHeader("Origin");
        proxyReq.removeHeader("Referer");
      },
      pathRewrite: {
        "^/api": "/api", // mantiene prefijo consistente
      },
    })
  );
};
