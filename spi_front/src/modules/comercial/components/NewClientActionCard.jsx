import React from "react";
import { FiUserPlus, FiShield } from "react-icons/fi";

const badges = [
  { label: "LOPDP", icon: FiShield },
  { label: "Documentos", icon: FiUserPlus },
];

const NewClientActionCard = ({ onClick, className = "" }) => (
  <div
    className={`rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm dark:border-emerald-900/30 dark:from-emerald-950/40 dark:via-gray-900 dark:to-gray-900 ${className}`}
  >
    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
          Nuevo cliente
        </p>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          Registra clientes directos desde el panel comercial
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Completa la ficha con datos de facturación, tesorería y logística. Decide si enviaremos el correo automático de
          consentimiento o si adjuntarás la evidencia existente para que Backoffice cuente con la auditoría completa.
        </p>
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-white/70 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100"
            >
              {React.createElement(badge.icon, { className: "text-base" })}
              {badge.label}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-700"
      >
        Crear ficha de cliente
      </button>
    </div>
  </div>
);

export default NewClientActionCard;
