import React, { useMemo, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiRefreshCw, FiShield, FiThermometer } from "react-icons/fi";
import { useAuth } from "../../../core/auth/useAuth";
import CA0102Stepper from "../components/CA0102Stepper";
import {
  useGetActiveLogs,
  useGetAreas,
  useRegisterCleaning,
  useTransitionLog,
} from "../hooks/useCa0102Queries";

const statusMeta = {
  pending: { label: "Pendiente", tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  in_progress: { label: "En proceso", tone: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  completed: { label: "Completado", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  verified: { label: "Verificado", tone: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
};

const CA0102Workspace = () => {
  const { user } = useAuth();
  const [riskLevel, setRiskLevel] = useState("");
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [form, setForm] = useState({
    areaId: "",
    cleaningType: "routine",
    notes: "",
  });

  const { data: areas = [], isLoading: loadingAreas, refetch: refetchAreas } = useGetAreas({ riskLevel });
  const { data: logs = [], isLoading: loadingLogs, refetch: refetchLogs } = useGetActiveLogs();
  const registerCleaning = useRegisterCleaning();
  const transitionLog = useTransitionLog();

  const metrics = useMemo(() => {
    const total = logs.length;
    const completed = logs.filter((log) => log.status === "completed" || log.status === "verified").length;
    const alerts = logs.filter((log) => log.status === "pending").length;
    return { total, completed, alerts };
  }, [logs]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await registerCleaning.mutateAsync({
      areaId: form.areaId,
      cleaningType: form.cleaningType,
      notes: form.notes,
    });
    setForm((current) => ({ ...current, notes: "" }));
    await refetchLogs();
  };

  const handleTransition = async (logId, toStatus) => {
    await transitionLog.mutateAsync({
      logId,
      toStatus,
      qaNotes: "Actualizado desde CA-01-02 Command Center.",
    });
    await refetchLogs();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
                <FiShield />
                CA-01-02 | Limpieza de Areas
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Command Center de saneamiento GXP
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  Monitorea ciclos de limpieza, clasifica el riesgo del area y ejecuta transiciones
                  de estado con trazabilidad operativa.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Operador activo</p>
              <p className="mt-1 text-lg font-semibold text-white">{user?.name || "Auditor GXP"}</p>
              <p className="text-sm text-cyan-300">{user?.role || "calidad"}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <div className="flex items-center gap-3 text-slate-300">
              <FiThermometer className="text-cyan-300" />
              <span className="text-sm font-semibold uppercase tracking-[0.24em]">Areas monitoreadas</span>
            </div>
            <p className="mt-4 text-3xl font-black text-white">{areas.length}</p>
            <p className="mt-1 text-xs text-slate-400">Filtradas por nivel de riesgo seleccionado.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <div className="flex items-center gap-3 text-slate-300">
              <FiClock className="text-amber-300" />
              <span className="text-sm font-semibold uppercase tracking-[0.24em]">Logs activos</span>
            </div>
            <p className="mt-4 text-3xl font-black text-white">{metrics.total}</p>
            <p className="mt-1 text-xs text-slate-400">Registros de limpieza y verificacion disponibles.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <div className="flex items-center gap-3 text-slate-300">
              <FiAlertTriangle className="text-rose-300" />
              <span className="text-sm font-semibold uppercase tracking-[0.24em]">Pendientes</span>
            </div>
            <p className="mt-4 text-3xl font-black text-white">{metrics.alerts}</p>
            <p className="mt-1 text-xs text-slate-400">Eventos que requieren validacion o cierre.</p>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-white">Registro de limpieza</h2>
                <p className="text-sm text-slate-400">Crea eventos sobre areas y ciclos de saneamiento.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  refetchAreas();
                  refetchLogs();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                <FiRefreshCw />
                Actualizar
              </button>
            </div>

            <form className="grid gap-4 p-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Nivel de riesgo
                  </span>
                  <select
                    value={riskLevel}
                    onChange={(event) => setRiskLevel(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  >
                    <option value="">Todos</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="sterile">Sterile</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Area
                  </span>
                  <select
                    value={form.areaId}
                    onChange={(event) => setForm((current) => ({ ...current, areaId: event.target.value }))}
                    disabled={loadingAreas}
                    className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Seleccionar area</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Tipo de limpieza
                </span>
                <select
                  value={form.cleaningType}
                  onChange={(event) => setForm((current) => ({ ...current, cleaningType: event.target.value }))}
                  className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                >
                  <option value="routine">Routine</option>
                  <option value="deep">Deep</option>
                  <option value="spill_recovery">Spill recovery</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Observaciones
                </span>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Detalle operativo, hallazgos y acciones de verificacion."
                  className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                />
              </label>

              <button
                type="submit"
                disabled={registerCleaning.isPending || !form.areaId}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                <FiCheckCircle />
                {registerCleaning.isPending ? "Registrando..." : "Registrar limpieza"}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
              <div className="border-b border-white/10 px-6 py-4">
                <h2 className="text-lg font-bold text-white">Resumen de logistica QA</h2>
                <p className="text-sm text-slate-400">Estado actual de los registros de limpieza.</p>
              </div>
              <div className="space-y-3 p-6">
                {loadingLogs ? (
                  <p className="text-sm text-slate-400">Cargando bitacora de saneamiento...</p>
                ) : (
                  logs.slice(0, 4).map((log) => (
                    <article key={log.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-white">{log.area_name || log.area?.name || "Area sin nombre"}</p>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{log.cleaning_type || "routine"}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusMeta[log.status]?.tone || statusMeta.pending.tone}`}>
                          {statusMeta[log.status]?.label || log.status || "Pendiente"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">{log.qa_notes || log.notes || "Sin observaciones registradas."}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleTransition(log.id, "completed")}
                          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                        >
                          Marcar completado
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTransition(log.id, "verified")}
                          className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/20"
                        >
                          Verificar QA
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                        >
                          {expandedLogId === log.id ? "Ocultar stepper" : "Abrir stepper"}
                        </button>
                      </div>
                      {expandedLogId === log.id ? (
                        <CA0102Stepper
                          log={log}
                          currentUser={user}
                          onTransitionSuccess={() => refetchLogs()}
                        />
                      ) : null}
                    </article>
                  ))
                )}
                {!loadingLogs && logs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                    No hay registros activos para mostrar.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Cobertura operativa</h3>
              <p className="mt-3 text-2xl font-black text-white">{metrics.completed}</p>
              <p className="mt-1 text-sm text-slate-300">
                Registros ya cerrados o verificados frente al total de la bitacora.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CA0102Workspace;
