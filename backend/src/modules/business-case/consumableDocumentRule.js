/**
 * Fuente "documento oficial del producto" del motor de reglas de consumibles. Archivo puro.
 *
 * Calcula con lo que declara la ficha tecnica vigente del fabricante (catalog_consumable_specs),
 * mas el ajuste del laboratorio si existe (bc_lab_product_parameters). Aplica a cualquier equipo:
 * los datos son del producto, y el bloque por analizador ya viene resuelto en `manufacturer`.
 *
 * REACTIVO
 *   kits = ROUNDUP( MAX( pruebas_del_proceso / pruebas_por_kit , dias / estabilidad_a_bordo ) )
 *
 * RECETA. La ficha del reactivo dice cada cuanto se calibra y se corre control; de ahi salen los
 * usos de cada calibrador y control vinculado durante el proceso (reagentEvents):
 *   calibraciones = una al inicio y otra cada intervalo de calibracion  [+ una por cambio de lote]
 *   corridas_QC   = dias_de_trabajo × corridas_por_dia  [+ calibraciones] [+ kits]
 *
 * CALIBRADOR, CONTROL
 *   Calibrador: se arma el calendario de calibraciones de todos los reactivos que lo comparten y
 *   se abre un envase cuando hay una calibracion y el envase anterior ya vencio (las que caen
 *   dentro de la estabilidad del mismo envase lo comparten).
 *   Control: una corrida sirve a todas las pruebas que lo comparten, asi que manda el reactivo con
 *   mas corridas; envases = MIN( corridas , ROUNDUP( dias / estabilidad ) ).
 *   Los dos: nunca menos envases que los que agota el volumen:
 *     ROUNDUP( Σ mediciones × volumen_de_muestra_del_reactivo / volumen_del_envase )
 *   Envase de un solo uso: un envase por uso.
 * MATERIAL: la ficha no declara eventos; solo vencimiento por estabilidad.
 *
 * Lo que la ficha no trae NO se rellena: el producto queda `no_rule` con el dato faltante, o el
 * resultado se marca `incomplete` cuando se pudo calcular sin un dato secundario.
 */

const { evaluateEquipmentManual } = require("./consumableEquipmentManual");

const DAYS_PER_MONTH = 30;
const MONTHS_PER_YEAR = 12;
const REPLICATES = Object.freeze({ single: 1, duplicate: 2, triplicate: 3 });

/**
 * Convenciones que cambian las cantidades y que Aplicaciones aun no confirma. Se pueden variar en
 * el laboratorio para ver su efecto. Los valores por defecto y su evidencia estan en la bitacora
 * del plan (docs/plans/motor-consumibles-por-reglas-plan.md).
 *   demandBasis        "annual"   DET/AÑO/PROCESO es anual y se lleva a la duracion del proceso
 *                                 (compra privada: promedio mensual del laboratorio × 12)
 *                      "process"  ya es la demanda de todo el proceso (compra publica)
 *                      Sin valor explicito se decide por el tipo de compra (defaultConventionsFor).
 *   qcBasis            "document"    corridas de control segun el intervalo de la ficha del reactivo
 *                      "laboratory"  segun lo que declaro el laboratorio (controles por turno × turnos)
 *   conservation       "document_best"  si la ficha permite congelar, el envase dura lo que dura congelado
 *                      "open"           el envase queda abierto hasta vencer
 *   reagentStability   "ignored"  solo cuenta la demanda (por defecto: asi lo planifican las hojas reales)
 *                      "counted"  un kit a bordo vence y se repone aunque no se haya agotado
 *   reagentQcTests     "excluded" la demanda registrada ya incluye las pruebas de control y calibracion
 *                      "included" se suman a la demanda las pruebas que gastan controles y calibraciones
 *   reagentLotsPerYear numero de lotes de reactivo por año (null = no se cuentan cambios de lote)
 */
const DEFAULT_CONVENTIONS = Object.freeze({
  demandBasis: "process",
  qcBasis: "document",
  conservation: "document_best",
  reagentStability: "ignored",
  reagentQcTests: "excluded",
  // Evidencia (Hospital General Latacunga, cobas Pro): con 3 lotes/año los calibradores se acercan
  // a lo planificado (error 69 % -> 62 %). Pendiente de confirmar con Aplicaciones.
  reagentLotsPerYear: 3,
});
// Lo que DET/AÑO/PROCESO significa depende del tipo de compra (definido por el usuario,
// 2026-10-14): privado = anual (promedio mensual × 12); publico = cantidad del proceso.
function defaultConventionsFor(bcPurchaseType) {
  const isPublic = String(bcPurchaseType || "").toLowerCase().startsWith("public");
  return { demandBasis: isPublic ? "process" : "annual" };
}

