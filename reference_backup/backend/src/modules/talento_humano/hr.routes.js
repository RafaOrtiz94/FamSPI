const express = require('express');
const router = express.Router();
const ctrl = require('./hr.controller');
const { verifyToken } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/roles');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/api/v1/hr/employees', verifyToken, requireRole(['talento_humano','gerencia']), ctrl.createEmployee);
router.get('/api/v1/hr/employees', verifyToken, requireRole(['talento_humano','gerencia']), ctrl.listEmployees);
router.put('/api/v1/hr/employees/:id', verifyToken, requireRole(['talento_humano','gerencia']), ctrl.updateEmployee);
router.post('/api/v1/hr/documents/:id', verifyToken, requireRole(['talento_humano','gerencia']), upload.single('file'), ctrl.uploadDocument);

module.exports = router;
