jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../businessCaseOffer.service", () => ({
  __testables: {
    getOfferPriceColumnVisibility: jest.fn(() => ({
      showKitPrice: true,
      showDeterminationPrice: true,
    })),
  },
}));
jest.mock("../businessCaseSheetSyncLocal.service", () => ({
  loadTemplateDefinition: jest.fn(),
  buildSheetPayloads: jest.fn(),
  pullAnnualQuantitiesFromGoogleSheet: jest.fn(),
  pullMaximumQuantitiesFromGoogleSheet: jest.fn(),
}));

const registry = require("../matrixCalculationPackages.registry");
const sheetReader = require("../businessCaseSheetSyncLocal.service");
const pricingLab = require("../businessCasePricingLab.service");

const {
  resolveModality,
  resolveMatrixEquipment,
  calculateAdditionalInvestmentsSubtotal,
  derivePackageInputs,
  extractCalculatedItems,
  annualQuantitySourceForType,
} = pricingLab.__testables;

describe("businessCasePricingLab.service", () => {
  test.each([
    ["TODO COMPRADO", "todo_comprado"],
    ["Adquisicion de determinaciones efectivas", "prueba_efectiva"],
    ["Comodato por determinacion", "determinacion"],
    ["Determinaciones efectivas y todo comprado", null],
    ["Comodato hematologia", null],
  ])("resuelve modalidad sin inferir un texto ambiguo: %s", (value, expected) => {
    expect(resolveModality(value)).toBe(expected);
  });

  test.each([
    ["XP 300", "XP-300"],
    ["XNL550 CON LICENCIAS WG", "XNL-550 CON LICENCIAS"],
    ["XNL350 SIN LICENCIAS WG", "XNL-350 SIN LICENCIAS"],
    ["XN-1000 CON LICENCIAS/SIN WG", "XN-1000 CON LICENCIAS"],
    ["Equipo no auditado", null],
  ])("mapea solo equipos con equivalencia auditada: %s", (value, expected) => {
    expect(resolveMatrixEquipment(value)).toBe(expected);
  });

  test("calcula inversiones con la misma depreciacion mensual del proceso", () => {
    const result = calculateAdditionalInvestmentsSubtotal([
      {
        selected: true,
        quantity: 2,
        unit_price: 900,
        unit_price_financial: 1200,
        depreciation_percentage: 10,
        name: "UPS",
      },
    ], 24);

    expect(result).toEqual({ subtotal: 480, warnings: [] });
  });

  test("expone la política de columna comprobada para cada tipo de ítem", () => {
    expect(annualQuantitySourceForType("reactivo")).toBe("DET/AÑO PROCESO");
    expect(annualQuantitySourceForType("control")).toContain("PRODUCTO CALCULADO");
    expect(annualQuantitySourceForType("control")).toContain("PRODUCTO A ENTREGAR/ENVIAR");
    expect(annualQuantitySourceForType("desconocido")).toBe("FUENTE NO CLASIFICADA");
  });

  test("deriva entradas XN desde DET/AÑO, plazo, equipos e inversiones con evidencia", () => {
    const packageDefinition = registry.getExactPackage({
      family: "hematologia",
      equipment: "XN-1000 SIN LICENCIAS",
      modality: "todo_comprado",
      version: "2024-12-06.1",
    });
    const result = derivePackageInputs({
      packageDefinition,
      equipment: { quantity: 1 },
      requirements: { projected_deadline_months: 60 },
      items: [
        { item_key: "base", item_id: "6510167001", name: "CELLPACK DCL", annual_qty: 7200 },
        { item_key: "retic", item_id: "6510272001", name: "CELLPACK DFL", annual_qty: 350 },
        { item_key: "fluid", item_id: "7051409001", name: "CELLCLEAN AUTO", annual_qty: 20 },
        { item_key: "plt", item_id: "6510299001", name: "FLUOROCELL PLT", annual_qty: 45 },
      ],
      investments: [{
        selected: true,
        quantity: 1,
        unit_price_financial: 1200,
        depreciation_percentage: 10,
        name: "UPS",
      }],
    });

    expect(result.blockers).toEqual([]);
    expect(result.inputs).toEqual({
      annualDemand: 7200,
      reticulocyteDemand: 350,
      fluidDemand: 20,
      contractMonths: 60,
      equipmentCount: 1,
      additionalInvestmentsSubtotal: 600,
      plateletDemand: 45,
    });
    expect(result.evidence.annualDemand).toMatchObject({
      source: "bc_consumption_items.annual_qty",
      productId: "6510167001",
    });
  });

  test("bloquea el calculo cuando falta DET/AÑO en el producto ancla", () => {
    const packageDefinition = registry.getExactPackage({
      family: "hematologia",
      equipment: "XP-300",
      modality: "determinacion",
      version: "2024-12-06.1",
    });
    const result = derivePackageInputs({
      packageDefinition,
      equipment: { quantity: 1 },
      requirements: { projected_deadline_months: 12 },
      items: [],
      investments: [],
    });

    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ANNUAL_DEMAND_MISSING" }),
    ]));
  });

  test("bloquea demandas duplicadas incompatibles en vez de escoger una", () => {
    const packageDefinition = registry.getExactPackage({
      family: "hematologia",
      equipment: "XP-300",
      modality: "determinacion",
      version: "2024-12-06.1",
    });
    const result = derivePackageInputs({
      packageDefinition,
      equipment: { quantity: 1 },
      requirements: { projected_deadline_months: 12 },
      items: [
        { item_key: "a", item_id: "3145611001", annual_qty: 1000 },
        { item_key: "b", item_id: "3145611001", annual_qty: 1200 },
      ],
      investments: [],
    });

    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "DEMAND_VALUES_CONFLICT" }),
    ]));
  });

  test("no fabrica un precio por determinacion si el paquete no produce PVP por kit", () => {
    const items = extractCalculatedItems({
      trace: [{
        ruleId: "cellpack.roundedDeliverable",
        value: "12",
        source: { sheet: "TODO COMPRADO", cell: "J7" },
        identity: {
          kind: "item",
          productId: "6510167001",
          productName: "CELLPACK DCL",
          occurrence: 1,
        },
      }],
    }, []);

    expect(items[0].proposedKitPrice).toBeNull();
    expect(items[0].proposedDeterminationPrice).toBeNull();
  });

  test("lee cantidades del Sheet y las superpone solo en memoria", async () => {
    const originalConsumptions = [{
      item_key: "cons:1:10",
      item_id: "3145611001",
      name: "CELLPACK 20L",
      item_type: "reactivo",
      equipment_id: 1,
      annual_qty: 100,
      planned_qty: 2,
    }];
    sheetReader.loadTemplateDefinition.mockReturnValue({ sheets: [] });
    sheetReader.buildSheetPayloads.mockReturnValue([{ sheet_name: "XP 300", items: [] }]);
    sheetReader.pullAnnualQuantitiesFromGoogleSheet.mockResolvedValue([
      { item_key: "cons:1:10", annual_qty: 250 },
    ]);
    sheetReader.pullMaximumQuantitiesFromGoogleSheet.mockResolvedValue([
      { item_key: "cons:1:10", planned_qty: 6 },
    ]);

    const result = await pricingLab.__testables.readSheetQuantitiesForPreview({
      context: { modern_bc_metadata: { bc_sheet_generation: { last: { sheet_id: "sheet-1" } } } },
      equipment: [{ equipment_id: 1, equipment_name: "XP 300", equipment_code: "XP300" }],
      catalogItems: [],
      consumptions: originalConsumptions,
    });

    expect(result.sheetRead).toMatchObject({ ok: true, readOnly: true });
    expect(result.consumptions[0]).toMatchObject({ annual_qty: 250, planned_qty: 6 });
    expect(originalConsumptions[0]).toMatchObject({ annual_qty: 100, planned_qty: 2 });
  });
});
