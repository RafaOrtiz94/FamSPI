// Destino por defecto de una notificacion (boton "Abrir" en campana, pagina de notificaciones,
// correo y push). Lo usa createNotification para toda notificacion que no traiga target_path,
// venga del notificationManager o se cree directo.

const pick = (meta, keys) => {
  const data = meta?.data && typeof meta.data === "object" ? meta.data : {};
  for (const key of keys) {
    if (meta?.[key] !== undefined && meta[key] !== null && meta[key] !== "") return meta[key];
    if (data[key] !== undefined && data[key] !== null && data[key] !== "") return data[key];
  }
  return null;
};

// Fuentes que informan un incumplimiento y NO deben ofrecer acceso directo (decision existente en el frontend).
const NO_TARGET_SOURCES = new Set(["business_case.preflow.expiry"]);

function resolveDefaultTarget({ source, meta = {} } = {}) {
  const src = String(source || "").trim().toLowerCase();
  if (!src || NO_TARGET_SOURCES.has(src)) return null;

  const purchaseId = pick(meta, ["purchase_id", "purchaseId"]);
  const requestId = pick(meta, ["request_id", "requestId"]);
  const bcId = pick(meta, ["business_case_id", "businessCaseId", "bc_id"]);
  const solicitudId = pick(meta, ["solicitud_id", "solicitudId"]);

  if (src.startsWith("private_purchase") && purchaseId) {
    return {
      target_path: `/dashboard/purchases/workspace?tab=private&requestId=${purchaseId}&requestType=private`,
      cta_label: "Abrir expediente",
    };
  }
  if ((src.startsWith("equipment_purchase") || src.startsWith("equipment_purchases")) && (requestId || purchaseId)) {
    return {
      target_path: `/dashboard/purchases/workspace?tab=public&requestId=${requestId || purchaseId}&requestType=public`,
      cta_label: "Abrir expediente",
    };
  }
  if ((src.startsWith("permisos_vacaciones") || src.startsWith("vacaciones")) && solicitudId) {
    return { target_path: `/dashboard/talento-humano/permisos?solicitudId=${solicitudId}`, cta_label: "Ver solicitud" };
  }
  if (src.startsWith("business_case") && bcId) {
    return { target_path: `/dashboard/business-case/workspace/${bcId}`, cta_label: "Abrir Business Case" };
  }
  if (src === "bc_availability" && bcId) {
    return { target_path: `/dashboard/business-case/workspace/${bcId}`, cta_label: "Abrir Business Case" };
  }
  if (src === "requests" && requestId) {
    const type = String(pick(meta, ["request_type"]) || "").toUpperCase();
    const base = type === "F.VE-02" ? "/dashboard/comercial/solicitudes" : "/dashboard/servicio-tecnico";
    return { target_path: `${base}?request=${requestId}`, cta_label: "Ver solicitud" };
  }
  if (src.startsWith("support_tickets") && pick(meta, ["ticket_id", "ticketId"])) {
    return { target_path: "/dashboard/ti/workspace", cta_label: "Abrir ticket" };
  }
  if (src.startsWith("attendance")) {
    return { target_path: "/dashboard/talento-humano/asistencia-reportes", cta_label: "Ver asistencia" };
  }
  return null;
}

// Devuelve meta con target_path/cta_label solo si faltan (un destino explicito nunca se pisa).
function withDefaultTarget({ source, meta = {} } = {}) {
  const base = meta && typeof meta === "object" ? meta : {};
  const hasTarget = pick(base, ["target_path", "targetPath", "url", "path", "redirect_to"]);
  if (hasTarget) return base;
  const target = resolveDefaultTarget({ source, meta: base });
  if (!target) return base;
  return { ...base, target_path: target.target_path, cta_label: base.cta_label || target.cta_label };
}

module.exports = { resolveDefaultTarget, withDefaultTarget };
