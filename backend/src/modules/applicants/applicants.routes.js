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

router.get("/", ctrl.listApplicants);
router.get("/:id", ctrl.getApplicantById);

router.post("/import", importLimiter, applicantsApiKey, ctrl.importApplicant);

router.post(
  "/sync-from-sheet",
  verifyToken,
  requireRole(["talento_humano", "gerencia"]),
  ctrl.syncApplicantsFromSheet,
);

module.exports = router;
