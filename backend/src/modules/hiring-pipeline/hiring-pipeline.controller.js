/**
 * Hiring Pipeline Controller
 */

const svc = require('./hiring-pipeline.service');
const ntf = require('./hiring-pipeline.notifications');
const { createPipelineMeetingEvent } = require('../calendar/calendar.service');
const logger = require('../../config/logger');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

function err(res, error) {
  const status = error.status || 500;
  logger.warn({ error: error.message }, '[hiring-pipeline] error');
  return res.status(status).json({ ok: false, message: error.message || 'Error interno' });
}

async function scheduleMeetingNotifications({ stage, data, result, user }) {
  const notifiableStages = ['primera_entrevista', 'evaluacion_psicologica', 'entrevista_gerencia'];
  if (!notifiableStages.includes(stage)) return;
  if (!data?.meeting_datetime || data?.phase !== 'scheduled') return;
  if (data?.meeting_summary?.trim()) return;

  try {
    await ntf.notifyMeetingScheduled({
      applicantEmail: result.applicant_email,
      applicantName: result.applicant_name,
      stageName: svc.STAGE_LABELS[stage],
      meetingDatetime: data.meeting_datetime,
      modality: data.modality,
      meetingLink: data.meeting_link,
      notes: data.pre_notes,
    });
  } catch (e) {
    logger.warn({ e, stage, entryId: result?.id }, 'No se pudo enviar notificación de reunión');
  }

  try {
    const internalEmails = [user?.email].filter(Boolean);
    await createPipelineMeetingEvent({
      summary: `${svc.STAGE_LABELS[stage]} - ${result.applicant_name}`,
      description: `${svc.STAGE_LABELS[stage]} en proceso de selección.\nPostulante: ${result.applicant_name}${data.pre_notes ? '\n\nNotas: ' + data.pre_notes : ''}`,
      startAt: data.meeting_datetime,
      durationMinutes: 60,
      attendees: internalEmails,
      location: data.modality === 'virtual' ? (data.meeting_link || 'Videollamada') : 'Instalaciones',
    });
  } catch (e) {
    logger.warn({ e, stage, entryId: result?.id }, 'No se pudo crear evento de calendario para reunión');
  }
}

// ── Pipeline de una solicitud ─────────────────────────────────────────────────

const getRequestPipeline = async (req, res) => {
  try {
    const data = await svc.getPipelineForRequest(req.params.requestId);
    ok(res, data);
  } catch (e) { err(res, e); }
};

// ── Iniciar evaluación ────────────────────────────────────────────────────────

const startEvaluation = async (req, res) => {
  try {
    const { applicant_id } = req.body;
    if (!applicant_id) return res.status(400).json({ ok: false, message: 'applicant_id requerido' });
    const data = await svc.startEvaluation({
      requestId: req.params.requestId,
      applicantId: applicant_id,
      userId: req.user.id,
    });
    ok(res, data, 201);
  } catch (e) { err(res, e); }
};

// ── Detalle de un entry ───────────────────────────────────────────────────────

const getEntry = async (req, res) => {
  try {
    const data = await svc.getEntryById(req.params.entryId);
    if (!data) return res.status(404).json({ ok: false, message: 'Proceso no encontrado' });
    ok(res, data);
  } catch (e) { err(res, e); }
};

// ── Avanzar etapa ─────────────────────────────────────────────────────────────

const advanceStage = async (req, res) => {
  try {
    const { data, observations, score } = req.body;
    const result = await svc.advanceStage({
      entryId: req.params.entryId,
      stage: req.params.stage,
      data: data || {},
      observations,
      score,
      userId: req.user.id,
    });

    ok(res, result);
  } catch (e) { err(res, e); }
};

// ── Guardar datos parciales de etapa ─────────────────────────────────────────

const updateStageData = async (req, res) => {
  try {
    const result = await svc.updateStageData({
      entryId: req.params.entryId,
      stage: req.params.stage,
      data: req.body.data || {},
      userId: req.user.id,
    });

    await scheduleMeetingNotifications({
      stage: req.params.stage,
      data: req.body.data || {},
      result,
      user: req.user,
    });

    // Si es prueba de habilidades y se está asignando responsable: notificar
    if (req.params.stage === 'prueba_habilidades' && req.body.data?.assigned_to_email && req.body.notify_assignment) {
      try {
        await ntf.notifyTechnicalTestAssigned({
          responsibleEmail: req.body.data.assigned_to_email,
          responsibleName: req.body.data.assigned_to_name,
          applicantName: result.applicant_name,
          availableFrom: req.body.data.available_from,
          availableTo: req.body.data.available_to,
          entryId: req.params.entryId,
        });
      } catch (e) { logger.warn({ e }, 'No se pudo notificar al responsable de prueba'); }
    }

    // Si es prueba y se confirma la fecha: notificar a los 3 + calendar
    if (req.params.stage === 'prueba_habilidades' && req.body.data?.selected_datetime && req.body.notify_confirmation) {
      try {
        await ntf.notifyTechnicalTestConfirmed({
          applicantEmail: result.applicant_email,
          applicantName: result.applicant_name,
          responsibleEmail: req.body.data.assigned_to_email,
          responsibleName: req.body.data.assigned_to_name,
          thEmail: req.user.email,
          selectedDatetime: req.body.data.selected_datetime,
        });
      } catch (e) { logger.warn({ e }, 'No se pudo notificar confirmación de prueba técnica'); }

      // Evento de calendario para TH y responsable
      try {
        const internalEmails = [req.user.email, req.body.data.assigned_to_email].filter(Boolean);
        await createPipelineMeetingEvent({
          summary: `Prueba técnica — ${result.applicant_name}`,
          description: `Prueba de habilidades en proceso de selección.\nPostulante: ${result.applicant_name}\nResponsable: ${req.body.data.assigned_to_name}`,
          startAt: req.body.data.selected_datetime,
          durationMinutes: 90,
          attendees: internalEmails,
        });
      } catch (e) { logger.warn({ e }, 'No se pudo crear evento de calendario para prueba técnica'); }
    }

    ok(res, result);
  } catch (e) { err(res, e); }
};

