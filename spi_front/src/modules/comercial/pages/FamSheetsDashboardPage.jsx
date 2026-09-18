import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiBarChart2, FiClock, FiTarget } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button, { actionBtnClass, actionBtnNeutralClass } from "../../../core/ui/components/Button";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import { getManagerDashboard, listOpportunities } from "../api/opportunitiesApi";

const stageMeta = {
  prospect: { label: "Prospecto",    badge: "bg-amber-100 text-amber-700" },
  qualify:  { label: "Calificando",  badge: "bg-sky-100 text-sky-700" },
  pursue:   { label: "Persiguiendo", badge: "bg-blue-100 text-blue-700" },
  close:    { label: "Cierre",       badge: "bg-slate-100 text-slate-700" },
  won:      { label: "Ganado",       badge: "bg-emerald-100 text-emerald-700" },
  lost:     { label: "Perdido",      badge: "bg-rose-100 text-rose-700" },
  archived: { label: "Archivado",    badge: "bg-slate-100 text-slate-500" },
};

const MetricCard = ({ label, value, hint, tone = "slate" }) => {
  const toneClass = {
    slate: "bg-slate-50 border-slate-200 text-slate-900",
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
    rose: "bg-rose-50 border-rose-200 text-rose-900",
  }[tone] || "bg-slate-50 border-slate-200 text-slate-900";

  return (
    <Card className={`border ${toneClass}`}>
      <div className="text-xs font-medium uppercase tracking-[0.01em] text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{hint}</div>
    </Card>
  );
};

const EmptyState = ({ title, text }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
    <div className="text-sm font-medium text-slate-700">{title}</div>
    <p className="mt-1 text-sm text-slate-500">{text}</p>
  </div>
);

const FamSheetsDashboardPage = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboardData, listData] = await Promise.all([getManagerDashboard(), listOpportunities({})]);
      setMetrics(dashboardData || null);
      setItems(Array.isArray(listData) ? listData : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "No se pudo cargar el dashboard de FamSheets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stageMap = useMemo(() => {
    const base = Object.keys(stageMeta).reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
    for (const row of metrics?.stage_counts || []) {
      if (base[row.funnel_stage] !== undefined) {
        base[row.funnel_stage] = Number(row.total || 0);
      }
    }
    return base;
  }, [metrics]);

  const urgentItems = useMemo(
    () => items.filter((item) => {
      const score = item.puntuacion ?? item.total_score ?? 0;
      return ["pursue", "close"].includes(item.funnel_stage) || Number(score) < 40;
    }),
    [items]
  );

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} gap-5`}>
      <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate("/dashboard/comercial/famsheets")}
              className="cursor-pointer text-xs font-medium uppercase tracking-[0.01em] text-slate-500"
            >
              Volver a FamSheets
            </button>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.01em] text-slate-700">
              <FiBarChart2 size={14} />
              Dashboard gerencial
            </div>
            <h1 className="mt-3 text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-[-0.02em] text-slate-900">
              Salud comercial de FamSheets
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Consolida pipeline, riesgos y foco operativo para seguimiento de oportunidades estratégicas.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" className={actionBtnNeutralClass} onClick={load}>
              Recargar
            </Button>
            <Button className={actionBtnClass} onClick={() => navigate("/dashboard/comercial/famsheets")}>
              Ver hojas
            </Button>
          </div>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pipeline abierto"
          value={loading ? "..." : items.filter((item) => !["won", "lost", "archived"].includes(item.funnel_stage)).length}
          hint="Hojas activas en seguimiento"
          tone="blue"
        />
        <MetricCard
          label="Sin coach"
          value={loading ? "..." : metrics?.opportunities_without_coach ?? 0}
          hint="Oportunidades sin influencia coach"
          tone="amber"
        />
        <MetricCard
          label="Acciones vencidas"
          value={loading ? "..." : metrics?.overdue_actions ?? 0}
          hint="Mitigaciones fuera de fecha"
          tone="rose"
        />
        <MetricCard
          label="Banderas críticas"
          value={loading ? "..." : metrics?.critical_flags ?? 0}
          hint="Riesgos abiertos de máxima severidad"
          tone="rose"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.01em] text-slate-900">Pipeline por etapa</h2>
              <p className="mt-1 text-sm text-slate-500">Conteo actual para lectura rápida de carga comercial.</p>
            </div>
            <FiTarget className="text-slate-400" size={18} />
          </div>

          {loading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="h-4 w-28 rounded bg-slate-200" />
                  <div className="mt-3 h-8 w-16 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(stageMeta).map(([key, meta]) => (
                <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-[0.01em] ${meta.badge}`}>
                    {meta.label}
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{stageMap[key] || 0}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.01em] text-slate-900">Cola prioritaria</h2>
              <p className="mt-1 text-sm text-slate-500">Hojas en pursue, close o con score crítico.</p>
            </div>
            <FiAlertTriangle className="text-amber-500" size={18} />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((row) => (
                <div key={row} className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="h-4 w-3/4 rounded bg-slate-200" />
                  <div className="mt-3 h-4 w-1/2 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : urgentItems.length === 0 ? (
            <EmptyState title="No hay hojas prioritarias" text="Cuando existan hojas en pursue, close o con score crítico aparecerán aquí." />
          ) : (
            <div className="grid gap-3">
              {urgentItems.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/dashboard/comercial/famsheets/${item.id}`)}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.account_name || "Sin cuenta vinculada"}</div>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-[0.01em] ${stageMeta[item.funnel_stage]?.badge || "bg-slate-100 text-slate-700"}`}>
                        {stageMeta[item.funnel_stage]?.label || item.funnel_stage}
                      </div>
                      <div className="mt-2 text-sm font-medium text-slate-700">Score {item.puntuacion ?? item.total_score ?? 0}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.01em] text-slate-900">Actividad reciente</h2>
            <p className="mt-1 text-sm text-slate-500">Últimas hojas actualizadas para seguimiento del equipo.</p>
          </div>
          <FiClock className="text-slate-400" size={18} />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="mt-3 h-4 w-2/3 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="No hay hojas registradas" text="Crea la primera FamSheet para comenzar a medir el pipeline." />
        ) : (
          <div className="grid gap-3">
            {items.slice(0, 10).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.account_name || "Sin cuenta vinculada"} · {item.owner_name || "Sin owner"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-[0.01em] ${stageMeta[item.funnel_stage]?.badge || "bg-slate-100 text-slate-700"}`}>
                      {stageMeta[item.funnel_stage]?.label || item.funnel_stage}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      Score {item.puntuacion ?? item.total_score ?? 0}
                    </span>
                    <Button variant="secondary" onClick={() => navigate(`/dashboard/comercial/famsheets/${item.id}`)}>
                      Abrir
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default FamSheetsDashboardPage;
