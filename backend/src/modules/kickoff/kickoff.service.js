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
  is_intro:            Boolean(r.is_intro),
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
  answer_text:     r.answer_text || null,
  answered_at:     r.answered_at || null,
  status:          r.status,
  is_anonymous:    r.is_anonymous,
  is_highlighted:  r.is_highlighted,
  avg_rating:      r.avg_rating  ? parseFloat(r.avg_rating)  : null,
  rating_count:    r.rating_count ? parseInt(r.rating_count) : 0,
  user_rating:     r.user_rating != null ? parseInt(r.user_rating) : null,
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

async function listAllEvents() {
  const { rows } = await db.query(`
    SELECT ke.*,
           COUNT(kp.id)::int AS presentation_count
    FROM kickoff_events ke
    LEFT JOIN kickoff_presentations kp ON kp.event_id = ke.id
    GROUP BY ke.id
    ORDER BY ke.event_date DESC, ke.created_at DESC
  `);
  return rows.map(r => ({ ...mapEvent(r), presentation_count: r.presentation_count }));
}

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

async function getPresentationsByEvent(eventId, userId = null) {
  if (userId) {
    // Un solo query: incluye cuántos aportes de otros le faltan calificar al usuario
    const { rows } = await db.query(`
      SELECT kp.*,
             u.fullname AS presenter_name,
             COUNT(DISTINCT CASE
               WHEN kq.type = 'aporte'
                AND kq.status != 'hidden'
                AND kq.user_id != $2
                AND kar.aporte_id IS NULL
               THEN kq.id
             END)::int AS pending_ratings,
             COUNT(DISTINCT CASE
               WHEN kq.type = 'aporte' AND kq.status != 'hidden' AND kq.user_id != $2
               THEN kq.id
             END)::int AS total_other_aportes
      FROM kickoff_presentations kp
      LEFT JOIN users u            ON u.id = kp.presenter_user_id
      LEFT JOIN kickoff_questions kq ON kq.presentation_id = kp.id
      LEFT JOIN kickoff_aporte_ratings kar
             ON kar.aporte_id = kq.id AND kar.user_id = $2
      WHERE kp.event_id = $1
      GROUP BY kp.id, u.fullname
      ORDER BY kp.sort_order ASC, kp.scheduled_start ASC NULLS LAST
    `, [eventId, userId]);
    return rows.map(r => ({
      ...mapPresentation(r),
      pending_ratings:     r.pending_ratings     || 0,
      total_other_aportes: r.total_other_aportes || 0,
    }));
  }

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
    `SELECT id, title, sort_order, presenter_user_id
     FROM kickoff_presentations
     WHERE event_id = $1
       AND status = 'finished'
       AND sort_order < $2
       AND is_intro = FALSE
     ORDER BY sort_order ASC`,
    [target.event_id, target.sort_order]
  );

  for (const pres of previous) {
    // El presentador de esta presentación no está obligado a aportar en la suya
    // (no tendría lógica aportar a la propia). Sí debe calificar los aportes recibidos.
    const isPresenterOfThis = pres.presenter_user_id != null
      && String(pres.presenter_user_id) === String(userId);

    if (!isPresenterOfThis) {
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
    is_intro = false,
  } = payload;

  if (!title) throw Object.assign(new Error('title es requerido'), { status: 400 });

  const { rows } = await db.query(`
    INSERT INTO kickoff_presentations
      (event_id, presenter_user_id, title, description, scheduled_start, scheduled_end,
       canva_url, canva_embed_url, fallback_url, sort_order, is_intro, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *`,
    [
      eventId, presenter_user_id || null, title, description || null,
      scheduled_start || null, scheduled_end || null,
      canva_url || null, canva_embed_url || null, fallback_url || null,
      sort_order, Boolean(is_intro), userId,
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
      is_intro:          patch.is_intro,
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

async function getQuestions(presentationId, { status, forModerator, userId = null } = {}) {
  const params = [presentationId, userId];
  let q = `
    SELECT kq.*, u.fullname AS user_fullname,
           COUNT(kar.id)::int              AS rating_count,
           ROUND(AVG(kar.rating)::numeric, 2) AS avg_rating,
           MAX(CASE WHEN kar.user_id = $2 THEN kar.rating END) AS user_rating
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

  const { question_text, display_name, is_anonymous = false, type = 'question' } = payload;
  const normalizedType = type === 'aporte' ? 'aporte' : 'question';
  const allowsRegularParticipation = ['active', 'questions_open'].includes(pres.status);
  const allowsLateAporte = pres.status === 'finished' && normalizedType === 'aporte';

  if (!allowsRegularParticipation && !allowsLateAporte) {
    const disabledMessage = pres.status === 'finished'
      ? 'La presentación ya finalizó; solo se permiten aportes pendientes en este momento'
      : 'Las preguntas no están habilitadas para esta presentación en este momento';
    throw Object.assign(new Error(disabledMessage), { status: 409 });
  }

  const text = (question_text || '').trim();

  if (text.length < 5)    throw Object.assign(new Error('El texto debe tener al menos 5 caracteres'), { status: 400 });
  if (text.length > 1000) throw Object.assign(new Error('El texto no puede exceder 1000 caracteres'), { status: 400 });

  const { rows: eventRows } = await db.query(
    `SELECT moderation_active FROM kickoff_events WHERE id = $1`,
    [pres.event_id]
  );
  // Aportes bypass moderation — they go directly to 'approved' and are visible to all
  const initialStatus = normalizedType === 'aporte'
    ? 'approved'
    : (eventRows[0]?.moderation_active ? 'under_review' : 'approved');

  const { rows } = await db.query(`
    INSERT INTO kickoff_questions
      (presentation_id, user_id, display_name, question_text, status, is_anonymous, type)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      presentationId,
      userId || null,
      (is_anonymous || normalizedType === 'aporte') ? null : (display_name || null),
      text,
      initialStatus,
      is_anonymous || normalizedType === 'aporte',
      normalizedType,
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
  // 'finished' permanece válido: tras finalizar aún se admiten aportes tardíos.
  const ALLOWED_STATUSES = ['pending', 'ready', 'active', 'questions_open', 'questions_closed', 'finished'];
  if (!ALLOWED_STATUSES.includes(qr.presentation_status))
                               return { valid: false, reason: 'La presentación fue cancelada' };
  if (['finished', 'cancelled'].includes(qr.event_status))
                               return { valid: false, reason: 'El evento ha finalizado' };

  return {
    valid:               true,
    presentation_id:     qr.presentation_id,
    presentation_title:  qr.presentation_title,
    presentation_status: qr.presentation_status,
    event_id:            qr.event_id,
    event_name:          qr.event_name,
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

  // Una sola calificación por usuario y aporte: si ya existe, no se permite recalificar.
  const inserted = await db.query(
    `INSERT INTO kickoff_aporte_ratings (aporte_id, user_id, rating)
     VALUES ($1, $2, $3)
     ON CONFLICT (aporte_id, user_id) DO NOTHING`,
    [aporteId, userId, rating]
  );
  if (inserted.rowCount === 0)
    throw Object.assign(new Error('Ya calificaste este aporte; la calificación es única'), { status: 409 });
  return { rated: true };
}

async function getAporteRankings(eventId) {
  // Ranking por aporte individual: cada aporte es una fila independiente, por lo que
  // un mismo colaborador puede ocupar varias posiciones con distintos aportes.
  const { rows } = await db.query(
    `SELECT
       kq.id                                     AS id,
       kq.user_id                                AS collaborator_user_id,
       COALESCE(u.fullname, 'Colaborador')       AS collaborator_name,
       up.avatar_url                             AS collaborator_avatar_url,
       kp.title                                  AS presentation_title,
       kq.question_text                          AS aporte_text,
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
       AND kp.is_intro = FALSE
     GROUP BY kq.id, kq.user_id, kq.question_text, u.fullname, up.avatar_url, kp.title
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
       AND kp.is_intro = FALSE
     GROUP BY kq.user_id, u.fullname
     HAVING COUNT(kar.id) > 0
     ORDER BY avg_rating DESC NULLS LAST, ratings_count DESC, collaborator_name ASC
     LIMIT 1`,
    [eventId]
  );

  return {
    collaborator_winner: collaboratorRows[0] || null,
  };
}

// ─── event summary ────────────────────────────────────────────────────────────

async function getEventSummary(eventId) {
  const [aporteRows, questionRows] = await Promise.all([
    db.query(`
      SELECT
        kq.id,
        kq.question_text        AS aporte_text,
        kq.status,
        kq.created_at,
        kp.title                AS presentation_title,
        kp.sort_order,
        COALESCE(u.fullname, 'Colaborador') AS collaborator_name,
        COUNT(kar.id)::int                  AS rating_count,
        ROUND(AVG(kar.rating)::numeric, 2)  AS avg_rating
      FROM kickoff_questions kq
      JOIN kickoff_presentations kp ON kp.id = kq.presentation_id
      LEFT JOIN users u              ON u.id  = kq.user_id
      LEFT JOIN kickoff_aporte_ratings kar ON kar.aporte_id = kq.id
      WHERE kp.event_id = $1
        AND kq.type     = 'aporte'
        AND kq.status  != 'hidden'
        AND kp.is_intro = FALSE
      GROUP BY kq.id, kq.question_text, kq.status, kq.created_at,
               kp.title, kp.sort_order, u.fullname
      ORDER BY kp.sort_order ASC, avg_rating DESC NULLS LAST, kq.created_at ASC
    `, [eventId]),

    db.query(`
      SELECT
        kq.id,
        kq.question_text,
        kq.answer_text,
        kq.status,
        kq.is_highlighted,
        kq.answered_at,
        kq.created_at,
        kq.is_anonymous,
        CASE WHEN kq.is_anonymous THEN 'Anónimo' ELSE COALESCE(kq.display_name, u.fullname, 'Sin nombre') END AS display_name,
        kp.title   AS presentation_title,
        kp.sort_order
      FROM kickoff_questions kq
      JOIN kickoff_presentations kp ON kp.id = kq.presentation_id
      LEFT JOIN users u              ON u.id  = kq.user_id
      WHERE kp.event_id = $1
        AND kq.type     = 'question'
        AND kq.status  NOT IN ('hidden', 'rejected')
        AND kp.is_intro = FALSE
      ORDER BY kp.sort_order ASC, kq.is_highlighted DESC, kq.created_at ASC
    `, [eventId]),
  ]);

  const aportes   = aporteRows.rows;
  const questions = questionRows.rows;

  return {
    aportes,
    questions,
    stats: {
      total_aportes:      aportes.length,
      total_questions:    questions.length,
      answered_questions: questions.filter(q => q.status === 'answered').length,
      avg_rating_overall: aportes.length
        ? parseFloat((aportes.reduce((s, a) => s + (parseFloat(a.avg_rating) || 0), 0) / aportes.filter(a => a.avg_rating).length).toFixed(2)) || null
        : null,
    },
  };
}

// ─── auto-start scheduler ────────────────────────────────────────────────────

async function autoStartOverduePresentations() {
  try {
    // Busca presentaciones cuyo inicio programado ya pasó hace más de 5 min y
    // nadie las inició, pero solo si el evento está activo y no hay otra presentación en curso.
    const { rows } = await db.query(`
      SELECT kp.id, kp.title
      FROM kickoff_presentations kp
      JOIN kickoff_events ke ON ke.id = kp.event_id
      WHERE kp.status IN ('pending', 'ready')
        AND kp.scheduled_start IS NOT NULL
        AND kp.scheduled_start + INTERVAL '5 minutes' <= NOW()
        AND ke.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM kickoff_presentations kp2
          WHERE kp2.event_id = kp.event_id
            AND kp2.status IN ('active', 'questions_open', 'questions_closed')
        )
      ORDER BY kp.sort_order ASC
      LIMIT 1
    `);

    for (const pres of rows) {
      logger.info(`[kickoff-scheduler] Auto-iniciando presentación id=${pres.id} "${pres.title}"`);
      await startPresentation(pres.id, null);
    }
  } catch (err) {
    logger.error(`[kickoff-scheduler] Error en auto-start: ${err.message}`);
  }
}

// ─── post-event Q&A ───────────────────────────────────────────────────────────

async function getPostEventQA(eventId) {
  const { rows: presentations } = await db.query(
    `SELECT kp.id, kp.title, kp.sort_order, u.fullname AS presenter_name
     FROM kickoff_presentations kp
     LEFT JOIN users u ON u.id = kp.presenter_user_id
     WHERE kp.event_id = $1
       AND kp.status = 'finished'
       AND kp.is_intro = FALSE
     ORDER BY kp.sort_order ASC`,
    [eventId]
  );

  const result = [];
  for (const pres of presentations) {
    const { rows: questions } = await db.query(
      `SELECT kq.*, u.fullname AS user_fullname
       FROM kickoff_questions kq
       LEFT JOIN users u ON u.id = kq.user_id
       WHERE kq.presentation_id = $1
         AND kq.type = 'question'
         AND kq.status NOT IN ('hidden', 'rejected')
       ORDER BY kq.is_highlighted DESC, kq.created_at ASC`,
      [pres.id]
    );
    result.push({ ...pres, questions: questions.map(mapQuestion) });
  }
  return result;
}

// ─── tiebreaker ───────────────────────────────────────────────────────────────

// Llamada ÚNICA al arrancar el servidor (vía kickoff.scheduler).
// No debe invocarse en el hot path de requests.
async function initTiebreakerSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS kickoff_tiebreaker_rounds (
      id               SERIAL PRIMARY KEY,
      event_id         INTEGER     NOT NULL REFERENCES kickoff_events(id) ON DELETE CASCADE,
      round_number     INTEGER     NOT NULL DEFAULT 1,
      status           TEXT        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','finished')),
      winner_aporte_id INTEGER     REFERENCES kickoff_questions(id),
      created_by       INTEGER     REFERENCES users(id) ON DELETE SET NULL,
      finished_by      INTEGER     REFERENCES users(id) ON DELETE SET NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at      TIMESTAMPTZ
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS kickoff_tiebreaker_candidates (
      id        SERIAL PRIMARY KEY,
      round_id  INTEGER NOT NULL REFERENCES kickoff_tiebreaker_rounds(id) ON DELETE CASCADE,
      aporte_id INTEGER NOT NULL REFERENCES kickoff_questions(id)          ON DELETE CASCADE,
      UNIQUE (round_id, aporte_id)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS kickoff_tiebreaker_votes (
      id         SERIAL PRIMARY KEY,
      round_id   INTEGER     NOT NULL REFERENCES kickoff_tiebreaker_rounds(id) ON DELETE CASCADE,
      aporte_id  INTEGER     NOT NULL REFERENCES kickoff_questions(id)          ON DELETE CASCADE,
      user_id    INTEGER     NOT NULL REFERENCES users(id)                      ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (round_id, user_id)
    )
  `);
}

// Devuelve los aportes empatados en el primer lugar (misma avg_rating máxima, con votos).
async function getTiedAportes(eventId) {
  const { rows } = await db.query(`
    WITH ranked AS (
      SELECT kq.id,
             kq.question_text                            AS aporte_text,
             COALESCE(u.fullname, 'Colaborador')         AS collaborator_name,
             up.avatar_url                               AS collaborator_avatar_url,
             kp.title                                    AS presentation_title,
             COUNT(kar.id)::int                          AS rating_count,
             ROUND(AVG(kar.rating)::numeric, 2)          AS avg_rating
      FROM kickoff_questions kq
      JOIN kickoff_presentations kp ON kp.id = kq.presentation_id
      LEFT JOIN users u             ON u.id  = kq.user_id
      LEFT JOIN user_profile up     ON up.user_id = kq.user_id
      LEFT JOIN kickoff_aporte_ratings kar ON kar.aporte_id = kq.id
      WHERE kp.event_id = $1
        AND kq.type     = 'aporte'
        AND kq.status  != 'hidden'
        AND kp.is_intro = FALSE
      GROUP BY kq.id, kq.question_text, kq.user_id, u.fullname, up.avatar_url, kp.title
      HAVING COUNT(kar.id) > 0
    )
    SELECT r.*
    FROM ranked r
    WHERE r.avg_rating = (SELECT MAX(avg_rating) FROM ranked)
    ORDER BY r.collaborator_name ASC
  `, [eventId]);
  return rows;
}

async function getTiebreakerStatus(eventId, userId) {


  const tiedAportes = await getTiedAportes(eventId);
  const hasTie = tiedAportes.length >= 2;

  // Ronda activa con candidatos y conteo de votos
  const { rows: activeRows } = await db.query(`
    SELECT r.*,
      (SELECT v.aporte_id FROM kickoff_tiebreaker_votes v
       WHERE v.round_id = r.id AND v.user_id = $2) AS user_voted_for,
      (SELECT COUNT(*)::int FROM kickoff_tiebreaker_votes v WHERE v.round_id = r.id) AS total_votes
    FROM kickoff_tiebreaker_rounds r
    WHERE r.event_id = $1 AND r.status = 'active'
    LIMIT 1
  `, [eventId, userId || null]);

  let activeRound = null;
  if (activeRows[0]) {
    const { rows: cands } = await db.query(`
      SELECT c.aporte_id,
             kq.question_text                          AS aporte_text,
             COALESCE(u.fullname, 'Colaborador')       AS collaborator_name,
             up.avatar_url                             AS collaborator_avatar_url,
             kp.title                                  AS presentation_title,
             COUNT(v.id)::int                          AS vote_count
      FROM kickoff_tiebreaker_candidates c
      JOIN kickoff_questions kq    ON kq.id = c.aporte_id
      JOIN kickoff_presentations kp ON kp.id = kq.presentation_id
      LEFT JOIN users u            ON u.id  = kq.user_id
      LEFT JOIN user_profile up    ON up.user_id = kq.user_id
      LEFT JOIN kickoff_tiebreaker_votes v ON v.round_id = c.round_id AND v.aporte_id = c.aporte_id
      WHERE c.round_id = $1
      GROUP BY c.aporte_id, kq.question_text, kq.user_id, u.fullname, up.avatar_url, kp.title
      ORDER BY vote_count DESC
    `, [activeRows[0].id]);
    activeRound = { ...activeRows[0], candidates: cands };
  }

  // Última ronda finalizada (para mostrar resultado)
  const { rows: lastRows } = await db.query(`
    SELECT r.*,
      (SELECT COUNT(*)::int FROM kickoff_tiebreaker_votes v WHERE v.round_id = r.id) AS total_votes
    FROM kickoff_tiebreaker_rounds r
    WHERE r.event_id = $1 AND r.status = 'finished'
    ORDER BY r.round_number DESC LIMIT 1
  `, [eventId]);

  let lastRound = null;
  if (lastRows[0]) {
    const { rows: cands } = await db.query(`
      SELECT c.aporte_id,
             kq.question_text                          AS aporte_text,
             COALESCE(u.fullname, 'Colaborador')       AS collaborator_name,
             COUNT(v.id)::int                          AS vote_count
      FROM kickoff_tiebreaker_candidates c
      JOIN kickoff_questions kq ON kq.id = c.aporte_id
      LEFT JOIN users u         ON u.id  = kq.user_id
      LEFT JOIN kickoff_tiebreaker_votes v ON v.round_id = c.round_id AND v.aporte_id = c.aporte_id
      WHERE c.round_id = $1
      GROUP BY c.aporte_id, kq.question_text, kq.user_id, u.fullname
      ORDER BY vote_count DESC
    `, [lastRows[0].id]);
    lastRound = { ...lastRows[0], candidates: cands };
  }

  return { has_tie: hasTie, tied_aportes: tiedAportes, active_round: activeRound, last_round: lastRound };
}

async function startTiebreakerRound(eventId, candidateAporteIds, userId) {


  const { rows: active } = await db.query(
    `SELECT id FROM kickoff_tiebreaker_rounds WHERE event_id = $1 AND status = 'active'`,
    [eventId]
  );
  if (active.length > 0)
    throw Object.assign(new Error('Ya existe una ronda de desempate activa'), { status: 409 });

  if (!candidateAporteIds?.length || candidateAporteIds.length < 2)
    throw Object.assign(new Error('Se necesitan al menos 2 aportes para el desempate'), { status: 400 });

  const { rows: countRows } = await db.query(
    `SELECT COALESCE(MAX(round_number), 0) + 1 AS next FROM kickoff_tiebreaker_rounds WHERE event_id = $1`,
    [eventId]
  );
  const roundNum = countRows[0].next;

  const { rows } = await db.query(
    `INSERT INTO kickoff_tiebreaker_rounds (event_id, round_number, created_by)
     VALUES ($1, $2, $3) RETURNING *`,
    [eventId, roundNum, userId]
  );
  const round = rows[0];

  for (const aporteId of candidateAporteIds) {
    await db.query(
      `INSERT INTO kickoff_tiebreaker_candidates (round_id, aporte_id) VALUES ($1, $2)`,
      [round.id, aporteId]
    );
  }

  logger.info(`[kickoff-tiebreaker] Ronda #${roundNum} iniciada event=${eventId} por user=${userId}`);
  return round;
}

async function castTiebreakerVote(roundId, aporteId, userId) {


  const { rows: rnd } = await db.query(
    `SELECT id FROM kickoff_tiebreaker_rounds WHERE id = $1 AND status = 'active'`,
    [roundId]
  );
  if (!rnd[0]) throw Object.assign(new Error('La ronda de desempate no está activa'), { status: 409 });

  const { rows: cand } = await db.query(
    `SELECT id FROM kickoff_tiebreaker_candidates WHERE round_id = $1 AND aporte_id = $2`,
    [roundId, aporteId]
  );
  if (!cand[0]) throw Object.assign(new Error('El aporte no es candidato en esta ronda'), { status: 400 });

  const result = await db.query(
    `INSERT INTO kickoff_tiebreaker_votes (round_id, aporte_id, user_id)
     VALUES ($1, $2, $3) ON CONFLICT (round_id, user_id) DO NOTHING`,
    [roundId, aporteId, userId]
  );
  if (result.rowCount === 0)
    throw Object.assign(new Error('Ya emitiste tu voto en esta ronda'), { status: 409 });

  return { voted: true };
}

async function finishTiebreakerRound(roundId, userId) {


  const { rows: rnd } = await db.query(
    `SELECT id, event_id FROM kickoff_tiebreaker_rounds WHERE id = $1 AND status = 'active'`,
    [roundId]
  );
  if (!rnd[0]) throw Object.assign(new Error('La ronda no está activa'), { status: 409 });

  const { rows: results } = await db.query(`
    SELECT c.aporte_id, COUNT(v.id)::int AS vote_count
    FROM kickoff_tiebreaker_candidates c
    LEFT JOIN kickoff_tiebreaker_votes v ON v.round_id = c.round_id AND v.aporte_id = c.aporte_id
    WHERE c.round_id = $1
    GROUP BY c.aporte_id
    ORDER BY vote_count DESC
  `, [roundId]);

  const maxVotes = results[0]?.vote_count ?? 0;
  const topGroup = results.filter(r => r.vote_count === maxVotes);
  const winnerId = topGroup.length === 1 ? topGroup[0].aporte_id : null;

  await db.query(
    `UPDATE kickoff_tiebreaker_rounds
     SET status = 'finished', winner_aporte_id = $1, finished_by = $2, finished_at = NOW()
     WHERE id = $3`,
    [winnerId, userId, roundId]
  );

  logger.info(`[kickoff-tiebreaker] Ronda id=${roundId} finalizada. winner=${winnerId ?? 'empate'}`);
  return {
    still_tied:       topGroup.length > 1,
    tied_aporte_ids:  topGroup.length > 1 ? topGroup.map(r => r.aporte_id) : [],
    winner_aporte_id: winnerId,
    results,
  };
}

module.exports = {
  listAllEvents,
  getCurrentEvent, getAdminCurrentEvent, getEventById, createEvent, updateEvent, deleteEvent,
  getPresentationsByEvent, getPresentationById, createPresentation,
  updatePresentation, startPresentation, finishPresentation, deletePresentation,
  getBlocksByPresentation, getActiveBlock, advanceBlock, upsertBlock, deleteBlock,
  getQuestions, createQuestion, moderateQuestion,
  generateQrToken, validateQrToken, getActiveQrForPresentation,
  rateQuestion,
  rateAporte, getAporteRankings, getProgressGateForPresentation, getEventWinners,
  getEventSummary,
  getPostEventQA,
  autoStartOverduePresentations,
  initTiebreakerSchema,
  getTiebreakerStatus, startTiebreakerRound, castTiebreakerVote, finishTiebreakerRound,
};
