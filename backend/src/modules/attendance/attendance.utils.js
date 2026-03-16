const db = require("../../config/db");

const ATTENDANCE_TIMEZONE =
  process.env.APP_TIMEZONE || process.env.TZ || "America/Guayaquil";

const getBusinessDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: ATTENDANCE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const ensureDailyClockIn = async ({ userId, location = null, timestamp = new Date() }) => {
  const today = getBusinessDate(timestamp);

  const existing = await db.query(
    `
    SELECT id, entry_time
    FROM user_attendance_records
    WHERE user_id = $1 AND date = $2
    LIMIT 1
    `,
    [userId, today]
  );

  if (existing.rows[0]?.entry_time) {
    return {
      ok: true,
      created: false,
      data: existing.rows[0],
      date: today,
    };
  }

  const result = await db.query(
    `
    INSERT INTO user_attendance_records (user_id, date, entry_time, entry_location)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      entry_time = COALESCE(user_attendance_records.entry_time, EXCLUDED.entry_time),
      entry_location = COALESCE(user_attendance_records.entry_location, EXCLUDED.entry_location),
      updated_at = NOW()
    RETURNING *;
    `,
    [userId, today, timestamp, location]
  );

  return {
    ok: true,
    created: true,
    data: result.rows[0],
    date: today,
  };
};

module.exports = {
  ATTENDANCE_TIMEZONE,
  getBusinessDate,
  ensureDailyClockIn,
};
