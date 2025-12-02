import React from "react";
import { FiCalendar } from "react-icons/fi";

/**
 * VacationRequestActionCard
 * Tarjeta de acción para solicitar vacaciones
 * Disponible para todos los usuarios
 */
const VacationRequestActionCard = ({ onClick }) => {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group relative flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-4 shadow-sm transition-all duration-200 hover:border-emerald-400 hover:shadow-md dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-gray-900 dark:to-gray-900"
        >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm transition-transform duration-200 group-hover:scale-110">
                <FiCalendar size={32} />
            </div>

            <div className="text-center">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-200 opacity-70">
                    Vacaciones
                </p>
                <h3 className="text-sm font-bold leading-tight text-gray-900 dark:text-white">
                    Solicitar Vacaciones
                </h3>
            </div>
        </button>
    );
};

export default VacationRequestActionCard;
