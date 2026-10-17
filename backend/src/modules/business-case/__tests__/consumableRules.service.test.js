jest.mock("../../../config/db", () => ({ query: jest.fn() }));

const db = require("../../../config/db");
const { buildRulesPreview } = require("../consumableRules.service");

describe("consumableRules.service", () => {
  beforeEach(() => jest.clearAllMocks());

  test("arma cobertura por equipo, incluye vinculados, conserva linaje y calcula por documento oficial", async () => {
    db.query.mockResolvedValue({ rows: [] });
    db.query
      .mockResolvedValueOnce({ rows: [{ work_days_per_week: 5, shifts_per_day: 2 }] })
      .mockResolvedValueOnce({ rows: [{ supplier_code: "200", overrides: { open_days: 14 }, updated_by: "lab@fam.com" }] })
      .mockResolvedValueOnce({ rows: [{
        id: 10,
        supplier_code: "100",
        product_name: "Reactivo A",
        valid_from: "2026-01-01",
        valid_to: null,
        system_specs: { todos: { qc: { interval_hours: 24 } } },
        parameters: { linked_products: { controles: ["200"] } },
        verification_status: "extracted",
        source_title: "Method Sheet A",
      }] })
      .mockResolvedValueOnce({ rows: [{
        id: 20,
        supplier_code: "200",
        product_name: "Control A",
        valid_from: "2026-01-02",
        valid_to: null,
        stability_open_days: 30,
        system_specs: {},
        parameters: {},
        verification_status: "verified",
        source_title: "Control Sheet",
      }] });

    const result = await buildRulesPreview({
      businessCaseId: 7,
      data: {
        requirements: { projected_deadline_months: 18 },
        equipment: [{ equipment_id: 3, equipment_code: "EQ-3", equipment_name: "Equipo exacto", category: "coagulation" }],
        catalogItems: [],
        consumptions: [{
          item_key: "cons:3:1",
          item_id: "000100",
          name: "Reactivo A",
          item_type: "reactivo",
          annual_qty: 1200,
          planned_qty: 2,
          equipment_id: 3,
        }, {
          item_key: "cons:3:2",
          item_id: "200",
          name: "Control A",
          item_type: "control",
          annual_qty: 4,
          planned_qty: 5,
          equipment_id: 3,
        }],
      },
    });

    const engine = result.get(3);
    expect(engine).toMatchObject({
      mode: "shadow_read_only",
      publishable: false,
      offerWriteEnabled: false,
      selectorPolicy: "exact_no_fallback",
      summary: { productCount: 2, calculatedCount: 1, noRuleCount: 1, auditedFormulaCount: 0, officialDocumentCount: 1 },
    });
    const linked = engine.items.find((item) => item.supplierCode === "200");
    expect(linked).toMatchObject({
      itemType: "control",
      status: "calculated",
      // 18 meses x 30 dias / 14 dias de estabilidad abierto (ajuste del laboratorio) = 38,57 -> 39
      quantity: 39,
      primarySource: "official_document",
      agreement: { status: "single_source" },
      sources: {
        auditedFormula: { status: "no_rule", reason: { code: "RULE_ADAPTER_NOT_REGISTERED" } },
        // 386 corridas de control (una por dia de trabajo, 5 por semana, segun la ficha del reactivo), limitadas por vencimiento: 39 envases
        officialDocument: { status: "calculated", quantity: 39, uses: 386, containers: 39, basis: "stability_capped", incomplete: ["containers_per_pack", "volume_per_use"] },
      },
      lineage: { usage: { inUse: true, evidence: "linked_by_reagent_with_demand" } },
      specVersion: { id: 20, validFrom: "2026-01-02" },
      source: { title: "Control Sheet" },
      verification: { specVerified: true, calculationVerified: false },
      inputs: {
        processDurationMonths: { value: 18, origin: "bc_requirements.projected_deadline_months" },
        recordedAnnualQty: { value: 4, origin: "bc_consumption_items.annual_qty" },
        effectiveParameters: { openDays: { value: 14, origin: "bc_lab_product_parameters.overrides.open_days" } },
      },
    });
    expect(linked.lineage.discoveredFrom).toContainEqual(expect.objectContaining({
      source: "catalog_consumable_specs.parameters.linked_products",
      reagentCode: "100",
    }));
    expect(linked.lineage.discoveredFrom).toContainEqual(expect.objectContaining({
      source: "bc_consumption_items",
      itemKey: "cons:3:2",
    }));
    expect(engine.recipes).toEqual([expect.objectContaining({
      reagentCode: "100",
      active: true,
      specVersionId: 10,
      events: expect.objectContaining({ qcRuns: 386, calibrationEvents: null }),
      components: [expect.objectContaining({ itemType: "control", supplierCode: "200", quantity: 39, status: "calculated", usesFromReagent: 386, uses: 386, containers: 39 })],
      missingGroups: ["calibradores", "materiales"],
      complete: false,
    })]);
    // El reactivo no declara pruebas por presentacion: no se inventa cantidad.
    expect(engine.items.find((item) => item.supplierCode === "100")).toMatchObject({
      status: "no_rule",
      quantity: null,
      reason: { code: "TESTS_PER_PACK_MISSING" },
    });
  });
});

describe("demanda de reactivos desde el Sheet", () => {
  const { buildTargets } = require("../consumableRules.service").__testables;

  test("DET/AÑO/PROCESO del Sheet es la demanda real del reactivo", () => {
    const targets = buildTargets({
      equipment: [{ equipment_id: 3, equipment_name: "cobas" }],
      consumptions: [
        { item_key: "cons:3:1", item_id: "111", item_type: "reactivo", equipment_id: 3, annual_qty: 1200 },
        { item_key: "cons:3:2", item_id: "222", item_type: "reactivo", equipment_id: 3, annual_qty: 0 },
        { item_key: "cons:3:9", item_id: "999", item_type: "control", equipment_id: 3, annual_qty: 4 },
      ],
      catalogItems: [],
    }, new Map());
    const byCode = new Map([...targets.values()].map((target) => [target.supplierCode, target.demandSource]));
    expect(byCode.get("111")).toBe("sheet");
    expect(byCode.get("222")).toBe("business_case");
    expect(byCode.get("999")).toBe("business_case");
  });
});
