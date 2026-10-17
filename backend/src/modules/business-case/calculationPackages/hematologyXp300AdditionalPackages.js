const SOURCE_SHA256 = "1b8ff28f1b2917e79682c94f12d925490e8fe0b2f5e500b923b284065b76d338";

const ITEMS = Object.freeze([
  { key: "cellpack20l", row: 3, productId: "3145611001", productName: "CELLPACK 20L", testsPerKit: 450, stabilityDays: 60, pvp: 253 },
  { key: "stromaWhKx21", row: 4, productId: "12216540001", productName: "STROMA WH KX21 x 500ML", testsPerKit: 450, stabilityDays: 60, pvp: 264 },
  { key: "eightCheck3wp", row: 5, productId: "3134466001", productName: "EIGHT CHECK-3WP XTRA ( 4 X 2 ML)", stabilityDays: 85, pvp: 269, dynamicTestsPerKit: true },
  { key: "printerPaper", row: 6, productId: "3113353180", productName: "PAPER ROLL F.PRINTER STP211-144 (10PCS.)", testsPerKit: 900, stabilityDays: 365, pvp: 80 },
]);

const INPUTS = Object.freeze({
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
});

function itemIdentity(item) {
  return {
    kind: "item",
    configuration: "XP-300",
    section: "reactivo_consumible",
    productId: item.productId,
    productName: item.productName,
    occurrence: 1,
  };
}

function aggregateIdentity(name) {
  return { kind: "aggregate", name };
}

function source(sheet, cell, formula) {
  return { sheet, cell, formula };
}

function rule(id, identity, sheet, cell, formula, expression) {
  return { id, identity, source: source(sheet, cell, formula), expression };
}

