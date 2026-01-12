const express = require("express");
const router = express.Router();
const controller = require("./permisos.controller");
const { verifyToken } = require("../../middlewares/auth");

router.use(verifyToken);

// Crear solicitud (permiso o vacación)
router.post("/", controller.create);

// Aprobación parcial (jefe)
router.post("/:id/aprobar-parcial", controller.aprobarParcial);

// Subir justificantes (colaborador) - con multer para archivos
router.post("/:id/justificantes", controller.upload.any(), controller.uploadJustificantes);

// Aprobación final (jefe)
router.post("/:id/aprobar-final", controller.aprobarFinal);

// Rechazar
router.post("/:id/rechazar", controller.rechazar);

// Listar pendientes (jefes)
router.get("/pendientes", controller.listarPendientes);

// Listar mis solicitudes
router.get("/mis-solicitudes", controller.listarMias);

module.exports = router;
