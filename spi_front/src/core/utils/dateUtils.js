/**
 * Utilitarios seguros para manejo de fechas en FamSPI
 * Previene "Invalid Date" con validaciones robustas
 */

// Cache para Intl.DateTimeFormat para mejor performance
const dateTimeFormatter = new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
});

/**
 * Valida si un valor puede convertirse en una fecha válida
 * @param {*} value - Valor a validar (string, number, Date, null, undefined)
 * @returns {boolean} true si es válido
 */
export function isValidDateInput(value) {
    if (value === null || value === undefined || value === "") {
        return false;
    }

    if (value instanceof Date) {
        return !isNaN(value.getTime());
    }

    if (typeof value === "string") {
        // Intentar parsear como ISO string o timestamp string
        const parsed = new Date(value);
        return !isNaN(parsed.getTime());
    }

    if (typeof value === "number") {
        // Timestamp en ms o segundos
        const parsed = new Date(value);
        return !isNaN(parsed.getTime());
    }

    return false;
}

/**
 * Convierte un valor a Date object de forma segura
 * @param {*} value - Valor a convertir
 * @returns {Date|null} Date object válido o null
 */
export function parseToDate(value) {
    if (!isValidDateInput(value)) {
        if (value && typeof value === "object") {
            if (typeof value.toDate === "function") {
                const dateValue = value.toDate();
                return dateValue instanceof Date && !isNaN(dateValue.getTime()) ? dateValue : null;
            }

            if (value.$date) {
                return parseToDate(value.$date);
            }

            if (value.value) {
                return parseToDate(value.value);
            }

            if (value.date) {
                return parseToDate(value.date);
            }

            if (value.timestamp) {
                return parseToDate(value.timestamp);
            }

            if (typeof value.seconds === "number") {
                const dateValue = new Date(value.seconds * 1000);
                return !isNaN(dateValue.getTime()) ? dateValue : null;
            }

            if (typeof value._seconds === "number") {
                const dateValue = new Date(value._seconds * 1000);
                return !isNaN(dateValue.getTime()) ? dateValue : null;
            }

            if (typeof value.ms === "number") {
                const dateValue = new Date(value.ms);
                return !isNaN(dateValue.getTime()) ? dateValue : null;
            }
        }

        return null;
    }

    if (value instanceof Date) {
        return value;
    }

    // Intentar diferentes formatos
    let date;

    if (typeof value === "string") {
        // Primero intentar como ISO string
        date = new Date(value);
        if (!isNaN(date.getTime())) {
            return date;
        }

        // Si es un string numérico, intentar como timestamp
        const numValue = Number(value);
        if (!isNaN(numValue)) {
            date = new Date(numValue);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }

        return null;
    }

    if (typeof value === "number") {
        date = new Date(value);
        return !isNaN(date.getTime()) ? date : null;
    }

    return null;
}

/**
 * Formatea fecha + hora para Ecuador
 * @param {*} value - Valor de fecha
 * @param {string} fallback - Texto cuando es inválido
 * @returns {string} Fecha formateada o fallback
 */
export function formatDateTimeEC(value, fallback = "Fecha no disponible") {
    const date = parseToDate(value);
    if (!date) {
        return fallback;
    }

    try {
        return dateTimeFormatter.format(date);
    } catch (error) {
        console.warn("[dateUtils] Error formateando fecha-hora:", error, value);
        return fallback;
    }
}

/**
 * Formatea solo fecha para Ecuador
 * @param {*} value - Valor de fecha
 * @param {string} fallback - Texto cuando es inválido
 * @returns {string} Fecha formateada o fallback
 */
export function formatDateEC(value, fallback = "Fecha no disponible") {
    const date = parseToDate(value);
    if (!date) {
        return fallback;
    }

    try {
        return dateFormatter.format(date);
    } catch (error) {
        console.warn("[dateUtils] Error formateando fecha:", error, value);
        return fallback;
    }
}

/**
 * Formatea solo hora para Ecuador
 * @param {*} value - Valor de fecha
 * @param {string} fallback - Texto cuando es inválido
 * @returns {string} Hora formateada o fallback
 */
export function formatTimeEC(value, fallback = "--:--") {
    const date = parseToDate(value);
    if (!date) {
        return fallback;
    }

    try {
        return timeFormatter.format(date);
    } catch (error) {
        console.warn("[dateUtils] Error formateando hora:", error, value);
        return fallback;
    }
}

/**
 * Alias para compatibilidad - formato completo
 */
export const safeFormatDateTime = formatDateTimeEC;

/**
 * Alias para compatibilidad - formato fecha
 */
export const safeFormatDate = formatDateEC;

/**
 * Alias para compatibilidad - formato hora
 */
export const safeFormatTime = formatTimeEC;
