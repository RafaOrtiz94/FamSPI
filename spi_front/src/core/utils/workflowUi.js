const toIsoDate = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const normalizeDateOnly = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const esMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (esMatch) {
    const [, dd, mm, yyyy] = esMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return toIsoDate(parsed);
};

export const formatDateOnlyEs = (value, fallback = "Pendiente") => {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return fallback;
  const [yyyy, mm, dd] = normalized.split("-");
  return `${dd}/${mm}/${yyyy}`;
};

export const formatDateTimeEs = (value, fallback = "Pendiente") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString("es-EC", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const toStatusLabel = (value, fallback = "N/D") => {
  const normalized = String(value || "").trim();
  if (!normalized) return fallback;
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const STATUS_TONE_CLASSES = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-rose-100 text-rose-700",
  info: "bg-blue-100 text-blue-700",
  neutral: "bg-slate-100 text-slate-700",
};

export const getStatusBadgeClass = (
  status,
  {
    success = [],
    warning = [],
    error = [],
    info = [],
  } = {},
) => {
  const normalized = String(status || "").trim().toLowerCase();

  if (!normalized) return STATUS_TONE_CLASSES.neutral;
  if (success.includes(normalized)) return STATUS_TONE_CLASSES.success;
  if (warning.includes(normalized)) return STATUS_TONE_CLASSES.warning;
  if (error.includes(normalized)) return STATUS_TONE_CLASSES.error;
  if (info.includes(normalized)) return STATUS_TONE_CLASSES.info;

  if (normalized.includes("error") || normalized.includes("blocked") || normalized.includes("rejected")) {
    return STATUS_TONE_CLASSES.error;
  }
  if (
    normalized.includes("pending") ||
    normalized.includes("progress") ||
    normalized.includes("dispatch") ||
    normalized.includes("review")
  ) {
    return STATUS_TONE_CLASSES.warning;
  }
  if (
    normalized.includes("done") ||
    normalized.includes("completed") ||
    normalized.includes("finalized") ||
    normalized.includes("closed") ||
    normalized.includes("approved")
  ) {
    return STATUS_TONE_CLASSES.success;
  }

  return STATUS_TONE_CLASSES.neutral;
};

export const formatDurationMinutes = (minutes, fallback = "-") => {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return fallback;
  if (value < 60) return `${Math.round(value)} min`;
  const hours = Math.floor(value / 60);
  const mins = Math.round(value % 60);
  return `${hours}h ${mins}m`;
};
