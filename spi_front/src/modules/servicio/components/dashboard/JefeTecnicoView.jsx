import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FiActivity,
  FiAlertTriangle,
  FiCalendar,
  FiClipboard,
  FiExternalLink,
  FiShield,
  FiTool,
  FiTruck,
  FiUsers,
} from "react-icons/fi";

import Card from "../../../../core/ui/components/Card";
import { DashboardHeader, SectionTitle } from "../../../../core/ui/layouts/DashboardLayout";
import PendingApprovals from "../../components/PendingApprovals";
import PermisosCompactCard from "../../../shared/solicitudes/components/PermisosCompactCard";
import {
  availabilityColor,
  availabilityLabel,
  formatTechnicalDateLabel,
  parseDashboardPayload,
  scheduleBadgeClass,
} from "./dashboardViewShared";

const LEAD_ACTIONS = [
  {
    icon: FiCalendar,
    label: "Cronograma tecnico",
    sub: "Agenda consolidada del equipo",
    path: "/dashboard/servicio-tecnico/cronograma",
  },
  {
    icon: FiClipboard,
    label: "Inspecciones de ambiente",
    sub: "F.ST-20, coordinacion y ejecucion",
    path: "/dashboard/servicio-tecnico/inspecciones",
  },
  {
    icon: FiTool,
    label: "Mantenimientos",
    sub: "Preventivo ST-01-02 y control operativo",
    path: "/dashboard/servicio-tecnico/mantenimientos",
  },
  {
    icon: FiActivity,
    label: "Correctivos",
    sub: "Casos y seguimiento tecnico",
    path: "/dashboard/servicio-tecnico/correctivos",
  },
  {
    icon: FiTruck,
    label: "Retiros",
    sub: "Workflow F.ST-11",
    path: "/dashboard/servicio-tecnico/retiros",
  },
  {
    icon: FiShield,
    label: "Aplicaciones ST",
    sub: "Formularios y procedimientos del area",
    path: "/dashboard/servicio-tecnico/aplicaciones",
  },
  {
    icon: FiUsers,
    label: "Disponibilidad",
    sub: "Estado visible del equipo",
    path: "/dashboard/servicio-tecnico/disponibilidad",
  },
  {
    icon: FiExternalLink,
    label: "Casos externos",
    sub: "Integracion ST-01-04",
    path: "/dashboard/servicio-tecnico/casos-externos",
  },
];

