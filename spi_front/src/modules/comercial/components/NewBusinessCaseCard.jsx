import React from "react";
import { FiBriefcase, FiTrendingUp } from "react-icons/fi";

const badges = [
    { label: "Análisis", icon: FiTrendingUp },
    { label: "Inversión", icon: FiBriefcase },
];

const NewBusinessCaseCard = ({ onClick, className = "" }) => (
    <div
        className={`flex h-full flex-col justify-between rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-white p-6 shadow-sm transition hover:shadow-md dark:border-orange-900/30 dark:from-orange-950/40 dark:via-gray-900 dark:to-gray-900 ${className}`}
    >
        <div className="flex flex-col items-center text-center space-y-3">
            <div className="rounded-2xl bg-orange-600 p-4 text-white shadow-sm">
                <FiBriefcase size={28} />
            </div>
            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-200">
                    Business Case
                </p>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                    Iniciar Business Case
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Crea un Business Case independiente para análisis de inversión y viabilidad comercial.
                </p>
            </div>
        </div>

        <div className="mt-5 flex flex-col items-center gap-3">
            <div className="flex flex-wrap gap-2 justify-center">
                {badges.map((badge) => (
                    <span
                        key={badge.label}
                        className="inline-flex items-center rounded-full bg-orange-100/80 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-200"
                    >
                        {badge.label}
                    </span>
                ))}
            </div>
            <button
                type="button"
                onClick={onClick}
                className="w-full inline-flex items-center justify-center rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700"
            >
                Crear Business Case
            </button>
        </div>
    </div>
);

export default NewBusinessCaseCard;
