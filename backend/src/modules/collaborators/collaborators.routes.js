const express = require('express');
const router = express.Router();
const ctrl = require('./collaborators.controller');
const { requireRole } = require('../../middlewares/roles');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/stats', requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin']), ctrl.getCollaboratorStats);
router.get('/', requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin']), ctrl.listCollaborators);
router.get('/:id/profile', requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin']), ctrl.getCollaboratorProfile);
router.put('/:id/profile', requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin']), ctrl.updateCollaboratorProfile);
router.post('/:id/documents', requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin']), upload.single('file'), ctrl.uploadCollaboratorDocument);

module.exports = router;
