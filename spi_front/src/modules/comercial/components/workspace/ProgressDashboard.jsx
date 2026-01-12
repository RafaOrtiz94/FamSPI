import React from "react";
import { FiCheckCircle, FiClock, FiArrowRight, FiUser } from "react-icons/fi";

/**
 * ProgressDashboard - Visual progress overview for Business Case workspace
 * Shows completion status, next steps, and pending approvals
 */
const ProgressDashboard = ({ uiGuidance }) => {
    if (!uiGuidance) return null;

    const { sectionOwnership, permissions, currentState, businessCase } = uiGuidance;
    const rules = sectionOwnership?.rules || {};

    // Calculate progress
    const sections = Object.keys(rules);
    const completedSections = sections.filter((s) => rules[s]?.isCompleted);
    const totalSections = sections.length || 9;
    const progressPercentage = totalSections > 0
        ? Math.round((completedSections.length / totalSections) * 100)
        : 0;

    // Find next required action
    const pendingSections = sections.filter((s) => !rules[s]?.isCompleted);
    const nextSection = pendingSections[0];
    const nextSectionOwner = nextSection ? rules[nextSection]?.currentOwner : null;

    // State labels
    const stateLabels = {
        draft: "Borrador",
        pending_review: "Pendiente Revisión",
        in_review: "En Revisión",
        approved: "Aprobado",
        rejected: "Rechazado",
        completed: "Completado",
        observado: "Observado",
    };

    const stateColors = {
        draft: "bg-gray-100 text-gray-700",
        pending_review: "bg-yellow-100 text-yellow-700",
        in_review: "bg-blue-100 text-blue-700",
        approved: "bg-green-100 text-green-700",
        rejected: "bg-red-100 text-red-700",
        completed: "bg-green-100 text-green-700",
        observado: "bg-amber-100 text-amber-700",
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Progress Circle */}
                <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16">
                        <svg className="w-16 h-16 transform -rotate-90">
                            <circle
                                cx="32"
                                cy="32"
                                r="28"
                                stroke="#e5e7eb"
                                strokeWidth="6"
                                fill="none"
                            />
                            <circle
                                cx="32"
                                cy="32"
                                r="28"
                                stroke={progressPercentage === 100 ? "#22c55e" : "#3b82f6"}
                                strokeWidth="6"
                                fill="none"
                                strokeDasharray={`${progressPercentage * 1.76} 176`}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold text-gray-900">{progressPercentage}%</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-900">Progreso General</p>
                        <p className="text-xs text-gray-500">
                            {completedSections.length} de {totalSections} secciones
                        </p>
                    </div>
                </div>

                {/* Sections Complete */}
                <div className="flex items-center gap-3 px-4 border-l border-gray-200">
                    <div className="p-2 rounded-full bg-green-100">
                        <FiCheckCircle className="text-green-600" size={20} />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-gray-900">{completedSections.length}/{totalSections}</p>
                        <p className="text-xs text-gray-500">Secciones Completas</p>
                    </div>
                </div>

                {/* Next Step */}
                <div className="flex items-center gap-3 px-4 border-l border-gray-200">
                    <div className="p-2 rounded-full bg-blue-100">
                        <FiArrowRight className="text-blue-600" size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-900 capitalize">
                            {nextSection?.replace(/_/g, " ") || "Completado"}
                        </p>
                        <p className="text-xs text-gray-500">Próximo Paso</p>
                    </div>
                </div>

                {/* Current State / Pending Approver */}
                <div className="flex items-center gap-3 px-4 border-l border-gray-200">
                    <div className="p-2 rounded-full bg-purple-100">
                        <FiUser className="text-purple-600" size={20} />
                    </div>
                    <div>
                        {currentState && (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${stateColors[currentState] || "bg-gray-100 text-gray-700"}`}>
                                {stateLabels[currentState] || currentState}
                            </span>
                        )}
                        {nextSectionOwner && (
                            <p className="text-xs text-gray-500 mt-0.5">
                                Pendiente: {nextSectionOwner}
                            </p>
                        )}
                        {!currentState && !nextSectionOwner && (
                            <p className="text-sm text-gray-500">Sin estado</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${progressPercentage === 100 ? "bg-green-500" : "bg-blue-500"
                            }`}
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
                {/* Section indicators */}
                <div className="flex justify-between mt-2">
                    {sections.slice(0, 9).map((section, idx) => (
                        <div
                            key={section}
                            className={`w-2 h-2 rounded-full ${rules[section]?.isCompleted
                                    ? "bg-green-500"
                                    : rules[section]?.currentOwner
                                        ? "bg-yellow-400"
                                        : "bg-gray-300"
                                }`}
                            title={section.replace(/_/g, " ")}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProgressDashboard;
