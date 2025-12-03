import React from "react";
import { useAuth } from "../../../core/auth/AuthContext";
import JefeTecnicoSolicitudesView from "../components/solicitudes/JefeTecnicoSolicitudesView";
import TecnicoSolicitudesView from "../components/solicitudes/TecnicoSolicitudesView";

/**
 * Página de Solicitudes de Servicio Técnico
 * Renderiza vista específica según el rol del usuario
 */
const SolicitudesPage = () => {
  const { user } = useAuth();

  const renderView = () => {
    const role = (user?.role || user?.role_name || "").toLowerCase();

    // Vista para Jefe/Gerente/Director
    if (role.includes("jefe") || role.includes("gerente") || role.includes("director")) {
      return <JefeTecnicoSolicitudesView />;
    }

    // Vista por defecto para técnicos
    return <TecnicoSolicitudesView />;
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Solicitudes
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Gestiona y da seguimiento a todas las solicitudes de servicio técnico
        </p>
      </div>

      {renderView()}
    </div>
  );
};

export default SolicitudesPage;
