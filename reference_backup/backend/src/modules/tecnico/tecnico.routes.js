// Archivo: ./modules/tecnico/tecnico.routes.js

const express = require('express');
const router = express.Router();
const controller = require('../requests/requests.controller'); // Usas el MISMO controlador
const { verifyToken, isTecnico } = require('../auth/auth.middleware'); // Middleware específico

// Rutas para el rol de Servicio Técnico
router.post('/:id/approve', verifyToken, isTecnico, controller.approveRequest);
router.post('/:id/reject', verifyToken, isTecnico, controller.rejectRequest);

// Probablemente también necesiten una ruta para ver todas las solicitudes pendientes para ellos
router.get('/pending-approval', verifyToken, isTecnico, controller.listPendingApproval);

module.exports = router;