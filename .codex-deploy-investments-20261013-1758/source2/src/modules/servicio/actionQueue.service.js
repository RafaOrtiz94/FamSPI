// Agrega, en una sola cola normalizada y priorizada, todo lo que requiere una
// decision o accion humana en servicio tecnico -- inspeccion/retiro
// (aprobaciones), correctivos, ofertas/reprogramaciones preventivas y casos
// externos accionables. No agrega logica de negocio nueva: cada fuente sigue
// siendo el servicio ya existente y probado; esto solo lee, normaliza y
// ordena.
const approvalsService = require("../approvals/approvals.service");
const withdrawalWorkflowService = require("./withdrawalWorkflow.service");
const correctiveCasesService = require("./correctiveCases.service");
const preventivePlanningService = require("../mantenimientos/preventivePlanning.service");
const externalCasesService = require("./externalCases.service");
const logger = require("../../config/logger");

const todayKey = () => new Date().toISOString().slice(0, 10);

const buildItem = ({
  type,
  id,
  urgency = "normal",
  title,
  meta = null,
  clientName = null,
  primaryAction,
  sourcePath,
  createdAt = null,
}) => ({
  id: `${type}:${id}`,
  type,
  urgency,
  title,
  meta,
  client_name: clientName,
  primary_action: primaryAction,
  source_path: sourcePath,
  created_at: createdAt,
});

const safeJson = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return {};
  }
};

// ---------------------------------------------------------------------------
// Inspeccion / Retiro (F.ST-20 / F.ST-21) -- aprobaciones pendientes de jefe
// ---------------------------------------------------------------------------
async function listApprovalItems(user) {
  const { rows } = await approvalsService.listPending(1, 100, user);
  const today = todayKey();
  return (rows || []).map((row) => {
    const payload = safeJson(row.payload);
    const clientName = payload.nombre_cliente || payload.cliente || null;
    const isInspection = String(row.type_code || "").toUpperCase() === "F.ST-20";
    const proposedDate = String(payload.fecha_instalacion || "").slice(0, 10);
    return buildItem({
      type: "approval",
      id: row.id,
      urgency: proposedDate === today ? "today" : "normal",
      title: `${row.type_title || row.type_code} pendiente de decisión`,
      meta: clientName ? `${row.type_code} · Solicitado por ${row.requester_name || row.requester_email || "N/D"}` : row.type_code,
      clientName,
      primaryAction: isInspection ? "Asignar" : "Revisar",
      sourcePath:
        row.type_code === "F.ST-21"
          ? "/dashboard/servicio-tecnico/solicitudes?tab=retiro&subtab=compras"
          : "/dashboard/servicio-tecnico/solicitudes?tab=inspeccion&subtab=independientes",
      createdAt: row.created_at,
    });
  });
}

// ---------------------------------------------------------------------------
// Retiro -- workflows sin coordinar o sin WO asignada (F.ST-21 en ejecucion)
// ---------------------------------------------------------------------------
async function listWithdrawalItems({ scope, userId }) {
  const rows = await withdrawalWorkflowService.listWithdrawalWorkflows({ limit: 200 });
  const now = Date.now();
  return (rows || [])
    .filter((row) => row.workflow_status !== "cerrado")
    .filter((row) => {
      const state = safeJson(row.workflow_state);
      const assignedUserId = Number(state?.work_order?.assigned_user_id) || null;
      if (scope === "mine") return assignedUserId === userId;
      // team: solo lo que aun no tiene ejecutor asignado, para que el jefe lo coordine
      return !assignedUserId;
    })
    .map((row) => {
      const state = safeJson(row.workflow_state);
      const daysOld = row.request_created_at ? Math.floor((now - new Date(row.request_created_at).getTime()) / 86400000) : 0;
      return buildItem({
        type: "withdrawal",
        id: row.id,
        urgency: daysOld > 3 ? "urgent" : "normal",
        title: state?.work_order?.assigned_user_id ? "Retiro en ejecución" : "Retiro sin coordinar",
        meta: `F.ST-21 · Solicitud #${row.request_id || row.id}`,
        clientName: row.client_name,
        primaryAction: scope === "mine" ? "Ejecutar" : "Coordinar",
        sourcePath: "/dashboard/servicio-tecnico/solicitudes?tab=retiro&subtab=compras",
        createdAt: row.request_created_at,
      });
    });
}

// ---------------------------------------------------------------------------
// Correctivos -- reutiliza el filtro onlyMine ya existente en el workspace
// ---------------------------------------------------------------------------
const ACTIONABLE_CORRECTIVE_STATUSES = new Set([
  "ceac_received",
  "ceac_diagnosis",
  "escalated_dispatch",
  "parts_pending_quote",
  "parts_pending_client_approval",
  "pending_disinfection",
]);

