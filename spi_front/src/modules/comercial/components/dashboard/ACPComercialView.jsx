import React from "react";
import { useNavigate } from "react-router-dom";
import {
    FiPhone,
    FiUserCheck,
    FiFileText,
} from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";

import { DashboardHeader, SectionTitle } from "../../../shared/components/DashboardComponents";
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-pink-500"
                    onClick={() => navigate("/dashboard/comercial/clientes")}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-pink-100 rounded-full text-pink-600">
                            <FiPhone size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Atención Clientes</h3>
                            <p className="text-sm text-gray-500">Seguimiento y contacto</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-cyan-500"
                    onClick={() => navigate("/dashboard/comercial/equipment-purchases")}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-cyan-100 rounded-full text-cyan-600">
                            <FiFileText size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Procesos de compra</h3>
                            <p className="text-sm text-gray-500">Seguimiento de equipos</p>
                        </div>
                    </div>
                </Card>

                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-lime-500"
                    onClick={() => navigate("/dashboard/comercial/prospectos")} // Placeholder route
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-lime-100 rounded-full text-lime-600">
                            <FiUserCheck size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Prospectos</h3>
                            <p className="text-sm text-gray-500">Validación de datos</p>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="mt-6 space-y-6">
                <Card className="p-5">
                    <SectionTitle title="Nueva solicitud desde Comercial" />
                    <PurchaseHandoffWidget />
                </Card>

                <Card className="p-5">
                    <SectionTitle title="Proceso de compra de equipos" />
                    <EquipmentPurchaseWidget showCreation={false} />
                </Card>
            </div>
        </>
    );
};

export default ACPComercialView;
