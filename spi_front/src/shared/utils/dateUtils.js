/**
 * Utilitarios globales de fechas para FamSPI Frontend
 * Maneja parsing/formatting seguro de fechas, evitando "Invalid Date"
 */

import { parseISO, isValid, format } from 'date-fns';

// Placeholders estándar
export const PLACEHOLDER_DATE = '—';
export const PLACEHOLDER_TIME = '--:--';
export const PLACEHOLDER_DATE_TIME = '—';

/**
 * Convierte input a Date object válido o null
 * @param {*} input - Date, string, number, null, undefined
 * @returns {Date|null} Date válido o null si no parseable
 */
export function toDate(input) {
  if (!input || input === 'null' || input === 'undefined') return null;

  // Si ya es Date y válido
  if (input instanceof Date && !isNaN(input)) {
    return input;
  }

  // Si es string, intenta parseISO (maneja ISO strings)
  if (typeof input === 'string') {
    try {
      const parsed = parseISO(input);
      return isValid(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  // Si es número (timestamp), determina si segundos o ms
  if (typeof input === 'number') {
    // < 10^12 probablemente segundos, sino ms
    const timestamp = input < 1e12 ? input * 1000 : input;
    const date = new Date(timestamp);
    return isValid(date) ? date : null;
  }

  return null;
}

/**
 * Formatea fecha de manera segura (solo fecha)
 * @param {*} input - Input para toDate
 * @param {string} formatStr - Formato date-fns (default: 'dd/MM/yyyy')
 * @param {string} placeholder - Placeholder si inválido (default: PLACEHOLDER_DATE)
 * @returns {string} Fecha formateada o placeholder si inválida
 */
export function formatDateSafe(input, formatStr = 'dd/MM/yyyy', placeholder = PLACEHOLDER_DATE) {
  const date = toDate(input);
  if (!date) return placeholder;

  try {
    return format(date, formatStr);
  } catch {
    return placeholder;
  }
}

/**
 * Formatea fecha y hora de manera segura
 * @param {*} input - Input para toDate
 * @param {string} formatStr - Formato date-fns (default: 'dd/MM/yyyy HH:mm')
 * @param {string} placeholder - Placeholder si inválido (default: PLACEHOLDER_DATE_TIME)
 * @returns {string} Fecha/hora formateada o placeholder si inválida
 */
export function formatDateTimeSafe(input, formatStr = 'dd/MM/yyyy HH:mm', placeholder = PLACEHOLDER_DATE_TIME) {
  const date = toDate(input);
  if (!date) return placeholder;

  try {
    return format(date, formatStr);
  } catch {
    return placeholder;
  }
}

/**
 * Formatea hora de manera segura
 * @param {*} input - Input para toDate
 * @param {string} formatStr - Formato date-fns (default: 'HH:mm')
 * @param {string} placeholder - Placeholder si inválido (default: PLACEHOLDER_TIME)
 * @returns {string} Hora formateada o placeholder si inválida
 */
export function formatTimeSafe(input, formatStr = 'HH:mm', placeholder = PLACEHOLDER_TIME) {
  const date = toDate(input);
  if (!date) return placeholder;

  try {
    return format(date, formatStr);
  } catch {
    return placeholder;
  }
}

/**
 * Valida si input puede convertirse a fecha válida
 * @param {*} input - Input para toDate
 * @returns {boolean} true si es fecha válida
 */
export function isValidDateInput(input) {
  return toDate(input) !== null;
}

/**
 * Verifica si una fecha es válida y tiene getTime() válido
 * @param {*} input - Input para toDate
 * @returns {boolean} true si es fecha con tiempo válido (no NaN)
 */
export function isValidDateWithTime(input) {
  const date = toDate(input);
  return date !== null && !isNaN(date.getTime());
}

/**
 * Convierte a ISO string si es fecha válida, null si no
 * @param {*} input - Input para toDate
 * @returns {string|null} ISO string o null
 */
export function toISOStringSafe(input) {
  const date = toDate(input);
  return date ? date.toISOString() : null;
}

/**
 * Formatea para input type="date" (yyyy-MM-dd)
 * @param {*} input - Input para toDate
 * @returns {string} Fecha en formato yyyy-MM-dd o empty string si inválida
 */
export function formatDateForInput(input) {
  const date = toDate(input);
  if (!date) return '';
  
  try {
    return format(date, 'yyyy-MM-dd');
  } catch {
    return '';
  }
}
