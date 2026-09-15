const crypto = require('crypto');
const db = require('../../config/db');
const kickoff = require('../kickoff/kickoff.service');

const EVENT_TYPE = 'famdays';
const ADMIN_ROLE = 'jefe_ti';

const EVENT_TRANSITIONS = {
  draft: ['scheduled', 'active'],
  scheduled: ['active'],
  active: ['scheduled'],
};

const mapEvent = (r) => r ? ({
  id: r.id,
  event_type: r.event_type,
  name: r.name,
  description: r.description,
  event_date: r.event_date,
  status: r.status,
  moderation_active: r.moderation_active,
  is_open: r.is_open ?? false,
  created_by: r.created_by,
  updated_by: r.updated_by,
  created_at: r.created_at,
  updated_at: r.updated_at,
}) : null;

const mapGeneralQuestion = (r) => ({
  id: r.id,
  presentation_id: r.presentation_id,
  presentation_title: r.presentation_title || null,
  user_id: r.user_id,
  type: r.type || 'question',
  display_name: (r.is_anonymous || r.type === 'aporte') ? 'Anonimo' : (r.display_name || r.user_fullname || 'Sin nombre'),
  question_text: r.question_text,
  answer_text: r.answer_text || null,
  answered_at: r.answered_at || null,
  status: r.status,
  is_anonymous: r.is_anonymous,
  is_highlighted: r.is_highlighted,
  created_at: r.created_at,
  updated_at: r.updated_at,
});

async function assertFamDaysEvent(eventId) {
  const event = await getEventById(eventId);
  if (!event) throw Object.assign(new Error('Evento FamDays no encontrado'), { status: 404 });
  return event;
}

function isFamDaysAdmin(user) {
  return String(user?.role || '').toLowerCase() === ADMIN_ROLE;
}

