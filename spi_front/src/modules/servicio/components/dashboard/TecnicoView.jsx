import React from "react";
import { useNavigate } from "react-router-dom";

import ServicioCard from "../../design/ServicioCard";
import ServicioEmptyState from "../../design/ServicioEmptyState";
import PermisosCompactCard from "../../../shared/solicitudes/components/PermisosCompactCard";
import DispatchStrip from "./DispatchStrip";
import DispatchLog from "./DispatchLog";
import { availabilityColor, availabilityLabel, parseDashboardPayload } from "./dashboardViewShared";

// Atajos por especialidad (ST-01-01 §4.4/4.5, ST-01-03 §6.1: ing_servicio =
// hardware/inspeccion/retiro, esp_app = entrenamiento/verificacion/asistencia)
// -- franja de texto tipo tabs, no grid de botones identicos.
const SECONDARY_ACTIONS_BY_ROLE = {
  esp_app: [
    { label: "Cronograma", path: "/dashboard/servicio-tecnico/cronograma" },
    { label: "Aplicaciones ST", path: "/dashboard/servicio-tecnico/aplicaciones" },
    { label: "Asistencia", path: "/dashboard/servicio-tecnico/asistencia" },
    { label: "Disponibilidad", path: "/dashboard/servicio-tecnico/disponibilidad" },
  ],
  ing_servicio: [
    { label: "Cronograma", path: "/dashboard/servicio-tecnico/cronograma" },
    { label: "Inspecciones", path: "/dashboard/servicio-tecnico/solicitudes?tab=inspeccion" },
    { label: "Retiros", path: "/dashboard/servicio-tecnico/solicitudes?tab=retiro" },
    { label: "Aplicaciones ST", path: "/dashboard/servicio-tecnico/aplicaciones" },
    { label: "Disponibilidad", path: "/dashboard/servicio-tecnico/disponibilidad" },
  ],
};

const ROLE_COPY = {
  esp_app: {
    callsign: "ESP-APP",
    title: "Tu agenda de entrenamiento",
    subtitle: "Entrenamientos y casos de aplicación asignados a ti.",
    emptyQueue: "Entrenamientos o casos de aplicación asignados a ti aparecerán aquí.",
  },
  ing_servicio: {
    callsign: "ING-SVC",
    title: "Tu operación diaria",
    subtitle: "Inspecciones, retiros y correctivos asignados a ti.",
    emptyQueue: "Retiros, inspecciones o correctivos asignados a ti aparecerán aquí.",
  },
};

const TecnicoView = ({
  availability,
  teamAvailability = [],
  scheduleRows = [],
  actionQueueItems = [],
  actionQueueLoading = false,
  onAvailabilityChange,
  onRefresh,
  displayedSolicitudes = [],
  onOpenRequestsModal,
  viewerRole = "ing_servicio",
}) => {
  const navigate = useNavigate();
  const currentStatus = availability?.status || "no_disponible";
  const nextStatus = currentStatus === "disponible" ? "no_disponible" : "disponible";
  const copy = ROLE_COPY[viewerRole] || ROLE_COPY.ing_servicio;
  const secondaryActions = SECONDARY_ACTIONS_BY_ROLE[viewerRole] || SECONDARY_ACTIONS_BY_ROLE.ing_servicio;

  const stripItems = [
    { label: "En cola", value: actionQueueItems.length },
    { label: "Urgentes", value: actionQueueItems.filter((i) => i.urgency === "urgent").length, emphasis: true },
    { label: "Agenda 14d", value: scheduleRows.length },
  ];

  return (
    <div className="st-scope space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="font-mono-data inline-block rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
            style={{ background: "var(--st-accent-soft)", color: "var(--st-accent-strong)" }}
          >
            {copy.callsign}
          </span>
          <h1 className="mt-2 text-2xl font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
            {copy.title}
          </h1>
          <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>
            {copy.subtitle}
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
              emptyDescription={copy.emptyQueue}
            />
          </ServicioCard>

          {/* Tabs de solo texto, sin pill/icono -- el chip redondeado con icono
              es exactamente el lenguaje de boton generico SaaS que el resto
              del panel evita (critica de rediseno, ver plan de servicio). */}
          <div className="flex flex-wrap items-center border-y" style={{ borderColor: "var(--st-border)" }}>
            {secondaryActions.map((action, index) => (
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
        </div>

        <div className="space-y-5">
          <ServicioCard className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--st-text-faint)" }}>
                  Tu disponibilidad
                </p>
                <p className="mt-1 text-lg font-semibold" style={{ color: "var(--st-text)" }}>
                  {availabilityLabel(currentStatus)}
                </p>
              </div>
              <button
                onClick={() => onAvailabilityChange?.(nextStatus)}
                className={`shrink-0 cursor-pointer rounded-[var(--st-radius-lg)] border px-3 py-1.5 text-xs font-medium ${availabilityColor(currentStatus)}`}
              >
                {nextStatus === "disponible" ? "Marcar disponible" : "Marcar ocupado"}
              </button>
            </div>
          </ServicioCard>

          <ServicioCard className="p-5">
            <h3 className="text-sm font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
              Equipo
            </h3>
            <div className="mt-3 divide-y" style={{ borderColor: "var(--st-border)" }}>
              {teamAvailability.length ? (
                teamAvailability.map((member) => (
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
                <p className="py-2 text-sm" style={{ color: "var(--st-text-faint)" }}>Sin datos del equipo.</p>
              )}
            </div>
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
      </div>

      <PermisosCompactCard />
    </div>
  );
};

export default TecnicoView;
