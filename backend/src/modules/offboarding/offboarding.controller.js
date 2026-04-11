const logger = require("../../config/logger");
const service = require("./offboarding.service");

const getErrorStatus = (err, fallback = 400) => {
  const status = Number(err?.status || err?.statusCode);
  if (Number.isInteger(status) && status >= 400 && status < 600) return status;
  return fallback;
};

async function getWorkspace(req, res) {
  try {
    const data = await service.getWorkspace(req.params.userId);
    res.json({ ok: true, data });
  } catch (err) {
    logger.error({ err }, "Error cargando workspace de offboarding");
    res.status(getErrorStatus(err, 500)).json({
      ok: false,
      message: err?.message || "No se pudo cargar offboarding",
    });
  }
}

async function updateTask(req, res) {
  try {
    const data = await service.updateTask({
      userId: req.params.userId,
      taskKey: req.params.taskKey,
      isCompleted: req.body?.is_completed,
      actor: req.user,
    });
    res.json({ ok: true, data });
  } catch (err) {
    logger.error({ err }, "Error actualizando tarea de offboarding");
    res.status(getErrorStatus(err, 400)).json({
      ok: false,
      message: err?.message || "No se pudo actualizar la tarea",
    });
  }
}

async function runLiquidation(req, res) {
  try {
    const data = await service.runLiquidation({
      userId: req.params.userId,
      departureDate: req.body?.departure_date,
      salaryBase: req.body?.salary_base,
      otherDeductions: req.body?.other_deductions || 0,
      actor: req.user,
    });
    res.json({ ok: true, data });
  } catch (err) {
    logger.error({ err }, "Error ejecutando liquidacion de offboarding");
    res.status(getErrorStatus(err, 400)).json({
      ok: false,
      message: err?.message || "No se pudo ejecutar la liquidacion",
    });
  }
}

async function startOffboarding(req, res) {
  try {
    const data = await service.startOffboarding({
      userId: req.params.userId,
      actor: req.user,
      reason: req.body?.reason || "",
    });
    res.json({ ok: true, data });
  } catch (err) {
    logger.error({ err }, "Error iniciando offboarding");
    res.status(getErrorStatus(err, 400)).json({
      ok: false,
      message: err?.message || "No se pudo iniciar el offboarding",
    });
  }
}

async function closeOffboarding(req, res) {
  try {
    const data = await service.closeOffboarding({
      userId: req.params.userId,
      actor: req.user,
    });
    res.json({ ok: true, data });
  } catch (err) {
    logger.error({ err }, "Error cerrando offboarding");
    res.status(getErrorStatus(err, 400)).json({
      ok: false,
      message: err?.message || "No se pudo cerrar el offboarding",
    });
  }
}

module.exports = {
  getWorkspace,
  updateTask,
  runLiquidation,
  startOffboarding,
  closeOffboarding,
};
