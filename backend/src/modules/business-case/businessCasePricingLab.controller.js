const logger = require("../../config/logger");
const pricingLabService = require("./businessCasePricingLab.service");

async function preview(req, res) {
  try {
    const data = await pricingLabService.buildPreview(req.params.id, {
      refreshFromSheet: req.method === "POST",
    });
    return res.json({ ok: true, data });
  } catch (error) {
    logger.error(
      { businessCaseId: req.params.id, error: error?.message || String(error) },
      "Error generando vista previa del laboratorio de precios BC",
    );
    return res.status(error?.status || 500).json({
      ok: false,
      code: error?.code || "BC_PRICING_LAB_FAILED",
      message: error?.message || "No se pudo calcular la vista previa de precios.",
    });
  }
}

module.exports = { preview };