const CONVENTION_OPTIONS = Object.freeze({
  demandBasis: ["process", "annual"],
  qcBasis: ["document", "laboratory"],
  conservation: ["document_best", "open"],
  reagentStability: ["counted", "ignored"],
  reagentQcTests: ["excluded", "included"],
});

const positive = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};
const round = (value, digits = 4) => Number(Number(value).toFixed(digits));
const roundUp = (value) => Math.ceil(value - 1e-9);

// Solo acepta valores conocidos: lo demas vuelve al valor por defecto.
function resolveConventions(conventions) {
  const input = conventions && typeof conventions === "object" ? conventions : {};
  const resolved = { ...DEFAULT_CONVENTIONS };
  Object.entries(CONVENTION_OPTIONS).forEach(([key, options]) => {
    if (options.includes(input[key])) resolved[key] = input[key];
  });
  // Sin el campo se usa el valor por defecto; con el campo vacio (null o 0) no se cuentan lotes.
  if (Object.prototype.hasOwnProperty.call(input, "reagentLotsPerYear")) {
    const lots = positive(input.reagentLotsPerYear);
    resolved.reagentLotsPerYear = lots ? Math.min(lots, 12) : null;
  }
  return resolved;
}

function describeConventions(conventions) {
  const c = resolveConventions(conventions);
  return [
    "Mes de 30 dias.",
    c.demandBasis === "process"
      ? "La demanda registrada (DET/AÑO/PROCESO) se toma como la de todo el proceso."
      : "La demanda registrada (DET/AÑO/PROCESO) se toma como anual y se lleva a la duracion del proceso.",
    c.qcBasis === "laboratory"
      ? "Corridas de control segun lo que declaro el laboratorio (controles por turno × turnos)."
      : "Corridas de control segun el intervalo que declara la ficha del reactivo.",
    c.reagentLotsPerYear
      ? `Se cuenta una calibracion por cambio de lote, con ${c.reagentLotsPerYear} lote(s) de reactivo por año.`
      : "Los cambios de lote de reactivo no se cuentan (no se conoce cuantos lotes habra).",
    c.conservation === "document_best"
      ? "Si la ficha permite congelar el producto, se asume que el laboratorio lo alicuota y congela."
      : "El envase queda abierto hasta vencer; no se alicuota ni congela.",
    c.reagentStability === "ignored"
      ? "Reactivos: solo cuenta la demanda; no se repone por vencimiento a bordo."
      : "Reactivos: un kit a bordo vence y se repone aunque no se haya agotado.",
    c.reagentQcTests === "included"
      ? "Se suman a la demanda del reactivo las pruebas que gastan controles y calibraciones."
      : "La demanda del reactivo ya incluye las pruebas de control y calibracion.",
    "Calibraciones de reactivos que comparten calibrador: empiezan el mismo dia y comparten envase mientras no venza.",
    "El volumen por uso es el de muestra de la ficha del reactivo; no incluye volumen muerto del recipiente.",
  ];
}

const processDemandOf = (annualDemand, months, conventions) => (
  resolveConventions(conventions).demandBasis === "process" ? annualDemand : (annualDemand * months) / MONTHS_PER_YEAR
);

const noRule = (code, message) => ({
  status: "no_rule",
  reason: { code, message },
  reasons: [{ code, message }],
  quantity: null,
  unit: null,
  formula: null,
  verified: false,
});

// Dias (enteros, desde el inicio) en que se calibra: al inicio, cada intervalo y en cada cambio de lote.
function calibrationCalendar(processDays, intervalDays, lotChanges) {
  const days = new Set([0]);
  if (intervalDays) for (let day = intervalDays; day < processDays - 1e-9; day += intervalDays) days.add(Math.floor(day));
  for (let lot = 1; lot <= lotChanges; lot += 1) days.add(Math.floor((lot * processDays) / (lotChanges + 1)));
  return [...days].sort((a, b) => a - b);
}

// Envases que cubren un calendario de usos: se abre uno en el primer uso y sirve mientras no venza.
// Un producto que dura menos de un dia abierto sirve solo a los usos del mismo dia.
function containersForCalendar(days, stabilityDays) {
  const window = Math.max(stabilityDays || 0, 1);
  let containers = 0;
  let coveredUntil = -Infinity;
  [...days].sort((a, b) => a - b).forEach((day) => {
    if (day < coveredUntil) return;
    containers += 1;
    coveredUntil = day + window;
  });
  return containers;
}