async function listCorrectiveItems({ scope, user }) {
  const rows = await correctiveCasesService.listCorrectiveCasesWorkspace({
    actorUser: user,
    onlyMine: scope === "mine",
    limit: 200,
  });
  return (rows || [])
    .filter((row) => ACTIONABLE_CORRECTIVE_STATUSES.has(String(row.status || "").toLowerCase()))
    .map((row) =>
      buildItem({
        type: "corrective",
        id: row.id,
        urgency: row.sla_response_breached || row.sla_resolution_breached ? "urgent" : "normal",
        title: `Correctivo ${row.code || `#${row.id}`}`,
        meta: `${row.problem_summary || "Sin resumen"} · ${row.equipment_name || "Equipo N/D"}`,
        clientName: row.client_name,
        primaryAction: scope === "mine" ? "Atender" : "Revisar",
        sourcePath: "/dashboard/servicio-tecnico/mantenimientos?tab=corrective",
        createdAt: row.created_at,
      }),
    );
}

// ---------------------------------------------------------------------------
// Preventivo -- ofertas y reprogramaciones pendientes del plan activo
// (decision de jefatura/comercial, no hay asignacion por tecnico todavia)
// ---------------------------------------------------------------------------
async function listPreventiveItems({ scope }) {
  if (scope === "mine") return [];
  try {
    const plans = await preventivePlanningService.listPreventiveAnnualPlans({ limit: 20 });
    const activePlan =
      (plans || []).find((plan) => String(plan.status || "").toLowerCase() === "active") || (plans || [])[0];
    if (!activePlan?.id) return [];
    const items = await preventivePlanningService.getPreventivePlanItems(activePlan.id);
    return (items || [])
      .filter((item) => String(item.status || "").toLowerCase() === "offer_pending")
      .map((item) =>
        buildItem({
          type: "preventive_offer",
          id: item.id,
          urgency: "normal",
          title: "Oferta de mantenimiento preventivo",
          meta: `Anexo 4 · ${item.equipment_name || `Equipo #${item.equipment_id}`}`,
          clientName: item.client_name,
          primaryAction: "Revisar",
          sourcePath: "/dashboard/servicio-tecnico/mantenimientos",
          createdAt: null,
        }),
      );
  } catch (err) {
    logger.warn({ err }, "No se pudo cargar items preventivos para la cola de acciones");
    return [];
  }
}

// ---------------------------------------------------------------------------
// Casos externos -- validacion pendiente / error de sync / bloqueado
// ---------------------------------------------------------------------------
const ACTIONABLE_EXTERNAL_STATUSES = new Set(["pending_validation", "sync_error", "blocked"]);

async function listExternalCaseItems({ scope }) {
  if (scope === "mine") return [];
  const rows = await externalCasesService.listExternalCasesWorkspace({ limit: 200 });
  return (rows || [])
    .filter((row) => ACTIONABLE_EXTERNAL_STATUSES.has(String(row.internal_status || "").toLowerCase()))
    .map((row) =>
      buildItem({
        type: "external_case",
        id: row.id,
        urgency: String(row.internal_status || "").toLowerCase() === "sync_error" ? "urgent" : "normal",
        title: row.code || `Caso externo #${row.id}`,
        meta: `${row.provider || "Proveedor N/D"} · ${row.internal_status}`,
        clientName: row.client_name,
        primaryAction: "Decidir",
        sourcePath: "/dashboard/servicio-tecnico/casos-externos",
        createdAt: row.updated_at,
      }),
    );
}

const URGENCY_RANK = { urgent: 0, today: 1, normal: 2 };

const sortQueue = (items) =>
  [...items].sort((a, b) => {
    const rankDiff = (URGENCY_RANK[a.urgency] ?? 2) - (URGENCY_RANK[b.urgency] ?? 2);
    if (rankDiff !== 0) return rankDiff;
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  });

async function getActionQueue({ user, scope: requestedScope } = {}) {
  const scope = requestedScope === "mine" ? "mine" : "team";
  const userId = Number(user?.id) || null;

  const results = await Promise.allSettled([
    scope === "team" ? listApprovalItems(user) : Promise.resolve([]),
    listWithdrawalItems({ scope, userId }),
    listCorrectiveItems({ scope, user }),
    listPreventiveItems({ scope }),
    listExternalCaseItems({ scope }),
  ]);

  const items = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const sorted = sortQueue(items);

  return {
    ok: true,
    scope,
    total: sorted.length,
    by_urgency: {
      urgent: sorted.filter((item) => item.urgency === "urgent").length,
      today: sorted.filter((item) => item.urgency === "today").length,
      normal: sorted.filter((item) => item.urgency === "normal").length,
    },
    items: sorted,
  };
}

module.exports = {
  getActionQueue,
};
