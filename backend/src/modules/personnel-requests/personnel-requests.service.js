/**
 * Personnel Requests Service
 * Servicio para gestionar solicitudes de personal con perfil profesional
 */

const db = require('../../config/db');
const logger = require('../../config/logger');
const { logAction } = require('../../utils/audit');
const { ensureFolder, uploadBase64File } = require('../../utils/drive');
const { ensureApplicantsTables, getApplicantById } = require('../applicants/applicants.service');
const { sendMail } = require('../../utils/mailer');
const gmailService = require('../../services/gmail.service');
const notificationManager = require('../notifications/notificationManager');

const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID;
const HR_NOTIFICATION_EMAILS = process.env.HR_NOTIFICATION_EMAILS?.split(',').map(e => e.trim()) || [];

async function getSingleUserByRole(role) {
    if (!role) return null;
    try {
        const { rows } = await db.query(
            'SELECT id, email, fullname, name, role FROM users WHERE LOWER(role) = LOWER($1) ORDER BY id ASC LIMIT 1',
            [role]
        );
        return rows[0] || null;
    } catch (error) {
        logger.warn({ error, role }, 'No se pudo obtener usuario por rol');
        return null;
    }
}

async function getUserById(userId) {
    if (!userId) return null;
    try {
        const { rows } = await db.query(
            'SELECT id, email, fullname, name, role FROM users WHERE id = $1 LIMIT 1',
            [userId]
        );
        return rows[0] || null;
    } catch (error) {
        logger.warn({ error, userId }, 'No se pudo obtener usuario por id');
        return null;
    }
}

function uniqueRecipients(...emails) {
    const recipients = emails.flat().filter(Boolean);
    return [...new Set(recipients.map((e) => e.trim().toLowerCase()))];
}

async function notifyUsers({ users = [], subject, html, text, notification, sendEmail = true }) {
    if (sendEmail) {
        const recipients = uniqueRecipients(
            users.map((u) => u?.email).filter(Boolean)
        );
        if (recipients.length) {
            try {
                await sendMail({
                    to: recipients,
                    subject,
                    html,
                    text
                });
            } catch (error) {
                logger.warn({ error }, 'No se pudo enviar correo de notificacion de personal');
            }
        }
    }
    if (notification) {
        await Promise.all(
            users
                .filter((u) => u?.id)
                .map((u) =>
                    notificationManager.sendNotification({
                        userId: u.id,
                        customTitle: notification.title,
                        customMessage: notification.message,
                        type: notification.type || 'info',
                        source: notification.source || 'personnel_requests',
                        priority: notification.priority || 0,
                        email: false,
                        meta: notification.meta || {}
                    })
                )
        );
    }
}

