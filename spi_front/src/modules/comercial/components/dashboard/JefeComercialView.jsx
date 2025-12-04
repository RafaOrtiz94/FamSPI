import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiTrendingUp, FiUsers, FiClipboard, FiPackage, FiCalendar } from "react-icons/fi";
import ExecutiveStatCard from "../../../../core/ui/components/ExecutiveStatCard";
import Card from "../../../../core/ui/components/Card";

import { DashboardHeader } from "../../../../core/ui/layouts/DashboardLayout";
import PurchaseHandoffWidget from "../PurchaseHandoffWidget";
import PersonnelRequestWidget from "../../../../core/ui/widgets/PersonnelRequestWidget";
import VacationRequestsWidget from "../../../../core/ui/widgets/VacationRequestsWidget";
import { fetchPendingSchedules } from "../../../../core/api/schedulesApi";

const JefeComercialView = ({ onRefresh }) => {
    const navigate = useNavigate();
    const [pendingPlans, setPendingPlans] = useState(0);

    useEffect(() => {
        fetchPendingSchedules()
            .then((data) => setPendingPlans(Array.isArray(data) ? data.length : 0))
            .catch(() => setPendingPlans(0));
    }, []);

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

            <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-md text-blue-600">
                            <FiClipboard size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Solicitudes</p>
                            <p className="text-xs text-gray-500">Gestionar en el módulo</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-50 rounded-md text-amber-600">
                            <FiPackage size={18} />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">Solicitud de compra</p>
                            <p className="text-xs text-gray-500">Derivar a ACP</p>
                        </div>
                        <PurchaseHandoffWidget />
                    </div>
                </Card>

                <Card className="p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 rounded-md text-purple-600">
                            <FiCalendar size={18} />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">Aprobaciones de planificaciones</p>
                            <p className="text-xs text-gray-500">
                                {pendingPlans} cronogramas pendientes por revisar (solo revisión y aprobación)
                            </p>
                        </div>
                        <button
                            className="px-3 py-1 text-sm font-semibold text-purple-700 border border-purple-200 rounded-md hover:bg-purple-50"
                            onClick={() => navigate("/dashboard/comercial/aprobaciones-planificacion")}
                        >
                            Ver aprobaciones
                        </button>
                    </div>
                </Card>
            </div>

            {/* Widget de Solicitudes de Personal */}
            <div className="mt-6">
                <PersonnelRequestWidget />
            </div>

            <div className="mt-6">
                <VacationRequestsWidget />
            </div>

        </>
    );
};

export default JefeComercialView;
