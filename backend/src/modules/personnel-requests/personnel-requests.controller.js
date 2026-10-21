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
            q: req.query.q || req.query.search || null,
            stalled_only: req.query.stalled_only === 'true' || req.query.stalled === 'true' || req.query.stagnant === 'true',
            sort_by: req.query.sort_by || null,
            sort_dir: req.query.sort_dir || null,
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
        const request = await personnelRequestsService.getPersonnelRequestById(
            id,
            req.user?.id,
            req.user?.role || req.user?.role_name || null
        );

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

async function getRequestWorkspace(req, res) {
    try {
        const { id } = req.params;
        const filters = {
            search: req.query.search || req.query.q || '',
            page: parseInt(req.query.page, 10) || 1,
            pageSize: parseInt(req.query.pageSize, 10) || 25,
        };
        const workspace = await personnelRequestsService.getPersonnelRequestWorkspace(
            id,
            filters,
            req.user?.id,
            req.user?.role || req.user?.role_name || null
        );

        res.json({
            success: true,
            data: workspace
        });
    } catch (error) {
        logger.error('Error obteniendo workspace de solicitud de personal:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error al obtener workspace de solicitud'
        });
    }
}

async function getRequestApplicants(req, res) {
    try {
        const { id } = req.params;
        const filters = {
            search: req.query.search || req.query.q || '',
            page: parseInt(req.query.page, 10) || 1,
            pageSize: parseInt(req.query.pageSize, 10) || 25,
        };
        const result = await personnelRequestsService.getPersonnelRequestApplicants(
            id,
            filters,
            req.user?.id,
            req.user?.role || req.user?.role_name || null
        );

        res.json({
            success: true,
            data: result.data,
            pagination: result.pagination,
            request_id: result.request_id,
            request_position_title: result.request_position_title,
            linked_applicant_id: result.linked_applicant_id,
        });
    } catch (error) {
        logger.error('Error obteniendo postulantes de solicitud:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error al obtener postulantes de la solicitud'
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
            message: error.message || 'Error al actualizar estado',
            details: error.details || null,
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
        const userRole = req.user?.role || req.user?.role_name || req.user?.rol || null;

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
            is_internal || false,
            userRole
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
        const isValidationError = error?.code === 'PROFILE_VALIDATION_ERROR';
        res.status(isValidationError ? 400 : 500).json({
            success: false,
            message: error?.message || 'Error al actualizar perfil',
            details: error?.details || null,
        });
    }
}

/**
 * Subir documento del personal seleccionado
 */
async function uploadPersonnelDocument(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const { doc_type, docType } = req.body || {};
        const resolvedDocType = doc_type || docType;
        const file = req.file;
        if (!resolvedDocType) {
            return res.status(400).json({ success: false, message: 'doc_type o docType requerido' });
        }
        if (!file) {
            return res.status(400).json({ success: false, message: 'archivo requerido' });
        }
        const result = await personnelRequestsService.addPersonnelDocument(id, resolvedDocType, file, req.user?.id);
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

async function linkRequester(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const { requester_id } = req.body || {};
        const result = await personnelRequestsService.updatePersonnelRequestRequester(
            id,
            requester_id,
            req.user?.id
        );
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Error reasignando solicitante:', error);
        const statusCode = error?.statusCode || 400;
        res.status(statusCode).json({ success: false, message: error.message || 'Error al reasignar solicitante' });
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
    getRequestWorkspace,
    getRequestApplicants,
    updateRequestStatus,
    addComment,
    getStats,
    getPersonnelProfile,
    updatePersonnelProfile,
    uploadPersonnelDocument,
    linkCollaborator,
    linkRequester,
    linkApplicant,
    hireApplicant
};


