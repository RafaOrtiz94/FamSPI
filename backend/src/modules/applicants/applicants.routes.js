const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const ctrl = require("./applicants.controller");
const applicantsApiKey = require("../../middlewares/applicantsApiKey");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

const importLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: "Rate limit exceeded",
  },
});

router.use(express.json({ limit: "5mb" }));

const thRoles = ["talento_humano", "gerencia", "gerencia_general", "admin"];

router.get("/", ctrl.listApplicants);
// Antes de "/:id" para que "orphans" no se interprete como id.
router.get("/orphans", verifyToken, requireRole(thRoles), ctrl.listOrphanApplicants);
router.get("/:id", ctrl.getApplicantById);
router.patch("/:id/personnel-request", verifyToken, requireRole(thRoles), ctrl.linkApplicantToRequest);

router.post("/import", importLimiter, applicantsApiKey, ctrl.importApplicant);

router.post(
  "/sync-from-sheet",
  verifyToken,
  requireRole(["talento_humano", "gerencia"]),
  ctrl.syncApplicantsFromSheet,
);

module.exports = router;
