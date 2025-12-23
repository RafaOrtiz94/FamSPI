const express = require("express");
const controller = require("./vacaciones.controller");
const { verifyToken } = require("../../middlewares/auth");

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(verifyToken);

router.post("/", controller.create);
router.get("/", controller.list);
router.patch("/:id/status", controller.updateStatus);
router.get("/summary/data", controller.getSummary);

module.exports = router;
