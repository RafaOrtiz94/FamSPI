/**
 * Personnel Requests Service
 * Servicio para gestionar solicitudes de personal con perfil profesional
 */

const db = require('../../config/db');
const logger = require('../../config/logger');
const { logAction } = require('../../utils/audit');
const { ensureFolder } = require('../../utils/drive');
const { sendMail } = require('../../utils/mailer');
const notificationManager = require('../notifications/notificationManager');
const gmailService = require('../../services/gmail.service');

const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID;
const HR_NOTIFICATION_EMAILS = process.env.HR_NOTIFICATION_EMAILS?.split(',').map(e => e.trim()) || [];

/**
 * Crear una nueva solicitud de personal
 */
async function createPersonnelRequest(data, userId) {
    const {
        position_title,
        position_type,
        quantity = 1,
        start_date,
        end_date,
        education_level,
        career_field,
        years_experience,
        specific_skills,
        technical_knowledge,
        soft_skills,
        certifications,
        languages,
        main_responsibilities,
        specific_functions,
        reports_to,
        supervises,
        work_schedule,
        salary_range,
        benefits,
        work_location,
        justification,
        urgency_level = 'normal',
        priority = 3,
    } = data;

    // Validaciones básicas
    if (!position_title || !position_type || !education_level || !main_responsibilities || !justification) {
        throw new Error('Faltan campos obligatorios');
    }

    // Obtener información del usuario solicitante
    const userQuery = await db.query(
        'SELECT id, email, fullname, department_id FROM users WHERE id = $1',
        [userId]
    );

    if (userQuery.rows.length === 0) {
        throw new Error('Usuario no encontrado');
    }

    const user = userQuery.rows[0];

    // Crear carpeta en Drive para la solicitud
    let driveFolderId = null;
    try {
        const folderName = `Solicitud Personal - ${position_title} - ${new Date().toISOString().split('T')[0]}`;
        const folder = await ensureFolder(folderName, DRIVE_ROOT_FOLDER_ID);
        driveFolderId = folder.id;
    } catch (error) {
        logger.warn('No se pudo crear carpeta en Drive:', error.message);
    }

    // Insertar solicitud
    const insertQuery = `
    INSERT INTO personnel_requests (
      requester_id,
      department_id,
      position_title,
      position_type,
      quantity,
      start_date,
      end_date,
      education_level,
      career_field,
      years_experience,
      specific_skills,
      technical_knowledge,
      soft_skills,
      certifications,
      languages,
      main_responsibilities,
      specific_functions,
      reports_to,
      supervises,
      work_schedule,
      salary_range,
      benefits,
      work_location,
      justification,
      urgency_level,
      priority,
      drive_folder_id,
      status
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, 'pendiente'
    ) RETURNING *
  `;

    const values = [
        userId,
        user.department_id,
        position_title,
        position_type,
        quantity,
        start_date || null,
        end_date || null,
        education_level,
        career_field || null,
        years_experience || null,
        specific_skills || null,
        technical_knowledge || null,
        soft_skills || null,
        certifications || null,
        languages || null,
        main_responsibilities,
        specific_functions || null,
        reports_to || null,
        supervises || null,
        work_schedule || null,
        salary_range || null,
        benefits || null,
        work_location || null,
        justification,
        urgency_level,
        priority,
        driveFolderId,
    ];

    const result = await db.query(insertQuery, values);
    const request = result.rows[0];

    // Registrar en auditoría
    await logAction({
        user_id: userId,
        module: 'personnel_requests',
        action: 'create',
        entity: 'personnel_requests',
        entity_id: request.id,
        details: { position_title, position_type, urgency_level }
    });

    // Notificar a Talento Humano
    await notifyHRNewRequest(request, user);

    return request;
}

/**
 * Obtener solicitudes de personal con filtros
 */
