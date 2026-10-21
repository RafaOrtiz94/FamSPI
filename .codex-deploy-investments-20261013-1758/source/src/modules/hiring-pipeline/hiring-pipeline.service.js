/**
 * Hiring Pipeline Service
 * Gestiona el proceso de evaluación y contratación de postulantes
 */

const db = require('../../config/db');
const logger = require('../../config/logger');
const { logAction } = require('../../utils/audit');
const pipelineNotifications = require('./hiring-pipeline.notifications');
const { getApplicantById } = require('../applicants/applicants.service');
const {
  addPersonnelDocument,
  hirePersonnelRequest,
} = require('../personnel-requests/personnel-requests.service');
const { createPipelineMeetingEvent } = require('../calendar/calendar.service');

const MEETING_STAGES = ['primera_entrevista', 'entrevista_gerencia'];

const STAGE_ORDER = [
  'revision_perfil',
  'verificacion_referencias',
  'primera_entrevista',
  'prueba_habilidades',
  'evaluacion_psicologica',
  'entrevista_gerencia',
  'oferta_contratacion',
];

const STAGE_LABELS = {
  revision_perfil:       'Revisión del perfil',
  verificacion_referencias:'Verificación de referencias',
  primera_entrevista:    'Primera entrevista',
  prueba_habilidades:    'Prueba de habilidades',
  evaluacion_psicologica:'Evaluación psicológica',
  entrevista_gerencia:   'Entrevista con gerencia',
  oferta_contratacion:   'Oferta y contratación',
  completado:            'Proceso completado',
};

function nextStage(current) {
  const idx = STAGE_ORDER.indexOf(current);
  return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : 'completado';
}

function hasApprovedStageResult(entry, stage) {
  return Array.isArray(entry?.stage_results)
    && entry.stage_results.some((item) => item?.stage === stage && item?.result === 'aprobado');
}

function isLegacyReferenceVerificationPending(entry, stage) {
  if (stage !== 'verificacion_referencias') return false;
  if (entry?.status !== 'en_evaluacion') return false;
  if (entry?.current_stage === stage) return false;

  const currentIdx = STAGE_ORDER.indexOf(entry?.current_stage);
  const referenceIdx = STAGE_ORDER.indexOf(stage);

  return currentIdx > referenceIdx && !hasApprovedStageResult(entry, stage);
}

// ── Consultas base ────────────────────────────────────────────────────────────

async function ensurePipelineTables() {
  // Las tablas se crean via migración 220 y 221
  // Esta función es un no-op: existe para compatibilidad con el patrón del proyecto
}

async function getPipelineForRequest(requestId) {
  const { rows } = await db.query(`
    SELECT
      pe.id,
      pe.applicant_id,
      pe.request_id,
      pe.status,
      pe.current_stage,
      pe.rejection_stage,
      pe.rejection_reason,
      pe.started_at,
      pe.ended_at,
      pe.started_by,
      a.fullname   AS applicant_name,
      a.email      AS applicant_email,
      a.profile    AS applicant_profile,
      u.fullname   AS started_by_name,
      COALESCE(
        json_agg(
          json_build_object(
            'id',           sr.id,
            'stage',        sr.stage,
            'status',       sr.status,
            'result',       sr.result,
            'score',        sr.score,
            'observations', sr.observations,
            'data',         sr.data,
            'completed_at', sr.completed_at
          ) ORDER BY sr.id
        ) FILTER (WHERE sr.id IS NOT NULL),
        '[]'
      ) AS stage_results
    FROM applicant_pipeline_entries pe
    JOIN applicants a ON a.id = pe.applicant_id
    LEFT JOIN users u ON u.id = pe.started_by
    LEFT JOIN applicant_stage_results sr ON sr.entry_id = pe.id
    WHERE pe.request_id = $1
    GROUP BY pe.id, a.fullname, a.email, a.profile, u.fullname
    ORDER BY pe.started_at ASC
  `, [requestId]);

  return rows.map(r => ({ ...r, stage_label: STAGE_LABELS[r.current_stage] || r.current_stage }));
}

