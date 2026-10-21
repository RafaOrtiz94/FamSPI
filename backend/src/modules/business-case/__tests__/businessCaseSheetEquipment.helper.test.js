const {
  filterEquipmentPairsForSheet,
  isAffirmative,
  shouldIncludeBackupInSheet,
} = require("../businessCaseSheetEquipment.helper");

describe("business case sheet equipment filtering", () => {
  it("only includes a backup when simultaneous installation is affirmative", () => {
    const pairs = filterEquipmentPairsForSheet([
      { primary_id: 9, backup_id: 2, backup_install_simultaneous: false },
      { primary_id: 10, backup_id: 3, backup_install_simultaneous: "Sí" },
    ]);

    expect(pairs).toEqual([
      { primary_id: 9, backup_id: null, backup_install_simultaneous: false },
      { primary_id: 10, backup_id: 3, backup_install_simultaneous: "Sí" },
    ]);
  });

  it("recognizes boolean and legacy textual affirmative values", () => {
    expect(isAffirmative(true)).toBe(true);
    expect(isAffirmative("si")).toBe(true);
    expect(isAffirmative("No")).toBe(false);
    expect(shouldIncludeBackupInSheet({ backup_install_simultaneous: "false" })).toBe(false);
  });
});
