const SOURCE_SHA256 = "1b8ff28f1b2917e79682c94f12d925490e8fe0b2f5e500b923b284065b76d338";

function itemIdentity(productId, productName) {
  return {
    kind: "item",
    configuration: "XP-300",
    section: "reactivo_consumible",
    productId,
    productName,
    occurrence: 1,
  };
}

function aggregateIdentity(name) {
  return { kind: "aggregate", name };
}

function source(cell, formula) {
  return { sheet: "DETERMINACION XP-300", cell, formula };
}

function rule(id, identity, cell, formula, expression) {
  return { id, identity, source: source(cell, formula), expression };
}

const items = [
  {
    key: "cellpack20l",
    row: 3,
    productId: "3145611001",
    productName: "CELLPACK 20L",
    testsPerKit: 450,
    stabilityDays: 60,
    pvp: 253,
  },
  {
    key: "stromaWhKx21",
    row: 4,
    productId: "12216540001",
    productName: "STROMA WH KX21 x 500ML",
    testsPerKit: 450,
    stabilityDays: 60,
    pvp: 264,
  },
  {
    key: "eightCheck3wp",
    row: 5,
    productId: "3134466001",
    productName: "EIGHT CHECK-3WP XTRA ( 4 X 2 ML)",
    stabilityDays: 85,
    pvp: 269,
    dynamicTestsPerKit: true,
  },
  {
    key: "printerPaper",
    row: 6,
    productId: "3113353180",
    productName: "PAPER ROLL F.PRINTER STP211-144 (10PCS.)",
    testsPerKit: 900,
    stabilityDays: 365,
    pvp: 80,
  },
];

const rules = [];

for (const item of items) {
  const identity = itemIdentity(item.productId, item.productName);
  const prefix = item.key;
  const testsPerKitId = `${prefix}.testsPerKit`;

  if (item.dynamicTestsPerKit) {
    rules.push(rule(
      testsPerKitId,
      identity,
      `D${item.row}`,
      "=(((F3/30)/12)*E5)",
      {
        op: "multiply",
        args: [
          {
            op: "divide",
            args: [
              { op: "divide", args: [{ input: "annualDemand" }, { value: 30 }] },
              { value: 12 },
            ],
          },
          { value: item.stabilityDays },
        ],
      }
    ));
  } else {
    rules.push(rule(
      testsPerKitId,
      identity,
      `D${item.row}`,
      String(item.testsPerKit),
      { value: item.testsPerKit }
    ));
  }

  rules.push(
    rule(
      `${prefix}.calculatedQuantity`,
      identity,
      `G${item.row}`,
      `=F${item.row}/D${item.row}`,
      { op: "divide", args: [{ input: "annualDemand" }, { ref: testsPerKitId }] }
    ),
    rule(
      `${prefix}.stabilityMinimum`,
      identity,
      `H${item.row}`,
      `=(360/E${item.row})*'BIOMETRIA HEMATICA'!$B$10`,
      {
        op: "multiply",
        args: [
          { op: "divide", args: [{ value: 360 }, { value: item.stabilityDays }] },
          { input: "equipmentCount" },
        ],
      }
    ),
    rule(
      `${prefix}.deliverableQuantity`,
      identity,
      `I${item.row}`,
      `=IF(G${item.row}>H${item.row},G${item.row},H${item.row})`,
      {
        op: "if",
        args: [
          {
            op: "gt",
            args: [{ ref: `${prefix}.calculatedQuantity` }, { ref: `${prefix}.stabilityMinimum` }],
          },
          { ref: `${prefix}.calculatedQuantity` },
          { ref: `${prefix}.stabilityMinimum` },
        ],
      }
    ),
    rule(
      `${prefix}.roundedDeliverable`,
      identity,
      `J${item.row}`,
      `=ROUNDUP(I${item.row},0)`,
      { op: "round_up", args: [{ ref: `${prefix}.deliverableQuantity` }, { value: 0 }] }
    ),
    rule(
      `${prefix}.total`,
      identity,
      `L${item.row}`,
      `=K${item.row}*J${item.row}`,
      {
        op: "multiply",
        args: [{ value: item.pvp }, { ref: `${prefix}.roundedDeliverable` }],
      }
    )
  );
}

