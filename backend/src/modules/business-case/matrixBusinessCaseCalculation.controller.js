const logger = require("../../config/logger");
const { MatrixCalculationError } = require("./matrixCalculationEngine.service");
const { MatrixPackageRegistryError } = require("./matrixCalculationPackages.registry");
const matrixCalculationService = require("./matrixBusinessCaseCalculation.service");

function errorStatus(error) {
  if (error.code === "PACKAGE_NOT_FOUND") return 404;
  if (error.code === "PACKAGE_QUARANTINED") return 422;
  return 400;
}

function getCatalog(_req, res) {
  res.json({ ok: true, data: matrixCalculationService.getCatalog() });
}

function preview(req, res) {
  try {
    const result = matrixCalculationService.calculate(req.body);
    return res.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof MatrixCalculationError || error instanceof MatrixPackageRegistryError) {
      return res.status(errorStatus(error)).json({
        ok: false,
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }
    logger.error(error);
    return res.status(500).json({ ok: false, message: "Error calculando la matriz" });
  }
}

module.exports = {
  getCatalog,
  preview,
};
