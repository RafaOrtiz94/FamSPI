const SOURCE_SHA256 = "1b8ff28f1b2917e79682c94f12d925490e8fe0b2f5e500b923b284065b76d338";
const CONFIGURATION = "XNL-350 SIN LICENCIAS";

const ITEMS = Object.freeze([
  { key: "cellpackDcl", row: 3, productId: "6510167001", productName: "CELLPACK DCL", testsPerKit: 450, stabilityDays: 60, pvp: 121, demand: "basic", determinationRounded: true },
  { key: "sulfolyser5l", row: 4, productId: "3337006001", productName: "SULFOLYSER REAGENT X 5L", testsPerKit: 9450, stabilityDays: 60, pvp: 1107, demand: "basic", determinationRounded: false, alternative: true },
  { key: "sulfolyser500ml", row: 5, productId: "12215616001", productName: "SULFOLYSER REAGENT 500 ml", testsPerKit: 850, stabilityDays: 60, pvp: "228.33", demand: "basic", determinationRounded: true, alternative: true },
  { key: "wdfLysercell", row: 6, productId: "7837984001", productName: "WDF Lysercell WDF", testsPerKit: 2450, stabilityDays: 90, pvp: 176, demand: "basic", determinationRounded: true },
  { key: "wdfFluorocell", row: 7, productId: "6510256001", productName: "WDF Fluorocell WDF 2X42 ML", testsPerKit: 3400, stabilityDays: 180, pvp: 862, demand: "basic", determinationRounded: true },
  { key: "cellcleanAuto", row: 8, productId: "6952291001", productName: "CELLCLEAN AUTO 4 ML X 20", stabilityDays: 150, pvp: 52, demand: "basic", dynamicTestsPerKit: true, determinationRounded: true },
  { key: "xnCheck", row: 9, productId: "7051506001", productName: "XN Check 12x3.0ml Level 1,2,3", stabilityDays: 56, pvp: 544, demand: "basic", dynamicTestsPerKit: true, determinationRounded: false },
  { key: "fluorocellRet", row: 10, productId: "6510272001", productName: "FLUOROCELL RET 2 X 12ML", testsPerKit: 650, stabilityDays: 180, pvp: 1705, demand: "reticulocytes", determinationRounded: false },
  { key: "cellpackDfl", row: 11, productId: "9426752001", productName: "CELLPACK DFL 1 L", testsPerKit: 450, stabilityDays: 60, pvp: 34, demand: "reticulocytes", determinationRounded: false },
  { key: "xnCheckBf", row: 12, productId: "7051409001", productName: "XN-Check BF 6x3.0ml Level 1,2", stabilityDays: 56, pvp: 661, demand: "fluids", dynamicTestsPerKit: true, determinationRounded: false },
]);

const INPUTS = Object.freeze({
  annualDemand: { type: "number", source: { sheet: "BIOMETRIA HEMATICA", cell: "B2", label: "BIOMETRIA HEMATICA" } },
  reticulocyteDemand: { type: "number", source: { sheet: "BIOMETRIA HEMATICA", cell: "D2", label: "RETICULOCITOS" } },
  fluidDemand: { type: "number", source: { sheet: "BIOMETRIA HEMATICA", cell: "H2", label: "FLUIDOS CORPORALES" } },
  contractMonths: { type: "number", source: { sheet: "BIOMETRIA HEMATICA", cell: "B6", label: "TIEMPO CONTRATO EN MESES" } },
  equipmentCount: { type: "number", source: { sheet: "BIOMETRIA HEMATICA", cell: "B10", label: "NUMERO DE EQUIPOS" } },
  additionalInvestmentsSubtotal: { type: "number", source: { sheet: "BC", cell: "F109", label: "Sub total" } },
});

function itemIdentity(item) {
  return {
    kind: "item",
    configuration: CONFIGURATION,
    section: "reactivo_consumible",
    productId: item.productId,
    productName: item.productName,
    occurrence: 1,
  };
}

function aggregateIdentity(name) {
  return { kind: "aggregate", name: `${CONFIGURATION}: ${name}` };
}

function rule(id, identity, sheet, cell, formula, expression) {
  return { id, identity, source: { sheet, cell, formula }, expression };
}

