const db = require('../../config/db');
const logger = require('../../config/logger');
const { logAction } = require('../../utils/audit');
const { HASH_ALGORITHM, computeSha256HexFromBuffer, resolveExternalDriveIntegrity } = require('../../utils/documentHash');
const { ensureFolder, uploadBase64File, drive } = require('../../utils/drive');
const { PROFILE_SYNC_KEYS, collectNestedFields } = require('../shared/profileSync');
const {
  getCollaboratorDocumentDefinition,
  getRequiredCollaboratorDocumentCodes,
  normalizeCollaboratorDocumentType,
} = require('../shared/collaboratorDocumentCatalog');
const {
  buildEmptySummary,
  listQualificationsByUserId,
  summarizeQualificationsByUserIds,
} = require('../shared/collaboratorQualifications');

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
  'domicilio.movilizacion',
  'domicilio.telefono_fijo',
  'emergencia.persona_contacto',
  'emergencia.parentesco_contacto',
  'emergencia.telefono_contacto',
  'estudios.nivel_instruccion',
];

const PROFILE_PATHS = REQUIRED_PROFILE_FIELDS.map((field) => field.split('.'));
const PASSIVE_EMPLOYMENT_STATUSES = ["pasivo", "desvinculado", "inactivo"];
const REQUIRED_DOC_TYPES = getRequiredCollaboratorDocumentCodes();
const AUTOMATIC_INTEGRATED_DOC_TYPES = new Set([
  "DELIVERY_COMMUNICATION_TOOLS",
  "DELIVERY_LOGISTICS_TOOLS",
  "DELIVERY_WORK_TOOLS",
  "DELIVERY_WORK_CLOTHES",
  "DELIVERY_EPP",
]);
const COLLAB_ACTA_DOC_TYPE_BY_CATEGORY = {
  logistica: "DELIVERY_LOGISTICS_TOOLS",
  herramienta: "DELIVERY_WORK_TOOLS",
  ropa: "DELIVERY_WORK_CLOTHES",
  epp: "DELIVERY_EPP",
};

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
  const uploaded = new Set(
    docTypes
      .map((docType) => normalizeCollaboratorDocumentType(docType))
      .filter(Boolean)
  );
  const done = REQUIRED_DOC_TYPES.filter((doc) => uploaded.has(doc)).length;
  const total = REQUIRED_DOC_TYPES.length;
  return { total, done, complete: total > 0 && done === total };
};

const DOCUMENT_OWNER_AREA_DB_MAP = {
  profile: 'perfil',
  perfil: 'perfil',
  talento_humano: 'talento_humano',
  financiero: 'financiero',
  automatico: 'automatico',
};

const DOCUMENT_SOURCE_CHANNEL_DB_MAP = {
  profile: 'perfil',
  perfil: 'perfil',
  talento_humano: 'workspace_th',
  workspace_th: 'workspace_th',
  financiero: 'workspace_financiero',
  workspace_financiero: 'workspace_financiero',
  integracion: 'integracion',
  migracion: 'migracion',
};

const normalizeDocumentOwnerAreaForDb = (ownerArea) => {
  const normalized = String(ownerArea || '').trim().toLowerCase();
  return DOCUMENT_OWNER_AREA_DB_MAP[normalized] || null;
};

const normalizeDocumentSourceChannelForDb = (sourceChannel) => {
  const normalized = String(sourceChannel || '').trim().toLowerCase();
  return DOCUMENT_SOURCE_CHANNEL_DB_MAP[normalized] || null;
};

const enrichCollaboratorDocument = (document = {}) => {
  const definition = getCollaboratorDocumentDefinition(document.doc_type);
  return {
    ...document,
    canonical_doc_type: normalizeCollaboratorDocumentType(document.doc_type),
    document_label: definition?.label || null,
    owner_area: definition?.ownerArea || null,
    source_channel: definition?.sourceChannel || null,
  };
};

