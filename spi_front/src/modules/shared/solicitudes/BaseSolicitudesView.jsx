import React from "react";
import ActionCardsGrid from "./components/ActionCardsGrid";
import SolicitudesFilters from "./components/SolicitudesFilters";
import SolicitudesGrid from "./components/SolicitudesGrid";

/**
 * Componente base configurable para secciones de solicitudes
 * Proporciona una estructura estándar que puede ser personalizada por cada módulo
 */
const BaseSolicitudesView = ({
    // Action Cards
    actionCards = [],
    onActionCardClick,
    actionCardsColumns,

    // Widgets personalizados
    widgets = [],
    widgetsPosition = "before-filters", // 'before-filters' | 'after-filters' | 'after-grid'

    // Filtros
    enableFilters = false,
    filterConfig = {},
    filters = {},
    onFilterChange,
    onRefresh,

    // Grid de solicitudes
    enableGrid = false,
    solicitudes = [],
    loading = false,
    onView,
    onCancel,
    emptyMessage,

    // Secciones personalizadas
    customSections = [],

    // Títulos
    createSectionTitle = "Crear Nueva Solicitud",
    createSectionSubtitle = "Selecciona el tipo de solicitud que deseas crear",
    filtersSectionTitle = "Buscar Solicitudes",
    filtersSectionSubtitle = "Filtra y encuentra solicitudes específicas",
    gridSectionTitle = "Todas las Solicitudes",
    gridSectionSubtitle = "Listado completo de solicitudes registradas",
}) => {
    const renderWidgets = (position) => {
        if (widgetsPosition !== position) return null;
        return widgets.map((widget, index) => (
            <div key={`widget-${position}-${index}`}>{widget}</div>
        ));
    };

    return (
        <div className="space-y-8">
            {/* Sección de Creación de Solicitudes */}
            {actionCards.length > 0 && (
                <section>
                    <div className="mb-5">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                            {createSectionTitle}
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {createSectionSubtitle}
                        </p>
                    </div>
                    <ActionCardsGrid
                        cards={actionCards}
                        onClick={onActionCardClick}
                        columns={actionCardsColumns}
                    />
                </section>
            )}

            {/* Widgets (antes de filtros) */}
            {renderWidgets("before-filters")}

            {/* Sección de Filtros */}
            {enableFilters && (
                <section>
                    <div className="mb-5">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                            {filtersSectionTitle}
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {filtersSectionSubtitle}
                        </p>
                    </div>
                    <SolicitudesFilters
                        config={filterConfig}
                        filters={filters}
                        onChange={onFilterChange}
                        onRefresh={onRefresh}
                    />
                </section>
            )}

            {/* Widgets (después de filtros) */}
            {renderWidgets("after-filters")}

            {/* Grid de Solicitudes */}
            {enableGrid && (
                <section>
                    <div className="mb-5">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                            {gridSectionTitle}
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {gridSectionSubtitle}
                        </p>
                    </div>
                    {loading ? (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-12">
                            <div className="text-center">
                                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
                                <p className="text-gray-500 dark:text-gray-400">Cargando solicitudes...</p>
                            </div>
                        </div>
                    ) : (
                        <SolicitudesGrid
                            items={solicitudes}
                            onView={onView}
                            onCancel={onCancel}
                            emptyMessage={emptyMessage}
                        />
                    )}
                </section>
            )}

            {/* Widgets (después de grid) */}
            {renderWidgets("after-grid")}

            {/* Secciones Personalizadas */}
            {customSections.map((section) => (
                <section key={section.id}>
                    {section.title && (
                        <div className="mb-5">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                                {section.title}
                            </h2>
                            {section.subtitle && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {section.subtitle}
                                </p>
                            )}
                        </div>
                    )}
                    {section.content}
                </section>
            ))}
        </div>
    );
};

export default BaseSolicitudesView;
