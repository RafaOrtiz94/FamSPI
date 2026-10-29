const {
  loadTemplateDefinition,
  buildSheetPayloads,
} = require("../businessCaseSheetSyncLocal.service");

describe("business case sheet multi-tab matching", () => {
  test("expande cobas Pure <303 + 402> a las hojas c303 c503 y e402 e801", () => {
    const template = loadTemplateDefinition();

    const equipmentTabs = buildSheetPayloads({
      template,
      equipmentRecords: [{ id: 15, name: "cobas Pure <303 + 402>" }],
      payload: { fields: {}, sync_items: [], sheet_context: {} },
    });

    expect(equipmentTabs.map((tab) => tab.sheet_name)).toEqual(
      expect.arrayContaining([" e402 e801", "c303 c503"]),
    );
    expect(equipmentTabs).toHaveLength(2);
    expect(equipmentTabs.every((tab) => tab.equipment_ids.includes(15))).toBe(true);
  });
});
