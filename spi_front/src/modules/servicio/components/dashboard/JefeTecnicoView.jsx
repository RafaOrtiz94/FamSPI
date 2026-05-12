import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FiTool,
  FiUsers,
  FiAlertTriangle,
  FiCheckSquare,
  FiExternalLink,
  FiTruck,
} from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import { DashboardHeader, SectionTitle } from "../../../../core/ui/layouts/DashboardLayout";
import PendingApprovals from "../../components/PendingApprovals";
import PermisosCompactCard from "../../../shared/solicitudes/components/PermisosCompactCard";

const availabilityColor = (status) => {
  const v = (status || "").toString().toLowerCase();
  if (["disponible", "available", "on"].includes(v)) return "bg-[#DCFCE7] text-[#16A34A] border-green-200";
  if (["ocupado", "busy"].includes(v)) return "bg-[#FEF3C7] text-[#D97706] border-amber-200";
  return "bg-[#FEE2E2] text-[#DC2626] border-red-200";
};

const availabilityLabel = (status) => {
  const v = (status || "").toString().toLowerCase();
  if (["disponible", "available", "on"].includes(v)) return "Disponible";
  if (["ocupado", "busy"].includes(v)) return "Ocupado";
  return "No disponible";
};

const parsePayload = (payload) => {
  if (!payload) return {};
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch { return {}; }
  }
  return payload;
};

const JefeTecnicoView = ({
  stats,
  maintenances,
  availability = [],
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
      label: "Técnicos en campo",
      value: stats.tecnicosActivos || 0,
      icon: <FiUsers size={15} />,
      iconBg: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Alertas críticas",
      value: stats.alertas || 0,
      icon: <FiAlertTriangle size={15} />,
      iconBg: "bg-[#FEE2E2] text-[#DC2626]",
    },
    {
      label: "Cumplimiento mes",
      value: `${stats.cumplimiento || 0}%`,
      icon: <FiCheckSquare size={15} />,
      iconBg: "bg-[#DCFCE7] text-[#16A34A]",
    },
  ];

  return (
    <>
      <DashboardHeader
        title="Dirección Técnica"
        subtitle="Supervisión de operaciones, mantenimientos y equipo técnico"
        actions={
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors duration-150 active:scale-[0.97] cursor-pointer"
          >
            Actualizar
          </button>
        }
      />

      {/* Stats strip — una sola superficie con divisores, no gradient cards */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_2px_10px_rgba(0,0,0,0.06)] mb-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {statItems.map((item, i) => (
            <div
              key={i}
              className={`flex-1 flex items-center gap-4 px-6 py-5 ${
                i > 0 ? "border-t sm:border-t-0 sm:border-l border-[#F3F4F6]" : ""
              }`}
            >
              <div className={`p-2.5 rounded-xl ${item.iconBg} shrink-0`}>
                {item.icon}
              </div>
              <div>
                <p className="text-xs font-medium text-[#6B7280] leading-tight">{item.label}</p>
                <p className="mt-0.5 text-2xl font-bold text-[#111827] tabular-nums">{item.value ?? "—"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contenido principal en dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Columna izquierda: aprobaciones + mantenimientos + solicitudes */}
        <div className="lg:col-span-2 space-y-6">
          <PendingApprovals onActionComplete={onRefresh} />

          <Card className="p-5">
            <SectionTitle title="Resumen de mantenimientos" />
            <div className="overflow-x-auto mt-1">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-xs font-medium text-[#6B7280] uppercase tracking-wide border-b border-[#F3F4F6]">
                    <th className="px-4 py-3">Equipo</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Responsable</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F9FAFB]">
                  {maintenances && maintenances.length > 0 ? (
                    maintenances.slice(0, 5).map((m) => (
                      <tr key={m.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-4 py-3 font-medium text-[#111827]">{m.equipo_nombre}</td>
                        <td className="px-4 py-3 text-[#374151]">{m.tipo}</td>
                        <td className="px-4 py-3 text-[#374151]">{m.responsable || "Sin asignar"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              m.estado === "completado"
                                ? "bg-[#DCFCE7] text-[#16A34A]"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {m.estado}
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

        {/* Columna derecha: acciones de workspace + disponibilidad */}
        <div className="space-y-6">

          {/* Accesos rápidos — solo módulos sin entrada en la barra de navegación */}
          <Card className="p-5">
            <SectionTitle title="Accesos rápidos" />
            <p className="text-xs text-[#6B7280] mt-1 mb-4">
              Módulos operativos del área técnica.
            </p>
            <div className="space-y-2">
              <button
                onClick={onOpenWithdrawals}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#FEF3C7] hover:bg-amber-100 text-sm font-medium text-[#D97706] transition-colors duration-150 cursor-pointer active:scale-[0.97]"
              >
                <FiTruck size={15} className="shrink-0" />
                Retiros F.ST-11
              </button>
              <button
                onClick={() => navigate("/dashboard/servicio-tecnico/casos-externos")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F9FAFB] hover:bg-[#F3F4F6] text-sm font-medium text-[#374151] transition-colors duration-150 cursor-pointer active:scale-[0.97]"
              >
                <FiExternalLink size={15} className="text-[#6B7280] shrink-0" />
                Integración ST-01-04
              </button>
            </div>
          </Card>

          {/* Disponibilidad de equipo */}
          <Card className="p-5">
            <SectionTitle title="Disponibilidad de equipo" />
            <div className="space-y-2 mt-3">
              {availability && availability.length > 0 ? (
                availability.map((member) => (
                  <div
                    key={member.id || member.userId || member.name}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${availabilityColor(member.status)}`}
                  >
                    <div>
                      <p className="text-sm font-medium">
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
                <p className="text-sm text-[#9CA3AF]">Sin información de disponibilidad.</p>
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

export default JefeTecnicoView;
