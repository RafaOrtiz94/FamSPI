const logger = require("../../config/logger");
const pricingLabService = require("./businessCasePricingLab.service");
const ruleValidations = require("./consumableRuleValidations.service");
const simulationService = require("./consumableSimulation.service");
const determinationPredictions = require("./determinationPredictions.service");
const labStatistics = require("./labStatistics.service");
const deliveryHistory = require("./deliveryHistory.service");

// Convenciones del motor de reglas a probar: cuerpo del POST o ?conventions=<json> en el GET.
function readConventions(req) {
  if (req.body?.conventions && typeof req.body.conventions === "object") return req.body.conventions;
  if (typeof req.query?.conventions !== "string") return null;
  try {
    const parsed = JSON.parse(req.query.conventions);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    return null;
  }
}

async function preview(req, res) {
  try {
    const data = await pricingLabService.buildPreview(req.params.id, {
      // El POST sin cuerpo relee el Sheet; con convenciones solo recalcula.
      refreshFromSheet: req.method === "POST" && req.body?.refreshFromSheet !== false,
      conventions: readConventions(req),
    });
    // El modelo de simulacion es interno: la pantalla no lo usa.
    (data.equipment || []).forEach((entry) => { if (entry.ruleEngine) delete entry.ruleEngine.simulationModel; });
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

function validationHandler(action, failureMessage) {
  return async (req, res) => {
    try {
      const data = await action(req);
      return res.json({ ok: true, data });
    } catch (error) {
      if (!error?.status) {
        logger.error(
          { businessCaseId: req.params.id, error: error?.message || String(error) },
          "Error en validacion del motor de reglas de consumibles",
        );
      }
      return res.status(error?.status || 500).json({
        ok: false,
        code: error?.code || "BC_RULE_VALIDATION_FAILED",
        message: error?.status ? error.message : failureMessage,
      });
    }
  };
}

const saveRuleValidation = validationHandler(
  (req) => ruleValidations.saveValidation(req.params.id, req.body || {}, req.user),
  "No se pudo guardar la validacion.",
);
const getDeliveryHistory = validationHandler(
  async (req) => {
    const [history, references] = await Promise.all([
      deliveryHistory.getForBusinessCase(req.params.id),
      require("./referenceConsumption.service").referencesFor(req.params.id),
    ]);
    // Clientes de referencia (otros procesos con consumo real): con ellos se predice a un cliente nuevo.
    const bySource = {};
    references.forEach((reference) => { bySource[reference.source] = (bySource[reference.source] || 0) + 1; });
    return { ...history, referenceSources: Object.entries(bySource).map(([name, products]) => ({ name, products })) };
  },
  "No se pudo leer el historial de entregas.",
);
const uploadDeliveryHistory = validationHandler(
  async (req) => {
    if (!req.file?.buffer) throw Object.assign(new Error("Adjunte el archivo de control de entregas."), { status: 400 });
    const result = await deliveryHistory.importForBusinessCase(req.params.id, req.file.buffer, { fileName: req.file.originalname || null, user: req.user });
    // Verdad nueva: se recalibra y se vuelve a predecir en segundo plano.
    setImmediate(() => {
      simulationService.runPending({ limit: 5 }).catch(() => {});
    });
    return result;
  },
  "No se pudo cargar el historial de entregas.",
);
const getLabStatistics = validationHandler(
  (req) => labStatistics.getForBusinessCase(req.params.id),
  "No se pudieron leer las estadisticas del laboratorio.",
);
const saveLabStatistics = validationHandler(
  async (req) => {
    const result = await labStatistics.saveForBusinessCase(req.params.id, req.body?.values || {}, req.user);
    // Datos nuevos: la prediccion se rehace en segundo plano (otro hilo), sin demorar la respuesta.
    setImmediate(() => {
      simulationService.ensureCurrent(req.params.id).catch(() => {});
    });
    return result;
  },
  "No se pudieron guardar las estadisticas del laboratorio.",
);
const deleteRuleValidation = validationHandler(
  (req) => ruleValidations.deleteValidation(req.params.id, req.body || {}),
  "No se pudo quitar la validacion.",
);

const runSimulation = validationHandler(
  (req) => simulationService.runForBusinessCase(req.params.id, {
    scenarios: req.body?.scenarios,
    seed: req.body?.seed,
    conventions: req.body?.conventions && typeof req.body.conventions === "object" ? req.body.conventions : null,
  }, req.user),
  "No se pudo simular los escenarios.",
);
const getSimulation = validationHandler(
  (req) => simulationService.getForBusinessCase(req.params.id),
  "No se pudo leer la simulacion.",
);

// Prediccion del motor en Determinaciones (Jefe de Servicio valida o cambia con motivo).
const getDeterminationPredictions = validationHandler(
  (req) => determinationPredictions.getPredictions(req.params.id),
  "No se pudo leer la prediccion del motor.",
);
const validateDeterminationPredictions = validationHandler(
  (req) => determinationPredictions.validatePredictions(req.params.id, req.body?.items || req.body || [], req.user),
  "No se pudo guardar la validacion.",
);

module.exports = {
  preview,
  saveRuleValidation,
  deleteRuleValidation,
  runSimulation,
  getSimulation,
  getDeterminationPredictions,
  validateDeterminationPredictions,
  getLabStatistics,
  saveLabStatistics,
  getDeliveryHistory,
  uploadDeliveryHistory,
};
