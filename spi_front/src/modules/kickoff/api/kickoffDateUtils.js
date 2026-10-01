const TZ = 'America/Guayaquil';

/** Display a TIMESTAMPTZ string as HH:mm in Ecuador time */
export function formatEcTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-EC', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

/** Display a date string as full date in Ecuador time */
export function formatEcDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-EC', {
    timeZone: TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

/** Convert a TIMESTAMPTZ (ISO) string to a datetime-local input value in Ecuador time */
export function isoToInputEc(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T').slice(0, 16);
}

/** Append Ecuador UTC-5 offset to a bare datetime-local value before sending to the API */
export function inputEcToIso(local) {
  if (!local) return '';
  return `${local}:00-05:00`;
}
