// Rutas PUBLICAS (sin JWT) de las campanas: baja, apertura y clic. Se identifican por el token
// aleatorio del destinatario. Montadas en /api/v1/crm-campaigns (ver registerRoutes y publicPaths).
const express = require("express");
const delivery = require("./crmCampaignDelivery.service");

const router = express.Router();

const page = (title, message, form = "") => `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${title}</title></head>
<body style="margin:0;background:#f3f5f7;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:480px;margin:64px auto;background:#fff;border:1px solid #dce3e9;border-radius:12px;padding:32px;text-align:center;">
<h1 style="font-size:20px;color:#172b3a;margin:0 0 12px;">${title}</h1>
<p style="font-size:15px;line-height:1.6;color:#586a79;margin:0 0 20px;">${message}</p>${form}
<p style="font-size:12px;color:#94a3b8;margin:24px 0 0;">Famproject Cia. Ltda.</p></div></body></html>`;

// GET solo muestra la confirmacion: asi los escaneres de enlaces del correo no dan de baja a nadie.
router.get("/unsubscribe/:token", async (req, res) => {
  const found = await delivery.findByToken(req.params.token).catch(() => null);
  if (!found) return res.status(404).type("html").send(page("Enlace no valido", "Este enlace de baja no es valido o ya no esta disponible."));
  const form = `<form method="POST" action="/api/v1/crm-campaigns/unsubscribe/${req.params.token}">
<button type="submit" style="background:#2458d3;color:#fff;border:0;border-radius:8px;padding:12px 24px;font-size:15px;cursor:pointer;">Confirmar baja</button></form>`;
  return res.type("html").send(page("Darte de baja", "Confirma para dejar de recibir correos de campanas de Famproject.", form));
});

// POST sirve tanto al boton de la pagina como a la baja de un clic (RFC 8058) del cliente de correo.
router.post("/unsubscribe/:token", express.urlencoded({ extended: false }), async (req, res) => {
  const ok = await delivery.unsubscribeByToken(req.params.token).catch(() => false);
  if (!ok) return res.status(404).type("html").send(page("Enlace no valido", "Este enlace de baja no es valido o ya no esta disponible."));
  return res.type("html").send(page("Baja confirmada", "Ya no recibiras mas correos de campanas de Famproject."));
});

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
router.get("/open/:file", async (req, res) => {
  const token = String(req.params.file || "").replace(/\.gif$/i, "");
  await delivery.trackOpen(token).catch(() => {});
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" });
  return res.send(GIF);
});

router.get("/click/:token/:index", async (req, res) => {
  const url = await delivery.resolveClick(req.params.token, req.params.index).catch(() => null);
  if (!url) return res.status(404).type("html").send(page("Enlace no disponible", "Este enlace ya no esta disponible."));
  return res.redirect(302, url);
});

module.exports = router;
