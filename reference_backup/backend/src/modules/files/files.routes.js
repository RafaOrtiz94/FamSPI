const express = require("express");
const router = express.Router();
const ctrl = require("./files.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });

// Subir uno o varios archivos
router.post(
  "/upload/:requestId",
  verifyToken,
  requireRole(["tecnico", "comercial", "gerencia"]),
  upload.array("files"),
  ctrl.uploadFiles
);

// Listar adjuntos por solicitud
router.get(
  "/by-request/:requestId",
  verifyToken,
  requireRole(["tecnico", "comercial", "gerencia"]),
  ctrl.listByRequest
);

// Obtener metadatos
router.get("/:fileId/metadata", verifyToken, ctrl.getMetadata);

// Descargar archivo (stream)
router.get("/:fileId/download", verifyToken, ctrl.downloadFile);

// Eliminar (solo gerencia o admin)
router.delete(
  "/:fileId",
  verifyToken,
  requireRole(["gerencia", "admin"]),
  ctrl.deleteFile
);

module.exports = router;
