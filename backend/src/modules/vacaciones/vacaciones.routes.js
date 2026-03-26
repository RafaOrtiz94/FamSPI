const express = require("express");
const controller = require("./vacaciones.controller");
const { verifyToken } = require("../../middlewares/auth");

const router = express.Router();

// Verificación legal pública por token
router.get("/legal-verification/:token", controller.verifyLegalToken);

// Aplicar autenticación a todas las rutas
router.use(verifyToken);

router.post("/", controller.create);
router.get("/", controller.list);
router.patch("/:id/status", controller.updateStatus);
router.post("/:id/cancel", controller.cancel);
router.patch("/:id/dates", controller.updateDates);
router.post("/:id/cancel/review", controller.reviewCancel);
router.get("/summary/data", controller.getSummary);

module.exports = router;
