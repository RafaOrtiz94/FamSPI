const SOURCE_SHA256 = "1b8ff28f1b2917e79682c94f12d925490e8fe0b2f5e500b923b284065b76d338";

const BASE_ITEMS = Object.freeze([
  { key: "cellpackDcl", productId: "6510167001", productName: "CELLPACK DCL", testsPerKit: 450, stabilityDays: 60, pvp: 121, demand: "basic" },
  { key: "sulfolyser5l", productId: "3337006001", productName: "SULFOLYSER REAGENT X 5L", testsPerKit: 9450, stabilityDays: 60, pvp: 1107, demand: "basic" },
  { key: "sulfolyser500ml", productId: "12215616001", productName: "SULFOLYSER REAGENT 500 ml", testsPerKit: 850, stabilityDays: 60, pvp: "228.33", demand: "basic" },
  { key: "wdfLysercell", productId: "7837984001", productName: "WDF Lysercell WDF", testsPerKit: 2450, stabilityDays: 90, pvp: 176, demand: "basic" },
  { key: "wdfFluorocell", productId: "6510256001", productName: "WDF Fluorocell WDF 2X42 ML", testsPerKit: 3400, stabilityDays: 180, pvp: 862, demand: "basic" },
  { key: "cellcleanAuto", productId: "6952291001", productName: "CELLCLEAN AUTO 4 ML X 20", stabilityDays: 150, pvp: 52, demand: "basic", dynamicTestsPerKit: true },
  { key: "xnCheck", productId: "7051506001", productName: "XN Check 12x3.0ml Level 1,2,3", stabilityDays: 56, pvp: 544, demand: "basic", dynamicTestsPerKit: true },
  { key: "fluorocellRet", productId: "6510272001", productName: "FLUOROCELL RET 2 X 12ML", testsPerKit: 650, stabilityDays: 180, pvp: 1705, demand: "reticulocytes" },
  { key: "cellpackDfl", productId: "9426752001", productName: "CELLPACK DFL 1 L", testsPerKit: 450, stabilityDays: 60, pvp: 34, demand: "reticulocytes" },
  { key: "xnCheckBf", productId: "7051409001", productName: "XN-Check BF 6x3.0ml Level 1,2", stabilityDays: 56, pvp: 661, demand: "fluids", dynamicTestsPerKit: true },
]);

const CONFIGURATIONS = Object.freeze([
  { configuration: "XNL-350 CON LICENCIAS", startRow: 26, costRow: 37, maintenance: 570 },
  { configuration: "XNL-450 SIN LICENCIAS", startRow: 48, costRow: 59, maintenance: 570 },
  { configuration: "XNL-450 CON LICENCIAS", startRow: 70, costRow: 81, maintenance: 670 },
  {
    configuration: "XNL-550 SIN LICENCIAS",
    startRow: 92,
    costRow: 103,
    maintenance: 615,
    roundedOffsets: [0, 2, 3, 4, 5],
    literalZeroOffsets: [1, 6],
    factorUsesOnlyMaintenance: true,
  },
  { configuration: "XNL-550 CON LICENCIAS", startRow: 114, costRow: 125, maintenance: 710 },
]);

const INPUTS = Object.freeze({
  annualDemand: { type: "number", source: { sheet: "BIOMETRIA HEMATICA", cell: "B2", label: "BIOMETRIA HEMATICA" } },
  reticulocyteDemand: { type: "number", source: { sheet: "BIOMETRIA HEMATICA", cell: "D2", label: "RETICULOCITOS" } },
  fluidDemand: { type: "number", source: { sheet: "BIOMETRIA HEMATICA", cell: "H2", label: "FLUIDOS CORPORALES" } },
  contractMonths: { type: "number", source: { sheet: "BIOMETRIA HEMATICA", cell: "B6", label: "TIEMPO CONTRATO EN MESES" } },
  equipmentCount: { type: "number", source: { sheet: "BIOMETRIA HEMATICA", cell: "B10", label: "NUMERO DE EQUIPOS" } },
  additionalInvestmentsSubtotal: { type: "number", source: { sheet: "BC", cell: "F109", label: "Sub total" } },
});

