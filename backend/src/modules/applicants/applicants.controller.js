const logger = require("../../config/logger");
const service = require("./applicants.service");

const importApplicant = async (req, res) => {
  const start = Date.now();
  try {
    const payload = req.body || {};
    const result = await service.importApplicant(payload, {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });
    const elapsedMs = Date.now() - start;
    return res.status(200).json({ ok: true, elapsed_ms: elapsedMs, data: result });
  } catch (err) {
    logger.error({ err }, "Error importando postulante");
    return res.status(err.status || 500).json({
      ok: false,
      message: err.message || "Error importando postulante",
    });
  }
};

const listApplicants = async (req, res) => {
  try {
    const { cargo, search } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 25;
    const result = await service.listApplicants({ cargo, search, page, pageSize });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "Error listando postulantes");
    return res.status(500).json({
      ok: false,
      message: err.message || "Error listando postulantes",
    });
  }
};

const getApplicantById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await service.getApplicantById(id);
    if (!result) {
      return res.status(404).json({ ok: false, message: "Postulante no encontrado" });
    }
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error obteniendo postulante");
    return res.status(500).json({
      ok: false,
      message: err.message || "Error obteniendo postulante",
    });
  }
};

const syncApplicantsFromSheet = async (req, res) => {
  try {
    const result = await service.syncApplicantsFromSheet();
    logger.info({ result }, "Sync manual de postulantes desde Google Sheet");
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error sincronizando postulantes desde Google Sheet");
    return res.status(err.status || 500).json({
      ok: false,
      message: err.message || "Error sincronizando postulantes desde el formulario",
    });
  }
};

module.exports = { importApplicant, listApplicants, getApplicantById, syncApplicantsFromSheet };
