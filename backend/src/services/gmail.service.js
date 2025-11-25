/**
 * ============================================================
 * 📧 Gmail API Service - Envío de correos con OAuth 2.0
 * ============================================================
 * Permite enviar emails desde la cuenta del usuario autenticado
 * sin usar SMTP, compatible con 2FA de Google Workspace
 * ============================================================
 */

const { google } = require('googleapis');
const db = require('../config/db');
const logger = require('../config/logger');

// IMPORTANTE: Usar el mismo oauth2Client que se usa para login
// para evitar inconsistencias en redirect_uri
const { oauth2Client } = require('../config/oauth');


/**
 * Genera la URL de autorización para que el usuario conceda acceso
 * @param {string} userEmail - Email del usuario
 * @returns {string} URL de autorización
 */
const getAuthUrl = (userEmail) => {
    const scopes = [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.compose'
    ];

    // IMPORTANTE: Especificar explícitamente la redirect_uri para Gmail
    const gmailRedirectUri = process.env.GMAIL_REDIRECT_URI || `${process.env.BACKEND_URL}/api/gmail/auth/callback`;

    return oauth2Client.generateAuthUrl({
        access_type: 'offline', // Solicita refresh token
        scope: scopes,
        state: Buffer.from(userEmail).toString('base64'), // Pasamos el email en el state
        prompt: 'consent', // Fuerza el consentimiento para obtener refresh token
        redirect_uri: gmailRedirectUri // Especificar la URI de Gmail
    });
};

/**
 * Intercambia el código de autorización por tokens
 * @param {string} code - Código de autorización
 * @returns {Object} Tokens de acceso y refresh
 */
const getTokensFromCode = async (code) => {
    // IMPORTANTE: Pasar la misma redirect_uri que se usó en generateAuthUrl
    const gmailRedirectUri = process.env.GMAIL_REDIRECT_URI || `${process.env.BACKEND_URL}/api/gmail/auth/callback`;

    const { tokens } = await oauth2Client.getToken({
        code,
        redirect_uri: gmailRedirectUri
    });

    logger.info(`[GMAIL] Tokens obtenidos del código de autorización`, {
        hasAccessToken: Boolean(tokens.access_token),
        hasRefreshToken: Boolean(tokens.refresh_token),
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'N/A',
    });
    return tokens;
};

/**
 * Guarda los tokens del usuario en la base de datos
 * @param {number} userId - ID del usuario
 * @param {string} email - Email del usuario
 * @param {Object} tokens - Tokens de OAuth
 */
const saveUserTokens = async (userId, email, tokens) => {
    const query = `
    INSERT INTO user_gmail_tokens (user_id, email, access_token, refresh_token, expiry_date, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expiry_date = EXCLUDED.expiry_date,
      updated_at = NOW()
  `;

    await db.query(query, [
        userId,
        email,
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date ? new Date(tokens.expiry_date) : null
    ]);

    logger.info(`✅ Tokens guardados para usuario ${email}`);
};

/**
 * Obtiene los tokens del usuario desde la base de datos
 * @param {number} userId - ID del usuario
 * @returns {Object|null} Tokens del usuario o null si no existen
 */
const getUserTokens = async (userId) => {
    const query = 'SELECT * FROM user_gmail_tokens WHERE user_id = $1';
    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
        return null;
    }

    const tokenData = result.rows[0];

    return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expiry_date: tokenData.expiry_date ? new Date(tokenData.expiry_date).getTime() : null,
        email: tokenData.email || null
    };
};

/**
 * Refresca el access token si está expirado
 * @param {number} userId - ID del usuario
 * @returns {Object} Tokens actualizados
 */
const refreshUserTokens = async (userId) => {
    const tokens = await getUserTokens(userId);

    if (!tokens || !tokens.refresh_token) {
        throw new Error('No hay refresh token disponible. El usuario debe volver a autorizar.');
    }

    // Asegurar que tengamos el email asociado para la fila de tokens
    let userEmail = tokens.email;
    if (!userEmail) {
        const userQuery = 'SELECT email FROM users WHERE id = $1';
        const userResult = await db.query(userQuery, [userId]);
        if (userResult.rows.length === 0) {
            throw new Error(`Usuario ${userId} no encontrado para refrescar tokens`);
        }
        userEmail = userResult.rows[0].email;
    }

    // IMPORTANTE: Configurar la redirect_uri de Gmail antes de refrescar
    const gmailRedirectUri = process.env.GMAIL_REDIRECT_URI || `${process.env.BACKEND_URL}/api/gmail/auth/callback`;
    const originalRedirectUri = oauth2Client.redirectUri;

    try {
        // Temporalmente cambiar la redirect_uri para que coincida con la usada al obtener el token
        oauth2Client.redirectUri = gmailRedirectUri;
        oauth2Client.setCredentials(tokens);

        const { credentials } = await oauth2Client.refreshAccessToken();

        // Guardar los nuevos tokens con el email garantizado
        await saveUserTokens(userId, userEmail, credentials);

        return credentials;
    } finally {
        // Restaurar la redirect_uri original
        oauth2Client.redirectUri = originalRedirectUri;
    }
};

