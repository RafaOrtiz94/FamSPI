import React, { useCallback } from "react";
import {
    FiDollarSign,
    FiTrendingUp,
    FiCreditCard,
    FiPieChart,
    FiRefreshCw,
} from "react-icons/fi";

import Card from "../../core/ui/components/Card";
import AttendanceWidget from "../shared/components/AttendanceWidget";
import ClientRequestWidget from "../shared/components/ClientRequestWidget";
import { DashboardLayout, DashboardHeader } from "../shared/components/DashboardComponents";

const DashboardFinanzas = () => {
    const handleRefresh = useCallback(() => {}, []);

    return (
        <DashboardLayout includeWidgets={false}>
            <DashboardHeader
                title="Dashboard Finanzas"
                subtitle="Consolidación de métricas financieras y seguimiento de solicitudes"
                actions={
                    <button
                        onClick={handleRefresh}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
                    >
                        <FiRefreshCw /> Actualizar
                    </button>
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 flex flex-col gap-2 border border-gray-200">
                    <div className="flex items-center gap-2 text-blue-600">
                        <FiDollarSign />
                        <span className="text-sm font-semibold text-gray-900">Ingresos</span>
                    </div>
                    <p className="text-sm text-gray-500">Consolidación mensual y cuentas por cobrar.</p>
                </Card>
                <Card className="p-4 flex flex-col gap-2 border border-gray-200">
                    <div className="flex items-center gap-2 text-emerald-600">
                        <FiPieChart />
                        <span className="text-sm font-semibold text-gray-900">Presupuestos</span>
                    </div>
                    <p className="text-sm text-gray-500">Control de partidas y ejecución presupuestaria.</p>
                </Card>
                <Card className="p-4 flex flex-col gap-2 border border-gray-200">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <FiCreditCard />
                        <span className="text-sm font-semibold text-gray-900">Egresos</span>
                    </div>
                    <p className="text-sm text-gray-500">Pagos programados y conciliaciones.</p>
                </Card>
                <Card className="p-4 flex flex-col gap-2 border border-gray-200">
                    <div className="flex items-center gap-2 text-orange-500">
                        <FiTrendingUp />
                        <span className="text-sm font-semibold text-gray-900">Reportes</span>
                    </div>
                    <p className="text-sm text-gray-500">Indicadores clave y auditorías.</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AttendanceWidget />
                <ClientRequestWidget />
            </div>

            <Card className="p-5 space-y-3">
                <h2 className="text-lg font-semibold text-gray-900">Próximas capacidades</h2>
                <p className="text-sm text-gray-600">
                    El dashboard de finanzas está en construcción. Próximamente incluirá:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>Control de ingresos y egresos</li>
                    <li>Gestión presupuestaria</li>
                    <li>Reportes financieros</li>
                    <li>Análisis de costos</li>
                </ul>
            </Card>
        </DashboardLayout>
    );
};

export default DashboardFinanzas;
