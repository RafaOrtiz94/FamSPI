/**
 * Reglas de cambio de partes y consumibles de equipo, tomadas del manual del equipo y de las
 * Method Sheets de Roche. Archivo puro (sin base de datos).
 *
 * Estos productos no dependen de un reactivo: se cambian por tiempo, horas de encendido o
 * calibraciones del equipo. Cada regla cita su fuente; lo que el fabricante no publica no se regla.
 *
 * Fuentes (descargadas de eLabDoc, 2026-10-14):
 *   - cobas pro integrated solutions User Guide 4.4 (software 03-05):
 *       · "Replacement intervals of parts" (c 503): lampara del fotometro "750 hours of switch-on
 *         time"; "Maintenance actions": "After 750 hours switch-on time ... or every 6 months".
 *       · "ISE calibrations": "An ISE calibration is only valid for 24 hours".
 *       · ISE electrodes (Cl, K, Na, reference): "According to the interval given in the Method Sheet".
 *   - Method Sheets Na+/K+/Cl- (10825468001, 10825441001, 03246353001): "2 months or 9000 tests,
 *     whichever comes first".
 *   - Method Sheet ISE Diluent Gen.2 (04880480190): 2 × 2000 mL, estable 6 semanas a bordo en cobas pro
 *     ISE; Method Sheet Na+: en cobas pro ISE cada muestra usa 15 µL + 450 µL de ISE Diluent.
 *   - Method Sheets ISE Standard Low/High (11183974216, 11183982216): 10 ampollas de 3 mL;
 *     "Opened ampules should be used immediately. Remaining content must not be stored".
 */

const DAYS_PER_MONTH = 30;
const USER_GUIDE = "cobas pro integrated solutions User Guide 4.4 (software 03-05)";

const positive = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};
const round = (value, digits = 2) => Number(Number(value).toFixed(digits));
const roundUp = (value) => Math.ceil(value - 1e-9);

// Horas de encendido por dia y dias de trabajo por semana del laboratorio (mismo criterio que el
// calendario de calibraciones: sin turnos registrados se asume equipo encendido 24 h).
function operatingProfile(environment = {}) {
  const workDaysPerWeek = Math.min(positive(environment.work_days_per_week) || 7, 7);
  const hoursPerDay = Math.min((positive(environment.shifts_per_day) || 0) * (positive(environment.hours_per_shift) || 0), 24) || 24;
  return { workDaysPerWeek, hoursPerDay };
}

const RULES = Object.freeze({
  photometerLamp: {
    equipment: /503/,
    source: `${USER_GUIDE} — c 503: replacement intervals of parts; maintenance actions`,
    calculate({ processDays, environment }) {
      const { workDaysPerWeek, hoursPerDay } = operatingProfile(environment);
      const switchOnHours = processDays * (workDaysPerWeek / 7) * hoursPerDay;
      const byHours = switchOnHours / 750;
      const byTime = processDays / (6 * DAYS_PER_MONTH);
      const quantity = roundUp(Math.max(byHours, byTime));
      return {
        quantity,
        unit: "lampara",
        formula: `ROUNDUP( MAX( ${round(switchOnHours, 0)} h encendido / 750 h , ${processDays} dias / 180 ) ) = ${quantity}`,
        components: { switchOnHours: round(switchOnHours, 0), hoursPerDay, workDaysPerWeek, byHours: round(byHours), byTime: round(byTime), intervalHours: 750, maxIntervalDays: 180 },
        incomplete: [],
      };
    },
  },
  iseElectrode: {
    equipment: /ISE/i,
    source: "Method Sheet del electrodo (Na+ 10825468001, K+ 10825441001, Cl- 03246353001): 2 meses o 9000 pruebas",
    calculate({ processDays, iseTests }) {
      const byTime = processDays / 60;
      const byTests = iseTests ? iseTests / 9000 : null;
      const quantity = roundUp(Math.max(byTime, byTests || 0));
      return {
        quantity,
        unit: "electrodo",
        formula: byTests === null
          ? `ROUNDUP( ${processDays} dias / 60 ) = ${quantity} (limite de 9000 pruebas sin evaluar: faltan las pruebas ISE)`
          : `ROUNDUP( MAX( ${processDays} dias / 60 , ${round(iseTests, 0)} pruebas ISE / 9000 ) ) = ${quantity}`,
        components: { byTime: round(byTime), byTests: byTests === null ? null : round(byTests), intervalDays: 60, testsPerElectrode: 9000 },
        incomplete: byTests === null ? ["ise_tests"] : [],
      };
    },
  },
  iseStandard: {
    equipment: /ISE/i,
    source: `${USER_GUIDE} — ISE calibrations (validez 24 h); Method Sheet ISE Standard Low/High (10 ampollas, uso inmediato)`,
    calculate({ processDays, environment }) {
      const { workDaysPerWeek } = operatingProfile(environment);
      const calibrations = processDays * (workDaysPerWeek / 7);
      const quantity = roundUp(calibrations / 10);
      return {
        quantity,
        unit: "presentacion",
        formula: `ROUNDUP( ${round(calibrations, 0)} calibraciones ISE (una por dia de trabajo, validez 24 h) × 1 ampolla / 10 ampollas ) = ${quantity}`,
        components: { calibrations: round(calibrations, 0), workDaysPerWeek, ampoulesPerCalibration: 1, ampoulesPerPack: 10 },
        incomplete: [],
      };
    },
  },
  iseDiluent: {
    equipment: /ISE/i,
    source: "Method Sheet ISE Diluent Gen.2 (6 semanas a bordo, 2 × 2000 mL) y Method Sheet Na+ (450 µL de diluyente por muestra en cobas pro ISE)",
    calculate({ processDays, iseTests }) {
      const byStability = processDays / 42;
      const byVolume = iseTests ? (iseTests * 0.45) / 2000 : null;
      const bottles = roundUp(Math.max(byStability, byVolume || 0));
      const quantity = roundUp(bottles / 2);
      return {
        quantity,
        unit: "presentacion",
        formula: `frascos = ROUNDUP( MAX( ${processDays} dias / 42 , ${byVolume === null ? "muestras ISE sin dato" : `${round(iseTests, 0)} muestras × 0.45 mL / 2000 mL`} ) ) = ${bottles} ; presentaciones = ROUNDUP( ${bottles} / 2 ) = ${quantity}`,
        components: { byStability: round(byStability), byVolume: byVolume === null ? null : round(byVolume), bottles, bottlesPerPack: 2, diluentPerSampleMl: 0.45 },
        incomplete: byVolume === null ? ["ise_tests"] : [],
      };
    },
  },
});