function aggregateIdentity(configuration, name) {
  return { kind: "aggregate", name: `${configuration}: ${name}` };
}

function itemIdentity(configuration, item) {
  return {
    kind: "item",
    configuration,
    section: "reactivo_consumible",
    productId: item.productId,
    productName: item.productName,
    occurrence: item.occurrence || 1,
  };
}

function buildXn1000NoLicensePackage() {
  const configuration = "XN-1000 SIN LICENCIAS";
  const startRow = 136;
  const costRow = 151;
  const maintenance = 2686;
  const items = [
    ...BASE_ITEMS.slice(0, 5).map((item) => ({ ...item })),
    { key: "fluorocellWnr", productId: "6510248001", productName: "FLUOROCELL WNR 2 X 82ML", testsPerKit: 6945, stabilityDays: 180, pvp: 634, demand: "basic", rounding: "round_up" },
    { key: "lysercellWnr", productId: "7838000001", productName: "LYSERCELL-WNR WNR-210A", testsPerKit: 2950, stabilityDays: 90, pvp: 128, demand: "basic", rounding: "round_up" },
    { ...BASE_ITEMS[5] },
    { ...BASE_ITEMS[6] },
    { key: "fluorocellPlt", productId: "6510299001", productName: "FLUOROCELL PLT 2 X 12ML", testsPerKit: 650, stabilityDays: 180, pvp: 545, demand: "platelets" },
    { ...BASE_ITEMS[8], key: "cellpackDflPlatelets", demand: "platelets", occurrence: 1 },
    { ...BASE_ITEMS[7] },
    { ...BASE_ITEMS[8], key: "cellpackDflReticulocytes", occurrence: 2 },
    { ...BASE_ITEMS[9] },
  ];
  const inputs = {
    ...INPUTS,
    plateletDemand: {
      type: "number",
      source: { sheet: "BIOMETRIA HEMATICA", cell: "F2", label: "PLAQUETAS FLUORESCENTES" },
    },
  };
  const rules = [
    rule("demand.basic", aggregateIdentity(configuration, "BIOMETRIA HEMATICA"), "F136", "=(('BIOMETRIA HEMATICA'!$B$2))", { input: "annualDemand" }),
    rule("demand.platelets", aggregateIdentity(configuration, "PLAQUETAS FLUORESCENTES"), "F145", "=(('BIOMETRIA HEMATICA'!$F$2))", { input: "plateletDemand" }),
    rule("demand.reticulocytes", aggregateIdentity(configuration, "RETICULOCITOS"), "F147", "=(('BIOMETRIA HEMATICA'!$D$2))", { input: "reticulocyteDemand" }),
    rule("demand.fluids", aggregateIdentity(configuration, "FLUIDOS CORPORALES"), "F149", "=(('BIOMETRIA HEMATICA'!$H$2))", { input: "fluidDemand" }),
  ];

  items.forEach((item, offset) => {
    const row = startRow + offset;
    const identity = itemIdentity(configuration, item);
    const testsId = `${item.key}.testsPerKit`;
    const roundedId = `${item.key}.roundedDeliverable`;
    const demandId = `demand.${item.demand}`;

    rules.push(rule(
      testsId,
      identity,
      `D${row}`,
      item.dynamicTestsPerKit ? `=(((F${startRow}/30)/12)*E${row})` : String(item.testsPerKit),
      item.dynamicTestsPerKit
        ? {
          op: "multiply",
          args: [
            {
              op: "divide",
              args: [
                { op: "divide", args: [{ ref: "demand.basic" }, { value: 30 }] },
                { value: 12 },
              ],
            },
            { value: item.stabilityDays },
          ],
        }
        : { value: item.testsPerKit }
    ));
    rules.push(
      rule(
        `${item.key}.calculatedQuantity`, identity, `G${row}`, `=F${row}/D${row}`,
        { op: "divide", args: [{ ref: demandId }, { ref: testsId }] }
      ),
      rule(
        `${item.key}.stabilityMinimum`, identity, `H${row}`,
        `=(360/E${row})*'BIOMETRIA HEMATICA'!$B$10`,
        {
          op: "multiply",
          args: [
            { op: "divide", args: [{ value: 360 }, { value: item.stabilityDays }] },
            { input: "equipmentCount" },
          ],
        }
      ),
      rule(
        `${item.key}.deliverableQuantity`, identity, `I${row}`,
        `=IF(G${row}>H${row},G${row},H${row})`,
        {
          op: "if",
          args: [
            { op: "gt", args: [{ ref: `${item.key}.calculatedQuantity` }, { ref: `${item.key}.stabilityMinimum` }] },
            { ref: `${item.key}.calculatedQuantity` },
            { ref: `${item.key}.stabilityMinimum` },
          ],
        }
      ),
      rule(
        roundedId,
        identity,
        `K${row}`,
        `=${item.rounding === "round_up" ? "ROUNDUP" : "ROUNDDOWN"}(I${row},0)`,
        {
          op: item.rounding === "round_up" ? "round_up" : "round_down",
          args: [{ ref: `${item.key}.deliverableQuantity` }, { value: 0 }],
        }
      ),
      rule(
        `${item.key}.baseTotal`, identity, `M${row}`, `=L${row}*K${row}`,
        { op: "multiply", args: [{ value: item.pvp }, { ref: roundedId }] }
      )
    );
  });

  rules.push(
    rule(
      "cost.additional", aggregateIdentity(configuration, "ADICIONALES"), "M151", "=(L151/K151)*K151",
      {
        op: "multiply",
        args: [
          { op: "divide", args: [{ input: "additionalInvestmentsSubtotal" }, { input: "contractMonths" }] },
          { input: "contractMonths" },
        ],
      }
    ),
    rule(
      "cost.maintenance", aggregateIdentity(configuration, "MANTENIMIENTO/REPUESTOS"), "M152", "=(L152*K151)",
      { op: "multiply", args: [{ value: maintenance }, { input: "contractMonths" }] }
    ),
    rule(
      "cost.equipmentPerDetermination", aggregateIdentity(configuration, "EQUIPO"), "M153",
      "=((((L152)*(K151))/'BIOMETRIA HEMATICA'!B2))",
      {
        op: "divide",
        args: [{ op: "multiply", args: [{ value: maintenance }, { input: "contractMonths" }] }, { input: "annualDemand" }],
      }
    ),
    rule(
      "allocation.additionalAndMaintenance", aggregateIdentity(configuration, "ADICIONALES Y MANTENIMIENTO"),
      "L154", "=SUM(M151:M152)",
      { op: "add", args: [{ ref: "cost.additional" }, { ref: "cost.maintenance" }] }
    ),
    rule(
      "allocation.baseProducts", aggregateIdentity(configuration, "PRODUCTOS BASE"), "L155", "=SUM(M136:M149)",
      { op: "add", args: items.map((item) => ({ ref: `${item.key}.baseTotal` })) }
    ),
    rule(
      "allocation.factor", aggregateIdentity(configuration, "FACTOR TODO COMPRADO"), "L156", "=(L154/L155)*K151",
      {
        op: "multiply",
        args: [
          { op: "divide", args: [{ ref: "allocation.additionalAndMaintenance" }, { ref: "allocation.baseProducts" }] },
          { input: "contractMonths" },
        ],
      }
    )
  );

  items.forEach((item, offset) => {
    const row = startRow + offset;
    const identity = itemIdentity(configuration, item);
    rules.push(
      rule(
        `${item.key}.allPurchasedPvp`, identity, `O${row}`, `=(L${row}*$L$156)+L${row}`,
        {
          op: "add",
          args: [
            { op: "multiply", args: [{ value: item.pvp }, { ref: "allocation.factor" }] },
            { value: item.pvp },
          ],
        }
      ),
      rule(
        `${item.key}.allPurchasedTotal`, identity, `P${row}`, `=O${row}*K${row}`,
        {
          op: "multiply",
          args: [{ ref: `${item.key}.allPurchasedPvp` }, { ref: `${item.key}.roundedDeliverable` }],
        }
      )
    );
  });

  rules.push(
    rule(
      "process.completeUnitValue", aggregateIdentity(configuration, "PVP BIOMETRIA COMPLETA"), "Q136",
      "=(SUM(P136:P149)/'BIOMETRIA HEMATICA'!B2)+M153",
      {
        op: "add",
        args: [
          {
            op: "divide",
            args: [{ op: "add", args: items.map((item) => ({ ref: `${item.key}.allPurchasedTotal` })) }, { input: "annualDemand" }],
          },
          { ref: "cost.equipmentPerDetermination" },
        ],
      }
    ),
    rule(
      "process.basicUnitValue", aggregateIdentity(configuration, "PVP BIOMETRIA"), "Q138",
      "=(SUM(P136:P144)/'BIOMETRIA HEMATICA'!B2)+M153",
      {
        op: "add",
        args: [
          {
            op: "divide",
            args: [{ op: "add", args: items.slice(0, 9).map((item) => ({ ref: `${item.key}.allPurchasedTotal` })) }, { input: "annualDemand" }],
          },
          { ref: "cost.equipmentPerDetermination" },
        ],
      }
    )
  );

  return Object.freeze({
    packageId: "hematologia-xn-1000-sin-licencias-todo-comprado",
    version: "2024-12-06.1",
    sourceWorkbook: {
      fileName: "TABLA MATRIZ COSTOS PARA COMERCIAL 2024-12-06 HEMATOLOGIA.xlsx",
      sha256: SOURCE_SHA256,
    },
    scope: { family: "hematologia", equipment: configuration, modality: "todo_comprado" },
    inputs,
    rules,
  });
}

