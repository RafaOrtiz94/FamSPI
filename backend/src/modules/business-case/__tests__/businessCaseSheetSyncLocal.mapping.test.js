const {
  loadTemplateDefinition,
  buildAnnualQuantityProtectionRanges,
} = require("../businessCaseSheetSyncLocal.service");

describe("business case sheet quantity mapping", () => {
  test("preserves populated technical rows and uses the column for each sheet block", () => {
    const definition = loadTemplateDefinition().equipmentSheets.find((sheet) => sheet.name === "c303 c503");

    expect(definition).toBeDefined();
    expect(definition.rows.find((row) => row.rowNumber === 85)?.columns.annual).toBe(6);
    expect(definition.rows.find((row) => row.rowNumber === 148)).toEqual(
      expect.objectContaining({
        itemId: "11183974216",
        columns: expect.objectContaining({ annual: 3 }),
      }),
    );
  });

  test("maps every b123 reagent, control and material row to annual quantity column E", () => {
    const definition = loadTemplateDefinition().equipmentSheets.find((sheet) => sheet.name === "b123");
    const rows = definition.rows.filter((row) => row.rowNumber >= 9 && row.rowNumber <= 16);

    expect(rows).toHaveLength(8);
    expect(rows.every((row) => row.columns.annual === 5)).toBe(true);
    expect(rows.map((row) => row.itemId)).toEqual([
      "5169992001",
      "3321207001",
      "3321193001",
      "3321215001",
      "5170478001",
      "5082595001",
      "5689856001",
      "3066762001",
    ]);
  });

  test("protects only the validated subsection annual cells", () => {
    const template = loadTemplateDefinition();
    const equipmentTabs = [{
      sheet_name: "b123",
      items: [
        { item_id: "5169992001", item_name: "FLUID PACK COOX 200", item_type: "reactivo" },
        { item_id: "3321207001", item_name: "COMBITROL PLUS B LEVEL 2 30 PCS", item_type: "control" },
        { item_id: "5170478001", item_name: "SENSOR CARTRIDGE BG ISE GLU LAC", item_type: "material" },
      ],
    }];

    const ranges = buildAnnualQuantityProtectionRanges({
      template,
      equipmentTabs,
      businessCaseId: "bc-test",
      subsection: "controles",
    });

    expect(ranges).toEqual([
      expect.objectContaining({
        description: expect.stringContaining(":controles:b123:10-10"),
        range: expect.objectContaining({
          sheetTitle: "b123",
          startRowIndex: 9,
          endRowIndex: 10,
          startColumnIndex: 4,
          endColumnIndex: 5,
        }),
      }),
    ]);
  });
});
