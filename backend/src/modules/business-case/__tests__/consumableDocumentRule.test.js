const {
  evaluateOfficialDocument, reagentEvents, resolveConventions, calibrationCalendar, containersForCalendar, defaultConventionsFor,
} = require("../consumableDocumentRule");
const { evaluateConsumableSources, compareSources } = require("../consumableRules.rules");

const reagent = (overrides = {}) => ({
  identity: { supplierCode: "100", itemType: "reactivo", family: "x", equipmentCode: "EQ", equipmentName: "Equipo" },
  spec: { tests_per_pack: 300, verification_status: "verified" },
  manufacturer: {},
  effective: { onboardDays: 90 },
  processDurationMonths: 24,
  annualDemand: 6000,
  conventions: { demandBasis: "annual", reagentStability: "counted", reagentLotsPerYear: null },
  ...overrides,
});
const control = (overrides = {}) => ({
  identity: { supplierCode: "200", itemType: "control", family: "x", equipmentCode: "EQ", equipmentName: "Equipo" },
  spec: { containers_per_pack: 4, verification_status: "extracted" },
  manufacturer: { singleUse: false },
  effective: { openDays: 30 },
  processDurationMonths: 12,
  usage: { inUse: true },
  ...overrides,
});

describe("consumableDocumentRule", () => {
  test("reactivo: manda la demanda del proceso cuando supera el vencimiento a bordo", () => {
    // 6000 x 24/12 = 12000 pruebas / 300 = 40 kits; estabilidad 720/90 = 8
    const result = evaluateOfficialDocument(reagent());
    expect(result).toMatchObject({ status: "calculated", quantity: 40, incomplete: [], documentVerified: true, verified: false });
    expect(result.components).toMatchObject({ processDemand: 12000, byDemand: 40, byStability: 8, drivenBy: "demand" });
  });

  test("reactivo: manda la estabilidad cuando la demanda es baja", () => {
    const result = evaluateOfficialDocument(reagent({ annualDemand: 100 }));
    expect(result.quantity).toBe(8);
    expect(result.components.drivenBy).toBe("stability");
  });

  test("reactivo sin demanda: cantidad 0; sin pruebas por presentacion: no_rule", () => {
    expect(evaluateOfficialDocument(reagent({ annualDemand: 0 })).quantity).toBe(0);
    expect(evaluateOfficialDocument(reagent({ spec: { verification_status: "verified" } })))
      .toMatchObject({ status: "no_rule", quantity: null, reason: { code: "TESTS_PER_PACK_MISSING" } });
  });

  test("reactivo sin estabilidad declarada: calcula por demanda y lo marca incompleto", () => {
    const result = evaluateOfficialDocument(reagent({ effective: {} }));
    expect(result).toMatchObject({ quantity: 40, incomplete: ["stability_onboard_days"], documentVerified: false });
    expect(evaluateOfficialDocument(reagent({ effective: {}, manufacturer: { onboardUntilExpiration: true } })).incomplete).toEqual([]);
  });

  test("control: vencimiento por estabilidad entre envases por presentacion", () => {
    // 360 / 30 = 12 envases / 4 por presentacion = 3
    expect(evaluateOfficialDocument(control())).toMatchObject({
      status: "calculated", quantity: 3, containers: 12, basis: "stability_only", incomplete: ["event_frequency"],
    });
    expect(evaluateOfficialDocument(control({ spec: {} }))).toMatchObject({ quantity: 12, unit: "envase" });
  });

  test("receta: con usos conocidos, se abre un envase solo si hay un uso y el anterior vencio", () => {
    // 5 usos en el año y el envase dura 30 dias (12 por vencimiento): bastan 5 envases
    expect(evaluateOfficialDocument(control({ usage: { inUse: true, events: { uses: 5, reagents: 1 } } })))
      .toMatchObject({ uses: 5, containers: 5, quantity: 2, basis: "per_event", incomplete: ["volume_per_use"] });
    // 360 usos: manda el vencimiento, 12 envases
    expect(evaluateOfficialDocument(control({ usage: { inUse: true, events: { uses: 360 } } })))
      .toMatchObject({ uses: 360, containers: 12, quantity: 3, basis: "stability_capped" });
    // dura 2 horas abierto: un envase por uso
    expect(evaluateOfficialDocument(control({ effective: { onboardDays: 0.083 }, usage: { inUse: true, events: { uses: 13 } } })))
      .toMatchObject({ containers: 13, basis: "per_event" });
    // un solo uso: un envase por uso aunque la estabilidad sea larga
    expect(evaluateOfficialDocument(control({ manufacturer: { singleUse: true }, usage: { inUse: true, events: { uses: 40 } } })))
      .toMatchObject({ containers: 40, quantity: 10, basis: "per_event_single_use" });
    // dura menos de un dia y no se sabe cada cuanto se usa: no se inventa
    expect(evaluateOfficialDocument(control({ effective: { onboardDays: 0.083 } })).reason.code).toBe("USAGE_PER_EVENT_REQUIRED");
  });

  test("receta: calibraciones y corridas de control que genera la ficha del reactivo", () => {
    const events = reagentEvents(reagent({
      processDurationMonths: 12,
      manufacturer: { calibration: { events: ["reagent_lot_change"], replicate: "duplicate" }, qcAfterCalibration: true },
      effective: { onboardDays: 90, calibrationIntervalDays: 29, qcIntervalHours: 24 },
      environment: { work_days_per_week: 5, shifts_per_day: 1, hours_per_shift: 8 },
    }));
    // 360 / 29 = 12,4 -> 13 calibraciones (26 mediciones); QC: 360 × 5/7 = 257,1 -> 258 corridas + 13
    expect(events).toMatchObject({ kits: 20, calibrationEvents: 13, calibrationMeasurements: 26, qcRuns: 271, notCounted: ["reagent_lot_change"] });
    // solo exige calibrar al cambiar de lote: se cuenta la inicial; sin intervalo de QC no hay corridas
    expect(reagentEvents(reagent({ manufacturer: { calibration: { events: ["reagent_lot_change"] } } })))
      .toMatchObject({ calibrationEvents: 1, qcRuns: null });
    // intervalo de QC de 8 horas con 3 turnos de 8: 3 corridas por dia
    expect(reagentEvents(reagent({
      processDurationMonths: 1, effective: { qcIntervalHours: 8 }, environment: { shifts_per_day: 3, hours_per_shift: 8 },
    })).qcRuns).toBe(90);
    expect(reagentEvents(reagent({ annualDemand: 0 }))).toBeNull();
  });

  test("control: no fabrica cantidad sin evidencia de uso, sin estabilidad o de un solo uso", () => {
    expect(evaluateOfficialDocument(control({ usage: { inUse: null } })).reason.code).toBe("USAGE_NOT_DETERMINED");
    expect(evaluateOfficialDocument(control({ usage: { inUse: false } }))).toMatchObject({ status: "calculated", quantity: 0 });
    expect(evaluateOfficialDocument(control({ effective: {} })).reason.code).toBe("STABILITY_MISSING");
    expect(evaluateOfficialDocument(control({ manufacturer: { singleUse: true } })).reason.code).toBe("USAGE_PER_EVENT_REQUIRED");
  });

  test("sin ficha, sin codigo o sin duracion: no_rule", () => {
    expect(evaluateOfficialDocument(reagent({ spec: null })).reason.code).toBe("SPEC_NOT_FOUND");
    expect(evaluateOfficialDocument(reagent({ processDurationMonths: 0 })).reason.code).toBe("PROCESS_DURATION_MISSING");
    expect(evaluateOfficialDocument(reagent({ identity: { itemType: "reactivo" } })).reason.code).toBe("PRODUCT_CODE_MISSING");
  });
});

