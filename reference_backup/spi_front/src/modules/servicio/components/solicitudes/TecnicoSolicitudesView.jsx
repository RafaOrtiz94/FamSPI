import React, { useState, useMemo } from "react";
import BaseSolicitudesView from "../../../shared/solicitudes/BaseSolicitudesView";
import { servicioActionCards, servicioFilterConfig } from "../../config/solicitudesConfig";
import { useSolicitudes } from "../../../shared/solicitudes/hooks/useSolicitudes";
import { useModalManager } from "../../../shared/solicitudes/hooks/useModalManager";
import { useAuth } from "../../../../core/auth/AuthContext";
import { getRequests } from "../../../../core/api/requestsApi";
import PermisoVacacionModal from "../../../shared/solicitudes/modals/PermisoVacacionModal";
import OrdenServicioModal from "./modals/OrdenServicioModal";
import RequerimientoRepuestosModal from "./modals/RequerimientoRepuestosModal";
import PrestamoEquiposModal from "./modals/PrestamoEquiposModal";
import RequestStatWidget from "../../../shared/solicitudes/components/RequestStatWidget";
import RequestsListModal from "../../../shared/solicitudes/components/RequestsListModal";
import { FiTool, FiPackage, FiSettings, FiCalendar } from "react-icons/fi";

/**
 * Vista de solicitudes para Técnico
 * Acceso limitado a action cards y solo ve sus propias solicitudes
 */
const TecnicoSolicitudesView = () => {
    const { user } = useAuth();
    const [filters, setFilters] = useState({});
    const [viewType, setViewType] = useState(null);
    const [viewTitle, setViewTitle] = useState("");

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
        autoLoad: false
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

    const handleViewList = (type, title) => {
        setViewType(type);
        setViewTitle(title);
    };

    // Widgets disponibles para técnico
    const statWidgets = [
        {
            id: 'orden-servicio',
            title: 'Mis Mantenimientos',
            icon: FiTool,
            color: 'blue',
            type: 'Orden de Servicio'
        },
        {
            id: 'repuestos',
            title: 'Mis Repuestos',
            icon: FiPackage,
            color: 'purple',
            type: 'compra'
        },
        {
            id: 'prestamo',
            title: 'Mis Préstamos',
            icon: FiSettings,
            color: 'indigo',
            type: 'Préstamo'
        },
        {
            id: 'vacaciones',
            title: 'Mis Vacaciones',
            icon: FiCalendar,
            color: 'orange',
            type: 'Vacaciones'
        }
    ];

    const statsSection = (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statWidgets.map(widget => (
                <RequestStatWidget
                    key={widget.id}
                    title={widget.title}
                    icon={widget.icon}
                    color={widget.color}
                    onClick={() => handleViewList(widget.type, widget.title)}
                />
            ))}
        </div>
    );

    return (
        <>
            <BaseSolicitudesView
                // Action Cards limitados
                actionCards={allowedActionCards}
                onActionCardClick={handleActionCardClick}

                // Desactivar filtros y grilla global
                enableFilters={false}
                enableGrid={false}

                // Secciones personalizadas
                customSections={[
                    {
                        id: "stats",
                        title: "Resumen de Mis Solicitudes",
                        subtitle: "Consulta tus solicitudes realizadas y asignadas",
                        content: statsSection
                    }
                ]}

                // Títulos personalizados
                createSectionTitle="Crear Nueva Solicitud"
                createSectionSubtitle="Selecciona el tipo de solicitud que deseas crear"
            />

            {/* Modal de Listado (con filtro automático de 'mine' en requestsApi probablemente, o el backend filtre por rol) */}
            <RequestsListModal
                open={!!viewType}
                onClose={() => setViewType(null)}
                type={viewType}
                title={viewTitle}
                initialFilters={{ mine: true }} // Forzar ver solo las mías
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

            <PermisoVacacionModal
                open={isOpen("vacaciones")}
                onClose={() => closeModal("vacaciones")}
                onSuccess={handleModalSuccess}
            />
        </>
    );
};

export default TecnicoSolicitudesView;