function demandExpression(input, effective) {
  if (!effective) return { input };
  return {
    op: "add",
    args: [
      { op: "multiply", args: [{ input }, { value: "0.2" }] },
      { input },
    ],
  };
}

function buildDemandRules(sheet, effective, allPurchased = false) {
  return [
    rule(
      "demand.basic", aggregateIdentity("BIOMETRIA HEMATICA"), sheet, "F3",
      effective
        ? "=(('BIOMETRIA HEMATICA'!$B$2)*0.2)+('BIOMETRIA HEMATICA'!$B$2)"
        : allPurchased ? "=(('BIOMETRIA HEMATICA'!$B$2))" : "='BIOMETRIA HEMATICA'!$B$2",
      demandExpression("annualDemand", effective)
    ),
    rule(
      "demand.reticulocytes", aggregateIdentity("RETICULOCITOS"), sheet, "F10",
      effective
        ? "=(('BIOMETRIA HEMATICA'!$D$2)*0.2)+('BIOMETRIA HEMATICA'!$D$2)"
        : allPurchased ? "=(('BIOMETRIA HEMATICA'!$D$2))" : "='BIOMETRIA HEMATICA'!$D$2",
      demandExpression("reticulocyteDemand", effective)
    ),
    rule(
      "demand.fluids", aggregateIdentity("FLUIDOS CORPORALES"), sheet, "F12",
      effective
        ? "=(('BIOMETRIA HEMATICA'!$H$2)*0.2)+('BIOMETRIA HEMATICA'!$H$2)"
        : allPurchased ? "=(('BIOMETRIA HEMATICA'!$H$2))" : "='BIOMETRIA HEMATICA'!$H$2",
      demandExpression("fluidDemand", effective)
    ),
  ];
}

function buildItemRules(sheet, modality) {
  const rules = [];
  for (const item of ITEMS) {
    const prefix = item.key;
    const identity = itemIdentity(item);
    const demandRef = `demand.${item.demand}`;
    const testsPerKitId = `${prefix}.testsPerKit`;

    rules.push(rule(
      testsPerKitId, identity, sheet, `D${item.row}`,
      item.dynamicTestsPerKit ? `=(((F3/30)/12)*E${item.row})` : String(item.testsPerKit),
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
        `${prefix}.calculatedQuantity`, identity, sheet, `G${item.row}`,
        `=F${item.row}/D${item.row}`,
        { op: "divide", args: [{ ref: demandRef }, { ref: testsPerKitId }] }
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
      )
    );

    const hasRounding = modality !== "determination" || item.determinationRounded;
    if (hasRounding) {
      const operation = modality === "allPurchased" ? "round_down" : "round_up";
      rules.push(rule(
        `${prefix}.roundedDeliverable`, identity, sheet, `K${item.row}`,
        `=${operation === "round_up" ? "ROUNDUP" : "ROUNDDOWN"}(I${item.row},0)`,
        { op: operation, args: [{ ref: `${prefix}.deliverableQuantity` }, { value: 0 }] }
      ));
    }

    rules.push(rule(
      `${prefix}.baseTotal`, identity, sheet, `M${item.row}`, `=L${item.row}*K${item.row}`,
      hasRounding
        ? { op: "multiply", args: [{ value: item.pvp }, { ref: `${prefix}.roundedDeliverable` }] }
        : { value: 0 }
    ));

    if (item.alternative) {
      rules.push(rule(
        `${prefix}.alternativeTotal`, identity, sheet, `N${item.row}`, `=L${item.row}*K${item.row}`,
        hasRounding
          ? { op: "multiply", args: [{ value: item.pvp }, { ref: `${prefix}.roundedDeliverable` }] }
          : { value: 0 }
      ));
    }
  }
  return rules;
}