async function getEntryById(entryId) {
  const { rows } = await db.query(`
    SELECT
      pe.*,
      a.fullname       AS applicant_name,
      a.email          AS applicant_email,
      a.profile        AS applicant_profile,
      COALESCE(app_docs.documents, '[]'::jsonb) AS applicant_documents,
      u.fullname       AS started_by_name,
      COALESCE(
        json_agg(
          json_build_object(
            'id',           sr.id,
            'stage',        sr.stage,
            'status',       sr.status,
            'result',       sr.result,
            'score',        sr.score,
            'observations', sr.observations,
            'data',         sr.data,
            'completed_at', sr.completed_at
          ) ORDER BY sr.id
        ) FILTER (WHERE sr.id IS NOT NULL),
        '[]'
      ) AS stage_results,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id',                 sp.id,
            'proposal_number',    sp.proposal_number,
            'base_salary',        sp.base_salary,
            'currency',           sp.currency,
            'benefits',           sp.benefits,
            'extra_notes',        sp.extra_notes,
            'sent_at',            sp.sent_at,
            'applicant_response', sp.applicant_response,
            'response_notes',     sp.response_notes,
            'created_at',         sp.created_at
          )
        ) FILTER (WHERE sp.id IS NOT NULL),
        '[]'
      ) AS salary_proposals
    FROM applicant_pipeline_entries pe
    JOIN applicants a ON a.id = pe.applicant_id
    LEFT JOIN users u ON u.id = pe.started_by
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ad.id,
          'doc_type', ad.doc_type,
          'drive_file_id', ad.drive_file_id,
          'drive_url', ad.drive_url,
          'file_name', ad.file_name,
          'mime_type', ad.mime_type,
          'content_hash_sha256', ad.content_hash_sha256,
          'hash_algorithm', ad.hash_algorithm,
          'created_at', ad.created_at
        )
        ORDER BY ad.created_at DESC, ad.id DESC
      ) AS documents
      FROM applicant_documents ad
      WHERE ad.applicant_id = a.id
    ) app_docs ON true
    LEFT JOIN applicant_stage_results sr ON sr.entry_id = pe.id
    LEFT JOIN hiring_salary_proposals sp ON sp.entry_id = pe.id
    WHERE pe.id = $1
    GROUP BY pe.id, a.fullname, a.email, a.profile, app_docs.documents, u.fullname
  `, [entryId]);

  if (!rows[0]) return null;

  const entry = rows[0];
  const applicantSnapshot = await getApplicantById(entry.applicant_id);

  if (applicantSnapshot) {
    entry.applicant_snapshot = applicantSnapshot;
    entry.applicant_documents = applicantSnapshot.documents || entry.applicant_documents || [];
    entry.applicant_profile = applicantSnapshot.profile || entry.applicant_profile || {};
    entry.applicant_education = applicantSnapshot.education || [];
    entry.applicant_trainings = applicantSnapshot.trainings || [];
    entry.applicant_personal_references = applicantSnapshot.personal_references || [];
    entry.applicant_work_experience = applicantSnapshot.work_experience || [];
    entry.applicant_work_references = applicantSnapshot.work_references || [];
  }

  // Ordenar proposals por número
  if (Array.isArray(entry.salary_proposals)) {
    entry.salary_proposals.sort((a, b) => a.proposal_number - b.proposal_number);
  }
  entry.stage_label = STAGE_LABELS[entry.current_stage] || entry.current_stage;
  entry.stage_order = STAGE_ORDER;
  entry.stage_labels = STAGE_LABELS;

  // Adjuntar collaborator_user_id desde la solicitud de personal (disponible tras contratar)
  if (entry.request_id) {
    const prRow = await db.query(
      'SELECT collaborator_user_id FROM personnel_requests WHERE id = $1',
      [entry.request_id]
    );
    entry.collaborator_user_id = prRow.rows[0]?.collaborator_user_id || null;
  }

  return entry;
}

// ── Operaciones del pipeline ──────────────────────────────────────────────────

