import React from "react";
import { useNavigate } from "react-router-dom";
import {
    FiBox,
    FiClipboard,
    FiTruck,
    FiSearch,
} from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import AttendanceWidget from "../../../shared/components/AttendanceWidget";
import { DashboardHeader, SectionTitle } from "../../../shared/components/DashboardComponents";

const BackofficeView = ({ stats, recentRequests, loading, onRefresh }) => {
    const navigate = useNavigate();

    return (
        <>
            <DashboardHeader
                title="Backoffice Comercial"
                subtitle="Gestión administrativa, inventario y logística"
                actions={
                    <button
                        onClick={onRefresh}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
                    >
                        Actualizar
                    </button>
                }
            />

            <AttendanceWidget />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-indigo-500"
                    onClick={() => navigate("/dashboard/comercial/inventario")}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
                            <FiBox size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Inventario General</h3>
                            <p className="text-sm text-gray-500">Control de stock</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-orange-500"
                    onClick={() => navigate("/dashboard/comercial/solicitudes")}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-100 rounded-full text-orange-600">
                            <FiClipboard size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Procesar Pedidos</h3>
                            <p className="text-sm text-gray-500">Solicitudes pendientes</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-teal-500"
                    onClick={() => navigate("/dashboard/comercial/logistica")} // Assuming this route might exist or map to requests
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-teal-100 rounded-full text-teal-600">
                            <FiTruck size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Logística</h3>
                            <p className="text-sm text-gray-500">Despachos y envíos</p>
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="p-5">
                <SectionTitle title="Solicitudes Pendientes de Proceso" />
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th className="px-4 py-3">ID</th>
                                <th className="px-4 py-3">Solicitante</th>
                                <th className="px-4 py-3">Tipo</th>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Estado</th>
                                <th className="px-4 py-3">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentRequests && recentRequests.length > 0 ? (
                                recentRequests.map((req) => (
                                    <tr key={req.id} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium">#{req.id}</td>
                                        <td className="px-4 py-3">{req.solicitante || "Desconocido"}</td>
                                        <td className="px-4 py-3">{req.type_title || "Solicitud"}</td>
                                        <td className="px-4 py-3">{new Date(req.created_at).toLocaleDateString()}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => navigate(`/dashboard/comercial/solicitudes/${req.id}`)}
                                                className="text-blue-600 hover:underline"
                                            >
                                                Gestionar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-4 py-3 text-center text-gray-500">
                                        No hay solicitudes pendientes de proceso.
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

export default BackofficeView;
