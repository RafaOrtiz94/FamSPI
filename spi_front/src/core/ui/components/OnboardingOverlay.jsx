import React, { useEffect, useState } from "react";
import { FiX, FiChevronLeft, FiChevronRight, FiHelpCircle } from "react-icons/fi";
import { useOnboarding } from "./OnboardingProvider";

/**
 * OnboardingOverlay - Full-screen overlay with highlighted target and tooltip
 */
const OnboardingOverlay = () => {
    const {
        isOnboardingActive,
        currentStepData,
        currentStep,
        totalSteps,
        nextStep,
        prevStep,
        skipOnboarding,
    } = useOnboarding();

    const [tooltipPosition, setTooltipPosition] = useState({ top: "50%", left: "50%" });

    // Calculate tooltip position based on target element
    useEffect(() => {
        if (!currentStepData?.target) {
            // Center the tooltip if no target
            setTooltipPosition({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
            return;
        }

        const targetElement = document.querySelector(currentStepData.target);
        if (targetElement) {
            const rect = targetElement.getBoundingClientRect();
            const tooltipTop = rect.bottom + 16;
            const tooltipLeft = rect.left + rect.width / 2;

            setTooltipPosition({
                top: `${tooltipTop}px`,
                left: `${Math.min(Math.max(tooltipLeft, 200), window.innerWidth - 200)}px`,
                transform: "translateX(-50%)",
            });

            // Add highlight to target
            targetElement.classList.add("onboarding-highlight");
            return () => {
                targetElement.classList.remove("onboarding-highlight");
            };
        }
    }, [currentStepData]);

    if (!isOnboardingActive || !currentStepData) return null;

    return (
        <>
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/50 z-50" onClick={skipOnboarding} />

            {/* Tooltip */}
            <div
                className="fixed z-50 bg-white rounded-xl shadow-2xl p-6 max-w-md"
                style={tooltipPosition}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={skipOnboarding}
                    className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600"
                >
                    <FiX size={16} />
                </button>

                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-3">
                    <FiHelpCircle className="text-blue-600" size={20} />
                    <span className="text-xs text-gray-500">
                        Paso {currentStep + 1} de {totalSteps}
                    </span>
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {currentStepData.title}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    {currentStepData.description}
                </p>

                {/* Progress dots */}
                <div className="flex justify-center gap-1 mb-4">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${i === currentStep ? "bg-blue-600" : "bg-gray-300"
                                }`}
                        />
                    ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={skipOnboarding}
                        className="text-sm text-gray-500 hover:text-gray-700"
                    >
                        Saltar tour
                    </button>
                    <div className="flex gap-2">
                        {currentStep > 0 && (
                            <button
                                onClick={prevStep}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                <FiChevronLeft size={14} />
                                Anterior
                            </button>
                        )}
                        <button
                            onClick={nextStep}
                            className="flex items-center gap-1 px-4 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                        >
                            {currentStep === totalSteps - 1 ? "Finalizar" : "Siguiente"}
                            {currentStep < totalSteps - 1 && <FiChevronRight size={14} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* CSS for highlight effect */}
            <style>{`
        .onboarding-highlight {
          position: relative;
          z-index: 51;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 8px rgba(59, 130, 246, 0.2);
          border-radius: 8px;
        }
      `}</style>
        </>
    );
};

/**
 * OnboardingTrigger - Button to restart onboarding
 */
export const OnboardingTrigger = () => {
    const { startOnboarding, hasCompletedOnboarding } = useOnboarding();

    if (!hasCompletedOnboarding) return null;

    return (
        <button
            onClick={startOnboarding}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            title="Ver tour guiado"
        >
            <FiHelpCircle size={16} />
            <span className="hidden md:inline">Ayuda</span>
        </button>
    );
};

export default OnboardingOverlay;