describe("mejoras de la receta", () => {
  test("convenciones: por defecto la demanda registrada es la de todo el proceso; valores desconocidos se ignoran", () => {
    expect(resolveConventions({ demandBasis: "otra", reagentLotsPerYear: "x" }))
      .toMatchObject({ demandBasis: "process", qcBasis: "document", conservation: "document_best", reagentLotsPerYear: null });
    // Sin el campo, 3 lotes por año por defecto; con el campo vacio, no se cuentan.
    expect(resolveConventions({}).reagentLotsPerYear).toBe(3);
    expect(resolveConventions({ reagentLotsPerYear: null }).reagentLotsPerYear).toBeNull();
    // 6000 pruebas del proceso / 300 = 20 kits (no se multiplica por 24/12)
    expect(evaluateOfficialDocument(reagent({ conventions: null })).quantity).toBe(20);
    // sin contar vencimiento a bordo: solo demanda
    expect(evaluateOfficialDocument(reagent({ annualDemand: 100, conventions: { reagentStability: "ignored" } })).quantity).toBe(1);
  });

  test("DET/AÑO/PROCESO segun el tipo de compra: privado anual, publico del proceso", () => {
    expect(defaultConventionsFor("private_comodato")).toEqual({ demandBasis: "annual" });
    expect(defaultConventionsFor("private_sale")).toEqual({ demandBasis: "annual" });
    expect(defaultConventionsFor("public")).toEqual({ demandBasis: "process" });
    // Privado, 24 meses: 6000 al año -> 12000 pruebas del proceso / 300 = 40 kits
    expect(evaluateOfficialDocument(reagent({ conventions: defaultConventionsFor("private_comodato") })).quantity).toBe(40);
    // Publico: 6000 ya es el proceso -> 20 kits
    expect(evaluateOfficialDocument(reagent({ conventions: defaultConventionsFor("public") })).quantity).toBe(20);
  });

  test("calendario: las calibraciones que caen dentro de la estabilidad del envase lo comparten", () => {
    expect(calibrationCalendar(360, 90, 0)).toEqual([0, 90, 180, 270]);
    expect(calibrationCalendar(360, null, 1)).toEqual([0, 180]);
    // dos reactivos calibran los dias 0 y 3; el envase dura 5 dias: un solo envase
    expect(containersForCalendar([0, 3], 5)).toBe(1);
    expect(containersForCalendar([0, 3, 7], 5)).toBe(2);
    // dura 2 horas: comparte solo los usos del mismo dia
    expect(containersForCalendar([0, 0, 1], 0.083)).toBe(2);
    const shared = evaluateOfficialDocument(control({
      identity: { supplierCode: "300", itemType: "calibrador" },
      effective: { openDays: 5 },
      usage: { inUse: true, events: { uses: 6, reagents: 2, days: [0, 3, 90, 93, 180, 183] } },
    }));
    // 6 calibraciones en 3 sesiones: 3 envases, no 6
    expect(shared).toMatchObject({ uses: 6, sessions: 6, containers: 3, basis: "calendar" });
  });

  test("volumen: nunca menos envases que los que agotan las mediciones", () => {
    const result = evaluateOfficialDocument(control({
      spec: { containers_per_pack: 4, container_volume_ml: 1 },
      effective: { openDays: 360 },
      // 3000 mediciones de 50 µL = 150 mL; envase de 1 mL
      usage: { inUse: true, events: { uses: 3000, volumeUl: 150000 } },
    }));
    expect(result).toMatchObject({ containers: 150, quantity: 38, basis: "by_volume", incomplete: [] });
  });

  test("conservacion: si la ficha permite congelar, el envase dura lo que dura congelado", () => {
    const frozen = control({ spec: { containers_per_pack: 4, parameters: { stability_frozen_once_days: 90 } }, usage: { inUse: true, events: { uses: 360 } } });
    expect(evaluateOfficialDocument(frozen)).toMatchObject({ containers: 4, conservation: "aliquot_freeze" });
    expect(evaluateOfficialDocument({ ...frozen, conventions: { conservation: "open" } })).toMatchObject({ containers: 12, conservation: "open" });
  });

  test("cambios de lote y pruebas de control del reactivo solo cuentan si la convencion lo pide", () => {
    const base = reagent({
      processDurationMonths: 12,
      manufacturer: { calibration: { events: ["reagent_lot_change"] } },
      effective: { onboardDays: 90, qcIntervalHours: 24 },
      environment: { control_levels: 2 },
    });
    expect(reagentEvents(base)).toMatchObject({ calibrationEvents: 1, extraTests: 0, notCounted: ["reagent_lot_change"] });
    // 4 lotes al año: la inicial + 3 cambios de lote
    expect(reagentEvents({ ...base, conventions: { demandBasis: "annual", reagentLotsPerYear: 4 } }))
      .toMatchObject({ calibrationEvents: 4, calibrationDays: [0, 90, 180, 270], notCounted: [] });
    // 360 corridas × 2 niveles + 1 calibracion = 721 pruebas extra
    const withTests = reagentEvents({ ...base, conventions: { demandBasis: "annual", reagentQcTests: "included", reagentLotsPerYear: null } });
    expect(withTests.extraTests).toBe(721);
    // (6000 + 721) / 300 = 22,4 -> 23 kits
    expect(evaluateOfficialDocument({ ...base, conventions: { demandBasis: "annual" }, extraTests: withTests.extraTests }).quantity).toBe(23);
  });

  test("volumen de muestra del reactivo llega a la receta", () => {
    expect(reagentEvents(reagent({ spec: { tests_per_pack: 300, parameters: { sample_volume_ul: 12 } }, effective: { qcIntervalHours: 24 } })).sampleVolumeUl).toBe(12);
  });
});

