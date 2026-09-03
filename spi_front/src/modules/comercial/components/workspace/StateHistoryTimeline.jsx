import React, { useEffect, useState } from "react";
import { FiCheckCircle, FiXCircle, FiAlertTriangle, FiClock, FiZap } from "react-icons/fi";

const STATE_META = {
  DRAFT_INICIAL:            { label: "Borrador Inicial",         color: "bg-gray-200",   dot: "bg-gray-400" },
  DATOS_BASE_COMPLETOS:     { label: "Datos Completos",          color: "bg-blue-100",   dot: "bg-blue-500" },
  EN_EVALUACION_VIABILIDAD: { label: "En Evaluación",            color: "bg-yellow-100", dot: "bg-yellow-500" },
  OBSERVADO_POR_VIABILIDAD: { label: "Observado",                color: "bg-orange-100", dot: "bg-orange-500" },
  VIABLE:                   { label: "Viable",                   color: "bg-green-100",  dot: "bg-green-500" },
  AJUSTES_OPERATIVOS:       { label: "Ajustes Operativos",       color: "bg-indigo-100", dot: "bg-indigo-500" },
  CERRADO_PARA_APROBACION:  { label: "Cerrado para Aprobación",  color: "bg-purple-100", dot: "bg-purple-500" },
  RECHAZADO_POR_GERENCIA:   { label: "Rechazado",                color: "bg-red-100",    dot: "bg-red-500" },
  CANCELADO:                { label: "Cancelado",                color: "bg-slate-100",  dot: "bg-slate-400" },
};

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-EC", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

const StateHistoryTimeline = ({ businessCaseId, fetchHistory }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!businessCaseId || !fetchHistory) return;
    setLoading(true);
    fetchHistory(businessCaseId)
      .then(data => {
        setHistory(data?.history || []);
        setError(null);
      })
      .catch(err => setError(err?.message || "Error cargando historial"))
      .finally(() => setLoading(false));
  }, [businessCaseId, fetchHistory]);

  if (loading) return (
    <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
      <FiClock className="animate-spin" size={14} /> Cargando historial...
    </div>
  );
  if (error) return (
    <div className="flex items-center gap-2 py-4 text-sm text-red-600">
      <FiAlertTriangle size={14} /> {error}
    </div>
  );
  if (!history.length) return (
    <p className="py-4 text-sm text-gray-500">Sin transiciones registradas.</p>
  );

  return (
    <div className="relative">
      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-200" aria-hidden />
      <ol className="space-y-4">
        {history.map((item, idx) => {
          const toMeta = STATE_META[item.to_state] || { label: item.to_state, dot: "bg-gray-400", color: "bg-gray-50" };
          const isNegative = ["CANCELADO", "RECHAZADO_POR_GERENCIA"].includes(item.to_state);
          const isEmergency = item.metadata?.emergency === true;

          return (
            <li key={item.id || idx} className="relative pl-8">
              {/* Timeline dot */}
              <span className={`absolute left-1 top-2 h-5 w-5 rounded-full border-2 border-white ${toMeta.dot} flex items-center justify-center`}>
                {isEmergency && <FiZap size={10} className="text-white" />}
                {!isEmergency && isNegative && <FiXCircle size={10} className="text-white" />}
                {!isEmergency && !isNegative && idx === history.length - 1 && (
                  <FiCheckCircle size={10} className="text-white" />
                )}
              </span>

              <div className={`rounded-xl border px-4 py-3 ${isNegative ? "border-red-100 bg-red-50" : isEmergency ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-white"}`}>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${toMeta.color}`}>
                    {toMeta.label}
                  </span>
                  {isEmergency && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                      Emergencia
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">{formatDateTime(item.transitioned_at)}</span>
                </div>

                {item.from_state && (
                  <p className="text-xs text-gray-500">
                    Desde: <span className="font-medium">{STATE_META[item.from_state]?.label || item.from_state}</span>
                  </p>
                )}

                {item.reason && (
                  <p className="mt-1 text-xs text-gray-600 italic">"{item.reason}"</p>
                )}

                {(item.transitioned_by_name || item.transitioned_by_email) && (
                  <p className="mt-1 text-xs text-gray-500">
                    Por: {item.transitioned_by_name || item.transitioned_by_email}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default StateHistoryTimeline;
