const express = require('express');
const router = express.Router();
const ctrl = require('./collaborators.controller');
const { requireRole } = require('../../middlewares/roles');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/stats', requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin', 'comercial']), ctrl.getCollaboratorStats);
router.get('/', requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin', 'comercial']), ctrl.listCollaborators);
router.get('/:id/profile', requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin', 'comercial']), ctrl.getCollaboratorProfile);
router.put('/:id/profile', requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin', 'comercial']), ctrl.updateCollaboratorProfile);
router.post('/:id/documents', requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin', 'comercial']), upload.single('file'), ctrl.uploadCollaboratorDocument);
router.post('/:id/qualification-pending/:legacyId/resolve', requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin']), ctrl.resolveCollaboratorQualificationPending);

module.exports = router;
