/**
 * Personnel Requests Controller
 * Controlador para endpoints de solicitudes de personal
 */

const personnelRequestsService = require('./personnel-requests.service');
const logger = require('../../config/logger');

/**
 * Crear nueva solicitud de personal
 */
async function createRequest(req, res) {
    try {
        const userId = req.user.id;
        const request = await personnelRequestsService.createPersonnelRequest(req.body, userId);

        res.status(201).json({
            success: true,
            message: 'Solicitud de personal creada exitosamente',
            data: request
        });
    } catch (error) {
        logger.error('Error creando solicitud de personal:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Error al crear solicitud de personal'
        });
    }
}

/**
 * Obtener lista de solicitudes con filtros
 */
async function getRequests(req, res) {
    try {
        const userId = req.user.id;
        const userRole = req.user.role || req.user.role_name;

        const filters = {
            status: req.query.status,
            department_id: req.query.department_id,
            urgency_level: req.query.urgency_level,
            position_type: req.query.position_type,
            page: parseInt(req.query.page) || 1,
            pageSize: parseInt(req.query.pageSize) || 20,
            my_requests: req.query.my_requests === 'true'
        };

        const result = await personnelRequestsService.getPersonnelRequests(filters, userId, userRole);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        logger.error('Error obteniendo solicitudes de personal:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener solicitudes de personal'
        });
    }
}

/**
 * Obtener solicitud específica por ID
 */
async function getRequestById(req, res) {
    try {
        const { id } = req.params;
        const request = await personnelRequestsService.getPersonnelRequestById(id);

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Solicitud no encontrada'
            });
        }

        res.json({
            success: true,
            data: request
        });
    } catch (error) {
        logger.error('Error obteniendo solicitud de personal:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener solicitud de personal'
        });
    }
}

/**
 * Actualizar estado de solicitud
 */
async function updateRequestStatus(req, res) {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const userId = req.user.id;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'El estado es requerido'
            });
        }

        const request = await personnelRequestsService.updatePersonnelRequestStatus(
            id,
            status,
            userId,
            notes,
            req.user?.role
        );

        res.json({
            success: true,
            message: 'Estado actualizado exitosamente',
            data: request
        });
    } catch (error) {
        logger.error('Error actualizando estado de solicitud:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Error al actualizar estado'
        });
    }
}

/**
 * Agregar comentario a solicitud
 */
async function addComment(req, res) {
    try {
        const { id } = req.params;
        const { comment, is_internal } = req.body;
        const userId = req.user.id;

        if (!comment) {
            return res.status(400).json({
                success: false,
                message: 'El comentario es requerido'
            });
        }

        const newComment = await personnelRequestsService.addComment(
            id,
            userId,
            comment,
            is_internal || false
        );

        res.status(201).json({
            success: true,
            message: 'Comentario agregado exitosamente',
            data: newComment
        });
    } catch (error) {
        logger.error('Error agregando comentario:', error);
        res.status(400).json({
            success: false,
            message: 'Error al agregar comentario'
        });
    }
}

/**
 * Obtener estadísticas de solicitudes
 */
async function getStats(req, res) {
    try {
        const departmentId = req.query.department_id;
        const stats = await personnelRequestsService.getPersonnelRequestStats(departmentId);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas'
        });
    }
}

/**
 * Obtener perfil del personal seleccionado
 */
async function getPersonnelProfile(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const result = await personnelRequestsService.getPersonnelProfile(id);
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Error obteniendo perfil de personal:', error);
        res.status(500).json({ success: false, message: 'Error al obtener perfil' });
    }
}

/**
 * Crear/actualizar perfil del personal seleccionado
 */
async function updatePersonnelProfile(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const result = await personnelRequestsService.upsertPersonnelProfile(id, req.body, req.user?.id);
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Error actualizando perfil de personal:', error);
        res.status(500).json({ success: false, message: 'Error al actualizar perfil' });
    }
}

/**
 * Subir documento del personal seleccionado
 */
async function uploadPersonnelDocument(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const { doc_type } = req.body || {};
        const file = req.file;
        if (!doc_type) {
            return res.status(400).json({ success: false, message: 'doc_type requerido' });
        }
        if (!file) {
            return res.status(400).json({ success: false, message: 'archivo requerido' });
        }
        const result = await personnelRequestsService.addPersonnelDocument(id, doc_type, file, req.user?.id);
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Error subiendo documento de personal:', error);
        res.status(500).json({ success: false, message: 'Error al subir documento' });
    }
}


/**
 * Vincular colaborador a solicitud
 */
async function linkCollaborator(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const { collaborator_user_id } = req.body || {};
        const result = await personnelRequestsService.updatePersonnelRequestCollaborator(
            id,
            collaborator_user_id || null,
            req.user?.id
        );
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Error vinculando colaborador:', error);
        res.status(500).json({ success: false, message: 'Error al vincular colaborador' });
    }
}

/**
 * Vincular postulante a solicitud
 */
async function linkApplicant(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const { applicant_id } = req.body || {};
        const result = await personnelRequestsService.linkApplicantToRequest(
            id,
            applicant_id || null,
            req.user?.id
        );
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Error vinculando postulante:', error);
        res.status(500).json({ success: false, message: 'Error al vincular postulante' });
    }
}

/**
 * Contratar postulante y cerrar solicitud
 */
async function hireApplicant(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const result = await personnelRequestsService.hirePersonnelRequest(id, req.user?.id);
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Error contratando postulante:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Error al contratar postulante',
            details: error.details || null,
        });
    }
}

module.exports = {
    createRequest,
    getRequests,
    getRequestById,
    updateRequestStatus,
    addComment,
    getStats,
    getPersonnelProfile,
    updatePersonnelProfile,
    uploadPersonnelDocument,
    linkCollaborator,
    linkApplicant,
    hireApplicant
};