/**
 * Crea un mensaje en formato RFC 2822 para Gmail API
 * @param {Object} emailData - Datos del email
 * @returns {string} Mensaje codificado en base64
 */
const createMessage = ({ from, to, subject, html, text, cc, bcc, replyTo }) => {
    const messageParts = [
        `From: ${from}`,
        `To: ${Array.isArray(to) ? to.join(', ') : to}`,
    ];

    if (cc) {
        messageParts.push(`Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
    }

    if (bcc) {
        messageParts.push(`Bcc: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);
    }

    if (replyTo) {
        messageParts.push(`Reply-To: ${replyTo}`);
    }

    messageParts.push(`Subject: ${subject}`);
    messageParts.push('MIME-Version: 1.0');
    messageParts.push('Content-Type: text/html; charset=utf-8');
    messageParts.push('');
    messageParts.push(html || text || '');

    const message = messageParts.join('\r\n');

    // Codificar en base64url (sin padding)
    return Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

/**
 * Envía un email usando la cuenta Gmail del usuario
 * @param {Object} params - Parámetros del email
 * @param {number} params.userId - ID del usuario que envía
 * @param {string} params.to - Destinatario(s)
 * @param {string} params.subject - Asunto del email
 * @param {string} params.html - Contenido HTML del email
 * @param {string} params.text - Contenido en texto plano (opcional)
 * @param {string|Array} params.cc - CC (opcional)
 * @param {string|Array} params.bcc - BCC (opcional)
 * @param {string} params.replyTo - Reply-To (opcional)
 * @returns {Object} Resultado del envío
 */
const sendEmail = async ({ userId, to, subject, html, text, cc, bcc, replyTo }) => {
    try {
        // 1. Obtener tokens del usuario
        let tokens = await getUserTokens(userId);

        if (!tokens) {
            throw new Error(`Usuario ${userId} no ha autorizado el envío de emails. Debe autorizar primero.`);
        }

        // 2. Verificar si el token está expirado y refrescarlo si es necesario
        const now = Date.now();
        if (tokens.expiry_date && tokens.expiry_date < now) {
            logger.info(`Token expirado para usuario ${userId}, refrescando...`);
            tokens = await refreshUserTokens(userId);
        }

        // 3. Configurar cliente OAuth con los tokens del usuario
        oauth2Client.setCredentials(tokens);

        // 4. Obtener el email del usuario desde la BD
        const userQuery = 'SELECT email, fullname FROM users WHERE id = $1';
        const userResult = await db.query(userQuery, [userId]);

        if (userResult.rows.length === 0) {
            throw new Error(`Usuario ${userId} no encontrado`);
        }

        const { email: userEmail, fullname } = userResult.rows[0];
        const fromName = fullname || userEmail;
        const from = `${fromName} <${userEmail}>`;

        // 5. Crear el mensaje
        const encodedMessage = createMessage({
            from,
            to,
            subject,
            html,
            text,
            cc,
            bcc,
            replyTo: replyTo || userEmail
        });

        // 6. Enviar el email usando Gmail API
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const response = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage
            }
        });

        logger.info(`✅ Email enviado exitosamente desde ${userEmail} a ${to}`);

        return {
            success: true,
            messageId: response.data.id,
            threadId: response.data.threadId,
            from: userEmail,
            to,
            subject
        };

    } catch (error) {
        logger.error('[GMAIL] Error enviando email', {
            code: error.code,
            status: error.response?.status,
            apiError: error.response?.data?.error,
            apiErrorDescription: error.response?.data?.error_description,
            to,
            subject,
            userId,
        });

        // Si el error es de autenticación, el usuario debe volver a autorizar
        if (error.code === 401 || error.code === 403) {
            throw new Error('Token de acceso inválido o revocado. El usuario debe volver a autorizar.');
        }

        throw error;
    }
};

/**
 * Verifica si un usuario tiene tokens válidos
 * @param {number} userId - ID del usuario
 * @returns {boolean} true si tiene tokens válidos
 */
const hasValidTokens = async (userId) => {
    const tokens = await getUserTokens(userId);
    return tokens !== null && tokens.refresh_token !== null;
};

/**
 * Revoca el acceso de un usuario (elimina sus tokens)
 * @param {number} userId - ID del usuario
 */
const revokeAccess = async (userId) => {
    const tokens = await getUserTokens(userId);

    if (tokens && tokens.access_token) {
        try {
            // Revocar el token en Google
            await oauth2Client.revokeToken(tokens.access_token);
        } catch (error) {
            logger.warn('No se pudo revocar el token en Google:', error.message);
        }
    }

    // Eliminar tokens de la BD
    await db.query('DELETE FROM user_gmail_tokens WHERE user_id = $1', [userId]);

    logger.info(`🔒 Acceso revocado para usuario ${userId}`);
};

module.exports = {
    getAuthUrl,
    getTokensFromCode,
    saveUserTokens,
    getUserTokens,
    refreshUserTokens,
    sendEmail,
    hasValidTokens,
    revokeAccess
};
