import React from "react";
import { useNavigate } from "react-router-dom";
import { FiBox, FiTruck, FiSearch, FiClipboard } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import { DashboardHeader } from "../../../shared/components/DashboardComponents";
import PurchaseHandoffWidget from "../PurchaseHandoffWidget";

const BackofficeView = ({ onRefresh }) => {
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card
                    className="p-4 cursor-pointer hover:shadow-sm transition border border-gray-200"
                    onClick={() => navigate("/dashboard/comercial/inventario")}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-md text-indigo-600">
                            <FiBox size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Inventario</p>
                            <p className="text-xs text-gray-500">Control y stock</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-4 cursor-pointer hover:shadow-sm transition border border-gray-200"
                    onClick={() => navigate("/dashboard/comercial/logistica")}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-50 rounded-md text-teal-600">
                            <FiTruck size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Logística</p>
                            <p className="text-xs text-gray-500">Despachos y envíos</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-4 cursor-pointer hover:shadow-sm transition border border-gray-200"
                    onClick={() => navigate("/dashboard/comercial/solicitudes")}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-50 rounded-md text-orange-600">
                            <FiSearch size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Solicitudes</p>
                            <p className="text-xs text-gray-500">Módulo dedicado</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-md text-blue-600">
                            <FiClipboard size={18} />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">Solicitud de compra</p>
                            <p className="text-xs text-gray-500">Handoff hacia ACP</p>
                        </div>
                        <PurchaseHandoffWidget />
                    </div>
                </Card>
            </div>
        </>
    );
};

export default BackofficeView;
