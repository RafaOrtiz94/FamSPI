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

// POST /api/v1/users/me/certifications
const createMyCertification = async (req, res) => {
  try {
    const { error, value } = certificationSchema.validate(req.body);
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
    logger.error({ err }, 'Error creando certificación');

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
    const certifications = await service.getUserCertifications(req.user.id, includeInactive);

    res.json({
      ok: true,
      message: 'Certificaciones obtenidas exitosamente',
      data: certifications
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

    const certifications = await service.getCertificationsByUserId(
      targetUserId,
      req.user.id,
      req.user.role
    );

    res.json({
      ok: true,
      message: 'Certificaciones obtenidas exitosamente',
      data: certifications
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
        message: 'ID de certificación inválido'
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
    logger.error({ err }, 'Error eliminando certificación');

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

// POST /api/v1/users/me/certifications/bulk - Crear múltiples certificaciones
const createMyBulkCertifications = async (req, res) => {
  try {
    console.log('📦 Bulk upload request received, files:', req.files?.length || 0);

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
  createMyBulkCertifications
};
