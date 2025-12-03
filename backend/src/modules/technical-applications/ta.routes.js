const express = require('express');
const router = express.Router();
const taController = require('./ta.controller');
const { verifyToken } = require('../../middlewares/authMiddleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Obtener tipos de documentos disponibles según rol
router.get('/available', taController.getAvailableDocuments);

// Crear nuevo documento
router.post('/documents', taController.createDocument);

// Obtener historial de documentos
router.get('/documents', taController.getDocumentHistory);

// Obtener documento específico por ID
router.get('/documents/:id', taController.getDocumentById);

module.exports = router;
