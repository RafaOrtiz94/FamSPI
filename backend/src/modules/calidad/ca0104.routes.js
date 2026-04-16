const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./ca0104.controller");

/**
 * Routes - CA-01-04 (Control de Plagas)
 * Prefijo montado en: /api/v1/calidad/pest-control
 */

router.use(verifyToken);

// Traps map
router.post("/traps-map", requireRole(["calidad"]), ctrl.createTrapsMap);
router.get("/traps-map", requireRole(["calidad", "gerencia"]), ctrl.listTrapsMaps);
router.put("/traps-map/:recordId", requireRole(["calidad"]), ctrl.transitionRecord);

// Inspections
router.post("/inspections", requireRole(["calidad", "servicio_tecnico", "operaciones"]), ctrl.createInspection);
router.get("/inspections", requireRole(["calidad", "gerencia"]), ctrl.listInspections);
router.put("/inspections/:recordId", requireRole(["calidad"]), ctrl.transitionRecord);

// Vendor API
router.post("/vendor-api", requireRole(["calidad", "ti"]), ctrl.createVendorApi);
router.get("/vendor-api", requireRole(["calidad", "gerencia", "ti"]), ctrl.listVendorApis);
router.put("/vendor-api/:recordId", requireRole(["calidad"]), ctrl.transitionRecord);

// Toxicity
router.post("/toxicity", requireRole(["calidad", "servicio_tecnico"]), ctrl.createToxicity);
router.get("/toxicity", requireRole(["calidad", "gerencia"]), ctrl.listToxicity);
router.put("/toxicity/:recordId", requireRole(["calidad"]), ctrl.transitionRecord);

// Soft delete / archive
router.delete("/:recordId", requireRole(["calidad"]), ctrl.softDeleteRecord);

module.exports = router;
