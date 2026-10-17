const WORKBOOKS = Object.freeze([
  {
    fileName: "TABLA MATRIZ COSTOS PARA COMERCIAL 2024-12-06 HEMATOLOGIA.xlsx",
    sha256: "1b8ff28f1b2917e79682c94f12d925490e8fe0b2f5e500b923b284065b76d338",
    sheets: [
      { name: "BC", range: "A1:Z1000", formulas: 57, status: "source_only" },
      { name: "BIOMETRIA HEMATICA", range: "A1:H993", formulas: 0, status: "source_only" },
      { name: "DETERMINACION XP-300", range: "A2:P997", formulas: 34, status: "active", activeScopes: 1, quarantinedScopes: 0 },
      { name: "PRUEBA EFECTIVA XP-300", range: "A2:P997", formulas: 34, status: "active", activeScopes: 1, quarantinedScopes: 0 },
      { name: "COMODATO TODO COMPRADO XP-300", range: "A2:O997", formulas: 43, status: "active", activeScopes: 1, quarantinedScopes: 0 },
      { name: "DETERMINACION XN", range: "A1:R157", formulas: 701, status: "partial", activeScopes: 1, quarantinedScopes: 7 },
      { name: "PRUEBA EFECTIVA XN", range: "A1:R157", formulas: 712, status: "partial", activeScopes: 2, quarantinedScopes: 6 },
      { name: "COMODATO TODO COMPRADO XN", range: "A1:Q182", formulas: 887, status: "partial", activeScopes: 7, quarantinedScopes: 1 },
    ],
  },
  {
    fileName: "TABLA MATRIZ COSTOS PARA COMERCIAL 2024-12-06 INMUNO-QUIMICA.xlsx",
    sha256: "dd64eb9a86e17e81eeb57623a3155f575780c10779fa1691e04ce4039964dd7d",
    sheets: [
      { name: "BC", range: "A1:Z1016", formulas: 70, status: "source_only" },
      { name: "c111", range: "A1:H1006", formulas: 82, status: "source_only" },
      { name: "c111 DETERMIACION", range: "A2:T62", formulas: 575, status: "quarantined", errors: { divisionByZero: 119 } },
      { name: "c111 PRUEBA EFECTIVA", range: "A2:U62", formulas: 605, status: "quarantined", errors: { divisionByZero: 119 } },
      { name: "c111 TODO COMPRADO", range: "A2:V65", formulas: 620, status: "quarantined", errors: { divisionByZero: 119, value: 8 } },
      { name: "c311", range: "A1:Z988", formulas: 167, status: "quarantined_source", errors: { divisionByZero: 1 } },
      { name: "c311 DETERMINACION", range: "A1:AC1006", formulas: 1397, status: "quarantined", errors: { divisionByZero: 266, value: 14 } },
      { name: "c311 PRUEBA EFECTIVA", range: "A1:AD1006", formulas: 1465, status: "quarantined", errors: { divisionByZero: 265 } },
      { name: "c311 TODO COMPRADO", range: "A1:AE999", formulas: 1482, status: "quarantined", errors: { divisionByZero: 467 } },
      { name: "e411", range: "A1:AA980", formulas: 311, status: "quarantined_source", errors: { divisionByZero: 6 } },
      { name: "e411 DETERMINACION", range: "A1:AC983", formulas: 2111, status: "quarantined", errors: { divisionByZero: 391 } },
      { name: "e411 PRUEBA EFECTIVA", range: "A1:AD983", formulas: 2206, status: "quarantined", errors: { divisionByZero: 391 } },
      { name: "e411 TODO COMPRADO", range: "A1:AE984", formulas: 2428, status: "quarantined", errors: { divisionByZero: 706 }, externalReferences: 310 },
      { name: "c303-c503", range: "A1:Z994", formulas: 221, status: "quarantined_source", errors: { divisionByZero: 6 } },
      { name: "c303-c503 DETERMINACION", range: "A1:AC1001", formulas: 1577, status: "quarantined", errors: { reference: 319, divisionByZero: 4 }, brokenFormulaLiterals: 2 },
      { name: "c303-c503 PRUEBA EFECTIVA", range: "A1:AD1001", formulas: 1660, status: "quarantined", errors: { divisionByZero: 307, reference: 20 }, brokenFormulaLiterals: 2 },
      { name: "c303-c503 TODO COMPRADO", range: "A1:AE1004", formulas: 1872, status: "quarantined", errors: { divisionByZero: 593, reference: 20 }, brokenFormulaLiterals: 2 },
      { name: "e402-e801", range: "A1:Q997", formulas: 379, status: "quarantined_source", errors: { divisionByZero: 5 } },
      { name: "e402-e801 DETERMINACION", range: "A1:T999", formulas: 2415, status: "quarantined", errors: { divisionByZero: 425 } },
      { name: "e402-e801 PRUEBA EFECTIVA", range: "A1:U996", formulas: 2519, status: "quarantined", errors: { divisionByZero: 425, value: 24 } },
      { name: "e402-e801 TODO COMPRADO", range: "A1:V996", formulas: 2747, status: "quarantined", errors: { divisionByZero: 780 } },
    ],
    quarantineReason: "UNRESOLVED_ZERO_DENOMINATOR_SEMANTICS",
  },
]);

function cloneWorkbook(workbook) {
  return {
    ...workbook,
    sheets: workbook.sheets.map((sheet) => ({
      ...sheet,
      ...(sheet.errors ? { errors: { ...sheet.errors } } : {}),
    })),
  };
}

function getCoverageCatalog() {
  return WORKBOOKS.map(cloneWorkbook);
}

function getCoverageSummary() {
  const sheets = WORKBOOKS.flatMap((workbook) => workbook.sheets);
  const errorTotals = sheets.reduce((totals, sheet) => {
    for (const [type, count] of Object.entries(sheet.errors || {})) {
      totals[type] = (totals[type] || 0) + count;
    }
    return totals;
  }, {});
  return {
    workbookCount: WORKBOOKS.length,
    sheetCount: sheets.length,
    formulaCellCount: sheets.reduce((sum, sheet) => sum + sheet.formulas, 0),
    classifiedSheetCount: sheets.filter((sheet) => Boolean(sheet.status)).length,
    activeScopeCount: sheets.reduce((sum, sheet) => sum + (sheet.activeScopes || 0), 0),
    quarantinedHematologyScopeCount: sheets.reduce(
      (sum, sheet) => sum + (sheet.quarantinedScopes || 0),
      0
    ),
    quarantinedImmunochemistrySheetCount: WORKBOOKS[1].sheets.filter(
      (sheet) => sheet.status.startsWith("quarantined")
    ).length,
    cachedErrorCellCount: Object.values(errorTotals).reduce((sum, count) => sum + count, 0),
    cachedErrors: errorTotals,
    externalReferenceFormulaCount: sheets.reduce(
      (sum, sheet) => sum + (sheet.externalReferences || 0),
      0
    ),
    brokenFormulaLiteralCount: sheets.reduce(
      (sum, sheet) => sum + (sheet.brokenFormulaLiterals || 0),
      0
    ),
  };
}

module.exports = {
  getCoverageCatalog,
  getCoverageSummary,
};
