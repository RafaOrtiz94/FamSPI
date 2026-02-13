const express = require('express');
const router = express.Router();
const ctrl = require('./userCertifications.controller');
const { verifyToken } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/roles');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Todas las rutas requieren autenticación
router.use(verifyToken);

// POST /api/v1/users/me/certifications - Crear certificación propia (con archivo opcional)
router.post('/me/certifications', upload.single('file'), ctrl.createMyCertification);

// POST /api/v1/users/me/certifications/bulk - Crear múltiples certificaciones (con archivos múltiples)
router.post('/me/certifications/bulk', upload.array('files', 10), ctrl.createMyBulkCertifications);

// GET /api/v1/users/me/certifications - Obtener mis certificaciones
router.get('/me/certifications', ctrl.getMyCertifications);

// GET /api/v1/users/:id/certifications - Ver certificaciones de otro usuario (solo roles autorizados)
router.get('/:id/certifications', requireRole(['acp_comercial', 'talento_humano', 'gerencia', 'gerencia_general']), ctrl.getUserCertifications);

// DELETE /api/v1/users/me/certifications/:certId - Eliminar mi certificación (soft delete)
router.delete('/me/certifications/:certId', ctrl.deleteMyCertification);

// GET /api/v1/users/:id/certifications/pdf - Generar PDF consolidado (solo roles autorizados)
router.get('/:id/certifications/pdf', requireRole(['acp_comercial', 'talento_humano', 'gerencia', 'gerencia_general']), ctrl.generateUserCertificationsPDF);

module.exports = router;
