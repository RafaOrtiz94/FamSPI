import React from "react";
import { useAuth } from "../../../core/auth/AuthContext";
import ACPComercialSolicitudesView from "../components/solicitudes/ACPComercialSolicitudesView";
import ComercialSolicitudesView from "../components/solicitudes/ComercialSolicitudesView";

const SolicitudesPage = () => {
    const { user } = useAuth();

    // Determinar qué vista mostrar basado en el rol
    // Determinar qué vista mostrar basado en el rol
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
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Solicitudes
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Gestiona y da seguimiento a todas tus solicitudes
                </p>
            </div>

            {renderView()}
        </div>
    );
};

export default SolicitudesPage;
