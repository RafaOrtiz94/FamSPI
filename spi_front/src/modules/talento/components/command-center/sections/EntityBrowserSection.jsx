import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiChevronDown, FiChevronUp, FiSearch } from "react-icons/fi";
import CommandCenterEntityBrowser from "../CommandCenterEntityBrowser";

const VIEW_OPTIONS = [
  { key: "requests", label: "Contratación" },
  { key: "collaborators", label: "Colaboradores" },
];

/**
 * Sección colapsable del browser de entidades para evitar sidebars intrusivos.
 */
const EntityBrowserSection = ({
  open = true,
  onToggle,
  activeView = "requests",
  onChangeView,
  searchQuery = "",
  onSearchChange,
  browserProps,
}) => {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 lg:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Contexto operativo
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              Navegador unificado
            </h2>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:bg-slate-100"
          >
            {open ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
            {open ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {VIEW_OPTIONS.map((option) => {
            const isActive = activeView === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onChangeView?.(option.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <label className="relative block">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="Buscar por nombre, numero, area o correo"
            className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white focus:ring-2 focus:ring-slate-200"
          />
        </label>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="entity-browser-pane"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="p-4 lg:p-6">
              <CommandCenterEntityBrowser
                {...browserProps}
                activeView={activeView}
                onChangeView={onChangeView}
                searchQuery={searchQuery}
                onSearchChange={onSearchChange}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default EntityBrowserSection;
