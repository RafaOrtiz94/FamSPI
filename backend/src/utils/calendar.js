const { google } = require("googleapis");
const { calendar, createDelegatedJwtClient } = require("../config/google");
const { resolveDelegatedUser } = require("./googleCredentials");
const logger = require("../config/logger");

const DEFAULT_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const DEFAULT_TIMEZONE = process.env.GOOGLE_CALENDAR_TZ || "America/Guayaquil";

function normalizeDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  const directMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch) return directMatch[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

async function createAllDayEvent({
  summary,
  description,
  date,
  reminderMinutesBefore = 1440,
  attendees = [],
}) {
  if (!date) throw new Error("Se requiere una fecha para crear el recordatorio en Calendar");
  const eventDate = new Date(date);
  const startDate = eventDate.toISOString().split("T")[0];
  const endDate = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const requestBody = {
    summary,
    description,
    start: { date: startDate, timeZone: DEFAULT_TIMEZONE },
    end: { date: endDate, timeZone: DEFAULT_TIMEZONE },
    reminders: {
      useDefault: false,
      overrides: reminderMinutesBefore
        ? [{ method: "email", minutes: reminderMinutesBefore }]
        : [],
    },
  };

  if (attendees?.length) {
    requestBody.attendees = attendees.map((email) => ({ email }));
  }

  try {
    const { data } = await calendar.events.insert({
      calendarId: DEFAULT_CALENDAR_ID,
      requestBody,
    });

    logger.info("📅 Evento creado en Calendar", { summary, date: startDate });
    return { id: data.id, htmlLink: data.htmlLink };
  } catch (error) {
    logger.error({ err: error }, "❌ Error creando evento en Calendar");
    throw error;
  }
}

async function createOrUpdateSharedAllDayEvent({
  eventId = null,
  summary,
  description,
  date,
  reminderMinutesBefore = 1440,
  attendees = [],
}) {
  if (!date) throw new Error("Se requiere una fecha para crear o actualizar el evento en Calendar");
  const eventDate = new Date(date);
  const startDate = eventDate.toISOString().split("T")[0];
  const endDate = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const requestBody = {
    summary,
    description,
    start: { date: startDate, timeZone: DEFAULT_TIMEZONE },
    end: { date: endDate, timeZone: DEFAULT_TIMEZONE },
    reminders: {
      useDefault: false,
      overrides: reminderMinutesBefore
        ? [{ method: "email", minutes: reminderMinutesBefore }]
        : [],
    },
  };

  if (attendees?.length) {
    requestBody.attendees = attendees.map((email) => ({ email }));
  }

  try {
    let data;
    if (eventId) {
      try {
        ({ data } = await calendar.events.update({
          calendarId: DEFAULT_CALENDAR_ID,
          eventId,
          requestBody,
          sendUpdates: "all",
        }));
        logger.info({ eventId, summary, date: startDate }, "[CALENDAR] Evento all-day actualizado");
      } catch (updateError) {
        logger.warn(
          { err: updateError, eventId, summary },
          "[CALENDAR] No se pudo actualizar evento all-day existente. Se recreará.",
        );
        ({ data } = await calendar.events.insert({
          calendarId: DEFAULT_CALENDAR_ID,
          requestBody,
          sendUpdates: "all",
        }));
        logger.info({ eventId: data.id, summary, date: startDate }, "[CALENDAR] Evento all-day recreado");
      }
    } else {
      ({ data } = await calendar.events.insert({
        calendarId: DEFAULT_CALENDAR_ID,
        requestBody,
        sendUpdates: "all",
      }));
      logger.info({ eventId: data.id, summary, date: startDate }, "[CALENDAR] Evento all-day creado");
    }

    return {
      id: data.id,
      htmlLink: data.htmlLink,
      calendarId: DEFAULT_CALENDAR_ID,
    };
  } catch (error) {
    logger.error({ err: error, eventId, summary }, "Error creando o actualizando evento all-day en Calendar");
    throw error;
  }
}

function buildTimeOffEventPayload({
  summary,
  description,
  timezone = DEFAULT_TIMEZONE,
  startDate,
  endDate,
  startDateTime,
  endDateTime,
  reminderMinutesBefore = 60,
}) {
  const requestBody = {
    summary,
    description,
    reminders: {
      useDefault: false,
      overrides: reminderMinutesBefore
        ? [{ method: "email", minutes: reminderMinutesBefore }]
        : [],
    },
  };

  if (startDateTime && endDateTime) {
    requestBody.start = { dateTime: startDateTime, timeZone: timezone };
    requestBody.end = { dateTime: endDateTime, timeZone: timezone };
  } else if (startDate) {
    const normalizedStartDate = normalizeDateOnly(startDate);
    const normalizedEndDate = normalizeDateOnly(endDate || startDate);
    if (!normalizedStartDate || !normalizedEndDate) {
      throw new Error("No se pudo normalizar fecha de inicio/fin para evento all-day");
    }
    const endDateExclusive = new Date(`${normalizedEndDate}T00:00:00.000Z`);
    endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1);
    requestBody.start = { date: normalizedStartDate, timeZone: timezone };
    requestBody.end = { date: endDateExclusive.toISOString().slice(0, 10), timeZone: timezone };
  } else {
    throw new Error("Se requiere rango de fechas para crear evento de tiempo fuera");
  }

  return requestBody;
}

