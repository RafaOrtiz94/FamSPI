import React, { createContext, useContext, useState, useEffect } from "react";

/**
 * OnboardingContext - Manages onboarding state for first-time users
 */
const OnboardingContext = createContext();

const STORAGE_KEY = "bc_workspace_onboarding_completed";

/**
 * OnboardingProvider - Context provider for onboarding functionality
 */
export const OnboardingProvider = ({ children }) => {
    const [isOnboardingActive, setIsOnboardingActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);

    // Check if user has completed onboarding
    useEffect(() => {
        const completed = localStorage.getItem(STORAGE_KEY);
        if (!completed) {
            setHasCompletedOnboarding(false);
            // Auto-start onboarding for new users after a short delay
            const timer = setTimeout(() => {
                setIsOnboardingActive(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    // Onboarding steps configuration
    const steps = [
        {
            id: "welcome",
            title: "¡Bienvenido al Workspace!",
            description: "Este es el nuevo espacio de trabajo para gestionar Business Cases de forma colaborativa.",
            target: null, // No target, just a welcome modal
        },
        {
            id: "sections",
            title: "Navegación por Secciones",
            description: "Usa el panel izquierdo para navegar entre las diferentes secciones del Business Case. Cada sección tiene su propio formulario.",
            target: "[data-onboarding='section-nav']",
        },
        {
            id: "status",
            title: "Estado de Secciones",
            description: "Los iconos indican el estado de cada sección: ✓ Completa, ⏱ Pendiente, ⚠️ En progreso, 🔒 Solo lectura.",
            target: "[data-onboarding='section-status']",
        },
        {
            id: "progress",
            title: "Progreso General",
            description: "En la cabecera puedes ver el progreso general del Business Case y el estado actual del flujo.",
            target: "[data-onboarding='progress']",
        },
        {
            id: "save",
            title: "Guardar Cambios",
            description: "Cada sección tiene su propio botón de guardado. Los cambios se guardan en el servidor inmediatamente.",
            target: "[data-onboarding='save-btn']",
        },
        {
            id: "complete",
            title: "¡Listo para empezar!",
            description: "Ya conoces las funciones básicas. Puedes acceder a este tour nuevamente desde el menú de ayuda.",
            target: null,
        },
    ];

    const startOnboarding = () => {
        setCurrentStep(0);
        setIsOnboardingActive(true);
    };

    const nextStep = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep((prev) => prev + 1);
        } else {
            completeOnboarding();
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1);
        }
    };

    const skipOnboarding = () => {
        completeOnboarding();
    };

    const completeOnboarding = () => {
        setIsOnboardingActive(false);
        setHasCompletedOnboarding(true);
        localStorage.setItem(STORAGE_KEY, "true");
    };

    const resetOnboarding = () => {
        localStorage.removeItem(STORAGE_KEY);
        setHasCompletedOnboarding(false);
        startOnboarding();
    };

    const value = {
        isOnboardingActive,
        currentStep,
        steps,
        currentStepData: steps[currentStep] || null,
        hasCompletedOnboarding,
        startOnboarding,
        nextStep,
        prevStep,
        skipOnboarding,
        completeOnboarding,
        resetOnboarding,
        totalSteps: steps.length,
    };

    return (
        <OnboardingContext.Provider value={value}>
            {children}
        </OnboardingContext.Provider>
    );
};

/**
 * useOnboarding - Hook to access onboarding context
 */
export const useOnboarding = () => {
    const context = useContext(OnboardingContext);
    if (!context) {
        throw new Error("useOnboarding must be used within an OnboardingProvider");
    }
    return context;
};

export default OnboardingProvider;
