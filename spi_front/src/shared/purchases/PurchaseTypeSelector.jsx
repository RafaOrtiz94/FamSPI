import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { FiShoppingCart, FiBriefcase } from 'react-icons/fi';
import NewPurchaseRequestModal from './NewPurchaseRequestModal';

/**
 * PurchaseTypeSelector - Componente unificado para selección de tipo de compra
 *
 * Single source of truth para la selección entre Compras Públicas y Privadas.
 * Usado tanto en Dashboard como en Solicitudes para mantener consistencia.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Controla si el modal está abierto
 * @param {function} props.onClose - Función para cerrar el modal
 * @param {string} props.origin - Origen del modal ('dashboard' | 'solicitudes') para analytics
 * @param {function} props.onSelect - Función llamada al seleccionar tipo (type: 'public' | 'private')
 */
const PurchaseTypeSelector = ({ isOpen, onClose, origin = 'unknown', onSelect }) => {
    const [showPublicModal, setShowPublicModal] = useState(false);
    const [showPrivateModal, setShowPrivateModal] = useState(false);

    const handleSelect = (type) => {
        console.log('[PurchaseTypeSelector] handleSelect called with type:', type);

        // Cerrar modal principal
        onClose();

        // Llamar callback si existe
        if (onSelect) {
            console.log('[PurchaseTypeSelector] Calling onSelect callback with:', type);
            onSelect(type);
            return;
        }

        // Modal logic basado en tipo
        if (type === 'public') {
            console.log('[PurchaseTypeSelector] Opening public modal');
            // Compras públicas: modal con ACP requerido
            setShowPublicModal(true);
        } else if (type === 'private') {
            console.log('[PurchaseTypeSelector] Opening private modal');
            // Compras privadas: modal directo sin ACP
            setShowPrivateModal(true);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50">
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden />
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
                        <Dialog.Panel className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
                            <div className="flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">Nueva Solicitud de Compra</h2>
                                    <p className="text-sm text-gray-500">Selecciona el tipo de requerimiento</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                >
                                    <span className="sr-only">Cerrar</span>
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="px-6 py-6">
                                <div className="text-center mb-6">
                                    <h3 className="text-base font-semibold text-gray-900 mb-2">
                                        ¿Qué tipo de compra deseas crear?
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        Selecciona el tipo de cliente para continuar
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {/* Opción Compra Pública */}
                                    <button
                                        onClick={() => handleSelect('public')}
                                        className="group relative p-6 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left"
                                        aria-label="Seleccionar compra pública - Proceso formal vía ACP"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                                                <FiShoppingCart className="w-6 h-6 text-blue-600" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-gray-900 mb-1">Compra Pública</h4>
                                                <p className="text-xs text-gray-600 leading-tight mb-2">
                                                    Proceso formal vía Administración de Contratación Pública (ACP)
                                                </p>

                                            </div>
                                        </div>
                                    </button>

                                    {/* Opción Compra Privada */}
                                    <button
                                        onClick={() => handleSelect('private')}
                                        className="group relative p-6 border-2 border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-left"
                                        aria-label="Seleccionar compra privada - Proceso directo"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-indigo-100 rounded-full group-hover:bg-indigo-200 transition-colors">
                                                <FiBriefcase className="w-6 h-6 text-indigo-600" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-gray-900 mb-1">Compra Privada</h4>
                                                <p className="text-xs text-gray-600 leading-tight mb-2">
                                                    Gestión directa con el cliente privado
                                                </p>

                                            </div>
                                        </div>
                                    </button>
                                </div>

                                <div className="flex justify-end pt-6 border-t border-gray-100">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>

            {/* Modal de Compra Pública */}
            <NewPurchaseRequestModal
                isOpen={showPublicModal}
                onOpenChange={setShowPublicModal}
                mode="acp_required"
                source="purchase_type_selector"
                intent="public_purchase"
                onSuccess={() => {
                    setShowPublicModal(false);
                    // Opcional: mostrar mensaje de éxito o redirigir
                }}
            />

            {/* Modal de Compra Privada */}
            <NewPurchaseRequestModal
                isOpen={showPrivateModal}
                onOpenChange={setShowPrivateModal}
                mode="private_direct"
                source="purchase_type_selector"
                intent="private_purchase"
                onSuccess={() => {
                    setShowPrivateModal(false);
                    // Opcional: mostrar mensaje de éxito o redirigir
                }}
            />
        </>
    );
};

export default PurchaseTypeSelector;