// ── Rechazar postulante ───────────────────────────────────────────────────────

const rejectApplicant = async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await svc.rejectApplicant({
      entryId: req.params.entryId,
      stage: req.params.stage,
      reason,
      userId: req.user.id,
    });
    ok(res, result);
  } catch (e) { err(res, e); }
};

// ── Reactivar postulante ──────────────────────────────────────────────────────

const reactivateApplicant = async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await svc.reactivateApplicant({
      entryId: req.params.entryId,
      reason,
      userId: req.user.id,
    });
    ok(res, result);
  } catch (e) { err(res, e); }
};

// ── Propuestas salariales ─────────────────────────────────────────────────────

const createSalaryProposal = async (req, res) => {
  try {
    const { base_salary, currency, benefits, extra_notes } = req.body;
    if (!base_salary) return res.status(400).json({ ok: false, message: 'base_salary requerido' });
    const result = await svc.createSalaryProposal({
      entryId: req.params.entryId,
      baseSalary: base_salary,
      currency,
      benefits,
      extraNotes: extra_notes,
      userId: req.user.id,
    });
    ok(res, result, 201);
  } catch (e) { err(res, e); }
};

const updateProposalResponse = async (req, res) => {
  try {
    const { response, response_notes } = req.body;
    if (!['aceptada', 'rechazada', 'pendiente'].includes(response)) {
      return res.status(400).json({ ok: false, message: 'response debe ser aceptada, rechazada o pendiente' });
    }
    const result = await svc.updateSalaryProposalResponse({
      proposalId: req.params.proposalId,
      response,
      responseNotes: response_notes,
      userId: req.user.id,
    });
    ok(res, result);
  } catch (e) { err(res, e); }
};

// ── Oferta salarial (documento) ───────────────────────────────────────────────

const uploadSalaryOffer = [
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, message: 'Archivo requerido' });
      const result = await svc.uploadSalaryOfferDocument({
        entryId: req.params.entryId,
        file: req.file,
        userId: req.user.id,
      });
      ok(res, result);
    } catch (e) { err(res, e); }
  },
];

// ── Contrato firmado ──────────────────────────────────────────────────────────

const uploadContract = [
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, message: 'Archivo requerido' });
      const result = await svc.uploadSignedContract({
        entryId: req.params.entryId,
        file: req.file,
        userId: req.user.id,
      });
      ok(res, result);
    } catch (e) { err(res, e); }
  },
];

// ── Finalizar contratación ────────────────────────────────────────────────────

const finalizeHiring = async (req, res) => {
  try {
    const result = await svc.finalizeHiring({
      entryId: req.params.entryId,
      requestId: req.params.requestId,
      userId: req.user.id,
    });
    ok(res, result);
  } catch (e) { err(res, e); }
};

// ── Asignaciones del usuario actual (responsable de prueba) ──────────────────

const getMyTestAssignments = async (req, res) => {
  try {
    const data = await svc.getMyTestAssignments(req.user.id);
    ok(res, data);
  } catch (e) { err(res, e); }
};

const confirmTestDate = async (req, res) => {
  try {
    const data = await svc.confirmTestDate({
      entryId: req.params.entryId,
      selectedDatetime: req.body.selected_datetime,
      userId: req.user.id,
    });
    ok(res, data);
  } catch (e) { err(res, e); }
};

const submitTestResult = async (req, res) => {
  try {
    const data = await svc.submitTestResult({
      entryId: req.params.entryId,
      score: req.body.score,
      observations: req.body.observations,
      decision: req.body.decision,
      reason: req.body.reason,
      userId: req.user.id,
    });
    ok(res, data);
  } catch (e) { err(res, e); }
};

// ── Usuarios internos ─────────────────────────────────────────────────────────

const getInternalUsers = async (req, res) => {
  try {
    const data = await svc.getInternalUsers();
    ok(res, data);
  } catch (e) { err(res, e); }
};

const getUsersByRole = async (req, res) => {
  try {
    const roles = (req.query.roles || '').split(',').map(r => r.trim()).filter(Boolean);
    const data = await svc.getUsersByRole(roles);
    ok(res, data);
  } catch (e) { err(res, e); }
};

module.exports = {
  getRequestPipeline,
  startEvaluation,
  getEntry,
  advanceStage,
  updateStageData,
  rejectApplicant,
  reactivateApplicant,
  createSalaryProposal,
  updateProposalResponse,
  uploadSalaryOffer,
  uploadContract,
  finalizeHiring,
  getInternalUsers,
  getUsersByRole,
  getMyTestAssignments,
  confirmTestDate,
  submitTestResult,
};