async function getPersonnelRequests(filters = {}, userId = null, userRole = null) {
    const {
        status,
        department_id,
        urgency_level,
        position_type,
        page = 1,
        pageSize = 20,
        my_requests = false
    } = filters;

    let whereConditions = ['1=1'];
    let params = [];
    let paramIndex = 1;

    // Si el usuario solicita solo sus solicitudes
    if (my_requests && userId) {
        whereConditions.push(`pr.requester_id = $${paramIndex++}`);
        params.push(userId);
    }

    if (status) {
        whereConditions.push(`pr.status = $${paramIndex++}`);
        params.push(status);
    }

    if (department_id) {
        whereConditions.push(`pr.department_id = $${paramIndex++}`);
        params.push(department_id);
    }

    if (urgency_level) {
        whereConditions.push(`pr.urgency_level = $${paramIndex++}`);
        params.push(urgency_level);
    }

    if (position_type) {
        whereConditions.push(`pr.position_type = $${paramIndex++}`);
        params.push(position_type);
    }

    const offset = (page - 1) * pageSize;

    const query = `
    SELECT 
      pr.*,
      u.fullname as requester_name,
      u.email as requester_email,
      d.name as department_name,
      d.code as department_code
    FROM personnel_requests pr
    LEFT JOIN users u ON pr.requester_id = u.id
    LEFT JOIN departments d ON pr.department_id = d.id
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY 
      CASE pr.urgency_level
        WHEN 'urgente' THEN 1
        WHEN 'alta' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'baja' THEN 4
      END,
      pr.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

    params.push(pageSize, offset);

    const result = await db.query(query, params);

    // Contar total
    const countQuery = `
    SELECT COUNT(*) as total
    FROM personnel_requests pr
    WHERE ${whereConditions.join(' AND ')}
  `;
    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total, 10);

    return {
        data: result.rows,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    };
}

/**
 * Obtener una solicitud específica por ID
 */
async function getPersonnelRequestById(id) {
    const query = `
    SELECT 
      pr.*,
      u.fullname as requester_name,
      u.email as requester_email,
      d.name as department_name,
      d.code as department_code,
      am.fullname as approved_by_manager_name,
      ah.fullname as approved_by_hr_name,
      af.fullname as approved_by_finance_name
    FROM personnel_requests pr
    LEFT JOIN users u ON pr.requester_id = u.id
    LEFT JOIN departments d ON pr.department_id = d.id
    LEFT JOIN users am ON pr.approved_by_manager = am.id
    LEFT JOIN users ah ON pr.approved_by_hr = ah.id
    LEFT JOIN users af ON pr.approved_by_finance = af.id
    WHERE pr.id = $1
  `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
        return null;
    }

    const request = result.rows[0];

    // Obtener historial
    const historyQuery = `
    SELECT 
      prh.*,
      u.fullname as changed_by_name
    FROM personnel_request_history prh
    LEFT JOIN users u ON prh.changed_by = u.id
    WHERE prh.personnel_request_id = $1
    ORDER BY prh.created_at DESC
  `;
    const historyResult = await db.query(historyQuery, [id]);

    // Obtener comentarios
    const commentsQuery = `
    SELECT 
      prc.*,
      u.fullname as user_name,
      u.email as user_email
    FROM personnel_request_comments prc
    LEFT JOIN users u ON prc.user_id = u.id
    WHERE prc.personnel_request_id = $1
    ORDER BY prc.created_at DESC
  `;
    const commentsResult = await db.query(commentsQuery, [id]);

    return {
        ...request,
        history: historyResult.rows,
        comments: commentsResult.rows
    };
}

/**
 * Actualizar estado de solicitud
 */
async function updatePersonnelRequestStatus(id, status, userId, notes = null) {
    const validStatuses = ['pendiente', 'en_revision', 'aprobada', 'rechazada', 'en_proceso', 'completada', 'cancelada'];

    if (!validStatuses.includes(status)) {
        throw new Error(`Estado inválido: ${status}`);
    }

    const updateFields = ['status = $1', 'updated_at = NOW()'];
    const params = [status];
    let paramIndex = 2;

    // Agregar campos específicos según el estado
    if (status === 'aprobada') {
        updateFields.push(`approved_by_hr = $${paramIndex++}`);
        updateFields.push(`hr_approval_date = NOW()`);
        params.push(userId);
    }

    if (status === 'rechazada' && notes) {
        updateFields.push(`rejection_reason = $${paramIndex++}`);
        params.push(notes);
    }

    if (status === 'completada') {
        updateFields.push(`completed_at = NOW()`);
    }

    if (notes) {
        updateFields.push(`hr_notes = $${paramIndex++}`);
        params.push(notes);
    }

    params.push(id);

    const query = `
    UPDATE personnel_requests
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
        throw new Error('Solicitud no encontrada');
    }

    // Registrar en auditoría
    await logAction({
        user_id: userId,
        module: 'personnel_requests',
        action: 'update_status',
        entity: 'personnel_requests',
        entity_id: id,
        details: { new_status: status, notes }
    });

    return result.rows[0];
}