async function startEvaluation({ requestId, applicantId, userId }) {
  // Verificar que no exista ya un entry activo
  const existing = await db.query(
    `SELECT id, status FROM applicant_pipeline_entries WHERE applicant_id = $1 AND request_id = $2`,
    [applicantId, requestId]
  );

  if (existing.rows[0]) {
    if (existing.rows[0].status === 'rechazado') {
      throw Object.assign(new Error('Este postulante ya fue rechazado en este proceso. Usa reactivar para reabrirlo.'), { status: 409 });
    }
    return getEntryById(existing.rows[0].id);
  }

  const { rows } = await db.query(`
    INSERT INTO applicant_pipeline_entries
      (applicant_id, request_id, status, current_stage, started_by)
    VALUES ($1, $2, 'en_evaluacion', 'revision_perfil', $3)
    RETURNING id
  `, [applicantId, requestId, userId]);

  const entryId = rows[0].id;

  await logAction({
    userId,
    action: 'pipeline_start',
    entity: 'applicant_pipeline_entries',
    entityId: entryId,
    details: { applicantId, requestId },
  });

  return getEntryById(entryId);
}

async function advanceStage({ entryId, stage, data = {}, observations, score, userId }) {
  const entry = await getEntryById(entryId);
  if (!entry) throw Object.assign(new Error('Proceso no encontrado'), { status: 404 });
  if (entry.status !== 'en_evaluacion') {
    throw Object.assign(new Error('Este postulante no está en evaluación activa'), { status: 409 });
  }
  const isLegacyCatchup = isLegacyReferenceVerificationPending(entry, stage);
  if (entry.current_stage !== stage && !isLegacyCatchup) {
    throw Object.assign(new Error(`La etapa activa es "${entry.stage_label}", no "${STAGE_LABELS[stage] || stage}"`), { status: 409 });
  }

  const next = nextStage(stage);

  await db.query(`
    INSERT INTO applicant_stage_results
      (entry_id, stage, status, data, observations, score, result, completed_by, completed_at)
    VALUES ($1, $2, 'completado', $3, $4, $5, 'aprobado', $6, NOW())
    ON CONFLICT (entry_id, stage) DO UPDATE SET
      status = 'completado',
      data = EXCLUDED.data,
      observations = EXCLUDED.observations,
      score = EXCLUDED.score,
      result = 'aprobado',
      completed_by = EXCLUDED.completed_by,
      completed_at = NOW(),
      updated_at = NOW()
  `, [entryId, stage, data, observations || null, score || null, userId]);

  const stageToPersist = isLegacyCatchup ? entry.current_stage : next;

  await db.query(`
    UPDATE applicant_pipeline_entries
    SET current_stage = $1, updated_at = NOW()
    WHERE id = $2
  `, [stageToPersist, entryId]);

  await logAction({
    userId,
    action: 'pipeline_stage_advance',
    entity: 'applicant_pipeline_entries',
    entityId: entryId,
    details: { from: stage, to: stageToPersist, score, observations, legacyCatchup: isLegacyCatchup },
  });

  return getEntryById(entryId);
}

async function updateStageData({ entryId, stage, data, userId }) {
  let enrichedData = { ...data };

  // Para etapas de entrevista que se agendan como virtuales sin enlace:
  // crear automáticamente un evento en Google Calendar con Google Meet.
  if (
    MEETING_STAGES.includes(stage) &&
    data.phase === 'scheduled' &&
    data.modality === 'virtual' &&
    !data.meeting_link
  ) {
    try {
      const entry = await getEntryById(entryId);
      const stageLabel = stage === 'primera_entrevista' ? 'Primera entrevista' : 'Entrevista con gerencia';
      const calResult = await createPipelineMeetingEvent({
        summary: `${stageLabel} — ${entry?.applicant_name || 'Postulante'}`,
        description: data.pre_notes || '',
        startAt: data.meeting_datetime,
        durationMinutes: 60,
        attendees: [entry?.applicant_email].filter(Boolean),
        withMeet: true,
      });
      if (calResult?.meetLink) {
        enrichedData.meeting_link = calResult.meetLink;
        enrichedData.calendar_event_id = calResult.eventId;
      }
    } catch (err) {
      logger.warn({ err, entryId, stage }, 'No se pudo crear evento de Google Meet para entrevista');
    }
  }

  await db.query(`
    INSERT INTO applicant_stage_results
      (entry_id, stage, status, data)
    VALUES ($1, $2, 'en_progreso', $3)
    ON CONFLICT (entry_id, stage) DO UPDATE SET
      data = $3,
      status = CASE WHEN applicant_stage_results.status = 'completado' THEN 'completado' ELSE 'en_progreso' END,
      updated_at = NOW()
  `, [entryId, stage, enrichedData]);

  await db.query(
    `UPDATE applicant_pipeline_entries SET updated_at = NOW() WHERE id = $1`,
    [entryId]
  );

  return getEntryById(entryId);
}