describe("evaluateConsumableSources", () => {
  const adapter = (quantity) => [{
    id: "prueba", version: "1", requiresSpec: false,
    selector: { family: "x", equipmentCode: "EQ", equipmentName: "Equipo", itemType: "reactivo" },
    calculate: () => ({ status: "calculated", quantity, unit: "kit", formula: "f", verified: false }),
  }];

  test("la formula validada es la cantidad principal y se conserva el documento para comparar", () => {
    const result = evaluateConsumableSources(reagent(), { adapters: adapter(42) });
    expect(result).toMatchObject({
      status: "calculated", quantity: 42, primarySource: "audited_formula",
      agreement: { status: "differs", difference: -2 },
      sources: { auditedFormula: { quantity: 42 }, officialDocument: { quantity: 40 } },
    });
    expect(evaluateConsumableSources(reagent(), { adapters: adapter(40) }).agreement.status).toBe("match");
  });

  test("sin formula validada usa el documento; sin ninguna, no_rule con el motivo del documento", () => {
    expect(evaluateConsumableSources(reagent(), { adapters: [] }))
      .toMatchObject({ status: "calculated", quantity: 40, primarySource: "official_document", verified: false, agreement: { status: "single_source" } });
    expect(evaluateConsumableSources(reagent({ spec: null }), { adapters: [] }))
      .toMatchObject({ status: "no_rule", quantity: null, primarySource: null, reason: { code: "SPEC_NOT_FOUND" }, agreement: { status: "none" } });
  });

  test("compareSources no compara cuando falta una fuente", () => {
    expect(compareSources({ status: "no_rule" }, { status: "calculated", quantity: 3 })).toEqual({ status: "single_source", difference: null });
  });
});
