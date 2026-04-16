const externalCasesService = require("../servicio/externalCases.service");
const externalCaseSyncService = require("../servicio/externalCaseSync.service");
const odooIntegrationService = require("./odoo.service");
const productMapService = require("./productMap.service");

const getExternalIntegrationsHealth = async () => {
  const providers = await externalCasesService.listProviderHealth();
  const odoo = odooIntegrationService.getOdooIntegrationHealth();
  return {
    providers,
    odoo,
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
