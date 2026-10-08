const xnl350NoLicensePackages = require("./hematologyXnl350NoLicensePackages");

const CONFIGURATION = "XNL-350 CON LICENCIAS";
const SOURCE_PACKAGE = xnl350NoLicensePackages.effective;
const ROW_OFFSET = 19;
const ITEM_KEYS = Object.freeze([
  "cellpackDcl",
  "sulfolyser5l",
  "sulfolyser500ml",
  "wdfLysercell",
  "wdfFluorocell",
  "cellcleanAuto",
  "xnCheck",
  "fluorocellRet",
  "cellpackDfl",
  "xnCheckBf",
]);

function shiftLocalRows(formula) {
  return formula.replace(/(\$?[A-Z]{1,3}\$?)(\d+)/g, (match, column, row, offset, text) => {
    if (text[offset - 1] === "!") return match;
    const numericRow = Number(row);
    if ((numericRow >= 3 && numericRow <= 12) || (numericRow >= 14 && numericRow <= 16)) {
      return `${column}${numericRow + ROW_OFFSET}`;
    }
    return match;
  });
}

function shiftSource(source) {
  const match = /^([A-Z]+)(\d+)$/.exec(source.cell);
  if (!match) return { ...source };
  const row = Number(match[2]);
  return {
    ...source,
    cell: `${match[1]}${row + ROW_OFFSET}`,
    formula: shiftLocalRows(source.formula),
  };
}

function replaceConfiguration(identity) {
  if (identity.kind === "item") return { ...identity, configuration: CONFIGURATION };
  return {
    ...identity,
    name: identity.name.replace("XNL-350 SIN LICENCIAS", CONFIGURATION),
  };
}

function aggregateIdentity(name) {
  return { kind: "aggregate", name: `${CONFIGURATION}: ${name}` };
}

function rule(id, name, cell, formula, expression) {
  return {
    id,
    identity: aggregateIdentity(name),
    source: { sheet: "PRUEBA EFECTIVA XN", cell, formula },
    expression,
  };
}

const inheritedRules = SOURCE_PACKAGE.rules
  .filter((entry) => !entry.id.startsWith("process."))
  .map((entry) => ({
    ...entry,
    identity: replaceConfiguration(entry.identity),
    source: shiftSource(entry.source),
  }));

const maintenance = inheritedRules.find((entry) => entry.id === "cost.maintenance");
maintenance.source = {
  sheet: "PRUEBA EFECTIVA XN",
  cell: "M34",
  formula: "=(L34*K33)/(12)",
};
maintenance.expression = {
  op: "divide",
  args: [
    { op: "multiply", args: [{ value: 570 }, { input: "contractMonths" }] },
    { value: 12 },
  ],
};

const equipment = inheritedRules.find((entry) => entry.id === "cost.equipmentPerDetermination");
equipment.source = {
  sheet: "PRUEBA EFECTIVA XN",
  cell: "M35",
  formula: "=((((L34)*(K33))/'BIOMETRIA HEMATICA'!B2))",
};
equipment.expression = {
  op: "divide",
  args: [
    { op: "multiply", args: [{ value: 570 }, { input: "contractMonths" }] },
    { input: "annualDemand" },
  ],
};

const totalArgs = [
  ...ITEM_KEYS.map((key) => ({ ref: `${key}.baseTotal` })),
  { ref: "cost.additional" },
  { ref: "cost.maintenance" },
];

const rules = [
  ...inheritedRules,
  rule(
    "process.completeUnitValue",
    "PVP BIOMETRIA COMPLETA",
    "O22",
    "=(SUM(M22:M34)/'BIOMETRIA HEMATICA'!B2)+M35",
    {
      op: "add",
      args: [
        { op: "divide", args: [{ op: "add", args: totalArgs }, { input: "annualDemand" }] },
        { ref: "cost.equipmentPerDetermination" },
      ],
    }
  ),
  rule(
    "process.completeWithMargin",
    "complete PARA PROCESO",
    "P22",
    "=((O22*0.15)+O22)",
    {
      op: "add",
      args: [
        { op: "multiply", args: [{ ref: "process.completeUnitValue" }, { value: "0.15" }] },
        { ref: "process.completeUnitValue" },
      ],
    }
  ),
  rule(
    "process.completeInitialValue",
    "complete VALOR INICIAL",
    "Q22",
    "=P22*'BIOMETRIA HEMATICA'!B2",
    { op: "multiply", args: [{ ref: "process.completeWithMargin" }, { input: "annualDemand" }] }
  ),
  rule(
    "process.completeFinalValue",
    "complete VALOR FINAL",
    "R22",
    "=O22*'BIOMETRIA HEMATICA'!B2",
    { op: "multiply", args: [{ ref: "process.completeUnitValue" }, { input: "annualDemand" }] }
  ),
];

module.exports = Object.freeze({
  packageId: "hematologia-xnl350-con-licencias-prueba-efectiva",
  version: SOURCE_PACKAGE.version,
  sourceWorkbook: { ...SOURCE_PACKAGE.sourceWorkbook },
  scope: {
    family: "hematologia",
    equipment: CONFIGURATION,
    modality: "prueba_efectiva",
  },
  inputs: SOURCE_PACKAGE.inputs,
  rules,
});
