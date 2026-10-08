jest.mock("../../../config/db", () => ({ query: jest.fn() }));

const db = require("../../../config/db");
const predictiveLab = require("../businessCasePredictiveLab.service");
const {
  manufacturerKnowledgeFor,
  manufacturerRelationshipsForReactives,
  __testables: manufacturerTestables,
} = require("../businessCaseManufacturerKnowledge.catalog");

const {
  quantile,
  buildSamples,
  estimateTarget,
  selectHistoricalPrediction,
  backtest,
  buildEquipmentPrediction,
  buildProductKnowledge,
  comparePredictionToRegistered,
} = predictiveLab.__testables;

function historyRow(caseId, itemId, itemType, annualQty, plannedQty) {
  return {
    business_case_id: caseId,
    equipment_id: 10,
    item_id: itemId,
    name: itemId,
    item_type: itemType,
    annual_qty: annualQty,
    planned_qty: plannedQty,
  };
}

describe("businessCasePredictiveLab.service", () => {
  test("clasifica la coincidencia exacta sin tratar cero como dato ausente", () => {
    expect(comparePredictionToRegistered(3, 3)).toEqual({
      status: "exact_match",
      exactMatch: true,
      absoluteError: 0,
    });
    expect(comparePredictionToRegistered(3, 0)).toEqual({
      status: "different",
      exactMatch: false,
      absoluteError: 3,
    });
    expect(comparePredictionToRegistered(3, null).status).toBe("awaiting_registered_quantity");
  });

  test("normaliza codigos de catalogo sin depender de ceros iniciales", () => {
    expect(manufacturerTestables.normalizeCatalogCode("08057966 190")).toBe("8057966190");
    expect(manufacturerTestables.normalizeCatalogCode("7051506001")).toBe("7051506001");
  });

  test("valida XN Check contra la fuente primaria del fabricante", () => {
    const knowledge = manufacturerKnowledgeFor({
      productId: "7051506001",
      equipmentName: "XNL 550 (sin licencias)",
      formula: { values: { stabilityDays: 56 } },
    });

    expect(knowledge).toMatchObject({
      evidenceStatus: "manufacturer_primary_source",
      manufacturer: "Sysmex",
      productFamily: "XN Check",
      facts: { periodOfUseDays: 56, openVialStabilityDays: 7 },
      formulaComparison: { status: "supported", formulaValue: 56, manufacturerValue: 56 },
    });
    expect(knowledge.sources[0].url).toContain("sysmex-europe.com");
  });

  test("marca para revision la diferencia documentada de cobertura de Cellclean", () => {
    const knowledge = manufacturerKnowledgeFor({
      productId: "6952291001",
      equipmentName: "XNL-550 SIN LICENCIAS",
      formula: { values: { stabilityDays: 150 } },
    });

    expect(knowledge.formulaComparison).toEqual({
      field: "stabilityDays",
      status: "requires_review",
      formulaValue: 150,
      manufacturerValue: 140,
      manufacturerValueMeaning: "manufacturer_interval_x_internal_catalog_units_per_package",
    });
  });

  test("deduplica relaciones Roche compartidas entre reactivos presentes", () => {
    const candidates = manufacturerRelationshipsForReactives(new Map([
      ["reactivo::8058806190", 1000],
      ["reactivo::8057800190", 2000],
      ["reactivo::8057966190", 3000],
      ["reactivo::8445699190", 0],
    ]), "cobas Pure <303>");

    const commonControl = candidates.find((entry) => (
      entry.itemType === "control" && entry.productId === "5947626190"
    ));
    const lipidCalibrator = candidates.find((entry) => (
      entry.itemType === "calibrador" && entry.productId === "12172623122"
    ));

    expect(commonControl.supportedByAssays).toHaveLength(3);
    expect(lipidCalibrator.supportedByAssays).toEqual([
      { reactiveProductId: "8057966190", assay: "LDL-Cholesterol Gen.3" },
    ]);
    expect(candidates.some((entry) => entry.productId === "4528417190")).toBe(false);
  });

  test("calcula cuantiles empiricos sin fabricar muestras", () => {
    expect(quantile([1, 3, 5, 9], 0.5)).toBe(4);
    expect(quantile([1, 3, 5, 9], 0.8)).toBeCloseTo(6.6);
    expect(quantile([], 0.95)).toBeNull();
  });

  test("separa cada Business Case y conserva ceros observados como etiquetas", () => {
    const samples = buildSamples([
      historyRow("bc-a", "R1", "reactivo", 100, null),
      historyRow("bc-a", "C1", "control", null, 0),
      historyRow("bc-b", "R1", "reactivo", 200, null),
      historyRow("bc-b", "C1", "control", null, 4),
    ]);

    expect(samples).toHaveLength(2);
    expect(samples[0].targets.get("control::C1").quantity).toBe(0);
    expect(samples[1].targets.get("control::C1").quantity).toBe(4);
  });

  test("no usa planes pendientes como resultados operacionales", () => {
    const rows = [
      historyRow("bc-a", "R1", "reactivo", 100, null),
      { ...historyRow("bc-a", "C1", "control", null, 2), dispatch_status: "pendiente" },
      historyRow("bc-b", "R1", "reactivo", 200, null),
      {
        ...historyRow("bc-b", "C1", "control", null, 4),
        dispatch_status: "despachado",
        ops_dispatched_qty: 5,
      },
    ];

    const operational = buildSamples(rows, { labelMode: "operational_dispatch" });
    expect(operational.find((sample) => sample.caseId === "bc-a").targets.size).toBe(0);
    expect(operational.find((sample) => sample.caseId === "bc-b").targets.get("control::C1").quantity).toBe(5);
  });

  test("descarta historicos sin demanda reactiva positiva", () => {
    const samples = buildSamples([
      historyRow("bc-a", "R1", "reactivo", 0, null),
      historyRow("bc-a", "C1", "control", null, 2),
      historyRow("bc-b", "R1", "reactivo", 100, null),
      historyRow("bc-b", "C1", "control", null, 3),
    ]);

    expect(samples.map((sample) => sample.caseId)).toEqual(["bc-b"]);
  });

  test("combina mediana, proporcion y vecino cercano con escalamiento de demanda", () => {
    const peers = buildSamples([
      historyRow("bc-a", "R1", "reactivo", 100, null),
      historyRow("bc-a", "C1", "control", null, 2),
      historyRow("bc-b", "R1", "reactivo", 200, null),
      historyRow("bc-b", "C1", "control", null, 4),
    ]);
    const current = {
      caseId: "current",
      equipmentId: 10,
      reactives: new Map([["reactivo::R1", 300]]),
      targets: new Map(),
    };

    const result = estimateTarget(current, peers, "control::C1");
    expect(result.peerCount).toBe(2);
    expect(result.ratioScaledQuantity).toBe(6);
    expect(result.nearestScaledQuantity).toBe(6);
    expect(result.targetAwareNearestScaledQuantity).toBe(6);
    expect(result.targetAwareReactiveCount).toBe(1);
    expect(result.ensembleQuantity).toBe(6);
  });

  test("usa cantidad sin escalar para calibradores y escalada para controles", () => {
    const estimate = {
      peerCount: 2,
      nearestQuantity: 2,
      nearestScaledQuantity: 7.2,
    };

    expect(selectHistoricalPrediction("calibrador", estimate)).toEqual({
      method: "nearest_log_reactive_vector_unscaled",
      quantity: 2,
    });
    expect(selectHistoricalPrediction("control", estimate)).toEqual({
      method: "target_product_reactive_profile_scaled_rounded",
      quantity: 7,
    });
  });

  test("permite un solo par solo como sugerencia no publicable", () => {
    expect(selectHistoricalPrediction("material", {
      peerCount: 1,
      nearestQuantity: 2,
      nearestScaledQuantity: 3,
    })).toEqual({
      method: "target_product_reactive_profile_scaled",
      quantity: 3,
    });
  });

  test("construye contexto trazable por producto sin completar especificaciones ausentes", () => {
    const peers = buildSamples([
      historyRow("bc-a", "R1", "reactivo", 100, null),
      historyRow("bc-a", "C1", "control", null, 2),
    ]);
    const knowledge = buildProductKnowledge({
      productId: "C1",
      productName: "Control 1",
      itemType: "control",
      equipmentId: 10,
      catalogVariants: [77],
      consumptionRate: 1,
      metadata: { subcategoria: "quimica", id_fabricante: 42 },
    }, null, peers, "control::C1");

    expect(knowledge.identity).toMatchObject({ catalogId: 77, status: "verified_catalog" });
    expect(knowledge.verifiedSpecifications).toMatchObject({
      testsPerKit: null,
      stabilityDays: null,
      consumptionRate: 1,
    });
    expect(knowledge.classification).toMatchObject({
      subcategory: "quimica",
      manufacturerId: 42,
    });
    expect(knowledge.evidence.missingFields).toEqual(expect.arrayContaining([
      "tests_per_kit",
      "stability_days",
      "determination_link",
      "presentation",
    ]));
    expect(knowledge.observedReactiveProfile[0]).toMatchObject({
      productId: "R1",
      positivePeerSupport: 1,
    });
  });

  test("mantiene separados productos con el mismo codigo y tipos distintos", () => {
    const samples = buildSamples([
      historyRow("bc-a", "R1", "reactivo", 100, null),
      historyRow("bc-a", "DUP", "calibrador", null, 2),
      historyRow("bc-a", "DUP", "control", null, 5),
      historyRow("bc-a", "DUP", "material", null, 9),
    ]);

    expect(samples[0].targets.get("calibrador::DUP").quantity).toBe(2);
    expect(samples[0].targets.get("control::DUP").quantity).toBe(5);
    expect(samples[0].targets.get("material::DUP").quantity).toBe(9);
  });

  test("bloquea sugerencias historicas cuando un codigo identifica varios productos", () => {
    const historicalSamples = buildSamples([
      historyRow("bc-a", "R1", "reactivo", 100, null),
      historyRow("bc-a", "DUP", "control", null, 2),
    ]);
    const result = buildEquipmentPrediction({
      equipment: { equipment_id: 10 },
      catalogItems: [
        { equipment_id: 10, catalog_id: 16, item_id: "DUP", item_type: "control", name: "Normal" },
        { equipment_id: 10, catalog_id: 295, item_id: "DUP", item_type: "control", name: "Abnormal" },
      ],
      consumptions: [{ equipment_id: 10, item_id: "R1", item_type: "reactivo", annual_qty: 100 }],
      historicalSamples,
      deterministicEquipmentResult: null,
    });

    expect(result.productKnowledgeCoverage.ambiguousSupplierCodes).toBe(1);
    expect(result.items[0]).toMatchObject({
      suggestedQuantity: null,
      decisionSupportStatus: "ambiguous_product_identity",
      productKnowledge: { identity: { status: "ambiguous_supplier_code" } },
    });
  });

  test("el backtest excluye todo el Business Case retenido", () => {
    const samples = buildSamples([
      historyRow("bc-a", "R1", "reactivo", 100, null),
      historyRow("bc-a", "C1", "control", null, 2),
      historyRow("bc-b", "R1", "reactivo", 200, null),
      historyRow("bc-b", "C1", "control", null, 4),
      historyRow("bc-c", "R1", "reactivo", 300, null),
      historyRow("bc-c", "C1", "control", null, 6),
    ]);

    const result = backtest(samples);
    expect(result.method).toBe("leave-one-business-case-out");
    expect(result.folds).toBe(3);
    expect(result.positiveTargetRows).toBe(3);
    expect(result.quantityAccuracyPercent).toBe(100);
    expect(result.exactPositivePercent).toBe(100);
    expect(result.predictionCoveragePercent).toBe(100);
  });

  test("mantiene la formula como recomendacion y nunca publica desde el laboratorio", () => {
    const history = [];
    for (let index = 1; index <= 5; index += 1) {
      history.push(historyRow(`bc-${index}`, "R1", "reactivo", 100 * index, null));
      history.push(historyRow(`bc-${index}`, "C1", "control", null, 2 * index));
    }
    const historicalSamples = buildSamples(history);
    const result = buildEquipmentPrediction({
      equipment: { equipment_id: 10 },
      catalogItems: [{ equipment_id: 10, item_id: "C1", item_type: "control", name: "Control" }],
      consumptions: [
        { equipment_id: 10, item_id: "R1", item_type: "reactivo", annual_qty: 600 },
        {
          equipment_id: 10,
          item_id: "C1",
          item_type: "control",
          annual_qty: 0,
          planned_qty: 13,
        },
      ],
      historicalSamples,
      deterministicEquipmentResult: {
        calculation: { items: [{ productId: "C1", productName: "Control", calculatedQuantity: 13 }] },
      },
    });

    expect(result.targetAccuracyPercent).toBe(99.9);
    expect(result.offerWriteEnabled).toBe(false);
    expect(result.items[0]).toMatchObject({
      deterministicQuantity: 13,
      suggestedQuantity: 13,
      recommendationSource: "audited_formula",
      registeredQuantity: 13,
      learningFeedback: { status: "exact_match", exactMatch: true, absoluteError: 0 },
      publishable: false,
    });
    expect(result.learningSummary).toMatchObject({
      validationGrade: "planning_proxy_only",
      evaluatedProducts: 1,
      exactMatchProducts: 1,
      exactMatchPercent: 100,
    });
  });

  test("expone la revision de fabricante sin sustituir la cantidad calculada", () => {
    const result = buildEquipmentPrediction({
      equipment: { equipment_id: 27, equipment_name: "XNL 550 (sin licencias)" },
      catalogItems: [{
        equipment_id: 27,
        equipment_name: "XNL 550 (sin licencias)",
        item_id: "6952291001",
        item_type: "material",
        name: "CELLCLEAN AUTO 4 ML X 20",
      }],
      consumptions: [{
        equipment_id: 27,
        item_id: "6510167001",
        item_type: "reactivo",
        annual_qty: 7200,
      }],
      historicalSamples: [],
      deterministicEquipmentResult: {
        calculation: {
          items: [{
            productId: "6952291001",
            productName: "CELLCLEAN AUTO 4 ML X 20",
            calculatedQuantity: 3,
          }],
        },
      },
    });

    expect(result.items[0]).toMatchObject({
      suggestedQuantity: 3,
      decisionSupportStatus: "formula_manufacturer_review_required",
      quantityValidated: true,
      manufacturerValidated: false,
      publishable: false,
    });
  });

  test("bloquea la elegibilidad cuando no hay cinco casos comparables", () => {
    const result = buildEquipmentPrediction({
      equipment: { equipment_id: 10 },
      catalogItems: [{ equipment_id: 10, item_id: "C1", item_type: "control", name: "Control" }],
      consumptions: [{ equipment_id: 10, item_id: "R1", item_type: "reactivo", annual_qty: 100 }],
      historicalSamples: buildSamples([
        historyRow("bc-a", "R1", "reactivo", 100, null),
        historyRow("bc-a", "C1", "control", null, 2),
      ]),
      deterministicEquipmentResult: null,
    });

    expect(result.automaticCorrectionEligible).toBe(false);
    expect(result.confidence).toBe("insufficient");
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "INSUFFICIENT_COMPARABLE_HISTORY" }),
    ]));
    expect(result.items[0].publishable).toBe(false);
  });

  test("consulta solo equipos historicos actualmente seleccionados y excluye borradores", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await predictiveLab.buildPredictivePreview({
      businessCaseId: 99,
      equipment: [{ equipment_id: 10 }],
      consumptions: [],
      catalogItems: [],
      deterministicEquipmentResults: [],
    });

    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain("JOIN bc_equipment_selection selected");
    expect(sql).toContain("vc.canonical_state <> 'DRAFT_INICIAL'");
  });
});
