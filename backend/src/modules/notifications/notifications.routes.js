const express = require("express");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const router = express.Router();
const ctrl = require("./notifications.controller");
const { verifyToken } = require("../../middlewares/auth");

router.use(verifyToken);

// Limitar el endpoint de listado: máx. 20 peticiones/min por usuario.
// Con el polling a 5 min del frontend esto da margen amplio y bloquea loops accidentales.
const notificationsListLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => (req.user?.id ? `uid:${req.user.id}` : ipKeyGenerator(req)),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      ok: false,
      code: "RATE_LIMIT_NOTIFICATIONS",
      message: "Demasiadas peticiones al endpoint de notificaciones. Intenta en un momento.",
    });
  },
});

router.get("/", notificationsListLimiter, ctrl.list);
router.post("/", ctrl.create);
router.patch("/read-all", ctrl.markAll);
router.patch("/:id/read", ctrl.markRead);
router.delete("/clear", ctrl.clear);
router.delete("/:id", ctrl.remove);

module.exports = router;
