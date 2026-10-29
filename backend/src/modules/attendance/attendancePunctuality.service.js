const db = require("../../config/db");

const PUNCTUALITY_BASE_MINUTES = 9 * 60;
const PUNCTUALITY_EARLY_WINDOW_MINUTES = 10;
const PUNCTUALITY_TOLERANCE_MINUTES = 6;
const PUNCTUALITY_MAX_LUNCH_MINUTES = 60;
const PUNCTUALITY_TIMEZONE = process.env.APP_TIMEZONE || process.env.TZ || "America/Guayaquil";
const PUNCTUALITY_POINTS = Object.freeze({
  early_on_time: 4,
  on_time: 3,
  slight_late: 1,
  late: 0,
  no_entry: 0,
});
const EXCLUDED_PUNCTUALITY_EMAILS = new Set([
  "administrador@fam-project.com",
]);

const getEcuadorClockParts = (dateValue = new Date()) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PUNCTUALITY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);

  const map = parts.reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    dateKey: `${map.year}-${map.month}-${map.day}`,
  };
};

const getMonthBounds = (parts) => {
  const monthStart = `${parts.year}-${String(parts.month).padStart(2, "0")}-01`;
  const nextMonthDate = new Date(Date.UTC(parts.year, parts.month, 1));
  const nextMonthYear = nextMonthDate.getUTCFullYear();
  const nextMonth = String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0");
  const monthEndExclusive = `${nextMonthYear}-${nextMonth}-01`;
  return { monthStart, monthEndExclusive };
};

const resolveAvatarUrl = (avatarUrl, avatarDriveId) => {
  if (avatarUrl && String(avatarUrl).startsWith("data:")) return avatarUrl;
  if (avatarDriveId) return `https://drive.google.com/thumbnail?id=${avatarDriveId}&sz=w300`;
  return avatarUrl || null;
};

const shouldExcludeFromPunctualityRanking = (email) =>
  EXCLUDED_PUNCTUALITY_EMAILS.has(String(email || "").trim().toLowerCase());

const buildEntryMetrics = (entryTime) => {
  const parts = getEcuadorClockParts(entryTime);
  if (!parts) {
    return { state: "no_entry", points: 0, entryMinutes: Number.POSITIVE_INFINITY, isPunctual: false, isEarlyBonus: false };
  }

  const entryMinutes = (parts.hour * 60) + parts.minute;
  const delta = entryMinutes - PUNCTUALITY_BASE_MINUTES;
  if (delta < 0 && delta >= -PUNCTUALITY_EARLY_WINDOW_MINUTES) {
    return {
      state: "early_on_time",
      points: PUNCTUALITY_POINTS.early_on_time,
      entryMinutes,
      isPunctual: true,
      isEarlyBonus: true,
    };
  }
  if (delta <= PUNCTUALITY_TOLERANCE_MINUTES) {
    return { state: "on_time", points: PUNCTUALITY_POINTS.on_time, entryMinutes, isPunctual: true, isEarlyBonus: false };
  }
  if (delta <= 15) {
    return { state: "slight_late", points: PUNCTUALITY_POINTS.slight_late, entryMinutes, isPunctual: false, isEarlyBonus: false };
  }
  return { state: "late", points: PUNCTUALITY_POINTS.late, entryMinutes, isPunctual: false, isEarlyBonus: false };
};

const buildLunchMetrics = (lunchStartTime, lunchEndTime) => {
  if (!lunchStartTime || !lunchEndTime) {
    return { durationMinutes: null, withinLimit: false, bonusPoints: 0 };
  }
  const start = new Date(lunchStartTime);
  const end = new Date(lunchEndTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() < start.getTime()) {
    return { durationMinutes: null, withinLimit: false, bonusPoints: 0 };
  }
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  return {
    durationMinutes,
    withinLimit: durationMinutes <= PUNCTUALITY_MAX_LUNCH_MINUTES,
    bonusPoints: durationMinutes <= PUNCTUALITY_MAX_LUNCH_MINUTES ? 1 : 0,
  };
};

const computeStreaks = (rows = []) => {
  const descRows = [...rows].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  let currentStreak = 0;
  for (const row of descRows) {
    if (row.isCompliantDay) {
      currentStreak += 1;
      continue;
    }
    break;
  }

  const ascRows = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let run = 0;
  let bestStreak = 0;
  for (const row of ascRows) {
    if (row.isCompliantDay) {
      run += 1;
      if (run > bestStreak) bestStreak = run;
    } else {
      run = 0;
    }
  }

  return { currentStreak, bestStreak };
};

