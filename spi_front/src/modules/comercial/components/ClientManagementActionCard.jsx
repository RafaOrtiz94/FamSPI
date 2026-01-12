import React from "react";
import { FiUserCheck } from "react-icons/fi";

const ClientManagementActionCard = ({ onClick }) => {
    return (
        <div
            className="flex h-full flex-col justify-between rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-white p-6 shadow-sm transition hover:shadow-md dark:border-teal-900/40 dark:from-teal-950/40 dark:via-gray-900 dark:to-gray-900"
        >
            <div className="flex flex-col items-center text-center space-y-3">
                <div className="rounded-2xl bg-teal-600 p-4 text-white shadow-sm">
                    <FiUserCheck size={28} />
                </div>
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-200">
                        Solicitudes de Cliente
                    </p>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                        Gestiona solicitudes de clientes
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        Aprueba o rechaza solicitudes de nuevos clientes con validación LOPDP.
                    </p>
                </div>
            </div>

            <div className="mt-5 flex flex-col items-center gap-3">
                <div className="flex flex-wrap gap-2 justify-center">
                    <span className="inline-flex items-center rounded-full bg-teal-100/80 px-2.5 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-200">
                        LOPDP
                    </span>
                    <span className="inline-flex items-center rounded-full bg-teal-100/80 px-2.5 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-200">
                        Aprobación
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClick}
                    className="w-full inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                >
                    Gestionar
                </button>
            </div>
        </div>
    );
};

export default ClientManagementActionCard;
