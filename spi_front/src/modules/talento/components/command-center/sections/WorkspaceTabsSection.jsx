import React from "react";
import { AnimatePresence, motion } from "framer-motion";

const WorkspaceTabsSection = ({ tabs = [], activeTab, onChangeTab, children, footer }) => {
  return (
    <section className="rounded-3xl border border-brand-hr-primary/15 bg-brand-hr-primary-contrast shadow-sm">
      <div className="border-b border-brand-hr-primary/15 px-4 py-3 sm:px-6">
        <div className="sm:hidden">
          <label htmlFor="workspace-tab-selector" className="sr-only">
            Seleccionar pestaña de workspace
          </label>
          <select
            id="workspace-tab-selector"
            value={activeTab}
            onChange={(event) => onChangeTab?.(event.target.value)}
            className="w-full rounded-xl border border-brand-hr-primary/20 bg-brand-hr-primary-soft px-3 py-2 text-sm font-medium text-brand-hr-primary outline-none transition focus:border-brand-hr-primary focus:ring-2 focus:ring-brand-hr-primary/20"
          >
            {tabs.map((tab) => (
              <option key={tab.key} value={tab.key} disabled={tab.disabled}>
                {tab.label}
                {tab.badge !== undefined && tab.badge !== null ? ` (${tab.badge})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden flex-wrap gap-2 sm:flex">
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
                    ? "text-brand-hr-primary-contrast"
                    : "border border-brand-hr-primary/20 bg-brand-hr-primary-contrast text-brand-hr-primary hover:bg-brand-hr-primary-soft"
                } ${tab.disabled ? "cursor-not-allowed opacity-40" : ""}`}
              >
                {isActive ? (
                  <motion.span
                    layoutId="workspace-active-tab-pill"
                    className="absolute inset-0 rounded-full bg-brand-hr-primary"
                    transition={{ type: "spring", stiffness: 340, damping: 30 }}
                  />
                ) : null}
                <span className="relative z-10">{tab.label}</span>
                {tab.badge !== undefined && tab.badge !== null ? (
                  <span
                    className={`relative z-10 ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      isActive
                        ? "bg-brand-hr-primary-contrast/25 text-brand-hr-primary-contrast"
                        : "bg-brand-hr-primary-soft text-brand-hr-primary-muted"
                    }`}
                  >
                    {tab.badge}
                  </span>
                ) : null}
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

      {footer ? (
        <div className="border-t border-brand-hr-primary/15 px-4 py-4 sm:px-6">{footer}</div>
      ) : null}
    </section>
  );
};

export default WorkspaceTabsSection;
