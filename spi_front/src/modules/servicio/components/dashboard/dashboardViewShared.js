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

// Tono ServicioBadge por categoria del feed unificado de cronograma
// (technicalSchedule.service.js SOURCE_CONFIG). "withdrawal"/"corrective" se
// sumaron junto con la extension del feed (Fase F) -- antes ni siquiera
// llegaban filas de esas categorias al dashboard.
export const scheduleCategoryTone = (category) => {
  if (category === "inspection") return "info";
  if (category === "maintenance") return "warning";
  if (category === "training") return "success";
  if (category === "withdrawal") return "accent";
  if (category === "corrective") return "danger";
  return "neutral";
};

// Tono ServicioBadge por urgencia de un item de la cola de acciones
// (backend/src/modules/servicio/actionQueue.service.js). "urgent" es SLA
// vencido o backlog viejo, "today" es algo con fecha exacta hoy, el resto
// es "normal" -- no hay una cuarta categoria.
export const actionQueueUrgencyTone = (urgency) => {
  if (urgency === "urgent") return "danger";
  if (urgency === "today") return "warning";
  return "neutral";
};

export const actionQueueUrgencyLabel = (urgency) => {
  if (urgency === "urgent") return "Urgente";
  if (urgency === "today") return "Hoy";
  return "Normal";
};

// Tipo del item de la cola -> misma paleta semantica que scheduleCategoryTone
// para que un correctivo se vea igual de "correctivo" en Inicio y en el
// cronograma, aunque vengan de servicios distintos.
export const actionQueueTypeTone = (type) => {
  if (type === "approval") return "info";
  if (type === "withdrawal") return "accent";
  if (type === "corrective") return "danger";
  if (type === "preventive_offer") return "warning";
  if (type === "external_case") return "neutral";
  return "neutral";
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
