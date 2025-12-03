import React, { useCallback } from "react";
import {
    FiDollarSign,
    FiTrendingUp,
    FiCreditCard,
    FiPieChart,
    FiRefreshCw,
} from "react-icons/fi";

import Card from "../../core/ui/components/Card";
import ActionCard from "../../core/ui/patterns/ActionCard";
import AttendanceWidget from "../../core/ui/widgets/AttendanceWidget";
import ClientRequestWidget from "../../core/ui/widgets/ClientRequestWidget";
import { DashboardLayout, DashboardHeader } from "../../core/ui/layouts/DashboardLayout";

const DashboardFinanzas = () => {
    const handleRefresh = useCallback(() => { }, []);

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
                <ActionCard
                    icon={FiDollarSign}
                    subtitle="Finanzas"
                    title="Ingresos"
                    color="blue"
                />
                <ActionCard
                    icon={FiPieChart}
                    subtitle="Control"
                    title="Presupuestos"
                    color="emerald"
                />
                <ActionCard
                    icon={FiCreditCard}
                    subtitle="Pagos"
                    title="Egresos"
                    color="indigo"
                />
                <ActionCard
                    icon={FiTrendingUp}
                    subtitle="Análisis"
                    title="Reportes"
                    color="orange"
                />
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
