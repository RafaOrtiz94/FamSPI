const service = require('./collaborators.service');

const listCollaborators = async (req, res) => {
  try {
    const filters = {
      search: req.query.search || null,
      department_id: req.query.department_id || null,
      cargo: req.query.cargo || null,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
    };

    const result = await service.listCollaborators(filters);
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('Error listando colaboradores:', err);
    res.status(500).json({ ok: false, message: 'Error listando colaboradores' });
  }
};

const getCollaboratorProfile = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const result = await service.getCollaboratorProfile(userId);
    if (!result) {
      return res.status(404).json({ ok: false, message: 'Colaborador no encontrado' });
    }
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    console.error('Error obteniendo colaborador:', err);
    res.status(500).json({ ok: false, message: 'Error obteniendo colaborador' });
  }
};

const updateCollaboratorProfile = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const actorId = req.user?.id || null;
    const payload = req.body || {};

    const result = await service.upsertCollaboratorProfile(userId, payload, actorId);
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    console.error('Error guardando perfil colaborador:', err);
    res.status(500).json({ ok: false, message: 'Error guardando perfil colaborador' });
  }
};

const uploadCollaboratorDocument = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const actorId = req.user?.id || null;
    const docType = req.body?.docType || req.body?.doc_type;
    const file = req.file;

    if (!docType) {
      return res.status(400).json({ ok: false, message: 'docType es requerido' });
    }

    if (!file) {
      return res.status(400).json({ ok: false, message: 'Archivo requerido' });
    }

    const result = await service.addCollaboratorDocument(userId, docType, file, actorId);
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    console.error('Error subiendo documento colaborador:', err);
    res.status(500).json({ ok: false, message: 'Error subiendo documento' });
  }
};


const getCollaboratorStats = async (req, res) => {
  try {
    const result = await service.getCollaboratorStats();
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    console.error('Error obteniendo estadisticas de colaboradores:', err);
    res.status(500).json({ ok: false, message: 'Error obteniendo estadisticas' });
  }
};

module.exports = {
  listCollaborators,
  getCollaboratorProfile,
  updateCollaboratorProfile,
  uploadCollaboratorDocument,
  getCollaboratorStats,
};