const buildIntegratedAutomaticDocument = ({
  docType,
  origin,
  integrationId,
  actaCode,
  generatedAt,
  signedAt,
  draftUrl,
  signedUrl,
  draftFileName,
  signedFileName,
}) =>
  enrichCollaboratorDocument({
    id: `${origin}:${integrationId}`,
    doc_type: docType,
    drive_url: signedUrl || draftUrl || null,
    draft_drive_url: draftUrl || null,
    signed_url: signedUrl || null,
    file_name: signedFileName || draftFileName || actaCode || null,
    mime_type: "application/pdf",
    uploaded_at: signedAt || generatedAt || null,
    created_at: generatedAt || null,
    integration_origin: origin,
    integration_reference_id: integrationId,
    integration_status: signedUrl ? "signed" : "draft",
    acta_code: actaCode || null,
    signed_at: signedAt || null,
    generated_at: generatedAt || null,
  });

const listIntegratedAutomaticDocuments = async (userId) => {
  const [collabActasQuery, tiActaQuery] = await Promise.all([
    db.query(
      `WITH ranked_actas AS (
         SELECT
           a.id,
           a.category,
           a.acta_code,
           a.generated_at,
           a.signed_at,
           a.pdf_drive_url,
           a.signed_pdf_drive_url,
           a.pdf_filename,
           a.signed_pdf_filename,
           ROW_NUMBER() OVER (
             PARTITION BY a.category
             ORDER BY a.generated_at DESC, a.id DESC
           ) AS row_num
         FROM public.collab_delivery_actas a
         WHERE a.recipient_user_id = $1
           AND a.active = true
           AND a.tipo = 'entrega'
           AND a.category IN ('logistica', 'herramienta', 'ropa', 'epp')
       )
       SELECT *
       FROM ranked_actas
       WHERE row_num = 1`,
      [userId],
    ),
    db.query(
      `WITH ranked_actas AS (
         SELECT
           a.id,
           a.acta_code,
           a.generated_at,
           a.signed_at,
           a.pdf_drive_url,
           a.signed_pdf_drive_url,
           a.pdf_filename,
           a.signed_pdf_filename,
           ROW_NUMBER() OVER (
             ORDER BY a.generated_at DESC, a.id DESC
           ) AS row_num
         FROM public.ti_asset_actas a
         WHERE a.recipient_user_id = $1
           AND a.active = true
           AND a.tipo = 'entrega'
       )
       SELECT *
       FROM ranked_actas
       WHERE row_num = 1`,
      [userId],
    ),
  ]);

  const integrated = [];

  for (const row of collabActasQuery.rows || []) {
    const docType = COLLAB_ACTA_DOC_TYPE_BY_CATEGORY[row.category];
    if (!docType) continue;
    integrated.push(
      buildIntegratedAutomaticDocument({
        docType,
        origin: "collab_deliveries",
        integrationId: row.id,
        actaCode: row.acta_code,
        generatedAt: row.generated_at,
        signedAt: row.signed_at,
        draftUrl: row.pdf_drive_url,
        signedUrl: row.signed_pdf_drive_url,
        draftFileName: row.pdf_filename,
        signedFileName: row.signed_pdf_filename,
      }),
    );
  }

  const latestTiActa = tiActaQuery.rows?.[0];
  if (latestTiActa) {
    integrated.push(
      buildIntegratedAutomaticDocument({
        docType: "DELIVERY_COMMUNICATION_TOOLS",
        origin: "ti_assets",
        integrationId: latestTiActa.id,
        actaCode: latestTiActa.acta_code,
        generatedAt: latestTiActa.generated_at,
        signedAt: latestTiActa.signed_at,
        draftUrl: latestTiActa.pdf_drive_url,
        signedUrl: latestTiActa.signed_pdf_drive_url,
        draftFileName: latestTiActa.pdf_filename,
        signedFileName: latestTiActa.signed_pdf_filename,
      }),
    );
  }

  return integrated;
};

