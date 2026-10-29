import React, { useState } from "react";
import { FiBell, FiLoader, FiX } from "react-icons/fi";

export default function TrainingFamSignFab({ training, actions, onRefresh }) {
  const [open, setOpen]     = useState(false);
  const [busyM, setBusyM]   = useState(false);
  const [busyA, setBusyA]   = useState(false);
  const [feedback, setFeedback] = useState(null);

  // "pending" nunca es un valor real de signature-workflows (los estados son
  // prepared/sent/in_progress/partially_signed/completed/rejected/cancelled)
  // -- con la lista vieja, un workflow recien enviado (status "sent", el mas
  // comun) nunca activaba el recordatorio ni se mostraba como en curso.
  const ACTIVE_STATUSES = ["prepared", "sent", "in_progress", "partially_signed"];
  const hasMain   = ACTIVE_STATUSES.includes(training?.signature_workflow_status);
  const hasAbsent = ACTIVE_STATUSES.includes(training?.absent_workflow_status);

  if (!hasMain && !hasAbsent) return null;

  const remind = async (type) => {
    const setB = type === "main" ? setBusyM : setBusyA;
    setB(true);
    setFeedback(null);
    try {
      if (type === "main") {
        await actions.remindMain(training.id);
        setFeedback("Se enviaron recordatorios a quienes aún no han firmado");
      } else {
        await actions.remindAbsent(training.id);
        setFeedback("Se enviaron recordatorios a las personas que no asistieron");
      }
      await onRefresh();
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      setFeedback(err?.response?.data?.message || err?.message || "No se pudieron enviar los recordatorios");
    } finally {
      setB(false);
    }
  };

  const sigTotal  = training?.signature_total_signers || 0;
  const sigSigned = training?.signature_signed_count  || 0;

  return (
    <>
      {/* Feedback toast */}
      {feedback && (
        <div className="fixed bottom-28 right-5 z-50 bg-slate-800 text-white text-sm px-4 py-3 rounded-xl shadow-xl max-w-xs animate-fade-in">
          {feedback}
        </div>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1E293B] to-[#2563EB] px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-semibold">Recordar a quienes no han firmado</p>
              {sigTotal > 0 && (
                <p className="text-blue-200 text-xs">{sigSigned} de {sigTotal} personas ya firmaron</p>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <FiX size={18} />
            </button>
          </div>

          {/* Barra de progreso */}
          {sigTotal > 0 && (
            <div className="px-4 pt-3">
              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.round((sigSigned / sigTotal) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="p-4 space-y-2">
            {hasMain && (
              <button
                onClick={() => remind("main")}
                disabled={busyM}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {busyM ? <FiLoader size={15} className="animate-spin" /> : <FiBell size={15} />}
                <div className="text-left">
                  <p className="font-semibold">Recordar a los participantes</p>
                  <p className="text-xs text-blue-500">Los que aún no firmaron recibirán un aviso</p>
                </div>
              </button>
            )}

            {hasAbsent && (
              <button
                onClick={() => remind("absent")}
                disabled={busyA}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {busyA ? <FiLoader size={15} className="animate-spin" /> : <FiBell size={15} />}
                <div className="text-left">
                  <p className="font-semibold">Recordar a quienes no asistieron</p>
                  <p className="text-xs text-amber-500">Los ausentes recibirán su solicitud de firma</p>
                </div>
              </button>
            )}

            <p className="text-center text-xs text-slate-400 pt-1">
              Solo se envía si la persona aún no ha firmado
            </p>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`fixed bottom-6 right-5 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all
          ${open ? "bg-slate-700" : "bg-gradient-to-br from-blue-600 to-blue-800"}
          hover:scale-105 active:scale-95`}
        title="Enviar recordatorios de firma"
      >
        {open ? (
          <FiX size={22} className="text-white" />
        ) : (
          <>
            <FiBell size={22} className="text-white" />
            {(hasMain || hasAbsent) && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                {(hasMain ? 1 : 0) + (hasAbsent ? 1 : 0)}
              </span>
            )}
          </>
        )}
      </button>
    </>
  );
}