async function createEventInUserPrimaryCalendar({ userEmail, requestBody }) {
  const delegatedUser = resolveDelegatedUser(userEmail);
  if (!delegatedUser) {
    throw new Error("No se pudo resolver correo delegado para crear evento de calendario");
  }
  const delegatedAuth = createDelegatedJwtClient(delegatedUser);
  await delegatedAuth.authorize();
  const delegatedCalendar = google.calendar({ version: "v3", auth: delegatedAuth });
  const { data } = await delegatedCalendar.events.insert({
    calendarId: "primary",
    requestBody,
  });
  return { id: data.id, htmlLink: data.htmlLink, calendarId: "primary", delegatedUser };
}

async function createEventInConfiguredCalendar({ requestBody }) {
  const { data } = await calendar.events.insert({
    calendarId: DEFAULT_CALENDAR_ID,
    requestBody,
  });
  return { id: data.id, htmlLink: data.htmlLink, calendarId: DEFAULT_CALENDAR_ID, delegatedUser: null };
}

async function createTimeOffEvent({
  userEmail,
  summary,
  description,
  startDate,
  endDate,
  startDateTime,
  endDateTime,
  timezone = DEFAULT_TIMEZONE,
  reminderMinutesBefore = 60,
}) {
  const requestBody = buildTimeOffEventPayload({
    summary,
    description,
    timezone,
    startDate,
    endDate,
    startDateTime,
    endDateTime,
    reminderMinutesBefore,
  });

  try {
    const primaryResult = await createEventInUserPrimaryCalendar({ userEmail, requestBody });
    logger.info(
      {
        userEmail,
        calendarId: primaryResult.calendarId,
        eventId: primaryResult.id,
      },
      "[CALENDAR] Evento de tiempo fuera creado en calendario del usuario"
    );
    return {
      primaryEvent: primaryResult,
      sharedEvent: null,
      id: primaryResult.id,
      htmlLink: primaryResult.htmlLink,
      calendarId: primaryResult.calendarId,
      delegatedUser: primaryResult.delegatedUser,
    };
  } catch (primaryError) {
    logger.warn(
      { err: primaryError, userEmail },
      "[CALENDAR] No se pudo crear evento en calendario primario del usuario. Se usa fallback."
    );
  }

  const fallbackBody = {
    ...requestBody,
    attendees: userEmail ? [{ email: userEmail }] : undefined,
  };
  const fallbackResult = await createEventInConfiguredCalendar({ requestBody: fallbackBody });
  return {
    primaryEvent: null,
    sharedEvent: null,
    id: fallbackResult.id,
    htmlLink: fallbackResult.htmlLink,
    calendarId: fallbackResult.calendarId,
    delegatedUser: null,
  };
}

async function cancelTimeOffEvent({ eventId, calendarId, userEmail }) {
  if (!eventId) return;

  if (userEmail) {
    try {
      const delegatedUser = resolveDelegatedUser(userEmail);
      if (delegatedUser) {
        const delegatedAuth = createDelegatedJwtClient(delegatedUser);
        await delegatedAuth.authorize();
        const delegatedCalendar = google.calendar({ version: "v3", auth: delegatedAuth });
        await delegatedCalendar.events.delete({
          calendarId: "primary",
          eventId,
          sendUpdates: "all",
        });
        logger.info({ eventId, userEmail }, "[CALENDAR] Evento de tiempo fuera eliminado del calendario del usuario");
        return;
      }
    } catch (primaryError) {
      logger.warn(
        { err: primaryError, eventId, userEmail },
        "[CALENDAR] No se pudo eliminar del calendario primario; intentando calendario compartido"
      );
    }
  }

  await calendar.events.delete({
    calendarId: calendarId || DEFAULT_CALENDAR_ID,
    eventId,
    sendUpdates: "all",
  });
  logger.info({ eventId, calendarId }, "[CALENDAR] Evento de tiempo fuera eliminado del calendario compartido");
}

module.exports = {
  createAllDayEvent,
  createOrUpdateSharedAllDayEvent,
  createTimeOffEvent,
  cancelTimeOffEvent,
};
