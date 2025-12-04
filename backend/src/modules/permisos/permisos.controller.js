const permisosService = require("./permisos.service");

const crearSolicitud = async (req, res) => {
  try {
    const solicitud = await permisosService.createSolicitud({ body: req.body || {}, user: req.user });
    return res.json({ ok: true, data: solicitud });
  } catch (error) {
    const status = error.status || 400;
    return res.status(status).json({ ok: false, message: error.message || "No se pudo crear la solicitud" });
  }
};

const aprobarParcial = async (req, res) => {
  try {
    const solicitud = await permisosService.aprobarParcial({ id: req.params.id, approver: req.user });
    return res.json({ ok: true, data: solicitud });
  } catch (error) {
    const status = error.status || 400;
    return res.status(status).json({ ok: false, message: error.message || "No se pudo aprobar parcialmente" });
  }
};

const subirJustificantes = async (req, res) => {
  try {
    const urls = req.body?.justificantes_urls || req.body?.urls || [];
    const solicitud = await permisosService.subirJustificantes({ id: req.params.id, urls, user: req.user });
    return res.json({ ok: true, data: solicitud });
  } catch (error) {
    const status = error.status || 400;
    return res.status(status).json({ ok: false, message: error.message || "No se pudieron cargar los justificantes" });
  }
};

const aprobarFinal = async (req, res) => {
  try {
    const solicitud = await permisosService.aprobarFinal({ id: req.params.id, approver: req.user });
    return res.json({ ok: true, data: solicitud });
  } catch (error) {
    const status = error.status || 400;
    return res.status(status).json({ ok: false, message: error.message || "No se pudo aprobar" });
  }
};

const rechazar = async (req, res) => {
  try {
    const solicitud = await permisosService.rechazar({
      id: req.params.id,
      approver: req.user,
      observaciones: req.body?.observaciones || req.body?.motivo || null,
    });
    return res.json({ ok: true, data: solicitud });
  } catch (error) {
    const status = error.status || 400;
    return res.status(status).json({ ok: false, message: error.message || "No se pudo rechazar la solicitud" });
  }
};

const listarPendientes = async (req, res) => {
  try {
    const data = await permisosService.listarPendientes({ stage: req.query?.stage });
    return res.json({ ok: true, data });
  } catch (error) {
    const status = error.status || 400;
    return res.status(status).json({ ok: false, message: error.message || "No se pudo obtener solicitudes" });
  }
};

module.exports = {
  crearSolicitud,
  aprobarParcial,
  subirJustificantes,
  aprobarFinal,
  rechazar,
  listarPendientes,
};
