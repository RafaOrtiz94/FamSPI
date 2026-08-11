const { loadTemplateDefinition } = require("../businessCaseSheetSyncLocal.service");

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
      expect.objectContaining({ itemId: "11706802001", itemType: "material" }),
    );
  });
});
