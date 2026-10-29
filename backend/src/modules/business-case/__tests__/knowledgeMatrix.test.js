const knowledge = require("../knowledgeMatrix");

const context = { sheetQuantity: 12, expected: 6, months: 12, deliveries: 4, name: "Producto" };

describe("motivos de justificacion", () => {
  test("cada motivo reproduce la cantidad con un solo dato", () => {
    expect(knowledge.evaluateJustification({ reason: "monthly_consumption", value: 1 }, context)).toMatchObject({ computed: 12, transferable: true });
    // 6 de consumo × 2 analizadores = 12 en 4 entregas = 12.
    expect(knowledge.evaluateJustification({ reason: "analyzers", value: 2 }, context)).toMatchObject({ computed: 12, transferable: true });
    // 4 entregas × (ROUNDUP(6/4) + 1) = 12.
    expect(knowledge.evaluateJustification({ reason: "extra_per_delivery", value: 1 }, context)).toMatchObject({ computed: 12 });
    // Consumo 18 menos 6 en stock = 12.
    expect(knowledge.evaluateJustification({ reason: "client_stock", value: 6 }, { ...context, expected: 18 })).toMatchObject({ computed: 12, transferable: false });
  });

  test("si el dato no reproduce el Sheet, se rechaza con la cuenta", () => {
    expect(() => knowledge.evaluateJustification({ reason: "analyzers", value: 3 }, context)).toThrow(/da 20 y PRODUCTO A ENTREGAR dice 12/);
    expect(() => knowledge.evaluateJustification({ reason: "analyzers", value: 1.5 }, context)).toThrow(/valor no válido/);
    expect(() => knowledge.evaluateJustification({ reason: "otro" }, context)).toThrow(/Elija el motivo/);
  });

  test("tolerancia de max(1, 10 %)", () => {
    expect(knowledge.evaluateJustification({ reason: "monthly_consumption", value: 1.05 }, context).computed).toBe(13);
    expect(() => knowledge.evaluateJustification({ reason: "monthly_consumption", value: 1.2 }, context)).toThrow(/da 15/);
  });

  test("el catalogo dice que dato pide cada motivo", () => {
    expect(knowledge.reasonCatalog().map((entry) => [entry.key, entry.field])).toEqual([
      ["monthly_consumption", "Unidades por mes"], ["analyzers", "Número de analizadores que lo usan"],
      ["extra_per_delivery", "Unidades extra por entrega"], ["client_stock", "Unidades en stock"], ["commercial", null],
    ]);
  });
});
