import React from "react";
import { useAuth } from "../../../../core/auth/AuthContext";
import PermisosStatusWidget from "../components/PermisosStatusWidget";
import { FiCalendar, FiClock, FiCheckCircle } from "react-icons/fi";

const PermisosPage = () => {
    const { user } = useAuth();

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Permisos y Vacaciones
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Gestiona tus solicitudes, aprobaciones y vacaciones desde un solo lugar.
                    </p>
                </div>
            </div>

            {/* Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Columna Principal: Status Widget (ocupa 2 columnas en pantallas grandes) */}
                <div className="lg:col-span-2 space-y-6">
                    <PermisosStatusWidget />
                </div>

                {/* Columna Lateral: Información / Resumen (Opcional, por ahora placeholder o widgets futuros) */}
                <div className="space-y-6">
                    {/* Aquí podríamos poner un resumen de días de vacaciones disponibles, etc. */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <FiCalendar className="w-5 h-5 text-blue-500" />
                            Resumen de Vacaciones
                        </h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Días Disponibles</p>
                                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">15 días</p>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                * Este saldo es referencial. Consulta con Talento Humano para el dato exacto.
                            </p>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                            <FiClock className="w-5 h-5" />
                            Política de Permisos
                        </h3>
                        <p className="text-sm text-purple-100 mb-4">
                            Recuerda solicitar tus permisos con al menos 24 horas de anticipación para garantizar su aprobación.
                        </p>
                        <button className="text-xs bg-white text-purple-600 px-3 py-1.5 rounded-lg font-medium hover:bg-purple-50 transition-colors">
                            Ver Política Completa
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PermisosPage;
