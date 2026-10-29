const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const { executePackage } = require("../src/modules/business-case/matrixCalculationEngine.service");
const registry = require("../src/modules/business-case/matrixCalculationPackages.registry");

const WORKBOOK_PATH = path.resolve(
  __dirname,
  "../Mapeador_Sheets/CALCULOS/TABLA MATRIZ COSTOS PARA COMERCIAL 2024-12-06 HEMATOLOGIA.xlsx"
);

function normalizeFormula(formula) {
  return String(formula).replace(/^=/, "").replace(/\s+/g, "");
}

function verifyParity() {
  const packages = registry.listPackages().map((metadata) => registry.getExactPackage({
    ...metadata.scope,
    version: metadata.version,
  }));
  const expectedHashes = new Set(packages.map((entry) => entry.sourceWorkbook.sha256.toLowerCase()));
  const actualHash = crypto.createHash("sha256").update(fs.readFileSync(WORKBOOK_PATH)).digest("hex");
  const mismatches = [];

  if (expectedHashes.size !== 1 || !expectedHashes.has(actualHash)) {
    mismatches.push({
      type: "WORKBOOK_HASH_MISMATCH",
      expected: [...expectedHashes],
      actual: actualHash,
    });
  }

  const workbook = XLSX.readFile(WORKBOOK_PATH, { cellFormula: true });
  let numericCellsChecked = 0;
  let formulaSourcesChecked = 0;

  for (const packageDefinition of packages) {
    const inputs = {};
    for (const [key, definition] of Object.entries(packageDefinition.inputs)) {
      const sourceCell = workbook.Sheets[definition.source.sheet]?.[definition.source.cell];
      // En operaciones aritmeticas Excel trata una referencia a una celda vacia como cero.
      inputs[key] = sourceCell?.v === undefined ? 0 : sourceCell.v;
    }

    const result = executePackage(packageDefinition, inputs);
    for (const trace of result.trace) {
      const sourceCell = workbook.Sheets[trace.source.sheet]?.[trace.source.cell];
      if (!sourceCell) continue;

      if (sourceCell.f) {
        formulaSourcesChecked += 1;
        if (normalizeFormula(trace.source.formula) !== normalizeFormula(sourceCell.f)) {
          mismatches.push({
            type: "SOURCE_FORMULA_MISMATCH",
            packageId: packageDefinition.packageId,
            ruleId: trace.ruleId,
            cell: `${trace.source.sheet}!${trace.source.cell}`,
            expected: sourceCell.f,
            actual: trace.source.formula,
          });
        }
      }

      if (sourceCell.t === "e" || typeof sourceCell.v !== "number") continue;
      numericCellsChecked += 1;
      const actual = Number(trace.value);
      const expected = sourceCell.v;
      const tolerance = Math.max(1e-8, Math.abs(expected) * 1e-11);
      if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
        mismatches.push({
          type: "NUMERIC_VALUE_MISMATCH",
          packageId: packageDefinition.packageId,
          ruleId: trace.ruleId,
          cell: `${trace.source.sheet}!${trace.source.cell}`,
          expected,
          actual,
        });
      }
    }
  }

  return {
    workbookSha256: actualHash,
    packageCount: packages.length,
    formulaSourcesChecked,
    numericCellsChecked,
    mismatchCount: mismatches.length,
    mismatches,
  };
}

if (require.main === module) {
  const result = verifyParity();
  console.log(JSON.stringify(result, null, 2));
  if (result.mismatchCount > 0) process.exitCode = 1;
}

module.exports = { verifyParity };
