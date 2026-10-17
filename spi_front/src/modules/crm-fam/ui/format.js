// Formato único del CRM (DESIGN.md §11): Intl con locale del producto.
const LOCALE = "es-EC";

const moneyFmt = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const moneyFmtCents = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const numberFmt = new Intl.NumberFormat(LOCALE);
const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" });
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });

const toDate = (value) => {
  if (!value) return null;
  // Las fechas "YYYY-MM-DD" se interpretan en hora local, no en UTC (evita el día anterior).
  const d = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const money = (value, { cents = false } = {}) =>
  value === null || value === undefined || value === "" ? "—" : (cents ? moneyFmtCents : moneyFmt).format(Number(value) || 0);
export const number = (value) => numberFmt.format(Number(value) || 0);
export const date = (value) => { const d = toDate(value); return d ? dateFmt.format(d) : "—"; };
export const longDay = (value = new Date()) => dayFmt.format(toDate(value) || new Date());
export const time = (value) => { const d = toDate(value); return d ? timeFmt.format(d) : ""; };

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Días desde hoy hasta la fecha: negativo = pasado, 0 = hoy.
export const daysFromToday = (value) => {
  const d = toDate(value);
  if (!d) return null;
  return Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
};

// "hoy", "mañana", "hace 3 días", "en 5 días" — para vencimientos.
export const relativeDay = (value) => {
  const n = daysFromToday(value);
  if (n === null) return "";
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  if (n === -1) return "ayer";
  return n < 0 ? `hace ${-n} días` : `en ${n} días`;
};

export const initials = (name) =>
  String(name || "").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "?";

export const errorMessage = (err, fallback = "No se pudo completar la acción. Inténtalo de nuevo.") =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
