const express = require("express");
const router = express.Router();
const ctrl = require("./privatePurchases.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

router.post(
  "/",
  verifyToken,
  requireRole(["comercial", "acp_comercial", "backoffice_comercial"]),
  ctrl.createPrivatePurchase,
);
router.get(
  "/",
  verifyToken,
  requireRole([
    "backoffice_comercial",
    "gerencia",
    "gerencia_general",
    "jefe_comercial",
    "comercial",
    "asesor_comercial",
    "acp_comercial",
  ]),
  ctrl.listPrivatePurchases,
);
router.get(
  "/:id",
  verifyToken,
  requireRole(["backoffice_comercial", "comercial", "gerencia", "gerencia_general", "jefe_comercial"]),
  ctrl.getPrivatePurchase,
);
router.post(
  "/:id/offer",
  verifyToken,
  requireRole(["backoffice_comercial"]),
  ctrl.sendOffer,
);
router.post(
  "/:id/offer/signed",
  verifyToken,
  requireRole(["comercial", "gerencia", "jefe_comercial", "gerencia_general"]),
  ctrl.uploadSignedOffer,
);
router.post(
  "/:id/register-client",
  verifyToken,
  requireRole(["comercial"]),
  ctrl.registerClient,
);
router.post(
  "/:id/send-to-acp",
  verifyToken,
  requireRole(["backoffice_comercial"]),
  ctrl.forwardToACP,
);

module.exports = router;