async function isConfigurator(userId) {
  if (!userId) return false;
  const { rows } = await db.query(
    'SELECT 1 FROM famdays_configurators WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return rows.length > 0;
}

async function getAccessForUser(user) {
  const is_admin = isFamDaysAdmin(user);
  const is_configurator = is_admin || await isConfigurator(user?.id);
  return {
    can_access: true,
    is_admin,
    is_configurator,
  };
}

async function assertCanConfigure(user) {
  const access = await getAccessForUser(user);
  if (!access.is_configurator) {
    throw Object.assign(new Error('Solo el administrador o configuradores FamDays pueden realizar esta accion'), { status: 403 });
  }
  return access;
}

const REPORT_ROLES = new Set(['gerencia_general']);

async function assertCanViewReport(user) {
  const access = await getAccessForUser(user);
  const role = String(user?.role || '').toLowerCase();
  if (!access.is_configurator && !REPORT_ROLES.has(role)) {
    throw Object.assign(new Error('No autorizado para ver el reporte de FamDays'), { status: 403 });
  }
  return access;
}

async function assertCanAdmin(user) {
  if (!isFamDaysAdmin(user)) {
    throw Object.assign(new Error('Solo jefe_ti puede administrar configuradores FamDays'), { status: 403 });
  }
}

async function listConfigurators() {
  const { rows } = await db.query(`
    SELECT fc.user_id,
           fc.assigned_by,
           fc.created_at,
           u.fullname,
           u.email,
           u.role
    FROM famdays_configurators fc
    JOIN users u ON u.id = fc.user_id
    ORDER BY u.fullname ASC NULLS LAST, u.email ASC
  `);
  return rows;
}

async function replaceConfigurators(userIds = [], assignedBy) {
  const uniqueIds = [...new Set((userIds || []).map((id) => Number(id)).filter(Number.isInteger))].slice(0, 1);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM famdays_configurators');
    for (const userId of uniqueIds) {
      await client.query(
        `INSERT INTO famdays_configurators (user_id, assigned_by)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET assigned_by = EXCLUDED.assigned_by`,
        [userId, assignedBy || null]
      );
    }
    await client.query('COMMIT');
    return listConfigurators();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function autoActivateScheduledEvents() {
  await db.query(
    `UPDATE kickoff_events
        SET status = 'scheduled',
            is_open = FALSE,
            updated_at = NOW()
      WHERE event_type = $1
        AND status NOT IN ('scheduled','active')`,
    [EVENT_TYPE]
  );
  await db.query(
    `UPDATE kickoff_events
        SET status = 'active',
            is_open = TRUE,
            updated_at = NOW()
      WHERE event_type = $1
        AND status = 'scheduled'
        AND event_date <= CURRENT_DATE`,
    [EVENT_TYPE]
  );
}

async function listEvents() {
  await autoActivateScheduledEvents();
  const { rows } = await db.query(`
    SELECT ke.*, COUNT(kp.id)::int AS presentation_count
    FROM kickoff_events ke
    LEFT JOIN kickoff_presentations kp ON kp.event_id = ke.id
    WHERE ke.event_type = $1
    GROUP BY ke.id
    ORDER BY ke.event_date DESC, ke.created_at DESC
  `, [EVENT_TYPE]);
  return rows.map((r) => ({ ...mapEvent(r), presentation_count: r.presentation_count }));
}

async function getCurrentEvent() {
  await autoActivateScheduledEvents();
  const { rows } = await db.query(`
    SELECT *
    FROM kickoff_events
    WHERE event_type = $1
      AND status IN ('scheduled','active')
    ORDER BY event_date ASC
    LIMIT 1
  `, [EVENT_TYPE]);
  return mapEvent(rows[0]);
}

async function getAdminCurrentEvent() {
  await autoActivateScheduledEvents();
  const { rows } = await db.query(`
    SELECT *
    FROM kickoff_events
    WHERE event_type = $1
      AND status IN ('scheduled','active')
    ORDER BY created_at DESC
    LIMIT 1
  `, [EVENT_TYPE]);
  return mapEvent(rows[0]);
}

async function getEventById(eventId) {
  await autoActivateScheduledEvents();
  const { rows } = await db.query(
    'SELECT * FROM kickoff_events WHERE id = $1 AND event_type = $2',
    [eventId, EVENT_TYPE]
  );
  return mapEvent(rows[0]);
}

async function createEvent(payload, userId) {
  const { name, description, event_date, status = 'scheduled', moderation_active = true } = payload;
  if (!name || !event_date) {
    throw Object.assign(new Error('name y event_date son requeridos'), { status: 400 });
  }
  const normalizedStatus = status === 'active' ? 'active' : 'scheduled';
  const { rows } = await db.query(`
    INSERT INTO kickoff_events
      (name, description, event_date, status, moderation_active, is_open, event_type, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
    RETURNING *
  `, [name, description || null, event_date, normalizedStatus, moderation_active, normalizedStatus === 'active', EVENT_TYPE, userId]);
  return mapEvent(rows[0]);
}

async function updateEvent(eventId, patch, userId) {
  const event = await assertFamDaysEvent(eventId);
  if (patch.status && !['scheduled', 'active'].includes(patch.status)) {
    throw Object.assign(new Error('FamDays solo permite estados programado o activo'), { status: 400 });
  }

  if (patch.status && patch.status !== event.status) {
    const allowed = EVENT_TRANSITIONS[event.status] || [];
    if (!allowed.includes(patch.status)) {
      throw Object.assign(new Error(`Transicion de estado invalida: ${event.status} -> ${patch.status}`), { status: 400 });
    }
  }

  const fields = {
    name: patch.name,
    description: patch.description,
    event_date: patch.event_date,
    status: patch.status,
    moderation_active: patch.moderation_active,
    is_open: patch.status ? patch.status === 'active' : patch.is_open,
  };
  const values = [];
  const clauses = [];
  for (const [column, value] of Object.entries(fields)) {
    if (value !== undefined) {
      values.push(value);
      clauses.push(`${column} = $${values.length}`);
    }
  }
  if (clauses.length === 0) return event;
  values.push(userId, eventId, EVENT_TYPE);
  const updatedByIdx = values.length - 2;
  const eventIdIdx = values.length - 1;
  const eventTypeIdx = values.length;
  const { rows } = await db.query(`
    UPDATE kickoff_events
    SET ${clauses.join(', ')}, updated_by = $${updatedByIdx}, updated_at = NOW()
    WHERE id = $${eventIdIdx} AND event_type = $${eventTypeIdx}
    RETURNING *
  `, values);
  return mapEvent(rows[0]);
}

async function deleteEvent(eventId) {
  const event = await assertFamDaysEvent(eventId);
  if (event.status === 'active') {
    throw Object.assign(new Error('No se puede eliminar un evento activo'), { status: 400 });
  }
  await db.query('DELETE FROM kickoff_events WHERE id = $1 AND event_type = $2', [eventId, EVENT_TYPE]);
}

async function getPresentationsByEvent(eventId, userId = null) {
  await assertFamDaysEvent(eventId);
  return kickoff.getPresentationsByEvent(eventId, userId);
}

async function createPresentation(eventId, payload, userId) {
  await assertFamDaysEvent(eventId);
  return kickoff.createPresentation(eventId, {
    ...payload,
    presenter_user_id: userId,
    status: 'pending',
  }, userId);
}

async function getPresentationById(presentationId) {
  const presentation = await kickoff.getPresentationById(presentationId);
  if (!presentation) return null;
  await assertFamDaysEvent(presentation.event_id);
  return presentation;
}

async function updatePresentation(presentationId, patch, userId) {
  await getPresentationById(presentationId);
  const { status: _status, presenter_user_id: _presenterUserId, ...safePatch } = patch || {};
  return kickoff.updatePresentation(presentationId, {
    ...safePatch,
    presenter_user_id: userId,
  }, userId);
}

async function deletePresentation(presentationId) {
  await getPresentationById(presentationId);
  return kickoff.deletePresentation(presentationId);
}

async function getActivePresentationForEvent(eventId) {
  await assertFamDaysEvent(eventId);
  const { rows } = await db.query(`
    SELECT *
    FROM kickoff_presentations
    WHERE event_id = $1
      AND scheduled_start IS NOT NULL
      AND scheduled_start <= NOW()
      AND (scheduled_end IS NULL OR scheduled_end >= NOW())
    ORDER BY
      sort_order ASC,
      scheduled_start DESC
    LIMIT 1
  `, [eventId]);
  if (rows[0]) return kickoff.getPresentationById(rows[0].id);

  const { rows: fallbackRows } = await db.query(`
    SELECT *
    FROM kickoff_presentations
    WHERE event_id = $1
      AND scheduled_start IS NOT NULL
      AND scheduled_start <= NOW()
    ORDER BY scheduled_start DESC, sort_order DESC
    LIMIT 1
  `, [eventId]);
  return fallbackRows[0] ? kickoff.getPresentationById(fallbackRows[0].id) : null;
}

async function getQuestionPresentationForEvent(eventId) {
  await assertFamDaysEvent(eventId);
  const activePresentation = await getActivePresentationForEvent(eventId);
  if (activePresentation?.id) return activePresentation;

  const { rows } = await db.query(`
    SELECT *
    FROM kickoff_presentations
    WHERE event_id = $1
    ORDER BY
      COALESCE(sort_order, 0) ASC,
      scheduled_start ASC NULLS LAST,
      created_at ASC
    LIMIT 1
  `, [eventId]);
  return rows[0] ? kickoff.getPresentationById(rows[0].id) : null;
}

async function getQuestionsByEvent(eventId, { status } = {}) {
  await assertFamDaysEvent(eventId);
  const params = [eventId];
  let query = `
    SELECT kq.*,
           u.fullname AS user_fullname,
           kp.title AS presentation_title,
           kp.sort_order
    FROM kickoff_questions kq
    JOIN kickoff_presentations kp ON kp.id = kq.presentation_id
    LEFT JOIN users u ON u.id = kq.user_id
    WHERE kp.event_id = $1
      AND kq.type = 'question'
      AND kq.status != 'hidden'
      AND COALESCE(kp.is_intro, FALSE) = FALSE`;

  if (status) {
    params.push(status);
    query += ` AND kq.status = $${params.length}`;
  }

  query += `
    ORDER BY
      kq.is_highlighted DESC,
      kq.created_at ASC,
      kp.sort_order ASC`;

  const { rows } = await db.query(query, params);
  return rows.map(mapGeneralQuestion);
}

async function createEventQuestion(eventId, payload, userId) {
  const event = await assertFamDaysEvent(eventId);
  if (event.status !== 'active' || !event.is_open) {
    throw Object.assign(new Error('El evento FamDays aun no esta activo'), { status: 409 });
  }

  const presentation = await getQuestionPresentationForEvent(eventId);
  if (!presentation) {
    throw Object.assign(new Error('Agrega al menos una presentacion para registrar preguntas.'), { status: 409 });
  }

  return createQuestion(presentation.id, payload, userId);
}

async function createQuestion(presentationId, payload, userId) {
  const presentation = await getPresentationById(presentationId);
  if (!presentation) {
    throw Object.assign(new Error('Presentacion no encontrada'), { status: 404 });
  }

  const event = await assertFamDaysEvent(presentation.event_id);
  if (event.status !== 'active') {
    throw Object.assign(new Error('El evento FamDays aun no esta activo'), { status: 409 });
  }

  const { question_text, display_name, is_anonymous = false, type = 'question' } = payload || {};
  const normalizedType = type === 'aporte' ? 'aporte' : 'question';
  const text = String(question_text || '').trim();
  if (text.length < 5) throw Object.assign(new Error('El texto debe tener al menos 5 caracteres'), { status: 400 });
  if (text.length > 1000) throw Object.assign(new Error('El texto no puede exceder 1000 caracteres'), { status: 400 });

  const initialStatus = normalizedType === 'aporte'
    ? 'approved'
    : (event.moderation_active ? 'under_review' : 'approved');

  const { rows } = await db.query(`
    INSERT INTO kickoff_questions
      (presentation_id, user_id, display_name, question_text, status, is_anonymous, type)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
  `, [
    presentation.id,
    userId || null,
    (is_anonymous || normalizedType === 'aporte') ? null : (display_name || null),
    text,
    initialStatus,
    is_anonymous || normalizedType === 'aporte',
    normalizedType,
  ]);

  return rows[0];
}

async function generateEventQrToken(eventId, userId, expiresInHours = null) {
  await assertFamDaysEvent(eventId);
  await db.query(
    'UPDATE famdays_event_qr_tokens SET is_active = FALSE, updated_at = NOW() WHERE event_id = $1',
    [eventId]
  );
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 3_600_000) : null;
  const { rows } = await db.query(`
    INSERT INTO famdays_event_qr_tokens (event_id, token, expires_at, is_active, created_by)
    VALUES ($1,$2,$3,TRUE,$4)
    RETURNING *
  `, [eventId, token, expiresAt, userId]);
  return rows[0];
}

async function getActiveQrForEvent(eventId) {
  await assertFamDaysEvent(eventId);
  const { rows } = await db.query(
    'SELECT * FROM famdays_event_qr_tokens WHERE event_id = $1 AND is_active = TRUE LIMIT 1',
    [eventId]
  );
  return rows[0] || null;
}

async function validateQrToken(token) {
  const { rows } = await db.query(`
    SELECT qt.*, ke.name AS event_name, ke.status AS event_status, ke.is_open
    FROM famdays_event_qr_tokens qt
    JOIN kickoff_events ke ON ke.id = qt.event_id
    WHERE qt.token = $1 AND ke.event_type = $2
  `, [token, EVENT_TYPE]);
  const qr = rows[0];
  if (!qr) return { valid: false, reason: 'QR invalido o no existe' };
  if (!qr.is_active) return { valid: false, reason: 'Este QR ha sido desactivado' };
  if (qr.expires_at && new Date() > new Date(qr.expires_at)) return { valid: false, reason: 'Este QR ha expirado' };
  if (['finished', 'cancelled'].includes(qr.event_status)) return { valid: false, reason: 'El evento ha finalizado' };
  if (qr.event_status !== 'active') return { valid: false, reason: 'El evento aun esta programado' };
  if (!qr.is_open) return { valid: false, reason: 'El evento aun no esta abierto' };

  const presentation = await getActivePresentationForEvent(qr.event_id);
  return {
    valid: true,
    event_id: qr.event_id,
    event_name: qr.event_name,
    event_status: qr.event_status,
    presentation_id: presentation?.id || null,
    presentation_title: presentation?.title || 'Preguntas generales',
    presentation_status: presentation?.status || null,
    waiting: false,
  };
}

module.exports = {
  getAccessForUser,
  assertCanConfigure,
  assertCanViewReport,
  assertCanAdmin,
  listConfigurators,
  replaceConfigurators,
  listEvents,
  getCurrentEvent,
  getAdminCurrentEvent,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getPresentationsByEvent,
  createPresentation,
  getPresentationById,
  updatePresentation,
  deletePresentation,
  startPresentation: kickoff.startPresentation,
  finishPresentation: kickoff.finishPresentation,
  getBlocksByPresentation: kickoff.getBlocksByPresentation,
  getQuestions: kickoff.getQuestions,
  getQuestionsByEvent,
  createQuestion,
  createEventQuestion,
  moderateQuestion: kickoff.moderateQuestion,
  rateAporte: kickoff.rateAporte,
  getAporteRankings: kickoff.getAporteRankings,
  getEventSummary: kickoff.getEventSummary,
  getPostEventQA: kickoff.getPostEventQA,
  getActivePresentationForEvent,
  generateEventQrToken,
  getActiveQrForEvent,
  validateQrToken,
};
