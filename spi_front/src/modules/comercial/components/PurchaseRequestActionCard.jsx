import React from "react";
import { FiShoppingCart } from "react-icons/fi";

const PurchaseRequestActionCard = ({ onClick }) => {
    return (
        <div
            className="flex h-full flex-col justify-between rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-white p-6 shadow-sm transition hover:shadow-md dark:border-indigo-900/40 dark:from-indigo-950/40 dark:via-gray-900 dark:to-gray-900"
        >
            <div className="flex flex-col items-center text-center space-y-3">
                <div className="rounded-2xl bg-indigo-600 p-4 text-white shadow-sm">
                    <FiShoppingCart size={28} />
                </div>
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">
                        Solicitud de Compra
                    </p>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                        Envía al ACP Comercial
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        Solicita equipos para clientes y gestiona con proveedores autorizados.
                    </p>
                </div>
            </div>

            <div className="mt-5 flex flex-col items-center gap-3">
                <div className="flex flex-wrap gap-2 justify-center">
                    <span className="inline-flex items-center rounded-full bg-indigo-100/80 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                        Proveedores
                    </span>
                    <span className="inline-flex items-center rounded-full bg-indigo-100/80 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                        LIS
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClick}
                    className="w-full inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                    Crear solicitud
                </button>
            </div>
        </div>
    );
};

export default PurchaseRequestActionCard;