const JefeTecnicoView = ({
  stats,
  maintenances,
  availability = [],
  scheduleRows = [],
  scheduleBacklog = [],
  onRefresh,
  onOpenWithdrawals,
  displayedSolicitudes = [],
  onOpenRequestsModal,
}) => {
  const navigate = useNavigate();

  const statItems = [
    {
      label: "Mantenimientos activos",
      value: stats.pendientes,
      icon: <FiTool size={15} />,
      iconBg: "bg-blue-50 text-blue-600",
    },
    {
      label: "Tecnicos disponibles",
      value: stats.tecnicosActivos || 0,
      icon: <FiUsers size={15} />,
      iconBg: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Alertas criticas",
      value: stats.alertas || 0,
      icon: <FiAlertTriangle size={15} />,
      iconBg: "bg-[#FEE2E2] text-[#DC2626]",
    },
    {
      label: "Eventos visibles",
      value: stats.scheduledEvents || 0,
      icon: <FiCalendar size={15} />,
      iconBg: "bg-[#DBEAFE] text-[#2563EB]",
    },
  ];

  return (
    <>
      <DashboardHeader
        title="Direccion tecnica"
        subtitle="Coordina agenda, inspecciones, mantenimientos y carga visible del equipo tecnico."
        actions={
          <button
            onClick={onRefresh}
            className="cursor-pointer rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-colors duration-150 hover:bg-[#F9FAFB] active:scale-[0.97]"
          >
            Actualizar
          </button>
        }
      />

      <div className="mb-6 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col sm:flex-row">
          {statItems.map((item, index) => (
            <div
              key={item.label}
              className={`flex flex-1 items-center gap-4 px-6 py-5 ${
                index > 0 ? "border-t border-[#F3F4F6] sm:border-l sm:border-t-0" : ""
              }`}
            >
              <div className={`shrink-0 rounded-xl p-2.5 ${item.iconBg}`}>{item.icon}</div>
              <div>
                <p className="text-xs font-medium leading-tight text-[#6B7280]">{item.label}</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-[#111827]">
                  {item.value ?? "-"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PendingApprovals onActionComplete={onRefresh} />

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <SectionTitle title="Pulso del cronograma tecnico" />
                <p className="mt-1 text-xs text-[#6B7280]">
                  Agenda consolidada del equipo con foco en coordinaciones pendientes y proximos hitos.
                </p>
              </div>
              <button
                onClick={() => navigate("/dashboard/servicio-tecnico/cronograma")}
                className="cursor-pointer text-xs font-medium text-[#2563EB] transition-colors hover:text-blue-700"
              >
                Abrir cronograma
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
              <div className="space-y-3">
                {scheduleRows.length ? (
                  scheduleRows.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#111827]">{item.title}</p>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${scheduleBadgeClass(
                            item.category,
                          )}`}
                        >
                          {item.source_label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#6B7280]">
                        {formatTechnicalDateLabel(item.activity_date)}
                        {item.user_name ? ` · ${item.user_name}` : ""}
                        {item.status ? ` · ${item.status}` : ""}
                      </p>
                      {item.notes ? <p className="mt-1 text-xs text-[#374151]">{item.notes}</p> : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#9CA3AF]">No hay eventos tecnicos visibles en este rango.</p>
                )}
              </div>

              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                  Pendientes por coordinar
                </p>
                <p className="mt-2 text-3xl font-semibold text-[#111827]">
                  {stats.pendingCoordination || 0}
                </p>
                <p className="mt-1 text-xs text-[#6B7280]">
                  Solicitudes con inspeccion creada que aun no tienen fecha cerrada.
                </p>
                <div className="mt-4 space-y-2">
                  {scheduleBacklog.length ? (
                    scheduleBacklog.slice(0, 3).map((item) => (
                      <div key={item.id} className="rounded-xl bg-[#F9FAFB] px-3 py-2.5">
                        <p className="text-sm font-medium text-[#111827]">{item.title}</p>
                        <p className="text-xs text-[#6B7280]">
                          {formatTechnicalDateLabel(item.window_min_date)} - {formatTechnicalDateLabel(item.window_max_date)}
                        </p>
                        {item.user_name ? (
                          <p className="mt-1 text-xs text-[#6B7280]">Tecnico visible: {item.user_name}</p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#9CA3AF]">No hay pendientes de coordinacion en este momento.</p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Modulos de coordinacion" />
            <p className="mt-1 text-xs text-[#6B7280]">
              Cada modulo representa una parte real de la operacion tecnica y ya tiene destino navegable.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {LEAD_ACTIONS.map((action) => (
                <button
                  key={action.path}
                  onClick={() =>
                    action.path === "/dashboard/servicio-tecnico/retiros"
                      ? onOpenWithdrawals?.()
                      : navigate(action.path)
                  }
                  className="cursor-pointer rounded-xl bg-[#F9FAFB] px-4 py-3 text-left transition-colors duration-150 hover:bg-[#F3F4F6] active:scale-[0.97]"
                >
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 rounded-lg bg-white p-2 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                      <action.icon size={15} className="text-[#374151]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#111827]">{action.label}</p>
                      <p className="truncate text-xs text-[#6B7280]">{action.sub}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Resumen de mantenimientos" />
            <div className="mt-1 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#F3F4F6] text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                    <th className="px-4 py-3">Equipo</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Responsable</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F9FAFB]">
                  {maintenances?.length ? (
                    maintenances.slice(0, 5).map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-[#F9FAFB]">
                        <td className="px-4 py-3 font-medium text-[#111827]">{item.equipo_nombre}</td>
                        <td className="px-4 py-3 text-[#374151]">{item.tipo}</td>
                        <td className="px-4 py-3 text-[#374151]">{item.responsable || "Sin asignar"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                              item.estado === "completado"
                                ? "bg-[#DCFCE7] text-[#16A34A]"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {item.estado}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-6 text-center text-sm text-[#9CA3AF]">
                        No hay mantenimientos recientes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <SectionTitle title="Solicitudes en curso" />
              <button
                onClick={onOpenRequestsModal}
                className="cursor-pointer text-xs font-medium text-[#2563EB] transition-colors hover:text-blue-700"
              >
                Ver historial
              </button>
            </div>
            {displayedSolicitudes.length === 0 ? (
              <p className="py-1 text-sm text-[#9CA3AF]">No hay solicitudes abiertas.</p>
            ) : (
              <div className="space-y-1.5">
                {displayedSolicitudes.map((request) => {
                  const payload = parseDashboardPayload(request.payload);
                  const clientName =
                    payload.nombre_cliente || payload.cliente || payload.customer_name || "Cliente";
                  const requestType =
                    request.type_name || request.type_title || payload.tipo || "Solicitud tecnica";
                  const requestStatus = request.status || request.estado || "Pendiente";
                  return (
                    <div
                      key={`${request.id}-${requestStatus}`}
                      className="flex items-center justify-between rounded-xl bg-[#F9FAFB] px-3 py-2.5 transition-colors hover:bg-[#F3F4F6]"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#111827]">{clientName}</p>
                        <p className="text-xs text-[#6B7280]">{requestType}</p>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                        {requestStatus}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle title="Disponibilidad de equipo" />
            <div className="mt-3 space-y-2">
              {availability.length ? (
                availability.map((member) => (
                  <div
                    key={member.id || member.userId || member.name}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${availabilityColor(member.status)}`}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {member.name || member.fullname || "Tecnico"}
                      </p>
                      {member.updatedAt ? (
                        <p className="font-mono text-xs opacity-60">
                          {new Date(member.updatedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-xs font-semibold">{availabilityLabel(member.status)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#9CA3AF]">Sin informacion de disponibilidad.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <PermisosCompactCard />
      </div>
    </>
  );
};

export default JefeTecnicoView;
