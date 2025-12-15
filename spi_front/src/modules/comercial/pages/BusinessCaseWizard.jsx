import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import Step1ClientData from "../components/wizard/Step1ClientData";
import Step2LabData from "../components/wizard/Step2LabData";
import Step3EquipmentAndLis from "../components/wizard/Step3EquipmentAndLis";
import Step2EquipmentSelector from "../components/wizard/Step2EquipmentSelector";
import Step3DeterminationSelector from "../components/wizard/Step3DeterminationSelector";
import Step4CalculationsSummary from "../components/wizard/Step4CalculationsSummary";
import Step5Investments from "../components/wizard/Step5Investments";
import FinalStep from "../components/wizard/FinalStep";
import { useUI } from "../../../core/ui/UIContext";
import Step4RentabilitySummary from "../components/wizard/Step4RentabilitySummary";
import { useAuth } from "../../../core/auth/AuthContext";

const WizardContext = createContext();
const STORAGE_KEY = "business_case_wizard_draft";

const defaultState = {
  businessCaseId: null,
  bcType: 'comodato_publico',
  calculationMode: 'annual',
  generalData: {
    client: "",
    clientType: "",
    contractingEntity: "",
    processCode: "",
    contractObject: "",
    provinceCity: "",
    notes: "",
    durationYears: 3,
    targetMargin: 25,
    labWorkDaysPerWeek: "",
    labShiftsPerDay: "",
    labHoursPerShift: "",
    labQualityControlsPerShift: "",
    labControlLevels: "",
    labRoutineQCFrequency: "",
    labSpecialTests: "",
    labSpecialQCFrequency: "",
    lisIncludes: false,
    lisProvider: "",
    lisIncludesHardware: false,
    lisMonthlyPatients: "",
    lisInterfaceSystem: "",
    lisInterfaceProvider: "",
    lisInterfaceHardware: "",
    requirementsDeadlineMonths: "",
    requirementsProjectedDeadlineMonths: "",
    deliveryType: "total",
    effectiveDetermination: false,
  },
  lisInterfaces: [],
  equipmentConfig: {
    primary: null,
    backup: null,
    secondary: [],
  },
  determinations: [],
  calculations: null,
  investments: [],
};

export const useBusinessCaseWizard = () => useContext(WizardContext);

const getStepsForRole = (role) => {
  const isJefe = ["jefe_comercial", "gerencia", "gerencia_general", "admin"].includes(role);

  if (!isJefe) {
    // Commercial User Workflow
    return [
      { id: "client_data", title: "Datos del Cliente" },
      { id: "lab_data", title: "Datos Laboratorio" },
      { id: "equipment_lis", title: "Equipamiento y LIS" },
    ];
  }

  // Manager Workflow (Full)
  return [
    { id: "client_data", title: "Datos del Cliente" },
    { id: "lab_data", title: "Datos Laboratorio" },
    { id: "equipment", title: "Equipamiento" },
    { id: "determinations", title: "Determinaciones" },
    { id: "calculations", title: "Resumen técnico" },
    { id: "rentability", title: "Rentabilidad y ROI" },
    { id: "investments", title: "Inversiones" },
    { id: "final", title: "Finalizar" },
  ];
};

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
    () => ({ state, updateState, currentStep, setCurrentStep, clearDraft }),
    [state, currentStep, clearDraft, updateState]
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
};

const Stepper = ({ currentStep, steps }) => (
  <div className="flex items-center gap-4 overflow-x-auto pb-2">
    {steps.map((step, idx) => {
      const active = idx === currentStep;
      const completed = idx < currentStep;
      return (
        <div key={step.id} className="flex items-center gap-2">
          <div
            className={`h-10 w-10 flex items-center justify-center rounded-full border-2 text-sm font-semibold transition-all ${completed
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
  const { user } = useAuth(); // Get current user role
  const steps = useMemo(() => getStepsForRole(user?.role), [user?.role]);
  const progress = Math.round(((currentStep + 1) / steps.length) * 100);
  const goPrev = () => setCurrentStep((prev) => Math.max(0, prev - 1));
  const goNext = () => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1));
  const { showToast } = useUI();

  useEffect(() => {
    if (currentStep >= steps.length) {
      setCurrentStep(steps.length - 1);
    }
  }, [steps, currentStep, setCurrentStep]);

  const handleCommercialFinish = async () => {
    try {
      // Logic handled inside Step3EquipmentAndLis, just need to redirect here or show success
      showToast("Proceso finalizado. Pendiente de revisión.", "success");
      clearDraft();
      // Redirect to list ideally
    } catch (e) { console.error(e) }
  };

  const renderStep = () => {
    const stepId = steps[currentStep]?.id;
    switch (stepId) {
      case "client_data":
        return <Step1ClientData onNext={goNext} />;
      case "lab_data":
        return <Step2LabData onPrev={goPrev} onNext={goNext} />;
      case "equipment_lis":
        return <Step3EquipmentAndLis onPrev={goPrev} onComplete={handleCommercialFinish} />;

      // Manager Steps
      case "equipment":
        return <Step2EquipmentSelector onPrev={goPrev} onNext={goNext} />;
      case "determinations":
        return <Step3DeterminationSelector onPrev={goPrev} onNext={goNext} />;
      case "calculations":
        return <Step4CalculationsSummary onPrev={goPrev} onNext={goNext} />;
      case "rentability":
        return <Step4RentabilitySummary onPrev={goPrev} onNext={goNext} />;
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
        <Stepper currentStep={currentStep} steps={steps} />
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
