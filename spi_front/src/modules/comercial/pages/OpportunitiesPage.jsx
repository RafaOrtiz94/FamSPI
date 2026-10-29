import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBarChart2 } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button, { actionBtnClass, actionBtnNeutralClass } from "../../../core/ui/components/Button";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import { useAuth } from "../../../core/auth/AuthContext";
import {
  createOpportunity,
  getManagerDashboard,
  listOpportunities,
  searchAccounts,
} from "../api/opportunitiesApi";

const managerRoles = new Set([
  "jefe_comercial",
  "gerencia",
  "gerencia_general",
  "director",
  "admin",
  "administrador",
]);

const stageBadgeClass = {
  prospect: "bg-amber-100 text-amber-700",
  qualify: "bg-blue-100 text-blue-700",
  pursue: "bg-blue-100 text-blue-700",
  close: "bg-slate-100 text-slate-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
  archived: "bg-slate-100 text-slate-500",
};

const emptyDraft = {
  title: "",
  singular_objective: "",
  product_name: "",
  estimated_amount: "",
  currency: "USD",
  target_close_date: "",
  account_id: "",
};

const Label = ({ children }) => (
  <label className="text-xs font-medium tracking-[0.01em] text-slate-700">{children}</label>
);

const Input = (props) => (
  <input
    {...props}
    className={`min-h-10 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-sky-500/20 ${props.className || ""}`}
  />
);

const Select = (props) => (
  <select
    {...props}
    className={`min-h-10 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-sky-500/20 ${props.className || ""}`}
  />
);

const Textarea = (props) => (
  <textarea
    {...props}
    className={`rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-sky-500/20 ${props.className || ""}`}
  />
);

