import React, { useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { FiShoppingCart, FiBriefcase, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import {
  PRIVATE_PURCHASE_OPTIONS,
  PUBLIC_PURCHASE_OPTIONS,
  PURCHASE_FAMILY,
} from './purchaseTypes';

/**
 * Selector unificado: 1) familia (publica/privada) 2) subtipo.
 */
const PurchaseTypeSelector = ({ isOpen, onClose, origin = 'unknown', onSelect }) => {
  const [family, setFamily] = useState(null);

  const privateOptions = useMemo(() => PRIVATE_PURCHASE_OPTIONS, []);
  const publicOptions = useMemo(() => PUBLIC_PURCHASE_OPTIONS, []);

  const closeAll = () => {
    setFamily(null);
    onClose?.();
  };

  const emitSelection = (option) => {
    const payload = {
      purchaseFamily: family,
      purchaseKind: option.key,
      startFrom: option.startFrom,
      origin,
    };

    if (onSelect) {
      onSelect(payload);
    }

    closeAll();
  };

  return (
    <Dialog open={isOpen} onClose={closeAll} className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
          <Dialog.Panel className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Nueva Solicitud de Compra</h2>
                <p className="text-sm text-gray-500">
                  {!family ? 'Selecciona el tipo de requerimiento' : 'Selecciona el tipo de compra'}
                </p>
              </div>
              <button
                onClick={closeAll}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <span className="sr-only">Cerrar</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-6">
              {!family ? (
                <>
                  <div className="mb-6 text-center">
                    <h3 className="mb-2 text-base font-semibold text-gray-900">Que tipo de compra deseas crear?</h3>
                    <p className="text-sm text-gray-600">Selecciona el tipo de cliente para continuar</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={() => setFamily(PURCHASE_FAMILY.PUBLIC)}
                      className="group relative rounded-xl border-2 border-gray-200 p-6 text-left transition-all duration-200 hover:border-blue-300 hover:bg-blue-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Seleccionar compra publica"
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-full bg-blue-100 p-3 transition-colors group-hover:bg-blue-200">
                          <FiShoppingCart className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="mb-1 font-semibold text-gray-900">Compra Publica</h4>
                          <p className="mb-2 text-xs leading-tight text-gray-600">
                            Flujo con Business Case obligatorio previo al proceso de compra
                          </p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setFamily(PURCHASE_FAMILY.PRIVATE)}
                      className="group relative rounded-xl border-2 border-gray-200 p-6 text-left transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      aria-label="Seleccionar compra privada"
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-full bg-indigo-100 p-3 transition-colors group-hover:bg-indigo-200">
                          <FiBriefcase className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="mb-1 font-semibold text-gray-900">Compra Privada</h4>
                          <p className="mb-2 text-xs leading-tight text-gray-600">
                            Venta, alquiler, alquiler con transferencia o comodato
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => setFamily(null)}
                      className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                    >
                      <FiArrowLeft size={14} />
                      Volver
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {(family === PURCHASE_FAMILY.PRIVATE ? privateOptions : publicOptions).length === 0 && (
                      <div className="space-y-2">
                        <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
                        <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
                      </div>
                    )}
                    {(family === PURCHASE_FAMILY.PRIVATE ? privateOptions : publicOptions).map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => emitSelection(option)}
                        className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-blue-300 hover:bg-blue-50"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{option.title}</p>
                          <p className="text-xs text-gray-500">
                            {option.startFrom === 'existing_modal'
                              ? 'Continua con formulario de compra privada'
                              : 'Inicia Business Case con secciones comerciales previas'}
                          </p>
                        </div>
                        <FiCheckCircle className="text-blue-600" />
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="flex justify-end border-t border-gray-100 pt-6">
                <button
                  onClick={closeAll}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
};

export default PurchaseTypeSelector;
