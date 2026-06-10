import React, { useCallback } from "react";
import {
    FiDollarSign,
    FiBookOpen,
    FiPieChart,
    FiRefreshCw,
    FiClipboard,
    FiShield,
    FiUser,
    FiBarChart2,
} from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";

import Card from "../../core/ui/components/Card";
import ActionCard from "../../core/ui/patterns/ActionCard";
import PermisosStatusWidget from "../shared/solicitudes/components/PermisosStatusWidget";
import { DashboardLayout, DashboardHeader } from "../../core/ui/layouts/DashboardLayout";

const DashboardFinanzas = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const handleRefresh = useCallback(() => { }, []);

    return (
        <DashboardLayout includeWidgets={false}>
            <DashboardHeader
                title="Dashboard Finanzas"
                subtitle="Consolidacion de metricas financieras y seguimiento de solicitudes"
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
                    title="Workspace Viaticos"
                    color="blue"
                    onClick={() => navigate("/dashboard/finanzas/viaticos")}
                />
                <ActionCard
                    icon={FiBarChart2}
                    subtitle="Activos TI"
                    title="Activos Tecnologicos"
                    color="indigo"
                    onClick={() => navigate("/dashboard/ti/activos")}
                />
                <ActionCard
                    icon={FiPieChart}
                    subtitle="Control"
                    title="Asistencia Reportes"
                    color="emerald"
                    onClick={() => navigate("/dashboard/talento-humano/asistencia-reportes")}
                />
                <ActionCard
                    icon={FiClipboard}
                    subtitle="Gestion"
                    title="Permisos y Vacaciones"
                    color="indigo"
                    onClick={() => navigate("/dashboard/talento-humano/permisos")}
                />
                <ActionCard
                    icon={FiShield}
                    subtitle="Cumplimiento"
                    title="Prep. Auditoria"
                    color="orange"
                    onClick={() => navigate("/dashboard/auditoria/preparacion")}
                />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <ActionCard
                    icon={FiBookOpen}
                    subtitle="Recursos"
                    title="Links de Interes"
                    color="blue"
                    onClick={() => navigate("/dashboard/links-interes")}
                />
                <ActionCard
                    icon={FiUser}
                    subtitle="Cuenta"
                    title="Mi Perfil"
                    color="emerald"
                    onClick={() => navigate("/dashboard/mi-perfil", { state: { backgroundLocation: location } })}
                />
            </div>

            <PermisosStatusWidget />

            <Card className="p-5 space-y-3">
                <h2 className="text-lg font-semibold text-gray-900">Enfoque del dashboard financiero</h2>
                <p className="text-sm text-gray-600">
                    Este panel centraliza accesos de control diario para Finanzas:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>Gestion y aprobacion de viaticos</li>
                    <li>Seguimiento de permisos y vacaciones</li>
                    <li>Control de asistencia y reportes</li>
                    <li>Acceso a preparacion de auditoria y recursos</li>
                </ul>
            </Card>
        </DashboardLayout>
    );
};

export default DashboardFinanzas;
