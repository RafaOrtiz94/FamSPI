import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import Step1GeneralData from "../components/wizard/Step1GeneralData";
import Step2EquipmentSelector from "../components/wizard/Step2EquipmentSelector";
import Step3DeterminationSelector from "../components/wizard/Step3DeterminationSelector";
import Step4CalculationsSummary from "../components/wizard/Step4CalculationsSummary";
import Step5Investments from "../components/wizard/Step5Investments";
import FinalStep from "../components/wizard/FinalStep";
import { useUI } from "../../../core/ui/UIContext";

const WizardContext = createContext();
const STORAGE_KEY = "business_case_wizard_draft";

const defaultState = {
  businessCaseId: null,
  generalData: {
    client: "",
    businessType: "",
    notes: "",
    date: new Date().toISOString().slice(0, 10),
  },
  selectedEquipment: null,
  determinations: [],
  calculations: null,
  investments: [],
};

export const useBusinessCaseWizard = () => useContext(WizardContext);

const steps = [
  { id: "general", title: "Datos Generales" },
  { id: "equipment", title: "Equipo" },
  { id: "determinations", title: "Determinaciones" },
  { id: "calculations", title: "Resumen" },
  { id: "investments", title: "Inversiones" },
  { id: "final", title: "Finalizar" },
];

const WizardProvider = ({ children }) => {
  const [state, setState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return { ...defaultState, ...JSON.parse(stored) };
      } catch (err) {
        console.warn("No se pudo leer borrador de wizard", err);
      }
    }
    return defaultState;
  });
  const [currentStep, setCurrentStep] = useState(0);
  const { showToast } = useUI();

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 2000);
    return () => clearTimeout(timeout);
  }, [state]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(defaultState);
    setCurrentStep(0);
    showToast("Borrador eliminado", "info");
  }, [showToast]);

  const updateState = useCallback((updater) => {
    setState((prev) => ({ ...prev, ...updater }));
  }, []);

  const value = useMemo(
    () => ({ state, updateState, currentStep, setCurrentStep, steps, clearDraft }),
    [state, currentStep, clearDraft]
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
};

const Stepper = ({ currentStep }) => (
  <div className="flex items-center gap-4 overflow-x-auto pb-2">
    {steps.map((step, idx) => {
      const active = idx === currentStep;
      const completed = idx < currentStep;
      return (
        <div key={step.id} className="flex items-center gap-2">
          <div
            className={`h-10 w-10 flex items-center justify-center rounded-full border-2 text-sm font-semibold transition-all ${
              completed
                ? "bg-green-500 text-white border-green-500"
                : active
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-300 text-gray-500"
            }`}
          >
            {idx + 1}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs uppercase text-gray-500">Paso {idx + 1}</p>
            <p className={`text-sm font-semibold ${active ? "text-blue-700" : "text-gray-700"}`}>{step.title}</p>
          </div>
          {idx < steps.length - 1 && <div className="h-px w-12 bg-gray-200" />}
        </div>
      );
    })}
  </div>
);

const ProgressBar = ({ value }) => (
  <div className="w-full bg-gray-100 rounded-full h-2">
    <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${value}%` }} />
  </div>
);

const Navigation = ({ onPrev, onNext, disablePrev, disableNext, nextLabel = "Siguiente" }) => (
  <div className="flex justify-between pt-4">
    <button
      type="button"
      onClick={onPrev}
      disabled={disablePrev}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      <FiChevronLeft /> Anterior
    </button>
    <button
      type="button"
      onClick={onNext}
      disabled={disableNext}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {nextLabel} <FiChevronRight />
    </button>
  </div>
);

const BusinessCaseWizard = () => {
  const { currentStep, setCurrentStep, state, clearDraft } = useBusinessCaseWizard();
  const progress = Math.round(((currentStep + 1) / steps.length) * 100);
  const goPrev = () => setCurrentStep((prev) => Math.max(0, prev - 1));
  const goNext = () => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1));

  const renderStep = () => {
    switch (steps[currentStep].id) {
      case "general":
        return <Step1GeneralData onNext={goNext} />;
      case "equipment":
        return <Step2EquipmentSelector onPrev={goPrev} onNext={goNext} />;
      case "determinations":
        return <Step3DeterminationSelector onPrev={goPrev} onNext={goNext} />;
      case "calculations":
        return <Step4CalculationsSummary onPrev={goPrev} onNext={goNext} />;
      case "investments":
        return <Step5Investments onPrev={goPrev} onNext={goNext} />;
      case "final":
      default:
        return <FinalStep onPrev={goPrev} />;
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Case Moderno</h1>
          <p className="text-sm text-gray-500">Wizard de 5 pasos con guardado automático.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentStep(0)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            <FiRefreshCw /> Reiniciar pasos
          </button>
          <button
            type="button"
            onClick={clearDraft}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"
          >
            <FiTrash2 /> Borrar borrador
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-4 shadow-sm">
        <Stepper currentStep={currentStep} />
        <ProgressBar value={progress} />
        <div className="border border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-gray-50 dark:bg-gray-800/40">
          {renderStep()}
        </div>
        <Navigation
          onPrev={goPrev}
          onNext={goNext}
          disablePrev={currentStep === 0}
          disableNext={currentStep === steps.length - 1}
          nextLabel={currentStep === steps.length - 1 ? "" : "Siguiente"}
        />
      </div>

      {state.businessCaseId && (
        <div className="text-xs text-gray-500">
          Borrador activo con ID: <span className="font-semibold text-gray-800">{state.businessCaseId}</span>
        </div>
      )}
    </div>
  );
};

const BusinessCaseWizardPage = () => (
  <WizardProvider>
    <BusinessCaseWizard />
  </WizardProvider>
);

export default BusinessCaseWizardPage;
