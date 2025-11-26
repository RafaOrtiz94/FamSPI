import React from "react";
import { FiTrendingUp, FiUsers } from "react-icons/fi";
import ExecutiveStatCard from "../../../../core/ui/components/ExecutiveStatCard";
import Card from "../../../../core/ui/components/Card";

import { DashboardHeader, SectionTitle } from "../../../shared/components/DashboardComponents";
import PurchaseHandoffWidget from "../PurchaseHandoffWidget";

const JefeComercialView = ({ onRefresh }) => {
    return (
        <>
            <DashboardHeader
                title="Dashboard Gerencia Comercial"
                subtitle="Visión general del rendimiento comercial y equipo de ventas"
                actions={
                    <button
                        onClick={onRefresh}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
                    >
                        Actualizar
                    </button>
                }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <ExecutiveStatCard
                    icon={<FiTrendingUp size={22} />}
                    label="Crecimiento"
                    value="--"
                    from="from-blue-600"
                    to="to-blue-500"
                />
                <ExecutiveStatCard
                    icon={<FiUsers size={22} />}
                    label="Equipo Activo"
                    value="8"
                    from="from-purple-600"
                    to="to-purple-500"
                />
            </div>

            <Card className="p-5 mt-6">
                <SectionTitle
                    title="Gestiona las solicitudes en la sección dedicada"
                    action={<span className="text-sm text-gray-500">Ir al menú "Solicitudes"</span>}
                />
                <p className="text-sm text-gray-600 mt-2">
                    El monitoreo y la creación de solicitudes se centralizan en el apartado "Solicitudes" de la barra
                    de navegación para mantener el inicio enfocado en otros indicadores comerciales.
                </p>
            </Card>

            <Card className="p-5 mt-6">
                <SectionTitle title="Solicitud rápida de compra" />
                <PurchaseHandoffWidget />
            </Card>
        </>
    );
};

export default JefeComercialView;
