const { loadTemplateDefinition, buildSheetPayloads } = require("../businessCaseSheetSyncLocal.service");

describe("business case e411 sheet mapping", () => {
  test("infers e411 item types from template section headers", () => {
    const definition = loadTemplateDefinition().equipmentSheets.find((sheet) => sheet.name === "e411");

    expect(definition).toBeDefined();
    expect(definition.rows.find((row) => row.rowNumber === 9)).toEqual(
      expect.objectContaining({ itemId: "8946710190", itemType: "reactivo" }),
    );
    expect(definition.rows.find((row) => row.rowNumber === 105)).toEqual(
      expect.objectContaining({ itemId: "8959820190", itemType: "calibrador" }),
    );
    expect(definition.rows.find((row) => row.rowNumber === 170)).toEqual(
      expect.objectContaining({ itemId: "9216928190", itemType: "control" }),
    );
    expect(definition.rows.find((row) => row.rowNumber === 220)).toEqual(
      expect.objectContaining({ itemId: "4444191001", itemType: "material" }),
    );
  });

  test("does not associate cobas e411 disk with the t411 tab", () => {
    const equipmentTabs = buildSheetPayloads({
      template: loadTemplateDefinition(),
      equipmentRecords: [{ id: 12, name: "cobas e411 disk" }],
      payload: { fields: {}, sync_items: [], sheet_context: {} },
    });

    expect(equipmentTabs.map((tab) => tab.sheet_name)).toEqual(["e411"]);
  });
});