const MetricStrip = ({ metrics, groupedStages }) => {
  const cells = [
    { label: "Prospectos", value: groupedStages.prospect },
    { label: "Pursue", value: groupedStages.pursue },
    { label: "Won", value: groupedStages.won },
    { label: "Sin coach", value: metrics?.opportunities_without_coach ?? 0 },
    { label: "Acciones vencidas", value: metrics?.overdue_actions ?? 0 },
    { label: "Críticas", value: metrics?.critical_flags ?? 0 },
  ];

  return (
    <Card className="p-0">
      <div className="grid divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 xl:grid-cols-6">
        {cells.map((cell) => (
          <div key={cell.label} className="px-4 py-4">
            <div className="text-xs font-medium uppercase tracking-[0.01em] text-slate-500">{cell.label}</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{cell.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const OpportunitiesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState({ q: "", stage: "" });
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const role = String(user?.role || "").toLowerCase();
  const isManager = managerRoles.has(role);

  const groupedStages = useMemo(() => {
    const base = { prospect: 0, qualify: 0, pursue: 0, close: 0, won: 0, lost: 0, archived: 0 };
    items.forEach((item) => {
      if (base[item.funnel_stage] !== undefined) base[item.funnel_stage] += 1;
    });
    return base;
  }, [items]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [listData, accountsData, dashboardData] = await Promise.all([
        listOpportunities(filters),
        searchAccounts({ q: "" }),
        isManager ? getManagerDashboard() : Promise.resolve(null),
      ]);
      setItems(listData || []);
      setAccounts(accountsData || []);
      setMetrics(dashboardData);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "No se pudo cargar FamSheets.");
    } finally {
      setLoading(false);
    }
  }, [filters, isManager]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await createOpportunity({
        ...draft,
        estimated_amount: Number(draft.estimated_amount || 0),
      });
      setDraft(emptyDraft);
      navigate(`/dashboard/comercial/famsheets/${result?.opportunity?.id || result?.id}`);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "No se pudo crear la hoja.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} gap-5`}>
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.01em] text-slate-700">
              FamSheets
            </div>
            <h1 className="mt-3 text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-[-0.02em] text-slate-900">
              Oportunidades estratégicas
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Registra la estrategia comercial, el score del proceso y los vínculos con expedientes existentes en una sola vista operativa.
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:min-w-[680px]">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                load();
              }}
              className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] xl:grid-cols-[minmax(0,1fr)_180px_160px]"
            >
              <div className="grid gap-1">
                <Label>Buscar</Label>
                <Input
                  placeholder="Cuenta, título o producto"
                  value={filters.q}
                  onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                />
              </div>
              <div className="grid gap-1">
                <Label>Etapa</Label>
                <Select
                  value={filters.stage}
                  onChange={(event) => setFilters((current) => ({ ...current, stage: event.target.value }))}
                >
                  <option value="">Todas</option>
                  <option value="prospect">Prospect</option>
                  <option value="qualify">Qualify</option>
                  <option value="pursue">Pursue</option>
                  <option value="close">Close</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="archived">Archived</option>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" className={actionBtnClass}>Filtrar</Button>
              </div>
            </form>
            {isManager ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-[44px] px-4 py-2 text-sm font-semibold active:scale-[0.98]"
                  leftIcon={FiBarChart2}
                  onClick={() => navigate("/dashboard/comercial/famsheets/dashboard")}
                >
                  Abrir dashboard gerencial
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        {isManager ? <MetricStrip metrics={metrics} groupedStages={groupedStages} /> : <div />}
        <Card>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <FiBarChart2 size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-[-0.01em] text-slate-900">Ritmo del módulo</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                FamSheets opera con listado táctico y workspace. La vista gerencial concentra pipeline, foco y riesgos.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-[-0.01em] text-slate-900">Nueva hoja</h2>
            <p className="mt-1 text-sm text-slate-500">
              Crea una FamSheet con los datos mínimos y continúa el análisis en el workspace.
            </p>
          </div>

          <form onSubmit={handleCreate} className="grid gap-3">
            <div className="grid gap-1">
              <Label>Título</Label>
              <Input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ej. Remodelación laboratorio clínico"
                required
              />
            </div>
            <div className="grid gap-1">
              <Label>Objetivo singular</Label>
              <Textarea
                value={draft.singular_objective}
                onChange={(event) => setDraft((current) => ({ ...current, singular_objective: event.target.value }))}
                placeholder="Qué, cuánto y cuándo"
                rows={4}
                required
              />
            </div>
            <div className="grid gap-1">
              <Label>Cuenta prospecto</Label>
              <Select
                value={draft.account_id}
                onChange={(event) => setDraft((current) => ({ ...current, account_id: event.target.value }))}
              >
                <option value="">Sin cuenta vinculada</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label>Producto</Label>
                <Input
                  value={draft.product_name}
                  onChange={(event) => setDraft((current) => ({ ...current, product_name: event.target.value }))}
                  placeholder="Línea o equipo principal"
                />
              </div>
              <div className="grid gap-1">
                <Label>Monto estimado</Label>
                <Input
                  type="number"
                  min="0"
                  value={draft.estimated_amount}
                  onChange={(event) => setDraft((current) => ({ ...current, estimated_amount: event.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label>Moneda</Label>
                <Input
                  value={draft.currency}
                  onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value }))}
                />
              </div>
              <div className="grid gap-1">
                <Label>Fecha de cierre</Label>
                <Input
                  type="date"
                  value={draft.target_close_date}
                  onChange={(event) => setDraft((current) => ({ ...current, target_close_date: event.target.value }))}
                />
              </div>
            </div>
            <Button type="submit" loading={submitting} className={actionBtnClass}>
              Crear y abrir
            </Button>
          </form>
        </Card>

        <Card className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.01em] text-slate-900">Hojas activas</h2>
              <p className="mt-1 text-sm text-slate-500">
                Vista inicial del pipeline antes de Kanban.
              </p>
            </div>
            <Button variant="secondary" className={actionBtnNeutralClass} onClick={load}>
              Recargar
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="mt-3 h-4 w-3/4 rounded bg-slate-200" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <div className="text-sm font-medium text-slate-700">Todavía no hay hojas activas</div>
              <p className="mt-1 text-sm text-slate-500">
                Crea la primera FamSheet desde el panel izquierdo.
              </p>
            </div>
          ) : null}

          {!loading && items.length > 0 ? (
            <div className="grid gap-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/dashboard/comercial/famsheets/${item.id}`)}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-[0.01em] ${stageBadgeClass[item.funnel_stage] || "bg-slate-100 text-slate-700"}`}>
                          {item.funnel_stage}
                        </span>
                        <span className="text-xs text-slate-500">{item.account_name || "Sin cuenta vinculada"}</span>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold tracking-[-0.01em] text-slate-900">{item.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{item.singular_objective}</p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <div className="font-mono text-sm text-slate-900">
                        ${Number(item.estimated_amount || 0).toLocaleString()}
                      </div>
                      <div className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        Score {item.total_score || 0}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
};

export default OpportunitiesPage;