async function getMonthlyPunctualitySummary(currentUserId) {
  const nowParts = getEcuadorClockParts(new Date());
  if (!nowParts) {
    return {
      month: null,
      ranking: [],
      currentUser: {
        userId: Number(currentUserId) || null,
        position: null,
        totalParticipants: 0,
        isWinner: false,
        attendanceDays: 0,
        onTimeDays: 0,
        earlyArrivalDays: 0,
        slightLateDays: 0,
        lateDays: 0,
        lunchCompliantDays: 0,
        compliantDays: 0,
        pointsTotal: 0,
        averageEntryMinutes: null,
        currentStreak: 0,
        bestStreak: 0,
      },
    };
  }

  const { monthStart, monthEndExclusive } = getMonthBounds(nowParts);
  const { rows } = await db.query(
    `
      SELECT
        u.id AS user_id,
        COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email) AS display_name,
        u.email,
        u.role,
        up.avatar_url,
        up.avatar_drive_id,
        a.date,
        a.entry_time,
        a.lunch_start_time,
        a.lunch_end_time,
        a.total_hours
      FROM public.user_attendance_records a
      INNER JOIN public.users u
        ON u.id = a.user_id
      LEFT JOIN public.user_profile up
        ON up.user_id = u.id
      WHERE a.date >= $1::date
        AND a.date < $2::date
        AND EXTRACT(ISODOW FROM a.date) BETWEEN 1 AND 5
        AND a.entry_time IS NOT NULL
        AND a.exit_time IS NOT NULL
        AND COALESCE(u.active, true) = true
      ORDER BY a.user_id ASC, a.date DESC, a.entry_time DESC
    `,
    [monthStart, monthEndExclusive],
  );

  const grouped = new Map();
  for (const row of rows) {
    const userId = Number(row.user_id);
    if (shouldExcludeFromPunctualityRanking(row.email)) {
      continue;
    }
    if (!grouped.has(userId)) {
      grouped.set(userId, {
        userId,
        displayName: row.display_name || row.email || `Usuario ${userId}`,
        email: row.email || null,
        role: row.role || null,
        avatarUrl: resolveAvatarUrl(row.avatar_url, row.avatar_drive_id),
        rows: [],
      });
    }
    const bucket = grouped.get(userId);
    const punctuality = buildEntryMetrics(row.entry_time);
    const lunch = buildLunchMetrics(row.lunch_start_time, row.lunch_end_time);
    bucket.rows.push({
      date: row.date,
      entryTime: row.entry_time,
      lunchStartTime: row.lunch_start_time,
      lunchEndTime: row.lunch_end_time,
      totalHours: Number(row.total_hours || 0),
      punctuality,
      lunch,
      isCompliantDay: Boolean(punctuality.isPunctual && lunch.withinLimit),
    });
  }

  const ranking = [...grouped.values()].map((entry) => {
    const attendanceDays = entry.rows.length;
    const onTimeDays = entry.rows.filter((row) => row.punctuality.isPunctual).length;
    const earlyArrivalDays = entry.rows.filter((row) => row.punctuality.isEarlyBonus).length;
    const slightLateDays = entry.rows.filter((row) => row.punctuality.state === "slight_late").length;
    const lateDays = entry.rows.filter((row) => row.punctuality.state === "late").length;
    const lunchCompliantDays = entry.rows.filter((row) => row.lunch.withinLimit).length;
    const compliantDays = entry.rows.filter((row) => row.isCompliantDay).length;
    const pointsTotal = entry.rows.reduce((sum, row) => (
      sum + Number(row.punctuality.points || 0) + Number(row.lunch.bonusPoints || 0)
    ), 0);
    const averageEntryMinutes = attendanceDays
      ? Math.round(entry.rows.reduce((sum, row) => sum + Number(row.punctuality.entryMinutes || 0), 0) / attendanceDays)
      : null;
    const { currentStreak, bestStreak } = computeStreaks(entry.rows);

    return {
      userId: entry.userId,
      displayName: entry.displayName,
      email: entry.email,
      role: entry.role,
      avatarUrl: entry.avatarUrl,
      attendanceDays,
      onTimeDays,
      earlyArrivalDays,
      slightLateDays,
      lateDays,
      lunchCompliantDays,
      compliantDays,
      pointsTotal,
      averageEntryMinutes,
      currentStreak,
      bestStreak,
    };
  }).sort((a, b) => (
    b.compliantDays - a.compliantDays
    || b.currentStreak - a.currentStreak
    || b.bestStreak - a.bestStreak
    || b.onTimeDays - a.onTimeDays
    || b.lunchCompliantDays - a.lunchCompliantDays
    || b.earlyArrivalDays - a.earlyArrivalDays
    || b.pointsTotal - a.pointsTotal
    || a.lateDays - b.lateDays
    || a.slightLateDays - b.slightLateDays
    || (a.averageEntryMinutes ?? Number.POSITIVE_INFINITY) - (b.averageEntryMinutes ?? Number.POSITIVE_INFINITY)
    || b.attendanceDays - a.attendanceDays
    || String(a.displayName || "").localeCompare(String(b.displayName || ""))
  )).map((entry, index, arr) => ({
    ...entry,
    position: index + 1,
    totalParticipants: arr.length,
    isWinner: index === 0,
  }));

  const currentUser = ranking.find((entry) => entry.userId === Number(currentUserId)) || {
    userId: Number(currentUserId) || null,
    displayName: null,
    email: null,
    role: null,
    avatarUrl: null,
    attendanceDays: 0,
    onTimeDays: 0,
    earlyArrivalDays: 0,
    slightLateDays: 0,
    lateDays: 0,
    lunchCompliantDays: 0,
    compliantDays: 0,
    pointsTotal: 0,
    averageEntryMinutes: null,
    currentStreak: 0,
    bestStreak: 0,
    position: null,
    totalParticipants: ranking.length,
    isWinner: false,
  };

  return {
    month: {
      year: nowParts.year,
      month: nowParts.month,
      startDate: monthStart,
      endDateExclusive: monthEndExclusive,
    },
    ranking: ranking.slice(0, 5),
    currentUser,
  };
}

module.exports = {
  getMonthlyPunctualitySummary,
};
