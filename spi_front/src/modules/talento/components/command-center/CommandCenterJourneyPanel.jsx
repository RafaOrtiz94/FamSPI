import React from "react";
import clsx from "clsx";

const statusStyles = {
  complete: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "border-emerald-300 bg-emerald-100 text-emerald-600",
  },
  current: {
    border: "border-sky-200",
    bg: "bg-sky-50",
    text: "text-sky-700",
    dot: "border-sky-300 bg-sky-100 text-sky-600",
  },
  warning: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "border-amber-300 bg-amber-100 text-amber-600",
  },
  pending: {
    border: "border-slate-200",
    bg: "bg-white",
    text: "text-slate-700",
    dot: "border-slate-300 bg-slate-100 text-slate-500",
  },
};

const clampPercent = (value) => Math.max(0, Math.min(100, value ?? 0));

const CommandCenterJourneyPanel = ({
  title,
  description,
  progress = {},
  steps = [],
  aside,
}) => {
  const percent =
    typeof progress?.percent === "number"
      ? clampPercent(progress.percent)
      : progress?.total > 0
      ? clampPercent(((progress.done ?? 0) / progress.total) * 100)
      : 0;
  const roundedPercent = Math.round(percent);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm shadow-slate-900/5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex-1 space-y-2">
          {title && (
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              {title}
            </p>
          )}
          {description && <p className="text-lg font-semibold text-slate-900">{description}</p>}
        </div>
        {aside && (
          <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-600 shadow-inner lg:ml-6">
            {aside}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            <span>Progreso</span>
            <span>{roundedPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-slate-900 to-emerald-500 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
            <span>{progress.done ?? 0} completados</span>
            <span>{progress.total ?? 0} pasos</span>
          </div>
        </div>

        <div className="space-y-3">
          {steps.map((step) => {
            const status = statusStyles[step.status] || statusStyles.pending;
            const label = step.label || "Sin titulo";
            return (
              <div
                key={step.key || label}
                className={clsx(
                  "flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center",
                  status.border,
                  status.bg
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={clsx(
                      "flex h-10 w-10 items-center justify-center rounded-2xl border-2 font-semibold",
                      status.dot
                    )}
                  >
                    {step.status === "complete"
                      ? "C"
                      : step.status === "current"
                      ? "O"
                      : step.status === "warning"
                      ? "!"
                      : step.key || "o"}
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className={clsx("text-sm font-semibold", status.text)}>{label}</p>
                    {step.detail && <p className="text-sm text-slate-500">{step.detail}</p>}
                  </div>
                </div>
                <div className="flex flex-1 flex-col items-end justify-between gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    {step.status}
                  </span>
                  {step.actionLabel && step.onAction && (
                    <button
                      type="button"
                      onClick={step.onAction}
                      className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                    >
                      {step.actionLabel}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CommandCenterJourneyPanel;
