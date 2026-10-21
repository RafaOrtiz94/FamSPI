function normalizeString(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeString(value))
    .filter(Boolean);
}

function resolveSheetSyncOutcome({ previousSheetId = null, webAppResponse = {} } = {}) {
  const previousId = normalizeString(previousSheetId);
  const currentId = normalizeString(webAppResponse?.sheetId);
  const reportedRecreated = Boolean(webAppResponse?.recreated_file);
  const missingRequiredSheets = normalizeStringArray(webAppResponse?.missing_required_sheets);
  const replacementReason = normalizeString(webAppResponse?.replacement_reason)
    || (reportedRecreated && missingRequiredSheets.length ? "missing_required_sheets" : null);

  const fileReplaced = reportedRecreated || Boolean(previousId && currentId && previousId !== currentId);
  const sameFileUpdated = Boolean(previousId && currentId && previousId === currentId && !fileReplaced);

  let syncMode = "file_created";
  if (fileReplaced) syncMode = "file_replaced";
  else if (sameFileUpdated) syncMode = "same_file_updated";

  return {
    syncMode,
    previousSheetId: previousId,
    currentSheetId: currentId,
    reusedExistingFile: Boolean(webAppResponse?.reused_existing_file) || sameFileUpdated,
    recreatedFile: fileReplaced,
    sameFileUpdated,
    fileReplaced,
    shouldCreateDocumentVersion: syncMode !== "same_file_updated",
    shouldCreateHistoryEntry: syncMode !== "same_file_updated",
    replacementReason,
    missingRequiredSheets,
  };
}

function mergeSheetGenerationHistory(history = [], record, outcome) {
  const safeHistory = Array.isArray(history) ? [...history] : [];
  if (!record || typeof record !== "object") return safeHistory.slice(0, 10);

  if (outcome?.shouldCreateHistoryEntry !== false) {
    safeHistory.unshift(record);
    return safeHistory.slice(0, 10);
  }

  const targetIndex = safeHistory.findIndex((entry) => {
    return (
      normalizeString(entry?.sheet_id) === normalizeString(record?.sheet_id)
      && normalizeString(entry?.provider) === normalizeString(record?.provider)
    );
  });

  if (targetIndex === -1) {
    safeHistory.unshift(record);
    return safeHistory.slice(0, 10);
  }

  safeHistory[targetIndex] = {
    ...safeHistory[targetIndex],
    ...record,
  };
  return safeHistory.slice(0, 10);
}

module.exports = {
  resolveSheetSyncOutcome,
  mergeSheetGenerationHistory,
};
