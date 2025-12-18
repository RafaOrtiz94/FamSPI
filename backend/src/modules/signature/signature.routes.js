const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const ctrl = require("./signature.controller");

// POST /api/documents/:id/sign – requiere autenticación corporativa y consentimiento expreso
router.post("/documents/:documentId/sign", verifyToken, ctrl.signDocument);

// GET /api/verificar/:token – endpoint público, solo lectura, rate-limited
router.get("/verificar/:token", ctrl.verifySeal);

module.exports = router;
