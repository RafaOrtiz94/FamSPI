const express = require("express");
const multer = require("multer");
const router = express.Router();

const ctrl = require("./userProfile.controller");
const { verifyToken } = require("../../middlewares/auth");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      const err = new Error("Solo se permiten imágenes PNG/JPEG/WEBP");
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

router.use(verifyToken);

router.get("/", ctrl.getMine);
router.post("/", upload.single("avatar"), ctrl.createMine);
router.put("/", upload.single("avatar"), ctrl.updateMine);

// Manejo explícito de errores de carga (tamaño/MIME)
router.use((err, _req, res, next) => {
  if (!err) return next();

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ ok: false, message: "El archivo supera el límite de 2MB" });
  }

  const status = err.status || 500;
  return res.status(status).json({ ok: false, message: err.message || "Error al procesar el archivo" });
});

module.exports = router;
