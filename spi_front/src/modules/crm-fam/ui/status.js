// Vocabulario único de estados del CRM: etiqueta en español + tono semántico (DESIGN.md §8).
// Antes cada pantalla tenía su propio StatusBadge con colores distintos.
// tone: neutral | info | success | warning | danger

const map = (entries) => (value) => entries[value] || { label: value || "—", tone: "neutral" };

export const opportunityStatus = map({
  open: { label: "Abierta", tone: "info" },
  won: { label: "Ganada", tone: "success" },
  lost: { label: "Perdida", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "neutral" },
  on_hold: { label: "Suspendida", tone: "warning" },
  suspended: { label: "Suspendida", tone: "warning" },
});

export const leadStatus = map({
  new: { label: "Nuevo", tone: "info" },
  contacted: { label: "Contactado", tone: "warning" },
  qualified: { label: "Calificado", tone: "success" },
  unqualified: { label: "Descalificado", tone: "neutral" },
  disqualified: { label: "Descalificado", tone: "neutral" },
  converted: { label: "Convertido", tone: "success" },
});

export const activityStatus = map({
  scheduled: { label: "Programada", tone: "info" },
  pending: { label: "Pendiente", tone: "info" },
  completed: { label: "Completada", tone: "success" },
  cancelled: { label: "Cancelada", tone: "neutral" },
  visited_pending_followup: { label: "Falta seguimiento", tone: "warning" },
});

export const blueSheetStatus = map({
  draft: { label: "Borrador", tone: "neutral" },
  in_progress: { label: "En progreso", tone: "info" },
  ready_for_review: { label: "En revisión", tone: "info" },
  approved: { label: "Aprobado", tone: "success" },
  active: { label: "Aprobado", tone: "success" },
  observed: { label: "Observado", tone: "warning" },
  needs_update: { label: "Requiere actualización", tone: "warning" },
});

export const accountClassification = map({
  oro: { label: "Oro", tone: "warning" },
  plata: { label: "Plata", tone: "neutral" },
  bronce: { label: "Bronce", tone: "neutral" },
  normal: { label: "Normal", tone: "neutral" },
});

export const health = map({
  green: { label: "Saludable", tone: "success" },
  yellow: { label: "En riesgo", tone: "warning" },
  red: { label: "Crítica", tone: "danger" },
  gray: { label: "Sin Blue Sheet", tone: "neutral" },
});

export const ACCOUNT_TYPES = [
  { value: "empresa", label: "Empresa" },
  { value: "persona_natural", label: "Persona natural" },
  { value: "gobierno", label: "Gobierno" },
  { value: "ong", label: "ONG" },
];
export const accountType = (value) => ACCOUNT_TYPES.find((t) => t.value === value)?.label || value || "—";

export const ACTIVITY_TYPES = {
  llamada: "Llamada", reunion: "Reunión", email: "Correo", visita: "Visita", demo: "Demo",
  propuesta: "Propuesta", seguimiento: "Seguimiento", tarea: "Tarea",
};
export const activityType = (value) => ACTIVITY_TYPES[value] || (value ? value.charAt(0).toUpperCase() + value.slice(1) : "Actividad");

// Estados de actividad que siguen "abiertos" (cuentan para hoy/vencidas).
export const isOpenActivity = (a) => !["completed", "cancelled"].includes(a?.status);
