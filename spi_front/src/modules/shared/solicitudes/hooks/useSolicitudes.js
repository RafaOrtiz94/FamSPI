import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Hook reutilizable para manejar estado y carga de solicitudes
 * @param {Object} config - Configuración del hook
 * @param {Function} config.fetchFunction - Función para obtener solicitudes del API
 * @param {Function} config.parseResponse - Función para parsear respuesta (opcional)
 * @param {Object} config.defaultFilters - Filtros por defecto (opcional)
 * @param {boolean} config.autoLoad - Si debe cargar automáticamente al montar (default: true)
 */
export const useSolicitudes = (config) => {
    const {
        fetchFunction,
        parseResponse,
        defaultFilters = {},
        autoLoad = true,
        dependencies = []
    } = config;

    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState(defaultFilters);
    const parseResponseRef = useRef(parseResponse);

    useEffect(() => {
        parseResponseRef.current = parseResponse;
    }, [parseResponse]);

    const dependencyValues = Array.isArray(dependencies) ? dependencies : [];

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetchFunction(filters);
            const parser = parseResponseRef.current;
            const parsed = parser ? parser(response) : response;
            setSolicitudes(Array.isArray(parsed) ? parsed : []);
        } catch (err) {
            console.error('Error loading solicitudes:', err);
            setError(err);
            setSolicitudes([]);
        } finally {
            setLoading(false);
        }
    }, [filters, fetchFunction, ...dependencyValues]);

    useEffect(() => {
        if (autoLoad) {
            load();
        }
    }, [load, autoLoad]);

    return {
        solicitudes,
        loading,
        error,
        filters,
        setFilters,
        reload: load
    };
};
