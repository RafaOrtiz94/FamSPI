import React from "react";
import { FiTrendingUp, FiUsers, FiClipboard, FiPackage } from "react-icons/fi";
import ExecutiveStatCard from "../../../../core/ui/components/ExecutiveStatCard";
import Card from "../../../../core/ui/components/Card";

import { DashboardHeader } from "../../../../core/ui/layouts/DashboardLayout";
import PurchaseHandoffWidget from "../PurchaseHandoffWidget";
import PersonnelRequestWidget from "../../../../core/ui/widgets/PersonnelRequestWidget";
import VacationRequestsWidget from "../../../../core/ui/widgets/VacationRequestsWidget";
import ScheduleApprovalWidget from "../schedules/ScheduleApprovalWidget";

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

                <ScheduleApprovalWidget />
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
