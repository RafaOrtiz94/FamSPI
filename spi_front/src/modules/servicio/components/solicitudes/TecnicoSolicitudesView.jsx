import React, { useState, useMemo } from "react";
import BaseSolicitudesView from "../../../shared/solicitudes/BaseSolicitudesView";
import { servicioActionCards, servicioFilterConfig } from "../../config/solicitudesConfig";
import { useSolicitudes } from "../../../shared/solicitudes/hooks/useSolicitudes";
import { useModalManager } from "../../../shared/solicitudes/hooks/useModalManager";
import { useAuth } from "../../../../core/auth/AuthContext";
import { getRequests } from "../../../../core/api/requestsApi";
import VacationRequestModal from "../../../shared/solicitudes/modals/VacationRequestModal";
import OrdenServicioModal from "./modals/OrdenServicioModal";
import RequerimientoRepuestosModal from "./modals/RequerimientoRepuestosModal";
import PrestamoEquiposModal from "./modals/PrestamoEquiposModal";

/**
 * Vista de solicitudes para Técnico
 * Acceso limitado a action cards y solo ve sus propias solicitudes
 */
const TecnicoSolicitudesView = () => {
    const { user } = useAuth();
    const [filters, setFilters] = useState({});

    // Action cards permitidos para técnicos
    const allowedCardIds = ["orden-servicio", "repuestos", "prestamo", "vacaciones"];
    const allowedActionCards = useMemo(
        () => servicioActionCards.filter(card => allowedCardIds.includes(card.id)),
        []
    );

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

    // Filtrar solo las solicitudes del técnico
    const misSolicitudes = useMemo(() => {
        if (!user) return [];
        return solicitudes.filter(s =>
            s.assigned_to_name === user.fullname ||
            s.assigned_to === user.fullname ||
            s.assigned_to_id === user.id ||
            s.created_by === user.id
        );
    }, [solicitudes, user]);

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
                // Action Cards limitados
                actionCards={allowedActionCards}
                onActionCardClick={handleActionCardClick}

                // Filtros simplificados (sin filtro de técnico)
                enableFilters={true}
                filterConfig={{
                    ...servicioFilterConfig,
                    customFilters: servicioFilterConfig.customFilters.filter(f => f.id !== 'technician')
                }}
                filters={filters}
                onFilterChange={handleFilterChange}
                onRefresh={reload}

                // Grid solo con mis solicitudes
                enableGrid={true}
                solicitudes={misSolicitudes}
                loading={loading}

                // Títulos personalizados
                createSectionTitle="Crear Nueva Solicitud"
                createSectionSubtitle="Selecciona el tipo de solicitud que deseas crear"
                filtersSectionTitle="Buscar Mis Solicitudes"
                filtersSectionSubtitle="Filtra y encuentra tus solicitudes"
                gridSectionTitle="Mis Solicitudes"
                gridSectionSubtitle="Listado de tus solicitudes asignadas y creadas"
                emptyMessage="No tienes solicitudes registradas"
            />

            {/* Modales permitidos para técnicos */}
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

            <PrestamoEquiposModal
                open={isOpen("prestamo")}
                onClose={() => closeModal("prestamo")}
                onSuccess={handleModalSuccess}
            />

            <VacationRequestModal
                open={isOpen("vacaciones")}
                onClose={() => closeModal("vacaciones")}
                onSuccess={handleModalSuccess}
            />
        </>
    );
};

export default TecnicoSolicitudesView;
