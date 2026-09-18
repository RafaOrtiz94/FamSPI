const externalCasesService = require("../servicio/externalCases.service");
const externalCaseSyncService = require("../servicio/externalCaseSync.service");
const productMapService = require("./productMap.service");

const getExternalIntegrationsHealth = async () => {
  const providers = await externalCasesService.listProviderHealth();
  return {
    providers,
    generated_at: new Date().toISOString(),
  };
};

const processExternalCasesSyncQueue = async ({ limit, actorUser = null } = {}) => {
  return externalCaseSyncService.runOnce({
    limit,
    actorUser,
    workerId: "integrations-module-manual-sync",
  });
};

module.exports = {
  getExternalIntegrationsHealth,
  processExternalCasesSyncQueue,
  BUSINESS_CATEGORIES: productMapService.BUSINESS_CATEGORIES,
  listProductMap: productMapService.listProductMap,
  upsertProductMap: productMapService.upsertProductMap,
  updateProductMap: productMapService.updateProductMap,
  getProductMapCoverageReport: productMapService.getCoverageReport,
};
