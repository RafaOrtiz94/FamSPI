import React from "react";

const STATUS_CONFIG = {
  borrador:          { label: "Borrador",               cls: "bg-slate-100 text-slate-600" },
  programada:        { label: "Agendada",               cls: "bg-blue-100 text-blue-700" },
  en_curso:          { label: "En progreso",            cls: "bg-indigo-100 text-indigo-700" },
  completada:        { label: "Realizada",              cls: "bg-green-100 text-green-700" },
  acta_generada:     { label: "Registro listo",         cls: "bg-amber-100 text-amber-700" },
  en_firma:          { label: "Esperando firmas",       cls: "bg-purple-100 text-purple-700" },
  firmada:           { label: "Todos firmaron",         cls: "bg-green-100 text-green-800" },
  cancelada:         { label: "Cancelada",              cls: "bg-red-100 text-red-700" },
};

const TYPE_CONFIG = {
  interna:               { label: "Instructor interno" },
  externa_instructor:    { label: "Instructor externo" },
  externa_desplazamiento:{ label: "Desplazamiento" },
};

export function TrainingStatusBadge({ status, className = "" }) {
  const cfg = STATUS_CONFIG[status] || { label: status || "—", cls: "bg-slate-100 text-slate-500" };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls} ${className}`}>
      {cfg.label}
    </span>
  );
}

export function TrainingTypeBadge({ type, className = "" }) {
  const cfg = TYPE_CONFIG[type] || { label: type || "—" };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 ${className}`}>
      {cfg.label}
    </span>
  );
}

export function TrainingSignatureProgress({ total = 0, signed = 0, label = "personas han firmado" }) {
  const pct = total > 0 ? Math.round((signed / total) * 100) : 0;
  const allDone = pct === 100;
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={`text-xs font-semibold ${allDone ? "text-green-700" : "text-slate-700"}`}>
          {signed} de {total}
        </span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${allDone ? "bg-green-500" : "bg-blue-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`text-right text-xs mt-0.5 ${allDone ? "text-green-600 font-medium" : "text-slate-400"}`}>
        {allDone ? "¡Todos firmaron!" : `${pct}% completado`}
      </p>
    </div>
  );
}
