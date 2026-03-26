import React from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Tabs horizontales del workspace con transición animada.
 */
const WorkspaceTabsSection = ({
  tabs = [],
  activeTab,
  onChangeTab,
  children,
  footer,
}) => {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onChangeTab?.(tab.key)}
                disabled={tab.disabled}
                className={`relative rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? "text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                } ${tab.disabled ? "cursor-not-allowed opacity-40" : ""}`}
              >
                {isActive && (
                  <motion.span
                    layoutId="workspace-active-tab-pill"
                    className="absolute inset-0 rounded-full bg-slate-900"
                    transition={{ type: "spring", stiffness: 340, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
                {tab.badge !== undefined && tab.badge !== null && (
                  <span
                    className={`relative z-10 ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
      {footer ? <div className="border-t border-slate-200 px-4 py-4 sm:px-6">{footer}</div> : null}
    </section>
  );
};

export default WorkspaceTabsSection;
