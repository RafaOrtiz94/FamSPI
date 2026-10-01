const db = require("../../config/db");
const logger = require("../../config/logger");
const { sendMail } = require("../../utils/mailer");
const { downloadFileBuffer } = require("../../utils/drive");
const { calendar } = require("../../config/google");
const { generateActaPdf, generateAbsentActaPdf, uploadExternalSignedPdf, uploadManualSignedActaPdf } = require("./trainings.drive");
const signatureWorkflowsService = require("../signature-workflows/signatureWorkflows.service");

// Estados de signature-workflows en los que un workflow sigue "en curso" (no
// se puede reemplazar por uno nuevo). El guard de duplicados debia checar
// esto -- antes solo miraba si *_workflow_id no era null, asi que un
// workflow ya cancelado/rechazado seguia bloqueando la creacion de uno
// nuevo para siempre (ver signatureWorkflows.service.js WORKFLOW_STATUS).
const ACTIVE_FAMSIGN_WORKFLOW_STATUSES = new Set(["prepared", "sent", "in_progress", "partially_signed"]);

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || process.env.APP_BASE_URL || "";
const DEFAULT_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const DEFAULT_TIMEZONE = process.env.GOOGLE_CALENDAR_TZ || "America/Guayaquil";

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function buildFullName(nombres, apellidos, fallback) {
  const n = (nombres || "").trim().toUpperCase();
  const a = (apellidos || "").trim().toUpperCase();
  if (a || n) return `${a} ${n}`.trim();
  return (fallback || "").trim().toUpperCase() || null;
}

function normalizeTrainerName(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

function toCalendarDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).split("T")[0].split(" ")[0];
}