// Usos que la ficha de un reactivo con demanda genera durante el proceso. null = no aplica.
function reagentEvents(context = {}) {
  const months = positive(context.processDurationMonths);
  if (!context.spec || !months || !positive(context.annualDemand)) return null;
  const conventions = resolveConventions(context.conventions);
  const processDays = months * DAYS_PER_MONTH;
  const manufacturer = context.manufacturer || {};
  const effective = context.effective || {};
  const environment = context.environment || {};
  const reagent = evaluateOfficialDocument({ ...context, extraTests: 0 });
  const kits = reagent.status === "calculated" ? reagent.quantity : null;

  const calibrationIntervalDays = positive(effective.calibrationIntervalDays);
  const declaredEvents = manufacturer.calibration?.events || [];
  const calibrationDeclared = Boolean(calibrationIntervalDays) || declaredEvents.length > 0;
  const lotChangeDeclared = declaredEvents.includes("reagent_lot_change");
  const lotChanges = lotChangeDeclared && conventions.reagentLotsPerYear
    ? Math.max(roundUp((conventions.reagentLotsPerYear * months) / MONTHS_PER_YEAR) - 1, 0)
    : 0;
  const calibrationDays = calibrationDeclared ? calibrationCalendar(processDays, calibrationIntervalDays, lotChanges) : null;
  const calibrationEvents = calibrationDays ? calibrationDays.length : null;
  const replicates = REPLICATES[manufacturer.calibration?.replicate] || 1;
  const calibrationMeasurements = calibrationEvents === null ? null : calibrationEvents * replicates;

  const qcIntervalHours = positive(effective.qcIntervalHours);
  const workDaysPerWeek = Math.min(positive(environment.work_days_per_week) || 7, 7);
  const workingDays = (processDays * workDaysPerWeek) / 7;
  const operatingHours = Math.min((positive(environment.shifts_per_day) || 0) * (positive(environment.hours_per_shift) || 0), 24) || 24;
  const laboratoryRunsPerDay = (positive(environment.quality_controls_per_shift) || 0) * (positive(environment.shifts_per_day) || 0) || null;
  const useLaboratory = conventions.qcBasis === "laboratory" && laboratoryRunsPerDay !== null;
  let runsPerDay = null;
  if (useLaboratory) runsPerDay = laboratoryRunsPerDay;
  else if (qcIntervalHours) runsPerDay = qcIntervalHours >= 24 ? 24 / qcIntervalHours : roundUp(operatingHours / qcIntervalHours);
  const routineRuns = runsPerDay === null ? null : roundUp(workingDays * runsPerDay);
  const runsAfterCalibration = manufacturer.qcAfterCalibration === true && calibrationEvents !== null ? calibrationEvents : 0;
  const runsPerKit = manufacturer.qcPerKit === true && kits !== null ? kits : 0;
  const qcRuns = routineRuns === null && !runsAfterCalibration && !runsPerKit
    ? null
    : (routineRuns || 0) + runsAfterCalibration + runsPerKit;

  // Pruebas del propio reactivo que gastan los controles y las calibraciones.
  const controlLevels = positive(environment.control_levels) || 1;
  const calibratorLevels = positive(context.calibratorLevels) || 1;
  const extraTests = conventions.reagentQcTests === "included"
    ? (qcRuns || 0) * controlLevels + (calibrationMeasurements || 0) * calibratorLevels
    : 0;

  const notCounted = [];
  if (lotChangeDeclared && !conventions.reagentLotsPerYear) notCounted.push("reagent_lot_change");
  return {
    kits,
    calibrationEvents,
    calibrationMeasurements,
    calibrationDays,
    qcRuns,
    sampleVolumeUl: positive(context.spec.parameters?.sample_volume_ul),
    replicates,
    extraTests,
    components: {
      processDays,
      calibrationIntervalDays,
      declaredCalibrationEvents: declaredEvents,
      lotChanges,
      replicates,
      qcIntervalHours,
      workingDays: round(workingDays),
      operatingHoursPerDay: operatingHours,
      runsPerDay,
      runsPerDaySource: (useLaboratory && "bc_lab_environment") || (qcIntervalHours && "catalog_consumable_specs") || null,
      routineRuns,
      runsAfterCalibration,
      runsPerKit,
      controlLevels,
      calibratorLevels,
    },
    // La ficha lo exige pero no se puede contar con lo que declara.
    notCounted,
  };
}

