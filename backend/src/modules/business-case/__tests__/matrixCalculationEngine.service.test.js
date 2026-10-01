const {
  MatrixCalculationError,
  executePackage,
  validatePackage,
} = require("../matrixCalculationEngine.service");
const xp300DeterminationPackage = require("../calculationPackages/hematologyXp300Determination.package");
const xp300AdditionalPackages = require("../calculationPackages/hematologyXp300AdditionalPackages");
const matrixPackageRegistry = require("../matrixCalculationPackages.registry");
const xnl350NoLicensePackages = require("../calculationPackages/hematologyXnl350NoLicensePackages");
const xnlAllPurchasedPackages = require("../calculationPackages/hematologyXnlAllPurchasedPackages");
const xnl350WithLicenseEffective = require("../calculationPackages/hematologyXnl350WithLicenseEffective.package");
const matrixBusinessCaseCalculation = require("../matrixBusinessCaseCalculation.service");

const SHA256 = "a".repeat(64);

function source(cell, formula) {
  return { sheet: "DETERMINACION", cell, formula };
}

function itemIdentity() {
  return {
    kind: "item",
    configuration: "XP-300",
    section: "reactivo",
    productId: "3145611001",
    productName: "CELLPACK 20L",
    occurrence: 1,
  };
}

function buildPackage(overrides = {}) {
  return {
    packageId: "hematologia-xp300-determinacion",
    version: "2024-12-06.1",
    sourceWorkbook: {
      fileName: "matriz.xlsx",
      sha256: SHA256,
    },
    scope: {
      family: "hematologia",
      equipment: "XP-300",
      modality: "determinacion",
    },
    inputs: {
      annualDemand: { type: "number", source: { sheet: "BASE", cell: "B2", label: "annual" } },
      testsPerKit: { type: "number", source: { sheet: "BASE", cell: "B3", label: "tests" } },
      stabilityDays: { type: "number", source: { sheet: "BASE", cell: "B4", label: "stability" } },
      periodDays: { type: "number", source: { sheet: "BASE", cell: "B5", label: "period" } },
      pvp: { type: "number", source: { sheet: "BASE", cell: "B6", label: "pvp" } },
    },
    rules: [
      {
        id: "theoreticalQuantity",
        identity: itemIdentity(),
        source: source("G3", "=F3/D3"),
        expression: {
          op: "divide",
          args: [{ input: "annualDemand" }, { input: "testsPerKit" }],
        },
      },
      {
        id: "stabilityMinimum",
        identity: itemIdentity(),
        source: source("H3", "=360/E3"),
        expression: {
          op: "divide",
          args: [{ input: "periodDays" }, { input: "stabilityDays" }],
        },
      },
      {
        id: "deliverable",
        identity: itemIdentity(),
        source: source("I3", "=IF(G3>H3,G3,H3)"),
        expression: {
          op: "if",
          args: [
            { op: "gt", args: [{ ref: "theoreticalQuantity" }, { ref: "stabilityMinimum" }] },
            { ref: "theoreticalQuantity" },
            { ref: "stabilityMinimum" },
          ],
        },
      },
      {
        id: "roundedDeliverable",
        identity: itemIdentity(),
        source: source("J3", "=ROUNDUP(I3,0)"),
        expression: {
          op: "round_up",
          args: [{ ref: "deliverable" }, { value: 0 }],
        },
      },
      {
        id: "total",
        identity: itemIdentity(),
        source: source("L3", "=J3*K3"),
        expression: {
          op: "multiply",
          args: [{ ref: "roundedDeliverable" }, { input: "pvp" }],
        },
      },
    ],
    ...overrides,
  };
}

