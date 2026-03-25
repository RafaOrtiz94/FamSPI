import React from "react";
import clsx from "clsx";

const CommandCenterContextPanel = ({
  tabs = [],
  activeTab,
  onChangeTab,
  children,
  footer,
}) => {
  const handleClick = (key, disabled) => {
    if (disabled) return;
    onChangeTab?.(key);
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm shadow-slate-900/5">
      <div className="flex flex-wrap gap-3 border-b border-slate-100 pb-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              disabled={tab.disabled}
              onClick={() => handleClick(tab.key, tab.disabled)}
              className={clsx(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition",
                isActive
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/30"
                  : "border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900",
                tab.disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="mt-5">{children}</div>
      {footer && <div className="mt-6 border-t border-slate-100 pt-4">{footer}</div>}
    </div>
  );
};

export default CommandCenterContextPanel;