async function rejectApplicant({ entryId, stage, reason, userId }) {
  const entry = await getEntryById(entryId);
  if (!entry) throw Object.assign(new Error('Proceso no encontrado'), { status: 404 });
  if (entry.status !== 'en_evaluacion') {
    throw Object.assign(new Error('Este postulante no está en evaluación activa'), { status: 409 });
  }

  await db.query(`
    INSERT INTO applicant_stage_results
      (entry_id, stage, status, result, observations, completed_by, completed_at)
    VALUES ($1, $2, 'completado', 'rechazado', $3, $4, NOW())
    ON CONFLICT (entry_id, stage) DO UPDATE SET
      status = 'completado',
      result = 'rechazado',
      observations = EXCLUDED.observations,
      completed_by = EXCLUDED.completed_by,
      completed_at = NOW(),
      updated_at = NOW()
  `, [entryId, stage, reason || null, userId]);

  await db.query(`
    UPDATE applicant_pipeline_entries
    SET status = 'rechazado',
        rejection_stage = $1,
        rejection_reason = $2,
        ended_at = NOW(),
        updated_at = NOW()
    WHERE id = $3
  `, [stage, reason || null, entryId]);

  await logAction({
    userId,
    action: 'pipeline_reject',
    entity: 'applicant_pipeline_entries',
    entityId: entryId,
    details: { stage, reason },
  });

  return getEntryById(entryId);
}

async function reactivateApplicant({ entryId, reason, userId }) {
  const entry = await getEntryById(entryId);
  if (!entry) throw Object.assign(new Error('Proceso no encontrado'), { status: 404 });
  if (entry.status !== 'rechazado') {
    throw Object.assign(new Error('Solo se puede reactivar un postulante rechazado'), { status: 409 });
  }

  const reactivateAtStage = entry.rejection_stage || 'revision_perfil';

  await db.query(`
    UPDATE applicant_pipeline_entries
    SET status = 'en_evaluacion',
        current_stage = $1,
        rejection_stage = NULL,
        rejection_reason = NULL,
        ended_at = NULL,
        updated_at = NOW()
    WHERE id = $2
  `, [reactivateAtStage, entryId]);

  // Eliminar el resultado de rechazo de esa etapa para que pueda re-evaluarse
  await db.query(`
    UPDATE applicant_stage_results
    SET result = NULL, status = 'en_progreso', observations = $1, updated_at = NOW()
    WHERE entry_id = $2 AND stage = $3 AND result = 'rechazado'
  `, [`Reactivado: ${reason || 'sin motivo especificado'}`, entryId, reactivateAtStage]);

  await logAction({
    userId,
    action: 'pipeline_reactivate',
    entity: 'applicant_pipeline_entries',
    entityId: entryId,
    details: { reactivateAtStage, reason },
  });

  return getEntryById(entryId);
}

// ── Propuestas salariales ─────────────────────────────────────────────────────

