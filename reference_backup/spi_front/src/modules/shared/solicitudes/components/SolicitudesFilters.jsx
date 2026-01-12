import React from "react";
import { FiSearch, FiRefreshCw } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";

/**
 * Componente de filtros reutilizable para solicitudes
 * @param {Object} props
 * @param {Object} props.config - Configuración de filtros
 * @param {Object} props.filters - Valores actuales de filtros
 * @param {Function} props.onChange - Callback al cambiar filtros
 * @param {Function} props.onRefresh - Callback para refrescar datos
 */
const SolicitudesFilters = ({ config, filters = {}, onChange, onRefresh }) => {
    const {
        enableSearch = true,
        searchPlaceholder = "Buscar solicitudes...",
        statusFilter = { enabled: true, options: [] },
        customFilters = []
    } = config;

    const handleFilterChange = (key, value) => {
        onChange({ ...filters, [key]: value });
    };

    return (
        <Card className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Búsqueda por texto */}
                {enableSearch && (
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder={searchPlaceholder}
                            value={filters.query || ""}
                            onChange={(e) => handleFilterChange("query", e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>
                )}

                {/* Filtro por estado */}
                {statusFilter.enabled && (
                    <select
                        value={filters.status || "all"}
                        onChange={(e) => handleFilterChange("status", e.target.value)}
                        className="px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                    >
                        <option value="all">Todos los estados</option>
                        {statusFilter.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                )}

                {/* Filtros personalizados */}
                {customFilters.map((filter) => {
                    if (filter.type === "select") {
                        return (
                            <select
                                key={filter.id}
                                value={filters[filter.id] || "all"}
                                onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                                className="px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                            >
                                <option value="all">{filter.label}</option>
                                {filter.options?.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        );
                    }

                    if (filter.type === "date") {
                        return (
                            <input
                                key={filter.id}
                                type="date"
                                value={filters[filter.id] || ""}
                                onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                                className="px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        );
                    }

                    return null;
                })}

                {/* Botón de refresh */}
                {onRefresh && (
                    <Button
                        variant="secondary"
                        icon={FiRefreshCw}
                        onClick={onRefresh}
                        className="w-full"
                    >
                        Actualizar
                    </Button>
                )}
            </div>
        </Card>
    );
};

export default SolicitudesFilters;
