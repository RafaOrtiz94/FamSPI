/**
 * Encryption Utility
 * ----------------------------------------------------------
 * Encriptación AES-256-GCM para datos sensibles de clientes
 */

const crypto = require('crypto');

// Clave de encriptación desde variable de entorno
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

/**
 * Encriptar texto
 * @param {string} text - Texto a encriptar
 * @returns {string} - Texto encriptado en formato: iv:authTag:encrypted
 */
function encrypt(text) {
    if (!text) return null;

    try {
        // Generar IV (Initialization Vector) aleatorio
        const iv = crypto.randomBytes(16);

        // Convertir la clave a buffer
        const key = Buffer.from(ENCRYPTION_KEY.substring(0, 64), 'hex');

        // Crear cipher
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        // Encriptar
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Obtener auth tag
        const authTag = cipher.getAuthTag();

        // Retornar en formato: iv:authTag:encrypted
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
        console.error('Error al encriptar:', error);
        throw new Error('Error en la encriptación de datos');
    }
}

/**
 * Desencriptar texto
 * @param {string} encryptedText - Texto encriptado en formato: iv:authTag:encrypted
 * @returns {string} - Texto desencriptado
 */
function decrypt(encryptedText) {
    if (!encryptedText) return null;

    try {
        // Separar componentes
        const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

        if (!ivHex || !authTagHex || !encrypted) {
            throw new Error('Formato de datos encriptados inválido');
        }

        // Convertir de hex a buffer
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const key = Buffer.from(ENCRYPTION_KEY.substring(0, 64), 'hex');

        // Crear decipher
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        // Desencriptar
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Error al desencriptar:', error);
        throw new Error('Error en la desencriptación de datos');
    }
}

/**
 * Encriptar objeto completo
 * @param {Object} obj - Objeto a encriptar
 * @param {Array} fieldsToEncrypt - Campos a encriptar
 * @returns {Object} - Objeto con campos encriptados
 */
function encryptObject(obj, fieldsToEncrypt) {
    const encrypted = { ...obj };

    fieldsToEncrypt.forEach(field => {
        if (encrypted[field]) {
            encrypted[field] = encrypt(encrypted[field]);
        }
    });

    return encrypted;
}

/**
 * Desencriptar objeto completo
 * @param {Object} obj - Objeto encriptado
 * @param {Array} fieldsToDecrypt - Campos a desencriptar
 * @returns {Object} - Objeto con campos desencriptados
 */
function decryptObject(obj, fieldsToDecrypt) {
    const decrypted = { ...obj };

    fieldsToDecrypt.forEach(field => {
        if (decrypted[field]) {
            try {
                decrypted[field] = decrypt(decrypted[field]);
            } catch (error) {
                console.error(`Error desencriptando campo ${field}:`, error);
                decrypted[field] = '[ENCRIPTADO]';
            }
        }
    });

    return decrypted;
}

/**
 * Hash de datos (one-way)
 * @param {string} data - Datos a hashear
 * @returns {string} - Hash SHA-256
 */
function hash(data) {
    if (!data) return null;
    return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = {
    encrypt,
    decrypt,
    encryptObject,
    decryptObject,
    hash
};
