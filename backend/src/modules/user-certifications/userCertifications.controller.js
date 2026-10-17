const Joi = require('joi');
const logger = require('../../config/logger');
const service = require('./userCertifications.service');

const certificationSchema = Joi.object({
  title: Joi.string().required().trim().max(255),
  issuer: Joi.string().allow('', null).trim().max(255).optional(),
  issue_date: Joi.date().allow(null).optional(),
  expiry_date: Joi.date().allow(null).optional(),
  credential_type: Joi.string().valid('certification', 'course', 'diploma', 'title', 'other').default('certification').optional(),
  description: Joi.string().allow('', null).trim().max(1000).optional(),
  metadata: Joi.object().optional()
});

const DOSSIER_ROLES_FOR_OTHERS = new Set([
  'talento_humano',
  'jefe_talento_humano',
  'jefe_de_talento_humano',
  'analista_talento_humano',
  'asistente_talento_humano',
  'auxiliar_talento_humano',
  'rh',
  'rrhh',
  'gerencia',
  'gerencia_general',
  'gerente_general',
  'director',
  'gerente',
]);

const normalizeRole = (value) => String(value || '').trim().toLowerCase();
const collectRequesterRoles = (user = {}) => {
  const roles = new Set();
  const registerRole = (value) => {
    const normalized = normalizeRole(value);
    if (normalized) roles.add(normalized);
  };

  registerRole(user.role);
  registerRole(user.role_name);

  if (Array.isArray(user.roles)) {
    user.roles.forEach(registerRole);
  }
  if (Array.isArray(user.scopes)) {
    user.scopes.forEach(registerRole);
  }

  return roles;
};

const parseCertificationPayload = (rawBody = {}) => {
  const nextBody = { ...rawBody };
  if (typeof nextBody.metadata === 'string') {
    try {
      nextBody.metadata = JSON.parse(nextBody.metadata);
    } catch (_error) {
      const err = new Error('Metadata invalida');
      err.status = 400;
      throw err;
    }
  }
  return nextBody;
};

// POST /api/v1/users/me/certifications
const createMyCertification = async (req, res) => {
  try {
    const parsedBody = parseCertificationPayload(req.body);
    const { error, value } = certificationSchema.validate(parsedBody);
    if (error) {
      return res.status(400).json({
        ok: false,
        message: 'Datos inválidos',
        error: error.details[0].message
      });
    }

    const certification = await service.createCertification(req.user.id, value, req.file);

    res.status(201).json({
      ok: true,
      message: 'Certificación creada exitosamente',
      data: certification
    });
  } catch (err) {
    logger.error({ err }, 'Error creando Certificación');

    const status = err.status || 500;
    const message = err.message || 'Error interno del servidor';

    res.status(status).json({
      ok: false,
      message: message
    });
  }
};

// GET /api/v1/users/me/certifications
const getMyCertifications = async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const result = await service.getUserCertifications(req.user.id, includeInactive);

    res.json({
      ok: true,
      message: 'Certificaciones obtenidas exitosamente',
      data: result.certifications,
      summary: result.summary
    });
  } catch (err) {
    logger.error({ err }, 'Error obteniendo certificaciones');

    res.status(500).json({
      ok: false,
      message: 'Error interno del servidor'
    });
  }
};

// GET /api/v1/users/:id/certifications
const getUserCertifications = async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);
    if (isNaN(targetUserId)) {
      return res.status(400).json({
        ok: false,
        message: 'ID de usuario inválido'
      });
    }

    const result = await service.getCertificationsByUserId(
      targetUserId,
      req.user.id,
      req.user.role
    );

    res.json({
      ok: true,
      message: 'Certificaciones obtenidas exitosamente',
      data: result.certifications,
      summary: result.summary
    });
  } catch (err) {
    logger.error({ err }, 'Error obteniendo certificaciones de usuario');

    const status = err.status || 500;
    const message = err.message || 'Error interno del servidor';

    res.status(status).json({
      ok: false,
      message: message
    });
  }
};