async function generateCode(client) {
  const year = new Date().getFullYear();
  const prefix = `CAP-${year}-`;
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(CAST(SPLIT_PART(code, '-', 3) AS INTEGER)), 0) + 1 AS next_num
     FROM trainings WHERE code LIKE $1`,
    [`${prefix}%`]
  );
  return `${prefix}${String(rows[0].next_num).padStart(3, "0")}`;
}

async function fetchAttendeeSnapshots(client, userIds) {
  if (!userIds?.length) return [];
  const { rows } = await client.query(
    `SELECT u.id AS user_id,
            u.email,
            u.fullname,
            NULLIF(TRIM(cp.profile->'personal'->>'nombres'),   '') AS nombres,
            NULLIF(TRIM(cp.profile->'personal'->>'apellidos'), '') AS apellidos,
            NULLIF(TRIM(cp.profile->'personal'->>'cedula'),    '') AS cedula,
            NULLIF(TRIM(cp.profile->'laboral'->>'cargo'),      '') AS cargo
     FROM users u
     LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
     WHERE u.id = ANY($1::int[])`,
    [userIds]
  );
  return rows;
}

async function refreshInternalAttendeeSnapshots(client, trainingId) {
  await client.query(
    `UPDATE training_attendees ta
        SET name_snapshot   = COALESCE(
              NULLIF(TRIM(CONCAT_WS(' ',
                NULLIF(TRIM(cp.profile->'personal'->>'apellidos'), ''),
                NULLIF(TRIM(cp.profile->'personal'->>'nombres'), '')
              )), ''),
              NULLIF(TRIM(u.fullname), ''),
              ta.name_snapshot
            ),
            cedula_snapshot = COALESCE(NULLIF(TRIM(cp.profile->'personal'->>'cedula'), ''), ta.cedula_snapshot),
            cargo_snapshot  = COALESCE(NULLIF(TRIM(cp.profile->'laboral'->>'cargo'), ''), ta.cargo_snapshot),
            email_snapshot  = COALESCE(NULLIF(TRIM(u.email), ''), ta.email_snapshot)
       FROM users u
       LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      WHERE ta.training_id = $1
        AND ta.user_id = u.id
        AND ta.is_external = false`,
    [trainingId]
  );
}

function getMainActaRows(attendees = []) {
  return attendees.filter((a) => a.attendance_status !== "cancelled");
}

function getMainActaSigners(attendees = []) {
  const attended = attendees.filter((a) => a.attendance_status === "attended");
  if (attended.length) return attended;
  return attendees.filter((a) => a.attendance_status !== "absent" && a.attendance_status !== "cancelled");
}

/**
 * Inserta asistentes internos y externos
 * @param {*} client
 * @param {number} trainingId
 * @param {Array<{user_id?: number, email?: string, name?: string, cedula?: string, cargo?: string, is_external?: boolean}|number>} attendees
 */
async function insertAttendees(client, trainingId, attendees = []) {
  if (!attendees?.length) return;
  
  // Normalize: if it's an array of numbers, treat as user_ids
  const normalizedAttendees = attendees.map((a) => {
    if (typeof a === "number") {
      return { user_id: a, is_external: false };
    }
    return a;
  });

  // Separar internos y externos
  const internalUserIds = normalizedAttendees.filter(a => !a.is_external && a.user_id).map(a => a.user_id);
  const externalAttendees = normalizedAttendees.filter(a => a.is_external);

  // Insertar internos
  if (internalUserIds.length) {
    const profiles = await fetchAttendeeSnapshots(client, internalUserIds);
    for (const p of profiles) {
      const fullName = buildFullName(p.nombres, p.apellidos, p.fullname);
      await client.query(
        `INSERT INTO training_attendees
         (training_id, user_id, name_snapshot, cedula_snapshot, cargo_snapshot, email_snapshot, is_external)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       ON CONFLICT (training_id, user_id) WHERE user_id IS NOT NULL DO NOTHING`,
        [trainingId, p.user_id, fullName, p.cedula || null, p.cargo || null, p.email || null]
      );
    }
  }

  // Insertar externos
  for (const ext of externalAttendees) {
    if (!ext.email) continue;
    await client.query(
      `INSERT INTO training_attendees
         (training_id, user_id, name_snapshot, cedula_snapshot, cargo_snapshot, email_snapshot, is_external)
       VALUES ($1, null, $2, $3, $4, $5, true)
       ON CONFLICT DO NOTHING`,
      [trainingId, ext.name || null, ext.cedula || null, ext.cargo || null, ext.email]
    );
  }
}

/**
 * Crea un evento en Google Calendar para la capacitación y envía invitaciones
 * @param {Object} training 
 * @returns {Promise<{eventId: string, htmlLink: string} | null>}
 */
async function createTrainingCalendarEvent(training) {
  if (!training.scheduled_date || !training.scheduled_time_start) {
    logger.info({ trainingId: training.id }, "No hay fecha/hora para crear evento de calendario");
    return null;
  }

  try {
    const attendeeEmails = new Set(
      training.attendees
        .map((a) => String(a.email_snapshot || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const internalInviteIds = [...new Set([training.created_by, training.trainer_user_id].filter(Boolean))];
    if (internalInviteIds.length) {
      const { rows: internalInvitees } = await db.query(
        "SELECT email FROM users WHERE id = ANY($1::int[]) AND active = true",
        [internalInviteIds]
      );
      internalInvitees.forEach((item) => {
        const email = String(item.email || "").trim().toLowerCase();
        if (email) attendeeEmails.add(email);
      });
    }
    const attendees = [...attendeeEmails].map((email) => ({ email }));

    const scheduledDate = toCalendarDate(training.scheduled_date);
    const startDate = new Date(`${scheduledDate}T${training.scheduled_time_start}`);
    const endTime = training.scheduled_time_end || "18:00:00";
    const endDate = new Date(`${scheduledDate}T${endTime}`);

    const eventData = {
      summary: `[Capacitación] ${training.title}`,
      description: `${training.description || ""}\n\nCódigo: ${training.code}\nÁrea: ${training.area || "N/A"}`,
      start: { dateTime: startDate.toISOString(), timeZone: DEFAULT_TIMEZONE },
      end: { dateTime: endDate.toISOString(), timeZone: DEFAULT_TIMEZONE },
      location: training.location || "N/A",
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `training-${training.id}-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" }
        }
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 60 }
        ]
      },
      extendedProperties: {
        private: {
          trainingId: training.id,
          trainingCode: training.code,
          eventType: "training"
        }
      }
    };

    const response = await calendar.events.insert({
      calendarId: DEFAULT_CALENDAR_ID,
      resource: eventData,
      sendUpdates: "all", // Envía invitaciones automáticamente
      conferenceDataVersion: 1
    });

    logger.info({ trainingId: training.id, eventId: response.data.id }, "Evento de calendario creado");

    return { 
      eventId: response.data.id, 
      htmlLink: response.data.htmlLink, 
      meetLink: response.data.hangoutLink || null 
    };
  } catch (error) {
    logger.error({ err: error, trainingId: training.id }, "Error creando evento de calendario");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Query base para detalle completo
// ---------------------------------------------------------------------------

async function fetchTrainingById(id) {
  const { rows: [training] } = await db.query(
    `SELECT t.*,
            u.fullname AS created_by_name,
            u.email    AS created_by_email,
            tu.fullname AS trainer_user_name
     FROM trainings t
     LEFT JOIN users u  ON u.id  = t.created_by
     LEFT JOIN users tu ON tu.id = t.trainer_user_id
     WHERE t.id = $1 AND t.active = true`,
    [id]
  );
  if (!training) return null;

  const { rows: attendees } = await db.query(
    `SELECT ta.*,
            u.email    AS user_email_current,
            u.fullname AS user_fullname_current
     FROM training_attendees ta
     LEFT JOIN users u ON u.id = ta.user_id
     WHERE ta.training_id = $1
     ORDER BY COALESCE(u.fullname, ta.name_snapshot) ASC`,
    [id]
  );

  return { ...training, attendees };
}

// ---------------------------------------------------------------------------
// CRUD principal
// ---------------------------------------------------------------------------

async function createTraining(payload, user) {
  const client = await db.getClient();
  let committed = false;
  try {
    await client.query("BEGIN");

    const code = await generateCode(client);
    const requiresFamsign = ["interna", "externa_instructor"].includes(payload.type);
    const initialStatus = payload.scheduled_date && payload.scheduled_time_start ? "scheduled" : "draft";

    const { rows: [training] } = await client.query(
      `INSERT INTO trainings (
         code, title, description, type, event_type, status, modality,
         scheduled_date, scheduled_time_start, scheduled_time_end, duration_hours,
         location, area, category,
         objectives, methodology, topics, material,
         observations, conclusions, observaciones_inasistentes, conclusiones_inasistentes,
         trainer_name, trainer_type, trainer_user_id,
         requires_famsign, created_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,
         $8,$9,$10,$11,
         $12,$13,$14,
         $15,$16,$17,$18,
         $19,$20,$21,$22,
         $23,$24,$25,
         $26,$27
       ) RETURNING id`,
      [
        code,
        payload.title,
        payload.description || null,
        payload.type,
        payload.event_type || "capacitacion",
        initialStatus,
        payload.modality || "presencial",
        payload.scheduled_date || null,
        payload.scheduled_time_start || null,
        payload.scheduled_time_end || null,
        payload.duration_hours || null,
        payload.location || null,
        payload.area || null,
        payload.category || null,
        payload.objectives || null,
        payload.methodology || null,
        payload.topics?.length ? payload.topics : null,
        payload.material || null,
        payload.observations || null,
        payload.conclusions || null,
        payload.observaciones_inasistentes || null,
        payload.conclusiones_inasistentes || null,
        normalizeTrainerName(payload.trainer_name),
        payload.trainer_type || null,
        payload.trainer_user_id || null,
        requiresFamsign,
        user.id,
      ]
    );

    // Insertar asistentes
    if (payload.attendees?.length) {
      await insertAttendees(client, training.id, payload.attendees);
    }

    await client.query("COMMIT");
    committed = true;

    const fullTraining = await fetchTrainingById(training.id);

    // Si la capacitación está programada, crear evento de calendario
    if (fullTraining.status === "scheduled") {
      const calendarEvent = await createTrainingCalendarEvent(fullTraining);
      if (calendarEvent) {
        await db.query(
          `UPDATE trainings SET calendar_event_id = $1, calendar_event_link = $2, meet_link = $3, updated_at = NOW() WHERE id = $4`,
          [calendarEvent.eventId, calendarEvent.htmlLink, calendarEvent.meetLink, training.id]
        );
      }
    }

    return fetchTrainingById(training.id);
  } catch (err) {
    if (!committed) {
      await client.query("ROLLBACK");
    }
    logger.error({ err }, "createTraining error");
    throw err;
  } finally {
    client.release();
  }
}

const SUPER_ROLES_SVC = new Set(["admin", "administrador"]);

async function listTrainings(filters = {}, user) {
  const conditions = ["t.active = true"];
  const params = [];
  let i = 1;

  const isAdmin = SUPER_ROLES_SVC.has(user?.role);

  // Non-admins: only see trainings they created or are an attendee of
  if (!isAdmin && user?.id) {
    conditions.push(
      `(t.created_by = $${i} OR EXISTS (
         SELECT 1 FROM training_attendees _ta
         WHERE _ta.training_id = t.id AND _ta.user_id = $${i}
       ))`
    );
    params.push(user.id);
    i++;
  }

  if (filters.type) {
    conditions.push(`t.type = $${i++}`);
    params.push(filters.type);
  }
  if (filters.status) {
    conditions.push(`t.status = $${i++}`);
    params.push(filters.status);
  }
  if (filters.area) {
    conditions.push(`t.area ILIKE $${i++}`);
    params.push(`%${filters.area}%`);
  }
  if (filters.event_type) {
    conditions.push(`t.event_type = $${i++}`);
    params.push(filters.event_type);
  }
  if (filters.date_from) {
    conditions.push(`t.scheduled_date >= $${i++}`);
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    conditions.push(`t.scheduled_date <= $${i++}`);
    params.push(filters.date_to);
  }
  if (filters.search) {
    conditions.push(`(t.title ILIKE $${i} OR t.code ILIKE $${i})`);
    params.push(`%${filters.search}%`);
    i++;
  }

  const where = conditions.join(" AND ");
  const userId = user?.id ?? null;

  const { rows } = await db.query(
    `SELECT t.id, t.code, t.title, t.type, t.event_type, t.status, t.modality,
            t.scheduled_date, t.scheduled_time_start, t.scheduled_time_end,
            t.duration_hours, t.area, t.category, t.trainer_name, t.trainer_type,
            t.requires_famsign, t.signature_workflow_status, t.absent_workflow_status,
            t.created_by, t.created_at, t.updated_at,
            u.fullname AS created_by_name,
            (t.created_by = $${i})                                              AS is_owner,
            COUNT(ta.id)                                                        AS total_attendees,
            COUNT(ta.id) FILTER (WHERE ta.attendance_status = 'attended')       AS total_attended,
            COUNT(ta.id) FILTER (WHERE ta.attendance_status = 'absent')         AS total_absent,
            COUNT(ta.id) FILTER (WHERE ta.signature_status = 'signed')          AS total_signed,
            COUNT(ta.id) FILTER (WHERE ta.absent_signature_status = 'signed')   AS total_absent_signed
     FROM trainings t
     LEFT JOIN users u ON u.id = t.created_by
     LEFT JOIN training_attendees ta ON ta.training_id = t.id
     WHERE ${where}
     GROUP BY t.id, u.fullname
     ORDER BY t.created_at DESC
     LIMIT $${i + 1} OFFSET $${i + 2}`,
    [...params, userId, filters.limit || 50, filters.offset || 0]
  );

  return rows;
}

async function getTraining(id, user) {
  const training = await fetchTrainingById(id);
  if (!training) {
    const err = new Error("Capacitación no encontrada");
    err.status = 404;
    throw err;
  }
  const isAdmin = SUPER_ROLES_SVC.has(user?.role);
  training.is_owner = isAdmin || training.created_by === user?.id;
  return training;
}

async function updateTraining(id, payload, user) {
  const { rows: [current] } = await db.query(
    "SELECT id, status, created_by FROM trainings WHERE id = $1 AND active = true",
    [id]
  );
  if (!current) {
    const err = new Error("Capacitación no encontrada");
    err.status = 404;
    throw err;
  }
  const editableInPlanning = new Set([
    "title", "description", "type", "event_type", "modality",
    "scheduled_date", "scheduled_time_start", "scheduled_time_end", "duration_hours",
    "location", "area", "category", "objectives", "methodology", "topics", "material",
    "trainer_name", "trainer_type", "trainer_user_id",
    "observations", "conclusions", "observaciones_inasistentes", "conclusiones_inasistentes", "status",
  ]);
  const editableInProgress = new Set([
    "objectives", "methodology", "topics", "material",
    "observations", "conclusions", "observaciones_inasistentes", "conclusiones_inasistentes",
  ]);

  const allowedFields =
    ["draft", "scheduled"].includes(current.status)
      ? editableInPlanning
      : current.status === "in_progress"
        ? editableInProgress
        : null;

  if (!allowedFields) {
    const err = new Error("Solo se puede editar una capacitación en borrador, programada o su contenido durante la ejecución");
    err.status = 422;
    throw err;
  }

  const sets = [];
  const params = [];
  let i = 1;

  for (const [field, value] of Object.entries(payload || {})) {
    if (!allowedFields.has(field)) continue;
    if (value !== undefined) {
      sets.push(`${field} = $${i++}`);
      params.push(field === "trainer_name" ? normalizeTrainerName(value) : (value ?? null));
    }
  }

  if (!sets.length) return fetchTrainingById(id);

  sets.push(`updated_at = NOW()`);
  params.push(id);

  await db.query(
    `UPDATE trainings SET ${sets.join(", ")} WHERE id = $${i}`,
    params
  );

  const updatedTraining = await fetchTrainingById(id);

  // Si cambiamos a status 'scheduled' y no hay evento de calendario, crear uno
  if (updatedTraining.status === "scheduled" && !updatedTraining.calendar_event_id) {
    const calendarEvent = await createTrainingCalendarEvent(updatedTraining);
    if (calendarEvent) {
      await db.query(
        `UPDATE trainings SET calendar_event_id = $1, calendar_event_link = $2, meet_link = $3, updated_at = NOW() WHERE id = $4`,
        [calendarEvent.eventId, calendarEvent.htmlLink, calendarEvent.meetLink, id]
      );
    }
  }

  return fetchTrainingById(id);
}

async function cancelTraining(id, user) {
  const { rows: [current] } = await db.query(
    "SELECT id, status FROM trainings WHERE id = $1 AND active = true",
    [id]
  );
  if (!current) {
    const err = new Error("Capacitación no encontrada");
    err.status = 404;
    throw err;
  }
  if (current.status === "completed") {
    const err = new Error("No se puede cancelar una capacitación ya completada");
    err.status = 422;
    throw err;
  }

  await db.query(
    "UPDATE trainings SET status = 'cancelled', active = false, updated_at = NOW() WHERE id = $1",
    [id]
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Gestión de asistentes
// ---------------------------------------------------------------------------

async function addAttendees(trainingId, attendees, user) {
  const { rows: [training] } = await db.query(
    "SELECT id, status FROM trainings WHERE id = $1 AND active = true",
    [trainingId]
  );
  if (!training) {
    const err = new Error("Capacitación no encontrada");
    err.status = 404;
    throw err;
  }
  if (!["draft", "scheduled"].includes(training.status)) {
    const err = new Error("Solo se pueden agregar asistentes en borrador o programada");
    err.status = 422;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await insertAttendees(client, trainingId, attendees);
    await client.query("UPDATE trainings SET updated_at = NOW() WHERE id = $1", [trainingId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return fetchTrainingById(trainingId);
}

async function removeAttendee(trainingId, attendeeId, user) {
  const { rows: [training] } = await db.query(
    "SELECT id, status FROM trainings WHERE id = $1 AND active = true",
    [trainingId]
  );
  if (!training) {
    const err = new Error("Capacitación no encontrada");
    err.status = 404;
    throw err;
  }
  if (!["draft", "scheduled"].includes(training.status)) {
    const err = new Error("No se puede modificar asistentes en este estado");
    err.status = 422;
    throw err;
  }

  await db.query(
    "DELETE FROM training_attendees WHERE training_id = $1 AND id = $2",
    [trainingId, attendeeId]
  );
  await db.query("UPDATE trainings SET updated_at = NOW() WHERE id = $1", [trainingId]);

  return fetchTrainingById(trainingId);
}

// ---------------------------------------------------------------------------
// Marcar asistencia post-evento
// ---------------------------------------------------------------------------

/**
 * attendanceList: [{userId?: number, attendeeId?: number, status: 'attended'|'absent'}]
 */
async function markAttendance(trainingId, attendanceList, user) {
  if (!Array.isArray(attendanceList) || !attendanceList.length) {
    const err = new Error("Lista de asistencia requerida");
    err.status = 422;
    throw err;
  }

  const { rows: [training] } = await db.query(
    "SELECT id, status FROM trainings WHERE id = $1 AND active = true",
    [trainingId]
  );
  if (!training) {
    const err = new Error("Capacitación no encontrada");
    err.status = 404;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    for (const entry of attendanceList) {
      if (!["attended", "absent"].includes(entry.status)) continue;
      let whereClause = "training_id = $1";
      let params = [trainingId, entry.status];
      
      if (entry.attendeeId) {
        whereClause += " AND id = $3";
        params.push(entry.attendeeId);
      } else if (entry.userId) {
        whereClause += " AND user_id = $3";
        params.push(entry.userId);
      } else {
        continue;
      }

      await client.query(
        `UPDATE training_attendees
         SET attendance_status = $2, attendance_marked_at = NOW()
         WHERE ${whereClause}`,
        params
      );
    }

    // Si todos tienen asistencia marcada, mover a in_progress si estaba scheduled
    if (training.status === "scheduled") {
      await client.query(
        "UPDATE trainings SET status = 'in_progress', updated_at = NOW() WHERE id = $1",
        [trainingId]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return fetchTrainingById(trainingId);
}

// ---------------------------------------------------------------------------
// Consulta: mis capacitaciones como asistente
// ---------------------------------------------------------------------------

async function getMyAssigned(user) {
  const { rows } = await db.query(
    `SELECT t.id, t.code, t.title, t.type, t.event_type, t.status,
            t.scheduled_date, t.scheduled_time_start, t.area,
            t.signature_workflow_status,
            ta.attendance_status, ta.signature_status, ta.signed_at
     FROM training_attendees ta
     JOIN trainings t ON t.id = ta.training_id
     WHERE ta.user_id = $1 AND t.active = true
     ORDER BY t.scheduled_date DESC NULLS LAST`,
    [user.id]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Generación de acta (Google Docs → PDF en Drive)
// ---------------------------------------------------------------------------

async function generateActa(trainingId, user) {
  const client = await db.getClient();
  let training;
  try {
    await client.query("BEGIN");
    await refreshInternalAttendeeSnapshots(client, trainingId);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  training = await fetchTrainingById(trainingId);
  if (!training) {
    const err = new Error("Capacitación no encontrada"); err.status = 404; throw err;
  }
  if (!["interna", "externa_instructor"].includes(training.type)) {
    const err = new Error("Este tipo de capacitación no genera acta con FamSign"); err.status = 422; throw err;
  }

  const actaRows = getMainActaRows(training.attendees);
  if (!actaRows.length) {
    const err = new Error("No hay participantes válidos para generar el acta principal"); err.status = 422; throw err;
  }

  const { pdfId, pdfUrl, folderId, pdfBase64, content_hash_sha256, hash_algorithm, md5_drive } = await generateActaPdf(training, actaRows);

  await db.query(
    `UPDATE trainings
     SET acta_drive_doc_id = $1, acta_drive_url = $2, acta_folder_id = $3,
         acta_generated_at = NOW(), updated_at = NOW()
     WHERE id = $4`,
    [pdfId, pdfUrl, folderId, trainingId]
  );

  logger.info({ trainingId, pdfId }, "Acta generada en Drive como PDF sellado con SHA256");
  // Devolvemos pdfBase64 en memoria para uso inmediato (envío a FamSign)
  return { 
    ...(await fetchTrainingById(trainingId)), 
    _pdfBase64: pdfBase64,
    _content_hash_sha256: content_hash_sha256,
    _hash_algorithm: hash_algorithm,
    _md5_drive: md5_drive
  };
}

// ---------------------------------------------------------------------------
// Subida de PDF firmado por instructor externo
// ---------------------------------------------------------------------------

async function uploadExternalActa(trainingId, fileBuffer, filename, user) {
  const training = await fetchTrainingById(trainingId);
  if (!training) {
    const err = new Error("Capacitación no encontrada"); err.status = 404; throw err;
  }
  if (training.type !== "externa_instructor") {
    const err = new Error("Solo aplica para capacitaciones con instructor externo"); err.status = 422; throw err;
  }
  if (!training.acta_drive_doc_id) {
    const err = new Error("Primero genera el acta antes de subir la versión firmada"); err.status = 422; throw err;
  }

  const { driveId, driveUrl } = await uploadExternalSignedPdf(fileBuffer, training.code);

  await db.query(
    `UPDATE trainings
     SET external_signed_drive_id  = $1,
         external_signed_drive_url = $2,
         external_signed_at        = NOW(),
         external_signed_by_name   = $3,
         updated_at                = NOW()
     WHERE id = $4`,
    [driveId, driveUrl, training.trainer_name || null, trainingId]
  );

  logger.info({ trainingId, driveId }, "Acta firmada por externo subida a Drive");
  return fetchTrainingById(trainingId);
}

// ---------------------------------------------------------------------------
// FamSign — workflow principal de asistentes
// ---------------------------------------------------------------------------

async function uploadManualSignedActa(trainingId, fileBuffer, filename, user) {
  const training = await fetchTrainingById(trainingId);
  if (!training) {
    const err = new Error("Capacitación no encontrada"); err.status = 404; throw err;
  }
  if (!training.acta_drive_url) {
    const err = new Error("Primero genera el acta antes de subir el documento firmado"); err.status = 422; throw err;
  }

  const { driveId, driveUrl } = await uploadManualSignedActaPdf(fileBuffer, training.code, "main");

  await db.query(
    `UPDATE trainings
     SET manual_signed_drive_id = $1,
         manual_signed_drive_url = $2,
         manual_signed_at = NOW(),
         manual_signed_by_user_id = $3,
         updated_at = NOW()
     WHERE id = $4`,
    [driveId, driveUrl, user.id, trainingId]
  );

  logger.info({ trainingId, driveId }, "Acta firmada manualmente subida a Drive");
  return fetchTrainingById(trainingId);
}

async function uploadManualSignedAbsentActa(trainingId, fileBuffer, filename, user) {
  const training = await fetchTrainingById(trainingId);
  if (!training) {
    const err = new Error("Capacitación no encontrada"); err.status = 404; throw err;
  }
  if (!training.absent_acta_drive_url) {
    const err = new Error("Primero genera el acta de inasistentes antes de subir el documento firmado"); err.status = 422; throw err;
  }

  const { driveId, driveUrl } = await uploadManualSignedActaPdf(fileBuffer, training.code, "absent");

  await db.query(
    `UPDATE trainings
     SET absent_manual_signed_drive_id = $1,
         absent_manual_signed_drive_url = $2,
         absent_manual_signed_at = NOW(),
         absent_manual_signed_by_user_id = $3,
         updated_at = NOW()
     WHERE id = $4`,
    [driveId, driveUrl, user.id, trainingId]
  );

  logger.info({ trainingId, driveId }, "Acta de inasistentes firmada manualmente subida a Drive");
  return fetchTrainingById(trainingId);
}

async function sendActaToFamSign(trainingId, user) {
  const training = await fetchTrainingById(trainingId);
  if (!training) {
    const err = new Error("Capacitación no encontrada"); err.status = 404; throw err;
  }
  if (training.signature_workflow_id && ACTIVE_FAMSIGN_WORKFLOW_STATUSES.has(String(training.signature_workflow_status || "").toLowerCase())) {
    const err = new Error("Ya existe un workflow FamSign para esta capacitación"); err.status = 422; throw err;
  }

  let pdfBase64;
  let pdfFilename;

  if (training.type === "interna") {
    if (!training.acta_drive_doc_id) {
      const err = new Error("Genera el acta antes de enviar a FamSign"); err.status = 422; throw err;
    }
    // Descargar PDF del Google Doc
    const buf = await downloadFileBuffer(training.acta_drive_doc_id);
    pdfBase64  = buf.toString("base64");
    pdfFilename = `Acta ${training.code}.pdf`;

  } else if (training.type === "externa_instructor") {
    if (!training.external_signed_drive_id) {
      const err = new Error("Sube el acta firmada por el instructor externo antes de enviar a FamSign"); err.status = 422; throw err;
    }
    // Usar el PDF ya firmado físicamente por el externo
    // Fuente obligatoria para instructor externo: PDF firmado fisicamente.
    // No usar acta_drive_doc_id aqui: ese es el borrador generado sin la firma
    // fisica del capacitador externo.
    const buf = await downloadFileBuffer(training.external_signed_drive_id);
    pdfBase64  = buf.toString("base64");
    pdfFilename = `Acta Firmada Externo ${training.code}.pdf`;

  } else {
    const err = new Error("Este tipo de capacitación no usa FamSign de asistentes"); err.status = 422; throw err;
  }

  const attendees = getMainActaSigners(training.attendees);
  if (!attendees.length) {
    const err = new Error("No hay asistentes asignados"); err.status = 422; throw err;
  }

  // Construir firmantes según tipo
  const signers = [];

  if (training.type === "interna") {
    // Creador firma primero (seq 1)
    signers.push({ user_id: training.created_by, sequence_order: 1, is_required: true });
    // Asistentes en paralelo (seq 2)
    attendees.forEach((a) => {
      if (a.is_external) {
        signers.push({ 
          email: a.email_snapshot, 
          name: a.name_snapshot, 
          role: a.cargo_snapshot || "invitado", 
          cedula: a.cedula_snapshot, 
          sequence_order: 2, 
          is_required: true 
        });
      } else {
        signers.push({ user_id: a.user_id, sequence_order: 2, is_required: true });
      }
    });
  } else {
    // externa_instructor: solo asistentes (el externo ya firmó el PDF físicamente)
    attendees.forEach((a) => {
      if (a.is_external) {
        signers.push({ 
          email: a.email_snapshot, 
          name: a.name_snapshot, 
          role: a.cargo_snapshot || "invitado", 
          cedula: a.cedula_snapshot, 
          sequence_order: 1, 
          is_required: true 
        });
      } else {
        signers.push({ user_id: a.user_id, sequence_order: 1, is_required: true });
      }
    });
  }

  const workflowResult = await signatureWorkflowsService.createWorkflow({
    payload: {
      sourceModule:   "trainings",
      sourceEntity:   "acta",
      sourceEntityId: training.id,
      documentType:   "capacitacion",
      title:          `Acta de Capacitación — ${training.code}`,
      description:    training.title,
      document:       { filename: pdfFilename, pdf_base64: pdfBase64 },
      signers,
      meta: {
        training_type: training.type,
        area: training.area,
        event_type: training.event_type,
        document_source: training.type === "externa_instructor" ? "external_physically_signed_pdf" : "generated_training_acta",
        source_drive_file_id: training.type === "externa_instructor" ? training.external_signed_drive_id : training.acta_drive_doc_id,
        external_instructor_signed: training.type === "externa_instructor",
      },
    },
    user,
  });

  await signatureWorkflowsService.sendWorkflow(workflowResult.workflow.id, user);

  // Marcar training como in_progress si aún no lo está
  await db.query(
    `UPDATE trainings
     SET status = CASE WHEN status = 'scheduled' THEN 'in_progress' ELSE status END,
         signature_workflow_id = $1, updated_at = NOW()
     WHERE id = $2`,
    [workflowResult.workflow.id, trainingId]
  );

  logger.info({ trainingId, workflowId: workflowResult.workflow.id }, "Workflow FamSign de asistentes enviado");
  return fetchTrainingById(trainingId);
}

// ---------------------------------------------------------------------------
// FamSign — workflow de inasistentes
// ---------------------------------------------------------------------------

async function generateAbsentActa(trainingId, user) {
  const client = await db.getClient();
  let training;
  try {
    await client.query("BEGIN");
    await refreshInternalAttendeeSnapshots(client, trainingId);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  training = await fetchTrainingById(trainingId);
  if (!training) {
    const err = new Error("Capacitación no encontrada"); err.status = 404; throw err;
  }

  const absent = training.attendees.filter((a) => a.attendance_status === "absent");
  if (!absent.length) {
    const err = new Error("No hay inasistentes marcados"); err.status = 422; throw err;
  }

  const { pdfId, pdfUrl, folderId, pdfBase64, content_hash_sha256, hash_algorithm, md5_drive } = await generateAbsentActaPdf(training, absent);

  await db.query(
    `UPDATE trainings
     SET absent_acta_drive_pdf_id = $1, absent_acta_drive_url = $2,
         absent_acta_generated_at = NOW(), updated_at = NOW()
     WHERE id = $3`,
    [pdfId, pdfUrl, trainingId]
  );

  logger.info({ trainingId, pdfId }, "Acta de inasistentes generada en Drive como PDF sellado con SHA256");
  return fetchTrainingById(trainingId);
}

async function sendAbsentActaToFamSign(trainingId, user) {
  const training = await fetchTrainingById(trainingId);
  if (!training) {
    const err = new Error("Capacitación no encontrada"); err.status = 404; throw err;
  }
  if (!training.absent_acta_drive_pdf_id) {
    const err = new Error("Primero genera el acta de inasistentes"); err.status = 422; throw err;
  }
  if (training.absent_workflow_id && ACTIVE_FAMSIGN_WORKFLOW_STATUSES.has(String(training.absent_workflow_status || "").toLowerCase())) {
    const err = new Error("Ya existe un workflow FamSign para inasistentes"); err.status = 422; throw err;
  }

  const absent = training.attendees.filter((a) => a.attendance_status === "absent");
  if (!absent.length) {
    const err = new Error("No hay inasistentes"); err.status = 422; throw err;
  }

  const buf      = await downloadFileBuffer(training.absent_acta_drive_pdf_id);
  const pdfBase64 = buf.toString("base64");

  const signers = [];
  const signerKeys = new Set();
  const presenterUserId = training.type === "interna"
    ? (training.trainer_user_id || training.created_by)
    : null;
  const absentSequenceOrder = presenterUserId ? 2 : 1;

  if (presenterUserId) {
    signers.push({ user_id: presenterUserId, sequence_order: 1, is_required: true });
    signerKeys.add(`user:${Number(presenterUserId)}`);
  }

  absent.forEach((a) => {
    if (a.is_external) {
      const email = String(a.email_snapshot || "").trim().toLowerCase();
      if (email) {
        const key = `email:${email}`;
        if (signerKeys.has(key)) return;
        signerKeys.add(key);
      }
      signers.push({
        email: a.email_snapshot,
        name: a.name_snapshot,
        role: a.cargo_snapshot || "invitado",
        cedula: a.cedula_snapshot,
        sequence_order: absentSequenceOrder,
        is_required: true
      });
      return;
    }
    const key = `user:${Number(a.user_id)}`;
    if (signerKeys.has(key)) return;
    signerKeys.add(key);
    signers.push({ user_id: a.user_id, sequence_order: absentSequenceOrder, is_required: true });
  });

  const workflowResult = await signatureWorkflowsService.createWorkflow({
    payload: {
      sourceModule:   "trainings",
      sourceEntity:   "acta_inasistentes",
      sourceEntityId: training.id,
      documentType:   "inasistencia_capacitacion",
      title:          `Acta de Inasistencia — ${training.code}`,
      description:    training.title,
      document:       { filename: `Acta Inasistentes ${training.code}.pdf`, pdf_base64: pdfBase64 },
      signers,
      meta: { training_type: training.type, area: training.area, is_absent_acta: true },
    },
    user,
  });

  await signatureWorkflowsService.sendWorkflow(workflowResult.workflow.id, user);

  await db.query(
    `UPDATE trainings SET absent_workflow_id = $1, updated_at = NOW() WHERE id = $2`,
    [workflowResult.workflow.id, trainingId]
  );

  logger.info({ trainingId, workflowId: workflowResult.workflow.id }, "Workflow FamSign de inasistentes enviado");
  return fetchTrainingById(trainingId);
}

// ---------------------------------------------------------------------------
// Re-notificación manual de firmantes pendientes (FAB)
// workflowType: 'main' | 'absent'
// ---------------------------------------------------------------------------

async function remindPendingSigners(trainingId, workflowType, user) {
  const training = await fetchTrainingById(trainingId);
  if (!training) {
    const err = new Error("Capacitación no encontrada"); err.status = 404; throw err;
  }

  const workflowId = workflowType === "absent"
    ? training.absent_workflow_id
    : training.signature_workflow_id;

  if (!workflowId) {
    const err = new Error("No existe workflow activo para notificar"); err.status = 422; throw err;
  }

  // Cooldown de 15 min por firmante para evitar spam en accionamiento manual
  const { rows: pending } = await db.query(
    `SELECT s.id, s.user_id, s.email_snapshot, s.name_snapshot,
            s.access_token, s.sequence_order, s.available_at, s.last_reminder_sent_at,
            w.workflow_code, w.title
     FROM signature_workflow_signers s
     JOIN signature_workflows w ON w.id = s.workflow_id
     WHERE s.workflow_id = $1
       AND s.status IN ('available', 'opened')
       AND w.active = true
       AND (s.last_reminder_sent_at IS NULL
            OR s.last_reminder_sent_at < NOW() - INTERVAL '15 minutes')`,
    [workflowId]
  );

  if (!pending.length) return { notified: 0 };

  let notified = 0;
  for (const signer of pending) {
    const signLink = signer.access_token
      ? `${FRONTEND_BASE_URL}/firmar/${signer.access_token}`
      : `${FRONTEND_BASE_URL}/dashboard/firma`;

    const tipoLabel = workflowType === "absent" ? "Acta de Inasistencia" : "Acta de Capacitación";

    try {
      await sendMail({
        to: signer.email_snapshot,
        subject: `[FamSPI] Firma pendiente — ${tipoLabel} ${training.code}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
            <div style="background:#1e293b;padding:20px 28px;border-radius:8px 8px 0 0">
              <h1 style="color:#fff;margin:0;font-size:17px">Firma pendiente — FamSPI</h1>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:24px 28px;border-radius:0 0 8px 8px">
              <p style="margin:0 0 14px">Hola <strong>${signer.name_snapshot || ""}</strong>,</p>
              <p style="margin:0 0 14px">Tienes pendiente firmar el <strong>${tipoLabel}</strong>:</p>
              <p style="margin:0 0 6px"><strong>${training.title}</strong></p>
              <p style="margin:0 0 20px;color:#64748b;font-size:13px">${training.code}</p>
              <a href="${signLink}"
                 style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;
                        border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
                Firmar ahora →
              </a>
            </div>
          </div>`,
      });

      await db.query(
        "UPDATE signature_workflow_signers SET last_reminder_sent_at = NOW() WHERE id = $1",
        [signer.id]
      );
      notified++;
    } catch (mailErr) {
      logger.warn({ mailErr, signerId: signer.id }, "Error enviando recordatorio manual");
    }
  }

  logger.info({ trainingId, workflowType, notified }, "Recordatorios manuales enviados");
  return { notified };
}

module.exports = {
  buildFullName,
  normalizeTrainerName,
  createTraining,
  listTrainings,
  getTraining,
  updateTraining,
  cancelTraining,
  addAttendees,
  removeAttendee,
  markAttendance,
  getMyAssigned,
  // Acta + FamSign
  generateActa,
  uploadExternalActa,
  uploadManualSignedActa,
  sendActaToFamSign,
  generateAbsentActa,
  uploadManualSignedAbsentActa,
  sendAbsentActaToFamSign,
  remindPendingSigners,
};
