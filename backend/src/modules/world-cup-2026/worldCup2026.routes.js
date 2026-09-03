const express = require("express");
const rateLimit = require("express-rate-limit");
const controller = require("./worldCup2026.controller");

const router = express.Router();

const publicSubmissionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: "Has alcanzado el límite temporal de envíos. Intenta de nuevo en un minuto.",
  },
});

router.get("/public/portal", controller.getPublicPortal);
router.get("/public/participant", controller.getPublicParticipant);
router.get("/public/live-board", controller.getLiveBoard);
router.get("/public/live-stream", controller.streamLiveBoard);
router.post("/public/submissions", publicSubmissionLimiter, controller.createPublicSubmission);

module.exports = router;
