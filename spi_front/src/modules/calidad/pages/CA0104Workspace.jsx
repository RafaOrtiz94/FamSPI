import React, { useMemo, useState } from "react";
import { FiAlertCircle, FiLayers, FiShield, FiTarget, FiTool, FiTrendingUp } from "react-icons/fi";
import { useAuth } from "../../../core/auth/useAuth";
import CA0104Stepper from "../components/CA0104Stepper";
import {
  useGetInspections,
  useGetTrapsMaps,
  useGetToxicity,
  useGetVendorApis,
} from "../hooks/useCa0104Queries";

const laneCards = [
  {
    key: "traps_map",
    title: "Traps Map",
    description: "Mapa de trampas, cobertura por area y trazabilidad operativa.",
    accent: "from-cyan-500 to-sky-500",
    icon: FiTarget,
  },
  {
    key: "inspections",
    title: "Inspections",
    description: "Inspecciones de campo, hallazgos, verificaciones y cierre QA.",
    accent: "from-emerald-500 to-teal-500",
    icon: FiLayers,
  },
  {
    key: "vendor_api",
    title: "Vendor API",
    description: "Integraciones con proveedores y puntos de contacto externos.",
    accent: "from-violet-500 to-fuchsia-500",
    icon: FiTool,
  },
  {
    key: "toxicity",
    title: "Toxicity",
    description: "Control de quimicos, toxicidad y notas de exposicion.",
    accent: "from-amber-500 to-orange-500",
    icon: FiAlertCircle,
  },
];

const summaryCards = [
  {
    title: "Flujos activos",
    value: "4",
    helper: "Traps map, inspections, vendor api y toxicity preparados.",
    icon: FiTrendingUp,
  },
  {
    title: "RBAC",
    value: "Privado",
    helper: "Rutas protegidas para calidad, gerencia y equipos delegados.",
    icon: FiShield,
  },
  {
    title: "Trazabilidad",
    value: "GXP",
    helper: "Persistencia, state machine y worker SLA listos para integrar.",
    icon: FiTool,
  },
];

const CA0104Workspace = () => {
  const { user } = useAuth();
  const [activeFlow, setActiveFlow] = useState("traps_map");
  const [status, setStatus] = useState("draft");
  const [activeRecord, setActiveRecord] = useState({
    id: "ca0104-demo-001",
    status: "draft",
    notes: "Registro de demostracion para Control de Plagas.",
    updatedAt: new Date().toISOString(),
  });

  const statusLabel = useMemo(
    () => ({
      draft: "Borrador",
      review: "Revision",
      approved: "Aprobado",
      archived: "Archivado",
    }),
    [],
  );

  const nextStatus = useMemo(() => {
    if (status === "draft") return "review";
    if (status === "review") return "approved";
    if (status === "approved") return "archived";
    return "draft";
  }, [status]);

  const { data: trapsMaps = [] } = useGetTrapsMaps({ status });
  const { data: inspections = [] } = useGetInspections({ status });
  const { data: vendorApis = [] } = useGetVendorApis({ status });
  const { data: toxicity = [] } = useGetToxicity({ status });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
                <FiShield />
                CA-01-04 | Control de Plagas
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Command Center de bioseguridad y control sanitario
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  Administra mapas de trampas, inspecciones, integraciones de proveedores y
                  trazabilidad quimica con un tablero listo para stepper y hooks.
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
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
                <div className="flex items-center gap-3 text-slate-300">
                  <Icon className="text-cyan-300" />
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
                <h2 className="text-lg font-bold text-white">Flows disponibles</h2>
                <p className="text-sm text-slate-400">
                  Cada carril representa un componente del epic CA-01-04.
                </p>
              </div>
              <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                Ready for stepper
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {laneCards.map((lane) => {
                const Icon = lane.icon;
                return (
                  <article
                    key={lane.key}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 transition hover:border-cyan-400/30 hover:bg-slate-950"
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
                    value={activeFlow}
                    onChange={(event) => setActiveFlow(event.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="traps_map">Traps Map</option>
                    <option value="inspections">Inspections</option>
                    <option value="vendor_api">Vendor API</option>
                    <option value="toxicity">Toxicity</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setStatus(nextStatus)}
                  className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                >
                  Simular siguiente estado
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Flujo activo</p>
                  <p className="mt-1 text-sm font-bold text-white">{activeFlow}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Estado actual</p>
                  <p className="mt-1 text-sm font-bold text-white">{statusLabel[status]}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">RBAC</p>
                  <p className="mt-1 text-sm font-bold text-white">calidad / gerencia</p>
                </div>
              </div>

              <CA0104Stepper
                flowName={activeFlow}
                record={activeRecord}
                currentUser={user}
                onTransitionSuccess={({ toStatus, notes: nextNotes }) =>
                  setActiveRecord((current) => ({
                    ...current,
                    status: toStatus,
                    notes: nextNotes,
                    updatedAt: new Date().toISOString(),
                  }))
                }
              />

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
                  <p className="uppercase tracking-[0.24em] text-slate-500">Traps Map</p>
                  <p className="mt-1 text-sm font-bold text-white">{trapsMaps.length}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
                  <p className="uppercase tracking-[0.24em] text-slate-500">Inspections</p>
                  <p className="mt-1 text-sm font-bold text-white">{inspections.length}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
                  <p className="uppercase tracking-[0.24em] text-slate-500">Vendor API</p>
                  <p className="mt-1 text-sm font-bold text-white">{vendorApis.length}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
                  <p className="uppercase tracking-[0.24em] text-slate-500">Toxicity</p>
                  <p className="mt-1 text-sm font-bold text-white">{toxicity.length}</p>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                Estado del modulo
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

            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 p-6">
              <h3 className="text-lg font-bold text-white">Siguiente entrega</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                El siguiente paso es el stepper de transicion para traps map, inspections,
                vendor api y toxicity, y luego la integracion de hooks de datos.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
};

export default CA0104Workspace;
