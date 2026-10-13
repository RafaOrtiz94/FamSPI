import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createEmailCampaign,
  deleteEmailCampaign,
  duplicateEmailCampaign,
  fetchAccounts,
  fetchCampaignAudience,
  fetchContacts,
  fetchEmailCampaignById,
  fetchEmailCampaigns,
  retryEmailCampaignFailed,
  sendEmailCampaignBatch,
  sendEmailCampaignTest,
  updateEmailCampaign,
} from "../../../core/api/crmFamApi";
import { useAuth } from "../../../core/auth/AuthContext";
import Modal from "../../../core/ui/components/Modal";
import { ConfirmDialog } from "../ui/dialogs";
import { Btn, EmptyState, PageHeader } from "../ui/kit";

const ROLES = ["jefe_comercial", "gerencia", "gerencia_general", "gerente_general", "director", "gerente", "jefe_ti", "jefe_de_ti", "admin", "administrador"];
const EMPTY = { campaign_name: "", subject: "", preheader: "", body_content: "", is_template: false, recipients: [] };
const MAX_RECIPIENTS = 500;

const STATUS = {
  draft: { label: "Borrador", cls: "bg-fam-subtle text-fam-muted" },
  sending: { label: "Enviando", cls: "bg-fam-warning-bg text-fam-warning" },
  sent: { label: "Enviada", cls: "bg-fam-success-bg text-fam-success" },
};
const DELIVERY = {
  pending: { label: "Pendiente", cls: "text-fam-muted" },
  sent: { label: "Enviado", cls: "text-fam-success" },
  failed: { label: "Fallido", cls: "text-fam-danger" },
  skipped: { label: "Omitido", cls: "text-fam-warning" },
};

const inputCls = "mt-1 w-full rounded-md border border-fam-border px-3 py-2 text-sm";
const labelCls = "text-sm font-medium text-fam-text";
const btnPrimary = "rounded-md bg-fam-action px-4 py-2 text-sm font-medium text-fam-on-action hover:bg-fam-action-hover disabled:opacity-60";
const btnGhost = "rounded-md border border-fam-border px-3 py-1.5 text-xs font-medium text-fam-text hover:bg-fam-subtle disabled:opacity-60";

const errMsg = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

const preview = (text, recipient) => String(text || "")
  .replaceAll("{{nombre_cliente}}", recipient?.recipient_name || "Cliente")
  .replaceAll("{{laboratorio}}", recipient?.laboratory_name || "Laboratorio");

const pct = (part, total) => (total ? `${Math.round((part / total) * 100)}%` : "—");

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.draft;
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

function Metric({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-fam-border bg-fam-surface p-3">
      <p className="text-xs uppercase tracking-wide text-fam-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-fam-text">{value}</p>
      {hint && <p className="text-xs text-fam-muted">{hint}</p>}
    </div>
  );
}

