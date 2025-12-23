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
import RequestStatWidget from "../../../shared/solicitudes/components/RequestStatWidget";
import RequestsListModal from "../../../shared/solicitudes/components/RequestsListModal";
import { FiTool, FiPackage, FiClipboard, FiSettings, FiCalendar } from "react-icons/fi";

/**
 * Vista de solicitudes para Jefe de Servicio Técnico
 * Tiene acceso completo a todas las funcionalidades
 */
const JefeTecnicoSolicitudesView = () => {
    const [filters, setFilters] = useState({});
    const [viewType, setViewType] = useState(null); // 'orden-servicio', 'repuestos', etc.
    const [viewTitle, setViewTitle] = useState("");

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
        autoLoad: false // Desactivamos carga automática de la grilla global
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

    // Widgets de estadísticas definidos localmente
    const statWidgets = [
        {
            id: 'orden-servicio',
            title: 'Mantenimientos',
            icon: FiTool,
            color: 'blue',
            type: 'Orden de Servicio' // Debe coincidir con Title o Code en DB
        },
        {
            id: 'repuestos',
            title: 'Compras de Repuestos',
            icon: FiPackage,
            color: 'purple',
            type: 'compra'
        },
        {
            id: 'inspeccion',
            title: 'Inspecciones Técnicas',
            icon: FiClipboard,
            color: 'amber',
            type: 'inspeccion'
        },
        {
            id: 'prestamo',
            title: 'Préstamos de Equipos',
            icon: FiSettings,
            color: 'indigo',
            type: 'Préstamo'
        },
        {
            id: 'vacaciones',
            title: 'Vacaciones',
            icon: FiCalendar,
            color: 'orange',
            type: 'Vacaciones'
        }
    ];

    const statsSection = (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                // Action Cards
                actionCards={servicioActionCards}
                onActionCardClick={handleActionCardClick}

                // Desactivar filtros y grilla global
                enableFilters={false}
                enableGrid={false}

                // Secciones personalizadas
                customSections={[
                    {
                        id: "stats",
                        title: "Resumen de Solicitudes",
                        subtitle: "Consulta el historial de solicitudes por tipo",
                        content: statsSection
                    }
                ]}

                // Títulos personalizados
                createSectionTitle="Crear Nueva Solicitud"
                createSectionSubtitle="Selecciona el tipo de solicitud de servicio técnico"
            />

            {/* Modal de Listado de Solicitudes */}
            <RequestsListModal
                open={!!viewType}
                onClose={() => setViewType(null)}
                type={viewType}
                title={viewTitle}
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
