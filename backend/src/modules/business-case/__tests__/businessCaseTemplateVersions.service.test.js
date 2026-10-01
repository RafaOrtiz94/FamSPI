const XLSX = require("xlsx");
const { extractStructureSnapshot, diffSnapshots } = require("../businessCaseTemplateVersions.service");

function buildWorkbook(sheetsDef) {
  const workbook = XLSX.utils.book_new();
  for (const [name, headerRow] of Object.entries(sheetsDef)) {
    const ws = XLSX.utils.aoa_to_sheet([headerRow, [1, 2, 3]]);
    XLSX.utils.book_append_sheet(workbook, ws, name);
  }
  return workbook;
}

describe("businessCaseTemplateVersions structure diff", () => {
  test("extracts header labels per sheet from the best-scoring row", () => {
    const workbook = buildWorkbook({
      BC: ["Tipo de Cliente", "Nombre", "Ciudad"],
      Reactivos: ["ID", "Producto", "Cantidad Anual"],
    });
    const snapshot = extractStructureSnapshot(workbook);
    expect(snapshot.sheetNames).toEqual(["BC", "Reactivos"]);
    expect(snapshot.sheets.BC).toEqual(["TIPO DE CLIENTE", "NOMBRE", "CIUDAD"]);
    expect(snapshot.sheets.Reactivos).toEqual(["ID", "PRODUCTO", "CANTIDAD ANUAL"]);
  });

  test("reports no changes when the structure is identical", () => {
    const workbook = buildWorkbook({ BC: ["A", "B"] });
    const snapshot = extractStructureSnapshot(workbook);
    const diff = diffSnapshots(snapshot, snapshot);
    expect(diff.has_changes).toBe(false);
    expect(diff.sheets_added).toEqual([]);
    expect(diff.sheet_changes).toEqual([]);
  });

  test("detects a new sheet and a new column added to an existing sheet", () => {
    const oldSnap = extractStructureSnapshot(buildWorkbook({
      BC: ["Tipo", "Nombre"],
      Reactivos: ["ID", "Producto"],
    }));
    const newSnap = extractStructureSnapshot(buildWorkbook({
      BC: ["Tipo", "Nombre"],
      Reactivos: ["ID", "Producto", "Reparaciones"],
      Inversiones: ["ID", "Monto"],
    }));

    const diff = diffSnapshots(oldSnap, newSnap);
    expect(diff.has_changes).toBe(true);
    expect(diff.sheets_added).toEqual(["Inversiones"]);
    expect(diff.sheets_removed).toEqual([]);
    expect(diff.sheet_changes).toEqual([
      { sheet: "Reactivos", columns_added: ["REPARACIONES"], columns_removed: [] },
    ]);
  });

  test("treats the very first uploaded version as having no prior snapshot to diff against", () => {
    const newSnap = extractStructureSnapshot(buildWorkbook({ BC: ["A"] }));
    const diff = diffSnapshots(null, newSnap);
    expect(diff.is_first_version).toBe(true);
    expect(diff.has_changes).toBe(false);
  });
});
