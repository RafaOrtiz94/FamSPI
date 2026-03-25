import React from "react";

const toneStyles = {
  positive: {
    border: "border-emerald-200",
    accent: "bg-emerald-500/40",
    label: "text-emerald-700",
  },
  warning: {
    border: "border-amber-200",
    accent: "bg-amber-500/30",
    label: "text-amber-700",
  },
  critical: {
    border: "border-rose-200",
    accent: "bg-rose-500/30",
    label: "text-rose-700",
  },
  info: {
    border: "border-sky-200",
    accent: "bg-sky-500/30",
    label: "text-sky-700",
  },
  default: {
    border: "border-slate-200",
    accent: "bg-slate-900/10",
    label: "text-slate-900",
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
              className={`flex min-w-[190px] flex-1 max-w-[280px] flex-col gap-2 rounded-2xl border bg-white/80 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${style.border}`}
            >
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                <span>{label}</span>
                <span className={`h-2 w-2 rounded-full ${style.accent}`}></span>
              </div>
              <p className={`text-2xl font-semibold leading-tight ${style.label}`}>{value ?? "-"}</p>
              {hint && <p className="text-xs text-slate-500">{hint}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CommandCenterSummaryStrip;
