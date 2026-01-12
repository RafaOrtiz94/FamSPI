const { calendar } = require("../config/google");
const logger = require("../config/logger");

const DEFAULT_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const DEFAULT_TIMEZONE = process.env.GOOGLE_CALENDAR_TZ || "America/Guayaquil";

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

module.exports = {
  createAllDayEvent,
};