// ─── Editor (borrador) / detalle (enviada) ───────────────────────────────────
function Editor({ campaign, contacts, accounts, onClose, onSaved, onRetry }) {
  const readOnly = Boolean(campaign?.id) && campaign.status !== "draft";
  const [form, setForm] = useState(campaign ? {
    campaign_name: campaign.campaign_name || "",
    subject: campaign.subject || "",
    preheader: campaign.preheader || "",
    body_content: campaign.body_content || "",
    is_template: Boolean(campaign.is_template),
    recipients: (campaign.recipients || []).map((item) => ({
      source_type: item.contact_id ? "contact" : "account",
      source_id: item.contact_id || item.account_id,
      laboratory_name: item.laboratory_name,
      recipient_name: item.recipient_name,
      recipient_email: item.recipient_email,
      delivery_status: item.delivery_status,
      error_message: item.error_message,
      open_count: item.open_count,
      click_count: item.click_count,
    })),
  } : EMPTY);
  const [source, setSource] = useState("");
  const [laboratory, setLaboratory] = useState("");
  const [filters, setFilters] = useState({ city: "", classification: "", account_type: "" });
  const [candidates, setCandidates] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const options = useMemo(() => [
    ...contacts.filter((item) => item.email).map((item) => ({
      id: `contact:${item.id}`, source_type: "contact", source_id: item.id,
      recipient_name: [item.first_name, item.last_name].filter(Boolean).join(" "), recipient_email: item.email,
      label: `${[item.first_name, item.last_name].filter(Boolean).join(" ")} · ${item.email}`,
    })),
    ...accounts.filter((item) => item.email).map((item) => ({
      id: `account:${item.id}`, source_type: "account", source_id: item.id,
      recipient_name: item.account_name, recipient_email: item.email, label: `${item.account_name} · ${item.email}`,
    })),
  ], [accounts, contacts]);

  const has = (r) => form.recipients.some((x) => x.source_id === r.source_id && x.source_type === r.source_type);
  const hasEmail = (email) => form.recipients.some((x) => String(x.recipient_email).toLowerCase() === String(email).toLowerCase());

  const addRecipient = () => {
    const selected = options.find((item) => item.id === source);
    if (!selected || !laboratory.trim()) { setError("Selecciona un contacto o cliente con email e indica el laboratorio."); return; }
    if (has(selected) || hasEmail(selected.recipient_email)) { setError("Ese destinatario ya esta agregado."); return; }
    if (form.recipients.length >= MAX_RECIPIENTS) { setError(`Una campaña admite hasta ${MAX_RECIPIENTS} destinatarios.`); return; }
    setForm((current) => ({ ...current, recipients: [...current.recipients, { ...selected, laboratory_name: laboratory.trim() }] }));
    setSource(""); setLaboratory(""); setError("");
  };

  const searchAudience = async () => {
    setSearching(true); setError("");
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const result = await fetchCampaignAudience(params);
      setCandidates((result?.data || []).filter((c) => !hasEmail(c.recipient_email)));
    } catch (err) { setError(errMsg(err, "No se pudo buscar la audiencia.")); }
    finally { setSearching(false); }
  };

  const addCandidates = () => {
    const room = MAX_RECIPIENTS - form.recipients.length;
    const toAdd = (candidates || []).slice(0, Math.max(room, 0));
    setForm((current) => ({ ...current, recipients: [...current.recipients, ...toAdd] }));
    if ((candidates || []).length > toAdd.length) setError(`Solo caben ${MAX_RECIPIENTS} destinatarios; se agregaron ${toAdd.length}.`);
    setCandidates(null);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.campaign_name.trim() || !form.subject.trim() || !form.body_content.trim()) { setError("Completa nombre, asunto y contenido."); return; }
    if (!form.recipients.length) { setError("Agrega al menos un destinatario."); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        ...form,
        recipients: form.recipients.map(({ source_type, source_id, laboratory_name }) => ({ source_type, source_id, laboratory_name })),
      };
      await (campaign?.id ? updateEmailCampaign(campaign.id, payload) : createEmailCampaign(payload));
      onSaved();
    } catch (err) { setError(errMsg(err, "No se pudo guardar el borrador.")); }
    finally { setSaving(false); }
  };

  const recipient = form.recipients[0];
  const total = campaign?.recipient_count || 0;

  return (
    <Modal open title={!campaign?.id ? "Nueva campaña" : readOnly ? campaign.campaign_name : "Editar borrador"} onClose={onClose} maxWidth="max-w-6xl" disableClose={saving}>
      <form onSubmit={save}>
        {campaign?.id && <div className="mb-4"><StatusBadge status={campaign.status} /></div>}

        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            {error && <div className="rounded-lg border border-transparent bg-fam-danger-bg px-4 py-3 text-sm text-fam-danger" role="alert">{error}</div>}

            {readOnly && (
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Enviados" value={campaign.sent_count} hint={`de ${total}`} />
                <Metric label="Fallidos" value={campaign.failed_count} hint={campaign.skipped_count ? `${campaign.skipped_count} omitidos (baja)` : null} />
                <Metric label="Aperturas" value={campaign.opened_count} hint={pct(campaign.opened_count, campaign.sent_count)} />
                <Metric label="Clics" value={campaign.clicked_count} hint={pct(campaign.clicked_count, campaign.sent_count)} />
              </section>
            )}

            <section className="grid gap-4">
              <label className={labelCls}>Nombre interno
                <input disabled={readOnly} value={form.campaign_name} onChange={(e) => setForm({ ...form, campaign_name: e.target.value })} maxLength={160} className={inputCls} placeholder="Descuentos octubre — Pareto" />
              </label>
              <label className={labelCls}>Asunto
                <input disabled={readOnly} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={200} className={inputCls} placeholder="Descuentos para {{laboratorio}}" />
              </label>
              <label className={labelCls}>Preencabezado <span className="font-normal text-fam-muted">(opcional)</span>
                <input disabled={readOnly} value={form.preheader} onChange={(e) => setForm({ ...form, preheader: e.target.value })} maxLength={240} className={inputCls} />
              </label>
              <label className={labelCls}>Contenido
                <textarea disabled={readOnly} value={form.body_content} onChange={(e) => setForm({ ...form, body_content: e.target.value })} maxLength={20000} rows={9} className={`${inputCls} leading-6`} placeholder="Hola {{nombre_cliente}}, tenemos descuentos para {{laboratorio}}." />
              </label>
              <p className="text-xs text-fam-muted">Variables: <code>{"{{nombre_cliente}}"}</code> y <code>{"{{laboratorio}}"}</code>. Los enlaces (https://…) se miden automáticamente.</p>
              {!readOnly && (
                <label className="flex items-center gap-2 text-sm text-fam-text">
                  <input type="checkbox" checked={form.is_template} onChange={(e) => setForm({ ...form, is_template: e.target.checked })} />
                  Marcar como plantilla reutilizable (se usa con “Duplicar”)
                </label>
              )}
            </section>

            <section className="border-t border-fam-border pt-5">
              <h3 className="font-semibold text-fam-text">Audiencia <span className="font-normal text-fam-muted">({form.recipients.length})</span></h3>

              {!readOnly && (
                <>
                  <p className="mb-3 text-sm text-fam-muted">Agrega por filtros de cliente o uno a uno. Quienes se dieron de baja no aparecen.</p>
                  <div className="grid gap-3 rounded-lg bg-fam-subtle p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <input value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} className="rounded-md border border-fam-border px-3 py-2 text-sm" placeholder="Ciudad" />
                    <select value={filters.classification} onChange={(e) => setFilters({ ...filters, classification: e.target.value })} className="rounded-md border border-fam-border bg-fam-surface px-3 py-2 text-sm">
                      <option value="">Cualquier clasificación</option>
                      <option value="oro">Oro</option><option value="plata">Plata</option><option value="bronce">Bronce</option><option value="normal">Normal</option>
                    </select>
                    <select value={filters.account_type} onChange={(e) => setFilters({ ...filters, account_type: e.target.value })} className="rounded-md border border-fam-border bg-fam-surface px-3 py-2 text-sm">
                      <option value="">Cualquier tipo</option>
                      <option value="empresa">Empresa</option><option value="persona_natural">Persona natural</option><option value="gobierno">Gobierno</option><option value="ong">ONG</option>
                    </select>
                    <button type="button" onClick={searchAudience} disabled={searching} className={btnPrimary}>{searching ? "Buscando..." : "Buscar"}</button>
                  </div>
                  {candidates && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-fam-border bg-fam-selected px-3 py-2 text-sm text-fam-text">
                      <span>{candidates.length ? `${candidates.length} contacto(s) o cliente(s) con email encontrados.` : "No hay coincidencias nuevas."}</span>
                      <span className="flex gap-2">
                        {candidates.length > 0 && <button type="button" onClick={addCandidates} className={btnPrimary}>Agregar todos</button>}
                        <button type="button" onClick={() => setCandidates(null)} className={btnGhost}>Descartar</button>
                      </span>
                    </div>
                  )}

                  <div className="mt-3 grid gap-3 rounded-lg bg-fam-subtle p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <select value={source} onChange={(e) => setSource(e.target.value)} className="min-w-0 rounded-md border border-fam-border bg-fam-surface px-3 py-2 text-sm">
                      <option value="">Seleccionar contacto o cliente</option>
                      {options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                    <input value={laboratory} onChange={(e) => setLaboratory(e.target.value)} maxLength={200} className="rounded-md border border-fam-border px-3 py-2 text-sm" placeholder="Laboratorio que representa" />
                    <button type="button" onClick={addRecipient} className={btnPrimary}>Agregar</button>
                  </div>
                </>
              )}

              <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-fam-border">
                {form.recipients.length ? form.recipients.map((item) => (
                  <div key={`${item.source_type}:${item.source_id}`} className="flex items-center justify-between gap-3 border-b border-fam-border px-3 py-2 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fam-text">{item.recipient_name} · {item.recipient_email}</p>
                      <p className="text-xs text-fam-muted">
                        Laboratorio: {item.laboratory_name}
                        {readOnly && item.delivery_status && (
                          <span className={`ml-2 font-semibold ${(DELIVERY[item.delivery_status] || {}).cls || ""}`}>
                            {(DELIVERY[item.delivery_status] || {}).label || item.delivery_status}
                          </span>
                        )}
                        {readOnly && item.open_count > 0 && <span className="ml-2">· abrió {item.open_count}x</span>}
                        {readOnly && item.click_count > 0 && <span className="ml-2">· clics {item.click_count}</span>}
                        {readOnly && item.error_message && <span className="ml-2 text-fam-danger">· {item.error_message}</span>}
                      </p>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, recipients: current.recipients.filter((x) => !(x.source_id === item.source_id && x.source_type === item.source_type)) }))}
                        className="rounded-md px-2 py-1 text-xs font-medium text-fam-danger hover:bg-fam-danger-bg"
                      >Quitar</button>
                    )}
                  </div>
                )) : <p className="p-5 text-center text-sm text-fam-muted">Aún no hay destinatarios.</p>}
              </div>

              {readOnly && campaign.failed_count > 0 && (
                <button type="button" onClick={() => onRetry(campaign)} className={`${btnGhost} mt-3`}>Reintentar {campaign.failed_count} fallido(s)</button>
              )}
            </section>
          </div>

          <aside className="h-fit rounded-xl border border-fam-border bg-fam-subtle p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-fam-muted">Vista previa</p>
            <div className="mt-3 rounded-lg border border-fam-border bg-fam-surface p-4">
              <p className="text-xs text-fam-muted">Asunto</p>
              <p className="mt-1 font-semibold text-fam-text">{preview(form.subject, recipient) || "Asunto de la campaña"}</p>
              {form.preheader && <p className="mt-3 text-sm text-fam-muted">{preview(form.preheader, recipient)}</p>}
              <div className="my-4 border-t border-fam-border" />
              <p className="whitespace-pre-wrap text-sm leading-6 text-fam-text">{preview(form.body_content, recipient) || "El contenido personalizado aparecerá aquí."}</p>
              <div className="mt-4 border-t border-fam-border pt-3 text-xs text-fam-muted">Famproject Cia. Ltda. · Darme de baja</div>
            </div>
            <p className="mt-3 text-xs leading-5 text-fam-muted">Cada correo incluye enlace de baja. El envío se hace desde la cuenta del sistema, con una prueba previa obligatoria.</p>
          </aside>
        </div>

        {!readOnly && (
          <footer className="flex justify-end gap-2 border-t border-fam-border px-5 py-4">
            <button type="button" onClick={onClose} className="rounded-md border border-fam-border px-4 py-2 text-sm text-fam-text">Cancelar</button>
            <button disabled={saving} className={btnPrimary}>{saving ? "Guardando..." : "Guardar borrador"}</button>
          </footer>
        )}
      </form>
    </Modal>
  );
}

