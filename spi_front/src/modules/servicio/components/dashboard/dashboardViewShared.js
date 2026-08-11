export const availabilityLabel = (status) => {
  const value = String(status || "").toLowerCase();
  if (["disponible", "available", "on"].includes(value)) return "Disponible";
  if (["ocupado", "busy"].includes(value)) return "Ocupado";
  return "No disponible";
};

export const availabilityColor = (status) => {
  const value = String(status || "").toLowerCase();
  if (["disponible", "available", "on"].includes(value)) {
    return "border-green-200 bg-[#DCFCE7] text-[#16A34A]";
  }
  if (["ocupado", "busy"].includes(value)) {
    return "border-amber-200 bg-[#FEF3C7] text-[#D97706]";
  }
  return "border-red-200 bg-[#FEE2E2] text-[#DC2626]";
};

export const parseDashboardPayload = (payload) => {
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  return payload;
};

export const scheduleBadgeClass = (category) => {
  if (category === "inspection") return "border-blue-200 bg-blue-50 text-blue-700";
  if (category === "maintenance") return "border-amber-200 bg-amber-50 text-amber-700";
  if (category === "training") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
};

export const formatTechnicalDateLabel = (value) => {
  const safeValue = String(value || "").slice(0, 10);
  if (!safeValue) return "Sin fecha";
  try {
    return new Date(`${safeValue}T00:00:00`).toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return safeValue;
  }
};
