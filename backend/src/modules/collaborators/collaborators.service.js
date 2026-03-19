const db = require('../../config/db');
const logger = require('../../config/logger');
const { logAction } = require('../../utils/audit');
const { ensureFolder, uploadBase64File } = require('../../utils/drive');
const { PROFILE_SYNC_KEYS, collectNestedFields } = require('../shared/profileSync');

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
  'OFERTA_SALARIO'
];

const PROFILE_PATHS = REQUIRED_PROFILE_FIELDS.map((field) => field.split('.'));

const getProfileValue = (profile, path) => {
  return path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), profile);
};

const isFieldFilled = (value) => value !== null && value !== undefined && String(value).trim() !== '';

const computeProfileCompletion = (profile = {}) => {
  let done = 0;
  PROFILE_PATHS.forEach((path) => {
    const value = getProfileValue(profile, path);
    if (isFieldFilled(value)) done += 1;
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

const pickProfileForMetadata = (profile = {}) => {
  return collectNestedFields(profile, PROFILE_SYNC_KEYS);
};

const mergeProfiles = (base = {}, incoming = {}) => {
  const merged = { ...(base || {}) };

  Object.keys(incoming || {}).forEach((section) => {
    if (incoming[section] && typeof incoming[section] === 'object' && !Array.isArray(incoming[section])) {
      merged[section] = { ...(merged[section] || {}), ...incoming[section] };
    } else {
      merged[section] = incoming[section];
    }
  });
  return merged;
};

const isReviewPending = (lastReviewedAt) => {
  if (!lastReviewedAt) return true;
  const date = new Date(lastReviewedAt);
  if (Number.isNaN(date.getTime())) return true;
  const diffDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 365;
};

const ensureCollaboratorTables = async () => {
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

  await db.query(`
    ALTER TABLE personnel_requests
    ADD COLUMN IF NOT EXISTS collaborator_user_id INTEGER REFERENCES users(id);
  `);
};

const resolveCollaboratorFolder = async (identity) => {
  const base =
    process.env.DRIVE_PROFILE_FOLDER_ID ||
    process.env.DRIVE_DOCS_FOLDER_ID ||
    process.env.DRIVE_ROOT_FOLDER_ID ||
    process.env.DRIVE_FOLDER_ID;

  if (!base) return null;

  const usersRoot = await ensureFolder('Usuarios', base);
  const userFolderName = identity?.email || identity?.fullname || `user-${identity?.id || 'na'}`;
  const userFolder = await ensureFolder(userFolderName, usersRoot.id);
  const docsFolder = await ensureFolder('Documentos', userFolder.id);
  return docsFolder.id;
};

const listCollaborators = async (filters = {}) => {
  await ensureCollaboratorTables();

  const { search, department_id, cargo, page = 1, pageSize = 20 } = filters;

  const where = [
    `(COALESCE(cp.profile->'extra'->>'applicant_source','') <> 'google_forms' AND COALESCE((cp.profile->'extra' ? 'preguntas_adicionales'), false) = false)`,
  ];
  const params = [];
  let paramIndex = 1;

  if (search) {
    where.push(`(LOWER(u.fullname) LIKE $${paramIndex} OR LOWER(u.email) LIKE $${paramIndex})`);
    params.push(`%${String(search).toLowerCase()}%`);
    paramIndex += 1;
  }

  if (department_id) {
    where.push(`u.department_id = $${paramIndex}`);
    params.push(department_id);
    paramIndex += 1;
  }

  if (cargo) {
    where.push(`(cp.profile->'laboral'->>'cargo') ILIKE $${paramIndex}`);
    params.push(`%${String(cargo)}%`);
    paramIndex += 1;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  const query = `
    SELECT
      u.id,
      u.email,
      COALESCE(NULLIF(u.fullname, ''), CONCAT('Usuario #', u.id)) AS fullname,
      u.role,
      u.department_id,
      u.created_at,
      u.updated_at,
      d.name AS department_name,
      cp.profile,
      cp.updated_at AS profile_updated_at,
      up.metadata->>'profile_last_reviewed_at' AS profile_last_reviewed_at,
      (
        SELECT ARRAY_AGG(cd.doc_type)
        FROM collaborator_documents cd
        WHERE cd.user_id = u.id
      ) AS doc_types,
      (
        SELECT COUNT(*)
        FROM user_certifications uc
        WHERE uc.user_id = u.id AND uc.is_active = true
      ) AS certifications_count
      ,
      (
        SELECT COUNT(*)
        FROM user_certifications uc
        WHERE uc.user_id = u.id
          AND uc.is_active = true
          AND uc.expiry_date IS NOT NULL
          AND uc.expiry_date < CURRENT_DATE
      ) AS certifications_expired_count,
      (
        SELECT COUNT(*)
        FROM user_certifications uc
        WHERE uc.user_id = u.id
          AND uc.is_active = true
          AND uc.expiry_date IS NOT NULL
          AND uc.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')
      ) AS certifications_expiring_soon_count
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      LEFT JOIN user_profile up ON up.user_id = u.id
    ${whereClause}
    ORDER BY fullname ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(pageSize, offset);

  const { rows } = await db.query(query, params);

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM users u
    LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
    ${whereClause}
  `;
  const countResult = await db.query(countQuery, params.slice(0, params.length - 2));
  const total = parseInt(countResult.rows[0]?.total || 0, 10);

  const data = rows.map((row) => {
      const profileCompletion = computeProfileCompletion(row.profile || {});
      const docTypes = Array.isArray(row.doc_types) ? row.doc_types : [];
      const documentsCompletion = computeDocumentsCompletion(docTypes);
      const review_pending = isReviewPending(row.profile_last_reviewed_at);
      return {
        ...row,
        certifications_count: Number(row.certifications_count || 0),
        certifications_expired_count: Number(row.certifications_expired_count || 0),
        certifications_expiring_soon_count: Number(row.certifications_expiring_soon_count || 0),
        review_pending,
        profile_completion: profileCompletion,
        documents_completion: documentsCompletion,
        overall_completion: {
          total: profileCompletion.total + documentsCompletion.total,
          done: profileCompletion.done + documentsCompletion.done,
          complete: profileCompletion.complete && documentsCompletion.complete,
        },
      };
    });

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

const getCollaboratorProfile = async (userId) => {
  await ensureCollaboratorTables();

  const userQuery = await db.query(
    `SELECT u.id, u.email, u.fullname, u.role, u.department_id, d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     WHERE u.id = $1`,
    [userId]
  );

  if (!userQuery.rows[0]) return null;

  const profileQuery = await db.query(
    'SELECT profile, updated_at, updated_by FROM collaborator_profiles WHERE user_id = $1',
    [userId]
  );

  const reviewQuery = await db.query(
    `SELECT metadata->>'profile_last_reviewed_at' AS profile_last_reviewed_at
     FROM user_profile
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  const docsQuery = await db.query(
    `SELECT id, doc_type, drive_file_id, drive_url, file_name, mime_type, uploaded_by, created_at
     FROM collaborator_documents
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  const certificationsQuery = await db.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE is_active = true) AS active_count,
      COUNT(*) FILTER (WHERE is_active = true AND expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE) AS expired_count,
      COUNT(*) FILTER (WHERE is_active = true AND expiry_date IS NOT NULL AND expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')) AS expiring_soon_count
    FROM user_certifications
    WHERE user_id = $1
    `,
    [userId]
  );

  const docTypes = docsQuery.rows.map((doc) => doc.doc_type).filter(Boolean);
  const profile = profileQuery.rows[0]?.profile || {};

  return {
    user: userQuery.rows[0],
    profile,
    updated_at: profileQuery.rows[0]?.updated_at || null,
    updated_by: profileQuery.rows[0]?.updated_by || null,
    documents: docsQuery.rows || [],
    certifications_summary: {
      active: Number(certificationsQuery.rows[0]?.active_count || 0),
      expired: Number(certificationsQuery.rows[0]?.expired_count || 0),
      expiring_soon: Number(certificationsQuery.rows[0]?.expiring_soon_count || 0),
    },
    profile_last_reviewed_at: reviewQuery.rows[0]?.profile_last_reviewed_at || null,
    review_pending: isReviewPending(reviewQuery.rows[0]?.profile_last_reviewed_at || null),
    completion: {
      profile: computeProfileCompletion(profile),
      documents: computeDocumentsCompletion(docTypes),
    },
  };
};

const upsertCollaboratorProfile = async (userId, profilePayload = {}, actorId = null) => {
  await ensureCollaboratorTables();

  const existingQuery = await db.query(
    'SELECT profile FROM collaborator_profiles WHERE user_id = $1',
    [userId]
  );
  const existingProfile = existingQuery.rows[0]?.profile || {};
  const mergedProfile = mergeProfiles(existingProfile, profilePayload || {});

  const query = `
    INSERT INTO collaborator_profiles (user_id, profile, updated_by)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id)
    DO UPDATE SET profile = EXCLUDED.profile, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    RETURNING *
  `;

  const result = await db.query(query, [userId, mergedProfile, actorId]);

  try {
    const safeMetadata = pickProfileForMetadata(mergedProfile);
    const { rows: profileRows } = await db.query(
      'SELECT metadata FROM user_profile WHERE user_id = $1',
      [userId]
    );
    const currentMetadata = profileRows[0]?.metadata || {};
    const mergedMetadata = { ...currentMetadata };
    Object.entries(safeMetadata || {}).forEach(([section, values]) => {
      mergedMetadata[section] = { ...(mergedMetadata[section] || {}), ...values };
    });

    await db.query(
      `INSERT INTO user_profile (user_id, metadata, preferences, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET metadata = $2, updated_at = NOW()`,
      [userId, mergedMetadata, {}]
    );
  } catch (syncErr) {
    logger.warn({ syncErr, userId }, 'No se pudo sincronizar perfil a user_profile');
  }

  await logAction({
    user_id: actorId,
    module: 'collaborators',
    action: 'upsert_profile',
    entity: 'collaborator_profiles',
    entity_id: userId,
    details: { target_user_id: userId },
  });

  return result.rows[0];
};

const addCollaboratorDocument = async (userId, docType, file, actorId = null) => {
  await ensureCollaboratorTables();

  const userQuery = await db.query(
    'SELECT id, email, fullname FROM users WHERE id = $1',
    [userId]
  );

  if (!userQuery.rows[0]) {
    throw new Error('Usuario no encontrado');
  }

  const folderId = await resolveCollaboratorFolder(userQuery.rows[0]);

  let uploaded = { id: null, webViewLink: null, webContentLink: null, name: null };
  if (folderId) {
    const base64 = file.buffer.toString('base64');
    uploaded = await uploadBase64File(
      file.originalname || `${docType}.pdf`,
      base64,
      file.mimetype || 'application/octet-stream',
      folderId
    );
  } else {
    logger.warn('No se pudo resolver carpeta Drive para colaborador, se guarda sin Drive');
  }

  const insertQuery = `
    INSERT INTO collaborator_documents (
      user_id,
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
    userId,
    docType,
    uploaded.id || null,
    uploaded.webViewLink || uploaded.webContentLink || null,
    file.originalname || uploaded.name || docType,
    file.mimetype || null,
    actorId,
  ]);

  await logAction({
    user_id: actorId,
    module: 'collaborators',
    action: 'upload_document',
    entity: 'collaborator_documents',
    entity_id: insertResult.rows[0]?.id,
    details: { target_user_id: userId, doc_type: docType },
  });

  const docsQuery = await db.query(
    `SELECT id, doc_type, drive_file_id, drive_url, file_name, mime_type, uploaded_by, created_at
     FROM collaborator_documents
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return {
    document: insertResult.rows[0],
    documents: docsQuery.rows || [],
  };
};


const getCollaboratorStats = async () => {
    await ensureCollaboratorTables();

    const query = `
      SELECT
        u.id,
        cp.profile,
        up.metadata->>'profile_last_reviewed_at' AS profile_last_reviewed_at,
      (
        SELECT ARRAY_AGG(cd.doc_type)
        FROM collaborator_documents cd
        WHERE cd.user_id = u.id
      ) AS doc_types
      ,
      (
        SELECT COUNT(*)
        FROM user_certifications uc
        WHERE uc.user_id = u.id
          AND uc.is_active = true
          AND uc.expiry_date IS NOT NULL
          AND uc.expiry_date < CURRENT_DATE
      ) AS certifications_expired_count,
      (
        SELECT COUNT(*)
        FROM user_certifications uc
        WHERE uc.user_id = u.id
          AND uc.is_active = true
          AND uc.expiry_date IS NOT NULL
          AND uc.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')
      ) AS certifications_expiring_soon_count
      FROM users u
      LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      LEFT JOIN user_profile up ON up.user_id = u.id
      WHERE (COALESCE(cp.profile->'extra'->>'applicant_source','') <> 'google_forms'
        AND COALESCE((cp.profile->'extra' ? 'preguntas_adicionales'), false) = false)
    `;

    const { rows } = await db.query(query);

    let total = 0;
    let complete = 0;
    let sumCompletion = 0;
    let pending_review = 0;

    rows.forEach((row) => {
      total += 1;
      const profileCompletion = computeProfileCompletion(row.profile || {});
      const docTypes = Array.isArray(row.doc_types) ? row.doc_types : [];
      const documentsCompletion = computeDocumentsCompletion(docTypes);
      const overallTotal = profileCompletion.total + documentsCompletion.total;
      const overallDone = profileCompletion.done + documentsCompletion.done;
      const overallComplete = profileCompletion.complete && documentsCompletion.complete;

      if (overallComplete) complete += 1;
      if (overallTotal > 0) {
        sumCompletion += overallDone / overallTotal;
      }
      if (isReviewPending(row.profile_last_reviewed_at)) pending_review += 1;
    });

    const percent_complete = total > 0 ? Math.round((complete / total) * 100) : 0;
    const avg_completion = total > 0 ? Math.round((sumCompletion / total) * 100) : 0;

    const certifications_expired = rows.reduce((acc, row) => acc + Number(row.certifications_expired_count || 0), 0);
    const certifications_expiring_soon = rows.reduce((acc, row) => acc + Number(row.certifications_expiring_soon_count || 0), 0);

    return {
      total,
      complete,
      percent_complete,
      avg_completion,
      pending_review,
      certifications_expired,
      certifications_expiring_soon,
    };
  };

module.exports = {
  listCollaborators,
  getCollaboratorProfile,
  upsertCollaboratorProfile,
  addCollaboratorDocument,
  getCollaboratorStats,
};