async function ensurePersonnelProfileTables() {
    await db.query(`
    CREATE TABLE IF NOT EXISTS personnel_request_profiles (
      id SERIAL PRIMARY KEY,
      personnel_request_id INTEGER UNIQUE REFERENCES personnel_requests(id) ON DELETE CASCADE,
      profile JSONB DEFAULT '{}'::jsonb,
      updated_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

    await db.query(`
    ALTER TABLE personnel_requests
    ADD COLUMN IF NOT EXISTS applicant_id INTEGER REFERENCES applicants(id);
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS personnel_request_documents (
      id SERIAL PRIMARY KEY,
      personnel_request_id INTEGER REFERENCES personnel_requests(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL,
      drive_file_id TEXT,
      drive_url TEXT,
      file_name TEXT,
      mime_type TEXT,
      uploaded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

async function ensureCollaboratorTables() {
    await db.query(`
    CREATE TABLE IF NOT EXISTS collaborator_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      profile JSONB DEFAULT '{}'::jsonb,
      updated_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

    await db.query(`
    ALTER TABLE personnel_requests
    ADD COLUMN IF NOT EXISTS collaborator_user_id INTEGER REFERENCES users(id);
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS collaborator_documents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL,
      drive_file_id TEXT,
      drive_url TEXT,
      file_name TEXT,
      mime_type TEXT,
      uploaded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

const REQUIRED_PROFILE_FIELDS = [
  'personal.nombres',
  'personal.apellidos',
  'personal.cedula',
  'personal.tipo_sangre',
  'personal.genero',
  'personal.cuenta_bancaria',
  'personal.lugar_nacimiento',
  'personal.fecha_nacimiento',
  'personal.edad',
  'personal.estado_civil',
  'personal.telefono_personal',
  'personal.email_personal',
  'personal.peso',
  'personal.estatura',
  'laboral.estatus_empleado',
  'laboral.residencia',
  'laboral.fecha_ingreso',
  'laboral.fecha_ingreso_iess',
  'laboral.tipo_contrato',
  'laboral.cargo',
  'laboral.area',
  'laboral.seniority',
  'laboral.telefono_celular_famproject',
  'laboral.email_famproject',
  'laboral.fecha_modificacion_cargo',
  'laboral.nuevo_cargo',
  'laboral.fecha_salida',
  'laboral.fecha_salida_iess',
  'laboral.motivo_salida',
  'laboral.observaciones_salida',
  'familiar.nombre_conyuge',
  'familiar.cedula_conyuge',
  'familiar.nombre_primer_hijo',
  'familiar.cedula_primer_hijo',
  'familiar.fecha_nacimiento_primer_hijo',
  'familiar.nombre_segundo_hijo',
  'familiar.cedula_segundo_hijo',
  'familiar.fecha_nacimiento_segundo_hijo',
  'domicilio.ciudad_domicilio',
  'domicilio.direccion_domicilio',
  'domicilio.ruta_trabajo',
  'domicilio.telefono_fijo',
  'emergencia.persona_contacto',
  'emergencia.telefono_contacto',
  'estudios.nivel_instruccion',
  'estudios.titulo_tercer_nivel',
  'estudios.universidad_tercer_nivel',
  'estudios.titulo_cuarto_nivel',
  'estudios.universidad_cuarto_nivel',
];

const REQUIRED_DOC_TYPES = [
  'CEDULA_COLOR',
  'PASAPORTE_NOTARIADO',
  'CERTIFICADO_VOTACION_COLOR',
  'SERVICIO_BASICO',
  'CERTIFICADO_SALUD',
  'CARNET_TIPO_SANGRE',
  'ACTA_MATRIMONIO',
  'CERTIFICADO_NACIMIENTO_HIJOS',
  'FOTO_CARNET',
  'TITULOS_CURSOS',
  'CERTIFICADO_TRABAJO_ANTERIOR',
  'HISTORIAL_IESS',
  'CRONOGRAMA_INDUCCION',
  'AUTORIZACION_DESCUENTOS',
  'ACTA_BIENES',
  'CONTRATO_TRABAJO',
  'CONVENIO_CONFIDENCIALIDAD',
  'COMPROMISO_NO_DISCRIMINACION',
  'INGRESO_IESS',
  'REGISTRO_BALANCE_SOCIAL',
  'FORMATO_DECIMOS',
  'REGISTRO_FIRMAS',
  'OFERTA_SALARIO',
];

const PROFILE_PATHS = REQUIRED_PROFILE_FIELDS.map((field) => field.split('.'));

const getProfileValue = (profile, path) => {
  return path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), profile);
};

const isNAValue = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'n/a' || normalized === 'na' || normalized === 'no aplica';
};

const isFieldFilled = (value) =>
  value !== null && value !== undefined && String(value).trim() !== '' && !isNAValue(value);

const computeProfileCompletion = (profile = {}) => {
  let done = 0;
  PROFILE_PATHS.forEach((path) => {
    const value = getProfileValue(profile, path);
    if (isFieldFilled(value) || isNAValue(value)) done += 1;
  });
  const total = PROFILE_PATHS.length;
  return { total, done, complete: total > 0 && done === total };
};

const computeDocumentsCompletion = (docTypes = []) => {
  const uploaded = new Set(docTypes);
  const done = REQUIRED_DOC_TYPES.filter((doc) => uploaded.has(doc)).length;
  const total = REQUIRED_DOC_TYPES.length;
  return { total, done, complete: total > 0 && done === total };
};



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

    // Notificar a Talento Humano + Gerencia (usuarios especificos)
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
    if (request.status === 'completada') {
        return null;
    }

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
async function updatePersonnelRequestStatus(id, status, userId, notes = null, userRole = null) {
    const validStatuses = ['pendiente', 'en_revision', 'aprobada', 'rechazada', 'en_proceso', 'completada', 'cancelada'];

    if (!validStatuses.includes(status)) {
        throw new Error(`Estado inválido: ${status}`);
    }

    const updateFields = ['status = $1', 'updated_at = NOW()'];
    const params = [status];
    let paramIndex = 2;
    const role = (userRole || '').toLowerCase();
    const isManager = ['gerencia_general', 'gerente', 'gerencia', 'admin'].includes(role);
    const isHr = ['talento_humano'].includes(role);

    // Agregar campos específicos según el estado
    if (status === 'aprobada') {
        if (isManager) {
            updateFields.push(`approved_by_manager = $${paramIndex++}`);
            updateFields.push(`manager_approval_date = NOW()`);
            params.push(userId);
        } else {
            updateFields.push(`approved_by_hr = $${paramIndex++}`);
            updateFields.push(`hr_approval_date = NOW()`);
            params.push(userId);
        }
    }

    if (status === 'rechazada' && notes) {
        updateFields.push(`rejection_reason = $${paramIndex++}`);
        params.push(notes);
    }

    if (status === 'completada') {
        updateFields.push(`completed_at = NOW()`);
    }

    if (notes) {
        if (isManager) {
            updateFields.push(`manager_notes = $${paramIndex++}`);
        } else if (isHr) {
            updateFields.push(`hr_notes = $${paramIndex++}`);
        } else {
            updateFields.push(`hr_notes = $${paramIndex++}`);
        }
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

    try {
        const updated = result.rows[0];
        const requesterUser = await getUserById(updated.requester_id);
        const hrUser = await getSingleUserByRole('talento_humano');
        const managerUser = await getSingleUserByRole('gerencia_general');
        const usersToNotify = [requesterUser, hrUser, managerUser].filter(Boolean);
        const statusLabel = status.replace('_', ' ');
        const subject = `Solicitud de personal #${id} ${statusLabel}`;
        const html = `
          <h2>Solicitud de personal ${statusLabel}</h2>
          <p><strong>Puesto:</strong> ${updated.position_title}</p>
          <p><strong>Estado:</strong> ${statusLabel}</p>
          ${notes ? `<p><strong>Notas:</strong> ${notes}</p>` : ''}
        `;

        await notifyUsers({
            users: usersToNotify,
            subject,
            html,
            text: `Solicitud #${id} - ${updated.position_title} (${statusLabel})`,
            notification: {
                title: `Solicitud ${statusLabel}`,
                message: `Solicitud #${id} (${updated.position_title}) ahora está ${statusLabel}.`,
                type: status === 'rechazada' ? 'alert' : 'info',
                priority: status === 'rechazada' ? 2 : 0,
                source: 'personnel_requests',
                meta: { request_id: id, status }
            }
        });
    } catch (notifyErr) {
        logger.warn({ notifyErr, requestId: id }, 'Error enviando notificaciones de solicitud de personal');
    }

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
    const hrUser = await getSingleUserByRole('talento_humano');
    const managerUser = await getSingleUserByRole('gerencia_general');
    const requesterUser = await getUserById(requester?.id);
    const processUsers = [hrUser, managerUser, requesterUser].filter(Boolean);

    // Intentar enviar con Gmail API al grupo, si falla usar SMTP
    try {
        const gmailRecipients = uniqueRecipients(
            processUsers.map((u) => u?.email),
            HR_NOTIFICATION_EMAILS
        );
        for (const email of gmailRecipients) {
            await gmailService.sendEmail({
                userId: requester.id,
                to: email,
                subject,
                html,
                replyTo: requester.email
            });
        }
    } catch (error) {
        logger.warn('Error enviando notificación con Gmail API, usando SMTP:', error.message);
        const smtpRecipients = uniqueRecipients(
            processUsers.map((u) => u?.email),
            HR_NOTIFICATION_EMAILS
        );
        if (smtpRecipients.length) {
            await sendMail({
                to: smtpRecipients.join(','),
                subject,
                html,
                senderName: requester.fullname || requester.email,
                replyTo: requester.email
            });
        }
    }

    await notifyUsers({
        users: processUsers,
        subject,
        html,
        text: `Nueva solicitud de personal (#${request.id}) - ${request.position_title}`,
        sendEmail: false,
        notification: {
            title: 'Nueva solicitud de personal',
            message: `Solicitud #${request.id} para ${request.position_title}.`,
            type: 'task',
            priority: 1,
            source: 'personnel_requests',
            meta: {
                request_id: request.id,
                status: request.status
            }
        }
    });
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

async function getPersonnelProfile(requestId) {
    await ensurePersonnelProfileTables();
    await ensureCollaboratorTables();

    const requestQuery = await db.query(
        'SELECT id, status, drive_folder_id, collaborator_user_id FROM personnel_requests WHERE id = $1',
        [requestId]
    );
    if (requestQuery.rows.length === 0) {
        throw new Error('Solicitud no encontrada');
    }
    if (requestQuery.rows[0].status === 'completada') {
        throw new Error('Solicitud cerrada');
    }

    const profileQuery = await db.query(
        'SELECT profile, updated_at, updated_by FROM personnel_request_profiles WHERE personnel_request_id = $1',
        [requestId]
    );

    const documentsQuery = await db.query(
        `SELECT id, doc_type, drive_file_id, drive_url, file_name, mime_type, uploaded_by, created_at
         FROM personnel_request_documents
         WHERE personnel_request_id = $1
         ORDER BY created_at DESC`,
        [requestId]
    );

    return {
        profile: profileQuery.rows[0]?.profile || {},
        updated_at: profileQuery.rows[0]?.updated_at || null,
        updated_by: profileQuery.rows[0]?.updated_by || null,
        documents: documentsQuery.rows || [],
    };
}

async function upsertPersonnelProfile(requestId, profilePayload = {}, userId = null) {
    await ensurePersonnelProfileTables();
    await ensureCollaboratorTables();

    const requestQuery = await db.query(
        'SELECT id, status, collaborator_user_id FROM personnel_requests WHERE id = $1',
        [requestId]
    );
    if (requestQuery.rows.length === 0) {
        throw new Error('Solicitud no encontrada');
    }

    const status = requestQuery.rows[0].status;
    if (!['aprobada', 'en_proceso', 'completada'].includes(status)) {
        throw new Error('El perfil solo puede actualizarse cuando la solicitud estÃ¡ aprobada');
    }

    const query = `
      INSERT INTO personnel_request_profiles (personnel_request_id, profile, updated_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (personnel_request_id)
      DO UPDATE SET profile = EXCLUDED.profile, updated_by = EXCLUDED.updated_by, updated_at = NOW()
      RETURNING *
    `;

    const result = await db.query(query, [requestId, profilePayload, userId]);

    const collaboratorUserId = requestQuery.rows[0]?.collaborator_user_id;
    if (collaboratorUserId) {
        await ensureCollaboratorTables();
        await db.query(
            `
            INSERT INTO collaborator_profiles (user_id, profile, updated_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id)
            DO UPDATE SET profile = EXCLUDED.profile, updated_by = EXCLUDED.updated_by, updated_at = NOW()
            `,
            [collaboratorUserId, profilePayload, userId]
        );
    }

    return result.rows[0];
}

async function addPersonnelDocument(requestId, docType, file, userId = null) {
    await ensurePersonnelProfileTables();
    await ensureCollaboratorTables();

    const requestQuery = await db.query(
        'SELECT id, status, drive_folder_id, collaborator_user_id FROM personnel_requests WHERE id = $1',
        [requestId]
    );
    if (requestQuery.rows.length === 0) {
        throw new Error('Solicitud no encontrada');
    }

    const status = requestQuery.rows[0].status;
    if (!['aprobada', 'en_proceso', 'completada'].includes(status)) {
        throw new Error('Solo puedes subir documentos cuando la solicitud estÃ¡ aprobada');
    }

    let folderId = requestQuery.rows[0].drive_folder_id;
    if (!folderId) {
        try {
            const folderName = `Solicitud Personal - ${requestId} - Documentos`;
            const folder = await ensureFolder(folderName, DRIVE_ROOT_FOLDER_ID);
            folderId = folder.id;
            await db.query(
                'UPDATE personnel_requests SET drive_folder_id = $1 WHERE id = $2',
                [folderId, requestId]
            );
        } catch (error) {
            logger.warn('No se pudo crear carpeta en Drive para documentos:', error.message);
        }
    }

    const base64 = file.buffer.toString('base64');
    const uploaded = await uploadBase64File(
        file.originalname || `${docType}.pdf`,
        base64,
        file.mimetype || 'application/octet-stream',
        folderId
    );

    const insertQuery = `
      INSERT INTO personnel_request_documents (
        personnel_request_id,
        doc_type,
        drive_file_id,
        drive_url,
        file_name,
        mime_type,
        uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const insertResult = await db.query(insertQuery, [
        requestId,
        docType,
        uploaded.id,
        uploaded.webViewLink || uploaded.webContentLink || null,
        file.originalname || uploaded.name || `${docType}`,
        file.mimetype || null,
        userId,
    ]);

    const collaboratorUserId = requestQuery.rows[0]?.collaborator_user_id;
    if (collaboratorUserId) {
        await ensureCollaboratorTables();
        await db.query(
            `
            INSERT INTO collaborator_documents (
              user_id,
              doc_type,
              drive_file_id,
              drive_url,
              file_name,
              mime_type,
              uploaded_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
                collaboratorUserId,
                docType,
                uploaded.id,
                uploaded.webViewLink || uploaded.webContentLink || null,
                file.originalname || uploaded.name || `${docType}`,
                file.mimetype || null,
                userId,
            ]
        );
    }

    return insertResult.rows[0];
}

async function hirePersonnelRequest(requestId, userId) {
    await ensurePersonnelProfileTables();
    await ensureCollaboratorTables();
    await ensureApplicantsTables();

    const requestQuery = await db.query(
        'SELECT id, status, collaborator_user_id, applicant_id FROM personnel_requests WHERE id = $1',
        [requestId]
    );

    if (requestQuery.rows.length === 0) {
        throw new Error('Solicitud no encontrada');
    }

    const { status, applicant_id } = requestQuery.rows[0];
    if (!['aprobada', 'en_proceso'].includes(status)) {
        throw new Error('La solicitud debe estar aprobada o en proceso para contratar');
    }

    let profile = null;
    let email = null;
    let fullname = null;

    // Intentar obtener datos del postulante normalizado si está vinculado
    if (applicant_id) {
        const applicantData = await getApplicantById(applicant_id);
        if (applicantData) {
            email = applicantData.email;
            fullname = applicantData.fullname;
            // Reconstruir perfil para collaborator_profiles si es necesario, 
            // o usar el que ya tiene la solicitud (que debería estar sincronizado)
        }
    }

    const profileQuery = await db.query(
        'SELECT profile FROM personnel_request_profiles WHERE personnel_request_id = $1',
        [requestId]
    );

    profile = profileQuery.rows[0]?.profile || null;
    if (!profile) {
        throw new Error('No hay perfil registrado para contratar');
    }

    if (!email) email = (profile?.personal?.email_personal || '').toLowerCase().trim();
    if (!fullname) fullname = `${profile?.personal?.nombres || ''} ${profile?.personal?.apellidos || ''}`.trim();

    if (!email) {
        throw new Error('Email personal es obligatorio para contratar');
    }

    const docRows = await db.query(
        'SELECT doc_type FROM personnel_request_documents WHERE personnel_request_id = $1',
        [requestId]
    );
    const docTypes = docRows.rows.map((row) => row.doc_type).filter(Boolean);

    const profileCompletion = computeProfileCompletion(profile);
    const documentsCompletion = computeDocumentsCompletion(docTypes);
    if (!profileCompletion.complete || !documentsCompletion.complete) {
        const error = new Error('Perfil o documentos incompletos para contratar');
        error.details = {
            profile_completion: profileCompletion,
            documents_completion: documentsCompletion,
        };
        throw error;
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const userUpsert = `
          INSERT INTO users (email, fullname, name, role)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (email)
          DO UPDATE SET fullname = EXCLUDED.fullname
          RETURNING id, email, fullname
        `;
        const userResult = await client.query(userUpsert, [
            email,
            fullname || email,
            profile?.personal?.nombres || 'Colaborador',
            'colaborador',
        ]);
        const user = userResult.rows[0];

        await client.query(
            `UPDATE personnel_requests
             SET collaborator_user_id = $1, status = 'completada', completed_at = NOW(), updated_at = NOW()
             WHERE id = $2`,
            [user.id, requestId]
        );

        await client.query(
            `
            INSERT INTO collaborator_profiles (user_id, profile, updated_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id)
            DO UPDATE SET profile = EXCLUDED.profile, updated_by = EXCLUDED.updated_by, updated_at = NOW()
            `,
            [user.id, profile, userId]
        );

        await client.query(
            `
            INSERT INTO collaborator_documents (
              user_id,
              doc_type,
              drive_file_id,
              drive_url,
              file_name,
              mime_type,
              uploaded_by
            )
            SELECT $1, doc_type, drive_file_id, drive_url, file_name, mime_type, $2
            FROM personnel_request_documents
            WHERE personnel_request_id = $3
              AND NOT EXISTS (
                SELECT 1 FROM collaborator_documents cd
                WHERE cd.user_id = $1 AND cd.doc_type = personnel_request_documents.doc_type
              )
            `,
            [user.id, userId, requestId]
        );

        await client.query(
            `UPDATE applicants SET status = 'hired', updated_at = NOW() WHERE id = $1 OR email = $2`,
            [applicant_id, email]
        );

        await client.query('COMMIT');

        await logAction({
            user_id: userId,
            module: 'personnel_requests',
            action: 'hire_applicant',
            entity: 'personnel_requests',
            entity_id: requestId,
            details: { collaborator_user_id: user.id, email },
        });

        return { collaborator_user_id: user.id, email };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}


async function updatePersonnelRequestCollaborator(requestId, collaboratorUserId, userId) {
    const requestQuery = await db.query(
        'SELECT id FROM personnel_requests WHERE id = $1',
        [requestId]
    );

    if (requestQuery.rows.length === 0) {
        throw new Error('Solicitud no encontrada');
    }

    const result = await db.query(
        'UPDATE personnel_requests SET collaborator_user_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [collaboratorUserId, requestId]
    );

    await logAction({
        user_id: userId,
        module: 'personnel_requests',
        action: 'link_collaborator',
        entity: 'personnel_requests',
        entity_id: requestId,
        details: { collaborator_user_id: collaboratorUserId }
    });

    return result.rows[0];
}

async function linkApplicantToRequest(requestId, applicantId, userId) {
    await ensurePersonnelProfileTables();
    await ensureApplicantsTables();

    const requestQuery = await db.query(
        'SELECT id FROM personnel_requests WHERE id = $1',
        [requestId]
    );

    if (requestQuery.rows.length === 0) {
        throw new Error('Solicitud no encontrada');
    }

    const client = await db.getClient();
    let result;
    try {
        await client.query('BEGIN');
        result = await client.query(
            'UPDATE personnel_requests SET applicant_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [applicantId, requestId]
        );

        if (applicantId) {
            // Refresh applicant-origin documents so each selected applicant shows their own files.
            await client.query(
                `
                DELETE FROM personnel_request_documents
                WHERE personnel_request_id = $1
                  AND doc_type IN ('HOJA_VIDA', 'CARTA_MOTIVACION')
                `,
                [requestId]
            );

            await client.query(
                `
                INSERT INTO personnel_request_documents (
                  personnel_request_id,
                  doc_type,
                  drive_file_id,
                  drive_url,
                  file_name,
                  mime_type,
                  uploaded_by
                )
                SELECT $1, ad.doc_type, ad.drive_file_id, ad.drive_url, ad.file_name, ad.mime_type, $2
                FROM applicant_documents ad
                WHERE ad.applicant_id = $3
                  AND ad.doc_type IN ('HOJA_VIDA', 'CARTA_MOTIVACION')
                `,
                [requestId, userId, applicantId]
            );
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    await logAction({
        user_id: userId,
        module: 'personnel_requests',
        action: 'link_applicant',
        entity: 'personnel_requests',
        entity_id: requestId,
        details: { applicant_id: applicantId }
    });

    return result.rows[0];
}

module.exports = {
    createPersonnelRequest,
    getPersonnelRequests,
    getPersonnelRequestById,
    updatePersonnelRequestStatus,
    addComment,
    getPersonnelRequestStats,
    getPersonnelProfile,
    upsertPersonnelProfile,
    addPersonnelDocument,
    hirePersonnelRequest,
    updatePersonnelRequestCollaborator,
    linkApplicantToRequest
};
