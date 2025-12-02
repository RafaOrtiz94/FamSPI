import React from "react";
import { useNavigate } from "react-router-dom";
import {
    FiTool,
    FiCalendar,
    FiCheckCircle,
} from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";

import { DashboardHeader, SectionTitle } from "../../../../core/ui/layouts/DashboardLayout";
import AttendanceWidget from "../../../shared/components/AttendanceWidget";

const availabilityLabel = (status) => {
    const value = (status || "").toString().toLowerCase();
    if (["disponible", "available", "on"].includes(value)) return "Disponible";
    if (["ocupado", "busy"].includes(value)) return "Ocupado";
    return "No disponible";
};

const availabilityColor = (status) => {
    const value = (status || "").toString().toLowerCase();
    if (["disponible", "available", "on"].includes(value)) return "bg-green-50 text-green-700 border-green-200";
    if (["ocupado", "busy"].includes(value)) return "bg-yellow-50 text-yellow-700 border-yellow-200";
    return "bg-red-50 text-red-700 border-red-200";
};

const TecnicoView = ({ stats, myMaintenances, availability, teamAvailability = [], onAvailabilityChange, onRefresh }) => {
    const navigate = useNavigate();

    const currentStatus = availability?.status || "no_disponible";
    const formattedStatus = availabilityLabel(currentStatus);
    const nextStatus = currentStatus === "disponible" ? "no_disponible" : "disponible";

    return (
        <>
            <DashboardHeader
                title="Panel Técnico"
                subtitle="Mis asignaciones y reportes"
                actions={
                    <button
                        onClick={onRefresh}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
                    >
                        Actualizar
                    </button>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className={`flex items-center justify-between p-4 rounded-xl border ${availabilityColor(currentStatus)}`}>
                    <div>
                        <p className="text-sm text-gray-500">Estado de disponibilidad</p>
                        <p className="text-lg font-semibold">{formattedStatus}</p>
                        <p className="text-xs text-gray-500 mt-1">
                            Tus jefes verán este estado en tiempo real.
                        </p>
                    </div>
                    <button
                        onClick={() => onAvailabilityChange?.(nextStatus)}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
                    >
                        Marcar {nextStatus === "disponible" ? "disponible" : "no disponible"}
                    </button>
                </div>

                <AttendanceWidget />
            </div>

            <Card className="p-5 mb-6">
                <SectionTitle title="Disponibilidad del equipo" />
                <div className="space-y-2">
                    {teamAvailability && teamAvailability.length > 0 ? (
                        teamAvailability.map((member) => (
                            <div
                                key={member.id || member.userId || member.name}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg border ${availabilityColor(member.status)}`}
                            >
                                <div>
                                    <p className="text-sm font-semibold">{member.name || member.fullname || "Técnico"}</p>
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
                        <p className="text-sm text-gray-500">Sin datos de disponibilidad del equipo.</p>
                    )}
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-blue-500"
                    onClick={() => navigate("/dashboard/servicio-tecnico/mantenimientos")}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                            <FiTool size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Mis Mantenimientos</h3>
                            <p className="text-sm text-gray-500">{stats.myPending || 0} pendientes</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-green-500"
                    onClick={() => navigate("/dashboard/servicio-tecnico/calendario")}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-full text-green-600">
                            <FiCalendar size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Mi Calendario</h3>
                            <p className="text-sm text-gray-500">Ver agenda</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-gray-500"
                    onClick={() => navigate("/dashboard/servicio-tecnico/historial")}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gray-100 rounded-full text-gray-600">
                            <FiCheckCircle size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Historial</h3>
                            <p className="text-sm text-gray-500">Trabajos completados</p>
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="p-5">
                <SectionTitle title="Mis Asignaciones Pendientes" />
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th className="px-4 py-3">ID</th>
                                <th className="px-4 py-3">Equipo</th>
                                <th className="px-4 py-3">Tipo</th>
                                <th className="px-4 py-3">Fecha Programada</th>
                                <th className="px-4 py-3">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {myMaintenances && myMaintenances.length > 0 ? (
                                myMaintenances.map((m) => (
                                    <tr key={m.id} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium">#{m.id}</td>
                                        <td className="px-4 py-3">{m.equipo_nombre}</td>
                                        <td className="px-4 py-3">{m.tipo}</td>
                                        <td className="px-4 py-3">{new Date(m.fecha).toLocaleDateString()}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => navigate(`/dashboard/servicio-tecnico/mantenimientos/${m.id}`)}
                                                className="text-blue-600 hover:underline"
                                            >
                                                Iniciar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-4 py-3 text-center text-gray-500">
                                        No tienes mantenimientos pendientes asignados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </>
    );
};

export default TecnicoView;