async function createSalaryProposal({ entryId, baseSalary, currency = 'USD', benefits, extraNotes, userId }) {
  const entry = await getEntryById(entryId);
  if (!entry) throw Object.assign(new Error('Proceso no encontrado'), { status: 404 });
  if (entry.current_stage !== 'oferta_contratacion' && entry.status === 'en_evaluacion') {
    throw Object.assign(new Error('El postulante aún no llegó a la etapa de oferta'), { status: 409 });
  }

  // Número de propuesta siguiente
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(proposal_number), 0) + 1 AS next_number FROM hiring_salary_proposals WHERE entry_id = $1`,
    [entryId]
  );
  const proposalNumber = rows[0].next_number;

  await db.query(`
    INSERT INTO hiring_salary_proposals
      (entry_id, proposal_number, base_salary, currency, benefits, extra_notes, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [entryId, proposalNumber, baseSalary, currency, benefits || null, extraNotes || null, userId]);

  return getEntryById(entryId);
}

async function updateSalaryProposalResponse({ proposalId, response, responseNotes, userId }) {
  const { rows } = await db.query(
    `UPDATE hiring_salary_proposals SET applicant_response = $1, response_notes = $2, updated_at = NOW() WHERE id = $3 RETURNING entry_id`,
    [response, responseNotes || null, proposalId]
  );
  if (!rows[0]) throw Object.assign(new Error('Propuesta no encontrada'), { status: 404 });
  return getEntryById(rows[0].entry_id);
}

// ── Oferta salarial (documento) ───────────────────────────────────────────────

async function uploadSalaryOfferDocument({ entryId, file, userId }) {
  const entry = await getEntryById(entryId);
  if (!entry) throw Object.assign(new Error('Proceso no encontrado'), { status: 404 });
  if (!file?.buffer) throw Object.assign(new Error('Archivo requerido'), { status: 400 });
  if (!entry.request_id) {
    throw Object.assign(new Error('El proceso no está vinculado a una solicitud de personal'), { status: 409 });
  }

  const { document: offerDoc } = await addPersonnelDocument(
    entry.request_id,
    'OFERTA_SALARIAL',
    file,
    userId
  );

  const stageData = (entry.stage_results || []).find(s => s.stage === 'oferta_contratacion')?.data || {};
  const updatedData = {
    ...stageData,
    offer_drive_id: offerDoc.drive_file_id,
    offer_drive_url: offerDoc.drive_url,
    offer_file_name: offerDoc.file_name,
    offer_uploaded_at: new Date().toISOString(),
  };

  await db.query(`
    INSERT INTO applicant_stage_results (entry_id, stage, status, data)
    VALUES ($1, 'oferta_contratacion', 'en_progreso', $2)
    ON CONFLICT (entry_id, stage) DO UPDATE SET data = $2, updated_at = NOW()
  `, [entryId, updatedData]);

  await logAction({
    userId,
    action: 'pipeline_salary_offer_upload',
    entity: 'applicant_pipeline_entries',
    entityId: entryId,
    details: { fileName: offerDoc.file_name, requestId: entry.request_id },
  });

  return getEntryById(entryId);
}

// ── Contrato firmado ──────────────────────────────────────────────────────────

async function uploadSignedContract({ entryId, file, userId }) {
  const entry = await getEntryById(entryId);
  if (!entry) throw Object.assign(new Error('Proceso no encontrado'), { status: 404 });
  if (!file?.buffer) throw Object.assign(new Error('Archivo de contrato requerido'), { status: 400 });
  if (!entry.request_id) {
    throw Object.assign(new Error('El proceso no está vinculado a una solicitud de personal'), { status: 409 });
  }

  // Verificar que hay oferta salarial subida
  const stageDataCheck = (entry.stage_results || []).find(s => s.stage === 'oferta_contratacion')?.data || {};
  if (!stageDataCheck.offer_drive_id) {
    throw Object.assign(new Error('Debes subir la oferta salarial antes de subir el contrato firmado.'), { status: 409 });
  }

  const { document: contractDoc } = await addPersonnelDocument(
    entry.request_id,
    'CONTRACT_FAM',
    file,
    userId
  );

  // Guardar en data de la etapa de oferta_contratacion
  const stageData = (entry.stage_results || []).find(s => s.stage === 'oferta_contratacion')?.data || {};
  const updatedData = {
    ...stageData,
    contract_drive_id: contractDoc.drive_file_id,
    contract_drive_url: contractDoc.drive_url,
    contract_file_name: contractDoc.file_name,
    contract_mime_type: contractDoc.mime_type,
    contract_doc_type: contractDoc.doc_type,
    contract_uploaded_at: new Date().toISOString(),
  };

  await db.query(`
    INSERT INTO applicant_stage_results (entry_id, stage, status, data)
    VALUES ($1, 'oferta_contratacion', 'en_progreso', $2)
    ON CONFLICT (entry_id, stage) DO UPDATE SET data = $2, updated_at = NOW()
  `, [entryId, updatedData]);

  await logAction({
    userId,
    action: 'pipeline_contract_upload',
    entity: 'applicant_pipeline_entries',
    entityId: entryId,
    details: {
      fileName: contractDoc.file_name,
      requestId: entry.request_id,
      docType: contractDoc.doc_type,
    },
  });

  // Intentar finalizar la contratación automáticamente al subir el contrato.
  // Si falla (perfil o documentos incompletos), el contrato queda guardado y
  // el usuario puede corregir y finalizar manualmente.
  try {
    await finalizeHiring({ entryId, requestId: entry.request_id, userId });
  } catch (err) {
    logger.warn({ err, entryId }, 'Auto-finalización no completada tras subir contrato');
  }

  return getEntryById(entryId);
}

