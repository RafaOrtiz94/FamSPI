import React from "react";
import { useNavigate } from "react-router-dom";

import ServicioCard from "../../design/ServicioCard";
import ServicioEmptyState from "../../design/ServicioEmptyState";
import PermisosCompactCard from "../../../shared/solicitudes/components/PermisosCompactCard";
import DispatchStrip from "./DispatchStrip";
import DispatchLog from "./DispatchLog";
import { availabilityColor, availabilityLabel, parseDashboardPayload } from "./dashboardViewShared";

// Accesos directos a lo que no entra en la bitacora de despacho (calendario
// y ejecucion bajo demanda) -- franja de texto tipo tabs, no grid de cards
// identicas ni pills redondeadas genericas.
const SECONDARY_ACTIONS = [
  { label: "Cronograma", path: "/dashboard/servicio-tecnico/cronograma" },
  { label: "Retiros", path: "/dashboard/servicio-tecnico/solicitudes?tab=retiro" },
  { label: "Aplicaciones ST", path: "/dashboard/servicio-tecnico/aplicaciones" },
  { label: "Disponibilidad", path: "/dashboard/servicio-tecnico/disponibilidad" },
];

const JefeTecnicoView = ({
  stats,
  preventiveSummary = null,
  availability = [],
  scheduleRows = [],
  scheduleBacklog = [],
  actionQueueItems = [],
  actionQueueLoading = false,
  onRefresh,
  displayedSolicitudes = [],
  onOpenRequestsModal,
}) => {
  const navigate = useNavigate();

  const stripItems = [
    { label: "En cola", value: actionQueueItems.length },
    { label: "Urgentes", value: stats.alertas || 0, emphasis: true },
    { label: "Por coordinar", value: stats.pendingCoordination || 0 },
    { label: "Técnicos libres", value: stats.tecnicosActivos || 0 },
  ];

  return (
    <div className="st-scope space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="font-mono-data inline-block rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
            style={{ background: "var(--st-accent-soft)", color: "var(--st-accent-strong)" }}
          >
            JEFE-SVC
          </span>
          <h1 className="mt-2 text-2xl font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
            Coordinación del equipo técnico
          </h1>
          <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>
            Qué requiere tu decisión hoy, priorizado por urgencia.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="cursor-pointer rounded-[var(--st-radius-lg)] border px-4 py-2 text-sm font-medium transition-all duration-150 ease-out hover:bg-[var(--st-bg)] hover:shadow-[var(--st-shadow-raised)] active:scale-[0.97]"
          style={{ borderColor: "var(--st-border)", color: "var(--st-text-muted)", background: "var(--st-surface)" }}
        >
          Actualizar
        </button>
      </div>

      <DispatchStrip items={stripItems} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <ServicioCard className="p-5">
            <DispatchLog
              queueItems={actionQueueItems}
              queueLoading={actionQueueLoading}
              scheduleRows={scheduleRows}
              emptyDescription="Inspección, retiro, correctivos, preventivo y casos externos aparecerán aquí."
            />
          </ServicioCard>

          {scheduleBacklog.length ? (
            <ServicioCard className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
                  Sin fecha coordinada
                </h3>
                <span className="font-mono-data text-xs" style={{ color: "var(--st-text-faint)" }}>{scheduleBacklog.length}</span>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--st-border)" }}>
                {scheduleBacklog.slice(0, 5).map((item) => (
                  <div key={item.id} className="py-2">
                    <p className="text-sm font-medium" style={{ color: "var(--st-text)" }}>{item.title}</p>
                    <p className="text-xs" style={{ color: "var(--st-text-muted)" }}>
                      Ventana: {item.window_min_date || "—"} a {item.window_max_date || "—"}
                      {item.user_name ? ` · ${item.user_name}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </ServicioCard>
          ) : null}

          <div className="flex flex-wrap items-center border-y" style={{ borderColor: "var(--st-border)" }}>
            {SECONDARY_ACTIONS.map((action, index) => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors duration-150 hover:text-[var(--st-accent-strong)] active:scale-[0.97]"
                style={{
                  color: "var(--st-text-muted)",
                  borderLeft: index > 0 ? "1px solid var(--st-border)" : undefined,
                }}
              >
                {action.label}
              </button>
            ))}
          </div>

          <ServicioCard className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
                Cumplimiento del plan preventivo
              </h3>
              <button onClick={() => navigate("/dashboard/servicio-tecnico/mantenimientos")} className="cursor-pointer text-xs font-medium transition-colors duration-150 hover:text-[var(--st-accent-strong)]" style={{ color: "var(--st-accent)" }}>
                Ver plan
              </button>
            </div>
            {preventiveSummary?.plan ? (
              <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                <div>
                  <p className="text-xs" style={{ color: "var(--st-text-faint)" }}>Plan activo</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--st-text)" }}>{preventiveSummary.plan.title || `Plan ${preventiveSummary.plan.plan_year}`}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--st-text-faint)" }}>Cumplimiento</p>
                  <p className="font-mono-data text-xl font-semibold" style={{ color: "var(--st-text)" }}>
                    {preventiveSummary.rate !== null ? `${preventiveSummary.rate}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--st-text-faint)" }}>Items</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--st-text)" }}>
                    {preventiveSummary.plan.completed_items || 0}/{preventiveSummary.plan.total_items || 0}
                  </p>
                </div>
              </div>
            ) : (
              <ServicioEmptyState title="Sin plan preventivo activo" description="Genera un plan anual desde Mantenimientos para ver aquí su cumplimiento." />
            )}
          </ServicioCard>

          <ServicioCard className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
                Solicitudes en curso
              </h3>
              <button onClick={onOpenRequestsModal} className="cursor-pointer text-xs font-medium transition-colors duration-150 hover:text-[var(--st-accent-strong)]" style={{ color: "var(--st-accent)" }}>
                Historial
              </button>
            </div>
            {displayedSolicitudes.length === 0 ? (
              <ServicioEmptyState title="No hay solicitudes abiertas" />
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--st-border)" }}>
                {displayedSolicitudes.map((request) => {
                  const payload = parseDashboardPayload(request.payload);
                  const clientName = payload.nombre_cliente || payload.cliente || payload.customer_name || "Cliente";
                  const requestStatus = request.status || request.estado || "Pendiente";
                  return (
                    <div key={`${request.id}-${requestStatus}`} className="flex items-center justify-between gap-3 py-2">
                      <span className="truncate text-sm" style={{ color: "var(--st-text)" }}>{clientName}</span>
                      <span className="shrink-0 text-xs" style={{ color: "var(--st-text-muted)" }}>{requestStatus}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </ServicioCard>
        </div>

        <div className="space-y-5">
          <ServicioCard className="p-5">
            <h3 className="text-sm font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
              Equipo
            </h3>
            <div className="mt-3 divide-y" style={{ borderColor: "var(--st-border)" }}>
              {availability.length ? (
                availability.map((member) => (
                  <div key={member.id || member.userId || member.name} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-w-0 flex-1 text-sm leading-snug" style={{ color: "var(--st-text)" }}>
                      {member.name || member.fullname || "Técnico"}
                    </span>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold uppercase ${availabilityColor(member.status)}`}
                    >
                      {availabilityLabel(member.status)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-2 text-sm" style={{ color: "var(--st-text-faint)" }}>Sin información de disponibilidad.</p>
              )}
            </div>
          </ServicioCard>
        </div>
      </div>

      <PermisosCompactCard />
    </div>
  );
};

export default JefeTecnicoView;
