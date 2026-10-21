jest.mock("../../../config/db", () => ({ query: jest.fn() }));

const db = require("../../../config/db");
const validations = require("../consumableRuleValidations.service");
const { __testables } = require("../consumableRules.service");

describe("consumableRuleValidations", () => {
  beforeEach(() => jest.clearAllMocks());

  test("exactitud: 100 × (1 - error / real) y porcentaje de coincidencias exactas", () => {
    expect(validations.measureAccuracy([
      { predicted: 10, validated: 10 },
      { predicted: 8, validated: 10 },
      { predicted: null, validated: 5 },
    ])).toEqual({ cases: 2, exact: 1, exactPercent: 50, accuracyPercent: 90 });
    expect(validations.measureAccuracy([])).toMatchObject({ cases: 0, accuracyPercent: null });
    expect(validations.measureAccuracy([{ predicted: 3, validated: 0 }]).accuracyPercent).toBe(0);
  });

  test("ajuste aprendido: factor real / predicho, aplicable solo con casos suficientes", () => {
    const cases = [
      { equipment_code: "EQ", item_type: "control", supplier_code: "200", predicted_qty: 10, validated_qty: 5 },
      { equipment_code: "EQ", item_type: "control", supplier_code: "200", predicted_qty: 20, validated_qty: 10 },
      { equipment_code: "EQ", item_type: "control", supplier_code: "200", predicted_qty: 10, validated_qty: 5 },
      { equipment_code: "EQ", item_type: "control", supplier_code: "300", predicted_qty: 10, validated_qty: 20 },
      { equipment_code: "EQ", item_type: "control", supplier_code: "400", predicted_qty: 0, validated_qty: 2 },
    ];
    const factors = validations.buildLearningFactors(cases);
    const product = { equipmentCode: "EQ", itemType: "control", quantity: 13 };
    // 20 / 40 = 0,5 con 3 casos: 13 × 0,5 = 6,5 -> 7
    expect(validations.learnedFor(factors, { ...product, supplierCode: "200" })).toMatchObject({ cases: 3, factor: 0.5, applicable: true, adjustedQuantity: 7 });
    // un solo caso: se informa el factor pero no se aplica
    expect(validations.learnedFor(factors, { ...product, supplierCode: "300" })).toMatchObject({ cases: 1, factor: 2, applicable: false, adjustedQuantity: null });
    // prediccion 0 no sirve para un factor; producto sin casos no tiene ajuste
    expect(validations.learnedFor(factors, { ...product, supplierCode: "400" })).toBeNull();
    expect(validations.learnedFor(factors, { ...product, supplierCode: "999" })).toBeNull();
  });

  test("guardar: valida la entrada y registra quien valido", async () => {
    await expect(validations.saveValidation("bc", { itemType: "otro", supplierCode: "1", equipmentId: 3, validatedQty: 1 })).rejects.toMatchObject({ status: 400 });
    await expect(validations.saveValidation("bc", { itemType: "control", supplierCode: "1", equipmentId: 3, validatedQty: -1 })).rejects.toMatchObject({ status: 400 });
    expect(db.query).not.toHaveBeenCalled();
    db.query.mockResolvedValueOnce({ rows: [{ supplier_code: "1" }] });
    await validations.saveValidation("bc", { itemType: "Control", supplierCode: "1", equipmentId: 3, validatedQty: "4", predictedQty: 6 }, { email: "ti@fam.com" });
    const params = db.query.mock.calls[0][1];
    expect(params.slice(0, 7)).toEqual(["bc", 3, null, "control", "1", 4, 6]);
    expect(params[10]).toBe("ti@fam.com");
  });

  test("sin la migracion 326 el laboratorio sigue funcionando sin validaciones", async () => {
    db.query.mockRejectedValue(Object.assign(new Error("no existe"), { code: "42P01" }));
    await expect(validations.listForBusinessCase("bc")).resolves.toEqual([]);
    await expect(validations.listLearningCases("bc", ["EQ"])).resolves.toEqual([]);
  });

  test("fichas incompletas: primero lo que impide calcular, luego por impacto", () => {
    const gaps = __testables.buildDataGaps([
      { itemType: "reactivo", supplierCode: "1", name: "A", inputs: { recordedAnnualQty: { value: 100 } }, sources: { officialDocument: { status: "calculated" } } },
      { itemType: "reactivo", supplierCode: "2", name: "B", inputs: { recordedAnnualQty: { value: 900 } }, sources: { officialDocument: { status: "no_rule", reason: { code: "TESTS_PER_PACK_MISSING" } } } },
      { itemType: "reactivo", supplierCode: "3", name: "C", inputs: { recordedAnnualQty: { value: 0 } }, sources: { officialDocument: { status: "no_rule", reason: { code: "SPEC_NOT_FOUND" } } } },
      { itemType: "control", supplierCode: "4", name: "D", lineage: { usage: { inUse: true } }, sources: { officialDocument: { status: "calculated", incomplete: ["containers_per_pack"], components: { reagentsUsingIt: 5 } } } },
    ], [{ reagentCode: "1", events: { calibrationEvents: 2, qcRuns: null, sampleVolumeUl: 5 }, components: [{}] }]);
    expect(gaps.map((gap) => `${gap.supplierCode}:${gap.code}:${gap.blocks}`)).toEqual([
      "2:TESTS_PER_PACK_MISSING:true",
      "1:QC_NOT_DECLARED:false",
      "4:containers_per_pack:false",
    ]);
  });
});
