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

router.post(
  "/new-client/consent-token",
  verifyToken,
  // requireRole eliminado para permitir acceso a todos los usuarios autenticados
  ctrl.sendConsentEmailToken,
);

router.post(
  "/new-client/consent-token/verify",
  verifyToken,
  // requireRole eliminado para permitir acceso a todos los usuarios autenticados
  ctrl.verifyConsentEmailToken,
);

// 🧾 CREAR SOLICITUD DE NUEVO CLIENTE
router.post(
  "/new-client",
  verifyToken,
  upload.fields([
    { name: "legal_rep_appointment_file", maxCount: 1 },
    { name: "ruc_file", maxCount: 1 },
    { name: "id_file", maxCount: 1 },
    { name: "operating_permit_file", maxCount: 1 },
    { name: "consent_evidence_file", maxCount: 1 },
  ]),
  ctrl.createClientRequest
);

// 📋 LISTAR MIS SOLICITUDES DE NUEVOS CLIENTES (para cualquier usuario)
router.get(
  "/new-client/my",
  verifyToken,
  ctrl.listClientRequests // El service filtrará por created_by
);

// 📋 LISTAR TODAS LAS SOLICITUDES DE NUEVOS CLIENTES (para Backoffice)
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

// ✏️ ACTUALIZAR SOLICITUD DE NUEVO CLIENTE (Corrección)
router.put(
  "/new-client/:id",
  verifyToken,
  upload.fields([
    { name: "legal_rep_appointment_file", maxCount: 1 },
    { name: "ruc_file", maxCount: 1 },
    { name: "id_file", maxCount: 1 },
    { name: "operating_permit_file", maxCount: 1 },
    { name: "consent_evidence_file", maxCount: 1 },
  ]),
  ctrl.updateClientRequest
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
  requireRole(["jefe_comercial"]),
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
  requireRole([
    "gerencia",
    "comercial",
    "acp_comercial",
    "backoffice_comercial",
    "tecnico",
    "finanzas",
    "calidad",
    "jefe_calidad",
    "jefe_servicio_tecnico",
    "jefe_tecnico",
    "operaciones",
    "jefe_operaciones",
    "ti",
    "jefe_ti",
    "talento_humano",
    "jefe_talento_humano",
  ]),
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
  requireRole([
    "gerencia",
    "comercial",
    "acp_comercial",
    "backoffice_comercial",
    "tecnico",
    "finanzas",
    "calidad",
    "jefe_calidad",
    "jefe_servicio_tecnico",
    "jefe_tecnico",
    "operaciones",
    "jefe_operaciones",
    "ti",
    "jefe_ti",
    "talento_humano",
    "jefe_talento_humano",
  ]),
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