/**
 * Agregar comentario a una solicitud
 */
async function addComment(requestId, userId, comment, isInternal = false) {
    const query = `
    INSERT INTO personnel_request_comments (
      personnel_request_id,
      user_id,
      comment,
      is_internal
    ) VALUES ($1, $2, $3, $4)
    RETURNING *
  `;

    const result = await db.query(query, [requestId, userId, comment, isInternal]);

    await logAction({
        user_id: userId,
        module: 'personnel_requests',
        action: 'add_comment',
        entity: 'personnel_requests',
        entity_id: requestId
    });

    return result.rows[0];
}

/**
 * Notificar a Talento Humano sobre nueva solicitud
 */
async function notifyHRNewRequest(request, requester) {
    const subject = `Nueva Solicitud de Personal: ${request.position_title}`;
    const html = `
    <h2>Nueva Solicitud de Personal</h2>
    <p><strong>Solicitante:</strong> ${requester.fullname || requester.email}</p>
    <p><strong>Puesto:</strong> ${request.position_title}</p>
    <p><strong>Tipo:</strong> ${request.position_type}</p>
    <p><strong>Cantidad:</strong> ${request.quantity}</p>
    <p><strong>Urgencia:</strong> ${request.urgency_level}</p>
    <p><strong>Justificación:</strong></p>
    <p>${request.justification}</p>
    <hr>
    <p>Accede al sistema para revisar los detalles completos del perfil profesional.</p>
  `;

    // Notificar con NotificationManager (maneja email y posibles fallos)
    if (HR_NOTIFICATION_EMAILS.length > 0) {
        await notificationManager.sendNotification({
            template: 'custom_html',
            data: {
                title: subject,
                message: html
            },
            to: HR_NOTIFICATION_EMAILS,
            sender: {
                from: requester.email,
                replyTo: requester.email,
                gmailUserId: requester.id,
                name: requester.fullname || requester.email
            },
            skipSave: true
        });
    }
}

/**
 * Obtener estadísticas de solicitudes de personal
 */
async function getPersonnelRequestStats(departmentId = null) {
    let whereClause = '1=1';
    const params = [];

    if (departmentId) {
        whereClause = 'department_id = $1';
        params.push(departmentId);
    }

    const query = `
    SELECT 
      COUNT(*) FILTER (WHERE status = 'pendiente') as pendientes,
      COUNT(*) FILTER (WHERE status = 'en_revision') as en_revision,
      COUNT(*) FILTER (WHERE status = 'aprobada') as aprobadas,
      COUNT(*) FILTER (WHERE status = 'rechazada') as rechazadas,
      COUNT(*) FILTER (WHERE status = 'en_proceso') as en_proceso,
      COUNT(*) FILTER (WHERE status = 'completada') as completadas,
      COUNT(*) FILTER (WHERE urgency_level = 'urgente') as urgentes,
      COUNT(*) as total
    FROM personnel_requests
    WHERE ${whereClause}
  `;

    const result = await db.query(query, params);
    return result.rows[0];
}

module.exports = {
    createPersonnelRequest,
    getPersonnelRequests,
    getPersonnelRequestById,
    updatePersonnelRequestStatus,
    addComment,
    getPersonnelRequestStats
};
