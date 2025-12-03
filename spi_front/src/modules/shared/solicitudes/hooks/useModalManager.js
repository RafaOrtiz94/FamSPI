import { useState, useCallback } from 'react';

/**
 * Hook para manejar estado de múltiples modales
 * Permite abrir/cerrar modales y pasar datos entre componentes
 */
export const useModalManager = () => {
    const [modals, setModals] = useState({});

    const openModal = useCallback((modalId, data = null) => {
        setModals(prev => ({
            ...prev,
            [modalId]: { open: true, data }
        }));
    }, []);

    const closeModal = useCallback((modalId) => {
        setModals(prev => ({
            ...prev,
            [modalId]: { open: false, data: null }
        }));
    }, []);

    const isOpen = useCallback((modalId) => {
        return modals[modalId]?.open || false;
    }, [modals]);

    const getData = useCallback((modalId) => {
        return modals[modalId]?.data || null;
    }, [modals]);

    return {
        openModal,
        closeModal,
        isOpen,
        getData
    };
};
