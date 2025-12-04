import React, { useState } from "react";
import BaseSolicitudesView from "../../../shared/solicitudes/BaseSolicitudesView";
import { servicioActionCards, servicioFilterConfig } from "../../config/solicitudesConfig";
import { useSolicitudes } from "../../../shared/solicitudes/hooks/useSolicitudes";
import { useModalManager } from "../../../shared/solicitudes/hooks/useModalManager";
import { getRequests } from "../../../../core/api/requestsApi";
import PermisoVacacionModal from "../../../shared/solicitudes/modals/PermisoVacacionModal";
import OrdenServicioModal from "./modals/OrdenServicioModal";
import RequerimientoRepuestosModal from "./modals/RequerimientoRepuestosModal";
import InspeccionModal from "./modals/InspeccionModal";
import PrestamoEquiposModal from "./modals/PrestamoEquiposModal";

/**
 * Vista de solicitudes para Jefe de Servicio Técnico
 * Tiene acceso completo a todas las funcionalidades
 */
const JefeTecnicoSolicitudesView = () => {
    const [filters, setFilters] = useState({});

    const { solicitudes, loading, reload } = useSolicitudes({
        fetchFunction: async (filters) => {
            const response = await getRequests({
                page: 1,
                limit: 100,
                ...filters
            });
            return response;
        },
        parseResponse: (res) => res.rows || res.data || [],
        defaultFilters: {},
        autoLoad: true
    });

    const { openModal, closeModal, isOpen } = useModalManager();

    const handleActionCardClick = (cardId) => {
        openModal(cardId);
    };

    const handleFilterChange = (newFilters) => {
        setFilters(newFilters);
    };

    const handleModalSuccess = () => {
        reload();
    };

    return (
        <>
            <BaseSolicitudesView
                // Action Cards
                actionCards={servicioActionCards}
                onActionCardClick={handleActionCardClick}

                // Filtros
                enableFilters={true}
                filterConfig={servicioFilterConfig}
                filters={filters}
                onFilterChange={handleFilterChange}
                onRefresh={reload}

                // Grid
                enableGrid={true}
                solicitudes={solicitudes}
                loading={loading}

                // Títulos personalizados
                createSectionTitle="Crear Nueva Solicitud"
                createSectionSubtitle="Selecciona el tipo de solicitud de servicio técnico"
                filtersSectionTitle="Buscar Solicitudes"
                filtersSectionSubtitle="Filtra y encuentra solicitudes del equipo"
                gridSectionTitle="Todas las Solicitudes del Área"
                gridSectionSubtitle="Listado completo de solicitudes de Servicio Técnico"
            />

            {/* Modales específicos de Servicio Técnico */}
            <OrdenServicioModal
                open={isOpen("orden-servicio")}
                onClose={() => closeModal("orden-servicio")}
                onSuccess={handleModalSuccess}
            />

            <RequerimientoRepuestosModal
                open={isOpen("repuestos")}
                onClose={() => closeModal("repuestos")}
                onSuccess={handleModalSuccess}
            />

            <InspeccionModal
                open={isOpen("inspeccion")}
                onClose={() => closeModal("inspeccion")}
                onSuccess={handleModalSuccess}
            />

            <PrestamoEquiposModal
                open={isOpen("prestamo")}
                onClose={() => closeModal("prestamo")}
                onSuccess={handleModalSuccess}
            />

            <PermisoVacacionModal
                open={isOpen("vacaciones")}
                onClose={() => closeModal("vacaciones")}
                onSuccess={handleModalSuccess}
            />
        </>
    );
};

export default JefeTecnicoSolicitudesView;
