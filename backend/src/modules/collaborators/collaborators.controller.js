const service = require('./collaborators.service');
const consolidatedService = require('./collaboratorsConsolidated.service');

const listCollaborators = async (req, res) => {
  try {
    const filters = {
      search: req.query.search || null,
      department_id: req.query.department_id || null,
      cargo: req.query.cargo || null,
      employment_status: req.query.employment_status || null,
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

const resolveCollaboratorQualificationPending = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const legacyId = Number(req.params.legacyId);
    const actorId = req.user?.id || null;
    const payload = req.body || {};

    const result = await service.resolvePendingLegacyQualification(
      userId,
      legacyId,
      payload,
      actorId,
    );

    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    console.error('Error resolviendo pendiente legacy de credencial:', err);
    const status = Number(err?.status || 500);
    res.status(status).json({
      ok: false,
      message: err?.message || 'Error resolviendo pendiente legacy',
    });
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

const getDocumentsReport = async (req, res) => {
  try {
    const filters = {
      doc_type: req.query.doc_type || null,
      search: req.query.search || null,
    };
    const result = await service.getDocumentsReport(filters);
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    console.error('Error generando reporte de documentacion:', err);
    res.status(500).json({ ok: false, message: 'Error generando reporte de documentacion' });
  }
};

const generateDocumentsConsolidated = async (req, res) => {
  try {
    const result = await consolidatedService.generateConsolidatedDocuments({
      userIds: req.body?.user_ids || req.body?.userIds || [],
      documentKeys: req.body?.document_keys || req.body?.documentKeys || [],
    });

    res.status(200);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length);
    return res.send(result.buffer);
  } catch (err) {
    console.error('Error generando consolidado de documentacion:', err);
    const status = Number(err?.status || 500);
    return res.status(status).json({
      ok: false,
      message: err?.message || 'Error generando consolidado de documentacion',
      details: err?.details || undefined,
    });
  }
};

module.exports = {
  listCollaborators,
  getCollaboratorProfile,
  updateCollaboratorProfile,
  uploadCollaboratorDocument,
  resolveCollaboratorQualificationPending,
  getCollaboratorStats,
  getDocumentsReport,
  generateDocumentsConsolidated,
};
