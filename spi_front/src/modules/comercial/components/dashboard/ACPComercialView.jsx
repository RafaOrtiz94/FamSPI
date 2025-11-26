import React from "react";
import { useNavigate } from "react-router-dom";
import { FiPhone, FiUserCheck, FiFileText, FiClipboard } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";

import { DashboardHeader } from "../../../shared/components/DashboardComponents";
import EquipmentPurchaseWidget from "../EquipmentPurchaseWidget";
import PurchaseHandoffWidget from "../PurchaseHandoffWidget";

const ACPComercialView = ({ onRefresh }) => {
    const navigate = useNavigate();

    return (
        <>
            <DashboardHeader
                title="ACP Comercial"
                subtitle="Atención al Cliente y Soporte Comercial"
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
                    onClick={() => navigate("/dashboard/comercial/clientes")}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-pink-50 rounded-md text-pink-600">
                            <FiPhone size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Clientes</p>
                            <p className="text-xs text-gray-500">Seguimiento y contacto</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-4 cursor-pointer hover:shadow-sm transition border border-gray-200"
                    onClick={() => navigate("/dashboard/comercial/equipment-purchases")}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-50 rounded-md text-cyan-600">
                            <FiFileText size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Procesos de compra</p>
                            <p className="text-xs text-gray-500">Seguimiento de equipos</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-4 cursor-pointer hover:shadow-sm transition border border-gray-200"
                    onClick={() => navigate("/dashboard/comercial/solicitudes")}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-md text-blue-600">
                            <FiClipboard size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Solicitudes</p>
                            <p className="text-xs text-gray-500">Módulo dedicado</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-4 cursor-pointer hover:shadow-sm transition border border-gray-200"
                    onClick={() => navigate("/dashboard/comercial/prospectos")}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-lime-50 rounded-md text-lime-600">
                            <FiUserCheck size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Prospectos</p>
                            <p className="text-xs text-gray-500">Validación</p>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-4 border border-gray-200">
                    <PurchaseHandoffWidget />
                </Card>

                <Card className="p-4 border border-gray-200">
                    <EquipmentPurchaseWidget showCreation={false} />
                </Card>
            </div>
        </>
    );
};

export default ACPComercialView;
