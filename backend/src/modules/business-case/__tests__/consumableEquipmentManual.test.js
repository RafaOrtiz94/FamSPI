const { evaluateEquipmentManual } = require("../consumableEquipmentManual");
const { evaluateOfficialDocument } = require("../consumableDocumentRule");

const ISE_EQUIPMENT = "cobas Pro <503+801> ISE";
const context = (supplierCode, extra = {}) => ({
  identity: { supplierCode, itemType: "material", equipmentName: ISE_EQUIPMENT },
  processDurationMonths: 15,
  environment: { work_days_per_week: 7, shifts_per_day: 2, hours_per_shift: 12 },
  ...extra,
});

describe("consumableEquipmentManual", () => {
  test("lampara del fotometro c 503: 750 h de encendido o cada 6 meses", () => {
    const result = evaluateEquipmentManual(context("4813707001"));
    // 450 dias × 24 h = 10800 h / 750 = 14.4 -> 15
    expect(result).toMatchObject({ status: "calculated", basis: "equipment_manual", quantity: 15 });
    // Un turno de 4 h, 5 dias (1286 h / 750 = 1.7): manda el limite de 6 meses (450 / 180 = 2.5 -> 3).
    const light = evaluateEquipmentManual(context("4813707001", { environment: { work_days_per_week: 5, shifts_per_day: 1, hours_per_shift: 4 } }));
    expect(light.quantity).toBe(3);
  });

  test("electrodos Na/K/Cl: 2 meses o 9000 pruebas, lo que llegue primero", () => {
    const byTime = evaluateEquipmentManual(context("10825468001"));
    expect(byTime).toMatchObject({ quantity: 8, incomplete: ["ise_tests"] });
    const byTests = evaluateEquipmentManual(context("03246353001", { iseTests: 120000 }));
    expect(byTests).toMatchObject({ quantity: 14, incomplete: [] });
  });

  test("estandares ISE: una ampolla por calibracion diaria, 10 por presentacion", () => {
    expect(evaluateEquipmentManual(context("11183974216")).quantity).toBe(45);
    expect(evaluateEquipmentManual(context("11183982216", { environment: { work_days_per_week: 5 } })).quantity).toBe(33);
  });

  test("sin intervalo publicado: explica el motivo, no inventa cantidad", () => {
    expect(evaluateEquipmentManual(context("3149501001"))).toMatchObject({ status: "no_rule", quantity: null, reason: { code: "MANUAL_INTERVAL_NOT_PUBLISHED" } });
    expect(evaluateEquipmentManual(context("8392013190"))).toMatchObject({ status: "no_rule", reason: { code: "ISE_TESTS_REQUIRED" } });
  });

  test("solo aplica al equipo que corresponde y a productos con regla", () => {
    expect(evaluateEquipmentManual(context("4813707001", { identity: { supplierCode: "4813707001", equipmentName: "cobas e 801" } }))).toBeNull();
    expect(evaluateEquipmentManual(context("99999"))).toBeNull();
  });

  test("el documento oficial usa la regla del manual aunque no haya ficha", () => {
    const result = evaluateOfficialDocument(context("10825441001", { spec: null }));
    expect(result).toMatchObject({ status: "calculated", basis: "equipment_manual", quantity: 8 });
  });
});

describe("ISE Diluent por volumen de muestras", () => {
  test("sin muestras ISE solo cuenta la estabilidad; con ellas, el volumen", () => {
    // 450 / 42 = 10.7 -> 11 frascos -> 6 presentaciones
    expect(evaluateEquipmentManual(context("04880480190"))).toMatchObject({ quantity: 6, incomplete: ["ise_tests"] });
    // 100000 muestras × 0.45 mL = 45000 mL / 2000 = 22.5 -> 23 frascos -> 12 presentaciones
    expect(evaluateEquipmentManual(context("4880480190", { iseTests: 100000 }))).toMatchObject({ quantity: 12, incomplete: [] });
  });
});
