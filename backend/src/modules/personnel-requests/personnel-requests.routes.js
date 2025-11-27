/**
 * Personnel Requests Routes
 * Rutas para gestión de solicitudes de personal
 */

const express = require('express');
const router = express.Router();
const personnelRequestsController = require('./personnel-requests.controller');
const { verifyToken } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/roles');

// Todas las rutas requieren autenticación
router.use(verifyToken);

/**
 * @route   POST /api/personnel-requests
 * @desc    Crear nueva solicitud de personal
 * @access  Jefes de área, Gerentes
 */
router.post(
    '/',
    requireRole(['jefe_comercial', 'jefe_servicio', 'jefe_operaciones', 'jefe_finanzas', 'jefe_calidad', 'gerente', 'admin']),
    personnelRequestsController.createRequest
);

/**
 * @route   GET /api/personnel-requests
 * @desc    Obtener lista de solicitudes con filtros
 * @access  Todos los autenticados (filtrado por rol)
 */
router.get(
    '/',
    personnelRequestsController.getRequests
);

/**
 * @route   GET /api/personnel-requests/stats
 * @desc    Obtener estadísticas de solicitudes
 * @access  Talento Humano, Gerencia
 */
router.get(
    '/stats',
    requireRole(['talento_humano', 'gerente', 'admin']),
    personnelRequestsController.getStats
);

/**
 * @route   GET /api/personnel-requests/:id
 * @desc    Obtener solicitud específica por ID
 * @access  Todos los autenticados
 */
router.get(
    '/:id',
    personnelRequestsController.getRequestById
);

/**
 * @route   PATCH /api/personnel-requests/:id/status
 * @desc    Actualizar estado de solicitud
 * @access  Talento Humano, Gerencia
 */
router.patch(
    '/:id/status',
    requireRole(['talento_humano', 'gerente', 'admin']),
    personnelRequestsController.updateRequestStatus
);

/**
 * @route   POST /api/personnel-requests/:id/comments
 * @desc    Agregar comentario a solicitud
 * @access  Todos los autenticados
 */
router.post(
    '/:id/comments',
    personnelRequestsController.addComment
);

module.exports = router;