function buildCommonCostRules(sheet, allPurchased) {
  return [
    rule(
      "cost.additional", aggregateIdentity("ADICIONALES"), sheet, "M14", "=(L14/K14)*K14",
      {
        op: "multiply",
        args: [
          { op: "divide", args: [{ input: "additionalInvestmentsSubtotal" }, { input: "contractMonths" }] },
          { input: "contractMonths" },
        ],
      }
    ),
    rule(
      "cost.maintenance", aggregateIdentity("MANTENIMIENTO/REPUESTOS"), sheet, "M15",
      allPurchased ? "=(L15*K14)" : "=(L15*K14)/(12)",
      allPurchased
        ? { op: "multiply", args: [{ value: 470 }, { input: "contractMonths" }] }
        : {
          op: "divide",
          args: [{ op: "multiply", args: [{ value: 470 }, { input: "contractMonths" }] }, { value: 12 }],
        }
    ),
    rule(
      "cost.equipmentPerDetermination", aggregateIdentity("EQUIPO"), sheet, "M16",
      "=((((L15)*(K14))/'BIOMETRIA HEMATICA'!B2))",
      {
        op: "divide",
        args: [
          { op: "multiply", args: [{ value: 470 }, { input: "contractMonths" }] },
          { input: "annualDemand" },
        ],
      }
    ),
  ];
}

function sumItemTotals(rows) {
  const selected = ITEMS.filter((item) => rows.includes(item.row));
  const refs = selected.map((item) => ({ ref: `${item.key}.baseTotal` }));
  for (const item of selected.filter((candidate) => candidate.alternative)) {
    refs.push({ ref: `${item.key}.alternativeTotal` });
  }
  return refs;
}

function buildDeterminationOrEffectivePackage(modality) {
  const effective = modality === "effective";
  const sheet = effective ? "PRUEBA EFECTIVA XN" : "DETERMINACION XN";
  const rules = [
    ...buildDemandRules(sheet, effective),
    ...buildItemRules(sheet, effective ? "effective" : "determination"),
    ...buildCommonCostRules(sheet, false),
  ];

  const fullArgs = sumItemTotals(ITEMS.map((item) => item.row));
  if (!effective) fullArgs.push({ ref: "cost.additional" });
  const basicArgs = sumItemTotals([3, 4, 5, 6, 7, 8, 9]);

  rules.push(
    rule(
      "process.completeUnitValue", aggregateIdentity("PVP BIOMETRIA COMPLETA"), sheet, "O3",
      effective
        ? "=(SUM(M3:N12)/'BIOMETRIA HEMATICA'!B2)+M16"
        : "=(SUM(M3:N12)/F3)+M16+(BC!F109/'DETERMINACION XN'!F3)",
      {
        op: "add",
        args: [
          { op: "divide", args: [{ op: "add", args: fullArgs }, { input: "annualDemand" }] },
          { ref: "cost.equipmentPerDetermination" },
        ],
      }
    ),
    rule(
      "process.basicUnitValue", aggregateIdentity("PVP BIOMETRIA"), sheet, "O5",
      "=(SUM(M3:N9)/'BIOMETRIA HEMATICA'!B2)+M16",
      {
        op: "add",
        args: [
          { op: "divide", args: [{ op: "add", args: basicArgs }, { input: "annualDemand" }] },
          { ref: "cost.equipmentPerDetermination" },
        ],
      }
    )
  );

  for (const variant of ["complete", "basic"]) {
    const row = variant === "complete" ? 3 : 5;
    rules.push(
      rule(
        `process.${variant}WithMargin`, aggregateIdentity(`${variant} PARA PROCESO`), sheet, `P${row}`,
        `=((O${row}*0.15)+O${row})`,
        {
          op: "add",
          args: [
            { op: "multiply", args: [{ ref: `process.${variant}UnitValue` }, { value: "0.15" }] },
            { ref: `process.${variant}UnitValue` },
          ],
        }
      ),
      rule(
        `process.${variant}InitialValue`, aggregateIdentity(`${variant} VALOR INICIAL`), sheet, `Q${row}`,
        `=P${row}*'BIOMETRIA HEMATICA'!B2`,
        { op: "multiply", args: [{ ref: `process.${variant}WithMargin` }, { input: "annualDemand" }] }
      ),
      rule(
        `process.${variant}FinalValue`, aggregateIdentity(`${variant} VALOR FINAL`), sheet, `R${row}`,
        `=O${row}*'BIOMETRIA HEMATICA'!B2`,
        { op: "multiply", args: [{ ref: `process.${variant}UnitValue` }, { input: "annualDemand" }] }
      )
    );
  }

  return {
    packageId: `hematologia-xnl350-sin-licencias-${effective ? "prueba-efectiva" : "determinacion"}`,
    version: "2024-12-06.1",
    sourceWorkbook: {
      fileName: "TABLA MATRIZ COSTOS PARA COMERCIAL 2024-12-06 HEMATOLOGIA.xlsx",
      sha256: SOURCE_SHA256,
    },
    scope: {
      family: "hematologia",
      equipment: CONFIGURATION,
      modality: effective ? "prueba_efectiva" : "determinacion",
    },
    inputs: INPUTS,
    rules,
  };
}

