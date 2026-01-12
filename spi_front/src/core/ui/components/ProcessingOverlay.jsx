import React from "react";
import { createPortal } from "react-dom";
import { FiLoader, FiCheckCircle } from "react-icons/fi";
import clsx from "clsx";

const ProcessingOverlay = ({ title, steps = [], activeStep, className = "" }) => {
  const overlay = (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm ${className}`}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FiLoader className="animate-spin text-xl" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Procesando
            </p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{title}</p>
          </div>
        </div>

        {steps.length > 0 && (
          <div className="mt-5 space-y-2">
            {steps.map((step) => {
              const isActive = step.id === activeStep;
              const isDone = steps.findIndex((s) => s.id === activeStep) > steps.findIndex((s) => s.id === step.id);
              return (
                <div
                  key={step.id}
                  className={clsx(
                    "flex items-center gap-3 rounded-xl border p-3 text-sm transition",
                    isActive
                      ? "border-primary/60 bg-primary/5 text-primary"
                      : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200"
                  )}
                >
                  <div
                    className={clsx(
                      "flex h-8 w-8 items-center justify-center rounded-full border",
                      isActive
                        ? "border-primary bg-white text-primary"
                        : "border-slate-200 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-900"
                    )}
                  >
                    {isDone ? <FiCheckCircle /> : <FiLoader className={clsx(isActive && "animate-spin")}/>}
                  </div>
                  <div>
                    <p className="font-semibold">{step.label}</p>
                    {step.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{step.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Estamos trabajando en tu solicitud, puedes permanecer en esta página.
        </p>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(overlay, document.body);
  }

  return overlay;
};

export default ProcessingOverlay;
