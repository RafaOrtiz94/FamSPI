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
import ClientRequestManagement from "../ClientRequestManagement";
import { DashboardHeader, SectionTitle } from "../../../shared/components/DashboardComponents";

const BackofficeView = ({ stats, loading, onRefresh }) => {
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
                <SectionTitle title="Gestión y Aprobación de Solicitudes" />
                <div className="mt-4">
                    <ClientRequestManagement />
                </div>
            </Card>
        </>
    );
};

export default BackofficeView;