const resolveLegacyQualificationPendingReason = (row = {}) => {
  const normalizedTitle = String(row.title || "").trim().toLowerCase();
  const normalizedCredentialType = String(row.credential_type || "").trim().toLowerCase();
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const normalizedQualificationType = String(metadata.qualification_type || "").trim().toLowerCase();
  const normalizedTitleLevel = String(
    metadata.nivel_titulo || metadata.education_level || metadata.degree_level || "",
  )
    .trim()
    .toLowerCase();

  if (normalizedTitle.includes("senescyt")) {
    return {
      code: "document_reclassification_required",
      label: "Debe reclasificarse como documento del expediente",
    };
  }

  if (
    normalizedCredentialType === "title" &&
    !normalizedQualificationType &&
    !normalizedTitleLevel
  ) {
    return {
      code: "title_level_missing",
      label: "Falta clasificar el nivel academico para migrarlo al expediente central",
    };
  }

  return {
    code: "manual_review_required",
    label: "Requiere revision manual antes de migrarse al expediente central",
  };
};

const getPendingLegacyQualifications = async (userId) => {
  const result = await db.query(
    `SELECT
        uc.id,
        uc.user_id,
        uc.title,
        uc.issuer,
        uc.issue_date,
        uc.expiry_date,
        uc.credential_type,
        uc.metadata,
        uc.file_url
     FROM user_certifications uc
     WHERE uc.user_id = $1
       AND uc.is_active = true
       AND NOT EXISTS (
         SELECT 1
         FROM collaborator_qualifications cq
         WHERE cq.metadata->'legacy'->>'legacy_id' = uc.id::text
       )
     ORDER BY uc.created_at DESC, uc.id DESC`,
    [userId],
  );

  const items = result.rows.map((row) => {
    const reason = resolveLegacyQualificationPendingReason(row);
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title || "Registro sin titulo",
      issuer: row.issuer || null,
      issue_date: row.issue_date || null,
      expiry_date: row.expiry_date || null,
      credential_type: row.credential_type || null,
      file_url: row.file_url || null,
      pending_reason_code: reason.code,
      pending_reason_label: reason.label,
      legacy_source: "user_certifications",
    };
  });

  return {
    total: items.length,
    items,
  };
};

const getPendingLegacyQualificationById = async (userId, legacyId, executor = db) => {
  const result = await executor.query(
    `SELECT
        uc.id,
        uc.user_id,
        uc.title,
        uc.issuer,
        uc.issue_date,
        uc.expiry_date,
        uc.credential_type,
        uc.metadata,
        uc.file_url,
        uc.drive_file_id
     FROM user_certifications uc
     WHERE uc.user_id = $1
       AND uc.id = $2
       AND uc.is_active = true
       AND NOT EXISTS (
         SELECT 1
         FROM collaborator_qualifications cq
         WHERE cq.metadata->'legacy'->>'legacy_id' = uc.id::text
       )
     LIMIT 1`,
    [userId, legacyId],
  );

  return result.rows[0] || null;
};

