// Destino del boton "Abrir" de una notificacion. El backend (notificationTargets.js) guarda
// meta.target_path en las nuevas; el fallback por source/meta cubre las notificaciones anteriores.

const normalizeSource = (source) => String(source || "").trim().toLowerCase();

export const getNotificationMetaValue = (notification, keys = []) => {
  const meta = notification?.meta || {};
  const data = meta?.data || {};
  for (const key of keys) {
    if (meta[key] !== undefined && meta[key] !== null && meta[key] !== "") return meta[key];
    if (data[key] !== undefined && data[key] !== null && data[key] !== "") return data[key];
  }
  return null;
};

const resolveFallbackTargetPath = (notification) => {
  const source = normalizeSource(notification?.source);
  // La alerta de SLA vencido solo informa el incumplimiento; no ofrece acceso directo al BC.
  if (source === "business_case.preflow.expiry") return null;

  const purchaseId = getNotificationMetaValue(notification, ["purchase_id", "purchaseId"]);
  const requestId = getNotificationMetaValue(notification, ["request_id", "requestId"]);
  const solicitudId = getNotificationMetaValue(notification, ["solicitud_id", "solicitudId"]);
  const bcId = getNotificationMetaValue(notification, ["business_case_id", "businessCaseId", "bc_id", "bcId"]);

  if (source.startsWith("private_purchase") && purchaseId) {
    return `/dashboard/purchases/workspace?tab=private&requestId=${purchaseId}&requestType=private`;
  }
  if ((source.startsWith("equipment_purchase") || source.startsWith("equipment_purchases")) && (requestId || purchaseId)) {
    return `/dashboard/purchases/workspace?tab=public&requestId=${requestId || purchaseId}&requestType=public`;
  }
  if ((source.startsWith("permisos_vacaciones") || source.startsWith("vacaciones")) && solicitudId) {
    return `/dashboard/talento-humano/permisos?solicitudId=${solicitudId}`;
  }
  if ((source.startsWith("business_case") || source === "bc_availability") && bcId) {
    return `/dashboard/business-case/workspace/${bcId}`;
  }
  if (source === "requests" && requestId) {
    const type = String(getNotificationMetaValue(notification, ["request_type"]) || "").toUpperCase();
    return `${type === "F.VE-02" ? "/dashboard/comercial/solicitudes" : "/dashboard/servicio-tecnico"}?request=${requestId}`;
  }
  if (source.startsWith("support_tickets") && getNotificationMetaValue(notification, ["ticket_id", "ticketId"])) {
    return "/dashboard/ti/workspace";
  }
  if (source.startsWith("attendance")) return "/dashboard/talento-humano/asistencia-reportes";
  return null;
};

export const resolveNotificationTargetPath = (notification) => {
  const metaTargetPath = getNotificationMetaValue(notification, [
    "target_path",
    "targetPath",
    "url",
    "path",
    "redirect_to",
    "redirectTo",
  ]);
  return metaTargetPath || resolveFallbackTargetPath(notification);
};

export const getNotificationCtaLabel = (notification) =>
  getNotificationMetaValue(notification, ["cta_label", "ctaLabel"]) || "Abrir";