function commonItemRules(sheet, processDemandId, roundingOperation) {
  const rules = [];
  for (const item of ITEMS) {
    const identity = itemIdentity(item);
    const prefix = item.key;
    const testsPerKitId = `${prefix}.testsPerKit`;

    rules.push(rule(
      testsPerKitId,
      identity,
      sheet,
      `D${item.row}`,
      item.dynamicTestsPerKit ? "=(((F3/30)/12)*E5)" : String(item.testsPerKit),
      item.dynamicTestsPerKit
        ? {
          op: "multiply",
          args: [
            {
              op: "divide",
              args: [
                { op: "divide", args: [{ ref: processDemandId }, { value: 30 }] },
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
        `${prefix}.calculatedQuantity`, identity, sheet, `G${item.row}`,
        `=F${item.row}/D${item.row}`,
        { op: "divide", args: [{ ref: processDemandId }, { ref: testsPerKitId }] }
      ),
      rule(
        `${prefix}.stabilityMinimum`, identity, sheet, `H${item.row}`,
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
        `${prefix}.deliverableQuantity`, identity, sheet, `I${item.row}`,
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
        `${prefix}.roundedDeliverable`, identity, sheet, `J${item.row}`,
        `=${roundingOperation === "round_up" ? "ROUNDUP" : "ROUNDDOWN"}(I${item.row},0)`,
        { op: roundingOperation, args: [{ ref: `${prefix}.deliverableQuantity` }, { value: 0 }] }
      ),
      rule(
        `${prefix}.baseTotal`, identity, sheet, `L${item.row}`,
        `=K${item.row}*J${item.row}`,
        { op: "multiply", args: [{ value: item.pvp }, { ref: `${prefix}.roundedDeliverable` }] }
      )
    );
  }
  return rules;
}

function commonCostRules(sheet) {
  return [
    rule(
      "additionalInvestments.total", aggregateIdentity("ADICIONALES"), sheet, "L8", "=(K8/J8)*J8",
      {
        op: "multiply",
        args: [
          { op: "divide", args: [{ input: "additionalInvestmentsSubtotal" }, { input: "contractMonths" }] },
          { input: "contractMonths" },
        ],
      }
    ),
    rule(
      "rentalOrSpareParts.total", aggregateIdentity("ALQUILER/REPUESTOS"), sheet, "L9", "=(K9*J8)/(12)",
      {
        op: "divide",
        args: [
          { op: "multiply", args: [{ value: 210 }, { input: "contractMonths" }] },
          { value: 12 },
        ],
      }
    ),
    rule(
      "equipment.costPerDetermination", aggregateIdentity("EQUIPO"), sheet, "L10",
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
  ];
}

function buildEffectivePackage() {
  const sheet = "PRUEBA EFECTIVA XP-300";
  const processDemandId = "process.effectiveAnnualDemand";
  const rules = [
    rule(
      processDemandId, aggregateIdentity("DET/AÑO PROCESO"), sheet, "F3",
      "=('BIOMETRIA HEMATICA'!$B$2*0.2)+'BIOMETRIA HEMATICA'!$B$2",
      {
        op: "add",
        args: [
          { op: "multiply", args: [{ input: "annualDemand" }, { value: "0.2" }] },
          { input: "annualDemand" },
        ],
      }
    ),
    ...commonItemRules(sheet, processDemandId, "round_up"),
    ...commonCostRules(sheet),
  ];
  const itemTotals = ITEMS.map((item) => ({ ref: `${item.key}.baseTotal` }));

  rules.push(
    rule(
      "process.baseUnitValue", aggregateIdentity("PVP BIOMETRIA"), sheet, "M3",
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
      "process.valueWithMargin", aggregateIdentity("PARA PROCESO"), sheet, "N3",
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
      "process.initialValue", aggregateIdentity("VALOR INICIAL DEL PROCESO"), sheet, "O3",
      "=N3*'BIOMETRIA HEMATICA'!B2",
      { op: "multiply", args: [{ ref: "process.valueWithMargin" }, { input: "annualDemand" }] }
    ),
    rule(
      "process.finalValue", aggregateIdentity("VALOR FINAL DEL PROCESO"), sheet, "P3",
      "=M3*'BIOMETRIA HEMATICA'!B2",
      { op: "multiply", args: [{ ref: "process.baseUnitValue" }, { input: "annualDemand" }] }
    )
  );

  return {
    packageId: "hematologia-xp300-prueba-efectiva",
    version: "2024-12-06.1",
    sourceWorkbook: {
      fileName: "TABLA MATRIZ COSTOS PARA COMERCIAL 2024-12-06 HEMATOLOGIA.xlsx",
      sha256: SOURCE_SHA256,
    },
    scope: { family: "hematologia", equipment: "XP-300", modality: "prueba_efectiva" },
    inputs: INPUTS,
    rules,
  };
}

function buildAllPurchasedPackage() {
  const sheet = "COMODATO TODO COMPRADO XP-300";
  const processDemandId = "process.annualDemand";
  const rules = [
    rule(
      processDemandId, aggregateIdentity("DET/AÑO PROCESO"), sheet, "F3",
      "='BIOMETRIA HEMATICA'!$B$2", { input: "annualDemand" }
    ),
    ...commonItemRules(sheet, processDemandId, "round_down"),
    ...commonCostRules(sheet),
  ];
  const baseTotals = ITEMS.map((item) => ({ ref: `${item.key}.baseTotal` }));

  rules.push(
    rule(
      "allocation.additionalAndSpareParts", aggregateIdentity("SUMA ADICIONALES Y REPUESTOS"),
      sheet, "L11", "=SUM(L8:L9)",
      { op: "add", args: [{ ref: "additionalInvestments.total" }, { ref: "rentalOrSpareParts.total" }] }
    ),
    rule(
      "allocation.baseProducts", aggregateIdentity("SUMA PRODUCTOS"), sheet, "L12", "=SUM(L3:L6)",
      { op: "add", args: baseTotals }
    ),
    rule(
      "allocation.factor", aggregateIdentity("FACTOR TODO COMPRADO"), sheet, "L13", "=L11/L12",
      { op: "divide", args: [{ ref: "allocation.additionalAndSpareParts" }, { ref: "allocation.baseProducts" }] }
    ),
    rule(
      "allocation.sheetTotal", aggregateIdentity("TOTAL COLUMNA L"), sheet, "L14", "=SUM(L3:L10)",
      {
        op: "add",
        args: [
          ...baseTotals,
          { ref: "additionalInvestments.total" },
          { ref: "rentalOrSpareParts.total" },
          { ref: "equipment.costPerDetermination" },
        ],
      }
    )
  );

  for (const item of ITEMS) {
    const identity = itemIdentity(item);
    rules.push(
      rule(
        `${item.key}.allPurchasedPvp`, identity, sheet, `M${item.row}`,
        `=(K${item.row}*$L$13)+K${item.row}`,
        {
          op: "add",
          args: [
            { op: "multiply", args: [{ value: item.pvp }, { ref: "allocation.factor" }] },
            { value: item.pvp },
          ],
        }
      ),
      rule(
        `${item.key}.allPurchasedTotal`, identity, sheet, `N${item.row}`,
        `=M${item.row}*J${item.row}`,
        {
          op: "multiply",
          args: [{ ref: `${item.key}.allPurchasedPvp` }, { ref: `${item.key}.roundedDeliverable` }],
        }
      )
    );
  }

  rules.push(rule(
    "process.allPurchasedUnitValue", aggregateIdentity("PVP BIOMETRIA"), sheet, "O3",
    "=(SUM(N3:N6)/'BIOMETRIA HEMATICA'!B2)+L10",
    {
      op: "add",
      args: [
        {
          op: "divide",
          args: [
            { op: "add", args: ITEMS.map((item) => ({ ref: `${item.key}.allPurchasedTotal` })) },
            { input: "annualDemand" },
          ],
        },
        { ref: "equipment.costPerDetermination" },
      ],
    }
  ));

  return {
    packageId: "hematologia-xp300-todo-comprado",
    version: "2024-12-06.1",
    sourceWorkbook: {
      fileName: "TABLA MATRIZ COSTOS PARA COMERCIAL 2024-12-06 HEMATOLOGIA.xlsx",
      sha256: SOURCE_SHA256,
    },
    scope: { family: "hematologia", equipment: "XP-300", modality: "todo_comprado" },
    inputs: INPUTS,
    rules,
  };
}

module.exports = Object.freeze({
  effective: Object.freeze(buildEffectivePackage()),
  allPurchased: Object.freeze(buildAllPurchasedPackage()),
});
