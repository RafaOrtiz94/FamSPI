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
                <button className="group relative flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white p-4 shadow-sm transition-all duration-200 hover:border-blue-400 hover:shadow-md">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm transition-transform duration-200 group-hover:scale-110">
                        <FiDollarSign size={32} />
                    </div>
                    <div className="text-center">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 opacity-70">
                            Finanzas
                        </p>
                        <h3 className="text-sm font-bold leading-tight text-gray-900">
                            Ingresos
                        </h3>
                    </div>
                </button>

                <button className="group relative flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-4 shadow-sm transition-all duration-200 hover:border-emerald-400 hover:shadow-md">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm transition-transform duration-200 group-hover:scale-110">
                        <FiPieChart size={32} />
                    </div>
                    <div className="text-center">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 opacity-70">
                            Control
                        </p>
                        <h3 className="text-sm font-bold leading-tight text-gray-900">
                            Presupuestos
                        </h3>
                    </div>
                </button>

                <button className="group relative flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-white p-4 shadow-sm transition-all duration-200 hover:border-indigo-400 hover:shadow-md">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm transition-transform duration-200 group-hover:scale-110">
                        <FiCreditCard size={32} />
                    </div>
                    <div className="text-center">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 opacity-70">
                            Pagos
                        </p>
                        <h3 className="text-sm font-bold leading-tight text-gray-900">
                            Egresos
                        </h3>
                    </div>
                </button>

                <button className="group relative flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-white p-4 shadow-sm transition-all duration-200 hover:border-orange-400 hover:shadow-md">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-sm transition-transform duration-200 group-hover:scale-110">
                        <FiTrendingUp size={32} />
                    </div>
                    <div className="text-center">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-orange-700 opacity-70">
                            Análisis
                        </p>
                        <h3 className="text-sm font-bold leading-tight text-gray-900">
                            Reportes
                        </h3>
                    </div>
                </button>
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