const resolvePendingLegacyQualification = async (
  userId,
  legacyId,
  resolution = {},
  actorId = null,
) => {
  await ensureCollaboratorTables();

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const pending = await getPendingLegacyQualificationById(userId, legacyId, client);
    if (!pending) {
      const error = new Error('Registro legacy pendiente no encontrado');
      error.status = 404;
      throw error;
    }

    const action = String(resolution?.action || '').trim().toLowerCase();
    if (!action) {
      const error = new Error('action es requerido');
      error.status = 400;
      throw error;
    }

    let outcome = null;

    if (action === 'migrate_qualification') {
      const qualificationType = String(resolution?.qualificationType || '')
        .trim()
        .toLowerCase();

      if (!['third_level_title', 'fourth_level_title', 'certification'].includes(qualificationType)) {
        const error = new Error('qualificationType invalido para migracion');
        error.status = 400;
        throw error;
      }

      const metadata = {
        ...(pending.metadata && typeof pending.metadata === 'object' ? pending.metadata : {}),
        manual_resolution: {
          resolved_by: actorId,
          resolved_at: new Date().toISOString(),
          action: 'migrate_qualification',
          qualification_type: qualificationType,
        },
        legacy: {
          source_table: 'user_certifications',
          legacy_id: pending.id,
          legacy_credential_type: pending.credential_type || null,
        },
      };

      const insertResult = await client.query(
        `
        INSERT INTO collaborator_qualifications (
          user_id,
          qualification_type,
          title,
          institution,
          issuer,
          issue_date,
          expiry_date,
          registration_number,
          metadata,
          drive_file_id,
          drive_url,
          file_name,
          mime_type,
          uploaded_by,
          is_active,
          created_at,
          updated_at
        )
        SELECT
          $1::integer,
          $2::varchar,
          $3::varchar,
          $4::varchar,
          $5::varchar,
          $6::date,
          $7::date,
          $8::varchar,
          $9::jsonb,
          $10::text,
          $11::text,
          $12::text,
          $13::text,
          $14::integer,
          true,
          NOW(),
          NOW()
        WHERE NOT EXISTS (
          SELECT 1
          FROM collaborator_qualifications cq
          WHERE cq.user_id = $1::integer
            AND cq.qualification_type = $2::varchar
            AND LOWER(TRIM(cq.title)) = LOWER(TRIM($3::varchar))
            AND COALESCE(LOWER(TRIM(cq.institution)), '') = COALESCE(LOWER(TRIM($4::varchar)), '')
        )
        RETURNING *
        `,
        [
          userId,
          qualificationType,
          pending.title || 'Registro academico',
          pending?.metadata?.institution || pending?.metadata?.entity || pending.issuer || null,
          pending.issuer || null,
          pending.issue_date || null,
          pending.expiry_date || null,
          pending?.metadata?.registration_number ||
            pending?.metadata?.credential_id ||
            pending?.metadata?.credentialId ||
            pending?.metadata?.folio ||
            null,
          JSON.stringify(metadata),
          pending.drive_file_id || null,
          pending.file_url || null,
          null,
          null,
          actorId,
        ],
      );

      await client.query(
        `UPDATE user_certifications
         SET is_active = false,
             updated_at = NOW()
         WHERE id = $1`,
        [pending.id],
      );

      outcome = {
        action: 'migrate_qualification',
        qualification: insertResult.rows[0] || null,
      };
    } else if (action === 'reclassify_document') {
      const normalizedDocType = normalizeCollaboratorDocumentType(
        resolution?.documentType || 'SENESCYT_RECORD',
      );
      if (normalizedDocType !== 'SENESCYT_RECORD') {
        const error = new Error('documentType invalido para reclasificacion');
        error.status = 400;
        throw error;
      }

      const definition = getCollaboratorDocumentDefinition(normalizedDocType);
      if (!definition) {
        const error = new Error('Definicion documental no encontrada');
        error.status = 400;
        throw error;
      }

      const ownerArea = normalizeDocumentOwnerAreaForDb(definition.ownerArea);
      const sourceChannel = normalizeDocumentSourceChannelForDb(definition.sourceChannel);

      const documentResult = await client.query(
        `
        INSERT INTO collaborator_documents (
          user_id,
          doc_type,
          drive_file_id,
          drive_url,
          file_name,
          mime_type,
          uploaded_by,
          category,
          owner_area,
          source_channel,
          visibility_scope,
          is_required,
          is_active
        )
        SELECT
          $1::integer,
          $2::text,
          $3::text,
          $4::text,
          $5::text,
          $6::text,
          $7::integer,
          'education',
          $8::varchar,
          $9::varchar,
          'talento_humano',
          $10::boolean,
          true
        WHERE NOT EXISTS (
          SELECT 1
          FROM collaborator_documents cd
          WHERE cd.user_id = $1::integer
            AND cd.doc_type = $2::text
            AND COALESCE(cd.drive_file_id, '') = COALESCE($3::text, '')
        )
        RETURNING *
        `,
        [
          userId,
          normalizedDocType,
          pending.drive_file_id || null,
          pending.file_url || null,
          pending.title || definition.label,
          null,
          actorId,
          ownerArea,
          sourceChannel,
          Boolean(definition.required),
        ],
      );

      await client.query(
        `UPDATE user_certifications
         SET is_active = false,
             updated_at = NOW()
         WHERE id = $1`,
        [pending.id],
      );

      outcome = {
        action: 'reclassify_document',
        document: documentResult.rows[0] || null,
      };
    } else {
      const error = new Error('Accion de resolucion no soportada');
      error.status = 400;
      throw error;
    }

    await client.query('COMMIT');

    await logAction({
      user_id: actorId,
      module: 'collaborators',
      action: 'resolve_legacy_qualification_pending',
      entity: 'user_certifications',
      entity_id: legacyId,
      details: {
        target_user_id: userId,
        resolution_action: outcome.action,
      },
    });

    return {
      ok: true,
      ...outcome,
      profile: await getCollaboratorProfile(userId),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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

const resolveProfileReviewedAt = (profile = {}, userProfileMetadata = {}) =>
  profile?.extra?.profile_last_reviewed_at ||
  userProfileMetadata?.profile_last_reviewed_at ||
  null;

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
      content_hash_sha256 VARCHAR(64),
      hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
      uploaded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await db.query(`
    ALTER TABLE collaborator_documents
    ADD COLUMN IF NOT EXISTS content_hash_sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS hash_algorithm VARCHAR(20) DEFAULT 'SHA-256';
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

  const { search, department_id, cargo, employment_status, page = 1, pageSize = 20 } = filters;

  const where = [
    `(COALESCE(cp.profile->'extra'->>'applicant_source','') <> 'google_forms' AND COALESCE((cp.profile->'extra' ? 'preguntas_adicionales'), false) = false)`,
  ];
  const params = [];
  let paramIndex = 1;
  const normalizedEmploymentStatus = String(employment_status || "all").trim().toLowerCase();

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

  if (normalizedEmploymentStatus === "active") {
    where.push(`u.active = true`);
    where.push(
      `LOWER(TRIM(COALESCE(cp.profile->'laboral'->>'estatus_empleado', 'activo'))) <> ALL($${paramIndex}::text[])`
    );
    params.push(PASSIVE_EMPLOYMENT_STATUSES);
    paramIndex += 1;
  } else if (normalizedEmploymentStatus === "passive" || normalizedEmploymentStatus === "offboarded") {
    where.push(
      `(u.active = false OR LOWER(TRIM(COALESCE(cp.profile->'laboral'->>'estatus_empleado', ''))) = ANY($${paramIndex}::text[]))`
    );
    params.push(PASSIVE_EMPLOYMENT_STATUSES);
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
      u.active,
      u.department_id,
      u.created_at,
      u.updated_at,
      d.name AS department_name,
      cp.profile->'laboral'->>'estatus_empleado' AS estatus_empleado,
      cp.profile,
      cp.updated_at AS profile_updated_at,
      up.metadata AS user_profile_metadata,
      (
        SELECT ARRAY_AGG(cd.doc_type)
        FROM collaborator_documents cd
        WHERE cd.user_id = u.id
      ) AS doc_types
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
  const qualificationSummaries = await summarizeQualificationsByUserIds(
    rows.map((row) => row.id)
  );

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
      const profileLastReviewedAt = resolveProfileReviewedAt(
        row.profile || {},
        row.user_profile_metadata || {}
      );
      const review_pending = isReviewPending(profileLastReviewedAt);
      const qualificationsState =
        qualificationSummaries.get(Number(row.id)) || {
          source: "collaborator_qualifications",
          summary: buildEmptySummary(),
        };
      return {
        ...row,
        certifications_count: Number(qualificationsState.summary.certifications_total || 0),
        certifications_expired_count: Number(qualificationsState.summary.expired || 0),
        certifications_expiring_soon_count: Number(qualificationsState.summary.expiring_soon || 0),
        qualifications_summary: qualificationsState.summary,
        qualifications_source: qualificationsState.source,
        profile_last_reviewed_at: profileLastReviewedAt,
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
    `SELECT
        u.id,
        u.email,
        u.fullname,
        u.role,
        u.active,
        u.department_id,
        d.name AS department_name,
        cp.profile->'laboral'->>'estatus_empleado' AS estatus_empleado
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  if (!userQuery.rows[0]) return null;

  const profileQuery = await db.query(
    'SELECT profile, updated_at, updated_by FROM collaborator_profiles WHERE user_id = $1',
    [userId]
  );

  const reviewQuery = await db.query(
    `SELECT metadata
     FROM user_profile
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  const docsQuery = await db.query(
    `SELECT id, doc_type, drive_file_id, drive_url, file_name, mime_type, content_hash_sha256, hash_algorithm, uploaded_by, created_at
     FROM collaborator_documents
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  const qualificationState = await listQualificationsByUserId(userId);
  const pendingLegacyQualifications = await getPendingLegacyQualifications(userId);
  const integratedAutomaticDocuments = await listIntegratedAutomaticDocuments(userId);

  let qualifications = qualificationState.qualifications || [];
  let qualificationsSummary = qualificationState.summary || buildEmptySummary();
  let qualificationsSource = qualificationState.source || "collaborator_qualifications";

  const persistedDocuments = (docsQuery.rows || []).map(enrichCollaboratorDocument);
  const mergedDocuments = [
    ...persistedDocuments.filter(
      (document) => !AUTOMATIC_INTEGRATED_DOC_TYPES.has(document.canonical_doc_type),
    ),
    ...integratedAutomaticDocuments,
  ].sort((left, right) => {
    const leftDate = new Date(left.uploaded_at || left.created_at || 0).getTime();
    const rightDate = new Date(right.uploaded_at || right.created_at || 0).getTime();
    return rightDate - leftDate;
  });

  const docTypes = mergedDocuments.map((doc) => doc.doc_type).filter(Boolean);
  const profile = profileQuery.rows[0]?.profile || {};

  return {
    user: userQuery.rows[0],
    profile,
    updated_at: profileQuery.rows[0]?.updated_at || null,
    updated_by: profileQuery.rows[0]?.updated_by || null,
    documents: mergedDocuments,
    qualifications,
    qualifications_summary: qualificationsSummary,
    qualifications_source: qualificationsSource,
    qualification_migration_pending: pendingLegacyQualifications,
    certifications_summary: {
      active: Number(qualificationsSummary.active || 0),
      expired: Number(qualificationsSummary.expired || 0),
      expiring_soon: Number(qualificationsSummary.expiring_soon || 0),
    },
    profile_last_reviewed_at: resolveProfileReviewedAt(
      profile,
      reviewQuery.rows[0]?.metadata || {}
    ),
    review_pending: isReviewPending(
      resolveProfileReviewedAt(profile, reviewQuery.rows[0]?.metadata || {})
    ),
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
  const contentHashSha256 = computeSha256HexFromBuffer(file?.buffer);
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
      content_hash_sha256,
      hash_algorithm,
      uploaded_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  const insertResult = await db.query(insertQuery, [
    userId,
    docType,
    uploaded.id || null,
    uploaded.webViewLink || uploaded.webContentLink || null,
    file.originalname || uploaded.name || docType,
    file.mimetype || null,
    contentHashSha256,
    HASH_ALGORITHM,
    actorId,
  ]);

  const newDoc = insertResult.rows[0];

  // Si no hay hash pero hay file_id, intentar resolver integridad en segundo plano
  if (!contentHashSha256 && newDoc?.drive_file_id) {
    resolveExternalDriveIntegrity(newDoc.drive_file_id, drive)
      .then(async (result) => {
        if (result) {
          await db.query(
            `UPDATE collaborator_documents SET content_hash_sha256 = $1, hash_algorithm = $2 WHERE id = $3`,
            [result.hash, result.algorithm, newDoc.id]
          );
          logger.info({ fileId: newDoc.drive_file_id }, 'Integridad resuelta para documento de colaborador');
        }
      })
      .catch((err) => logger.warn({ err }, 'Error asíncrono resolviendo integridad de colaborador'));
  }

  await logAction({
    user_id: actorId,
    module: 'collaborators',
    action: 'upload_document',
    entity: 'collaborator_documents',
    entity_id: insertResult.rows[0]?.id,
    details: {
      target_user_id: userId,
      doc_type: docType,
      content_hash_sha256: contentHashSha256,
      hash_algorithm: HASH_ALGORITHM,
    },
  });

  const docsQuery = await db.query(
    `SELECT id, doc_type, drive_file_id, drive_url, file_name, mime_type, content_hash_sha256, hash_algorithm, uploaded_by, created_at
     FROM collaborator_documents
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  const integratedAutomaticDocuments = await listIntegratedAutomaticDocuments(userId);
  const persistedDocuments = (docsQuery.rows || []).map(enrichCollaboratorDocument);
  const mergedDocuments = [
    ...persistedDocuments.filter(
      (document) => !AUTOMATIC_INTEGRATED_DOC_TYPES.has(document.canonical_doc_type),
    ),
    ...integratedAutomaticDocuments,
  ].sort((left, right) => {
    const leftDate = new Date(left.uploaded_at || left.created_at || 0).getTime();
    const rightDate = new Date(right.uploaded_at || right.created_at || 0).getTime();
    return rightDate - leftDate;
  });

  return {
    document: insertResult.rows[0],
    documents: mergedDocuments,
  };
};


const getCollaboratorStats = async () => {
    await ensureCollaboratorTables();

    const query = `
      SELECT
        u.id,
        cp.profile,
        up.metadata AS user_profile_metadata,
      (
        SELECT ARRAY_AGG(cd.doc_type)
        FROM collaborator_documents cd
        WHERE cd.user_id = u.id
      ) AS doc_types
      FROM users u
      LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      LEFT JOIN user_profile up ON up.user_id = u.id
      WHERE (COALESCE(cp.profile->'extra'->>'applicant_source','') <> 'google_forms'
        AND COALESCE((cp.profile->'extra' ? 'preguntas_adicionales'), false) = false)
    `;

    const { rows } = await db.query(query);

    const qualificationSummaries = await summarizeQualificationsByUserIds(
      rows.map((row) => row.id),
    );

    let total = 0;
    let complete = 0;
    let sumCompletion = 0;
    let pending_review = 0;
    let certifications_expired = 0;
    let certifications_expiring_soon = 0;

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
      if (
        isReviewPending(
          resolveProfileReviewedAt(row.profile || {}, row.user_profile_metadata || {})
        )
      ) {
        pending_review += 1;
      }

      const summary =
        qualificationSummaries.get(Number(row.id))?.summary || buildEmptySummary();
      certifications_expired += Number(summary.expired || 0);
      certifications_expiring_soon += Number(summary.expiring_soon || 0);
    });

    const percent_complete = total > 0 ? Math.round((complete / total) * 100) : 0;
    const avg_completion = total > 0 ? Math.round((sumCompletion / total) * 100) : 0;

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
  resolvePendingLegacyQualification,
  getCollaboratorStats,
};