// DELETE /api/v1/users/me/certifications/:certId
const deleteMyCertification = async (req, res) => {
  try {
    const certificationId = parseInt(req.params.certId);
    if (isNaN(certificationId)) {
      return res.status(400).json({
        ok: false,
        message: 'ID de Certificación inválido'
      });
    }

    const result = await service.softDeleteCertification(
      certificationId,
      req.user.id,
      req.user.role
    );

    res.json({
      ok: true,
      message: result.message
    });
  } catch (err) {
    logger.error({ err }, 'Error eliminando Certificación');

    const status = err.status || 500;
    const message = err.message || 'Error interno del servidor';

    res.status(status).json({
      ok: false,
      message: message
    });
  }
};

// GET /api/v1/users/:id/certifications/pdf - Generar PDF consolidado (solo roles autorizados)
const generateUserCertificationsPDF = async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);
    if (isNaN(targetUserId)) {
      return res.status(400).json({
        ok: false,
        message: 'ID de usuario inválido'
      });
    }

    const pdfResult = await service.generateConsolidatedCertificationsPDF(
      targetUserId,
      req.user.id,
      req.user.role
    );

    // Enviar PDF como respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.filename}"`);
    res.setHeader('Content-Length', pdfResult.buffer.length);

    res.send(pdfResult.buffer);
  } catch (err) {
    logger.error({ err }, 'Error generando PDF de certificaciones');

    const status = err.status || 500;
    const message = err.message || 'Error interno del servidor';

    res.status(status).json({
      ok: false,
      message: message
    });
  }
};

// GET /api/v1/users/:id/certifications/dossier - Dossier consolidado de certificaciones
const generateUserCertificationsDossier = async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    if (Number.isNaN(targetUserId)) {
      return res.status(400).json({
        ok: false,
        message: 'ID de usuario inválido'
      });
    }

    const requesterUserId = Number.parseInt(req.user?.id, 10);
    const requesterRoles = collectRequesterRoles(req.user);
    const isOwnDossier = requesterUserId === targetUserId;
    const canGenerateForOthers = Array.from(requesterRoles).some((role) => DOSSIER_ROLES_FOR_OTHERS.has(role));

    if (!isOwnDossier && !canGenerateForOthers) {
      return res.status(403).json({
        ok: false,
        message: 'No tienes permisos para generar dossiers de otros usuarios'
      });
    }

    const dossier = await service.generateCertificationsDossier(targetUserId, {
      requesterUserId,
      requesterRole: req.user?.role || req.user?.role_name || null,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${dossier.filename}"`);
    res.setHeader('Content-Length', dossier.buffer.length);
    res.send(dossier.buffer);
  } catch (err) {
    logger.error({ err }, 'Error generando dossier de certificaciones');

    const status = err.status || 500;
    const message = err.message || 'Error interno del servidor';

    res.status(status).json({
      ok: false,
      message
    });
  }
};

// POST /api/v1/users/me/certifications/bulk - Crear múltiples certificaciones
const createMyBulkCertifications = async (req, res) => {
  try {
    console.log(' Bulk upload request received, files:', req.files?.length || 0);

    const bulkData = req.body; // Contains metadata and other form data
    const files = req.files || []; // Array of uploaded files from multer

    const result = await service.createBulkCertifications(req.user.id, bulkData, files);

    res.status(201).json({
      ok: true,
      message: `Bulk upload completado: ${result.created_count} creadas, ${result.failed_count} fallidas`,
      data: result
    });
  } catch (err) {
    logger.error({ err }, 'Error en bulk upload de certificaciones');

    const status = err.status || 500;
    const message = err.message || 'Error interno del servidor';

    res.status(status).json({
      ok: false,
      message: message
    });
  }
};

module.exports = {
  createMyCertification,
  getMyCertifications,
  getUserCertifications,
  deleteMyCertification,
  generateUserCertificationsPDF,
  generateUserCertificationsDossier,
  createMyBulkCertifications
};