function evaluateOfficialDocument(context = {}) {
  const spec = context.spec || null;
  const months = positive(context.processDurationMonths);
  if (!context.identity?.supplierCode) return noRule("PRODUCT_CODE_MISSING", "El producto no tiene un codigo de proveedor verificable.");
  // Partes y consumibles del equipo: mandan los intervalos de cambio del manual, no la ficha.
  const manual = evaluateEquipmentManual(context);
  if (manual) return manual;
  if (!spec) return noRule("SPEC_NOT_FOUND", "No existe una ficha tecnica vigente para el producto.");
  if (!months) return noRule("PROCESS_DURATION_MISSING", "El Business Case no tiene una duracion de proceso positiva.");

  const conventions = resolveConventions(context.conventions);
  const processDays = months * DAYS_PER_MONTH;
  const manufacturer = context.manufacturer || {};
  const effective = context.effective || {};
  const isReagent = context.identity.itemType === "reactivo";
  const specVerified = spec.verification_status === "verified";
  const base = {
    status: "calculated",
    validation: { status: "pending_expert", conventions: describeConventions(conventions) },
    specStatus: spec.verification_status || null,
  };
  const finish = (result, incomplete = []) => ({
    ...base,
    ...result,
    incomplete,
    // Ficha revisada a mano y sin datos faltantes. No equivale a cantidad validada por experto.
    documentVerified: specVerified && incomplete.length === 0,
    verified: false,
  });

  if (isReagent) {
    const testsPerPack = positive(spec.tests_per_pack);
    if (!testsPerPack) return noRule("TESTS_PER_PACK_MISSING", "La ficha no declara las pruebas por presentacion del reactivo.");
    const annualDemand = positive(context.annualDemand);
    if (!annualDemand) {
      return finish({
        quantity: 0,
        unit: "kit",
        formula: "Sin demanda registrada para el reactivo: cantidad 0.",
        components: { processDays, processDemand: 0 },
      });
    }
    const patientTests = processDemandOf(annualDemand, months, conventions);
    const extraTests = positive(context.extraTests) || 0;
    const processDemand = patientTests + extraTests;
    const byDemand = processDemand / testsPerPack;
    const onboardDays = positive(effective.onboardDays);
    const untilExpiration = manufacturer.onboardUntilExpiration === true;
    const countStability = conventions.reagentStability === "counted";
    const byStability = onboardDays ? processDays / onboardDays : null;
    const quantity = roundUp(Math.max(byDemand, (countStability && byStability) || 0));
    let stabilityText = "estabilidad a bordo no declarada";
    if (onboardDays) stabilityText = `(${months} × 30) / ${onboardDays}`;
    else if (untilExpiration) stabilityText = "sin limite a bordo (estable hasta el vencimiento)";
    const demandText = `${round(processDemand)} pruebas del proceso${extraTests ? ` (${round(patientTests)} de pacientes + ${round(extraTests)} de control y calibracion)` : ""} / ${testsPerPack}`;
    return finish({
      quantity,
      unit: "kit",
      formula: countStability
        ? `ROUNDUP( MAX( ${demandText} , ${stabilityText} ) ) = ${quantity}`
        : `ROUNDUP( ${demandText} ) = ${quantity}`,
      components: {
        processDays,
        patientTests: round(patientTests),
        extraTests: round(extraTests),
        processDemand: round(processDemand),
        testsPerPack,
        onboardDays,
        byDemand: round(byDemand),
        byStability: byStability === null ? null : round(byStability),
        drivenBy: countStability && byStability !== null && byStability > byDemand ? "stability" : "demand",
      },
    }, onboardDays || untilExpiration || !countStability ? [] : ["stability_onboard_days"]);
  }

  // Calibradores, controles y materiales.
  if (context.usage?.inUse === undefined || context.usage?.inUse === null) {
    return noRule("USAGE_NOT_DETERMINED", "No hay evidencia de si el producto se usa en este Business Case.");
  }
  if (!context.usage.inUse) {
    return finish({
      quantity: 0,
      unit: "envase",
      uses: 0,
      containers: 0,
      formula: "Ningun reactivo con demanda requiere este producto segun su ficha: cantidad 0.",
      components: { processDays },
    });
  }

  const isMaterial = context.identity.itemType === "material";
  const events = context.usage.events || null;
  const uses = isMaterial ? null : positive(events?.uses);
  const openDays = positive(effective.openDays);
  const onboardDays = positive(effective.onboardDays);
  const frozenDays = positive(spec.parameters?.stability_frozen_once_days);
  const openStability = openDays || onboardDays;
  const aliquoted = conventions.conservation === "document_best" && frozenDays !== null && frozenDays > (openStability || 0);
  const stabilityDays = aliquoted ? frozenDays : openStability;
  const singleUse = manufacturer.singleUse === true;
  if (singleUse && !uses) {
    return noRule("USAGE_PER_EVENT_REQUIRED", "Envase de un solo uso: la ficha del reactivo no declara cada cuanto se usa.");
  }
  // Sin usos conocidos, un producto que dura menos de un dia abierto no se proyecta por vencimiento.
  if (!uses && !(stabilityDays >= 1)) {
    return stabilityDays
      ? noRule("USAGE_PER_EVENT_REQUIRED", "El producto dura menos de un dia abierto y la ficha del reactivo no declara cada cuanto se usa.")
      : noRule("STABILITY_MISSING", "La ficha no declara estabilidad del producto abierto ni a bordo, ni cada cuanto se usa.");
  }

  const byStability = stabilityDays >= 1 ? roundUp(processDays / stabilityDays) : null;
  const calendarDays = !isMaterial && Array.isArray(events?.days) && events.days.length ? events.days : null;
  const stabilityText = `ROUNDUP( (${months} × 30) / ${stabilityDays} )`;
  let containers = byStability;
  let basis = "stability_only";
  let containersText = stabilityText;
  if (uses && singleUse) {
    containers = uses;
    basis = "per_event_single_use";
    containersText = `${uses} usos (un solo uso)`;
  } else if (calendarDays) {
    containers = containersForCalendar(calendarDays, stabilityDays);
    basis = "calendar";
    containersText = `${calendarDays.length} dia(s) con uso; un envase cubre ${stabilityDays >= 1 ? `${stabilityDays} dia(s)` : "los usos del mismo dia"}`;
  } else if (uses && byStability === null) {
    containers = uses;
    basis = "per_event";
    containersText = `${uses} usos`;
  } else if (uses) {
    containers = Math.min(uses, byStability);
    basis = uses <= byStability ? "per_event" : "stability_capped";
    containersText = `MIN( ${uses} usos , ${stabilityText} )`;
  }

  // Nunca menos envases que los que agota el volumen que gastan las mediciones.
  const containerVolumeMl = positive(spec.container_volume_ml);
  const volumeUl = isMaterial ? null : positive(events?.volumeUl);
  const byVolume = volumeUl && containerVolumeMl ? roundUp(volumeUl / 1000 / containerVolumeMl) : null;
  if (byVolume !== null && byVolume > containers && !singleUse) {
    containers = byVolume;
    basis = "by_volume";
    containersText = `ROUNDUP( ${round(volumeUl / 1000, 2)} mL que gastan los usos / ${containerVolumeMl} mL por envase )`;
  }

  const containersPerPack = positive(spec.containers_per_pack);
  const quantity = containersPerPack ? roundUp(containers / containersPerPack) : containers;
  const incomplete = [];
  if (!containersPerPack) incomplete.push("containers_per_pack");
  if (!isMaterial && !uses) incomplete.push("event_frequency");
  if (!stabilityDays) incomplete.push("stability_days");
  if (events?.unknownReagents > 0) incomplete.push("event_frequency_partial");
  if (uses && !singleUse && (!containerVolumeMl || !volumeUl || events?.volumeUnknownReagents > 0)) incomplete.push("volume_per_use");

  return finish({
    quantity,
    unit: containersPerPack ? "presentacion" : "envase",
    basis,
    uses,
    sessions: calendarDays ? calendarDays.length : null,
    containers,
    conservation: aliquoted ? "aliquot_freeze" : "open",
    formula: `envases = ${containersText} = ${containers}${containersPerPack ? ` ; presentaciones = ROUNDUP( ${containers} / ${containersPerPack} ) = ${quantity}` : ""}`,
    components: {
      processDays,
      uses,
      sessions: calendarDays ? calendarDays.length : null,
      reagentsUsingIt: events?.reagents ?? null,
      stabilityDays: stabilityDays || null,
      stabilitySource: (aliquoted && "congelado (alicuotas)") || (openDays && "abierto") || (onboardDays && "a bordo") || null,
      openStabilityDays: openStability || null,
      containersByStability: byStability,
      volumeMl: volumeUl ? round(volumeUl / 1000, 3) : null,
      containerVolumeMl,
      containersByVolume: byVolume,
      singleUse,
      containers,
      containersPerPack,
    },
  }, incomplete);
}

module.exports = {
  defaultConventionsFor,
  evaluateOfficialDocument,
  reagentEvents,
  resolveConventions,
  describeConventions,
  processDemandOf,
  calibrationCalendar,
  containersForCalendar,
  DEFAULT_CONVENTIONS,
  CONVENTION_OPTIONS,
  DAYS_PER_MONTH,
};
