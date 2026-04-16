import React, { useMemo, useState } from "react";
import { FiAward, FiArrowRight, FiBookOpen, FiCheckCircle, FiFileText, FiShield } from "react-icons/fi";
import { useTransitionWorkflowRecord } from "../hooks/useCa0103Queries";
import CA0103AuthModal from "./CA0103AuthModal";
import { generateCa0103Pdf } from "../utils/ca0103PdfGenerator";

const STATES = [
  { id: "draft", label: "Borrador", tone: "bg-amber-500" },
  { id: "review", label: "Revision", tone: "bg-sky-500" },
  { id: "approved", label: "Aprobado", tone: "bg-emerald-500" },
  { id: "archived", label: "Archivado", tone: "bg-violet-500" },
];

const FLOW_LABELS = {
  training: "Training",
  exams: "Exams",
  certifications: "Certifications",
};

const FLOW_ICONS = {
  training: FiBookOpen,
  exams: FiCheckCircle,
  certifications: FiAward,
};

const CA0103Stepper = ({ flowName = "training", record = {}, currentUser, onTransitionSuccess }) => {
  const [notes, setNotes] = useState("");
  const [errorDesc, setErrorDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const transitionWorkflowRecord = useTransitionWorkflowRecord();

  const currentIndex = useMemo(
    () => STATES.findIndex((state) => state.id === String(record.status || "draft").toLowerCase()),
    [record.status],
  );

  const nextState = STATES[currentIndex + 1];
  const isTerminal = currentIndex === STATES.length - 1;
  const FlowIcon = FLOW_ICONS[flowName] || FiShield;

  const executeTransition = async () => {
    try {
      setLoading(true);
      setErrorDesc("");
      const updated = await transitionWorkflowRecord.mutateAsync({
        flowName,
        record,
        toStatus: nextState.id,
        notes: notes || `Avance manual por ${currentUser?.name || "operador GXP"}.`,
      });
      if (!nextState) {
        return;
      }
      if (notes.trim().length > 0 && notes.trim().length < 3) {
        throw new Error("Observaciones demasiado cortas para trazabilidad GXP.");
      }

      if (onTransitionSuccess) {
        onTransitionSuccess({
          ...updated,
          flowName,
          fromStatus: record.status || "draft",
          toStatus: nextState.id,
          notes: notes || `Avance manual por ${currentUser?.name || "operador GXP"}.`,
        });
      }
      setNotes("");
    } catch (error) {
      setErrorDesc(error?.message || "No fue posible ejecutar la transicion.");
    } finally {
      setLoading(false);
    }
  };

  const requestTransition = () => {
    if (nextState?.id === "archived") {
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
          <h3 className="mt-1 text-lg font-bold text-white">
            {FLOW_LABELS[flowName] || flowName}
          </h3>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
          <FlowIcon />
          {currentUser?.role || "calidad"}
        </div>
      </div>

      <div className="relative mt-6 flex items-center justify-between">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
        <div
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-violet-400 transition-all duration-300"
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
                } ${active ? "ring-4 ring-violet-400/20" : ""}`}
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
            Observaciones
          </span>
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Agrega contexto de QA, aprobacion o hallazgo."
            className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400"
            disabled={loading || isTerminal}
          />
        </label>

        <button
          type="button"
          onClick={requestTransition}
          disabled={loading || isTerminal || !nextState}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          <FiArrowRight />
          {loading ? "Procesando..." : nextState ? `Avanzar a ${nextState.label}` : "Ciclo completo"}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
        <FiShield />
        {isTerminal ? "Flujo archivado y listo para historial" : "Transicion con bloqueo de integridad"}
      </div>

      {isTerminal ? (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <FiFileText />
              Flujo cerrado. Pendiente de generacion documental final.
            </div>
            <button
              type="button"
              onClick={() => generateCa0103Pdf({ flowName, record, user: currentUser })}
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-400/20"
            >
              Generar PDF
            </button>
          </div>
        </div>
      ) : null}

      <CA0103AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={executeTransition}
        actionLabel={`Aprobar: ${nextState?.label || "cierre"}`}
      />
    </div>
  );
};

export default CA0103Stepper;
