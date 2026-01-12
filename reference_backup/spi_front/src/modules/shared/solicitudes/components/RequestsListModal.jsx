import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog } from '@headlessui/react';
import SolicitudesGrid from './SolicitudesGrid';
import { useSolicitudes } from '../hooks/useSolicitudes';
import { getRequests } from '../../../../core/api/requestsApi';

const RequestsListModal = ({
    open,
    onClose,
    type,
    title,
    initialFilters,
    customFetcher = null,
    onView
}) => {
    const memoizedInitialFilters = useMemo(() => ({
        ...(initialFilters || {}),
        mine: initialFilters?.mine ?? true,
    }), [initialFilters]);

    const fetchFunction = useCallback(async (filters) => {
        if (customFetcher) {
            return await customFetcher({ ...filters, ...memoizedInitialFilters });
        }
        const response = await getRequests({
            page: 1,
            limit: 100, // Or implement pagination inside modal
            type: type, // Filter by type
            ...filters,
            ...memoizedInitialFilters
        });
        return response;
    }, [type, customFetcher, memoizedInitialFilters]);

    const parseResponse = useCallback((res) => res.rows || res.data || [], []);

    const { solicitudes, loading, setFilters } = useSolicitudes({
        fetchFunction,
        parseResponse,
        defaultFilters: memoizedInitialFilters,
        autoLoad: open, // Only load when open
    });

    const [search, setSearch] = useState("");

    useEffect(() => {
        if (open) {
            setFilters(memoizedInitialFilters);
            setSearch("");
        }
    }, [open, setFilters, memoizedInitialFilters]);

    useEffect(() => {
        setFilters((prev) => {
            const next = { ...prev };
            if (search) {
                next.q = search;
            } else {
                delete next.q;
            }
            return next;
        });
    }, [search, setFilters]);

    if (!open) return null;

    return (
        <AnimatePresence>
            {open && (
                <Dialog open={open} onClose={onClose} className="fixed inset-0 z-50">
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center px-4 py-6 sm:px-6">
                            <Dialog.Panel className="w-full max-w-5xl">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl"
                                >
                                    <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
                                            <p className="text-gray-500 text-sm mt-1">Historial completo de solicitudes</p>
                                        </div>
                                        <button
                                            onClick={onClose}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                        >
                                            <FiX className="w-6 h-6 text-gray-500" />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900/50">
                                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="w-full">
                                                <label className="sr-only" htmlFor="request-search">
                                                    Buscar solicitudes
                                                </label>
                                                <input
                                                    id="request-search"
                                                    type="text"
                                                    value={search}
                                                    onChange={(event) => setSearch(event.target.value)}
                                                    placeholder="Buscar por cliente, ID o estado..."
                                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                                />
                                            </div>
                                            {search && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSearch("")}
                                                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                                                >
                                                    Limpiar
                                                </button>
                                            )}
                                        </div>
                                        {loading ? (
                                            <div className="flex items-center justify-center h-full">
                                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                                            </div>
                                        ) : (
                                            <SolicitudesGrid
                                                items={solicitudes}
                                                emptyMessage="No se encontraron solicitudes de este tipo"
                                                onView={onView}
                                                variant={type}
                                            />
                                        )}
                                    </div>
                                </motion.div>
                            </Dialog.Panel>
                        </div>
                    </div>
                </Dialog>
            )}
        </AnimatePresence>
    );
};

export default RequestsListModal;