// ── Finalizar contratación ────────────────────────────────────────────────────

async function finalizeHiring({ entryId, requestId, userId }) {
  const entry = await getEntryById(entryId);
  if (!entry) throw Object.assign(new Error('Proceso no encontrado'), { status: 404 });

  const contractStage = (entry.stage_results || []).find(s => s.stage === 'oferta_contratacion');
  if (!contractStage?.data?.contract_drive_id) {
    throw Object.assign(new Error('Se requiere el contrato firmado subido antes de finalizar'), { status: 409 });
  }

  await db.query(`
    UPDATE personnel_requests
    SET applicant_id = $1, updated_at = NOW()
    WHERE id = $2
      AND COALESCE(applicant_id, 0) <> $1
  `, [entry.applicant_id, requestId]);

  const hireResult = await hirePersonnelRequest(requestId, userId, { fromPipeline: true });

  // Marcar el pipeline como contratado
  await db.query(`
    UPDATE applicant_pipeline_entries
    SET status = 'contratado', current_stage = 'completado', ended_at = NOW(), updated_at = NOW()
    WHERE id = $1
  `, [entryId]);

  // Completar la etapa de oferta_contratacion
  await db.query(`
    UPDATE applicant_stage_results
    SET status = 'completado', result = 'aprobado', completed_by = $1, completed_at = NOW(), updated_at = NOW()
    WHERE entry_id = $2 AND stage = 'oferta_contratacion'
  `, [userId, entryId]);

  await logAction({
    userId,
    action: 'pipeline_finalize_hiring',
    entity: 'applicant_pipeline_entries',
    entityId: entryId,
    details: {
      applicantId: entry.applicant_id,
      requestId,
      collaboratorUserId: hireResult?.collaborator_user_id || null,
    },
  });

  try {
    await pipelineNotifications.notifyHiringComplete({
      applicantEmail: entry.applicant_email,
      applicantName: entry.applicant_name,
      requestId,
    });
  } catch (err) {
    logger.warn({ err }, 'No se pudo enviar notificación de contratación');
  }

  return getEntryById(entryId);
}

// ── Asignaciones de prueba técnica del usuario actual ─────────────────────────

async function getMyTestAssignments(userId) {
  const { rows } = await db.query(`
    SELECT
      sr.entry_id,
      sr.stage,
      sr.data,
      sr.status        AS stage_status,
      sr.result        AS stage_result,
      sr.score         AS stage_score,
      sr.observations  AS stage_observations,
      pe.status        AS entry_status,
      pe.current_stage,
      a.fullname       AS applicant_name,
      a.email          AS applicant_email,
      pr.position_title AS position
    FROM applicant_stage_results sr
    JOIN applicant_pipeline_entries pe ON pe.id = sr.entry_id
    JOIN applicants a ON a.id = pe.applicant_id
    LEFT JOIN personnel_requests pr ON pr.id = pe.request_id
    WHERE sr.stage = 'prueba_habilidades'
      AND (sr.data->>'assigned_to_id')::int = $1
      AND (pe.status = 'en_evaluacion' OR (sr.result IS NOT NULL AND sr.completed_at > NOW() - INTERVAL '30 days'))
    ORDER BY sr.created_at DESC
  `, [userId]);
  return rows;
}

