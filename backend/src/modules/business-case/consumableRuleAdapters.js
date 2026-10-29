/**
 * Adaptadores registrados del motor de reglas de consumibles. Archivo puro (sin base de datos).
 *
 * Regla para agregar uno: la formula y sus parametros deben venir de una fuente ya auditada o de
 * documentacion del fabricante. Cada adaptador declara su fuente y las convenciones que aplica; lo
 * que no esta respaldado se devuelve como `no_rule`, nunca como un valor por defecto.
 *
 * ── Adaptador 1: inmuno-quimica cobas Pro <503+801>, para la DURACION DEL PROCESO ──
 * Fuente: las mismas formulas y parametros (DET/KIT, estabilidad) del libro auditado "TABLA BASE
 * BC.xlsx", pestañas "c303 c503" y " e402 e801" (calculationPackages/immunoChemistryCobasQuantities).
 * El libro calcula para un año de 360 dias:
 *     reactivo:  ROUNDUP( MAX( DET_AÑO / DET_KIT , 360 / estabilidad ) )   si hay demanda
 *     resto:     ROUNDUP( 360 / estabilidad )                              si el producto esta en uso
 * Este adaptador aplica esa misma formula a la duracion del proceso del Business Case:
 *     dias_del_proceso   = meses × 30          (el libro usa año de 360 dias = 12 × 30)
 *     demanda_del_proceso = DET_AÑO × meses / 12
 * No agrega consumo por evento, desperdicio ni reglas de ISE: esos datos siguen sin fuente (plan,
 * seccion 5). Por eso el resultado sale con `verified: false` y validacion pendiente de experto.
 */

const DAYS_PER_MONTH = 30;
const MONTHS_PER_YEAR = 12;
const COBAS_PRO_503_801 = Object.freeze({
  family: "configuracion",
  equipmentCode: "FAM-COBASPRO503801ISE",
  equipmentName: "cobas Pro <503+801> ISE",
});
const COBAS_PRO_SOURCE = Object.freeze({
  type: "audited_workbook",
  title: "TABLA BASE BC.xlsx — pestañas \"c303 c503\" y \" e402 e801\"",
  package: "inmuno-quimica-cobas-pro-c503-e801-cantidades",
  note: "Formula anual auditada, aplicada a la duracion del proceso.",
});
const CONVENTIONS = Object.freeze([
  "Mes de 30 dias (el libro auditado usa año de 360 dias).",
  "La demanda registrada (DET/AÑO/PROCESO) se toma como anual y se lleva a la duracion del proceso.",
  "Sin consumo por evento ni desperdicio: solo demanda de reactivo y vencimiento por estabilidad.",
]);

const noRule = (code, message, details = {}) => ({
  status: "no_rule",
  reason: { code, message, ...details },
  reasons: [{ code, message, ...details }],
  quantity: null,
  unit: null,
  formula: null,
  verified: false,
});

const round = (value, digits = 4) => Number(Number(value).toFixed(digits));

// Necesidad de una fila del libro para la duracion del proceso (sin redondear).
function rowNeed(row, { isReagent, processDays, processDemand }) {
  const stabilityDays = Number(row.stabilityDays);
  const perKit = Number(row.perKit);
  let byStability = processDays / stabilityDays;
  if (row.minimumDividedByPerKit) byStability /= perKit;
  const byDemand = isReagent ? processDemand / perKit : null;
  return {
    sheet: row.sheet,
    cells: row.cells,
    perKit: row.perKit,
    stabilityDays: row.stabilityDays,
    byDemand: byDemand === null ? null : round(byDemand),
    byStability: round(byStability),
    need: isReagent ? Math.max(byDemand, byStability) : byStability,
  };
}

