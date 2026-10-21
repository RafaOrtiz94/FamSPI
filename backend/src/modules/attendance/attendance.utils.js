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

/**
 * Upserts the formal daily attendance entry for the acta RH-09.
 *
 * @param {object} opts
 * @param {number}    opts.userId
 * @param {string|null} opts.location        - GeoJSON/text location string
 * @param {Date}      opts.timestamp         - Real time the event occurred (used for real_entry_time)
 * @param {Date|null} opts.officialEntryTime - Official time to write into entry_time (acta).
 *                                             When null, falls back to timestamp.
 * @param {string}    opts.entrySource       - 'manual' | 'field_op' | 'unexpected' | 'operational'
 */
const ensureDailyClockIn = async ({
  userId,
  location = null,
  timestamp = new Date(),
  officialEntryTime = null,
  entrySource = "manual",
}) => {
  const today = getBusinessDate(timestamp);
  const formalTime = officialEntryTime || timestamp;
  const realTime = timestamp;

  const existing = await db.query(
    `SELECT id, entry_time, entry_location FROM user_attendance_records WHERE user_id = $1 AND date = $2 LIMIT 1`,
    [userId, today]
  );

  if (existing.rows[0]?.entry_time) {
    return { ok: true, created: false, data: existing.rows[0], date: today };
  }

  let result;
  try {
    result = await db.query(
      `
      INSERT INTO user_attendance_records (user_id, date, entry_time, entry_location, real_entry_time, entry_source)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        entry_time        = COALESCE(user_attendance_records.entry_time, EXCLUDED.entry_time),
        entry_location    = COALESCE(user_attendance_records.entry_location, EXCLUDED.entry_location),
        real_entry_time   = COALESCE(user_attendance_records.real_entry_time, EXCLUDED.real_entry_time),
        entry_source      = COALESCE(user_attendance_records.entry_source, EXCLUDED.entry_source),
        updated_at        = NOW()
      RETURNING *;
      `,
      [userId, today, formalTime, location, realTime, entrySource]
    );
  } catch (err) {
    // Backward-compatible fallback for production schemas without real_entry_time/entry_source
    // or without the expected unique constraint for ON CONFLICT.
    if (err?.code === "42703" || err?.code === "42P10") {
      result = await db.query(
        `
        INSERT INTO user_attendance_records (user_id, date, entry_time, entry_location)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, date)
        DO UPDATE SET
          entry_time     = COALESCE(user_attendance_records.entry_time, EXCLUDED.entry_time),
          entry_location = COALESCE(user_attendance_records.entry_location, EXCLUDED.entry_location),
          updated_at     = NOW()
        RETURNING *;
        `,
        [userId, today, formalTime, location]
      );
    } else {
      throw err;
    }
  }

  return { ok: true, created: true, data: result.rows[0], date: today };
};

module.exports = {
  ATTENDANCE_TIMEZONE,
  getBusinessDate,
  ensureDailyClockIn,
};
