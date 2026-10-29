/**
 * ============================================================
 * 📧 Gmail Controller - Gestión de OAuth y envío de emails
 * ============================================================
 */

const gmailService = require('../../services/gmail.service');
const { asyncHandler } = require('../../middlewares/asyncHandler');
const { logAction } = require('../../utils/audit');
const logger = require('../../config/logger');

/**
 * Obtiene la URL de autorización para que el usuario autorice Gmail
 */
exports.getAuthUrl = asyncHandler(async (req, res) => {
    const user = req.user;

    const authUrl = gmailService.getAuthUrl(user.email);

    await logAction({
        user_id: user.id,
        module: 'gmail',
        action: 'request_auth_url',
        entity: 'gmail_auth',
        details: { email: user.email }
    });

    res.json({
        ok: true,
        message: 'URL de autorización generada',
        data: {
            authUrl,
            instructions: 'Abre esta URL en el navegador para autorizar el envío de emails desde tu cuenta de Gmail'
        }
    });
});

/**
 * Callback de OAuth - Recibe el código de autorización y guarda los tokens
 */
exports.oauthCallback = asyncHandler(async (req, res) => {
    const { code, state } = req.query;

    if (!code) {
        return res.status(400).json({
            ok: false,
            message: 'Código de autorización no recibido'
        });
    }

    try {
        // Decodificar el email del state
        const userEmail = Buffer.from(state, 'base64').toString('utf-8');

        // Obtener tokens desde Google
        const tokens = await gmailService.getTokensFromCode(code);

        // Buscar el usuario en la BD
        const db = require('../../config/db');
        const userResult = await db.query('SELECT id, email FROM users WHERE email = $1', [userEmail]);

        if (userResult.rows.length === 0) {
            return res.status(404).send(`
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
            <h2 style="color: #dc2626;">❌ Usuario no encontrado</h2>
            <p>No se encontró un usuario con el email: <strong>${userEmail}</strong></p>
            <p>Por favor, contacta al administrador del sistema.</p>
          </body>
        </html>
      `);
        }

        const user = userResult.rows[0];

        // Guardar tokens en la BD
        await gmailService.saveUserTokens(user.id, user.email, tokens);

        await logAction({
            user_id: user.id,
            module: 'gmail',
            action: 'authorize',
            entity: 'gmail_auth',
            details: { email: user.email, success: true }
        });

        logger.info(`✅ Usuario ${user.email} autorizó el envío de emails`);

        // Página de éxito
        res.send(`
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              text-align: center;
              padding: 20px;
            }
            .success-icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h2 {
              color: #10b981;
            }
            .details {
              background: #f3f4f6;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: left;
            }
            . button {
              display: inline-block;
              padding: 12px 24px;
              background: #3b82f6;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="success-icon">✅</div>
          <h2>¡Autorización Exitosa!</h2>
          <p>Tu cuenta de Gmail ha sido autorizada correctamente para enviar correos desde el sistema.</p>
          
          <div class="details">
            <p><strong>Email autorizado:</strong> ${user.email}</p>
            <p><strong>Permisos otorgados:</strong></p>
            <ul style="text-align: left;">
              <li>Enviar emails desde tu cuenta</li>
              <li>Componer mensajes</li>
            </ul>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            Ahora puedes cerrar esta ventana y continuar trabajando en el sistema.
          </p>

          <a href="${process.env.FRONTEND_URL}" class="button">Volver al Sistema</a>
        </body>
      </html>
    `);

    } catch (error) {
        logger.error('❌ Error en callback OAuth:', error);

        res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
          <h2 style="color: #dc2626;">❌ Error de Autorización</h2>
          <p>Ocurrió un error al procesar la autorización:</p>
          <p style="color: #6b7280;"><em>${error.message}</em></p>
          <p>Por favor, intenta nuevamente o contacta al administrador.</p>
          <a href="${process.env.FRONTEND_URL}" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">Volver al Sistema</a>
        </body>
      </html>
    `);
    }
});

/**
 * Verifica si el usuario tiene Gmail autorizado
 */
exports.checkAuthStatus = asyncHandler(async (req, res) => {
    const user = req.user;

    const hasTokens = await gmailService.hasValidTokens(user.id);

    res.json({
        ok: true,
        data: {
            authorized: hasTokens,
            email: user.email,
            message: hasTokens
                ? 'Gmail autorizado. Puedes enviar emails.'
                : 'Gmail no autorizado. Debes autorizar primero.'
        }
    });
});

/**
 * Envía un email usando la cuenta Gmail del usuario
 */
exports.sendEmail = asyncHandler(async (req, res) => {
    const user = req.user;
    const { to, subject, html, text, cc, bcc, replyTo } = req.body;

    // Validaciones
    if (!to || !subject || (!html && !text)) {
        return res.status(400).json({
            ok: false,
            message: 'Faltan campos obligatorios: to, subject, html/text'
        });
    }

    try {
        const result = await gmailService.sendEmail({
            userId: user.id,
            to,
            subject,
            html,
            text,
            cc,
            bcc,
            replyTo
        });

        await logAction({
            user_id: user.id,
            module: 'gmail',
            action: 'send_email',
            entity: 'emails',
            details: { to, subject, messageId: result.messageId }
        });

        res.json({
            ok: true,
            message: 'Email enviado exitosamente',
            data: result
        });

    } catch (error) {
        logger.error('❌ Error enviando email:', error);

        // Si el error es de autorización, indicarlo claramente
        if (error.message.includes('autorizar')) {
            return res.status(403).json({
                ok: false,
                message: error.message,
                needsAuth: true
            });
        }

        throw error;
    }
});

/**
 * Revoca el acceso de Gmail del usuario
 */
exports.revokeAccess = asyncHandler(async (req, res) => {
    const user = req.user;

    await gmailService.revokeAccess(user.id);

    await logAction({
        user_id: user.id,
        module: 'gmail',
        action: 'revoke_access',
        entity: 'gmail_auth',
        details: { email: user.email }
    });

    res.json({
        ok: true,
        message: 'Acceso a Gmail revocado exitosamente'
    });
});

module.exports = exports;
