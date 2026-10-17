// Cuenta 360 (DESIGN.md §7, "Expediente o detalle"): cabecera con identidad y estado, franja de
// indicadores del plan y el contenido repartido en pestañas —antes era una sola columna muy larga—.
// La pestaña activa y el plan seleccionado viven en la URL.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiEdit2 } from "react-icons/fi";
import {
  fetchAccountById, fetchAccountDuplicates, fetchAccountPlans, fetchAccountSalesStats, mergeAccounts,
} from "../../../core/api/crmFamApi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import AccountFormModal from "../components/AccountFormModal";
import AccountSwotCard from "../components/AccountSwotCard";
import { Badge, Btn, DefList, ErrorNote, PageHeader, Panel, Skeleton, StatStrip, StatusBadge, Tabs } from "../ui/kit";
import { errorMessage, money } from "../ui/format";
import { accountClassification, accountType } from "../ui/status";
import { useUrlState } from "../ui/useUrlState";
import AccountPlans, { planPeriod } from "./account/AccountPlans";
import { AccountContacts, AccountOpportunities, AccountTimeline } from "./account/AccountTabs";
import AccountInstalledBase from "./account/AccountInstalledBase";

const BASE = "/dashboard/crm-fam";
// Misma lista que MANAGER_OR_ADMIN_ROLES del backend: solo ellos fusionan cuentas o reasignan vendedor.
const MANAGER_ROLES = new Set(["jefe_comercial", "gerencia", "gerencia_general", "gerente_general", "director", "gerente", "jefe_ti", "jefe_de_ti", "admin", "administrador"]);

const TABS = [
  { value: "resumen", label: "Resumen" },
  { value: "planes", label: "Planes" },
  { value: "foda", label: "FODA" },
  { value: "contactos", label: "Contactos" },
  { value: "oportunidades", label: "Oportunidades" },
  { value: "instalada", label: "Base instalada" },
  { value: "actividad", label: "Actividad" },
];

