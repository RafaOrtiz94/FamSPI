import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { useAccount, useAccountSalesStats } from "../hooks/useCrmAccounts";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import {
  updateAccount, fetchAccountTimeline, fetchAccountDuplicates, mergeAccounts,
} from "../../../core/api/crmFamApi";

// Misma lista que MANAGER_OR_ADMIN_ROLES en backend/crm.constants.js -- solo
// managers pueden fusionar cuentas (la ruta ya lo exige, esto es para no
// ofrecer un boton que el backend va a rechazar).
const CRM_MANAGER_ROLES = new Set([
  "jefe_comercial", "gerencia", "gerencia_general", "gerente_general", "director", "gerente",
  "jefe_ti", "jefe_de_ti", "admin", "administrador",
]);

const EDITABLE_FIELDS = [
  { name: "account_name", label: "Nombre", required: true },
  { name: "account_type", label: "Tipo", type: "select", options: ["", "empresa", "persona_natural", "gobierno", "ong"] },
  { name: "classification", label: "Clasificación", type: "select", options: ["", "oro", "plata", "bronce", "normal"] },
  { name: "ruc", label: "RUC" },
  { name: "industry", label: "Industria" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Teléfono" },
  { name: "city", label: "Ciudad" },
  { name: "country", label: "País" },
  { name: "website", label: "Sitio web" },
  { name: "sales_target_amount", label: "Meta de ventas (USD)", type: "number" },
  { name: "description", label: "Descripción", type: "textarea" },
];

// Clasificacion de la cuenta (oro/plata/bronce/normal) -- separada de las
// estadisticas de ventas, ver requerimiento del usuario.
const CLASSIFICATION_BADGES = {
  oro: "bg-amber-50 text-amber-700 border-amber-200",
  plata: "bg-slate-100 text-slate-600 border-slate-300",
  bronce: "bg-orange-50 text-orange-700 border-orange-200",
  normal: "bg-blue-50 text-blue-700 border-blue-100",
};
const CLASSIFICATION_LABELS = { oro: "Oro", plata: "Plata", bronce: "Bronce", normal: "Normal" };

function ClassificationBadge({ value }) {
  if (!value) return <span className="text-sm text-[#1F2937]">—</span>;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CLASSIFICATION_BADGES[value] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {CLASSIFICATION_LABELS[value] || value}
    </span>
  );
}

