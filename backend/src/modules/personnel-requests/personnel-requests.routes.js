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
    requireRole([
        'jefe_comercial',
        'jefe_servicio_tecnico',
        'jefe_tecnico',
        'jefe_operaciones',
        'jefe_finanzas',
        'jefe_calidad',
        'gerencia',
        'admin',
        'talento_humano',
        'jefe_talento_humano',
        'gerencia_general',
    ]),
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
    requireRole(['talento_humano', 'gerencia', 'admin']),
    personnelRequestsController.getStats
);

router.get(
    '/:id/workspace',
    requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin']),
    personnelRequestsController.getRequestWorkspace
);

router.get(
    '/:id/applicants',
    requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin']),
    personnelRequestsController.getRequestApplicants
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
 * @route   PATCH /api/personnel-requests/:id/collaborator
 * @route   PATCH /api/personnel-requests/:id/status
 * @desc    Actualizar estado de solicitud
 * @access  Talento Humano, Gerencia
 */
router.patch(
    '/:id/collaborator',
    requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin']),
    personnelRequestsController.linkCollaborator
);

router.patch(
    '/:id/applicant',
    requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin']),
    personnelRequestsController.linkApplicant
);

router.patch(
    '/:id/status',
    requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin']),
    personnelRequestsController.updateRequestStatus
);

/**
 * @route   POST /api/personnel-requests/:id/hire
 * @desc    Contratar postulante y cerrar solicitud
 * @access  Talento Humano, Gerencia General
 */
router.post(
    '/:id/hire',
    requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin']),
    personnelRequestsController.hireApplicant
);

/**
 * @route   GET /api/personnel-requests/:id/profile
 * @desc    Obtener perfil del personal seleccionado
 * @access  Talento Humano, Gerencia General
 */
router.get(
    '/:id/profile',
    requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin']),
    personnelRequestsController.getPersonnelProfile
);

/**
 * @route   PUT /api/personnel-requests/:id/profile
 * @desc    Crear/actualizar perfil del personal seleccionado
 * @access  Talento Humano, Gerencia General
 */
router.put(
    '/:id/profile',
    requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin']),
    personnelRequestsController.updatePersonnelProfile
);

/**
 * @route   POST /api/personnel-requests/:id/documents
 * @desc    Subir documentos del personal seleccionado
 * @access  Talento Humano, Gerencia General
 */
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
router.post(
    '/:id/documents',
    requireRole(['talento_humano', 'gerencia', 'gerencia_general', 'admin']),
    upload.single('file'),
    personnelRequestsController.uploadPersonnelDocument
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

