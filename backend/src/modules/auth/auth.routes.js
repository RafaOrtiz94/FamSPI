// src/modules/auth/auth.routes.js
/**
 * =====================================================
 * 🔐 Rutas de Autenticación y Sesiones (JWT Header-Based)
 * -----------------------------------------------------
 * - Login OAuth2 con Google → /auth/google → /auth/callback
 * - Tokens se envían por headers: Authorization + x-refresh-token
 * - Auditoría accesible solo para TI / Gerencia
 * =====================================================
 */

const express = require("express");
const router = express.Router();

const controller = require("./auth.controller");
const { verifyToken, requireRole } = require("../../middlewares/auth");

// ======================================================
// 🔓 1️⃣ RUTAS PÚBLICAS
// ======================================================

/**
 * @route GET /api/v1/auth/google
 * @desc Redirige al flujo de autenticación de Google
 */
router.get("/google", controller.googleAuthRedirect);

/**
 * @route GET /api/v1/auth/callback
 * @desc Callback de Google OAuth2 → genera accessToken y refreshToken
 */
router.get("/google/callback", controller.googleCallback);

/**
 * @route POST /api/v1/auth/local
 * @desc Login usuario/contraseña — solo activo cuando SANDBOX_AUTH=true y NODE_ENV != production
 */
router.post("/local", controller.localLogin);

/**
 * @route POST /api/v1/auth/local-login
 * @desc Login usuario/contraseña de PRODUCCION para usuarios sin OAuth
 *       (pasantes). Cada usuario tiene su propio password_hash -- distinto
 *       de /auth/local (sandbox, password compartida, deshabilitado en prod).
 *       Ver docs/plans/pasantes-access-plan.md.
 */
router.post("/local-login", controller.localAuthLogin);

// ======================================================
// 🔒 2️⃣ RUTAS PROTEGIDAS (requieren Authorization: Bearer)
// ======================================================

/**
 * @route GET /api/v1/auth/me
 * @desc Devuelve información del usuario autenticado
 */
router.get("/me", verifyToken, controller.me);

/**
 * @route POST /api/v1/auth/refresh
 * @desc Genera nuevos accessToken/refreshToken
 * @header x-refresh-token: <refreshToken>
 */
router.post("/refresh", controller.refreshToken);

/**
 * @route POST /api/v1/auth/logout
 * @desc Cierra la última sesión activa del usuario
 */
router.post("/logout", verifyToken, controller.logout);

/**
 * @route POST /api/v1/auth/lopdp/accept
 * @desc Registra la aceptación interna de LOPDP (nuevos colaboradores)
 */
router.post("/lopdp/accept", verifyToken, controller.acceptInternalLopdp);

/**
 * @route POST /api/v1/auth/change-password
 * @desc Cambia la password del usuario autenticado (auth_provider=local).
 *       Usado tanto en el flujo obligatorio (must_change_password=true,
 *       tras alta o reset admin) como en cambio voluntario.
 */
router.post("/change-password", verifyToken, controller.changePassword);

// ======================================================
// 🧾 3️⃣ AUDITORÍA DE SESIONES (solo TI / Gerencia)
// ======================================================

/**
 * @route GET /api/v1/auth/sessions
 * @desc Lista todas las sesiones registradas
 * @access Roles: TI / Gerencia
 */
router.get(
  "/sessions",
  verifyToken,
  requireRole(["ti", "gerencia"]),
  controller.listSessions
);

/**
 * @route GET /api/v1/auth/active-users
 * @desc Usuarios actualmente con sesión activa
 * @access Roles: TI / Gerencia
 */
router.get(
  "/active-users",
  verifyToken,
  requireRole(["ti", "gerencia"]),
  controller.activeUsers
);

module.exports = router;
