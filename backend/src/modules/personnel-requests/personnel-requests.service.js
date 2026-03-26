/**
 * Personnel Requests Service
 * Servicio para gestionar solicitudes de personal con perfil profesional
 */

const db = require('../../config/db');
const logger = require('../../config/logger');
const { logAction } = require('../../utils/audit');
const { ensureFolder, uploadBase64File } = require('../../utils/drive');
const { ensureApplicantsTables, getApplicantById, listApplicants } = require('../applicants/applicants.service');
const gmailService = require('../../services/gmail.service');
const {
    getSingleUserByRole,
    getUserById,
    uniqueRecipients,
    notifyUsers,
} = require('./personnel-requests.notifications');

const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID;
const HR_NOTIFICATION_EMAILS = process.env.HR_NOTIFICATION_EMAILS?.split(',').map(e => e.trim()) || [];

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

    await db.query(`
    CREATE TABLE IF NOT EXISTS personnel_request_comments (
      id SERIAL PRIMARY KEY,
      personnel_request_id INTEGER REFERENCES personnel_requests(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      comment TEXT NOT NULL,
      is_internal BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

    await db.query(`
    CREATE TABLE IF NOT EXISTS personnel_request_history (
      id SERIAL PRIMARY KEY,
      personnel_request_id INTEGER REFERENCES personnel_requests(id) ON DELETE CASCADE,
      previous_status TEXT,
      new_status TEXT,
      changed_by INTEGER REFERENCES users(id),
      notes TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

    await db.query(`
    ALTER TABLE personnel_request_history
    ADD COLUMN IF NOT EXISTS previous_status TEXT,
    ADD COLUMN IF NOT EXISTS new_status TEXT,
    ADD COLUMN IF NOT EXISTS changed_by INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
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

const PERSONNEL_WORKFLOW_STEPS = [
  {
    key: 'pendiente',
    label: 'Pendiente',
    responsibleRole: 'gerencia_general',
    responsibleLabel: 'Gerencia General',
    nextAction: 'Revisar la solicitud',
    maxHours: 72,
  },
  {
    key: 'en_revision',
    label: 'En revision',
    responsibleRole: 'talento_humano',
    responsibleLabel: 'Talento Humano',
    nextAction: 'Validar perfil y documentos',
    maxHours: 72,
  },
  {
    key: 'aprobada',
    label: 'Aprobada',
    responsibleRole: 'talento_humano',
    responsibleLabel: 'Talento Humano',
    nextAction: 'Completar expediente y validar contratacion',
    maxHours: 96,
  },
  {
    key: 'en_proceso',
    label: 'En proceso',
    responsibleRole: 'talento_humano',
    responsibleLabel: 'Talento Humano',
    nextAction: 'Finalizar contratacion y cierre operativo',
    maxHours: 96,
  },
  {
    key: 'completada',
    label: 'Completada',
    responsibleRole: null,
    responsibleLabel: 'Cerrada',
    nextAction: 'Solicitud cerrada',
    maxHours: null,
  },
  {
    key: 'rechazada',
    label: 'Rechazada',
    responsibleRole: null,
    responsibleLabel: 'Cerrada',
    nextAction: 'Solicitud rechazada',
    maxHours: null,
  },
  {
    key: 'cancelada',
    label: 'Cancelada',
    responsibleRole: null,
    responsibleLabel: 'Cerrada',
    nextAction: 'Solicitud cancelada',
    maxHours: null,
  },
];

const PERSONNEL_WORKFLOW_ORDER = PERSONNEL_WORKFLOW_STEPS.reduce((acc, step, index) => {
  acc[step.key] = index;
  return acc;
}, {});

const PERSONNEL_WORKFLOW_PROGRESS_ORDER = {
  pendiente: 0,
  en_revision: 1,
  aprobada: 2,
  en_proceso: 3,
  completada: 4,
};

const PERSONNEL_REQUEST_TRANSITIONS = {
  pendiente: ['en_revision', 'aprobada', 'rechazada', 'cancelada'],
  en_revision: ['aprobada', 'rechazada', 'cancelada'],
  aprobada: ['en_proceso', 'cancelada'],
  en_proceso: ['completada', 'cancelada'],
  completada: [],
  rechazada: [],
  cancelada: [],
};

const PROFILE_REQUIRED_BY_STATUS = {
  en_revision: [
    'personal.nombres',
    'personal.apellidos',
    'personal.email_personal',
    'laboral.cargo',
    'laboral.area',
  ],
  aprobada: [
    'personal.nombres',
    'personal.apellidos',
    'personal.cedula',
    'personal.email_personal',
    'laboral.cargo',
    'laboral.area',
    'laboral.tipo_contrato',
    'laboral.fecha_ingreso',
  ],
  en_proceso: REQUIRED_PROFILE_FIELDS,
  completada: REQUIRED_PROFILE_FIELDS,
};

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

const normalizeWorkflowStatus = (status) => String(status || 'pendiente').trim().toLowerCase();

const getWorkflowStepMeta = (status) => {
  const normalized = normalizeWorkflowStatus(status);
  return (
    PERSONNEL_WORKFLOW_STEPS.find((step) => step.key === normalized) ||
    PERSONNEL_WORKFLOW_STEPS[0]
  );
};

const toDateValue = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDurationLabel = (seconds = 0) => {
  const totalSeconds = Math.max(0, Math.floor(seconds || 0));
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} min`;
  }

  if (minutes <= 0) {
    return `${hours} h`;
  }

  return `${hours} h ${minutes} min`;
};

const normalizePersonnelProfilePayload = (payload = {}) => {
  if (
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    payload.profile &&
    typeof payload.profile === 'object' &&
    !Array.isArray(payload.profile)
  ) {
    return payload.profile;
  }

  return payload || {};
};

const getRequiredProfileFieldsForStatus = (status) => {
  const normalized = normalizeWorkflowStatus(status);
  return PROFILE_REQUIRED_BY_STATUS[normalized] || [];
};

/**
 * Valida perfil JSONB por estado de flujo. Devuelve errores normalizados por campo.
 */
const validateProfileByStatus = (profile = {}, status = 'pendiente') => {
  const requiredFields = getRequiredProfileFieldsForStatus(status);
  if (requiredFields.length === 0) {
    return { valid: true, errors: [] };
  }

  const errors = requiredFields.reduce((acc, fieldPath) => {
    const path = fieldPath.split('.');
    const value = getProfileValue(profile, path);
    if (!isFieldFilled(value) && !isNAValue(value)) {
      acc.push({
        path,
        message: `Campo obligatorio faltante para etapa ${normalizeWorkflowStatus(status)}: ${fieldPath}`,
      });
    }
    return acc;
  }, []);

  return { valid: errors.length === 0, errors };
};

const ensureProfileValidationOrThrow = (profile = {}, status = 'pendiente') => {
  const validation = validateProfileByStatus(profile, status);
  if (validation.valid) return;

  const error = new Error(`Perfil incompleto para la etapa ${normalizeWorkflowStatus(status)}`);
  error.code = 'PROFILE_VALIDATION_ERROR';
  error.details = {
    status: normalizeWorkflowStatus(status),
    validation_errors: validation.errors,
  };
  throw error;
};

const recordPersonnelRequestHistory = async (
  personnelRequestId,
  {
    previousStatus = null,
    newStatus = null,
    changedBy = null,
    notes = null,
    metadata = {},
  } = {}
) => {
  await ensurePersonnelProfileTables();

  await db.query(
    `
    INSERT INTO personnel_request_history (
      personnel_request_id,
      previous_status,
      new_status,
      changed_by,
      notes,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      personnelRequestId,
      previousStatus,
      newStatus,
      changedBy,
      notes,
      metadata && typeof metadata === 'object' ? metadata : {},
    ]
  );
};

const listPersonnelRequestDocuments = async (requestId) => {
  const result = await db.query(
    `
    SELECT id, doc_type, drive_file_id, drive_url, file_name, mime_type, uploaded_by, created_at
    FROM personnel_request_documents
    WHERE personnel_request_id = $1
    ORDER BY created_at DESC
    `,
    [requestId]
  );

  return result.rows || [];
};

const buildWorkflowSummary = (request = {}, historyRows = [], collaborators = {}) => {
  const currentStatus = normalizeWorkflowStatus(request.status || 'pendiente');
  const currentStep = getWorkflowStepMeta(currentStatus);
  const createdAt = toDateValue(request.created_at) || new Date();
  const explicitStageStartedAt =
    toDateValue(request.current_stage_started_at) ||
    toDateValue(request.stage_started_at) ||
    null;
  const now = new Date();
  const orderedHistory = [...(historyRows || [])]
    .map((row) => ({
      ...row,
      new_status: normalizeWorkflowStatus(row.new_status),
      previous_status: normalizeWorkflowStatus(row.previous_status),
      created_at: toDateValue(row.created_at) || createdAt,
    }))
    .filter((row) => row.new_status && row.new_status !== row.previous_status)
    .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

  const statusEvents = [
    {
      status: normalizeWorkflowStatus(request.status || 'pendiente'),
      startedAt: createdAt,
      changedBy: request.requester_id || null,
      changedByName: request.requester_name || request.requester_email || null,
      source: 'created',
    },
  ];

  orderedHistory.forEach((row) => {
    statusEvents.push({
      status: row.new_status,
      startedAt: row.created_at,
      changedBy: row.changed_by || null,
      changedByName: row.changed_by_name || null,
      source: 'history',
    });
  });

  const timeline = [];
  for (let index = 0; index < statusEvents.length; index += 1) {
    const current = statusEvents[index];
    const next = statusEvents[index + 1] || null;
    const meta = getWorkflowStepMeta(current.status);
    const endAt = next?.startedAt || null;
    const effectiveEnd = endAt || (PERSONNEL_REQUEST_TRANSITIONS[current.status]?.length ? null : now);
    const durationSeconds = effectiveEnd
      ? Math.max(0, Math.floor((effectiveEnd.getTime() - current.startedAt.getTime()) / 1000))
      : Math.max(0, Math.floor((now.getTime() - current.startedAt.getTime()) / 1000));

    timeline.push({
      status: current.status,
      label: meta.label,
      started_at: current.startedAt.toISOString(),
      ended_at: endAt ? endAt.toISOString() : null,
      duration_seconds: durationSeconds,
      duration_label: formatDurationLabel(durationSeconds),
      is_current: index === statusEvents.length - 1,
      changed_by: current.changedBy,
      changed_by_name: current.changedByName || null,
      source: current.source,
    });
  }

  const currentStartedAt =
    [...timeline].reverse().find((entry) => entry.status === currentStatus)?.started_at ||
    createdAt.toISOString();
  const stageStartedAt = explicitStageStartedAt || toDateValue(currentStartedAt) || createdAt;
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - stageStartedAt.getTime()) / 1000));
  const terminalStatuses = new Set(['completada', 'rechazada', 'cancelada']);
  const maxHours = Number.isFinite(currentStep.maxHours) ? currentStep.maxHours : null;
  const maxSeconds = maxHours ? maxHours * 60 * 60 : null;
  const deadlineAt = maxHours ? new Date(stageStartedAt.getTime() + maxHours * 60 * 60 * 1000) : null;
  const stalled = Boolean(deadlineAt && now.getTime() > deadlineAt.getTime());
  const stalledForSeconds = stalled ? Math.floor((now.getTime() - deadlineAt.getTime()) / 1000) : 0;
  const remainingSeconds = maxSeconds !== null ? Math.max(0, maxSeconds - elapsedSeconds) : null;
  const nearSla = Boolean(
    !terminalStatuses.has(currentStatus) &&
    maxSeconds !== null &&
    !stalled &&
    elapsedSeconds >= Math.floor(maxSeconds * 0.75)
  );
  const slaProgressPercent = maxSeconds ? Math.min(999, Math.round((elapsedSeconds / maxSeconds) * 100)) : null;
  const slaAlertLevel = terminalStatuses.has(currentStatus)
    ? 'normal'
    : stalled
      ? 'stalled'
      : nearSla
        ? 'warning'
        : 'normal';
  const slaAlertMessage = stalled
    ? `Estancada por ${formatDurationLabel(stalledForSeconds)}`
    : nearSla
      ? `Etapa cercana al limite (${elapsedSeconds > 0 ? formatDurationLabel(elapsedSeconds) : '0m'} de ${maxHours}h)`
      : maxHours
        ? `Dentro de SLA (${elapsedSeconds > 0 ? formatDurationLabel(elapsedSeconds) : '0m'} de ${maxHours}h)`
        : 'Sin SLA configurado para esta etapa';
  const currentIndex = Math.max(0, PERSONNEL_WORKFLOW_PROGRESS_ORDER[currentStatus] ?? 0);
  const progressPercent = terminalStatuses.has(currentStatus)
    ? 100
    : Math.min(100, Math.round((currentIndex / Math.max(PERSONNEL_WORKFLOW_PROGRESS_ORDER.completada, 1)) * 100));

  const collaboratorName = collaborators?.fullname || collaborators?.email || null;
  const approverName =
    request.approved_by_manager_name ||
    request.approved_by_hr_name ||
    request.approved_by_finance_name ||
    null;
  const responsibleName = collaboratorName || approverName || currentStep.responsibleLabel;

  return {
    current_status: currentStatus,
    current_stage: currentStep.key,
    current_stage_label: currentStep.label,
    current_responsible_role: currentStep.responsibleRole,
    current_responsible_label: currentStep.responsibleLabel,
    current_responsible_name: responsibleName,
    next_action: currentStep.nextAction,
    started_at: stageStartedAt.toISOString(),
    elapsed_seconds: elapsedSeconds,
    elapsed_label: formatDurationLabel(elapsedSeconds),
    deadline_at: deadlineAt ? deadlineAt.toISOString() : null,
    stalled,
    stalled_for_seconds: stalledForSeconds,
    stalled_for_label: stalledForSeconds > 0 ? formatDurationLabel(stalledForSeconds) : null,
    max_hours: maxHours,
    max_seconds: maxSeconds,
    remaining_seconds: remainingSeconds,
    remaining_label: remainingSeconds !== null ? formatDurationLabel(remainingSeconds) : null,
    near_sla: nearSla,
    sla_progress_percent: slaProgressPercent,
    sla_alert_level: slaAlertLevel,
    sla_alert_message: slaAlertMessage,
    progress_percent: progressPercent,
    progress_label: `${progressPercent}%`,
    is_terminal: terminalStatuses.has(currentStatus),
    timeline,
  };
};



/**
 * Crear una nueva solicitud de personal
 */
const provisionRequestDriveFolderAsync = async (requestId, positionTitle) => {
  if (!DRIVE_ROOT_FOLDER_ID) return;

  try {
    const folderName = `Solicitud Personal - ${positionTitle || requestId} - ${new Date().toISOString().split('T')[0]}`;
    const folder = await ensureFolder(folderName, DRIVE_ROOT_FOLDER_ID);
    await db.query(
      'UPDATE personnel_requests SET drive_folder_id = $1, updated_at = NOW() WHERE id = $2 AND drive_folder_id IS NULL',
      [folder?.id || null, requestId]
    );
  } catch (error) {
    logger.warn({ requestId, error: error?.message }, 'No se pudo provisionar carpeta de Drive de forma asincrona');
  }
};

async function createPersonnelRequest(data, userId) {
    await ensurePersonnelProfileTables();
    await ensureCollaboratorTables();

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

    const requiredFields = [
        ['position_title', position_title],
        ['position_type', position_type],
        ['education_level', education_level],
        ['main_responsibilities', main_responsibilities],
        ['justification', justification],
        ['work_schedule', work_schedule],
        ['salary_range', salary_range],
        ['work_location', work_location],
        ['benefits', benefits],
    ];
    const missingFields = requiredFields
        .filter(([, value]) => value === null || value === undefined || String(value).trim() === '')
        .map(([field]) => field);

    if (missingFields.length > 0) {
        throw new Error(`Faltan campos obligatorios: ${missingFields.join(', ')}`);
    }

    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
        throw new Error('La cantidad de vacantes debe ser un numero entero mayor o igual a 1');
    }

    const normalizedType = String(position_type || '').trim().toLowerCase();
    if (!['permanente', 'temporal', 'reemplazo', 'proyecto'].includes(normalizedType)) {
        throw new Error(`Tipo de contratacion invalido: ${position_type}`);
    }

    const normalizedUrgency = String(urgency_level || 'normal').trim().toLowerCase();
    if (!['baja', 'normal', 'alta', 'urgente'].includes(normalizedUrgency)) {
        throw new Error(`Nivel de urgencia invalido: ${urgency_level}`);
    }

    const normalizedQuantity = Number(quantity);
    const normalizedPriority = Number.isFinite(Number(priority)) ? Number(priority) : 3;
    if (!Number.isInteger(normalizedPriority) || normalizedPriority < 1 || normalizedPriority > 5) {
        throw new Error('La prioridad debe ser un numero entero entre 1 y 5');
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

    // Provisionamiento asincrono de carpeta: no bloquea la respuesta del API.
    const driveFolderId = null;

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
        normalizedType,
        normalizedQuantity,
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
        normalizedUrgency,
        normalizedPriority,
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
        details: {
            position_title,
            position_type,
            urgency_level: normalizedUrgency,
            quantity: normalizedQuantity,
            async_drive_provision: true,
        }
    });

    // Notificar a Talento Humano + Gerencia (usuarios especificos)
    await notifyHRNewRequest(request, user);

    // Fire-and-forget para evitar bloqueo de la solicitud.
    void provisionRequestDriveFolderAsync(request.id, position_title);

    return request;
}

/**
 * Obtener solicitudes de personal con filtros
 */
async function getPersonnelRequests(filters = {}, userId = null, userRole = null) {
    await ensurePersonnelProfileTables();

    const {
        status,
        department_id,
        urgency_level,
        position_type,
        q,
        search,
        sort_by,
        sort_dir,
        page = 1,
        pageSize = 20,
        my_requests = false
    } = filters;
    const stalledFilterRaw = filters.stalled_only ?? filters.stalled ?? filters.stagnant ?? null;
    const stalledOnly = stalledFilterRaw === true || String(stalledFilterRaw).toLowerCase() === 'true';
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safePageSize = Math.min(200, Math.max(parseInt(pageSize, 10) || 20, 1));
    const stageStartedAtExpression = `
      COALESCE(
        (
          SELECT h.created_at
          FROM personnel_request_history h
          WHERE h.personnel_request_id = pr.id
            AND LOWER(COALESCE(h.new_status, '')) = LOWER(COALESCE(pr.status, ''))
          ORDER BY h.created_at DESC
          LIMIT 1
        ),
        pr.created_at
      )
    `;
    const stageMaxHoursExpression = `
      CASE LOWER(COALESCE(pr.status, ''))
        WHEN 'pendiente' THEN 72
        WHEN 'en_revision' THEN 72
        WHEN 'aprobada' THEN 96
        WHEN 'en_proceso' THEN 96
        ELSE NULL
      END
    `;
    const stalledExpression = `
      CASE
        WHEN (${stageMaxHoursExpression}) IS NULL THEN FALSE
        ELSE NOW() > (${stageStartedAtExpression} + ((${stageMaxHoursExpression}) * INTERVAL '1 hour'))
      END
    `;

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

    if (stalledOnly) {
        whereConditions.push(`(${stalledExpression}) = TRUE`);
    }

    const normalizedSearch = String(q || search || '').trim().toLowerCase();
    if (normalizedSearch) {
        whereConditions.push(`(
          LOWER(COALESCE(pr.position_title, '')) LIKE $${paramIndex}
          OR LOWER(COALESCE(pr.request_number, '')) LIKE $${paramIndex}
          OR LOWER(COALESCE(d.name, '')) LIKE $${paramIndex}
          OR LOWER(COALESCE(u.fullname, '')) LIKE $${paramIndex}
          OR LOWER(COALESCE(cu.fullname, '')) LIKE $${paramIndex}
        )`);
        params.push(`%${normalizedSearch}%`);
        paramIndex += 1;
    }

    const sortByMap = {
        created_at: 'pr.created_at',
        updated_at: 'pr.updated_at',
        position_title: 'pr.position_title',
        status: 'pr.status',
        urgency_level: 'pr.urgency_level',
    };
    const safeSortBy = sortByMap[String(sort_by || '').toLowerCase()] || null;
    const safeSortDir = String(sort_dir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const orderBy = safeSortBy
        ? `${safeSortBy} ${safeSortDir}, pr.created_at DESC`
        : `CASE pr.urgency_level
        WHEN 'urgente' THEN 1
        WHEN 'alta' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'baja' THEN 4
      END,
      pr.created_at DESC`;

    const offset = (safePage - 1) * safePageSize;

    const query = `
    SELECT 
      pr.*,
      u.fullname as requester_name,
      u.email as requester_email,
      cu.fullname as collaborator_name,
      cu.email as collaborator_email,
      d.name as department_name,
      d.code as department_code,
      ${stageStartedAtExpression} as current_stage_started_at
    FROM personnel_requests pr
    LEFT JOIN users u ON pr.requester_id = u.id
    LEFT JOIN users cu ON pr.collaborator_user_id = cu.id
    LEFT JOIN departments d ON pr.department_id = d.id
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

    params.push(safePageSize, offset);

    const result = await db.query(query, params);

    // Contar total
    const countQuery = `
    SELECT COUNT(*) as total
    FROM personnel_requests pr
    LEFT JOIN users u ON pr.requester_id = u.id
    LEFT JOIN users cu ON pr.collaborator_user_id = cu.id
    LEFT JOIN departments d ON pr.department_id = d.id
    WHERE ${whereConditions.join(' AND ')}
  `;
    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total, 10);

    return {
        data: result.rows.map((row) => {
            const workflow = buildWorkflowSummary(row, [], row.collaborator_name || row.collaborator_email ? {
                fullname: row.collaborator_name || null,
                email: row.collaborator_email || null,
            } : null);

            return {
                ...row,
                workflow,
                stalled: workflow.stalled,
                stalled_for_seconds: workflow.stalled_for_seconds,
                stalled_for_label: workflow.stalled
                    ? `Estancada por ${workflow.stalled_for_label || formatDurationLabel(workflow.stalled_for_seconds || 0)}`
                    : null,
                near_sla: workflow.near_sla,
                sla_alert_level: workflow.sla_alert_level,
                sla_alert_message: workflow.sla_alert_message,
            };
        }),
        pagination: {
            page: safePage,
            pageSize: safePageSize,
            total,
            totalPages: Math.ceil(total / safePageSize)
        }
    };
}

async function getPersonnelRequestApplicants(requestId, filters = {}) {
    await ensurePersonnelProfileTables();
    await ensureApplicantsTables();

    const requestQuery = await db.query(
        `SELECT id, position_title, applicant_id
         FROM personnel_requests
         WHERE id = $1`,
        [requestId]
    );

    if (requestQuery.rows.length === 0) {
        throw new Error('Solicitud no encontrada');
    }

    const request = requestQuery.rows[0];
    const search = filters?.search || '';
    const page = parseInt(filters?.page || 1, 10);
    const pageSize = parseInt(filters?.pageSize || 25, 10);

    const applicantResult = await listApplicants({
        cargo: request.position_title,
        search,
        page,
        pageSize,
    });

    let data = Array.isArray(applicantResult?.data) ? applicantResult.data : [];
    if (request.applicant_id && !data.some((item) => String(item.id) === String(request.applicant_id))) {
        const linkedApplicant = await getApplicantById(request.applicant_id);
        if (linkedApplicant) {
            data = [linkedApplicant, ...data];
        }
    }

    return {
        request_id: request.id,
        request_position_title: request.position_title,
        linked_applicant_id: request.applicant_id || null,
        data,
        pagination: applicantResult?.pagination || {
            page,
            pageSize,
            total: data.length,
            totalPages: 1,
        },
    };
}

/**
 * Obtener una solicitud específica por ID
 */
async function getPersonnelRequestById(id) {
    await ensurePersonnelProfileTables();

    const query = `
    SELECT 
      pr.*,
      u.fullname as requester_name,
      u.email as requester_email,
      cu.fullname as collaborator_name,
      cu.email as collaborator_email,
      d.name as department_name,
      d.code as department_code,
      am.fullname as approved_by_manager_name,
      ah.fullname as approved_by_hr_name,
      af.fullname as approved_by_finance_name
    FROM personnel_requests pr
    LEFT JOIN users u ON pr.requester_id = u.id
    LEFT JOIN users cu ON pr.collaborator_user_id = cu.id
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
        workflow: buildWorkflowSummary(request, historyResult.rows, request.collaborator_name || request.collaborator_email ? {
            fullname: request.collaborator_name || null,
            email: request.collaborator_email || null,
        } : null),
        history: historyResult.rows,
        comments: commentsResult.rows
    };
}

/**
 * Actualizar estado de solicitud
 */
async function updatePersonnelRequestStatus(id, status, userId, notes = null, userRole = null) {
    await ensurePersonnelProfileTables();

    const normalizedStatus = normalizeWorkflowStatus(status);
    const validStatuses = Object.keys(PERSONNEL_REQUEST_TRANSITIONS);

    if (!validStatuses.includes(normalizedStatus)) {
        throw new Error(`Estado invalido: ${status}`);
    }

    const currentQuery = await db.query(
        'SELECT id, status FROM personnel_requests WHERE id = $1',
        [id]
    );
    if (currentQuery.rows.length === 0) {
        throw new Error('Solicitud no encontrada');
    }

    const currentStatus = normalizeWorkflowStatus(currentQuery.rows[0].status);
    if (currentStatus === normalizedStatus) {
        return currentQuery.rows[0];
    }

    const allowedTransitions = PERSONNEL_REQUEST_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(normalizedStatus)) {
        throw new Error(`No es posible pasar de ${currentStatus} a ${normalizedStatus}`);
    }

    if (['aprobada', 'en_proceso'].includes(normalizedStatus)) {
        const profileResult = await getPersonnelProfile(id);
        const profile = profileResult?.profile || {};
        const profileCompletion = computeProfileCompletion(profile);
        const completionPercent =
            profileCompletion.total > 0
                ? Math.round((profileCompletion.done / profileCompletion.total) * 100)
                : 0;

        if (!profileCompletion.complete || completionPercent < 100) {
            const error = new Error('No se puede avanzar: El perfil profesional debe estar completo al 100%');
            error.code = 'PROFILE_INCOMPLETE_FOR_TRANSITION';
            error.details = {
                profile_completion: profileCompletion,
                completion_percent: completionPercent,
                target_status: normalizedStatus,
            };
            throw error;
        }
    }

    if (normalizedStatus === 'rechazada' && !String(notes || '').trim()) {
        throw new Error('Debes incluir un motivo para rechazar la solicitud');
    }

    const updateFields = ['status = $1', 'updated_at = NOW()'];
    const params = [normalizedStatus];
    let paramIndex = 2;
    const role = (userRole || '').toLowerCase();
    const isManager = ['gerencia_general', 'gerente', 'gerencia', 'admin'].includes(role);
    const isHr = ['talento_humano'].includes(role);

    if (normalizedStatus === 'aprobada') {
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

    if (normalizedStatus === 'rechazada') {
        updateFields.push(`rejection_reason = $${paramIndex++}`);
        params.push(notes);
    }

    if (normalizedStatus === 'completada') {
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

    await logAction({
        user_id: userId,
        module: 'personnel_requests',
        action: 'update_status',
        entity: 'personnel_requests',
        entity_id: id,
        details: { new_status: normalizedStatus, notes }
    });

    await recordPersonnelRequestHistory(id, {
        previousStatus: currentStatus,
        newStatus: normalizedStatus,
        changedBy: userId,
        notes,
        metadata: {
            action: 'status_change',
            role,
        },
    });

    try {
        const updated = result.rows[0];
        const requesterUser = await getUserById(updated.requester_id);
        const hrUser = await getSingleUserByRole('talento_humano');
        const managerUser = await getSingleUserByRole('gerencia_general');
        const usersToNotify = [requesterUser, hrUser, managerUser].filter(Boolean);
        const statusLabel = normalizedStatus.replace('_', ' ');
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
                message: `Solicitud #${id} (${updated.position_title}) ahora esta ${statusLabel}.`,
                type: normalizedStatus === 'rechazada' ? 'alert' : 'info',
                priority: normalizedStatus === 'rechazada' ? 2 : 0,
                source: 'personnel_requests',
                meta: { request_id: id, status: normalizedStatus }
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
async function addComment(requestId, userId, comment, isInternal = false, userRole = null) {
    await ensurePersonnelProfileTables();

    const cleanComment = String(comment || '').trim();
    if (!cleanComment) {
        throw new Error('El comentario no puede estar vacio');
    }

    const internalRoles = new Set(['talento_humano', 'gerencia_general', 'admin']);
    const normalizedRole = String(userRole || '').trim().toLowerCase();
    const allowInternal = internalRoles.has(normalizedRole);
    const internalComment = allowInternal && Boolean(isInternal);

    const query = `
    INSERT INTO personnel_request_comments (
      personnel_request_id,
      user_id,
      comment,
      is_internal
    ) VALUES ($1, $2, $3, $4)
    RETURNING *
  `;

    const result = await db.query(query, [requestId, userId, cleanComment, internalComment]);

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
    await ensurePersonnelProfileTables();

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
      COUNT(*) FILTER (
        WHERE status IN ('pendiente', 'en_revision', 'aprobada', 'en_proceso')
          AND NOW() - COALESCE(updated_at, created_at) >
            CASE status
              WHEN 'pendiente' THEN INTERVAL '72 hours'
              WHEN 'en_revision' THEN INTERVAL '72 hours'
              WHEN 'aprobada' THEN INTERVAL '96 hours'
              WHEN 'en_proceso' THEN INTERVAL '96 hours'
              ELSE INTERVAL '9999 hours'
            END
      ) as estancadas,
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

    return {
        profile: profileQuery.rows[0]?.profile || {},
        updated_at: profileQuery.rows[0]?.updated_at || null,
        updated_by: profileQuery.rows[0]?.updated_by || null,
        documents: await listPersonnelRequestDocuments(requestId),
    };
}

async function getPersonnelRequestWorkspace(requestId, filters = {}) {
    await ensurePersonnelProfileTables();
    await ensureCollaboratorTables();
    await ensureApplicantsTables();

    const request = await getPersonnelRequestById(requestId);
    if (!request) {
        throw new Error('Solicitud no encontrada');
    }

    const profileQuery = await db.query(
        'SELECT profile, updated_at, updated_by FROM personnel_request_profiles WHERE personnel_request_id = $1',
        [requestId]
    );

    const profile = profileQuery.rows[0]?.profile || {};
    const documents = await listPersonnelRequestDocuments(requestId);
    const applicants = await getPersonnelRequestApplicants(requestId, filters);
    const documentTypes = documents.map((doc) => doc.doc_type).filter(Boolean);

    return {
        request,
        profile: {
            profile,
            updated_at: profileQuery.rows[0]?.updated_at || null,
            updated_by: profileQuery.rows[0]?.updated_by || null,
            documents,
        },
        applicants,
        summary: {
            profile_completion: computeProfileCompletion(profile),
            documents_completion: computeDocumentsCompletion(documentTypes),
            linked_applicant_id: request.applicant_id || null,
            linked_collaborator_user_id: request.collaborator_user_id || null,
        },
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

    const status = normalizeWorkflowStatus(requestQuery.rows[0].status);
    if (!['aprobada', 'en_proceso'].includes(status)) {
        throw new Error('El perfil solo puede actualizarse cuando la solicitud este aprobada');
    }

    const normalizedPayload = normalizePersonnelProfilePayload(profilePayload);
    ensureProfileValidationOrThrow(normalizedPayload, status);

    const query = `
      INSERT INTO personnel_request_profiles (personnel_request_id, profile, updated_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (personnel_request_id)
      DO UPDATE SET profile = EXCLUDED.profile, updated_by = EXCLUDED.updated_by, updated_at = NOW()
      RETURNING *
    `;

    const result = await db.query(query, [requestId, normalizedPayload, userId]);

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
            [collaboratorUserId, normalizedPayload, userId]
        );
    }

    await logAction({
        user_id: userId,
        module: 'personnel_requests',
        action: 'upsert_profile',
        entity: 'personnel_requests',
        entity_id: requestId,
        details: {
            stage: status,
            collaborator_user_id: requestQuery.rows[0]?.collaborator_user_id || null,
            validation_profile_required_fields: getRequiredProfileFieldsForStatus(status).length,
        },
    });

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
    if (!['aprobada', 'en_proceso'].includes(status)) {
        throw new Error('Solo puedes subir documentos cuando la solicitud este aprobada');
    }

    let folderId = requestQuery.rows[0].drive_folder_id;
    if (!folderId) {
        folderId = DRIVE_ROOT_FOLDER_ID || null;
        void provisionRequestDriveFolderAsync(requestId, `REQ-${requestId}-Documentos`);
    }
    if (!folderId) {
        throw new Error('No se pudo resolver carpeta de Drive para documentos');
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

    try {
        await logAction({
            user_id: userId,
            module: 'personnel_requests',
            action: 'upload_document',
            entity: 'personnel_requests',
            entity_id: requestId,
            details: {
                doc_type: docType,
                file_name: file.originalname || uploaded.name || `${docType}`,
                drive_file_id: uploaded.id || null,
                collaborator_user_id: collaboratorUserId || null,
            },
        });
    } catch (auditError) {
        logger.warn({ requestId, error: auditError?.message }, 'No se pudo registrar auditoria de subida de documento');
    }

    return {
        document: insertResult.rows[0],
        documents: await listPersonnelRequestDocuments(requestId),
    };
}

/**
 * Finaliza la contratacion en una transaccion atomica para evitar estados parciales.
 */
async function hirePersonnelRequest(requestId, userId) {
    await ensurePersonnelProfileTables();
    await ensureCollaboratorTables();
    await ensureApplicantsTables();

    const client = await db.getClient();
    let resultPayload = null;
    let auditDetails = null;

    try {
        await client.query('BEGIN');

        const requestQuery = await client.query(
            `
            SELECT id, status, collaborator_user_id, applicant_id, request_number, position_title
            FROM personnel_requests
            WHERE id = $1
            FOR UPDATE
            `,
            [requestId]
        );

        if (requestQuery.rows.length === 0) {
            throw new Error('Solicitud no encontrada');
        }

        const request = requestQuery.rows[0];
        const previousStatus = normalizeWorkflowStatus(request.status);

        if (previousStatus === 'completada' && request.collaborator_user_id) {
            await client.query('COMMIT');
            return { collaborator_user_id: request.collaborator_user_id, email: null };
        }

        if (!['aprobada', 'en_proceso'].includes(previousStatus)) {
            throw new Error('La solicitud debe estar aprobada o en proceso para contratar');
        }

        const profileQuery = await client.query(
            'SELECT profile FROM personnel_request_profiles WHERE personnel_request_id = $1 FOR UPDATE',
            [requestId]
        );

        const profile = profileQuery.rows[0]?.profile || null;
        if (!profile) {
            throw new Error('No hay perfil registrado para contratar');
        }

        ensureProfileValidationOrThrow(profile, 'en_proceso');

        const docRows = await client.query(
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

        let email = (profile?.personal?.email_personal || '').toLowerCase().trim();
        let fullname = `${profile?.personal?.nombres || ''} ${profile?.personal?.apellidos || ''}`.trim();

        if (request.applicant_id) {
            const applicantQuery = await client.query(
                'SELECT id, email, fullname FROM applicants WHERE id = $1',
                [request.applicant_id]
            );
            if (applicantQuery.rows.length > 0) {
                email = (applicantQuery.rows[0]?.email || email || '').toLowerCase().trim();
                fullname = applicantQuery.rows[0]?.fullname || fullname;
            }
        }

        if (!email) {
            throw new Error('Email personal es obligatorio para contratar');
        }

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
        const collaboratorUser = userResult.rows[0];

        await client.query(
            `
            UPDATE personnel_requests
            SET collaborator_user_id = $1, status = 'completada', completed_at = NOW(), updated_at = NOW()
            WHERE id = $2
            `,
            [collaboratorUser.id, requestId]
        );

        await client.query(
            `
            INSERT INTO personnel_request_history (
              personnel_request_id,
              previous_status,
              new_status,
              changed_by,
              notes,
              metadata
            ) VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [
                requestId,
                previousStatus,
                'completada',
                userId,
                'Contratacion finalizada',
                {
                    action: 'hire_applicant',
                    collaborator_user_id: collaboratorUser.id,
                    applicant_id: request.applicant_id || null,
                    email,
                },
            ]
        );

        await client.query(
            `
            INSERT INTO collaborator_profiles (user_id, profile, updated_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id)
            DO UPDATE SET profile = EXCLUDED.profile, updated_by = EXCLUDED.updated_by, updated_at = NOW()
            `,
            [collaboratorUser.id, profile, userId]
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
            [collaboratorUser.id, userId, requestId]
        );

        await client.query(
            `
            UPDATE applicants
            SET status = 'hired', updated_at = NOW()
            WHERE ($1::INTEGER IS NOT NULL AND id = $1)
               OR (COALESCE($2, '') <> '' AND LOWER(email) = LOWER($2))
            `,
            [request.applicant_id || null, email]
        );

        await client.query('COMMIT');

        // --- Post-Commit: Notificar a TI ---
        try {
            const tiUser = await getSingleUserByRole('ti');
            const managerTiUser = await getSingleUserByRole('jefe_ti');
            const hrUser = await getSingleUserByRole('talento_humano');
            const tiRecipients = [tiUser, managerTiUser, hrUser].filter(Boolean);

            if (tiRecipients.length > 0) {
                const tiSubject = `🚀 Nueva Contratación: Creación de Credenciales - ${fullname}`;
                const tiHtml = `
                    <h2>Solicitud de Creación de Credenciales</h2>
                    <p>Se ha finalizado el proceso de contratación para el siguiente colaborador:</p>
                    <ul>
                        <li><strong>Nombre:</strong> ${fullname}</li>
                        <li><strong>Email Personal:</strong> ${email}</li>
                        <li><strong>Cargo:</strong> ${request.position_title}</li>
                        <li><strong>Número de Solicitud:</strong> ${request.request_number || requestId}</li>
                        <li><strong>Fecha de Contratación:</strong> ${new Date().toLocaleDateString()}</li>
                    </ul>
                    <p>Por favor, proceder con la creación de las credenciales de acceso corporativas (Email, SPI, etc.) y la configuración de los accesos correspondientes.</p>
                    <hr>
                    <p>Este es un mensaje automático del sistema SPI.</p>
                `;

                await notifyUsers({
                    users: tiRecipients,
                    subject: tiSubject,
                    html: tiHtml,
                    text: `Nueva contratación: ${fullname} (${request.position_title}). Por favor crear credenciales de TI.`,
                    notification: {
                        title: 'Nueva Contratación',
                        message: `Crear credenciales para ${fullname}`,
                        type: 'info',
                        source: 'personnel_requests'
                    }
                });
            }
        } catch (notifError) {
            logger.warn({ requestId, error: notifError?.message }, 'No se pudo enviar notificación a TI tras contratación');
        }

        resultPayload = { collaborator_user_id: collaboratorUser.id, email };
        auditDetails = {
            request_number: request.request_number || null,
            position_title: request.position_title || null,
            previous_status: previousStatus,
            new_status: 'completada',
            collaborator_user_id: collaboratorUser.id,
            applicant_id: request.applicant_id || null,
            email,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    if (auditDetails) {
        try {
            await logAction({
                user_id: userId,
                module: 'personnel_requests',
                action: 'hire_applicant',
                entity: 'personnel_requests',
                entity_id: requestId,
                details: auditDetails,
            });
        } catch (auditError) {
            logger.warn({ requestId, error: auditError?.message }, 'No se pudo registrar auditoria de contratacion');
        }
    }

    return resultPayload;
}

async function updatePersonnelRequestCollaborator(requestId, collaboratorUserId, userId) {
    const requestQuery = await db.query(
        'SELECT id, status, collaborator_user_id FROM personnel_requests WHERE id = $1',
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

    await recordPersonnelRequestHistory(requestId, {
        previousStatus: requestQuery.rows[0].status,
        newStatus: requestQuery.rows[0].status,
        changedBy: userId,
        notes: collaboratorUserId ? 'Responsable operativo reasignado' : 'Responsable operativo liberado',
        metadata: {
            action: 'link_collaborator',
            previous_collaborator_user_id: requestQuery.rows[0].collaborator_user_id || null,
            collaborator_user_id: collaboratorUserId,
        },
    });

    return result.rows[0];
}

async function linkApplicantToRequest(requestId, applicantId, userId) {
    await ensurePersonnelProfileTables();
    await ensureApplicantsTables();

    const requestQuery = await db.query(
        'SELECT id, status, applicant_id FROM personnel_requests WHERE id = $1',
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

    await recordPersonnelRequestHistory(requestId, {
        previousStatus: requestQuery.rows[0].status,
        newStatus: requestQuery.rows[0].status,
        changedBy: userId,
        notes: applicantId ? 'Postulante vinculado a la solicitud' : 'Postulante desvinculado de la solicitud',
        metadata: {
            action: 'link_applicant',
            previous_applicant_id: requestQuery.rows[0].applicant_id || null,
            applicant_id: applicantId,
        },
    });

    return result.rows[0];
}

module.exports = {
    createPersonnelRequest,
    getPersonnelRequests,
    getPersonnelRequestById,
    getPersonnelRequestWorkspace,
    getPersonnelRequestApplicants,
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



