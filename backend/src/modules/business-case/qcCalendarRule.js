/**
 * Ultimo recurso para equipos con pocas variables (sin ficha tecnica, sin historial del cliente y sin
 * referencias del mismo tipo de equipo; ej. cobas U 411): controles y calibradores por el calendario
 * del laboratorio que ya trae el BC (bc_lab_environment) y la presentacion del Sheet (DET/KIT).
 *
 * - Control: una unidad por nivel en cada corrida de control.
 *   corridas = dias/semana × semanas del proceso × turnos × controles por turno × niveles.
 * - Calibrador: una unidad por calibracion, cada CALIBRATION_INTERVAL_DAYS dias del proceso.
 *
 * Es una estimacion: en cuanto jefe_servicio valide o justifique el producto, la matriz de conocimiento
 * y las referencias mandan sobre esta regla.
 */

const WEEKS_PER_MONTH = 52 / 12;
const DAYS_PER_MONTH = 365 / 12;
const CALIBRATION_INTERVAL_DAYS = 7;

const positive = (value) => (Number(value) > 0 ? Number(value) : null);
const round = (value, digits = 1) => Number(value.toFixed(digits));

/** Puro. Devuelve { quantity, basis: "qc_calendar", detail } o null si faltan datos. */
function predictByQcCalendar({ itemType, unitsPerPack, months, environment }) {
  const pack = positive(unitsPerPack);
  const duration = positive(months);
  if (!pack || !duration) return null;

  if (itemType === "control") {
    const days = positive(environment?.work_days_per_week);
    const shifts = positive(environment?.shifts_per_day);
    const perShift = positive(environment?.quality_controls_per_shift);
    const levels = positive(environment?.control_levels) || 1;
    if (!days || !shifts || !perShift) return null;
    const weeks = duration * WEEKS_PER_MONTH;
    const uses = Math.ceil(days * weeks * shifts * perShift * levels - 1e-9);
    return {
      quantity: Math.ceil(uses / pack - 1e-9),
      basis: "qc_calendar",
      detail: `${days} días/semana × ${round(weeks)} semanas × ${shifts} turno(s) × ${perShift} control(es) por turno × ${levels} nivel(es) = ${uses} usos ÷ ${pack} por presentación`,
    };
  }

  if (itemType === "calibrador") {
    const calibrations = Math.ceil((duration * DAYS_PER_MONTH) / CALIBRATION_INTERVAL_DAYS - 1e-9);
    return {
      quantity: Math.ceil(calibrations / pack - 1e-9),
      basis: "qc_calendar",
      detail: `1 calibración cada ${CALIBRATION_INTERVAL_DAYS} días × ${duration} meses = ${calibrations} calibraciones ÷ ${pack} por presentación`,
    };
  }

  return null;
}

module.exports = { predictByQcCalendar, CALIBRATION_INTERVAL_DAYS };