// Codigo de proveedor sin ceros a la izquierda (como llega en identity.supplierCode).
const RULE_BY_CODE = Object.freeze({
  4813707001: "photometerLamp",
  10825468001: "iseElectrode",
  10825441001: "iseElectrode",
  3246353001: "iseElectrode",
  4880480190: "iseDiluent",
  11183974216: "iseStandard",
  11183982216: "iseStandard",
});

// Productos del manual que no tienen intervalo publicado: se explica en vez de inventar.
const NOT_PUBLISHED = Object.freeze({
  3149501001: {
    code: "MANUAL_INTERVAL_NOT_PUBLISHED",
    message: "Electrodo de referencia ISE: el manual remite a la Method Sheet y Roche no publica una para este electrodo (solo certificados de analisis).",
  },
  8392013190: {
    code: "ISE_TESTS_REQUIRED",
    message: "ISE Reference Electrolyte: estable a bordo hasta el vencimiento; su consumo depende del volumen de pruebas ISE, que el Business Case no registra.",
  },
});

const normalize = (code) => String(code || "").trim().replace(/^0+/, "");

/**
 * Devuelve el resultado de la regla del manual para el producto, o null si el producto no tiene
 * regla de equipo (sigue el camino de la ficha tecnica).
 */
function evaluateEquipmentManual(context = {}) {
  const code = normalize(context.identity?.supplierCode);
  const equipmentName = String(context.identity?.equipmentName || "");
  const unpublished = NOT_PUBLISHED[code];
  if (unpublished && /ISE/i.test(equipmentName)) {
    return { status: "no_rule", reason: { ...unpublished }, reasons: [{ ...unpublished }], quantity: null, unit: null, formula: null, verified: false };
  }
  const rule = RULES[RULE_BY_CODE[code]];
  if (!rule || !rule.equipment.test(equipmentName)) return null;
  const months = positive(context.processDurationMonths);
  if (!months) return null;
  const processDays = months * DAYS_PER_MONTH;
  const { incomplete, ...result } = rule.calculate({
    processDays,
    environment: context.environment || {},
    iseTests: positive(context.iseTests),
  });
  return {
    status: "calculated",
    basis: "equipment_manual",
    source: rule.source,
    ...result,
    components: { processDays, ...result.components },
    incomplete,
    validation: { status: "pending_expert", conventions: ["Mes de 30 dias.", "Intervalos de cambio segun el manual del equipo."] },
    documentVerified: incomplete.length === 0,
    verified: false,
  };
}

module.exports = { evaluateEquipmentManual, RULE_BY_CODE, __testables: { operatingProfile } };
