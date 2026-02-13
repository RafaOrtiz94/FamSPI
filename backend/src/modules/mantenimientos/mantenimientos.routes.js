const express = require("express");
const router = express.Router();
const ctrl = require("./mantenimientos.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const multer = require("multer");

const upload = multer({ 
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, '/tmp/uploads')
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, file.fieldname + '-' + uniqueSuffix)
    }
  })
});

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
router.post("/:id/sign-advanced", verifyToken, requireRole(["gerencia", "tecnico"]), ctrl.signAdvanced);

// ✅ Aprobar mantenimiento (gerencia)
router.post("/:id/approve", verifyToken, requireRole(["gerencia"]), ctrl.approve);

// 📄 Exportar a PDF manualmente
router.post("/:id/export", verifyToken, requireRole(["tecnico", "gerencia"]), ctrl.exportPdf);

module.exports = router;
