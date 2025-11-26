import React from "react";
import {
    FiTrendingUp,
    FiCheckCircle,
    FiXCircle,
    FiUsers,
    FiActivity,
} from "react-icons/fi";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import ExecutiveStatCard from "../../../../core/ui/components/ExecutiveStatCard";
import Card from "../../../../core/ui/components/Card";

import { DashboardHeader, SectionTitle } from "../../../shared/components/DashboardComponents";
import PurchaseHandoffWidget from "../PurchaseHandoffWidget";

const JefeComercialView = ({ stats, chartData, loading, onRefresh }) => {
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
                    label="Total Solicitudes"
                    value={stats.total}
                    from="from-blue-600"
                    to="to-blue-500"
                />
                <ExecutiveStatCard
                    icon={<FiCheckCircle size={22} />}
                    label="Aprobadas"
                    value={stats.aprobadas}
                    from="from-green-600"
                    to="to-green-500"
                />
                <ExecutiveStatCard
                    icon={<FiXCircle size={22} />}
                    label="Rechazadas"
                    value={stats.rechazadas}
                    from="from-rose-600"
                    to="to-pink-500"
                />
                <ExecutiveStatCard
                    icon={<FiUsers size={22} />}
                    label="Equipo Activo"
                    value="8" // Placeholder or real data if available
                    from="from-purple-600"
                    to="to-purple-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-5">
                    <SectionTitle title="Tendencia de Ventas" />
                    <div className="h-64">
                        {chartData?.line ? <Line data={chartData.line} options={{ maintainAspectRatio: false }} /> : <p>Cargando...</p>}
                    </div>
                </Card>
                <Card className="p-5">
                    <SectionTitle title="Distribución por Estado" />
                    <div className="h-64 flex justify-center">
                        {chartData?.doughnut ? <Doughnut data={chartData.doughnut} options={{ maintainAspectRatio: false }} /> : <p>Cargando...</p>}
                    </div>
                </Card>
            </div>

            <Card className="p-5 mt-6">
                <SectionTitle title="Solicitud rápida de compra" />
                <PurchaseHandoffWidget />
            </Card>
        </>
    );
};

export default JefeComercialView;
