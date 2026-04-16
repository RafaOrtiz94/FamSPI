import React, { useMemo, useState } from "react";
import { FiCheckCircle, FiLock, FiShield, FiArrowRight, FiFileText } from "react-icons/fi";
import { useTransitionLog } from "../hooks/useCa0102Queries";
import CA0102AuthModal from "./CA0102AuthModal";
import { generateCa0102Pdf } from "../utils/ca0102PdfGenerator";

const STATES = [
  { id: "pending", label: "Programada", tone: "bg-amber-500", requiresQa: false },
  { id: "in_progress", label: "En proceso", tone: "bg-sky-500", requiresQa: false },
  { id: "completed", label: "Completada", tone: "bg-emerald-500", requiresQa: true },
  { id: "verified", label: "Verificada", tone: "bg-violet-500", requiresQa: true },
];

const CA0102Stepper = ({ log, currentUser, onTransitionSuccess }) => {
  const [notes, setNotes] = useState("");
  const [errorDesc, setErrorDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const transitionLog = useTransitionLog();

  const currentIndex = useMemo(
    () => STATES.findIndex((state) => state.id === log?.status),
    [log?.status],
  );

  const nextState = STATES[currentIndex + 1];
  const isTerminal = currentIndex === STATES.length - 1;

  const executeTransition = async () => {
    if (!nextState) return;

    try {
      setLoading(true);
      setErrorDesc("");
      await transitionLog.mutateAsync({
        logId: log.id,
        toStatus: nextState.id,
        qaNotes: notes || `Transicion ejecutada por ${currentUser?.name || "operador GXP"}.`,
      });
      setNotes("");
      if (onTransitionSuccess) {
        onTransitionSuccess();
      }
    } catch (error) {
      setErrorDesc(error?.response?.data?.message || "No fue posible ejecutar la transicion.");
    } finally {
      setLoading(false);
    }
  };

  const requestTransition = () => {
    if (nextState?.requiresQa) {
      setAuthOpen(true);
      return;
    }
    executeTransition();
  };

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-inner">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Secuencia GXP</p>
          <h3 className="mt-1 text-lg font-bold text-white">Stepper de limpieza</h3>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
          <FiShield />
          {currentUser?.role || "calidad"}
        </div>
      </div>

      <div className="relative mt-6 flex items-center justify-between">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
        <div
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-cyan-400 transition-all duration-300"
          style={{
            width: `${Math.max((Math.max(currentIndex, 0) / (STATES.length - 1)) * 100, 0)}%`,
          }}
        />

        {STATES.map((state, index) => {
          const completed = index <= currentIndex;
          const active = index === currentIndex + 1;

          return (
            <div key={state.id} className="relative z-10 flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-black text-white transition-all ${
                  completed ? `${state.tone} border-transparent` : "border-white/20 bg-slate-900 text-slate-500"
                } ${active ? "ring-4 ring-cyan-400/20" : ""}`}
              >
                {completed ? <FiCheckCircle /> : index + 1}
              </div>
              <span className={`mt-2 max-w-20 text-center text-[10px] font-semibold uppercase tracking-[0.18em] ${completed ? "text-white" : "text-slate-500"}`}>
                {state.label}
              </span>
            </div>
          );
        })}
      </div>

      {errorDesc ? (
        <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {errorDesc}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Observaciones de QA
          </span>
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Deja evidencia del avance, validacion o hallazgo."
            className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
            disabled={loading || isTerminal}
          />
        </label>

        <button
          type="button"
          onClick={requestTransition}
          disabled={loading || isTerminal || !nextState}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          <FiArrowRight />
          {loading ? "Procesando..." : nextState ? `Avanzar a ${nextState.label}` : "Ciclo completo"}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
        <FiLock />
        {isTerminal ? "Estado final alcanzado" : nextState?.requiresQa ? "Siguiente paso requiere validacion QA" : "Siguiente paso operativo"}
      </div>

      {isTerminal ? (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <FiFileText />
              Flujo de limpieza cerrado y listo para archivo.
            </div>
            <button
              type="button"
              onClick={() => generateCa0102Pdf(log)}
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-400/20"
            >
              Generar PDF
            </button>
          </div>
        </div>
      ) : null}

      <CA0102AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={executeTransition}
        actionLabel={`Aprobar: ${nextState?.label || "cierre"}`}
      />
    </div>
  );
};

export default CA0102Stepper;
