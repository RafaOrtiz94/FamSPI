import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FiTool,
  FiCalendar,
  FiCheckCircle,
  FiShield,
  FiTruck,
} from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import { DashboardHeader, SectionTitle } from "../../../../core/ui/layouts/DashboardLayout";
import PermisosCompactCard from "../../../shared/solicitudes/components/PermisosCompactCard";

const availabilityLabel = (status) => {
  const v = (status || "").toString().toLowerCase();
  if (["disponible", "available", "on"].includes(v)) return "Disponible";
  if (["ocupado", "busy"].includes(v)) return "Ocupado";
  return "No disponible";
};

const availabilityColor = (status) => {
  const v = (status || "").toString().toLowerCase();
  if (["disponible", "available", "on"].includes(v)) return "bg-[#DCFCE7] text-[#16A34A] border-green-200";
  if (["ocupado", "busy"].includes(v)) return "bg-[#FEF3C7] text-[#D97706] border-amber-200";
  return "bg-[#FEE2E2] text-[#DC2626] border-red-200";
};

const parsePayload = (payload) => {
  if (!payload) return {};
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch { return {}; }
  }
  return payload;
};

// Solo módulos sin entrada en la barra de navegación
const QUICK_ACTIONS = [
  {
    icon: FiTool,
    label: "Mis mantenimientos",
    sub: null, // se calcula dinámicamente
    path: "/dashboard/servicio-tecnico/mantenimientos",
  },
  {
    icon: FiCalendar,
    label: "Mi calendario",
    sub: "Ver agenda",
    path: "/dashboard/servicio-tecnico/calendario",
  },
  {
    icon: FiCheckCircle,
    label: "Historial",
    sub: "Trabajos completados",
    path: "/dashboard/servicio-tecnico/historial",
  },
  {
    icon: FiShield,
    label: "Desinfección",
    sub: "Registro F.ST-02",
    path: "/dashboard/servicio-tecnico/desinfeccion",
  },
  {
    icon: FiTruck,
    label: "Retiros",
    sub: "Workflow F.ST-11",
    path: "/dashboard/servicio-tecnico/retiros",
  },
];

const TecnicoView = ({
  stats,
  myMaintenances,
  availability,
  teamAvailability = [],
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
        title="Panel Técnico"
        subtitle="Mis asignaciones y reportes"
        actions={
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors duration-150 active:scale-[0.97] cursor-pointer"
          >
            Actualizar
          </button>
        }
      />

      {/* Estado de disponibilidad */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">
              Estado de disponibilidad
            </p>
            <p className="mt-1 text-lg font-semibold text-[#111827]">
              {availabilityLabel(currentStatus)}
            </p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Tus jefes verán este estado en tiempo real.
            </p>
          </div>
          <button
            onClick={() => onAvailabilityChange?.(nextStatus)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150 cursor-pointer active:scale-[0.97] border ${availabilityColor(currentStatus)}`}
          >
            Marcar {nextStatus === "disponible" ? "disponible" : "no disponible"}
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Columna izquierda: accesos + asignaciones + solicitudes */}
        <div className="lg:col-span-2 space-y-6">

          {/* Accesos rápidos — grid dentro de un card, no grid DE cards */}
          <Card className="p-5">
            <SectionTitle title="Accesos rápidos" />
            <div className="grid grid-cols-2 gap-2 mt-4">
              {QUICK_ACTIONS.map((action, i) => {
                const sub =
                  action.label === "Mis mantenimientos"
                    ? `${stats.myPending || 0} pendientes`
                    : action.sub;
                return (
                  <button
                    key={i}
                    onClick={() => navigate(action.path)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors duration-150 cursor-pointer active:scale-[0.97] text-left"
                  >
                    <div className="shrink-0 p-2 bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                      <action.icon size={15} className="text-[#374151]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#111827] truncate">{action.label}</p>
                      {sub && (
                        <p className="text-xs text-[#6B7280] truncate">{sub}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Asignaciones pendientes */}
          <Card className="p-5">
            <SectionTitle title="Mis asignaciones pendientes" />
            <div className="overflow-x-auto mt-1">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-xs font-medium text-[#6B7280] uppercase tracking-wide border-b border-[#F3F4F6]">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Equipo</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F9FAFB]">
                  {myMaintenances && myMaintenances.length > 0 ? (
                    myMaintenances.map((m) => (
                      <tr key={m.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-[#6B7280]">#{m.id}</td>
                        <td className="px-4 py-3 font-medium text-[#111827]">{m.equipo_nombre}</td>
                        <td className="px-4 py-3 text-[#374151]">{m.tipo}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#374151]">
                          {new Date(m.fecha).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              navigate(`/dashboard/servicio-tecnico/mantenimientos/${m.id}`)
                            }
                            className="text-sm font-medium text-[#2563EB] hover:text-blue-700 cursor-pointer transition-colors"
                          >
                            Iniciar
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-4 py-6 text-center text-sm text-[#9CA3AF]">
                        No tienes mantenimientos pendientes asignados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Solicitudes en curso */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle title="Solicitudes en curso" />
              <button
                onClick={onOpenRequestsModal}
                className="text-xs font-medium text-[#2563EB] hover:text-blue-700 cursor-pointer transition-colors"
              >
                Ver historial
              </button>
            </div>
            {displayedSolicitudes.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] py-1">No hay solicitudes abiertas.</p>
            ) : (
              <div className="space-y-1.5">
                {displayedSolicitudes.map((req) => {
                  const payload = parsePayload(req.payload);
                  const cliente =
                    payload.nombre_cliente ||
                    payload.cliente ||
                    payload.customer_name ||
                    "Cliente";
                  const tipo =
                    req.type_name || req.type_title || payload.tipo || "Solicitud técnica";
                  const estado = req.status || req.estado || "Pendiente";
                  return (
                    <div
                      key={`${req.id}-${estado}`}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#111827]">{cliente}</p>
                        <p className="text-xs text-[#6B7280]">{tipo}</p>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                        {estado}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Columna derecha: disponibilidad del equipo */}
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle title="Disponibilidad del equipo" />
            <div className="space-y-2 mt-3">
              {teamAvailability && teamAvailability.length > 0 ? (
                teamAvailability.map((member) => (
                  <div
                    key={member.id || member.userId || member.name}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${availabilityColor(member.status)}`}
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {member.name || member.fullname || "Técnico"}
                      </p>
                      {member.updatedAt && (
                        <p className="text-xs opacity-60 font-mono">
                          {new Date(member.updatedAt).toLocaleString()}
                        </p>
                      )}
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

      {/* Permisos y vacaciones — card compacta, módulo completo en navbar */}
      <div className="mt-6">
        <PermisosCompactCard />
      </div>
    </>
  );
};

export default TecnicoView;
