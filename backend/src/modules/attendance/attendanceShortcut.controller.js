/**
 * src/modules/attendance/attendanceShortcut.controller.js
 * --------------------------------------------------------
 * 🗣️ Siri Smart Attendance — endpoints para iPhone Shortcuts
 */

const service = require("./attendanceShortcut.service");
const logger = require("../../config/logger");

// ponytail: siempre 200 en fallos de negocio — "Get Contents of URL" de Shortcuts
// aborta con non-2xx y Siri no leería el mensaje. El contrato va en el body.
const runSmartMark = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        ok: false,
        mode: "blocked",
        spoken_message: "No fue posible autenticar la solicitud.",
        display_message: "No autorizado",
        requires_ui: false,
        requires_follow_up: false,
      });
    }

    logger.info(
      { userId: req.user.id, intent: req.body?.intent || null, origin: "ios_shortcut_siri" },
      "[ATTENDANCE][SHORTCUT] run-smart-mark"
    );

    const payload = await service.resolveSmartMark(req);
    return res.status(200).json(payload);
  } catch (err) {
    logger.error({ err }, "[ATTENDANCE][SHORTCUT] Error en run-smart-mark");
    return res.status(200).json({
      ok: false,
      mode: "blocked",
      spoken_message: "No se pudo completar la marcación. Intenta nuevamente.",
      display_message: "Error interno",
      requires_ui: false,
      requires_follow_up: false,
    });
  }
};

const issueToken = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ ok: false, message: "No autorizado" });
    const { token, expires_in } = await service.issueShortcutToken(req.user, { issuedBy: req.user.id });
    logger.info({ userId: req.user.id }, "[ATTENDANCE][SHORTCUT] Token de shortcut emitido");
    return res.status(200).json({ ok: true, token, expires_in });
  } catch (err) {
    logger.error({ err }, "[ATTENDANCE][SHORTCUT] Error emitiendo token");
    return res.status(500).json({ ok: false, message: "Error emitiendo token de shortcut" });
  }
};

// TI/jefe_ti genera el token de otro usuario (no requiere que ese usuario esté logueado)
const adminIssueTokenForUser = async (req, res) => {
  try {
    const targetUserId = Number(req.params.userId);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ ok: false, message: "userId inválido" });
    }

    const result = await service.issueShortcutTokenForUser(targetUserId, { issuedBy: req.user.id });
    if (!result) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

    logger.info(
      { adminUserId: req.user.id, targetUserId },
      "[ATTENDANCE][SHORTCUT] Token de shortcut emitido por TI para otro usuario"
    );
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "[ATTENDANCE][SHORTCUT] Error emitiendo token (admin)");
    return res.status(500).json({ ok: false, message: "Error emitiendo token de shortcut" });
  }
};

const listTokensForUser = async (req, res) => {
  try {
    const targetUserId = Number(req.params.userId);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ ok: false, message: "userId inválido" });
    }
    const tokens = await service.listShortcutTokensForUser(targetUserId);
    return res.status(200).json({ ok: true, data: tokens });
  } catch (err) {
    logger.error({ err }, "[ATTENDANCE][SHORTCUT] Error listando tokens");
    return res.status(500).json({ ok: false, message: "Error listando tokens de shortcut" });
  }
};

const revokeToken = async (req, res) => {
  try {
    const tokenId = Number(req.params.tokenId);
    if (!Number.isFinite(tokenId)) {
      return res.status(400).json({ ok: false, message: "tokenId inválido" });
    }
    const revoked = await service.revokeShortcutToken({ id: tokenId, revokedBy: req.user.id });
    if (!revoked) {
      return res.status(404).json({ ok: false, message: "Token no encontrado o ya revocado" });
    }
    logger.info(
      { adminUserId: req.user.id, tokenId, targetUserId: revoked.user_id },
      "[ATTENDANCE][SHORTCUT] Token revocado por TI"
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[ATTENDANCE][SHORTCUT] Error revocando token");
    return res.status(500).json({ ok: false, message: "Error revocando token de shortcut" });
  }
};

module.exports = { runSmartMark, issueToken, adminIssueTokenForUser, listTokensForUser, revokeToken };
