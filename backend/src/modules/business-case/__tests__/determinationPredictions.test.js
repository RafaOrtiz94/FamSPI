jest.mock("../../../config/db", () => ({ query: jest.fn(async () => ({ rows: [] })) }));
jest.mock("../consumableSimulation.service", () => ({ getForBusinessCase: jest.fn() }));
jest.mock("../consumableRuleValidations.service", () => ({ listForBusinessCase: jest.fn(), saveValidation: jest.fn() }));

const simulationService = require("../consumableSimulation.service");
const validations = require("../consumableRuleValidations.service");
const service = require("../determinationPredictions.service");
const db = require("../../../config/db");

const product = (itemType, supplierCode, quantity, extra = {}) => ({
  itemType, supplierCode, name: `${itemType} ${supplierCode}`, unit: "presentacion", p50: quantity - 1, p90: quantity,
  prediction: { quantity, basis: "simulation_p90" }, ...extra,
});

describe("prediccion del motor en Determinaciones", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    simulationService.getForBusinessCase.mockResolvedValue({
      automatic: { status: "current" },
      equipment: [{
        equipmentId: 16,
        equipmentName: "cobas Pro",
        createdAt: "2026-10-14T12:00:00Z",
        products: [
          product("reactivo", "1", 11, { fromSheet: true }),
          product("calibrador", "10", 12),
          product("control", "20", 5),
          product("material", "30", 3),
        ],
      }],
    });
    validations.listForBusinessCase.mockResolvedValue([
      { origin: "expert", equipment_id: 16, item_type: "control", supplier_code: "20", validated_qty: 8, predicted_qty: 5, notes: "Corren 3 niveles", validated_by: "js@fam.com" },
    ]);
    validations.saveValidation.mockImplementation(async (id, input) => input);
  });

  test("no predice reactivos: solo calibradores, controles y materiales, con lo ya validado", async () => {
    const result = await service.getPredictions("bc");
    expect(result.items.map((item) => `${item.itemType}:${item.predicted}`)).toEqual(["calibrador:12", "control:5", "material:3"]);
    expect(result.items[1].validation).toMatchObject({ quantity: 8, changed: true, reason: "Corren 3 niveles" });
    expect(result.items[0].validation).toBeNull();
  });

  test("validar sin cambio guarda la prediccion; cambiar exige motivo", async () => {
    await service.validatePredictions("bc", [{ equipmentId: 16, itemType: "calibrador", supplierCode: "10" }], { email: "js@fam.com" });
    expect(validations.saveValidation).toHaveBeenCalledWith("bc", expect.objectContaining({
      itemType: "calibrador", validatedQty: 12, predictedQty: 12, notes: null,
    }), { email: "js@fam.com" });

    await expect(service.validatePredictions("bc", [{ equipmentId: 16, itemType: "material", supplierCode: "30", quantity: 6, reason: "" }]))
      .rejects.toMatchObject({ status: 400 });
    await service.validatePredictions("bc", [{ equipmentId: 16, itemType: "material", supplierCode: "30", quantity: 6, reason: "Dos equipos de respaldo" }]);
    expect(validations.saveValidation).toHaveBeenLastCalledWith("bc", expect.objectContaining({
      validatedQty: 6, predictedQty: 3, notes: "Dos equipos de respaldo",
    }), {});
  });

  test("no acepta reactivos ni productos sin prediccion, ni cantidades negativas", async () => {
    await expect(service.validatePredictions("bc", [{ equipmentId: 16, itemType: "reactivo", supplierCode: "1" }])).rejects.toMatchObject({ status: 400 });
    await expect(service.validatePredictions("bc", [{ equipmentId: 16, itemType: "control", supplierCode: "99" }])).rejects.toMatchObject({ status: 400 });
    await expect(service.validatePredictions("bc", [{ equipmentId: 16, itemType: "control", supplierCode: "20", quantity: -1, reason: "error" }])).rejects.toMatchObject({ status: 400 });
    expect(validations.saveValidation).not.toHaveBeenCalled();
  });

  test("las estadisticas del laboratorio no bloquean la validacion", async () => {
    await service.validatePredictions("bc", [{ equipmentId: 16, itemType: "calibrador", supplierCode: "10" }]);
    expect(validations.saveValidation).toHaveBeenCalled();
  });


  describe("PRODUCTO A ENTREGAR del Sheet distinto de la prediccion", () => {
    beforeEach(() => {
      db.query.mockImplementation(async (sql) => {
        const text = String(sql);
        if (text.includes("bc_requirements")) return { rows: [{ projected_deadline_months: 12 }] };
        if (text.includes("bc_consumption_items")) {
          return { rows: [
            { equipment_id: 16, item_type: "calibrador", item_id: "010", planned: 20 },
            { equipment_id: 16, item_type: "control", item_id: "20", planned: 8 },
            { equipment_id: 16, item_type: "material", item_id: "30", planned: 3 },
          ] };
        }
        return { rows: [] };
      });
    });

    test("marca lo que falta justificar; lo validado igual al Sheet con explicacion ya no", async () => {
      validations.listForBusinessCase.mockResolvedValue([
        { origin: "expert", equipment_id: 16, item_type: "control", supplier_code: "20", validated_qty: 8, predicted_qty: 5, notes: "Criterio: el laboratorio corre 3 niveles por turno" },
      ]);
      const { items } = await service.getPredictions("bc");
      const byType = Object.fromEntries(items.map((item) => [item.itemType, item]));
      expect(byType.calibrador).toMatchObject({ sheetPlanned: 20, sheetDifference: 8, needsJustification: true });
      expect(byType.control).toMatchObject({ sheetPlanned: 8, needsJustification: false });
      expect(byType.material).toMatchObject({ sheetPlanned: 3, sheetDifference: 0, needsJustification: false });
      expect((await service.pendingJustifications("bc", ["calibrador", "control"])).map((item) => item.supplierCode)).toEqual(["10"]);
    });

    test("justificar: un motivo y un dato que reproduzcan la cantidad del Sheet", async () => {
      const decision = { equipmentId: 16, itemType: "calibrador", supplierCode: "10", quantity: 20 };
      await expect(service.validatePredictions("bc", [{ ...decision, justification: {} }])).rejects.toThrow(/Elija el motivo/);
      // 1 por mes × 12 meses = 12, el Sheet dice 20: no cuadra.
      await expect(service.validatePredictions("bc", [{ ...decision, justification: { reason: "monthly_consumption", value: 1 } }]))
        .rejects.toThrow(/da 12 y PRODUCTO A ENTREGAR dice 20/);
      await service.validatePredictions("bc", [{ ...decision, justification: { reason: "monthly_consumption", value: 1.65 } }]);
      expect(validations.saveValidation).toHaveBeenLastCalledWith("bc", expect.objectContaining({
        validatedQty: 20, notes: "El laboratorio consume esa cantidad: consume 1.65 por mes → 20",
      }), {});
      const insert = db.query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO bc_knowledge_matrix"));
      expect(insert[1]).toEqual(expect.arrayContaining(["bc", 16, "calibrador", "10", "monthly_consumption", 1.65, 20, 12, true]));
    });

    test("la decision comercial pide una nota y no se reutiliza", async () => {
      const decision = { equipmentId: 16, itemType: "calibrador", supplierCode: "10", quantity: 20 };
      await expect(service.validatePredictions("bc", [{ ...decision, justification: { reason: "commercial", note: "corto" } }])).rejects.toThrow(/minimo 10|mínimo 10/);
      await service.validatePredictions("bc", [{ ...decision, justification: { reason: "commercial", note: "Cortesia pactada con el cliente" } }]);
      const insert = db.query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO bc_knowledge_matrix")).pop();
      expect(insert[1]).toEqual(expect.arrayContaining(["commercial", false]));
    });
  });

  describe("producto a entregar con entregas parciales", () => {
    test("entregas × ROUNDUP(consumo / entregas); sin entregas, el consumo", () => {
      expect(service.toDeliver(5, 4)).toBe(8);
      expect(service.toDeliver(8, 4)).toBe(8);
      expect(service.toDeliver(0.5, 4)).toBe(4);
      expect(service.toDeliver(5, 1)).toBe(5);
      expect(service.toDeliver(0, 4)).toBe(0);
    });

    test("se predice el consumo y se compara con el Sheet lo que se entrega", async () => {
      db.query.mockImplementation(async (sql) => (String(sql).includes("bc_deliveries")
        ? { rows: [{ delivery_type: "partial_time", partial_deliveries: 4 }] }
        : { rows: [{ equipment_id: 16, item_type: "calibrador", item_id: "10", planned: 12 }] }));
      const { items, partialDeliveries } = await service.getPredictions("bc");
      const calibrator = items.find((item) => item.itemType === "calibrador");
      expect(partialDeliveries).toBe(4);
      expect(calibrator).toMatchObject({ expectedConsumption: 12, predicted: 12, needsJustification: false });
      const control = items.find((item) => item.itemType === "control");
      // Consumo 5 en 4 entregas: 2 por entrega = 8.
      expect(control).toMatchObject({ expectedConsumption: 5, predicted: 8 });
    });
  });
});
