import React from "react";

const toneStyles = {
  positive: {
    border: "border-hr-success/30",
    accent: "bg-hr-success/40",
    label: "text-hr-success-muted",
  },
  warning: {
    border: "border-hr-warning/30",
    accent: "bg-hr-warning/40",
    label: "text-hr-warning-muted",
  },
  critical: {
    border: "border-hr-warning/35",
    accent: "bg-hr-warning/45",
    label: "text-hr-warning-muted",
  },
  info: {
    border: "border-brand-hr-primary/25",
    accent: "bg-brand-hr-primary/30",
    label: "text-brand-hr-primary",
  },
  default: {
    border: "border-brand-hr-primary/20",
    accent: "bg-brand-hr-primary/20",
    label: "text-brand-hr-primary",
  },
};

const CommandCenterSummaryStrip = ({ items = [] }) => {
  if (!items.length) return null;

  return (
    <div className="-mx-3 flex w-full overflow-x-auto px-3 py-1">
      <div className="flex w-full min-w-full gap-3">
        {items.map(({ key, label, value, hint, tone }) => {
          const style = toneStyles[tone] || toneStyles.default;
          return (
            <div
              key={key || label}
              className={`flex min-w-[190px] max-w-[280px] flex-1 flex-col gap-2 rounded-2xl border bg-brand-hr-primary-contrast px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${style.border}`}
            >
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-hr-primary-muted">
                <span>{label}</span>
                <span className={`h-2 w-2 rounded-full ${style.accent}`}></span>
              </div>
              <p className={`text-2xl font-semibold leading-tight ${style.label}`}>{value ?? "-"}</p>
              {hint && <p className="text-xs text-brand-hr-primary-muted">{hint}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CommandCenterSummaryStrip;
