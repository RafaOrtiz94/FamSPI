const express = require("express");
const rateLimit = require("express-rate-limit");
const controller = require("./suggestionBox.controller");

const router = express.Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Has alcanzado el límite temporal de envíos. Intenta nuevamente más tarde." },
});

router.post("/submissions", limiter, controller.createPublicSubmission);

module.exports = router;
