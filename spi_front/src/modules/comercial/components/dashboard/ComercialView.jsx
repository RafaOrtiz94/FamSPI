import React from "react";
import { useNavigate } from "react-router-dom";
import {
    FiPlus,
    FiList,
    FiUsers,
    FiPackage,
    FiClock,
} from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";

import { DashboardHeader, SectionTitle } from "../../../shared/components/DashboardComponents";

const ComercialView = ({ stats, recentRequests, loading, onRefresh }) => {
    const navigate = useNavigate();

    return (
        <>
            <DashboardHeader
                title="Mi Gestión Comercial"
                subtitle="Panel de control para asesores comerciales"
                actions={
                    <button
                        onClick={() => navigate("/dashboard/comercial/solicitudes/nueva")}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                    >
                        <FiPlus /> Nueva Solicitud
                    </button>
                }
            />



            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-blue-500"
                    onClick={() => navigate("/dashboard/comercial/solicitudes")}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                            <FiList size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Mis Solicitudes</h3>
                            <p className="text-sm text-gray-500">Ver historial y estado</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-green-500"
                    onClick={() => navigate("/dashboard/comercial/clientes")}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-full text-green-600">
                            <FiUsers size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Mis Clientes</h3>
                            <p className="text-sm text-gray-500">Gestionar cartera</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-purple-500"
                    onClick={() => navigate("/dashboard/comercial/inventario")}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-full text-purple-600">
                            <FiPackage size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Consultar Stock</h3>
                            <p className="text-sm text-gray-500">Ver disponibilidad</p>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card className="p-5">
                        <SectionTitle
                            title="Mis Solicitudes Recientes"
                            action={
                                <button
                                    onClick={() => navigate("/dashboard/comercial/solicitudes")}
                                    className="text-sm text-blue-600 hover:underline"
                                >
                                    Ver todas
                                </button>
                            }
                        />
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3">ID</th>
                                        <th className="px-4 py-3">Cliente</th>
                                        <th className="px-4 py-3">Tipo</th>
                                        <th className="px-4 py-3">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentRequests && recentRequests.length > 0 ? (
                                        recentRequests.slice(0, 5).map((req) => (
                                            <tr key={req.id} className="border-b hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium">#{req.id}</td>
                                                <td className="px-4 py-3">{req.cliente || "N/A"}</td>
                                                <td className="px-4 py-3">{req.type_title || "Solicitud"}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                            ${req.status === 'aprobado' ? 'bg-green-100 text-green-800' :
                                                            req.status === 'rechazado' ? 'bg-red-100 text-red-800' :
                                                                'bg-yellow-100 text-yellow-800'}`}>
                                                        {req.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="4" className="px-4 py-3 text-center text-gray-500">
                                                No tienes solicitudes recientes.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                <div>
                    <Card className="p-5 h-full">
                        <SectionTitle title="Resumen Rápido" />
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <span className="text-gray-600">Pendientes</span>
                                <span className="font-bold text-yellow-600">{stats.pending || 0}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <span className="text-gray-600">Aprobadas (Mes)</span>
                                <span className="font-bold text-green-600">{stats.aprobadas || 0}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <span className="text-gray-600">Total (Mes)</span>
                                <span className="font-bold text-blue-600">{stats.total || 0}</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </>
    );
};

export default ComercialView;
