import React, { useEffect } from "react";

import { DashboardLayout, DashboardHeader } from "../../../core/ui/layouts/DashboardLayout";
import ClientRequestWidget from "../../../core/ui/widgets/ClientRequestWidget";
import PermisosStatusWidget from "../../shared/solicitudes/components/PermisosStatusWidget";
import HRPersonnelRequestsWidget from "../../../core/ui/widgets/HRPersonnelRequestsWidget";

const TalentoSolicitudes = () => {
    console.log("[HR_UI][FASE2] entering Solicitudes");

    useEffect(() => {
        console.log("[HR_UI][FASE3] lazy page loaded: Solicitudes");
    }, []);

    return (
        <DashboardLayout includeWidgets={false}>
            <DashboardHeader
                title="Solicitudes de Talento Humano"
                subtitle="Gestión de solicitudes, permisos y requerimientos de personal"
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <ClientRequestWidget />
                    <PermisosStatusWidget />
                </div>
                <div>
                    <HRPersonnelRequestsWidget />
                </div>
            </div>
        </DashboardLayout>
    );
};

export default TalentoSolicitudes;