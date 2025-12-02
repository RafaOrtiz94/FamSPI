import React from "react";
import {
    FiTool,
    FiUsers,
    FiAlertTriangle,
    FiCheckSquare,
} from "react-icons/fi";
import ExecutiveStatCard from "../../../../core/ui/components/ExecutiveStatCard";
import Card from "../../../../core/ui/components/Card";

import { DashboardHeader, SectionTitle } from "../../../../core/ui/layouts/DashboardLayout";
import PendingApprovals from "../../components/PendingApprovals";
import PersonnelRequestWidget from "../../../shared/components/PersonnelRequestWidget";
import AttendanceWidget from "../../../shared/components/AttendanceWidget";
import VacationRequestsWidget from "../../../shared/components/VacationRequestsWidget";

const availabilityColor = (status) => {
    const value = (status || "").toString().toLowerCase();
    if (["disponible", "available", "on"].includes(value)) return "bg-green-50 text-green-700 border-green-200";
    if (["ocupado", "busy"].includes(value)) return "bg-yellow-50 text-yellow-700 border-yellow-200";
    return "bg-red-50 text-red-700 border-red-200";
};

const availabilityLabel = (status) => {
    const value = (status || "").toString().toLowerCase();
    if (["disponible", "available", "on"].includes(value)) return "Disponible";
    if (["ocupado", "busy"].includes(value)) return "Ocupado";
    return "No disponible";
};

const JefeTecnicoView = ({ stats, maintenances, approvals, availability = [], onRefresh }) => {
    return (
        <>
            <DashboardHeader
                title="Dirección Técnica"
                subtitle="Supervisión de operaciones, mantenimientos y equipo técnico"
                actions={
                    <button
                        onClick={onRefresh}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
                    >
                        Actualizar
                    </button>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <AttendanceWidget />
                <PersonnelRequestWidget />
                <VacationRequestsWidget />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <ExecutiveStatCard
                    label="Mantenimientos Activos"
                    value={stats.pendientes}
                    icon={<FiTool size={20} />}
                    from="from-blue-600"
                    to="to-blue-500"
                />
                <ExecutiveStatCard
                    label="Técnicos en Campo"
                    value={stats.tecnicosActivos || 0}
                    icon={<FiUsers size={20} />}
                    from="from-indigo-600"
                    to="to-indigo-500"
                />
                <ExecutiveStatCard
                    label="Alertas Críticas"
                    value={stats.alertas || 0}
                    icon={<FiAlertTriangle size={20} />}
                    from="from-red-600"
                    to="to-red-500"
                />
                <ExecutiveStatCard
                    label="Cumplimiento Mes"
                    value={`${stats.cumplimiento || 0}%`}
                    icon={<FiCheckSquare size={20} />}
                    from="from-green-600"
                    to="to-green-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <PendingApprovals onActionComplete={onRefresh} />

                    <Card className="p-5">
                        <SectionTitle title="Resumen de Mantenimientos" />
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3">Equipo</th>
                                        <th className="px-4 py-3">Tipo</th>
                                        <th className="px-4 py-3">Responsable</th>
                                        <th className="px-4 py-3">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {maintenances && maintenances.length > 0 ? (
                                        maintenances.slice(0, 5).map((m) => (
                                            <tr key={m.id} className="border-b hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium">{m.equipo_nombre}</td>
                                                <td className="px-4 py-3">{m.tipo}</td>
                                                <td className="px-4 py-3">{m.responsable || "Sin asignar"}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                             ${m.estado === 'completado' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                                        {m.estado}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="4" className="px-4 py-3 text-center text-gray-500">
                                                No hay mantenimientos recientes.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="p-5">
                        <SectionTitle title="Disponibilidad de Equipo" />
                        <div className="space-y-3">
                            {availability && availability.length > 0 ? (
                                availability.map((member) => (
                                    <div
                                        key={member.id || member.userId || member.name}
                                        className={`flex items-center justify-between p-2 rounded border ${availabilityColor(member.status)}`}
                                    >
                                        <div>
                                            <p className="text-sm font-medium">{member.name || member.fullname || "Técnico"}</p>
                                            {member.updatedAt && (
                                                <p className="text-xs text-gray-500">
                                                    Actualizado {new Date(member.updatedAt).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-xs font-medium">{availabilityLabel(member.status)}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500">Sin información de disponibilidad.</p>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

        </>
    );
};

export default JefeTecnicoView;
