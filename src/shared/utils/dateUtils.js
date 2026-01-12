/**
 * Utilitarios globales de fechas para FamSPI Frontend
 * Maneja parsing/formatting seguro de fechas, evitando "Invalid Date"
 */

import { parseISO, isValid, format } from 'date-fns';

/**
 * Convierte input a Date object válido o null
 * @param {*} input - Date, string, number, null, undefined
 * @returns {Date|null} Date válido o null si no parseable
 */
export function toDate(input) {
  if (!input) return null;

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
 * @returns {string} Fecha formateada o '—' si inválida
 */
export function formatDateSafe(input, formatStr = 'dd/MM/yyyy') {
  const date = toDate(input);
  if (!date) return '—';

  try {
    return format(date, formatStr);
  } catch {
    return '—';
  }
}

/**
 * Formatea fecha y hora de manera segura
 * @param {*} input - Input para toDate
 * @param {string} formatStr - Formato date-fns (default: 'dd/MM/yyyy HH:mm')
 * @returns {string} Fecha/hora formateada o '—' si inválida
 */
export function formatDateTimeSafe(input, formatStr = 'dd/MM/yyyy HH:mm') {
  const date = toDate(input);
  if (!date) return '—';

  try {
    return format(date, formatStr);
  } catch {
    return '—';
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
 * Convierte a ISO string si es fecha válida, null si no
 * @param {*} input - Input para toDate
 * @returns {string|null} ISO string o null
 */
export function toISOStringSafe(input) {
  const date = toDate(input);
  return date ? date.toISOString() : null;
}