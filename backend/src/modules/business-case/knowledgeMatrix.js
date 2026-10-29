/**
 * Motivos de justificacion de jefe_servicio y la matriz de conocimiento que dejan. Archivo puro.
 *
 * Cuando PRODUCTO A ENTREGAR del Sheet difiere del motor, jefe_servicio elige UN motivo y escribe UN
 * numero. Con ese numero se recalcula la cantidad; debe cuadrar con el Sheet (dentro de max(1, 10 %)).
 * Asi cada justificacion queda como un dato puntual, no como texto: los motivos transferibles se
 * reutilizan para predecir procesos nuevos (ver referenceConsumption.service y
 * determinationPredictions.service).
 */

const TOLERANCE_SHARE = 0.1;

const ceil = (value) => Math.ceil(Number(value) - 1e-9);
/** Cada entrega parcial va en presentaciones completas. */
const toDeliver = (quantity, deliveries) => {
  const q = Number(quantity);
  if (!Number.isFinite(q) || q <= 0) return 0;
  return deliveries > 1 ? deliveries * ceil(q / deliveries) : ceil(q);
};

const REASONS = Object.freeze({
  monthly_consumption: {
    label: "El laboratorio consume esa cantidad",
    field: "Unidades por mes",
    min: 0,
    transferable: true,
    // Consumo declarado por el laboratorio: es un consumo, no se le suma redondeo de entrega.
    quantity: ({ value, months }) => ceil(value * months),
    describe: ({ value }) => `consume ${value} por mes`,
  },
  analyzers: {
    label: "Más analizadores usan el producto",
    field: "Número de analizadores que lo usan",
    min: 1,
    integer: true,
    transferable: true,
    quantity: ({ value, expected, deliveries }) => toDeliver(expected * value, deliveries),
    describe: ({ value }) => `lo usan ${value} analizadores`,
  },
  extra_per_delivery: {
    label: "Reserva o mínimo por entrega",
    field: "Unidades extra por entrega",
    min: 0,
    integer: true,
    transferable: true,
    quantity: ({ value, expected, deliveries }) => {
      const n = Math.max(deliveries, 1);
      return n * (ceil((expected || 0) / n) + value);
    },
    describe: ({ value }) => `${value} extra por entrega`,
  },
  client_stock: {
    label: "Stock que ya tiene el cliente",
    field: "Unidades en stock",
    min: 0,
    integer: true,
    transferable: false,
    quantity: ({ value, expected, deliveries }) => toDeliver(Math.max((expected || 0) - value, 0), deliveries),
    describe: ({ value }) => `el cliente tiene ${value} en stock`,
  },
  commercial: {
    label: "Decisión comercial",
    field: null,
    transferable: false,
    quantity: null,
    describe: () => "decisión comercial",
  },
});

const httpError = (message) => Object.assign(new Error(message), { status: 400, statusCode: 400, code: "BC_PREDICTION_VALIDATION_INVALID" });

/**
 * Valida un motivo contra la cantidad del Sheet.
 * @returns {{ reason, value, computed, note, summary, transferable }}
 */
function evaluateJustification(justification, { sheetQuantity, expected, months, deliveries, name }) {
  const reason = REASONS[justification?.reason];
  if (!reason) throw httpError(`Elija el motivo de la diferencia en ${name}.`);
  const note = String(justification.note || "").trim();
  if (!reason.field) {
    if (note.length < 10) throw httpError(`Describa la decisión comercial de ${name} (mínimo 10 caracteres).`);
    return { reason: justification.reason, value: null, computed: Number(sheetQuantity), note, summary: `Decisión comercial: ${note}`, transferable: false };
  }
  const value = Number(justification.value);
  if (!Number.isFinite(value) || value < reason.min || (reason.integer && !Number.isInteger(value))) {
    throw httpError(`${reason.field} de ${name}: valor no válido.`);
  }
  const computed = reason.quantity({ value, expected: Number(expected) || 0, months: Number(months) || 0, deliveries: Math.max(Number(deliveries) || 1, 1) });
  const sheet = Number(sheetQuantity);
  if (Math.abs(computed - sheet) > Math.max(1, TOLERANCE_SHARE * sheet)) {
    throw httpError(`Con ${reason.describe({ value })} la cantidad da ${computed} y PRODUCTO A ENTREGAR dice ${sheet}: ajuste el dato.`);
  }
  const summary = `${reason.label}: ${reason.describe({ value })} → ${computed}${note ? ` (${note})` : ""}`;
  return { reason: justification.reason, value, computed, note: note || null, summary, transferable: reason.transferable };
}

/** Lista para la pantalla: motivo, etiqueta y dato que pide. */
const reasonCatalog = () => Object.entries(REASONS).map(([key, reason]) => ({
  key, label: reason.label, field: reason.field, min: reason.min ?? null, integer: reason.integer === true, transferable: reason.transferable,
}));

module.exports = { REASONS, TOLERANCE_SHARE, evaluateJustification, reasonCatalog, toDeliver };
