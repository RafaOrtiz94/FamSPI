const cron = require("node-cron");
const db = require("../config/db");
const logger = require("../config/logger");
const notificationManager = require("../modules/notifications/notificationManager");
const { createTimeOffEvent } = require("../utils/calendar");

const TIMEZONE = process.env.SCHEDULE_REMINDER_TIMEZONE || "America/Guayaquil";
const MID_MONTH_DAY = Number.parseInt(process.env.SCHEDULE_MID_MONTH_REMINDER_DAY || "15", 10);
const LAST_WEEK_WINDOW_DAYS = Number.parseInt(process.env.SCHEDULE_LAST_WEEK_WINDOW_DAYS || "7", 10);
const EVENT_DURATION_MINUTES = Number.parseInt(process.env.SCHEDULE_RECOVERY_EVENT_MINUTES || "60", 10);
const WORKDAY_START_HOUR = 9;
const WORKDAY_END_HOUR = 18;

function getLocalParts(value = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    calendar: "iso8601",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return Object.fromEntries(
    formatter.formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function toLocalDateKey(value = new Date()) {
  const parts = getLocalParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getMonthBounds({ year, month }) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const endExclusive = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: start.toISOString().slice(0, 10),
    endDateExclusive: endExclusive.toISOString().slice(0, 10),
    lastDay,
  };
}

function dateKeyFromYmd(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isWeekday(dateKey) {
  const day = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

function buildWorkSlots({ year, month, fromDay, lastDay, minHourForFirstDay = WORKDAY_START_HOUR }) {
  const slots = [];
  for (let day = fromDay; day <= lastDay; day += 1) {
    const dateKey = dateKeyFromYmd(year, month, day);
    if (!isWeekday(dateKey)) continue;
    const startHour = day === fromDay
      ? Math.max(WORKDAY_START_HOUR, minHourForFirstDay)
      : WORKDAY_START_HOUR;
    for (let hour = startHour; hour < WORKDAY_END_HOUR; hour += 1) {
      const startMinutes = hour * 60;
      const endMinutes = Math.min(WORKDAY_END_HOUR * 60, startMinutes + EVENT_DURATION_MINUTES);
      const endHour = Math.floor(endMinutes / 60);
      const endMinute = endMinutes % 60;
      slots.push({
        dateKey,
        startDateTime: `${dateKey}T${String(hour).padStart(2, "0")}:00:00`,
        endDateTime: `${dateKey}T${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}:00`,
      });
    }
  }
  return slots;
}

async function ensureSchema() {
  await db.query(`
    ALTER TABLE public.scheduled_visits
      ADD COLUMN IF NOT EXISTS recovery_calendar_event_id TEXT,
      ADD COLUMN IF NOT EXISTS recovery_calendar_event_link TEXT,
      ADD COLUMN IF NOT EXISTS recovery_calendar_event_calendar_id TEXT,
      ADD COLUMN IF NOT EXISTS recovery_calendar_scheduled_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS recovery_calendar_status TEXT
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_visits_recovery_calendar
      ON public.scheduled_visits (schedule_id, recovery_calendar_status)
  `);
}

async function listApprovedSchedulesForMonth({ year, month }) {
  const { rows } = await db.query(
    `
      SELECT
        vs.id,
        vs.user_email,
        vs.month,
        vs.year,
        u.id AS user_id,
        COALESCE(u.fullname, u.name, vs.user_email) AS user_name
      FROM public.visit_schedules vs
      LEFT JOIN public.users u
        ON LOWER(COALESCE(u.email, '')) = LOWER(COALESCE(vs.user_email, ''))
      WHERE vs.status = 'approved'
        AND vs.month = $1
        AND vs.year = $2
        AND vs.user_email IS NOT NULL
      ORDER BY vs.user_email ASC, vs.id ASC
    `,
    [month, year],
  );
  return rows;
}

async function listPendingClientVisits(schedule) {
  const { startDate, endDateExclusive } = getMonthBounds({
    year: Number(schedule.year),
    month: Number(schedule.month),
  });
  const { rows } = await db.query(
    `
      SELECT
        sv.id,
        sv.schedule_id,
        sv.client_request_id,
        sv.planned_date,
        sv.city,
        sv.priority,
        sv.notes,
        sv.recovery_calendar_event_id,
        sv.recovery_calendar_status,
        cr.commercial_name AS client_name
      FROM public.scheduled_visits sv
      JOIN public.client_requests cr
        ON cr.id = sv.client_request_id
      WHERE sv.schedule_id = $1
        AND sv.client_request_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.client_visit_logs vl
          WHERE vl.client_request_id = sv.client_request_id
            AND LOWER(COALESCE(vl.user_email, '')) = LOWER($2)
            AND vl.status = 'visited'
            AND vl.visit_date >= $3::date
            AND vl.visit_date < $4::date
        )
      ORDER BY sv.planned_date ASC, sv.priority DESC, sv.id ASC
    `,
    [schedule.id, schedule.user_email, startDate, endDateExclusive],
  );
  return rows;
}

function buildPendingSummary(visits) {
  const names = visits
    .slice(0, 8)
    .map((visit) => visit.client_name || `Cliente #${visit.client_request_id}`)
    .join(", ");
  const extra = visits.length > 8 ? ` y ${visits.length - 8} mas` : "";
  return `${names}${extra}`;
}

async function sendMidMonthReminder({ schedule, pendingVisits, localDateKey }) {
  if (!schedule.user_id || !pendingVisits.length) return false;
  const processKey = `schedule:${schedule.id}:mid-month:${schedule.year}-${String(schedule.month).padStart(2, "0")}`;
  const exists = await db.query(
    `
      SELECT 1
      FROM public.notifications
      WHERE user_id = $1
        AND source = 'schedules.mid_month_pending_visits'
        AND meta->>'process_key' = $2
      LIMIT 1
    `,
    [schedule.user_id, processKey],
  );
  if (exists.rows.length) return false;

  await notificationManager.sendNotification({
    userId: schedule.user_id,
    template: "maintenance_due",
    source: "schedules.mid_month_pending_visits",
    customTitle: "Clientes pendientes de visitar",
    customMessage:
      `Tienes ${pendingVisits.length} cliente${pendingVisits.length === 1 ? "" : "s"} pendiente${pendingVisits.length === 1 ? "" : "s"} ` +
      `en tu cronograma ${String(schedule.month).padStart(2, "0")}/${schedule.year}: ${buildPendingSummary(pendingVisits)}.`,
    type: "alert",
    priority: 1,
    email: true,
    meta: {
      process_key: processKey,
      schedule_id: String(schedule.id),
      reminder_date: localDateKey,
      pending_count: pendingVisits.length,
      target_url: "/dashboard/comercial/planificacion",
    },
    data: {
      equipment_name: "Cronograma comercial",
      schedule_id: schedule.id,
      pending_count: pendingVisits.length,
    },
  });
  return true;
}

async function createRecoveryCalendarEvent({ schedule, visit, slot }) {
  const clientName = visit.client_name || `Cliente #${visit.client_request_id}`;
  const summary = `Visita pendiente - ${clientName}`;
  const description = [
    "Evento generado automaticamente por FamSPI para completar visitas pendientes del cronograma comercial.",
    `Asesor: ${schedule.user_email}`,
    `Cronograma: ${String(schedule.month).padStart(2, "0")}/${schedule.year}`,
    `Cliente: ${clientName}`,
    visit.city ? `Ciudad: ${visit.city}` : null,
    visit.planned_date ? `Fecha original planificada: ${String(visit.planned_date).slice(0, 10)}` : null,
    visit.notes ? `Notas: ${visit.notes}` : null,
    `Schedule ID: ${schedule.id}`,
    `Scheduled Visit ID: ${visit.id}`,
  ].filter(Boolean).join("\n");

  const event = await createTimeOffEvent({
    userEmail: schedule.user_email,
    summary,
    description,
    startDateTime: slot.startDateTime,
    endDateTime: slot.endDateTime,
    timezone: TIMEZONE,
    reminderMinutesBefore: 60,
  });

  await db.query(
    `
      UPDATE public.scheduled_visits
      SET recovery_calendar_event_id = $2,
          recovery_calendar_event_link = $3,
          recovery_calendar_event_calendar_id = $4,
          recovery_calendar_scheduled_at = $5::timestamptz,
          recovery_calendar_status = 'scheduled',
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      visit.id,
      event?.id || null,
      event?.htmlLink || null,
      event?.calendarId || null,
      `${slot.startDateTime}${TIMEZONE === "America/Guayaquil" ? "-05:00" : ""}`,
    ],
  );

  return event;
}

async function notifyLastWeekCalendarAgenda({ schedule, scheduledCount, skippedCount, localDateKey }) {
  if (!schedule.user_id || scheduledCount <= 0) return false;
  const processKey = `schedule:${schedule.id}:last-week-calendar:${localDateKey}`;
  const exists = await db.query(
    `
      SELECT 1
      FROM public.notifications
      WHERE user_id = $1
        AND source = 'schedules.last_week_recovery_calendar'
        AND meta->>'process_key' = $2
      LIMIT 1
    `,
    [schedule.user_id, processKey],
  );
  if (exists.rows.length) return false;

  await notificationManager.sendNotification({
    userId: schedule.user_id,
    template: "maintenance_due",
    source: "schedules.last_week_recovery_calendar",
    customTitle: "Visitas pendientes agendadas",
    customMessage:
      `Se agendaron ${scheduledCount} visita${scheduledCount === 1 ? "" : "s"} pendiente${scheduledCount === 1 ? "" : "s"} ` +
      `en tu calendario laboral. ${skippedCount > 0 ? `${skippedCount} visita${skippedCount === 1 ? "" : "s"} no tuvieron espacio disponible.` : ""}`,
    type: "task",
    priority: 1,
    email: true,
    meta: {
      process_key: processKey,
      schedule_id: String(schedule.id),
      reminder_date: localDateKey,
      scheduled_count: scheduledCount,
      skipped_count: skippedCount,
      target_url: "/dashboard/comercial/planificacion",
    },
    data: {
      equipment_name: "Cronograma comercial",
      schedule_id: schedule.id,
      scheduled_count: scheduledCount,
      skipped_count: skippedCount,
    },
  });
  return true;
}

async function runOnce(now = new Date()) {
  await ensureSchema();

  const parts = getLocalParts(now);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const localDateKey = toLocalDateKey(now);
  const { lastDay } = getMonthBounds({ year, month });
  const isMidMonthWindow = day >= MID_MONTH_DAY;
  const isLastWeekWindow = day >= Math.max(1, lastDay - LAST_WEEK_WINDOW_DAYS + 1);
  const schedules = await listApprovedSchedulesForMonth({ year, month });
  const result = {
    date: localDateKey,
    schedules: schedules.length,
    mid_month_reminders: 0,
    calendar_events_created: 0,
    calendar_events_skipped_no_slot: 0,
    calendar_failures: 0,
  };

  for (const schedule of schedules) {
    const pendingVisits = await listPendingClientVisits(schedule);
    if (!pendingVisits.length) continue;

    if (isMidMonthWindow) {
      const sent = await sendMidMonthReminder({ schedule, pendingVisits, localDateKey });
      if (sent) result.mid_month_reminders += 1;
    }

    if (!isLastWeekWindow) continue;

    const unscheduled = pendingVisits.filter((visit) => !visit.recovery_calendar_event_id);
    if (!unscheduled.length) continue;

    const slots = buildWorkSlots({
      year,
      month,
      fromDay: day,
      lastDay,
      minHourForFirstDay: Math.min(
        WORKDAY_END_HOUR,
        Math.max(WORKDAY_START_HOUR, Number(parts.hour || 0) + 1),
      ),
    });

    let slotIndex = 0;
    let created = 0;
    let failed = 0;
    let skipped = 0;

    for (const visit of unscheduled) {
      const slot = slots[slotIndex];
      if (!slot) {
        skipped += 1;
        await db.query(
          `
            UPDATE public.scheduled_visits
            SET recovery_calendar_status = 'no_business_slot',
                updated_at = NOW()
            WHERE id = $1
          `,
          [visit.id],
        );
        continue;
      }
      slotIndex += 1;
      try {
        await createRecoveryCalendarEvent({ schedule, visit, slot });
        created += 1;
      } catch (error) {
        failed += 1;
        logger.warn(
          { error: error?.message, schedule_id: schedule.id, visit_id: visit.id },
          "[SCHEDULES][COMPLETION_REMINDER] No se pudo crear evento de recuperacion",
        );
        await db.query(
          `
            UPDATE public.scheduled_visits
            SET recovery_calendar_status = 'calendar_error',
                updated_at = NOW()
            WHERE id = $1
          `,
          [visit.id],
        );
      }
    }

    result.calendar_events_created += created;
    result.calendar_events_skipped_no_slot += skipped;
    result.calendar_failures += failed;
    await notifyLastWeekCalendarAgenda({
      schedule,
      scheduledCount: created,
      skippedCount: skipped,
      localDateKey,
    });
  }

  logger.info(result, "[SCHEDULES][COMPLETION_REMINDER] Revision finalizada");
  return result;
}

let cronTask = null;
function startScheduleVisitCompletionReminderJob() {
  if (cronTask) return cronTask;
  const cronExpression = process.env.SCHEDULE_VISIT_COMPLETION_CRON || "0 9 * * *";
  cronTask = cron.schedule(cronExpression, () => {
    runOnce().catch((error) => {
      logger.error(
        { error: error?.message },
        "[SCHEDULES][COMPLETION_REMINDER] Error en ejecucion programada",
      );
    });
  }, { timezone: TIMEZONE });
  logger.info(
    { cronExpression, timezone: TIMEZONE },
    "[SCHEDULES][COMPLETION_REMINDER] Scheduler iniciado",
  );
  return cronTask;
}

module.exports = {
  runOnce,
  startScheduleVisitCompletionReminderJob,
};
