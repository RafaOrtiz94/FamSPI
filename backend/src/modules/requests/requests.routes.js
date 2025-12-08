/**
 * ============================================================
 * 🚦 Routes: Requests (Solicitudes)
 * ------------------------------------------------------------
 * Gestiona el flujo completo de solicitudes:
 * creación, listado, detalle, reenvío y cancelación.
 * Incluye control de acceso por roles y carga de archivos.
 * ============================================================
 */

const express = require("express");
const router = express.Router();
const ctrl = require("./requests.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const multer = require("multer");

// 📎 Configuración de archivos (en memoria)
const upload = multer({ storage: multer.memoryStorage() });

/* ============================================================
   --- Flujo de Creación de Nuevos Clientes ---
   ============================================================ */

// 🙏 RUTA PÚBLICA para que el cliente otorgue consentimiento LOPDP
router.get("/public/consent/:token", ctrl.grantConsent);

// 🧾 CREAR SOLICITUD DE NUEVO CLIENTE
router.post(
  "/new-client",
  verifyToken,
  requireRole(["comercial", "jefe_comercial"]),
  upload.fields([
    { name: "legal_rep_appointment_file", maxCount: 1 },
    { name: "ruc_file", maxCount: 1 },
    { name: "id_file", maxCount: 1 },
    { name: "operating_permit_file", maxCount: 1 },
  ]),
  ctrl.createClientRequest
);

// 📋 LISTAR SOLICITUDES DE NUEVOS CLIENTES (para Backoffice)
router.get(
  "/new-client",
  verifyToken,
  requireRole(["backoffice_comercial", "gerencia"]),
  ctrl.listClientRequests
);

// 🔍 DETALLE DE SOLICITUD DE NUEVO CLIENTE
router.get(
  "/new-client/:id",
  verifyToken,
  requireRole(["backoffice_comercial", "gerencia", "comercial", "jefe_comercial"]),
  ctrl.getClientRequestById
);

// 🔄 PROCESAR SOLICITUD DE NUEVO CLIENTE (Aprobar/Rechazar)
router.put(
  "/new-client/:id/process",
  verifyToken,
  requireRole(["backoffice_comercial"]),
  ctrl.processClientRequest
);


/* ============================================================
   --- Flujo de Solicitudes Generales ---
   ============================================================ */

/* ============================================================
   🧾 CREAR SOLICITUD
   ------------------------------------------------------------
   Roles: Jefe Comercial
   Adjunta archivos opcionales
============================================================ */
router.post(
  "/",
  verifyToken,
  requireRole(["jefe_comercial", "tecnico"]),
  upload.fields([
    { name: "files", maxCount: 10 },
    { name: "files[]", maxCount: 10 },
  ]),
  ctrl.createRequest
);

/* ============================================================
   📋 LISTAR SOLICITUDES
   ------------------------------------------------------------
   Roles: Todos los autenticados
   (Los datos visibles pueden variar según el rol en el frontend)
============================================================ */
router.get(
  "/",
  verifyToken,
  requireRole(["gerencia", "comercial", "tecnico", "finanzas"]),
  ctrl.listRequests
);

/* ============================================================
   🔍 DETALLE DE SOLICITUD
   ------------------------------------------------------------
   Roles: Todos los autenticados
============================================================ */
router.get(
  "/:id",
  verifyToken,
  requireRole(["gerencia", "comercial", "tecnico", "finanzas"]),
  ctrl.getDetail
);

/* ============================================================
   ♻️ REENVIAR SOLICITUD (tras rechazo)
   ------------------------------------------------------------
   Roles: Jefe Comercial
============================================================ */
router.put(
  "/:id/resubmit",
  verifyToken,
  requireRole(["jefe_comercial"]),
  ctrl.resubmit
);

/* ============================================================
   ❌ CANCELAR SOLICITUD
   ------------------------------------------------------------
   Roles: Jefe Comercial
============================================================ */
router.post(
  "/:id/cancel",
  verifyToken,
  requireRole(["jefe_comercial"]),
  ctrl.cancel
);

module.exports = router;
