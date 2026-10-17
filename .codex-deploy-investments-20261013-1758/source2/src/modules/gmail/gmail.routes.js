/**
 * ============================================================
 * 🚦 Routes: Gmail OAuth & Email Sending
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const ctrl = require('./gmail.controller');
const { verifyToken } = require('../../middlewares/auth');

/**
 * GET /api/gmail/auth/url
 * Obtiene la URL para autorizar Gmail
 */
router.get('/auth/url', verifyToken, ctrl.getAuthUrl);

/**
 * GET /api/gmail/auth/callback
 * Callback de OAuth (público, sin autenticación)
 */
router.get('/auth/callback', ctrl.oauthCallback);

/**
 * GET /api/gmail/auth/status
 * Verifica si el usuario tiene Gmail autorizado
 */
router.get('/auth/status', verifyToken, ctrl.checkAuthStatus);

/**
 * POST /api/gmail/send
 * Envía un email usando la cuenta del usuario
 * Body: { to, subject, html, text?, cc?, bcc?, replyTo? }
 */
router.post('/send', verifyToken, ctrl.sendEmail);

/**
 * DELETE /api/gmail/auth/revoke
 * Revoca el acceso a Gmail del usuario
 */
router.delete('/auth/revoke', verifyToken, ctrl.revokeAccess);

module.exports = router;
