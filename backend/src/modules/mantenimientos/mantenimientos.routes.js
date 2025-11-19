const express = require("express");
const router = express.Router();
const ctrl = require("./mantenimientos.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });

// 🧾 Crear mantenimiento (ficha + firma)
router.post(
  "/",
  verifyToken,
  requireRole(["tecnico"]),
  upload.fields([
    { name: "firma_responsable", maxCount: 1 },
    { name: "firma_receptor", maxCount: 1 },
    { name: "evidencias", maxCount: 10 },
  ]),
  ctrl.createMantenimiento
);

// 📋 Listar mantenimientos del técnico o general
router.get("/", verifyToken, ctrl.listMantenimientos);

// 🔍 Detalle completo
router.get("/:id", verifyToken, ctrl.getDetail);

// 🖊️ Firmar posteriormente
router.post("/:id/sign", verifyToken, requireRole(["gerencia", "tecnico"]), ctrl.sign);

// ✅ Aprobar mantenimiento (gerencia)
router.post("/:id/approve", verifyToken, requireRole(["gerencia"]), ctrl.approve);

// 📄 Exportar a PDF manualmente
router.post("/:id/export", verifyToken, requireRole(["tecnico", "gerencia"]), ctrl.exportPdf);

module.exports = router;
