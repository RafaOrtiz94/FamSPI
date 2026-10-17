// Archivo: ./modules/operaciones/operaciones.routes.js

const express = require('express');
const router = express.Router();
const controller = require('../requests/requests.controller');
const { verifyToken, isOperaciones } = require('../auth/auth.middleware');

// Rutas para el rol de Operaciones
router.post('/:id/complete', verifyToken, isOperaciones, controller.completeRequest);

module.exports = router;