const itemTotals = items.map((item) => ({ ref: `${item.key}.total` }));

rules.push(
  rule(
    "additionalInvestments.total",
    aggregateIdentity("ADICIONALES"),
    "L8",
    "=(K8/J8)*J8",
    {
      op: "multiply",
      args: [
        { op: "divide", args: [{ input: "additionalInvestmentsSubtotal" }, { input: "contractMonths" }] },
        { input: "contractMonths" },
      ],
    }
  ),
  rule(
    "rental.total",
    aggregateIdentity("ALQUILER"),
    "L9",
    "=(K9*J8)/(12)",
    {
      op: "divide",
      args: [
        { op: "multiply", args: [{ value: 210 }, { input: "contractMonths" }] },
        { value: 12 },
      ],
    }
  ),
  rule(
    "equipment.costPerDetermination",
    aggregateIdentity("EQUIPO"),
    "L10",
    "=((((K10)/(J8)*12))/'BIOMETRIA HEMATICA'!B2)*(J8/12)",
    {
      op: "multiply",
      args: [
        {
          op: "divide",
          args: [
            {
              op: "multiply",
              args: [
                { op: "divide", args: [{ value: 8338 }, { input: "contractMonths" }] },
                { value: 12 },
              ],
            },
            { input: "annualDemand" },
          ],
        },
        { op: "divide", args: [{ input: "contractMonths" }, { value: 12 }] },
      ],
    }
  ),
  rule(
    "process.baseUnitValue",
    aggregateIdentity("PVP BIOMETRIA"),
    "M3",
    "=(SUM(L3:L8)/'BIOMETRIA HEMATICA'!B2)+L10",
    {
      op: "add",
      args: [
        {
          op: "divide",
          args: [
            { op: "add", args: [...itemTotals, { ref: "additionalInvestments.total" }] },
            { input: "annualDemand" },
          ],
        },
        { ref: "equipment.costPerDetermination" },
      ],
    }
  ),
  rule(
    "process.valueWithMargin",
    aggregateIdentity("PARA PROCESO"),
    "N3",
    "=((M3*0.15)+M3)",
    {
      op: "add",
      args: [
        { op: "multiply", args: [{ ref: "process.baseUnitValue" }, { value: "0.15" }] },
        { ref: "process.baseUnitValue" },
      ],
    }
  ),
  rule(
    "process.initialValue",
    aggregateIdentity("VALOR INICIAL DEL PROCESO"),
    "O3",
    "=N3*'BIOMETRIA HEMATICA'!B2",
    { op: "multiply", args: [{ ref: "process.valueWithMargin" }, { input: "annualDemand" }] }
  ),
  rule(
    "process.finalValue",
    aggregateIdentity("VALOR FINAL DEL PROCESO"),
    "P3",
    "=M3*'BIOMETRIA HEMATICA'!B2",
    { op: "multiply", args: [{ ref: "process.baseUnitValue" }, { input: "annualDemand" }] }
  )
);

module.exports = Object.freeze({
  packageId: "hematologia-xp300-determinacion",
  version: "2024-12-06.1",
  sourceWorkbook: {
    fileName: "TABLA MATRIZ COSTOS PARA COMERCIAL 2024-12-06 HEMATOLOGIA.xlsx",
    sha256: SOURCE_SHA256,
  },
  scope: {
    family: "hematologia",
    equipment: "XP-300",
    modality: "determinacion",
  },
  inputs: {
    annualDemand: {
      type: "number",
      source: { sheet: "BIOMETRIA HEMATICA", cell: "B2", label: "DET/AÑO PROCESO" },
    },
    contractMonths: {
      type: "number",
      source: { sheet: "BIOMETRIA HEMATICA", cell: "B6", label: "TIEMPO CONTRATO EN MESES" },
    },
    equipmentCount: {
      type: "number",
      source: { sheet: "BIOMETRIA HEMATICA", cell: "B10", label: "NUMERO DE EQUIPOS" },
    },
    additionalInvestmentsSubtotal: {
      type: "number",
      source: { sheet: "BC", cell: "F109", label: "Sub total" },
    },
  },
  rules,
});
