import React from "react";
import { useAuth } from "../../../core/auth/AuthContext";
import ACPComercialSolicitudesView from "../components/solicitudes/ACPComercialSolicitudesView";
import ComercialSolicitudesView from "../components/solicitudes/ComercialSolicitudesView";

const SolicitudesPage = () => {
    const { user } = useAuth();

    const renderView = () => {
        const roleName = (user?.role_name || user?.role || "").toLowerCase();

        // Vista específica para ACP Comercial
        // Verificamos si incluye 'acp' para ser más robustos con variaciones
        if (roleName.includes('acp')) {
            return <ACPComercialSolicitudesView />;
        }

        // Vista por defecto para otros roles comerciales (Jefe, Asesor, etc.)
        return <ComercialSolicitudesView />;
    };

    return (
        <div className="container mx-auto px-4 py-6 max-w-7xl">
            {renderView()}
        </div>
    );
};

export default SolicitudesPage;
