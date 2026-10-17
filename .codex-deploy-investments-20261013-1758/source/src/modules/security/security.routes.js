const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const { SECURITY_DEV_EMITTER_ENABLED } = require("../../config/security");
const {
  getOffHoursLogins,
  getOffHoursLoginTimeline,
  reviewOffHoursLogin,
  exportOffHoursLogins,
} = require("./security.controller");

const router = express.Router();
const ALLOWED_DEV_ENVS = ["development", "sandbox", "test", "dev"];
const isDevEnv = ALLOWED_DEV_ENVS.includes(process.env.NODE_ENV);

router.use("/dev", (req, res, next) => {
  if (!isDevEnv) {
    return res.status(404).json({ ok: false, message: "Not found" });
  }
  return next();
});

router.use(verifyToken);
router.use(requireRole(["ti"]));

if (isDevEnv && SECURITY_DEV_EMITTER_ENABLED) {
  router.post("/dev/emit-offhours", (_req, res) => {
    res.status(501).json({ ok: false, message: "Endpoint de prueba no implementado en este repositorio" });
  });
}

router.get("/offhours-logins/export", exportOffHoursLogins);
router.get("/offhours-logins", getOffHoursLogins);
router.get("/offhours-logins/:id/timeline", getOffHoursLoginTimeline);
router.post("/offhours-logins/:id/review", reviewOffHoursLogin);

module.exports = router;
