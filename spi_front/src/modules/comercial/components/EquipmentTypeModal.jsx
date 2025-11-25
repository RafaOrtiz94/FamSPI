import React from "react";
import { FiX, FiPackage, FiRefreshCw } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";

/**
 * Modal pequeña para seleccionar el tipo de equipo (Nuevo o CU)
 * antes de crear una solicitud de compra
 */
const EquipmentTypeModal = ({ open, onClose, onSelect, loading }) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-violet-50 to-purple-50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Tipo de Equipo</h3>
                        <p className="text-sm text-gray-600 mt-1">Selecciona el tipo de equipo a solicitar</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-gray-500 hover:bg-white hover:text-gray-700 transition-all"
                        disabled={loading}
                    >
                        <FiX size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600 mb-4">
                        ¿Qué tipo de equipo deseas solicitar al proveedor?
                    </p>

                    {/* Opción: Equipo Nuevo */}
                    <button
                        onClick={() => onSelect("new")}
                        disabled={loading}
                        className="w-full group relative overflow-hidden rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-6 text-left transition-all hover:border-violet-400 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-violet-500 rounded-xl text-white group-hover:scale-110 transition-transform">
                                <FiPackage size={24} />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-lg font-bold text-gray-900 mb-1">Equipo Nuevo</h4>
                                <p className="text-sm text-gray-600">
                                    Solicitar equipos completamente nuevos de fábrica
                                </p>
                            </div>
                        </div>
                        <div className="absolute top-2 right-2 px-3 py-1 bg-violet-500 text-white text-xs font-semibold rounded-full">
                            NUEVO
                        </div>
                    </button>

                    {/* Opción: Equipo CU (Usado/Refurbished) */}
                    <button
                        onClick={() => onSelect("cu")}
                        disabled={loading}
                        className="w-full group relative overflow-hidden rounded-xl border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50 p-6 text-left transition-all hover:border-cyan-400 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-cyan-500 rounded-xl text-white group-hover:scale-110 transition-transform">
                                <FiRefreshCw size={24} />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-lg font-bold text-gray-900 mb-1">Equipo CU</h4>
                                <p className="text-sm text-gray-600">
                                    Solicitar equipos usados o reacondicionados (Customer Used)
                                </p>
                            </div>
                        </div>
                        <div className="absolute top-2 right-2 px-3 py-1 bg-cyan-500 text-white text-xs font-semibold rounded-full">
                            CU
                        </div>
                    </button>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={loading}
                        className="w-full"
                    >
                        Cancelar
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default EquipmentTypeModal;
