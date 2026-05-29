const db     = require('../../config/db');
const crypto = require('crypto');
const logger = require('../../config/logger');

// ─── FSM transition tables ────────────────────────────────────────────────────

const EVENT_TRANSITIONS = {
  draft:     ['scheduled', 'cancelled'],
  scheduled: ['active', 'cancelled'],
  active:    ['paused', 'finished', 'cancelled'],
  paused:    ['active', 'cancelled'],
  finished:  [],
  cancelled: [],
};

const PRESENTATION_TRANSITIONS = {
  pending:          ['ready', 'skipped'],
  ready:            ['active', 'skipped'],
  active:           ['questions_open', 'finished', 'skipped'],
  questions_open:   ['questions_closed', 'finished'],
  questions_closed: ['finished'],
  finished:         [],
  skipped:          ['pending'],
};

// ─── row mappers ──────────────────────────────────────────────────────────────

const mapEvent = (r) => ({
  id:                r.id,
  name:              r.name,
  description:       r.description,
  event_date:        r.event_date,
  status:            r.status,
  moderation_active: r.moderation_active,
  is_open:           r.is_open ?? false,
  created_by:        r.created_by,
  updated_by:        r.updated_by,
  created_at:        r.created_at,
  updated_at:        r.updated_at,
});

const mapPresentation = (r) => ({
  id:                  r.id,
  event_id:            r.event_id,
  presenter_user_id:   r.presenter_user_id,
  presenter_name:      r.presenter_name || null,
  title:               r.title,
  description:         r.description,
  scheduled_start:     r.scheduled_start,
  scheduled_end:       r.scheduled_end,
  canva_url:           r.canva_url,
  canva_embed_url:     r.canva_embed_url,
  fallback_url:        r.fallback_url,
  status:              r.status,
  current_block_order: r.current_block_order,
  sort_order:          r.sort_order,
  created_at:          r.created_at,
  updated_at:          r.updated_at,
});

const mapBlock = (r) => ({
  id:              r.id,
  presentation_id: r.presentation_id,
  title:           r.title,
  content:         r.content,
  image_url:       r.image_url,
  block_type:      r.block_type,
  sort_order:      r.sort_order,
  is_active:       r.is_active,
  created_at:      r.created_at,
  updated_at:      r.updated_at,
});

const mapQuestion = (r) => ({
  id:              r.id,
  presentation_id: r.presentation_id,
  user_id:         r.user_id,
  type:            r.type || 'question',
  // Aportes are always shown as anonymous
  display_name:    (r.is_anonymous || r.type === 'aporte') ? 'Anónimo' : (r.display_name || r.user_fullname || 'Sin nombre'),
  question_text:   r.question_text,
  status:          r.status,
  is_anonymous:    r.is_anonymous,
  is_highlighted:  r.is_highlighted,
  avg_rating:      r.avg_rating  ? parseFloat(r.avg_rating)  : null,
  rating_count:    r.rating_count ? parseInt(r.rating_count) : 0,
  created_at:      r.created_at,
  updated_at:      r.updated_at,
});

// ─── helper: build update SET clause ─────────────────────────────────────────

function buildUpdateSet(fields, values, idx = 1) {
  const clauses = [];
  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) {
      clauses.push(`${col} = $${idx++}`);
      values.push(val);
    }
  }
  return { clauses, nextIdx: idx };
}

// ─── events ───────────────────────────────────────────────────────────────────

async function getCurrentEvent() {
  const { rows } = await db.query(`
    SELECT * FROM kickoff_events
    WHERE status IN ('scheduled','active','paused')
    ORDER BY event_date ASC
    LIMIT 1
  `);
  return rows[0] ? mapEvent(rows[0]) : null;
}

