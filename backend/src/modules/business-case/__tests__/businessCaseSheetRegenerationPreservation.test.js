const fs = require("fs");
const path = require("path");

describe("Business Case Sheet regeneration preservation", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../businessCaseSheetSyncLocal.service.js"),
    "utf8",
  );

  test("does not delete previous spreadsheets when recreating from template", () => {
    expect(source).not.toContain("drive.files.delete");
    expect(source).toContain("preservePreviousSpreadsheet");
    expect(source).toContain("previous_sheet_preserved");
  });
});
