import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FiActivity,
  FiCalendar,
  FiCheckCircle,
  FiClipboard,
  FiShield,
  FiTool,
  FiTruck,
  FiUsers,
} from "react-icons/fi";

import Card from "../../../../core/ui/components/Card";
import { DashboardHeader, SectionTitle } from "../../../../core/ui/layouts/DashboardLayout";
import PermisosCompactCard from "../../../shared/solicitudes/components/PermisosCompactCard";
import {
  availabilityColor,
  availabilityLabel,
  formatTechnicalDateLabel,
  parseDashboardPayload,
  scheduleBadgeClass,
} from "./dashboardViewShared";

const QUICK_ACTIONS = [
  {
    icon: FiCalendar,
    label: "Cronograma tecnico",
    sub: "Agenda y bloqueos del equipo",
    path: "/dashboard/servicio-tecnico/cronograma",
  },
  {
    icon: FiClipboard,
    label: "Inspecciones",
    sub: "F.ST-20 y procedimiento tecnico",
    path: "/dashboard/servicio-tecnico/inspecciones",
  },
  {
    icon: FiTool,
    label: "Mantenimientos",
    sub: null,
    path: "/dashboard/servicio-tecnico/mantenimientos",
  },
  {
    icon: FiActivity,
    label: "Correctivos",
    sub: "Casos y compatibilidad legacy",
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
    sub: "F.ST-02, 04, 05 y 09",
    path: "/dashboard/servicio-tecnico/aplicaciones",
  },
  {
    icon: FiUsers,
    label: "Disponibilidad",
    sub: "Estado visible del equipo",
    path: "/dashboard/servicio-tecnico/disponibilidad",
  },
  {
    icon: FiCheckCircle,
    label: "Asistencia y salidas",
    sub: "Operaciones y visitas",
    path: "/dashboard/servicio-tecnico/asistencia",
  },
];

const TecnicoView = ({
  stats,
  myMaintenances,
  availability,
  teamAvailability = [],
  scheduleRows = [],
  scheduleBacklog = [],
  onAvailabilityChange,
  onRefresh,
  displayedSolicitudes = [],
  onOpenRequestsModal,
}) => {
  const navigate = useNavigate();
  const currentStatus = availability?.status || "no_disponible";
  const nextStatus = currentStatus === "disponible" ? "no_disponible" : "disponible";

  return (
    <>
      <DashboardHeader
        title="Panel tecnico"
        subtitle="Tu operacion diaria queda organizada por modulos claros y agenda visible."
        actions={
          <button
            onClick={onRefresh}
            className="cursor-pointer rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-colors duration-150 hover:bg-[#F9FAFB] active:scale-[0.97]"
          >
            Actualizar
          </button>
        }
      />

      <Card className="mb-6 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
              Estado de disponibilidad
            </p>
            <p className="mt-1 text-lg font-semibold text-[#111827]">
              {availabilityLabel(currentStatus)}
            </p>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">
              Este estado se usa para coordinacion visible en el area tecnica.
            </p>
          </div>
          <button
            onClick={() => onAvailabilityChange?.(nextStatus)}
            className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-medium transition-colors duration-150 active:scale-[0.97] ${availabilityColor(currentStatus)}`}
          >
            Marcar {nextStatus === "disponible" ? "disponible" : "no disponible"}
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <SectionTitle title="Mi agenda proxima" />
                <p className="mt-1 text-xs text-[#6B7280]">
                  Eventos tecnicos consolidados para los proximos dias y pendientes que todavia requieren fecha.
                </p>
              </div>
              <button
                onClick={() => navigate("/dashboard/servicio-tecnico/cronograma")}
                className="cursor-pointer text-xs font-medium text-[#2563EB] transition-colors hover:text-blue-700"
              >
                Abrir cronograma
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
              <div className="space-y-2">
                {scheduleRows.length ? (
                  scheduleRows.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3"
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
                  <p className="text-sm text-[#9CA3AF]">No tienes agenda tecnica visible en este rango.</p>
                )}
              </div>

              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                  Coordinacion pendiente
                </p>
                <p className="mt-2 text-2xl font-semibold text-[#111827]">
                  {stats.pendingCoordination || 0}
                </p>
                <p className="mt-1 text-xs text-[#6B7280]">
                  Solicitudes con inspeccion creada pero aun sin fecha cerrada.
                </p>
                <div className="mt-4 space-y-2">
                  {scheduleBacklog.length ? (
                    scheduleBacklog.slice(0, 2).map((item) => (
                      <div key={item.id} className="rounded-xl bg-[#F9FAFB] px-3 py-2">
                        <p className="text-sm font-medium text-[#111827]">{item.title}</p>
                        <p className="text-xs text-[#6B7280]">
                          {formatTechnicalDateLabel(item.window_min_date)} - {formatTechnicalDateLabel(item.window_max_date)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#9CA3AF]">No hay coordinaciones pendientes visibles.</p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Modulos operativos" />
            <p className="mt-1 text-xs text-[#6B7280]">
              Accesos directos al trabajo tecnico diario, sin rutas fantasma ni vistas duplicadas.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {QUICK_ACTIONS.map((action) => {
                const sub =
                  action.label === "Mantenimientos" ? `${stats.myPending || 0} pendientes` : action.sub;
                return (
                  <button
                    key={action.path}
                    onClick={() => navigate(action.path)}
                    className="cursor-pointer rounded-xl bg-[#F9FAFB] px-4 py-3 text-left transition-colors duration-150 hover:bg-[#F3F4F6] active:scale-[0.97]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 rounded-lg bg-white p-2 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                        <action.icon size={15} className="text-[#374151]" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#111827]">{action.label}</p>
                        {sub ? <p className="truncate text-xs text-[#6B7280]">{sub}</p> : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Mis asignaciones pendientes" />
            <div className="mt-1 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#F3F4F6] text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Equipo</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F9FAFB]">
                  {myMaintenances?.length ? (
                    myMaintenances.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-[#F9FAFB]">
                        <td className="px-4 py-3 font-mono text-xs text-[#6B7280]">#{item.id}</td>
                        <td className="px-4 py-3 font-medium text-[#111827]">{item.equipo_nombre}</td>
                        <td className="px-4 py-3 text-[#374151]">{item.tipo}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#374151]">
                          {new Date(item.fecha).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-6 text-center text-sm text-[#9CA3AF]">
                        No tienes mantenimientos pendientes asignados.
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
            <SectionTitle title="Disponibilidad del equipo" />
            <div className="mt-3 space-y-2">
              {teamAvailability.length ? (
                teamAvailability.map((member) => (
                  <div
                    key={member.id || member.userId || member.name}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${availabilityColor(member.status)}`}
                  >
                    <div>
                      <p className="text-sm font-semibold">
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
                <p className="text-sm text-[#9CA3AF]">Sin datos de disponibilidad del equipo.</p>
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

export default TecnicoView;