function buildAllPurchasedPackage() {
  const sheet = "COMODATO TODO COMPRADO XN";
  const rules = [
    ...buildDemandRules(sheet, false, true),
    ...buildItemRules(sheet, "allPurchased"),
    ...buildCommonCostRules(sheet, true),
  ];
  const baseRefs = ITEMS.map((item) => ({ ref: `${item.key}.baseTotal` }));

  rules.push(
    rule(
      "allocation.additionalAndMaintenance", aggregateIdentity("ADICIONALES Y MANTENIMIENTO"),
      sheet, "L17", "=SUM(M14:M15)",
      { op: "add", args: [{ ref: "cost.additional" }, { ref: "cost.maintenance" }] }
    ),
    rule(
      "allocation.baseProducts", aggregateIdentity("PRODUCTOS BASE"), sheet, "L18", "=SUM(M3:M12)",
      { op: "add", args: baseRefs }
    ),
    rule(
      "allocation.factor", aggregateIdentity("FACTOR TODO COMPRADO"), sheet, "L19", "=(L17/L18)*K14",
      {
        op: "multiply",
        args: [
          { op: "divide", args: [{ ref: "allocation.additionalAndMaintenance" }, { ref: "allocation.baseProducts" }] },
          { input: "contractMonths" },
        ],
      }
    )
  );

  for (const item of ITEMS) {
    const identity = itemIdentity(item);
    rules.push(
      rule(
        `${item.key}.allPurchasedPvp`, identity, sheet, `O${item.row}`,
        `=(L${item.row}*$L$19)+L${item.row}`,
        {
          op: "add",
          args: [
            { op: "multiply", args: [{ value: item.pvp }, { ref: "allocation.factor" }] },
            { value: item.pvp },
          ],
        }
      ),
      rule(
        `${item.key}.allPurchasedTotal`, identity, sheet, `P${item.row}`,
        `=O${item.row}*K${item.row}`,
        {
          op: "multiply",
          args: [{ ref: `${item.key}.allPurchasedPvp` }, { ref: `${item.key}.roundedDeliverable` }],
        }
      )
    );
  }

  rules.push(
    rule(
      "process.completeUnitValue", aggregateIdentity("PVP BIOMETRIA COMPLETA"), sheet, "Q3",
      "=(SUM(P3:P12)/'BIOMETRIA HEMATICA'!B2)+M16",
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
          { ref: "cost.equipmentPerDetermination" },
        ],
      }
    ),
    rule(
      "process.basicUnitValue", aggregateIdentity("PVP BIOMETRIA"), sheet, "Q5",
      "=(SUM(P3:P9)/'BIOMETRIA HEMATICA'!B2)+M16",
      {
        op: "add",
        args: [
          {
            op: "divide",
            args: [
              {
                op: "add",
                args: ITEMS.filter((item) => item.row <= 9).map((item) => ({ ref: `${item.key}.allPurchasedTotal` })),
              },
              { input: "annualDemand" },
            ],
          },
          { ref: "cost.equipmentPerDetermination" },
        ],
      }
    )
  );

  return {
    packageId: "hematologia-xnl350-sin-licencias-todo-comprado",
    version: "2024-12-06.1",
    sourceWorkbook: {
      fileName: "TABLA MATRIZ COSTOS PARA COMERCIAL 2024-12-06 HEMATOLOGIA.xlsx",
      sha256: SOURCE_SHA256,
    },
    scope: { family: "hematologia", equipment: CONFIGURATION, modality: "todo_comprado" },
    inputs: INPUTS,
    rules,
  };
}

module.exports = Object.freeze({
  determination: Object.freeze(buildDeterminationOrEffectivePackage("determination")),
  effective: Object.freeze(buildDeterminationOrEffectivePackage("effective")),
  allPurchased: Object.freeze(buildAllPurchasedPackage()),
});
