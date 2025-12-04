const express = require("express");
const router = express.Router({ mergeParams: true });
const controller = require("./permisos.controller");
const { auth } = require("../../middlewares/auth");

router.use(auth);

router.post("/", controller.crearSolicitud);
router.get("/pending", controller.listarPendientes);
router.post("/:id/aprobar-parcial", controller.aprobarParcial);
router.post("/:id/justificantes", controller.subirJustificantes);
router.post("/:id/aprobar-final", controller.aprobarFinal);
router.post("/:id/rechazar", controller.rechazar);

module.exports = router;
