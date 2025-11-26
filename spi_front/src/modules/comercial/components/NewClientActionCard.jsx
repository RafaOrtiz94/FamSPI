import React from "react";
import { FiUserPlus, FiShield } from "react-icons/fi";

const badges = [
  { label: "LOPDP", icon: FiShield },
  { label: "Documentos", icon: FiUserPlus },
];

const NewClientActionCard = ({ onClick, className = "" }) => (
  <div
    className={`flex h-full flex-col justify-between rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-6 shadow-sm transition hover:shadow-md dark:border-emerald-900/30 dark:from-emerald-950/40 dark:via-gray-900 dark:to-gray-900 ${className}`}
  >
    <div className="flex flex-col items-center text-center space-y-3">
      <div className="rounded-2xl bg-emerald-600 p-4 text-white shadow-sm">
        <FiUserPlus size={28} />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
          Nuevo cliente
        </p>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
          Registra clientes directos
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          Completa la ficha con datos de facturación, tesorería y logística con consentimiento LOPDP.
        </p>
      </div>
    </div>

    <div className="mt-5 flex flex-col items-center gap-3">
      <div className="flex flex-wrap gap-2 justify-center">
        {badges.map((badge) => (
          <span
            key={badge.label}
            className="inline-flex items-center rounded-full bg-emerald-100/80 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
          >
            {badge.label}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={onClick}
        className="w-full inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        Crear solicitud
      </button>
    </div>
  </div>
);

export default NewClientActionCard;