function calculateCobasProProcess(context) {
  const audited = context?.audited || null;
  const rows = Array.isArray(audited?.rows) ? audited.rows : [];
  if (!rows.length) {
    if (audited?.unmodeledReason === "ISE_REQUIRES_VOLUME_RULE") {
      return noRule("ISE_RULE_NOT_DEFINED", "Electrolitos (ISE): su consumo depende del volumen de muestras y aun no tiene regla.");
    }
    if (audited?.unmodeledReason) {
      return noRule("AUDITED_ROW_NOT_CALCULABLE", "El libro auditado no trae estabilidad o presentacion para este producto.");
    }
    return noRule("AUDITED_ROW_NOT_FOUND", "El producto no esta en el libro auditado de este equipo.");
  }

  const months = Number(context.processDurationMonths);
  const processDays = months * DAYS_PER_MONTH;
  const isReagent = context.identity?.itemType === "reactivo";
  const annualDemand = Number(context.annualDemand);
  const hasDemand = Number.isFinite(annualDemand) && annualDemand > 0;
  const inUse = isReagent ? hasDemand : audited.inUse === true;
  const demandIsProcess = context.conventions?.demandBasis === "process";
  let processDemand = 0;
  if (hasDemand) processDemand = demandIsProcess ? annualDemand : (annualDemand * months) / MONTHS_PER_YEAR;

  const base = {
    status: "calculated",
    unit: "producto a entregar (misma unidad del libro auditado)",
    verified: false,
    validation: { status: "pending_expert", conventions: [...CONVENTIONS] },
    annualAuditedQuantity: audited.annualQuantity ?? null,
  };

  if (!inUse) {
    return {
      ...base,
      quantity: 0,
      formula: isReagent
        ? "Sin demanda registrada para el reactivo: cantidad 0 (igual que el libro)."
        : "El producto no esta en uso (ningun reactivo con demanda lo requiere): cantidad 0 (igual que el libro).",
      components: { processDays, processDemand: 0, rows: [] },
    };
  }

  // Un producto compartido por los dos analizadores aparece en ambas pestañas: se entrega una vez,
  // con la mayor de las dos necesidades (mismo criterio que el calculo anual auditado).
  const perRow = rows.map((row) => rowNeed(row, { isReagent, processDays, processDemand }));
  const winner = perRow.reduce((best, entry) => (entry.need > best.need ? entry : best), perRow[0]);
  const quantity = Math.ceil(winner.need - 1e-9);
  const formula = isReagent
    ? `ROUNDUP( MAX( ${round(processDemand)} pruebas del proceso / ${winner.perKit} , (${months} × 30) / ${winner.stabilityDays} ) ) = ${quantity}`
    : `ROUNDUP( (${months} × 30) / ${winner.stabilityDays}${rows.find((r) => r.sheet === winner.sheet && r.minimumDividedByPerKit) ? ` / ${winner.perKit}` : ""} ) = ${quantity}`;

  return {
    ...base,
    quantity,
    formula,
    components: {
      processDays,
      processDemand: round(processDemand),
      rows: perRow.map(({ need, ...entry }) => ({ ...entry, need: round(need) })),
      drivenBy: isReagent && winner.byDemand >= winner.byStability ? "demand" : "stability",
    },
  };
}

const COBAS_PRO_ADAPTERS = ["reactivo", "calibrador", "control", "material"].map((itemType) => Object.freeze({
  id: `cobas-pro-503-801.proceso.${itemType}`,
  version: "2026-10-13.1",
  selector: Object.freeze({ ...COBAS_PRO_503_801, itemType }),
  source: COBAS_PRO_SOURCE,
  // Los parametros salen del libro auditado, no de la ficha tecnica del producto.
  requiresSpec: false,
  calculate: calculateCobasProProcess,
}));

const RULE_ADAPTERS = Object.freeze([...COBAS_PRO_ADAPTERS]);

module.exports = {
  RULE_ADAPTERS,
  DAYS_PER_MONTH,
  __testables: { calculateCobasProProcess, rowNeed, COBAS_PRO_503_801 },
};
