const permisosService = require("./permisos.service");
const { uploadJustificante } = require("./permisos.drive");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() }); // Corrected multer storage

async function create(req, res) {
  try {
    const result = await permisosService.createSolicitud({ body: req.body, user: req.user });
    res.status(201).json({ ok: true, data: result });
  } catch (error) {
    console.error("Error creando solicitud:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function aprobarParcial(req, res) {
  try {
    const { id } = req.params;
    const result = await permisosService.aprobarParcial({ id: Number(id), approver: req.user });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error aprobando parcialmente:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function uploadJustificantes(req, res) {
  try {
    const { id } = req.params;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ ok: false, message: "No se enviaron archivos" });
    }

    // Obtener la solicitud para tener fecha_inicio y drive_folder_id
    const solicitud = await permisosService.getSolicitudById(Number(id));
    if (!solicitud) {
      return res.status(404).json({ ok: false, message: "Solicitud no encontrada" });
    }

    const urls = [];
    for (const file of files) {
      const uploaded = await uploadJustificante({
        user: req.user,
        solicitudId: id,
        fecha_inicio: solicitud.fecha_inicio,
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
        existingFolderId: solicitud.drive_folder_id, // Usar la misma carpeta del acta
      });
      urls.push(uploaded.webViewLink);
    }

    const result = await permisosService.subirJustificantes({ id: Number(id), urls, user: req.user });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error subiendo justificantes:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function aprobarFinal(req, res) {
  try {
    const { id } = req.params;
    const result = await permisosService.aprobarFinal({ id: Number(id), approver: req.user });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error aprobando finalmente:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function rechazar(req, res) {
  try {
    const { id } = req.params;
    const { observaciones } = req.body;
    const result = await permisosService.rechazar({ id: Number(id), approver: req.user, observaciones });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error rechazando:", error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
}

async function listarPendientes(req, res) {
  try {
    const { stage } = req.query;
    const result = await permisosService.listarPendientes({ stage, approver: req.user });
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error listando pendientes:", error);
    res.status(500).json({ ok: false, message: error.message });
  }
}

async function listarMias(req, res) {
  try {
    const result = await permisosService.listarPorUsuario({ user: req.user });
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error listando mis solicitudes:", error);
    res.status(500).json({ ok: false, message: error.message });
  }
}

module.exports = {
  create,
  aprobarParcial,
  uploadJustificantes,
  aprobarFinal,
  rechazar,
  listarPendientes,
  listarMias,
  upload,
};
