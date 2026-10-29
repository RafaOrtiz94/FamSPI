const {
  resolveSheetSyncOutcome,
  mergeSheetGenerationHistory,
} = require("../businessCaseSheetVersioning.helper");

describe("businessCaseSheetVersioning.helper", () => {
  it("marks same sheet sync as same_file_updated and avoids new version", () => {
    const outcome = resolveSheetSyncOutcome({
      previousSheetId: "sheet-123",
      webAppResponse: {
        sheetId: "sheet-123",
        reused_existing_file: true,
      },
    });

    expect(outcome.syncMode).toBe("same_file_updated");
    expect(outcome.shouldCreateDocumentVersion).toBe(false);
    expect(outcome.shouldCreateHistoryEntry).toBe(false);
  });

  it("marks recreated spreadsheet with missing sheets as replacement", () => {
    const outcome = resolveSheetSyncOutcome({
      previousSheetId: "sheet-old",
      webAppResponse: {
        sheetId: "sheet-new",
        recreated_file: true,
        replacement_reason: "missing_required_sheets",
        missing_required_sheets: ["BC", "Equipo A"],
      },
    });

    expect(outcome.syncMode).toBe("file_replaced");
    expect(outcome.shouldCreateDocumentVersion).toBe(true);
    expect(outcome.replacementReason).toBe("missing_required_sheets");
    expect(outcome.missingRequiredSheets).toEqual(["BC", "Equipo A"]);
  });

  it("updates existing history entry when the same file is reused", () => {
    const updatedHistory = mergeSheetGenerationHistory(
      [
        {
          sheet_id: "sheet-123",
          provider: "google_sheets_local",
          generated_at: "2026-06-16T10:00:00.000Z",
        },
      ],
      {
        sheet_id: "sheet-123",
        provider: "google_sheets_local",
        generated_at: "2026-06-16T12:00:00.000Z",
        sync_mode: "same_file_updated",
      },
      {
        shouldCreateHistoryEntry: false,
      },
    );

    expect(updatedHistory).toHaveLength(1);
    expect(updatedHistory[0].generated_at).toBe("2026-06-16T12:00:00.000Z");
    expect(updatedHistory[0].sync_mode).toBe("same_file_updated");
  });

  it("prepends a new history entry when the file is replaced", () => {
    const updatedHistory = mergeSheetGenerationHistory(
      [
        {
          sheet_id: "sheet-123",
          provider: "google_sheets_local",
        },
      ],
      {
        sheet_id: "sheet-456",
        provider: "google_sheets_local",
        sync_mode: "file_replaced",
      },
      {
        shouldCreateHistoryEntry: true,
      },
    );

    expect(updatedHistory).toHaveLength(2);
    expect(updatedHistory[0].sheet_id).toBe("sheet-456");
    expect(updatedHistory[1].sheet_id).toBe("sheet-123");
  });
});
