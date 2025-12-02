import React from "react";
import { FiShoppingCart } from "react-icons/fi";

const PurchaseRequestActionCard = ({ onClick }) => {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group relative flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-white p-4 shadow-sm transition-all duration-200 hover:border-indigo-400 hover:shadow-md dark:border-indigo-900/40 dark:from-indigo-950/40 dark:via-gray-900 dark:to-gray-900"
        >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm transition-transform duration-200 group-hover:scale-110">
                <FiShoppingCart size={32} />
            </div>

            <div className="text-center">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200 opacity-70">
                    Solicitud de Compra
                </p>
                <h3 className="text-sm font-bold leading-tight text-gray-900 dark:text-white">
                    Equipos y LIS
                </h3>
            </div>
        </button>
    );
};

export default PurchaseRequestActionCard;