// ─── Envío: prueba → confirmación → lotes con progreso ───────────────────────
function SendModal({ campaign, onClose, onDone }) {
  const total = campaign.recipient_count;
  const resuming = campaign.status === "sending";
  const [tested, setTested] = useState(Boolean(campaign.test_sent_at));
  const [testMsg, setTestMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const sendTest = async () => {
    setBusy(true); setError("");
    try {
      const r = await sendEmailCampaignTest(campaign.id);
      setTested(true);
      setTestMsg(`Prueba enviada a ${r.sent_to}. Revisa que se vea bien y que el enlace de baja funcione.`);
    } catch (err) { setError(errMsg(err, "No se pudo enviar la prueba.")); }
    finally { setBusy(false); }
  };

  const runSend = async () => {
    setBusy(true); setError("");
    try {
      let body = resuming ? {} : { confirm: true, expected_recipients: total };
      for (;;) {
        // Cada llamada envía un lote corto; se repite hasta no quedar pendientes.
        const res = await sendEmailCampaignBatch(campaign.id, body);
        body = {};
        setProgress(res);
        if (res.status === "sent" || res.pending === 0) break;
      }
    } catch (err) { setError(errMsg(err, "El envío se interrumpió. Puedes continuarlo.")); }
    finally { setBusy(false); }
  };

  const finished = progress?.status === "sent";
  const done = progress ? progress.sent + progress.failed + progress.skipped : 0;

  return (
    <Modal open title={resuming ? "Continuar envío" : "Enviar campaña"} onClose={finished ? onDone : onClose} maxWidth="max-w-lg" disableClose={busy}>
        <p className="text-sm text-fam-muted">{campaign.campaign_name} · {total} destinatario(s)</p>

        {error && <div className="mt-4 rounded-lg border border-transparent bg-fam-danger-bg px-4 py-3 text-sm text-fam-danger" role="alert">{error}</div>}

        {!resuming && !finished && (
          <ol className="mt-5 space-y-4 text-sm text-fam-text">
            <li>
              <p className="font-medium">1. Enviar una prueba a tu correo</p>
              <button type="button" onClick={sendTest} disabled={busy} className={`${btnGhost} mt-2`}>{tested ? "Enviar otra prueba" : "Enviar prueba"}</button>
              {testMsg && <p className="mt-2 text-xs text-fam-success">{testMsg}</p>}
              {!testMsg && tested && <p className="mt-2 text-xs text-fam-success">Ya se envió una prueba.</p>}
            </li>
            <li className={tested ? "" : "opacity-50"}>
              <p className="font-medium">2. Confirmar el envío real</p>
              <label className="mt-2 flex items-start gap-2 text-xs text-fam-muted">
                <input type="checkbox" disabled={!tested || busy} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
                Confirmo el envío a {total} destinatario(s), clientes con relación comercial con Famproject. Es irreversible.
              </label>
            </li>
          </ol>
        )}

        {progress && (
          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-fam-subtle">
              <div className="h-full bg-fam-action transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
            </div>
            <p className="mt-2 text-sm text-fam-text">
              {finished ? "Envío terminado." : "Enviando…"} Enviados {progress.sent} · fallidos {progress.failed} · omitidos {progress.skipped} · pendientes {progress.pending}
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={finished ? onDone : onClose} disabled={busy} className="rounded-md border border-fam-border px-4 py-2 text-sm text-fam-text disabled:opacity-60">
            {finished ? "Listo" : "Cerrar"}
          </button>
          {!finished && (
            <button type="button" onClick={runSend} disabled={busy || (!resuming && (!tested || !confirmed))} className={btnPrimary}>
              {busy ? "Enviando…" : resuming ? "Continuar" : `Enviar a ${total}`}
            </button>
          )}
        </div>
    </Modal>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function CrmCampaignsPage() {
  const { user } = useAuth();
  const permitted = String(user?.role || "").split(",").map((role) => role.trim().toLowerCase()).some((role) => ROLES.includes(role));
  const [campaigns, setCampaigns] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const [sending, setSending] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [campaignResult, contactResult, accountResult] = await Promise.all([
        fetchEmailCampaigns({ limit: 100 }), fetchContacts({ limit: 500 }), fetchAccounts({ limit: 500 }),
      ]);
      setCampaigns(campaignResult?.data || []);
      setContacts(contactResult?.data || []);
      setAccounts(accountResult?.data || []);
    } catch (err) { setError(errMsg(err, "No se pudieron cargar las campañas.")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (permitted) load(); else setLoading(false); }, [permitted, load]);

  const open = async (campaign) => {
    if (!campaign) { setEditor({}); return; }
    try { setEditor(await fetchEmailCampaignById(campaign.id)); }
    catch (err) { setError(errMsg(err, "No se pudo abrir la campaña.")); }
  };
  const remove = (campaign) => setRemoving(campaign);
  const duplicate = async (campaign) => {
    try { await duplicateEmailCampaign(campaign.id); load(); }
    catch (err) { setError(errMsg(err, "No se pudo duplicar la campaña.")); }
  };
  const retry = async (campaign) => {
    try {
      await retryEmailCampaignFailed(campaign.id);
      setEditor(null);
      setSending({ ...campaign, status: "sending" });
    } catch (err) { setError(errMsg(err, "No se pudo reintentar.")); }
  };

  if (!permitted) {
    return <div className="p-6 text-sm text-fam-muted">No tienes acceso a las campañas de email.</div>;
  }

  return (
    <div>
      <PageHeader
        title="Campañas"
        count={loading ? undefined : campaigns.length}
        context="Correos a clientes y contactos registrados, con envío de prueba, baja y métricas."
        actions={<Btn variant="primary" onClick={() => open(null)}>Nueva campaña</Btn>}
      />

      {error && <div className="mb-4 rounded-lg border border-transparent bg-fam-danger-bg px-4 py-3 text-sm text-fam-danger" role="alert">{error}</div>}

      <section className="overflow-hidden rounded-xl border border-fam-border bg-fam-surface">
        {loading ? (
          <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded bg-fam-subtle" />)}</div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            title="Aún no hay campañas"
            hint="Crea la primera y define su audiencia desde los contactos o clientes registrados."
            action={<Btn variant="primary" onClick={() => open(null)}>Nueva campaña</Btn>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-fam-border bg-fam-subtle text-left text-xs uppercase tracking-wide text-fam-muted">
                <tr><th className="px-5 py-3">Campaña</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3">Audiencia</th><th className="px-5 py-3">Resultados</th><th className="px-5 py-3">Acciones</th></tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const isDraft = campaign.status === "draft";
                  return (
                    <tr key={campaign.id} className="border-b border-fam-border last:border-0">
                      <td className="px-5 py-4">
                        <p className="font-medium text-fam-text">
                          {campaign.campaign_name}
                          {campaign.is_template && <span className="ml-2 rounded bg-fam-selected px-1.5 py-0.5 text-[10px] font-semibold uppercase text-fam-action">Plantilla</span>}
                        </p>
                        <p className="mt-0.5 text-xs text-fam-muted">{campaign.subject}</p>
                        <p className="mt-0.5 text-xs text-fam-muted">{campaign.created_by_name || "—"}</p>
                      </td>
                      <td className="px-5 py-4"><StatusBadge status={campaign.status} /></td>
                      <td className="px-5 py-4 text-fam-text">{campaign.recipient_count} destinatario{Number(campaign.recipient_count) === 1 ? "" : "s"}</td>
                      <td className="px-5 py-4 text-xs text-fam-muted">
                        {isDraft ? "—" : (
                          <>
                            <span className="text-fam-success">{campaign.sent_count} enviados</span>
                            {campaign.failed_count > 0 && <span className="text-fam-danger"> · {campaign.failed_count} fallidos</span>}
                            <br />{campaign.opened_count} aperturas ({pct(campaign.opened_count, campaign.sent_count)}) · {campaign.clicked_count} clics
                          </>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => open(campaign)} className={btnGhost}>{isDraft ? "Editar" : "Ver"}</button>
                          {campaign.status !== "sent" && <button onClick={() => setSending(campaign)} className={`${btnGhost} border-fam-action text-fam-action`}>{campaign.status === "sending" ? "Continuar" : "Enviar"}</button>}
                          <button onClick={() => duplicate(campaign)} className={btnGhost}>Duplicar</button>
                          <button onClick={() => remove(campaign)} className="rounded-md px-3 py-1.5 text-xs font-medium text-fam-danger hover:bg-fam-danger-bg">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editor && (
        <Editor
          campaign={editor.id ? editor : null}
          contacts={contacts}
          accounts={accounts}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); load(); }}
          onRetry={retry}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Eliminar campaña"
          description={`“${removing.campaign_name}” dejará de aparecer en la lista.${removing.status === "sent" ? " Los correos ya enviados no se pueden retirar." : ""}`}
          confirmLabel="Eliminar"
          danger
          onClose={() => setRemoving(null)}
          onConfirm={async () => { await deleteEmailCampaign(removing.id); setRemoving(null); load(); }}
        />
      )}
      {sending && <SendModal campaign={sending} onClose={() => { setSending(null); load(); }} onDone={() => { setSending(null); load(); }} />}
    </div>
  );
}