async function confirmTestDate({ entryId, selectedDatetime, userId }) {
  const { rows } = await db.query(
    `SELECT data FROM applicant_stage_results WHERE entry_id = $1 AND stage = 'prueba_habilidades'`,
    [entryId]
  );
  if (!rows.length) throw Object.assign(new Error('Etapa no encontrada'), { status: 404 });
  const currentData = rows[0].data || {};
  if (String(currentData.assigned_to_id) !== String(userId)) {
    throw Object.assign(new Error('No autorizado: no eres el responsable asignado de esta prueba'), { status: 403 });
  }

  const newData = { ...currentData, selected_datetime: selectedDatetime, phase: 'confirmed' };
  await db.query(
    `UPDATE applicant_stage_results SET data = $1, updated_at = NOW() WHERE entry_id = $2 AND stage = 'prueba_habilidades'`,
    [newData, entryId]
  );
  await db.query(`UPDATE applicant_pipeline_entries SET updated_at = NOW() WHERE id = $1`, [entryId]);

  await logAction({
    userId,
    action: 'pipeline_test_date_confirmed',
    entity: 'applicant_pipeline_entries',
    entityId: entryId,
    details: { selectedDatetime },
  });

  return { data: newData };
}

async function submitTestResult({ entryId, score, observations, decision, reason, userId }) {
  const { rows } = await db.query(
    `SELECT data FROM applicant_stage_results WHERE entry_id = $1 AND stage = 'prueba_habilidades'`,
    [entryId]
  );
  if (!rows.length) throw Object.assign(new Error('Etapa no encontrada'), { status: 404 });
  const currentData = rows[0].data || {};
  if (String(currentData.assigned_to_id) !== String(userId)) {
    throw Object.assign(new Error('No autorizado: no eres el responsable asignado de esta prueba'), { status: 403 });
  }

  const updatedData = { ...currentData, score, result_observations: observations };

  if (decision === 'aprobado') {
    return advanceStage({
      entryId,
      stage: 'prueba_habilidades',
      data: updatedData,
      observations,
      score: parseFloat(score),
      userId,
    });
  }

  // Rechazado: guardar datos actualizados y luego rechazar
  await db.query(
    `UPDATE applicant_stage_results SET data = $1, updated_at = NOW() WHERE entry_id = $2 AND stage = 'prueba_habilidades'`,
    [updatedData, entryId]
  );
  return rejectApplicant({ entryId, stage: 'prueba_habilidades', reason: reason || observations, userId });
}

// ── Usuarios internos (para selects de responsable / gerencia) ────────────────

async function getInternalUsers() {
  const { rows } = await db.query(`
    SELECT id, fullname, email, role
    FROM users
    WHERE COALESCE(active, true) = true AND role NOT IN ('postulante')
    ORDER BY fullname ASC
  `);
  return rows;
}

async function getUsersByRole(roles) {
  const { rows } = await db.query(`
    SELECT id, fullname, email, role
    FROM users
    WHERE COALESCE(active, true) = true AND role = ANY($1::text[])
    ORDER BY fullname ASC
  `, [roles]);
  return rows;
}

module.exports = {
  STAGE_ORDER,
  STAGE_LABELS,
  hasApprovedStageResult,
  isLegacyReferenceVerificationPending,
  getPipelineForRequest,
  getEntryById,
  startEvaluation,
  advanceStage,
  updateStageData,
  rejectApplicant,
  reactivateApplicant,
  createSalaryProposal,
  updateSalaryProposalResponse,
  uploadSalaryOfferDocument,
  uploadSignedContract,
  finalizeHiring,
  getInternalUsers,
  getUsersByRole,
  getMyTestAssignments,
  confirmTestDate,
  submitTestResult,
};
