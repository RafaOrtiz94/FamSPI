const {
  RULE_ADAPTERS,
  buildSelector,
  findExactAdapter,
  evaluateConsumableRule,
} = require("../consumableRules.rules");

describe("consumableRules.rules", () => {
  test("el registro no contiene reglas asumidas: cada adaptador declara su fuente", () => {
    RULE_ADAPTERS.forEach((adapter) => {
      expect(adapter.source?.type).toBeTruthy();
      expect(adapter.selector).toEqual(expect.objectContaining({
        family: expect.any(String), equipmentCode: expect.any(String), equipmentName: expect.any(String), itemType: expect.any(String),
      }));
    });
  });

  test("selecciona adaptadores solo por coincidencia exacta de todo el alcance", () => {
    const adapter = {
      id: "verified-rule",
      selector: {
        family: "chemistry",
        equipmentCode: "C303",
        equipmentName: "cobas Pure <303>",
        itemType: "control",
      },
    };
    const selector = buildSelector(adapter.selector);
    expect(findExactAdapter(selector, [adapter])).toBe(adapter);
    expect(findExactAdapter({ ...selector, equipmentName: "cobas c 503" }, [adapter])).toBeNull();
    expect(findExactAdapter({ ...selector, family: "immunology" }, [adapter])).toBeNull();
  });

  test("sin adaptador devuelve no_rule y nunca fabrica una cantidad", () => {
    const result = evaluateConsumableRule({
      identity: {
        family: "coagulation",
        equipmentCode: "T511",
        equipmentName: "cobas t511",
        itemType: "control",
        supplierCode: "123",
      },
      spec: { verification_status: "verified" },
      processDurationMonths: 24,
    });
    expect(result).toMatchObject({
      status: "no_rule",
      quantity: null,
      unit: null,
      formula: null,
      verified: false,
      reason: { code: "RULE_ADAPTER_NOT_REGISTERED" },
    });
  });

  test("reporta todas las faltas observables sin ocultarlas tras un default", () => {
    const result = evaluateConsumableRule({
      identity: { family: "urinalysis", equipmentName: "Equipo", itemType: "material" },
      spec: null,
      processDurationMonths: null,
    });
    expect(result.reasons.map((entry) => entry.code)).toEqual([
      "PRODUCT_CODE_MISSING",
      "SPEC_NOT_FOUND",
      "PROCESS_DURATION_MISSING",
      "RULE_ADAPTER_NOT_REGISTERED",
    ]);
  });
});
