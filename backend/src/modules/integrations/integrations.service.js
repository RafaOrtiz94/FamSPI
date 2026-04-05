const externalCasesService = require("../servicio/externalCases.service");
const externalCaseSyncService = require("../servicio/externalCaseSync.service");

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
};
