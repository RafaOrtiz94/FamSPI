/**
 * Utilitarios para normalización de fechas en respuestas JSON
 * Asegura que todas las fechas salgan como ISO strings válidos
 */

const logger = require("../config/logger");

/**
 * Convierte un valor a ISO string o null
 * @param {*} value - Valor a convertir (Date, string, number, null)
 * @returns {string|null} ISO string válido o null
 */
function toISOOrNull(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    let date;

    if (value instanceof Date) {
        if (!isNaN(value.getTime())) {
            return value.toISOString();
        }
        return null;
    }

    if (typeof value === "string") {
        // Intentar parsear como ISO string existente
        date = new Date(value);
        if (!isNaN(date.getTime())) {
            return date.toISOString();
        }

        // Si es un string numérico, intentar como timestamp
        const numValue = Number(value);
        if (!isNaN(numValue)) {
            date = new Date(numValue);
            if (!isNaN(date.getTime())) {
                return date.toISOString();
            }
        }

        return null;
    }

    if (typeof value === "number") {
        date = new Date(value);
        if (!isNaN(date.getTime())) {
            return date.toISOString();
        }
        return null;
    }

    return null;
}

/**
 * Normaliza fechas profundas en objetos/arrays
 * @param {*} obj - Objeto/array a normalizar
 * @param {Object} options - Opciones de configuración
 * @returns {*} Objeto normalizado
 */
function normalizeDatesDeep(obj, options = {}) {
    const {
        keysToNormalize = [], // Keys específicas a normalizar
        normalizeAllDateKeys = true, // Normalizar keys que terminan en _at o contienen "date"
        normalizeDateObjects = true, // Normalizar objetos Date directos
        logInvalidDates = true, // Loggear fechas inválidas
        endpoint = null // Para logging contextual
    } = options;

    if (obj === null || obj === undefined) {
        return obj;
    }

    if (obj instanceof Date) {
        if (normalizeDateObjects) {
            const iso = toISOOrNull(obj);
            if (iso === null && logInvalidDates) {
                logger.warn(`[date.serializer] Invalid Date object in ${endpoint || 'unknown endpoint'}`);
            }
            return iso;
        }
        return obj;
    }

    if (typeof obj === "string") {
        // No normalizar strings arbitrarios, solo si son keys específicas
        return obj;
    }

    if (typeof obj === "number") {
        // No normalizar números arbitrarios
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => normalizeDatesDeep(item, options));
    }

    if (typeof obj === "object") {
        const normalized = {};

        for (const [key, value] of Object.entries(obj)) {
            let shouldNormalize = false;

            // Normalizar si está en la lista específica
            if (keysToNormalize.includes(key)) {
                shouldNormalize = true;
            }
            // Normalizar si termina en _at (created_at, updated_at, etc.)
            else if (normalizeAllDateKeys && key.endsWith('_at')) {
                shouldNormalize = true;
            }
            // Normalizar si contiene "date" en el nombre
            else if (normalizeAllDateKeys && key.toLowerCase().includes('date')) {
                shouldNormalize = true;
            }
            // Normalizar objetos Date directos
            else if (value instanceof Date && normalizeDateObjects) {
                shouldNormalize = true;
            }

            if (shouldNormalize) {
                const normalizedValue = toISOOrNull(value);
                if (normalizedValue === null && value !== null && logInvalidDates) {
                    logger.warn(`[date.serializer] Invalid date value for key '${key}' in ${endpoint || 'unknown endpoint'}:`, value);
                }
                normalized[key] = normalizedValue;
            } else {
                // Recursivamente normalizar objetos anidados
                normalized[key] = normalizeDatesDeep(value, options);
            }
        }

        return normalized;
    }

    return obj;
}

/**
 * Wrapper conveniente para normalización de respuestas requests
 */
function normalizeRequestDates(obj) {
    return normalizeDatesDeep(obj, {
        endpoint: 'requests',
        keysToNormalize: ['created_at', 'updated_at', 'planned_date']
    });
}

/**
 * Wrapper conveniente para normalización de respuestas attendance
 */
function normalizeAttendanceDates(obj) {
    return normalizeDatesDeep(obj, {
        endpoint: 'attendance',
        keysToNormalize: ['entry_time', 'lunch_start_time', 'lunch_end_time', 'exit_time', 'captured_at']
    });
}

module.exports = {
    toISOOrNull,
    normalizeDatesDeep,
    normalizeRequestDates,
    normalizeAttendanceDates
};