// Posibles duplicados (mismo RUC o nombre parecido) con fusión para managers.
function Duplicates({ accountId, accountName, canMerge, onMerged }) {
  const { showToast, askConfirm } = useUI();
  const [candidates, setCandidates] = useState([]);
  const [mergingId, setMergingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchAccountDuplicates(accountId)
      .then((rows) => { if (!cancelled) setCandidates(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setCandidates([]); });
    return () => { cancelled = true; };
  }, [accountId]);

  if (candidates.length === 0) return null;

  const merge = (c) => askConfirm(`¿Fusionar “${c.account_name}” dentro de “${accountName}”? Sus contactos, oportunidades, actividades y planes pasarán a esta cuenta. No se puede deshacer.`, async () => {
    setMergingId(c.id);
    try {
      await mergeAccounts(accountId, c.id);
      setCandidates((prev) => prev.filter((x) => x.id !== c.id));
      showToast(`“${c.account_name}” se fusionó en esta cuenta`, "success");
      onMerged();
    } catch (err) {
      showToast(errorMessage(err, "No se pudo fusionar."), "error");
    } finally { setMergingId(null); }
  });

  return (
    <div className="mb-5 rounded-xl bg-fam-warning-bg px-4 py-3">
      <p className="text-sm font-semibold text-fam-warning">Posibles cuentas duplicadas</p>
      <ul className="mt-2 space-y-2">
        {candidates.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3">
            <span className="min-w-0 text-sm text-fam-text">
              <Link to={`${BASE}/accounts/${c.id}`} className="underline underline-offset-2">{c.account_name}</Link>
              <span className="text-fam-muted"> · {c.ruc || "sin RUC"}{c.city ? ` · ${c.city}` : ""}</span>
            </span>
            {canMerge && <Btn size="sm" onClick={() => merge(c)} loading={mergingId === c.id}>{mergingId === c.id ? "Fusionando…" : "Fusionar aquí"}</Btn>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AccountDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManage = MANAGER_ROLES.has(user?.role);
  const [url, setUrl] = useUrlState({ tab: "resumen", plan: "" });
  const [account, setAccount] = useState({ loading: true, data: null, error: "" });
  const [plans, setPlans] = useState({ loading: true, rows: [] });
  const [stats, setStats] = useState({ loading: true, data: null });
  const [editing, setEditing] = useState(false);

  const loadAccount = useCallback(async () => {
    setAccount((s) => ({ ...s, loading: !s.data, error: "" }));
    try {
      setAccount({ loading: false, data: await fetchAccountById(id), error: "" });
    } catch (err) {
      const notFound = err?.response?.status === 404;
      const denied = err?.response?.status === 403;
      setAccount({ loading: false, data: null, error: notFound ? "Esta cuenta no existe o fue eliminada." : denied ? "No tienes acceso a esta cuenta." : errorMessage(err, "No se pudo cargar la cuenta.") });
    }
  }, [id]);

  const loadPlans = useCallback(async () => {
    try { const rows = await fetchAccountPlans(id); setPlans({ loading: false, rows: Array.isArray(rows) ? rows : [] }); }
    catch (_err) { setPlans({ loading: false, rows: [] }); }
  }, [id]);

  const loadStats = useCallback(async () => {
    setStats((s) => ({ ...s, loading: true }));
    try { setStats({ loading: false, data: await fetchAccountSalesStats(id, url.plan || undefined) }); }
    catch (_err) { setStats({ loading: false, data: null }); }
  }, [id, url.plan]);

  useEffect(() => { loadAccount(); loadPlans(); }, [loadAccount, loadPlans]);
  useEffect(() => { loadStats(); }, [loadStats]);

  if (account.loading) {
    return <div className="space-y-4"><Skeleton className="h-4 w-40" /><Skeleton className="h-8 w-80" /><Skeleton className="h-24 w-full" /></div>;
  }
  if (account.error) {
    return (
      <div className="flex min-w-0 flex-col">
        <PageHeader title="Cuenta" context={<Link to={`${BASE}/accounts`} className="underline underline-offset-2">Cuentas</Link>} />
        <ErrorNote message={account.error} onRetry={loadAccount} />
      </div>
    );
  }

  const a = account.data;
  const s = stats.data;
  const hasPlan = Boolean(s?.plan);
  const pipelineReady = hasPlan && Number(s?.seller?.win_rate_pct) > 0;
  const tab = TABS.some((t) => t.value === url.tab) ? url.tab : "resumen";
  const refreshPlanData = () => { loadPlans(); loadStats(); };

  return (
    <div className="flex min-w-0 flex-col">
      <PageHeader
        title={a.account_name}
        context={<><Link to={`${BASE}/accounts`} className="underline underline-offset-2">Cuentas</Link> / Cuenta</>}
        actions={<Btn icon={FiEdit2} onClick={() => setEditing(true)}>Editar</Btn>}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-fam-muted">
          {a.classification && <StatusBadge of={accountClassification} value={a.classification} />}
          {a.account_type && <Badge>{accountType(a.account_type)}</Badge>}
          {a.ruc && <span>RUC <span className="fam-id text-fam-text">{a.ruc}</span></span>}
          {a.city && <span>{a.city}</span>}
          {a.owner_name && <span>Propietario: <span className="text-fam-text">{a.owner_name}</span></span>}
        </div>
      </PageHeader>

      <Duplicates accountId={id} accountName={a.account_name} canMerge={canManage} onMerged={() => { loadAccount(); refreshPlanData(); }} />

      <StatStrip
        plain
        className="mb-6"
        items={[
          { label: "Meta del plan", value: stats.loading ? "—" : hasPlan ? money(s.sales_target_amount) : "Sin plan", hint: hasPlan ? `${s.plan.name} · ${planPeriod(s.plan)}` : "Crea un plan en la pestaña Planes" },
          { label: "Vendido", value: stats.loading || !s ? "—" : money(s.sold_amount), hint: "ganado o con contrato" },
          { label: "Falta por vender", value: stats.loading || !hasPlan ? "—" : money(s.remaining_to_target) },
          { label: "Pipeline a generar", value: stats.loading || !pipelineReady ? "—" : money(s.required_pipeline_amount), hint: pipelineReady ? `win rate ${s.seller.win_rate_pct}% de ${s.seller.name || "el vendedor"}` : hasPlan ? "el vendedor aún no tiene ventas ganadas" : undefined },
        ]}
      />

      <div className="mb-5">
        <Tabs label="Secciones de la cuenta" tabs={TABS} value={tab} onChange={(v) => setUrl({ tab: v }, { replace: false })} />
      </div>

      {tab === "resumen" && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Panel title="Oportunidades abiertas" actions={<Btn variant="link" onClick={() => setUrl({ tab: "oportunidades" })}>Ver todas</Btn>}>
              {(a.open_opportunities || []).length === 0 ? (
                <p className="text-sm text-fam-muted">No hay negocio en curso con esta cuenta.</p>
              ) : (
                <ul className="divide-y divide-fam-border">
                  {a.open_opportunities.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <Link to={`${BASE}/opportunities/${o.id}`} className="min-w-0 truncate text-sm font-medium text-fam-action underline underline-offset-2">{o.name}</Link>
                      <span className="fam-numeric shrink-0 text-sm text-fam-text">{money(o.estimated_amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <AccountTimeline accountId={id} limit={6} title="Últimos movimientos" />
          </div>
          <Panel title="Ficha">
            <DefList
              items={[
                { label: "Razón social", value: a.legal_name },
                { label: "Industria", value: a.industry },
                { label: "Correo", value: a.email ? <a href={`mailto:${a.email}`} className="text-fam-action underline underline-offset-2">{a.email}</a> : null },
                { label: "Teléfono", value: a.phone ? <a href={`tel:${a.phone}`} className="fam-numeric text-fam-action underline underline-offset-2">{a.phone}</a> : null },
                { label: "Sitio web", value: a.website ? <a href={a.website} target="_blank" rel="noopener noreferrer" className="break-all text-fam-action underline underline-offset-2">{a.website}</a> : null },
                { label: "Ubicación", value: [a.address, a.city, a.province, a.country].filter(Boolean).join(", ") || null },
                { label: "Notas", value: a.notes ? <span className="whitespace-pre-wrap">{a.notes}</span> : null },
              ]}
            />
          </Panel>
        </div>
      )}

      {tab === "planes" && (
        <AccountPlans
          accountId={id}
          plans={plans.rows}
          loading={plans.loading}
          selectedPlanId={url.plan || null}
          onSelect={(planId) => setUrl({ plan: planId || "" })}
          canEditSeller={canManage}
          stats={s}
          statsLoading={stats.loading}
          onChanged={refreshPlanData}
        />
      )}

      {tab === "foda" && <AccountSwotCard accountId={id} planId={url.plan || null} />}
      {tab === "contactos" && <AccountContacts accountId={id} />}
      {tab === "oportunidades" && <AccountOpportunities accountId={id} />}
      {tab === "instalada" && <AccountInstalledBase accountId={id} />}
      {tab === "actividad" && <AccountTimeline accountId={id} />}

      {editing && (
        <AccountFormModal
          account={a}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); loadAccount(); }}
        />
      )}
    </div>
  );
}
