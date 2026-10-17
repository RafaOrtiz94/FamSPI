const express = require('express');
const router = express.Router();
const ctrl = require('./hr.controller');
const { verifyToken } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/roles');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const EMPLOYEES_ROUTES = ['/employees'];
const EMPLOYEE_BY_ID_ROUTES = ['/employees/:id'];
const EMPLOYEE_DOCUMENTS_ROUTES = ['/documents/:id'];

router.post(EMPLOYEES_ROUTES, verifyToken, requireRole(['talento_humano', 'gerencia']), ctrl.createEmployee);
router.get(EMPLOYEES_ROUTES, verifyToken, requireRole(['talento_humano', 'gerencia']), ctrl.listEmployees);
router.put(EMPLOYEE_BY_ID_ROUTES, verifyToken, requireRole(['talento_humano', 'gerencia']), ctrl.updateEmployee);
router.post(
  EMPLOYEE_DOCUMENTS_ROUTES,
  verifyToken,
  requireRole(['talento_humano', 'gerencia']),
  upload.single('file'),
  ctrl.uploadDocument
);

module.exports = router;
