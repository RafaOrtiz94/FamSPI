const toYmd = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getToday = (baseDate = new Date()) => toYmd(baseDate);

const getThisWeek = (baseDate = new Date()) => {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  return toYmd(date);
};

const getThisMonth = (baseDate = new Date()) => {
  const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  return toYmd(date);
};

const getThisYear = (baseDate = new Date()) => {
  const date = new Date(baseDate.getFullYear(), 0, 1);
  return toYmd(date);
};

const normalizeQuickRange = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "today" || normalized === "hoy") return "today";
  if (normalized === "thisweek" || normalized === "week" || normalized === "esta semana") return "thisWeek";
  if (normalized === "thismonth" || normalized === "month" || normalized === "este mes") return "thisMonth";
  if (normalized === "thisyear" || normalized === "year" || normalized === "este año" || normalized === "este ano") {
    return "thisYear";
  }
  return "";
};

const attendanceDateRanges = {
  today: getToday,
  thisWeek: getThisWeek,
  thisMonth: getThisMonth,
  thisYear: getThisYear,
};

module.exports = {
  attendanceDateRanges,
  getThisMonth,
  getThisWeek,
  getThisYear,
  getToday,
  normalizeQuickRange,
  toYmd,
};
