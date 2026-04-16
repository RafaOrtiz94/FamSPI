import React, { useMemo, useState } from "react";
import { FiAward, FiBookOpen, FiClipboard, FiFileText, FiShield, FiTrendingUp } from "react-icons/fi";
import { useAuth } from "../../../core/auth/useAuth";
import CA0103Stepper from "../components/CA0103Stepper";
import { useGetWorkflowSnapshot } from "../hooks/useCa0103Queries";

const laneCards = [
  {
    key: "training",
    title: "Training",
    description: "Seguimiento de capacitaciones, asistencia y cierre documental.",
    accent: "from-cyan-500 to-sky-500",
    icon: FiBookOpen,
  },
  {
    key: "exams",
    title: "Exams",
    description: "Consolidación de evaluaciones, resultados y aprobaciones.",
    accent: "from-emerald-500 to-teal-500",
    icon: FiClipboard,
  },
  {
    key: "certifications",
    title: "Certifications",
    description: "Gestión de certificaciones, renovaciones y archivos GXP.",
    accent: "from-violet-500 to-fuchsia-500",
    icon: FiAward,
  },
];

const summaryCards = [
  {
    title: "Flujos activos",
    value: "3",
    helper: "Training, exams y certifications preparados para operación.",
    icon: FiTrendingUp,
  },
  {
    title: "Estado controlado",
    value: "100%",
    helper: "Bloqueo de transiciones ilegales mediante state machine.",
    icon: FiShield,
  },
  {
    title: "Trazabilidad",
    value: "GXP",
    helper: "Snapshots y auditoría listos para acoplar persistencia.",
    icon: FiFileText,
  },
];

const CA0103Workspace = () => {
  const { user } = useAuth();
  const [flowName, setFlowName] = useState("training");
  const [record, setRecord] = useState({
    id: "ca0103-demo-001",
    status: "draft",
    notes: "Registro de demostracion para Buenas Practicas.",
    updatedAt: new Date().toISOString(),
  });

  const { data: snapshot } = useGetWorkflowSnapshot({ flowName, record });

  const headerMetrics = useMemo(
    () => [
      { label: "Estado actual", value: snapshot?.status || record.status },
      { label: "Flujo", value: snapshot?.flowName || flowName },
      { label: "Terminal", value: snapshot?.isTerminal ? "Si" : "No" },
    ],
    [flowName, record.status, snapshot],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-violet-200">
                <FiShield />
                CA-01-03 | Buenas Prácticas
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Command Center de formación y certificación
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  Administra training, exams y certifications con una vista unificada,
                  trazable y lista para acoplar stepper, hooks y documentos de cierre.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Operador activo</p>
              <p className="mt-1 text-lg font-semibold text-white">{user?.name || "Auditor GXP"}</p>
              <p className="text-sm text-violet-300">{user?.role || "calidad"}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
                <div className="flex items-center gap-3 text-slate-300">
                  <Icon className="text-violet-300" />
                  <span className="text-sm font-semibold uppercase tracking-[0.24em]">{card.title}</span>
                </div>
                <p className="mt-4 text-3xl font-black text-white">{card.value}</p>
                <p className="mt-1 text-xs text-slate-400">{card.helper}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Workflows disponibles</h2>
                <p className="text-sm text-slate-400">
                  Cada carril representa un flujo del epic CA-01-03.
                </p>
              </div>
              <div className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                Ready for stepper
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {laneCards.map((lane) => {
                const Icon = lane.icon;
                return (
                  <article
                    key={lane.key}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 transition hover:border-violet-400/30 hover:bg-slate-950"
                  >
                    <div className={`mb-4 inline-flex rounded-2xl bg-gradient-to-br ${lane.accent} p-3 text-white shadow-lg`}>
                      <Icon size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-white">{lane.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{lane.description}</p>
                    <div className="mt-4 rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                      Stepper pendiente de integracion
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Flujo
                  </span>
                  <select
                    value={flowName}
                    onChange={(event) => setFlowName(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="training">Training</option>
                    <option value="exams">Exams</option>
                    <option value="certifications">Certifications</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setRecord((current) => ({
                      ...current,
                      status:
                        current.status === "draft"
                          ? "review"
                          : current.status === "review"
                            ? "approved"
                            : current.status === "approved"
                              ? "archived"
                              : "draft",
                    }))
                  }
                  className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20"
                >
                  Simular siguiente estado
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {headerMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{metric.label}</p>
                    <p className="mt-1 text-sm font-bold text-white">{metric.value}</p>
                  </div>
                ))}
              </div>

              <CA0103Stepper
                flowName={flowName}
                record={snapshot?.record || record}
                currentUser={user}
                onTransitionSuccess={({ toStatus, notes: nextNotes }) =>
                  setRecord((current) => ({
                    ...current,
                    status: toStatus,
                    notes: nextNotes,
                    updatedAt: new Date().toISOString(),
                  }))
                }
              />
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                Estado del módulo
              </h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="text-sm text-slate-300">State machine</span>
                  <span className="text-sm font-bold text-emerald-300">Activa</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="text-sm text-slate-300">Controller</span>
                  <span className="text-sm font-bold text-emerald-300">Listo</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="text-sm text-slate-300">Routes</span>
                  <span className="text-sm font-bold text-emerald-300">Privadas</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-cyan-500/10 p-6">
              <h3 className="text-lg font-bold text-white">Siguiente entrega</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                El siguiente paso es el stepper de transición para training/exams/certifications
                y luego la integración de hooks de datos.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
};

export default CA0103Workspace;