// For admin config — includes draft so admins can manage events before publishing
async function getAdminCurrentEvent() {
  const { rows } = await db.query(`
    SELECT * FROM kickoff_events
    WHERE status NOT IN ('finished','cancelled')
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return rows[0] ? mapEvent(rows[0]) : null;
}

async function getEventById(eventId) {
  const { rows } = await db.query(
    'SELECT * FROM kickoff_events WHERE id = $1',
    [eventId]
  );
  return rows[0] ? mapEvent(rows[0]) : null;
}

async function createEvent(payload, userId) {
  const { name, description, event_date, status = 'draft', moderation_active = true } = payload;
  if (!name || !event_date) throw Object.assign(new Error('name y event_date son requeridos'), { status: 400 });

  const { rows } = await db.query(
    `INSERT INTO kickoff_events (name, description, event_date, status, moderation_active, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING *`,
    [name, description || null, event_date, status, moderation_active, userId]
  );
  return mapEvent(rows[0]);
}

async function updateEvent(eventId, patch, userId) {
  const event = await getEventById(eventId);
  if (!event) throw Object.assign(new Error('Evento no encontrado'), { status: 404 });

  if (patch.status && patch.status !== event.status) {
    const allowed = EVENT_TRANSITIONS[event.status] || [];
    if (!allowed.includes(patch.status)) {
      throw Object.assign(
        new Error(`Transición de estado inválida: ${event.status} → ${patch.status}`),
        { status: 400 }
      );
    }
  }

  const values = [];
  const { clauses, nextIdx } = buildUpdateSet(
    {
      name:              patch.name,
      description:       patch.description,
      event_date:        patch.event_date,
      status:            patch.status,
      moderation_active: patch.moderation_active,
      is_open:           patch.is_open,
    },
    values
  );

  if (clauses.length === 0) return event;

  clauses.push(`updated_by = $${nextIdx}`, `updated_at = NOW()`);
  values.push(userId, eventId);

  const { rows } = await db.query(
    `UPDATE kickoff_events SET ${clauses.join(', ')} WHERE id = $${nextIdx + 1} RETURNING *`,
    values
  );
  return mapEvent(rows[0]);
}

// ─── presentations ────────────────────────────────────────────────────────────

async function getPresentationsByEvent(eventId) {
  const { rows } = await db.query(`
    SELECT kp.*, u.fullname AS presenter_name
    FROM kickoff_presentations kp
    LEFT JOIN users u ON u.id = kp.presenter_user_id
    WHERE kp.event_id = $1
    ORDER BY kp.sort_order ASC, kp.scheduled_start ASC NULLS LAST
  `, [eventId]);
  return rows.map(mapPresentation);
}

async function getPresentationById(presentationId) {
  const { rows } = await db.query(`
    SELECT kp.*, u.fullname AS presenter_name
    FROM kickoff_presentations kp
    LEFT JOIN users u ON u.id = kp.presenter_user_id
    WHERE kp.id = $1
  `, [presentationId]);
  return rows[0] ? mapPresentation(rows[0]) : null;
}

async function getProgressGateForPresentation(presentationId, userId) {
  if (!userId) return null;

  const target = await getPresentationById(presentationId);
  if (!target) throw Object.assign(new Error('Presentación no encontrada'), { status: 404 });

  const { rows: previous } = await db.query(
    `SELECT id, title, sort_order
     FROM kickoff_presentations
     WHERE event_id = $1
       AND status = 'finished'
       AND sort_order < $2
     ORDER BY sort_order ASC`,
    [target.event_id, target.sort_order]
  );

  for (const pres of previous) {
    const { rows: ownAporteRows } = await db.query(
      `SELECT 1
       FROM kickoff_questions
       WHERE presentation_id = $1
         AND user_id = $2
         AND type = 'aporte'
         AND status != 'hidden'
       LIMIT 1`,
      [pres.id, userId]
    );
    if (ownAporteRows.length === 0) {
      return {
        blocked: true,
        reason: `Debes registrar al menos un aporte en "${pres.title}" antes de pasar a la siguiente presentación.`,
        missing: { presentation_id: pres.id, presentation_title: pres.title, requirement: 'aporte' },
      };
    }

    const { rows: totals } = await db.query(
      `SELECT
         COUNT(*)::int AS total_others,
         COUNT(kar.aporte_id)::int AS rated_others
       FROM kickoff_questions kq
       LEFT JOIN kickoff_aporte_ratings kar
         ON kar.aporte_id = kq.id
        AND kar.user_id = $2
       WHERE kq.presentation_id = $1
         AND kq.type = 'aporte'
         AND kq.status != 'hidden'
         AND kq.user_id != $2`,
      [pres.id, userId]
    );

    const totalOthers = totals[0]?.total_others || 0;
    const ratedOthers = totals[0]?.rated_others || 0;
    if (totalOthers > ratedOthers) {
      return {
        blocked: true,
        reason: `Debes calificar todos los aportes de otros colaboradores en "${pres.title}" antes de avanzar.`,
        missing: {
          presentation_id: pres.id,
          presentation_title: pres.title,
          requirement: 'rate_others',
          pending_ratings: totalOthers - ratedOthers,
          total_others: totalOthers,
        },
      };
    }
  }

  return { blocked: false };
}

async function createPresentation(eventId, payload, userId) {
  const event = await getEventById(eventId);
  if (!event) throw Object.assign(new Error('Evento no encontrado'), { status: 404 });

  const {
    presenter_user_id, title, description,
    scheduled_start, scheduled_end,
    canva_url, canva_embed_url, fallback_url, sort_order = 0,
  } = payload;

  if (!title) throw Object.assign(new Error('title es requerido'), { status: 400 });

  const { rows } = await db.query(`
    INSERT INTO kickoff_presentations
      (event_id, presenter_user_id, title, description, scheduled_start, scheduled_end,
       canva_url, canva_embed_url, fallback_url, sort_order, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *`,
    [
      eventId, presenter_user_id || null, title, description || null,
      scheduled_start || null, scheduled_end || null,
      canva_url || null, canva_embed_url || null, fallback_url || null,
      sort_order, userId,
    ]
  );
  return mapPresentation(rows[0]);
}

async function updatePresentation(presentationId, patch, userId) {
  const pres = await getPresentationById(presentationId);
  if (!pres) throw Object.assign(new Error('Presentación no encontrada'), { status: 404 });

  if (patch.status && patch.status !== pres.status) {
    const allowed = PRESENTATION_TRANSITIONS[pres.status] || [];
    if (!allowed.includes(patch.status)) {
      throw Object.assign(
        new Error(`Transición inválida: ${pres.status} → ${patch.status}`),
        { status: 400 }
      );
    }
  }

  const values = [];
  const { clauses, nextIdx } = buildUpdateSet(
    {
      presenter_user_id: patch.presenter_user_id,
      title:             patch.title,
      description:       patch.description,
      scheduled_start:   patch.scheduled_start,
      scheduled_end:     patch.scheduled_end,
      canva_url:         patch.canva_url,
      canva_embed_url:   patch.canva_embed_url,
      fallback_url:      patch.fallback_url,
      status:            patch.status,
      sort_order:        patch.sort_order,
    },
    values
  );

  if (clauses.length === 0) return pres;

  clauses.push(`updated_by = $${nextIdx}`, `updated_at = NOW()`);
  values.push(userId, presentationId);

  const { rows } = await db.query(
    `UPDATE kickoff_presentations SET ${clauses.join(', ')} WHERE id = $${nextIdx + 1} RETURNING *`,
    values
  );
  return mapPresentation(rows[0]);
}

async function startPresentation(presentationId, userId) {
  const pres = await getPresentationById(presentationId);
  if (!pres) throw Object.assign(new Error('Presentación no encontrada'), { status: 404 });

  if (!['pending', 'ready'].includes(pres.status)) {
    throw Object.assign(
      new Error(`No se puede iniciar una presentación en estado: ${pres.status}`),
      { status: 400 }
    );
  }

  const { rows: active } = await db.query(
    `SELECT id FROM kickoff_presentations WHERE event_id = $1 AND status = 'active' AND id != $2`,
    [pres.event_id, presentationId]
  );
  if (active.length > 0) {
    throw Object.assign(
      new Error('Ya existe una presentación activa. Finalícela antes de iniciar otra.'),
      { status: 409 }
    );
  }

  const { rows } = await db.query(`
    UPDATE kickoff_presentations
    SET status = 'active', current_block_order = 0, updated_by = $1, updated_at = NOW()
    WHERE id = $2 RETURNING *`,
    [userId, presentationId]
  );

  await db.query(
    `UPDATE kickoff_presentation_blocks SET is_active = FALSE WHERE presentation_id = $1`,
    [presentationId]
  );
  await db.query(`
    UPDATE kickoff_presentation_blocks SET is_active = TRUE
    WHERE presentation_id = $1 AND sort_order = (
      SELECT MIN(sort_order) FROM kickoff_presentation_blocks WHERE presentation_id = $1
    )`,
    [presentationId]
  );

  logger.info(`[kickoff] Presentación iniciada id=${presentationId} por user=${userId}`);
  return mapPresentation(rows[0]);
}

async function finishPresentation(presentationId, userId) {
  const { rows } = await db.query(`
    UPDATE kickoff_presentations
    SET status = 'finished', updated_by = $1, updated_at = NOW()
    WHERE id = $2 AND status IN ('active','questions_open','questions_closed')
    RETURNING *`,
    [userId, presentationId]
  );
  if (rows.length === 0) throw Object.assign(new Error('No se puede finalizar esta presentación en su estado actual'), { status: 400 });
  logger.info(`[kickoff] Presentación finalizada id=${presentationId} por user=${userId}`);
  return mapPresentation(rows[0]);
}

// ─── blocks ───────────────────────────────────────────────────────────────────

async function getBlocksByPresentation(presentationId) {
  const { rows } = await db.query(
    `SELECT * FROM kickoff_presentation_blocks WHERE presentation_id = $1 ORDER BY sort_order ASC`,
    [presentationId]
  );
  return rows.map(mapBlock);
}

async function getActiveBlock(presentationId) {
  const { rows } = await db.query(
    `SELECT * FROM kickoff_presentation_blocks WHERE presentation_id = $1 AND is_active = TRUE LIMIT 1`,
    [presentationId]
  );
  return rows[0] ? mapBlock(rows[0]) : null;
}

async function advanceBlock(presentationId, direction, userId) {
  const pres = await getPresentationById(presentationId);
  if (!pres) throw Object.assign(new Error('Presentación no encontrada'), { status: 404 });

  const { rows: blocks } = await db.query(
    `SELECT * FROM kickoff_presentation_blocks WHERE presentation_id = $1 ORDER BY sort_order ASC`,
    [presentationId]
  );
  if (blocks.length === 0) throw Object.assign(new Error('Esta presentación no tiene bloques configurados'), { status: 400 });

  const curr = pres.current_block_order;
  let target;

  if (direction === 'next') {
    const nxt = blocks.find(b => b.sort_order > curr);
    if (!nxt) throw Object.assign(new Error('Ya estás en el último bloque'), { status: 400 });
    target = nxt.sort_order;
  } else {
    const prv = [...blocks].reverse().find(b => b.sort_order < curr);
    if (!prv) throw Object.assign(new Error('Ya estás en el primer bloque'), { status: 400 });
    target = prv.sort_order;
  }

  await db.query(
    `UPDATE kickoff_presentation_blocks SET is_active = FALSE WHERE presentation_id = $1`,
    [presentationId]
  );
  await db.query(
    `UPDATE kickoff_presentation_blocks SET is_active = TRUE WHERE presentation_id = $1 AND sort_order = $2`,
    [presentationId, target]
  );
  await db.query(
    `UPDATE kickoff_presentations SET current_block_order = $1, updated_by = $2, updated_at = NOW() WHERE id = $3`,
    [target, userId, presentationId]
  );

  return getActiveBlock(presentationId);
}

async function upsertBlock(presentationId, data, userId) {
  const { id, title, content, image_url, block_type = 'info', sort_order = 0 } = data;

  if (id) {
    const { rows } = await db.query(`
      UPDATE kickoff_presentation_blocks
      SET title=$1, content=$2, image_url=$3, block_type=$4, sort_order=$5, updated_by=$6, updated_at=NOW()
      WHERE id=$7 AND presentation_id=$8 RETURNING *`,
      [title, content, image_url || null, block_type, sort_order, userId, id, presentationId]
    );
    return rows[0] ? mapBlock(rows[0]) : null;
  }

  const { rows } = await db.query(`
    INSERT INTO kickoff_presentation_blocks
      (presentation_id, title, content, image_url, block_type, sort_order, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
    [presentationId, title, content, image_url || null, block_type, sort_order, userId]
  );
  return mapBlock(rows[0]);
}

async function deleteBlock(blockId, presentationId) {
  await db.query(
    `DELETE FROM kickoff_presentation_blocks WHERE id = $1 AND presentation_id = $2`,
    [blockId, presentationId]
  );
}

// ─── questions ────────────────────────────────────────────────────────────────

async function getQuestions(presentationId, { status, forModerator } = {}) {
  const params = [presentationId];
  let q = `
    SELECT kq.*, u.fullname AS user_fullname,
           COUNT(kar.id)::int              AS rating_count,
           ROUND(AVG(kar.rating)::numeric, 2) AS avg_rating
    FROM kickoff_questions kq
    LEFT JOIN users u        ON u.id = kq.user_id
    LEFT JOIN kickoff_aporte_ratings kar ON kar.aporte_id = kq.id
    WHERE kq.presentation_id = $1`;

  if (!forModerator) {
    // Attendees see: highlighted questions + all non-hidden aportes
    q += ` AND (kq.status = 'highlighted' OR (kq.type = 'aporte' AND kq.status != 'hidden'))`;
  }

  if (status) {
    params.push(status);
    q += ` AND kq.status = $${params.length}`;
  }

  q += ' GROUP BY kq.id, u.fullname ORDER BY kq.is_highlighted DESC, kq.created_at ASC';

  const { rows } = await db.query(q, params);
  return rows.map(mapQuestion);
}

async function createQuestion(presentationId, payload, userId) {
  const pres = await getPresentationById(presentationId);
  if (!pres) throw Object.assign(new Error('Presentación no encontrada'), { status: 404 });

  if (!['active', 'questions_open'].includes(pres.status)) {
    throw Object.assign(
      new Error('Las preguntas no están habilitadas para esta presentación en este momento'),
      { status: 409 }
    );
  }

  const { question_text, display_name, is_anonymous = false, type = 'question' } = payload;
  const text = (question_text || '').trim();

  if (text.length < 5)    throw Object.assign(new Error('El texto debe tener al menos 5 caracteres'), { status: 400 });
  if (text.length > 1000) throw Object.assign(new Error('El texto no puede exceder 1000 caracteres'), { status: 400 });

  const { rows: eventRows } = await db.query(
    `SELECT moderation_active FROM kickoff_events WHERE id = $1`,
    [pres.event_id]
  );
  // Aportes bypass moderation — they go directly to 'approved' and are visible to all
  const initialStatus = type === 'aporte'
    ? 'approved'
    : (eventRows[0]?.moderation_active ? 'under_review' : 'approved');

  const { rows } = await db.query(`
    INSERT INTO kickoff_questions
      (presentation_id, user_id, display_name, question_text, status, is_anonymous, type)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      presentationId,
      userId || null,
      (is_anonymous || type === 'aporte') ? null : (display_name || null),
      text,
      initialStatus,
      is_anonymous || type === 'aporte',
      type,
    ]
  );
  return mapQuestion(rows[0]);
}

async function moderateQuestion(questionId, patch, userId) {
  const { status, answer_text } = patch;

  const clauses = ['updated_at = NOW()'];
  const values  = [];
  let idx = 1;

  const VALID_STATUSES = ['under_review','approved','highlighted','answered','hidden','rejected'];
  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      throw Object.assign(new Error(`Estado inválido: ${status}`), { status: 400 });
    }
    clauses.push(`status = $${idx++}`);
    values.push(status);

    if (status === 'highlighted') {
      clauses.push(`is_highlighted = TRUE`);
    }
    if (status === 'approved') {
      clauses.push(`is_highlighted = FALSE`);
    }
    if (status === 'answered') {
      clauses.push(`answered_at = NOW()`, `answered_by = $${idx++}`);
      values.push(userId);
    }
  }

  if (answer_text !== undefined) {
    clauses.push(`answer_text = $${idx++}`);
    values.push(answer_text);
  }

  values.push(questionId);
  const { rows } = await db.query(
    `UPDATE kickoff_questions SET ${clauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (rows.length === 0) throw Object.assign(new Error('Pregunta no encontrada'), { status: 404 });
  return mapQuestion(rows[0]);
}

// ─── QR tokens ────────────────────────────────────────────────────────────────

async function generateQrToken(presentationId, userId, expiresInHours = 10) {
  await db.query(
    `UPDATE kickoff_qr_tokens SET is_active = FALSE, updated_at = NOW() WHERE presentation_id = $1`,
    [presentationId]
  );

  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = expiresInHours
    ? new Date(Date.now() + expiresInHours * 3_600_000)
    : null;

  const { rows } = await db.query(`
    INSERT INTO kickoff_qr_tokens (presentation_id, token, expires_at, is_active, created_by)
    VALUES ($1,$2,$3,TRUE,$4) RETURNING *`,
    [presentationId, token, expiresAt, userId]
  );
  return rows[0];
}

async function validateQrToken(token, userId) {
  const { rows } = await db.query(`
    SELECT qt.*, kp.title AS presentation_title, kp.status AS presentation_status,
           kp.event_id, ke.name AS event_name, ke.status AS event_status
    FROM kickoff_qr_tokens qt
    JOIN kickoff_presentations kp ON kp.id = qt.presentation_id
    JOIN kickoff_events ke ON ke.id = kp.event_id
    WHERE qt.token = $1`,
    [token]
  );

  if (!rows[0])                return { valid: false, reason: 'QR inválido o no existe' };
  const qr = rows[0];
  if (!qr.is_active)           return { valid: false, reason: 'Este QR ha sido desactivado' };
  if (qr.expires_at && new Date() > new Date(qr.expires_at))
                               return { valid: false, reason: 'Este QR ha expirado' };
  const ALLOWED_STATUSES = ['pending', 'ready', 'active', 'questions_open', 'questions_closed'];
  if (!ALLOWED_STATUSES.includes(qr.presentation_status))
                               return { valid: false, reason: 'La presentación ha finalizado o fue cancelada' };
  if (['finished', 'cancelled'].includes(qr.event_status))
                               return { valid: false, reason: 'El evento ha finalizado' };

  let progress_gate = null;
  let requires_rating = null;
  if (userId) {
    progress_gate = await getProgressGateForPresentation(qr.presentation_id, userId);
    if (progress_gate?.blocked) {
      return { valid: false, reason: progress_gate.reason, progress_gate };
    }

    const { rows: unrated } = await db.query(
      `SELECT kp.id, kp.title
       FROM kickoff_presentations kp
       WHERE kp.event_id = $1
         AND kp.status = 'finished'
         AND kp.id NOT IN (
           SELECT presentation_id FROM kickoff_presentation_ratings WHERE user_id = $2
         )
       ORDER BY kp.sort_order ASC
       LIMIT 1`,
      [qr.event_id, userId]
    );
    if (unrated[0]) {
      requires_rating = { presentation_id: unrated[0].id, presentation_title: unrated[0].title };
    }
  }

  return {
    valid:               true,
    presentation_id:     qr.presentation_id,
    presentation_title:  qr.presentation_title,
    presentation_status: qr.presentation_status,
    event_id:            qr.event_id,
    event_name:          qr.event_name,
    requires_rating,
  };
}

async function getActiveQrForPresentation(presentationId) {
  const { rows } = await db.query(
    `SELECT * FROM kickoff_qr_tokens WHERE presentation_id = $1 AND is_active = TRUE LIMIT 1`,
    [presentationId]
  );
  return rows[0] || null;
}

async function deleteEvent(eventId) {
  const event = await getEventById(eventId);
  if (!event) throw Object.assign(new Error('Evento no encontrado'), { status: 404 });
  if (['active', 'paused'].includes(event.status)) {
    throw Object.assign(new Error('No se puede eliminar un evento activo o en pausa'), { status: 400 });
  }
  await db.query('DELETE FROM kickoff_events WHERE id = $1', [eventId]);
  logger.info(`[kickoff] Evento eliminado id=${eventId}`);
}

async function deletePresentation(presentationId) {
  const pres = await getPresentationById(presentationId);
  if (!pres) throw Object.assign(new Error('Presentación no encontrada'), { status: 404 });
  if (pres.status === 'active') {
    throw Object.assign(new Error('No se puede eliminar una presentación activa'), { status: 400 });
  }
  await db.query('DELETE FROM kickoff_presentations WHERE id = $1', [presentationId]);
  logger.info(`[kickoff] Presentación eliminada id=${presentationId}`);
}

// ─── ratings ──────────────────────────────────────────────────────────────────

async function rateQuestion(questionId, userId, rating) {
  const { rows } = await db.query(
    'SELECT id, user_id, status FROM kickoff_questions WHERE id = $1',
    [questionId]
  );
  if (!rows[0]) throw Object.assign(new Error('Pregunta no encontrada'), { status: 404 });
  if (rows[0].user_id !== userId)
    throw Object.assign(new Error('Solo el autor de la pregunta puede calificarla'), { status: 403 });
  if (rows[0].status !== 'highlighted')
    throw Object.assign(new Error('Solo se puede calificar una pregunta destacada por el presentador'), { status: 400 });

  await db.query(
    `INSERT INTO kickoff_question_ratings (question_id, user_id, rating)
     VALUES ($1, $2, $3)
     ON CONFLICT (question_id, user_id) DO UPDATE SET rating = EXCLUDED.rating`,
    [questionId, userId, rating]
  );
  return { rated: true };
}

async function ratePresentation(presentationId, userId, { impacto, contenido, destreza }) {
  const pres = await getPresentationById(presentationId);
  if (!pres) throw Object.assign(new Error('Presentación no encontrada'), { status: 404 });
  if (pres.status !== 'finished')
    throw Object.assign(new Error('Solo se puede calificar una presentación finalizada'), { status: 400 });

  await db.query(
    `INSERT INTO kickoff_presentation_ratings (presentation_id, user_id, impacto, contenido, destreza)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (presentation_id, user_id) DO UPDATE
       SET impacto = EXCLUDED.impacto,
           contenido = EXCLUDED.contenido,
           destreza = EXCLUDED.destreza`,
    [presentationId, userId, impacto, contenido, destreza]
  );
  return { rated: true };
}

async function getPresentationRatingSummary(presentationId, userId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS count,
            ROUND(AVG(impacto)::numeric,  2) AS avg_impacto,
            ROUND(AVG(contenido)::numeric, 2) AS avg_contenido,
            ROUND(AVG(destreza)::numeric,  2) AS avg_destreza,
            ROUND(AVG((impacto + contenido + destreza) / 3.0)::numeric, 2) AS avg_overall
     FROM kickoff_presentation_ratings
     WHERE presentation_id = $1`,
    [presentationId]
  );
  let userRated = false;
  if (userId) {
    const { rows: ur } = await db.query(
      'SELECT 1 FROM kickoff_presentation_ratings WHERE presentation_id=$1 AND user_id=$2',
      [presentationId, userId]
    );
    userRated = ur.length > 0;
  }
  return { ...rows[0], user_rated: userRated };
}

async function getEventRankings(eventId) {
  const { rows } = await db.query(
    `SELECT kp.id AS presentation_id,
            kp.title,
            kp.status AS presentation_status,
            kp.sort_order,
            u.fullname AS presenter_name,
            COUNT(kpr.id)::int AS rating_count,
            ROUND(AVG(kpr.impacto)::numeric,  2) AS avg_impacto,
            ROUND(AVG(kpr.contenido)::numeric, 2) AS avg_contenido,
            ROUND(AVG(kpr.destreza)::numeric,  2) AS avg_destreza,
            ROUND(AVG((kpr.impacto + kpr.contenido + kpr.destreza) / 3.0)::numeric, 2) AS avg_overall
     FROM kickoff_presentations kp
     LEFT JOIN kickoff_presentation_ratings kpr ON kpr.presentation_id = kp.id
     LEFT JOIN users u ON u.id = kp.presenter_user_id
     WHERE kp.event_id = $1
     GROUP BY kp.id, kp.title, kp.status, kp.sort_order, u.fullname
     ORDER BY avg_overall DESC NULLS LAST, kp.sort_order ASC`,
    [eventId]
  );
  return rows;
}

async function rateAporte(aporteId, userId, rating) {
  const { rows } = await db.query(
    'SELECT id, user_id, type, status FROM kickoff_questions WHERE id = $1',
    [aporteId]
  );
  if (!rows[0]) throw Object.assign(new Error('Aporte no encontrado'), { status: 404 });
  if (rows[0].type !== 'aporte')
    throw Object.assign(new Error('Solo se pueden calificar aportes'), { status: 400 });
  if (rows[0].status === 'hidden')
    throw Object.assign(new Error('Este aporte no está disponible'), { status: 400 });
  if (rows[0].user_id === userId)
    throw Object.assign(new Error('No puedes calificar tu propio aporte'), { status: 403 });

  await db.query(
    `INSERT INTO kickoff_aporte_ratings (aporte_id, user_id, rating)
     VALUES ($1, $2, $3)
     ON CONFLICT (aporte_id, user_id) DO UPDATE SET rating = EXCLUDED.rating`,
    [aporteId, userId, rating]
  );
  return { rated: true };
}

async function getAporteRankings(eventId) {
  const { rows } = await db.query(
    `SELECT
       kq.user_id                                AS id,
       COALESCE(u.fullname, 'Colaborador')       AS collaborator_name,
       up.avatar_url                             AS collaborator_avatar_url,
       COUNT(kar.id)::int                        AS rating_count,
       ROUND(AVG(kar.rating)::numeric, 2)        AS avg_rating
     FROM kickoff_questions kq
     JOIN kickoff_presentations kp  ON kp.id  = kq.presentation_id
     LEFT JOIN users u              ON u.id   = kq.user_id
     LEFT JOIN user_profile up      ON up.user_id = kq.user_id
     LEFT JOIN kickoff_aporte_ratings kar ON kar.aporte_id = kq.id
     WHERE kp.event_id = $1
       AND kq.type    = 'aporte'
       AND kq.status != 'hidden'
     GROUP BY kq.user_id, u.fullname, up.avatar_url
     ORDER BY avg_rating DESC NULLS LAST, rating_count DESC, collaborator_name ASC`,
    [eventId]
  );
  return rows;
}

async function getEventWinners(eventId) {
  const { rows: evRows } = await db.query('SELECT id, status FROM kickoff_events WHERE id = $1', [eventId]);
  if (!evRows[0]) throw Object.assign(new Error('Evento no encontrado'), { status: 404 });
  if (evRows[0].status !== 'finished') return null;

  const { rows: collaboratorRows } = await db.query(
    `SELECT
        kq.user_id AS collaborator_user_id,
        COALESCE(u.fullname, 'Colaborador') AS collaborator_name,
        COUNT(kar.id)::int AS ratings_count,
        ROUND(AVG(kar.rating)::numeric, 2) AS avg_rating
     FROM kickoff_questions kq
     JOIN kickoff_presentations kp ON kp.id = kq.presentation_id
     LEFT JOIN users u ON u.id = kq.user_id
     LEFT JOIN kickoff_aporte_ratings kar ON kar.aporte_id = kq.id
     WHERE kp.event_id = $1
       AND kq.type = 'aporte'
       AND kq.status != 'hidden'
     GROUP BY kq.user_id, u.fullname
     HAVING COUNT(kar.id) > 0
     ORDER BY avg_rating DESC NULLS LAST, ratings_count DESC, collaborator_name ASC
     LIMIT 1`,
    [eventId]
  );

  const { rows: presentationRows } = await db.query(
    `SELECT
        kp.id AS presentation_id,
        kp.title AS presentation_title,
        COALESCE(u.fullname, 'Sin presentador') AS presenter_name,
        COUNT(kpr.id)::int AS ratings_count,
        ROUND(AVG((kpr.impacto + kpr.contenido + kpr.destreza) / 3.0)::numeric, 2) AS avg_overall
     FROM kickoff_presentations kp
     LEFT JOIN users u ON u.id = kp.presenter_user_id
     LEFT JOIN kickoff_presentation_ratings kpr ON kpr.presentation_id = kp.id
     WHERE kp.event_id = $1
     GROUP BY kp.id, kp.title, u.fullname
     HAVING COUNT(kpr.id) > 0
     ORDER BY avg_overall DESC NULLS LAST, ratings_count DESC, kp.sort_order ASC
     LIMIT 1`,
    [eventId]
  );

  return {
    collaborator_winner: collaboratorRows[0] || null,
    presentation_winner: presentationRows[0] || null,
  };
}

module.exports = {
  getCurrentEvent, getAdminCurrentEvent, getEventById, createEvent, updateEvent, deleteEvent,
  getPresentationsByEvent, getPresentationById, createPresentation,
  updatePresentation, startPresentation, finishPresentation, deletePresentation,
  getBlocksByPresentation, getActiveBlock, advanceBlock, upsertBlock, deleteBlock,
  getQuestions, createQuestion, moderateQuestion,
  generateQrToken, validateQrToken, getActiveQrForPresentation,
  rateQuestion, ratePresentation, getPresentationRatingSummary, getEventRankings,
  rateAporte, getAporteRankings, getProgressGateForPresentation, getEventWinners,
};