const money = (value) =>
  value == null ? "—" : `$${Number(value).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const OPPORTUNITY_STATUS_LABELS = { open: "abierta", won: "ganada", lost: "perdida", cancelled: "cancelada" };

// Bug corregido: getAccountTimeline (backend) siempre devolvio un objeto
// agrupado ({leads, opportunities, activities, notes, documents, ...}),
// nunca el array plano que este componente esperaba -- el timeline jamas
// mostro nada. Esto normaliza los grupos (incluyendo Business Case/compras
// privadas, agregados para "Cuenta 360") en una sola lista ordenada.
function normalizeTimeline(raw) {
  if (!raw || typeof raw !== "object") return [];
  const events = [];

  (raw.leads || []).forEach((l) => events.push({
    id: `lead-${l.id}`, date: l.created_at, kind: "Lead",
    title: l.full_name || l.lead_code || "Lead",
    subtitle: l.status ? `Estado: ${l.status}` : null,
  }));

  (raw.opportunities || []).forEach((o) => events.push({
    id: `opp-${o.id}`, date: o.created_at, kind: "Oportunidad",
    title: o.name || o.opportunity_code || "Oportunidad",
    subtitle: [
      o.status ? `Estado: ${OPPORTUNITY_STATUS_LABELS[o.status] || o.status}` : null,
      o.estimated_amount != null ? money(o.estimated_amount) : null,
    ].filter(Boolean).join(" · ") || null,
  }));

  (raw.activities || []).forEach((a) => events.push({
    id: `act-${a.id}`, date: a.scheduled_at || a.completed_at, kind: "Actividad",
    title: a.subject || a.activity_type || "Actividad",
    subtitle: a.status ? `Estado: ${a.status}` : null,
  }));

  (raw.notes || []).forEach((n) => events.push({
    id: `note-${n.id}`, date: n.created_at, kind: "Nota",
    title: n.note_text ? (n.note_text.length > 120 ? `${n.note_text.slice(0, 120)}…` : n.note_text) : "Nota",
    subtitle: null,
  }));

  (raw.documents || []).forEach((d) => events.push({
    id: `doc-${d.id}`, date: d.created_at, kind: "Documento",
    title: d.document_name || "Documento",
    subtitle: d.document_type || null,
  }));

  // Business Case / compras publicas vinculadas por oportunidad (puente
  // crmPurchaseSync) -- esto es lo nuevo: antes el timeline de la cuenta
  // no mostraba nada de lo que pasa fuera del CRM.
  (raw.business_cases || []).forEach((bc) => events.push({
    id: `bc-${bc.id}`, date: bc.updated_at || bc.created_at, kind: "Business Case",
    title: bc.process_code ? `Proceso ${bc.process_code}` : "Business Case",
    subtitle: [bc.canonical_state, bc.contract_object].filter(Boolean).join(" · ") || null,
  }));

  (raw.private_purchases || []).forEach((pp) => events.push({
    id: `pp-${pp.id}`, date: pp.updated_at || pp.created_at, kind: "Compra privada",
    title: "Compra privada",
    subtitle: pp.status ? `Estado: ${pp.status}` : null,
  }));

  return events
    .filter((e) => e.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

const TIMELINE_KIND_COLORS = {
  Lead: "#7C3AED", "Oportunidad": "#2563EB", Actividad: "#0E8F72",
  Nota: "#6B7280", Documento: "#B8860B", "Business Case": "#DC2626", "Compra privada": "#DC2626",
};

function Field({ field, value, editing, onChange }) {
  if (!editing) {
    if (field.name === "website" && value) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline text-sm break-all">
          {value}
        </a>
      );
    }
    if (field.name === "classification") {
      return <ClassificationBadge value={value} />;
    }
    if (field.name === "sales_target_amount") {
      return <span className="text-sm text-[#1F2937]">{value ? money(value) : "—"}</span>;
    }
    return <span className="text-sm text-[#1F2937]">{value || "—"}</span>;
  }

  if (field.type === "select") {
    return (
      <select
        name={field.name}
        value={value || ""}
        onChange={onChange}
        className="w-full border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
      >
        {field.options.map(o => (
          <option key={o} value={o}>
            {o ? (field.name === "classification" ? (CLASSIFICATION_LABELS[o] || o) : o) : "Seleccionar..."}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "textarea") {
    return (
      <textarea
        name={field.name}
        value={value || ""}
        onChange={onChange}
        rows={3}
        className="w-full border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none"
      />
    );
  }
  return (
    <input
      name={field.name}
      type={field.type || "text"}
      value={value || ""}
      onChange={onChange}
      required={field.required}
      className="w-full border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
    />
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Estadisticas de ventas de la cuenta, para proyecciones comerciales.
function SalesStatsCard({ accountId }) {
  const { data: stats, loading, error } = useAccountSalesStats(accountId);

  if (loading) return <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 mb-6"><Spinner /></div>;
  if (error) return null; // no bloquear el detalle de cuenta si esto falla
  if (!stats) return null;

  const hasTarget = stats.sales_target_amount != null;
  const metrics = [
    { label: "Monto total generado", value: money(stats.total_estimated_amount), hint: `${stats.total_opportunities} oportunidad(es) generada(s)` },
    { label: "Meta de ventas", value: hasTarget ? money(stats.sales_target_amount) : "Sin meta definida" },
    { label: "Vendido (ganado)", value: money(stats.won_amount), hint: `${stats.won_opportunities} oportunidad(es) ganada(s)` },
    { label: "Falta por vender", value: hasTarget ? money(stats.remaining_to_target) : "—" },
    {
      label: "Oportunidades faltantes para meta",
      value: hasTarget ? String(stats.opportunities_needed_for_target) : "—",
      hint: stats.avg_deal_size != null ? `Basado en un promedio de ${money(stats.avg_deal_size)} por oportunidad` : null,
    },
    { label: "Oportunidades ganadas", value: String(stats.won_opportunities) },
    { label: "% Ganadas", value: stats.win_rate_pct != null ? `${stats.win_rate_pct}%` : "—", hint: "Sobre oportunidades cerradas (ganadas + perdidas)" },
    { label: "% Perdidas", value: stats.loss_rate_pct != null ? `${stats.loss_rate_pct}%` : "—" },
  ];

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 mb-6">
      <h2 className="text-base font-semibold text-[#1F2937] mb-4">Estadísticas de ventas — proyección comercial</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1">{m.label}</p>
            <p className="text-lg font-semibold text-[#1F2937]">{m.value}</p>
            {m.hint && <p className="text-[11px] text-[#6B7280] mt-1">{m.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Candidatos a duplicado (mismo RUC o nombre parecido) con accion de fusion
// -- antes el aviso de "nombre parecido" solo aparecia una vez, al crear una
// cuenta nueva, y no habia forma de resolverlo despues.
function DuplicateAccountsCard({ accountId, accountName, canMerge, onMerged }) {
  const { showToast } = useUI();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mergingId, setMergingId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAccountDuplicates(accountId)
      .then((rows) => setCandidates(Array.isArray(rows) ? rows : []))
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  if (loading || candidates.length === 0) return null;

  const handleMerge = async (sourceId, sourceName) => {
    if (!window.confirm(`¿Fusionar "${sourceName}" dentro de "${accountName}"? Esta acción no se puede deshacer.`)) return;
    setMergingId(sourceId);
    try {
      await mergeAccounts(accountId, sourceId);
      showToast(`"${sourceName}" se fusionó dentro de "${accountName}"`, "success");
      setCandidates((prev) => prev.filter((c) => c.id !== sourceId));
      onMerged?.();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo fusionar", "error");
    } finally {
      setMergingId(null);
    }
  };

  return (
    <div className="bg-[#FFFBEB] border border-[#F59E0B] rounded-2xl p-5 mb-6">
      <h2 className="text-sm font-semibold text-[#92400E] mb-1">Posibles cuentas duplicadas</h2>
      <p className="text-xs text-[#92400E] mb-3">Mismo RUC o nombre parecido a "{accountName}".</p>
      <ul className="flex flex-col gap-2">
        {candidates.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 bg-white border border-[#FDE68A] rounded-xl px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm text-[#1F2937] font-medium truncate">{c.account_name}</p>
              <p className="text-xs text-[#6B7280]">{c.ruc || "Sin RUC"} {c.city ? `· ${c.city}` : ""}</p>
            </div>
            {canMerge && (
              <button
                type="button"
                onClick={() => handleMerge(c.id, c.account_name)}
                disabled={mergingId === c.id}
                className="shrink-0 px-3 py-1.5 text-xs font-medium bg-[#B45309] text-white rounded-lg hover:bg-[#92400E] disabled:opacity-50 transition-colors"
              >
                {mergingId === c.id ? "Fusionando..." : "Fusionar aquí"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AccountDetailPage() {
  const { id } = useParams();
  const { data: account, loading, error, refresh } = useAccount(id);
  const { user } = useAuth();
  const canMerge = CRM_MANAGER_ROLES.has(user?.role);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState(null);

  // Load timeline once account loaded
  useEffect(() => {
    if (!id) return;
    setTimelineLoading(true);
    setTimelineError(null);
    fetchAccountTimeline(id)
      .then(res => setTimeline(normalizeTimeline(res)))
      .catch(e => setTimelineError(e.message || "Error cargando timeline"))
      .finally(() => setTimelineLoading(false));
  }, [id]);

  const startEditing = useCallback(() => {
    if (!account) return;
    setForm({ ...account });
    setSaveError(null);
    setEditing(true);
  }, [account]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setForm({});
    setSaveError(null);
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSave = useCallback(async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await updateAccount(id, form);
      setEditing(false);
      refresh();
    } catch (err) {
      setSaveError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }, [id, form, refresh]);

  if (loading) return <div className="p-6 bg-[#F9FAFB] min-h-full"><Spinner /></div>;

  if (error) {
    const is404 = error.includes("404") || error.toLowerCase().includes("not found");
    return (
      <div className="p-6 bg-[#F9FAFB] min-h-full">
        <p className="text-[#DC2626] text-sm">{is404 ? "Cuenta no encontrada" : error}</p>
      </div>
    );
  }

  if (!account) return null;

  const display = editing ? form : account;

  // Split fields into two columns
  const leftFields = EDITABLE_FIELDS.slice(0, 5);
  const rightFields = EDITABLE_FIELDS.slice(5);

  return (
    <div className="p-6 bg-[#F9FAFB] min-h-full">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[#6B7280] mb-5">
        <Link to="/dashboard/crm-fam/accounts" className="hover:text-[#2563EB] transition-colors">
          Cuentas
        </Link>
        <span>/</span>
        <span className="text-[#1F2937] font-medium">{account.account_name}</span>
      </nav>

      <DuplicateAccountsCard
        accountId={id}
        accountName={account.account_name}
        canMerge={canMerge}
        onMerged={refresh}
      />

      {/* Main card */}
      <form onSubmit={handleSave}>
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-xl font-semibold text-[#1F2937]">{account.account_name}</h1>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-xl text-[#1F2937] hover:bg-[#334155]/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-3 py-1.5 text-sm bg-[#2563EB] text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={startEditing}
                  className="px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-xl text-[#1F2937] hover:bg-[#334155]/5 transition-colors"
                >
                  Editar
                </button>
              )}
            </div>
          </div>

          {saveError && (
            <div className="mb-4 px-4 py-2 bg-[#FEE2E2] border border-[#DC2626] text-[#DC2626] rounded-xl text-sm">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* Left column */}
            <div className="flex flex-col gap-4">
              {leftFields.map(field => (
                <div key={field.name}>
                  <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1">{field.label}</p>
                  <Field field={field} value={display[field.name]} editing={editing} onChange={handleChange} />
                </div>
              ))}
            </div>
            {/* Right column */}
            <div className="flex flex-col gap-4">
              {rightFields.map(field => (
                <div key={field.name}>
                  <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1">{field.label}</p>
                  <Field field={field} value={display[field.name]} editing={editing} onChange={handleChange} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </form>

      <SalesStatsCard accountId={id} />

      {/* Timeline */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6">
        <h2 className="text-base font-semibold text-[#1F2937] mb-4">Timeline</h2>
        {timelineLoading && <Spinner />}
        {timelineError && (
          <p className="text-sm text-[#DC2626]">{timelineError}</p>
        )}
        {!timelineLoading && !timelineError && timeline.length === 0 && (
          <p className="text-sm text-[#6B7280]">Sin eventos registrados</p>
        )}
        {!timelineLoading && timeline.length > 0 && (
          <ol className="relative border-l border-[#E5E7EB] ml-2 flex flex-col gap-5">
            {timeline.map((item) => (
              <li key={item.id} className="ml-4">
                <span
                  className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full border-2 border-white"
                  style={{ backgroundColor: TIMELINE_KIND_COLORS[item.kind] || "#6B7280" }}
                />
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: TIMELINE_KIND_COLORS[item.kind] || "#6B7280" }}>
                    {item.kind}
                  </span>
                  <span className="text-xs text-[#6B7280]">
                    {new Date(item.date).toLocaleDateString("es-EC", { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-sm text-[#1F2937]">{item.title}</p>
                {item.subtitle && (
                  <p className="text-xs text-[#6B7280] mt-0.5">{item.subtitle}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