describe("matrixCalculationEngine", () => {
  it("ejecuta un paquete versionado y conserva la trazabilidad por celda", () => {
    const result = executePackage(buildPackage(), {
      annualDemand: "12005",
      testsPerKit: "100",
      stabilityDays: "30",
      periodDays: "360",
      pvp: "10.50",
    });

    expect(result.values).toEqual({
      theoreticalQuantity: "120.05",
      stabilityMinimum: "12",
      deliverable: "120.05",
      roundedDeliverable: "121",
      total: "1270.5",
    });
    expect(result.trace).toHaveLength(5);
    expect(result.trace[4]).toMatchObject({
      ruleId: "total",
      dependencies: ["roundedDeliverable"],
      source: { sheet: "DETERMINACION", cell: "L3", formula: "=J3*K3" },
    });
  });

  it("reproduce ROUNDUP y ROUNDDOWN alejandose y acercandose a cero", () => {
    const packageDefinition = buildPackage({
      inputs: { value: { type: "number", source: { sheet: "BASE", cell: "B1", label: "value" } } },
      rules: [
        {
          id: "up",
          identity: itemIdentity(),
          source: source("A1", "=ROUNDUP(B1,0)"),
          expression: { op: "round_up", args: [{ input: "value" }, { value: 0 }] },
        },
        {
          id: "down",
          identity: itemIdentity(),
          source: source("A2", "=ROUNDDOWN(B1,0)"),
          expression: { op: "round_down", args: [{ input: "value" }, { value: 0 }] },
        },
      ],
    });

    expect(executePackage(packageDefinition, { value: "-10.1" }).values).toEqual({
      up: "-11",
      down: "-10",
    });
  });

  it.each([
    ["=#REF!+G51", "BROKEN_SOURCE_REFERENCE"],
    ["=30*[1]BC!$B$47/F9", "EXTERNAL_SOURCE_REFERENCE"],
  ])("rechaza formula fuente no publicable: %s", (formula, expectedCode) => {
    const packageDefinition = buildPackage();
    packageDefinition.rules[0].source.formula = formula;

    expect(() => validatePackage(packageDefinition)).toThrow(
      expect.objectContaining({ code: expectedCode })
    );
  });

  it("rechaza dependencias circulares", () => {
    const packageDefinition = buildPackage({
      inputs: {},
      rules: [
        { id: "a", identity: itemIdentity(), source: source("A1", "=B1"), expression: { ref: "b" } },
        { id: "b", identity: itemIdentity(), source: source("B1", "=A1"), expression: { ref: "a" } },
      ],
    });

    expect(() => validatePackage(packageDefinition)).toThrow(
      expect.objectContaining({ code: "CYCLIC_DEPENDENCY" })
    );
  });

  it("bloquea division por cero con un error explicito", () => {
    expect(() => executePackage(buildPackage(), {
      annualDemand: 100,
      testsPerKit: 0,
      stabilityDays: 30,
      periodDays: 360,
      pvp: 10,
    })).toThrow(expect.objectContaining({ code: "DIVISION_BY_ZERO" }));
  });

  it("rechaza entradas desconocidas y valores numericos implicitos", () => {
    const validInputs = {
      annualDemand: 100,
      testsPerKit: 10,
      stabilityDays: 30,
      periodDays: 360,
      pvp: 10,
    };

    expect(() => executePackage(buildPackage(), { ...validInputs, extra: 1 })).toThrow(
      expect.objectContaining({ code: "UNKNOWN_INPUT" })
    );
    expect(() => executePackage(buildPackage(), { ...validInputs, annualDemand: null })).toThrow(
      expect.objectContaining({ code: "INVALID_NUMBER" })
    );
  });

  it("no evalua la rama descartada de un IF", () => {
    const packageDefinition = buildPackage({
      inputs: { enabled: { type: "boolean", source: { sheet: "BASE", cell: "B1", label: "enabled" } } },
      rules: [{
        id: "safe",
        identity: { kind: "aggregate", name: "conditional-test" },
        source: source("A1", "=IF(B1,1/0,5)"),
        expression: {
          op: "if",
          args: [
            { input: "enabled" },
            { op: "divide", args: [{ value: 1 }, { value: 0 }] },
            { value: 5 },
          ],
        },
      }],
    });

    expect(executePackage(packageDefinition, { enabled: false }).values.safe).toBe("5");
  });

  it("expone errores tipados para que la integracion pueda bloquear la publicacion", () => {
    try {
      executePackage(buildPackage(), {
        annualDemand: 100,
        testsPerKit: 0,
        stabilityDays: 30,
        periodDays: 360,
        pvp: 10,
      });
      throw new Error("se esperaba MatrixCalculationError");
    } catch (error) {
      expect(error).toBeInstanceOf(MatrixCalculationError);
      expect(error.code).toBe("DIVISION_BY_ZERO");
    }
  });

  it("reproduce los resultados almacenados de DETERMINACION XP-300", () => {
    const result = executePackage(xp300DeterminationPackage, {
      annualDemand: 12200,
      contractMonths: 12,
      equipmentCount: 1,
      additionalInvestmentsSubtotal: 1920,
    });

    expect(result.values["cellpack20l.total"]).toBe("7084");
    expect(result.values["stromaWhKx21.total"]).toBe("7392");
    expect(result.values["eightCheck3wp.total"]).toBe("1345");
    expect(result.values["printerPaper.total"]).toBe("1120");
    expect(Number(result.values["process.baseUnitValue"])).toBeCloseTo(2.2294262295081966, 14);
    expect(Number(result.values["process.valueWithMargin"])).toBeCloseTo(2.563840163934426, 14);
    expect(Number(result.values["process.initialValue"])).toBeCloseTo(31278.85, 10);
    expect(result.values["process.finalValue"]).toBe("27199");
  });

  it("reproduce los resultados almacenados de PRUEBA EFECTIVA XP-300", () => {
    const result = executePackage(xp300AdditionalPackages.effective, {
      annualDemand: 12200,
      contractMonths: 12,
      equipmentCount: 1,
      additionalInvestmentsSubtotal: 1920,
    });

    expect(result.values["cellpack20l.baseTotal"]).toBe("8349");
    expect(result.values["stromaWhKx21.baseTotal"]).toBe("8712");
    expect(result.values["eightCheck3wp.baseTotal"]).toBe("1345");
    expect(result.values["printerPaper.baseTotal"]).toBe("1360");
    expect(Number(result.values["process.baseUnitValue"])).toBeCloseTo(2.4609836065573774, 14);
    expect(Number(result.values["process.valueWithMargin"])).toBeCloseTo(2.830131147540984, 14);
    expect(Number(result.values["process.initialValue"])).toBeCloseTo(34527.6, 10);
    expect(Number(result.values["process.finalValue"])).toBeCloseTo(30024, 10);
  });

  it("reproduce los resultados almacenados de TODO COMPRADO XP-300", () => {
    const result = executePackage(xp300AdditionalPackages.allPurchased, {
      annualDemand: 12200,
      contractMonths: 12,
      equipmentCount: 1,
      additionalInvestmentsSubtotal: 1920,
    });

    expect(result.values["cellpack20l.roundedDeliverable"]).toBe("27");
    expect(result.values["eightCheck3wp.roundedDeliverable"]).toBe("4");
    expect(result.values["allocation.additionalAndSpareParts"]).toBe("2130");
    expect(result.values["allocation.baseProducts"]).toBe("16075");
    expect(Number(result.values["allocation.factor"])).toBeCloseTo(0.13250388802488336, 15);
    expect(Number(result.values["cellpack20l.allPurchasedTotal"])).toBeCloseTo(7736.134059097978, 10);
    expect(Number(result.values["process.allPurchasedUnitValue"])).toBeCloseTo(2.1756557377049184, 14);
  });

  it("selecciona paquetes solo por alcance y version exactos", () => {
    const selected = matrixPackageRegistry.getExactPackage({
      family: "hematologia",
      equipment: "XP-300",
      modality: "prueba_efectiva",
      version: "2024-12-06.1",
    });

    expect(selected.packageId).toBe("hematologia-xp300-prueba-efectiva");
    expect(matrixPackageRegistry.listPackages()).toHaveLength(13);
  });

  it("no usa fallback cuando el paquete exacto no existe", () => {
    expect(() => matrixPackageRegistry.getExactPackage({
      family: "hematologia",
      equipment: "CONFIGURACION NO EXISTENTE",
      modality: "determinacion",
      version: "2024-12-06.1",
    })).toThrow(expect.objectContaining({ code: "PACKAGE_NOT_FOUND" }));
  });

  it("expone un punto de integracion que exige modalidad y version explicitas", () => {
    const result = matrixBusinessCaseCalculation.calculate({
      family: "hematologia",
      equipment: "XP-300",
      modality: "determinacion",
      version: "2024-12-06.1",
      inputs: {
        annualDemand: 12200,
        contractMonths: 12,
        equipmentCount: 1,
        additionalInvestmentsSubtotal: 1920,
      },
    });

    expect(result.packageId).toBe("hematologia-xp300-determinacion");
    expect(result.values["process.finalValue"]).toBe("27199");
  });

  it("clasifica todas las hojas auditadas sin publicar las de inmuno-quimica", () => {
    const catalog = matrixBusinessCaseCalculation.getCatalog();

    expect(catalog.coverage).toEqual({
      workbookCount: 2,
      sheetCount: 29,
      formulaCellCount: 29377,
      classifiedSheetCount: 29,
      activeScopeCount: 13,
      quarantinedHematologyScopeCount: 14,
      quarantinedImmunochemistrySheetCount: 19,
      cachedErrorCellCount: 5800,
      cachedErrors: {
        divisionByZero: 5395,
        value: 46,
        reference: 359,
      },
      externalReferenceFormulaCount: 310,
      brokenFormulaLiteralCount: 6,
    });
    expect(catalog.packages).toHaveLength(13);
    expect(catalog.quarantinedScopes).toHaveLength(14);
  });

  it("distingue una configuracion inexistente de una matriz en cuarentena", () => {
    expect(() => matrixPackageRegistry.getExactPackage({
      family: "hematologia",
      equipment: "XNL-450 SIN LICENCIAS",
      modality: "determinacion",
      version: "2024-12-06.1",
    })).toThrow(expect.objectContaining({ code: "PACKAGE_QUARANTINED" }));

    expect(matrixPackageRegistry.listQuarantinedScopes()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          equipment: "XN-1000 CON LICENCIAS",
          modality: "todo_comprado",
          reason: "CROSS_CONFIGURATION_REFERENCE",
        }),
      ])
    );
  });

  const xnl350Inputs = {
    annualDemand: 12200,
    reticulocyteDemand: 0,
    fluidDemand: 0,
    contractMonths: 12,
    equipmentCount: 1,
    additionalInvestmentsSubtotal: 1920,
  };

  it("reproduce XNL-350 SIN LICENCIAS en modalidad determinacion", () => {
    const result = executePackage(xnl350NoLicensePackages.determination, xnl350Inputs);

    expect(result.values["sulfolyser5l.baseTotal"]).toBe("0");
    expect(result.values["sulfolyser500ml.baseTotal"]).toBe("3424.95");
    expect(Number(result.values["process.completeUnitValue"])).toBeCloseTo(1.8263852459016394, 14);
    expect(Number(result.values["process.basicUnitValue"])).toBeCloseTo(1.6690081967213115, 14);
    expect(Number(result.values["process.completeInitialValue"])).toBeCloseTo(25624.185, 8);
    expect(Number(result.values["process.completeFinalValue"])).toBeCloseTo(22281.9, 8);
  });

  it("reproduce XNL-350 SIN LICENCIAS en modalidad prueba efectiva", () => {
    const result = executePackage(xnl350NoLicensePackages.effective, xnl350Inputs);

    expect(result.values["sulfolyser5l.baseTotal"]).toBe("6642");
    expect(result.values["sulfolyser500ml.baseTotal"]).toBe("4109.94");
    expect(Number(result.values["process.completeUnitValue"])).toBeCloseTo(3.992449180327869, 14);
    expect(Number(result.values["process.basicUnitValue"])).toBeCloseTo(3.3169573770491807, 14);
    expect(Number(result.values["process.completeInitialValue"])).toBeCloseTo(56014.062, 8);
  });

  it("reproduce XNL-350 CON LICENCIAS en modalidad prueba efectiva", () => {
    const result = executePackage(xnl350WithLicenseEffective, xnl350Inputs);

    expect(result.values["cost.additional"]).toBe("1920");
    expect(result.values["cost.maintenance"]).toBe("570");
    expect(Number(result.values["process.completeUnitValue"])).toBeCloseTo(3.4136016393442628, 14);
    expect(Number(result.values["process.completeWithMargin"])).toBeCloseTo(3.925641885245902, 14);
    expect(Number(result.values["process.completeInitialValue"])).toBeCloseTo(47892.831, 8);
    expect(Number(result.values["process.completeFinalValue"])).toBeCloseTo(41645.94, 8);
    expect(result.values["process.basicUnitValue"]).toBeUndefined();
  });

  it("reproduce XNL-350 SIN LICENCIAS en modalidad todo comprado", () => {
    const result = executePackage(xnl350NoLicensePackages.allPurchased, xnl350Inputs);

    expect(result.values["allocation.additionalAndMaintenance"]).toBe("7560");
    expect(Number(result.values["allocation.baseProducts"])).toBeCloseTo(27343.62, 10);
    expect(Number(result.values["allocation.factor"])).toBeCloseTo(3.3177757736539637, 14);
    expect(Number(result.values["process.completeUnitValue"])).toBeCloseTo(10.139640983606556, 13);
    expect(Number(result.values["process.basicUnitValue"])).toBeCloseTo(7.456957347188766, 13);
  });

  it.each([
    ["XNL-350 CON LICENCIAS", 11.41832950819672, 8.408443941460206],
    ["XNL-450 SIN LICENCIAS", 11.41832950819672, 8.408443941460206],
    ["XNL-450 CON LICENCIAS", 12.697018032786886, 9.35993053573165],
    ["XNL-550 SIN LICENCIAS", 2.0178377049180325, 2.0178377049180325],
    ["XNL-550 CON LICENCIAS", 13.20849344262295, 9.740525173440224],
  ])("reproduce %s en modalidad todo comprado", (equipment, complete, basic) => {
    const packageDefinition = xnlAllPurchasedPackages.find((entry) => entry.scope.equipment === equipment);
    const result = executePackage(packageDefinition, xnl350Inputs);

    expect(Number(result.values["process.completeUnitValue"])).toBeCloseTo(complete, 12);
    expect(Number(result.values["process.basicUnitValue"])).toBeCloseTo(basic, 12);
  });

  it("reproduce XN-1000 SIN LICENCIAS en modalidad todo comprado", () => {
    const packageDefinition = xnlAllPurchasedPackages.find(
      (entry) => entry.scope.equipment === "XN-1000 SIN LICENCIAS"
    );
    const result = executePackage(packageDefinition, {
      ...xnl350Inputs,
      plateletDemand: 0,
    });

    expect(result.values["fluorocellWnr.roundedDeliverable"]).toBe("2");
    expect(result.trace).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ruleId: "cellpackDflReticulocytes.baseTotal",
        identity: expect.objectContaining({ occurrence: 2 }),
      }),
    ]));
    expect(Number(result.values["allocation.factor"])).toBeCloseTo(13.416784468607938, 12);
    expect(Number(result.values["process.completeUnitValue"])).toBeCloseTo(38.73783770491803, 11);
    expect(Number(result.values["process.basicUnitValue"])).toBeCloseTo(28.251399559473207, 11);
  });
});
