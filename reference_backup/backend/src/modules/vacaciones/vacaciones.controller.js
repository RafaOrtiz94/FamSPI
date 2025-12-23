const service = require("./vacaciones.service");
const logger = require("../../config/logger");

async function create(req, res) {
  try {
    const request = await service.createVacationRequest(req.body, req.user.id);
    res.status(201).json({ ok: true, data: request });
  } catch (err) {
    logger.error(err, "Error creando solicitud de vacaciones");
    res.status(400).json({ ok: false, message: err.message || "No se pudo crear la solicitud" });
  }
}

async function list(req, res) {
  try {
    const rows = await service.listVacationRequests(req.query, req.user);
    res.json({ ok: true, data: rows });
  } catch (err) {
    logger.error(err, "Error listando vacaciones");
    res.status(500).json({ ok: false, message: "No se pudieron cargar las solicitudes" });
  }
}

async function updateStatus(req, res) {
  try {
    const updated = await service.updateVacationStatus(req.params.id, req.body.status, req.user);
    res.json({ ok: true, data: updated });
  } catch (err) {
    logger.error(err, "Error actualizando vacaciones");
    res.status(400).json({ ok: false, message: err.message || "No se pudo actualizar" });
  }
}

async function getSummary(req, res) {
  try {
    const data = await service.summary(req.user, req.query.all === "true");
    res.json({ ok: true, data });
  } catch (err) {
    logger.error(err, "Error obteniendo resumen de vacaciones");
    res.status(500).json({ ok: false, message: "No se pudo obtener el resumen" });
  }
}

module.exports = { create, list, updateStatus, getSummary };
