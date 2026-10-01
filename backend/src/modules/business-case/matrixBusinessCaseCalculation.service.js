const { executePackage } = require("./matrixCalculationEngine.service");
const registry = require("./matrixCalculationPackages.registry");
const coverage = require("./matrixCalculationCoverage.catalog");

function calculate(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return registry.getExactPackage(request);
  }

  const packageDefinition = registry.getExactPackage({
    family: request.family,
    equipment: request.equipment,
    modality: request.modality,
    version: request.version,
  });
  return executePackage(packageDefinition, request.inputs);
}

function getCatalog() {
  return {
    packages: registry.listPackages(),
    quarantinedScopes: registry.listQuarantinedScopes(),
    coverage: coverage.getCoverageSummary(),
    workbooks: coverage.getCoverageCatalog(),
  };
}

module.exports = {
  calculate,
  getCatalog,
};
