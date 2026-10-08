/**
 * Utilitarios globales de fechas para FamSPI Frontend
 * Maneja parsing/formatting seguro de fechas, evitando Invalid Date.
 */

import { parseISO, isValid, format } from 'date-fns';

export const PLACEHOLDER_DATE = '-';
export const PLACEHOLDER_TIME = '--:--';
export const PLACEHOLDER_DATE_TIME = '-';
export const ECUADOR_TIMEZONE = 'America/Guayaquil';

/**
 * Convierte input a Date object valido o null
 * @param {*} input - Date, string, number, null, undefined
 * @returns {Date|null} Date valido o null si no parseable
 */
export function toDate(input) {
 if (!input || input === 'null' || input === 'undefined') return null;

 if (input instanceof Date && !isNaN(input)) {
  return input;
 }

 if (typeof input === 'string') {
  try {
   const parsed = parseISO(input);
   return isValid(parsed) ? parsed : null;
  } catch {
   return null;
  }
 }

 if (typeof input === 'number') {
  const timestamp = input < 1e12 ? input * 1000 : input;
  const date = new Date(timestamp);
  return isValid(date) ? date : null;
 }

 return null;
}

const buildZonedFormat = (date, formatStr, timeZone = ECUADOR_TIMEZONE) => {
 const formatter = (options) =>
  new Intl.DateTimeFormat('en-GB', {
   ...options,
   timeZone,
   hour12: false,
  });

 const partsMap = (options) => {
  const parts = formatter(options).formatToParts(date);
  return parts.reduce((acc, part) => {
   if (part.type !== 'literal') acc[part.type] = part.value;
   return acc;
  }, {});
 };

 if (formatStr === 'dd/MM/yyyy') {
  const p = partsMap({ day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${p.day}/${p.month}/${p.year}`;
 }

 if (formatStr === 'HH:mm') {
  const p = partsMap({ hour: '2-digit', minute: '2-digit' });
  return `${p.hour}:${p.minute}`;
 }

 if (formatStr === 'dd/MM/yyyy HH:mm') {
  const p = partsMap({
   day: '2-digit',
   month: '2-digit',
   year: 'numeric',
   hour: '2-digit',
   minute: '2-digit',
  });
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
 }

 if (formatStr === 'yyyy-MM-dd') {
  const p = partsMap({ day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${p.year}-${p.month}-${p.day}`;
 }

 return null;
};

/**
 * Formatea fecha de manera segura (solo fecha)
 */
export function formatDateSafe(input, formatStr = 'dd/MM/yyyy', placeholder = PLACEHOLDER_DATE) {
 const date = toDate(input);
 if (!date) return placeholder;

 try {
  const zoned = buildZonedFormat(date, formatStr);
  if (zoned) return zoned;
  return format(date, formatStr);
 } catch {
  return placeholder;
 }
}

/**
 * Formatea fecha y hora de manera segura
 */
export function formatDateTimeSafe(input, formatStr = 'dd/MM/yyyy HH:mm', placeholder = PLACEHOLDER_DATE_TIME) {
 const date = toDate(input);
 if (!date) return placeholder;

 try {
  const zoned = buildZonedFormat(date, formatStr);
  if (zoned) return zoned;
  return format(date, formatStr);
 } catch {
  return placeholder;
 }
}

/**
 * Formatea hora de manera segura
 */
export function formatTimeSafe(input, formatStr = 'HH:mm', placeholder = PLACEHOLDER_TIME) {
 const date = toDate(input);
 if (!date) return placeholder;

 try {
  const zoned = buildZonedFormat(date, formatStr);
  if (zoned) return zoned;
  return format(date, formatStr);
 } catch {
  return placeholder;
 }
}

export const formatDateSafeEc = formatDateSafe;
export const formatDateTimeSafeEc = formatDateTimeSafe;
export const formatTimeSafeEc = formatTimeSafe;

/**
 * Valida si input puede convertirse a fecha valida
 */
export function isValidDateInput(input) {
 return toDate(input) !== null;
}

/**
 * Verifica si una fecha es valida y tiene getTime() valido
 */
export function isValidDateWithTime(input) {
 const date = toDate(input);
 return date !== null && !isNaN(date.getTime());
}

/**
 * Convierte a ISO string si es fecha valida, null si no
 */
export function toISOStringSafe(input) {
 const date = toDate(input);
 return date ? date.toISOString() : null;
}

/**
 * Formatea para input type=date (yyyy-MM-dd)
 */
export function formatDateForInput(input) {
 const date = toDate(input);
 if (!date) return '';

 try {
  const zoned = buildZonedFormat(date, 'yyyy-MM-dd');
  if (zoned) return zoned;
  return format(date, 'yyyy-MM-dd');
 } catch {
  return '';
 }
}