function rule(id, identity, cell, formula, expression) {
  return {
    id,
    identity,
    source: { sheet: "COMODATO TODO COMPRADO XN", cell, formula },
    expression,
  };
}

function buildPackage(config) {
  const { configuration, startRow, costRow, maintenance } = config;
  const roundedOffsets = new Set(config.roundedOffsets || BASE_ITEMS.map((_item, index) => index));
  const literalZeroOffsets = new Set(config.literalZeroOffsets || []);
  const rules = [
    rule("demand.basic", aggregateIdentity(configuration, "BIOMETRIA HEMATICA"), `F${startRow}`, "=(('BIOMETRIA HEMATICA'!$B$2))", { input: "annualDemand" }),
    rule("demand.reticulocytes", aggregateIdentity(configuration, "RETICULOCITOS"), `F${startRow + 7}`, "=(('BIOMETRIA HEMATICA'!$D$2))", { input: "reticulocyteDemand" }),
    rule("demand.fluids", aggregateIdentity(configuration, "FLUIDOS CORPORALES"), `F${startRow + 9}`, "=(('BIOMETRIA HEMATICA'!$H$2))", { input: "fluidDemand" }),
  ];

  BASE_ITEMS.forEach((item, offset) => {
    const row = startRow + offset;
    const identity = itemIdentity(configuration, item);
    const testsId = `${item.key}.testsPerKit`;
    const roundedId = `${item.key}.roundedDeliverable`;
    const demandId = `demand.${item.demand}`;

    rules.push(rule(
      testsId,
      identity,
      `D${row}`,
      item.dynamicTestsPerKit ? `=(((F${startRow}/30)/12)*E${row})` : String(item.testsPerKit),
      item.dynamicTestsPerKit
        ? {
          op: "multiply",
          args: [
            {
              op: "divide",
              args: [
                { op: "divide", args: [{ ref: "demand.basic" }, { value: 30 }] },
                { value: 12 },
              ],
            },
            { value: item.stabilityDays },
          ],
        }
        : { value: item.testsPerKit }
    ));
    rules.push(
      rule(
        `${item.key}.calculatedQuantity`, identity, `G${row}`, `=F${row}/D${row}`,
        { op: "divide", args: [{ ref: demandId }, { ref: testsId }] }
      ),
      rule(
        `${item.key}.stabilityMinimum`, identity, `H${row}`,
        `=(360/E${row})*'BIOMETRIA HEMATICA'!$B$10`,
        {
          op: "multiply",
          args: [
            { op: "divide", args: [{ value: 360 }, { value: item.stabilityDays }] },
            { input: "equipmentCount" },
          ],
        }
      ),
      rule(
        `${item.key}.deliverableQuantity`, identity, `I${row}`,
        `=IF(G${row}>H${row},G${row},H${row})`,
        {
          op: "if",
          args: [
            { op: "gt", args: [{ ref: `${item.key}.calculatedQuantity` }, { ref: `${item.key}.stabilityMinimum` }] },
            { ref: `${item.key}.calculatedQuantity` },
            { ref: `${item.key}.stabilityMinimum` },
          ],
        }
      )
    );

    if (roundedOffsets.has(offset)) {
      rules.push(rule(
        roundedId, identity, `K${row}`, `=ROUNDDOWN(I${row},0)`,
        { op: "round_down", args: [{ ref: `${item.key}.deliverableQuantity` }, { value: 0 }] }
      ));
    } else {
      rules.push(rule(
        roundedId,
        identity,
        `K${row}`,
        literalZeroOffsets.has(offset) ? "0" : "BLANK",
        { value: 0 }
      ));
    }

    rules.push(rule(
      `${item.key}.baseTotal`, identity, `M${row}`, `=L${row}*K${row}`,
      { op: "multiply", args: [{ value: item.pvp }, { ref: roundedId }] }
    ));
  });

  rules.push(
    rule(
      "cost.additional", aggregateIdentity(configuration, "ADICIONALES"), `M${costRow}`,
      `=(L${costRow}/K${costRow})*K${costRow}`,
      {
        op: "multiply",
        args: [
          { op: "divide", args: [{ input: "additionalInvestmentsSubtotal" }, { input: "contractMonths" }] },
          { input: "contractMonths" },
        ],
      }
    ),
    rule(
      "cost.maintenance", aggregateIdentity(configuration, "MANTENIMIENTO/REPUESTOS"), `M${costRow + 1}`,
      `=(L${costRow + 1}*K${costRow})`,
      { op: "multiply", args: [{ value: maintenance }, { input: "contractMonths" }] }
    ),
    rule(
      "cost.equipmentPerDetermination", aggregateIdentity(configuration, "EQUIPO"), `M${costRow + 2}`,
      config.factorUsesOnlyMaintenance
        ? `=((((L${costRow + 1})*(K${costRow}))/F${startRow}))`
        : `=((((L${costRow + 1})*(K${costRow}))/'BIOMETRIA HEMATICA'!B2))`,
      {
        op: "divide",
        args: [
          { op: "multiply", args: [{ value: maintenance }, { input: "contractMonths" }] },
          { input: "annualDemand" },
        ],
      }
    ),
    rule(
      "allocation.additionalAndMaintenance", aggregateIdentity(configuration, "ADICIONALES Y MANTENIMIENTO"),
      `L${costRow + 3}`,
      config.factorUsesOnlyMaintenance
        ? `=SUM(M${costRow}:N${costRow + 1})`
        : `=SUM(M${costRow}:M${costRow + 1})`,
      { op: "add", args: [{ ref: "cost.additional" }, { ref: "cost.maintenance" }] }
    ),
    rule(
      "allocation.baseProducts", aggregateIdentity(configuration, "PRODUCTOS BASE"), `L${costRow + 4}`,
      `=SUM(M${startRow}:M${startRow + 9})`,
      { op: "add", args: BASE_ITEMS.map((item) => ({ ref: `${item.key}.baseTotal` })) }
    ),
    rule(
      "allocation.factor", aggregateIdentity(configuration, "FACTOR TODO COMPRADO"), `L${costRow + 5}`,
      config.factorUsesOnlyMaintenance
        ? `=(L${costRow + 1}/L${costRow + 4})*K${costRow}`
        : `=(L${costRow + 3}/L${costRow + 4})*K${costRow}`,
      {
        op: "multiply",
        args: [
          {
            op: "divide",
            args: [
              config.factorUsesOnlyMaintenance
                ? { value: maintenance }
                : { ref: "allocation.additionalAndMaintenance" },
              { ref: "allocation.baseProducts" },
            ],
          },
          { input: "contractMonths" },
        ],
      }
    )
  );

  BASE_ITEMS.forEach((item, offset) => {
    const row = startRow + offset;
    const identity = itemIdentity(configuration, item);
    rules.push(
      rule(
        `${item.key}.allPurchasedPvp`, identity, `O${row}`, `=(L${row}*$L$${costRow + 5})+L${row}`,
        {
          op: "add",
          args: [
            { op: "multiply", args: [{ value: item.pvp }, { ref: "allocation.factor" }] },
            { value: item.pvp },
          ],
        }
      ),
      rule(
        `${item.key}.allPurchasedTotal`, identity, `P${row}`, `=O${row}*K${row}`,
        {
          op: "multiply",
          args: [{ ref: `${item.key}.allPurchasedPvp` }, { ref: `${item.key}.roundedDeliverable` }],
        }
      )
    );
  });

  rules.push(
    rule(
      "process.completeUnitValue", aggregateIdentity(configuration, "PVP BIOMETRIA COMPLETA"), `Q${startRow}`,
      config.factorUsesOnlyMaintenance
        ? `=(SUM(P${startRow}:P${startRow + 9})/F${startRow})+M${costRow + 2}`
        : `=(SUM(P${startRow}:P${startRow + 9})/'BIOMETRIA HEMATICA'!B2)+M${costRow + 2}`,
      {
        op: "add",
        args: [
          {
            op: "divide",
            args: [
              { op: "add", args: BASE_ITEMS.map((item) => ({ ref: `${item.key}.allPurchasedTotal` })) },
              { input: "annualDemand" },
            ],
          },
          { ref: "cost.equipmentPerDetermination" },
        ],
      }
    ),
    rule(
      "process.basicUnitValue", aggregateIdentity(configuration, "PVP BIOMETRIA"), `Q${startRow + 2}`,
      `=(SUM(P${startRow}:P${startRow + 6})/'BIOMETRIA HEMATICA'!B2)+M${costRow + 2}`,
      {
        op: "add",
        args: [
          {
            op: "divide",
            args: [
              { op: "add", args: BASE_ITEMS.slice(0, 7).map((item) => ({ ref: `${item.key}.allPurchasedTotal` })) },
              { input: "annualDemand" },
            ],
          },
          { ref: "cost.equipmentPerDetermination" },
        ],
      }
    )
  );

  return Object.freeze({
    packageId: `hematologia-${configuration.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-todo-comprado`,
    version: "2024-12-06.1",
    sourceWorkbook: {
      fileName: "TABLA MATRIZ COSTOS PARA COMERCIAL 2024-12-06 HEMATOLOGIA.xlsx",
      sha256: SOURCE_SHA256,
    },
    scope: { family: "hematologia", equipment: configuration, modality: "todo_comprado" },
    inputs: INPUTS,
    rules,
  });
}

module.exports = Object.freeze([
  ...CONFIGURATIONS.map(buildPackage),
  buildXn1000NoLicensePackage(),
]);
