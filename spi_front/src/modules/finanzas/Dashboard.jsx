import React from "react";
import { FiDollarSign, FiTrendingUp, FiCreditCard, FiPieChart } from "react-icons/fi";

import ExecutiveStatCard from "../../core/ui/components/ExecutiveStatCard";
import AttendanceWidget from "../shared/components/AttendanceWidget";
import ClientRequestWidget from "../shared/components/ClientRequestWidget";
import Card from "../../core/ui/components/Card";

const DashboardFinanzas = () => {
    return (
        <div className="p-6 space-y-6">
            {/* HEADER */}
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                    Dashboard Finanzas
                </h1>
                <p className="text-gray-500">
                    El dashboard de finanzas está en construcción. Próximamente incluirá:
                </p>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                    <li>• Control de ingresos y egresos</li>
                    <li>• Gestión presupuestaria</li>
                    <li>• Reportes financieros</li>
                    <li>• Análisis de costos</li>
                </ul>
            </header>

            {/* Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AttendanceWidget />
                <ClientRequestWidget />
            </div>
        </div>
    );
};

export default DashboardFinanzas;
