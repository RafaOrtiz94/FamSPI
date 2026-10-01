function isAffirmative(value) {
  if (value === true || value === 1) return true;
  if (typeof value !== "string") return false;
  return ["true", "1", "yes", "si", "sí"].includes(value.trim().toLowerCase());
}

function filterEquipmentPairsForSheet(equipmentPairs = []) {
  return (Array.isArray(equipmentPairs) ? equipmentPairs : []).map((pair) => {
    const includeBackup = isAffirmative(pair?.backup_install_simultaneous);
    return {
      ...pair,
      backup_id: includeBackup ? pair?.backup_id ?? null : null,
    };
  });
}

function shouldIncludeBackupInSheet(pair = {}) {
  return isAffirmative(pair?.backup_install_simultaneous);
}

module.exports = {
  filterEquipmentPairsForSheet,
  isAffirmative,
  shouldIncludeBackupInSheet,
};
