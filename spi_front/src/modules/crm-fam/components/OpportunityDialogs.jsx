// Diálogos del embudo de ventas: alta de oportunidad, datos de negocio (promover lead / completar),
// vínculo de cuenta, contactos con canales directos y requerimiento de compra.
import { useEffect, useState } from "react";
import { FiMail, FiMessageCircle, FiMessageSquare, FiPhone, FiPlus } from "react-icons/fi";
import Modal from "../../../core/ui/components/Modal";
import { PrivatePurchaseRequestModal } from "../../../core/ui/components/RequestModals";
import NewPurchaseRequestModal from "../../../shared/purchases/NewPurchaseRequestModal";
import {
  createAccount, createOpportunity, fetchAccountById, fetchContacts,
  linkLeadAccount, linkPurchaseToOpportunity, updateOpportunity,
} from "../../../core/api/crmFamApi";
import { Btn, DefList, ErrorNote, Field, SelectInput, Skeleton, TextInput } from "../ui/kit";
import { errorMessage } from "../ui/format";
import { accountType } from "../ui/status";
import { listOf } from "../ui/useLoad";

export const OPPORTUNITY_SOURCES = [
  { value: "directo", label: "Directo" },
  { value: "referido", label: "Referido" },
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
  { value: "licitacion", label: "Licitación" },
];
// Las oportunidades creadas por otros módulos traen su propio origen (compras, Business Case, lead).
const SYNCED_SOURCES = { private_purchase: "Compra privada", public_purchase: "Compra pública", business_case: "Business Case", lead: "Lead" };
export const opportunitySource = (value) => {
  if (!value) return "—";
  const known = OPPORTUNITY_SOURCES.find((s) => s.value === value)?.label || SYNCED_SOURCES[value];
  if (known) return known;
  const text = String(value).replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Datos de negocio que un lead recién calificado no trae; se marcan como pendientes hasta completarlos.
export const OPPORTUNITY_FIELDS = [
  { key: "account_id", label: "Cuenta" },
  { key: "estimated_amount", label: "Monto estimado" },
  { key: "probability_override", label: "Probabilidad" },
  { key: "estimated_close_date", label: "Cierre estimado" },
  { key: "source", label: "Fuente" },
];
export const missingFields = (opp) => OPPORTUNITY_FIELDS.filter((f) => opp[f.key] === null || opp[f.key] === undefined || opp[f.key] === "");

function AccountSelect({ accounts, ...props }) {
  return (
    <SelectInput {...props}>
      <option value="">Sin cuenta</option>
      {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
    </SelectInput>
  );
}

// ─── Nueva oportunidad ───────────────────────────────────────────────────────
export function OpportunityFormModal({ accounts, stages, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", account_id: "", stage_id: "", estimated_amount: "", estimated_close_date: "", source: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Escribe el nombre de la oportunidad."); return; }
    setSaving(true); setError("");
    try {
      const saved = await createOpportunity({
        name: form.name.trim(),
        ...(form.account_id ? { account_id: form.account_id } : {}),
        ...(form.stage_id ? { stage_id: form.stage_id } : {}),
        ...(form.estimated_amount ? { estimated_amount: Number(form.estimated_amount) } : {}),
        ...(form.estimated_close_date ? { estimated_close_date: form.estimated_close_date } : {}),
        ...(form.source ? { source: form.source } : {}),
      });
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err, "No se pudo crear la oportunidad."));
    } finally { setSaving(false); }
  };

  return (
    <Modal open title="Nueva oportunidad" onClose={onClose} maxWidth="max-w-xl" disableClose={saving}>
      <form onSubmit={submit} noValidate>
        <ErrorNote message={error} className="mb-4" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nombre">{(p) => <TextInput {...p} value={form.name} onChange={set("name")} maxLength={255} autoFocus placeholder="Analizador de química — Laboratorio Central" />}</Field>
          </div>
          <Field label="Cuenta" optional>{(p) => <AccountSelect {...p} accounts={accounts} value={form.account_id} onChange={set("account_id")} />}</Field>
          <Field label="Fase" optional hint="Si no eliges, entra en la primera fase.">
            {(p) => (
              <SelectInput {...p} value={form.stage_id} onChange={set("stage_id")}>
                <option value="">Primera fase</option>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field label="Monto estimado (USD)" optional>{(p) => <TextInput {...p} type="number" min="0" step="0.01" value={form.estimated_amount} onChange={set("estimated_amount")} className="fam-numeric" />}</Field>
          <Field label="Cierre estimado" optional>{(p) => <TextInput {...p} type="date" value={form.estimated_close_date} onChange={set("estimated_close_date")} />}</Field>
          <Field label="Fuente" optional>
            {(p) => (
              <SelectInput {...p} value={form.source} onChange={set("source")}>
                <option value="">Sin definir</option>
                {OPPORTUNITY_SOURCES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
            )}
          </Field>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={saving}>Cancelar</Btn>
          <Btn type="submit" variant="primary" loading={saving}>{saving ? "Guardando…" : "Crear oportunidad"}</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ─── Datos de negocio: al promover un lead (se puede omitir) o al completar una oportunidad ──
export function OpportunityFieldsModal({ title, description, initial = {}, accounts, submitLabel, skipLabel, onSubmit, onClose }) {
  const [form, setForm] = useState({
    account_id: initial.account_id || "",
    estimated_amount: initial.estimated_amount ?? "",
    probability_override: initial.probability_override ?? "",
    estimated_close_date: initial.estimated_close_date ? String(initial.estimated_close_date).slice(0, 10) : "",
    source: initial.source || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const run = async (fields) => {
    setBusy(true); setError("");
    try { await onSubmit(fields); } catch (err) { setError(errorMessage(err, "No se pudo guardar.")); setBusy(false); }
  };
  const submit = (e) => {
    e.preventDefault();
    run({
      account_id: form.account_id || null,
      estimated_amount: form.estimated_amount !== "" ? Number(form.estimated_amount) : null,
      probability_override: form.probability_override !== "" ? Number(form.probability_override) : null,
      estimated_close_date: form.estimated_close_date || null,
      source: form.source || null,
    });
  };

  return (
    <Modal open title={title} onClose={onClose} maxWidth="max-w-xl" disableClose={busy}>
      <form onSubmit={submit} noValidate>
        {description && <p className="mb-4 text-sm text-fam-muted">{description}</p>}
        <ErrorNote message={error} className="mb-4" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Cuenta" optional>{(p) => <AccountSelect {...p} accounts={accounts} value={form.account_id} onChange={set("account_id")} />}</Field>
          </div>
          <Field label="Monto estimado (USD)" optional>{(p) => <TextInput {...p} type="number" min="0" step="0.01" value={form.estimated_amount} onChange={set("estimated_amount")} className="fam-numeric" />}</Field>
          <Field label="Probabilidad (%)" optional>{(p) => <TextInput {...p} type="number" min="0" max="100" value={form.probability_override} onChange={set("probability_override")} className="fam-numeric" />}</Field>
          <Field label="Cierre estimado" optional>{(p) => <TextInput {...p} type="date" value={form.estimated_close_date} onChange={set("estimated_close_date")} />}</Field>
          <Field label="Fuente" optional>
            {(p) => (
              <SelectInput {...p} value={form.source} onChange={set("source")}>
                <option value="">Sin definir</option>
                {OPPORTUNITY_SOURCES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
            )}
          </Field>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {skipLabel ? <Btn onClick={() => run({})} disabled={busy}>{skipLabel}</Btn> : <Btn onClick={onClose} disabled={busy}>Cancelar</Btn>}
          <Btn type="submit" variant="primary" loading={busy}>{busy ? "Guardando…" : submitLabel}</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ─── Vincular cuenta a un lead o a una oportunidad (existente o nueva) ────────
export function AccountLinkModal({ lead, opportunity, accounts, onClose, onLinked }) {
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState(lead?.company_name || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn) => {
    setBusy(true); setError("");
    try { await fn(); onLinked(); } catch (err) { setError(errorMessage(err, "No se pudo vincular la cuenta.")); setBusy(false); }
  };
  const linkExisting = () => run(() => (lead
    ? linkLeadAccount(lead.id, { account_id: selectedId })
    : updateOpportunity(opportunity.id, { account_id: selectedId })));
  const createAndLink = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      if (lead) { await linkLeadAccount(lead.id, { account_name: name }); return; }
      const created = await createAccount({ account_name: name });
      await updateOpportunity(opportunity.id, { account_id: created.id });
    });
  };

  return (
    <Modal open title="Vincular cuenta" onClose={onClose} maxWidth="max-w-md" disableClose={busy}>
      {lead && <p className="mb-4 text-sm text-fam-muted">El lead no cambia de etapa: solo queda asociado a la cuenta para sus contactos y seguimiento.</p>}
      <ErrorNote message={error} className="mb-4" />
      <Field label="Cuenta existente">{(p) => <AccountSelect {...p} accounts={accounts} value={selectedId} onChange={(e) => setSelectedId(e.target.value)} />}</Field>
      <div className="mt-3 flex justify-end">
        <Btn variant="primary" onClick={linkExisting} disabled={!selectedId || busy}>Vincular</Btn>
      </div>
      <form onSubmit={createAndLink} className="mt-5 border-t border-fam-border pt-4">
        <Field label="O crea una cuenta nueva">{(p) => <TextInput {...p} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={255} placeholder="Nombre de la cuenta" />}</Field>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={busy}>Cancelar</Btn>
          <Btn type="submit" disabled={!newName.trim() || busy} loading={busy}>Crear y vincular</Btn>
        </div>
      </form>
    </Modal>
  );
}

// Ficha breve de la cuenta ya vinculada.
export function AccountPeekModal({ accountId, onClose }) {
  const [state, setState] = useState({ loading: true, account: null });
  useEffect(() => {
    let cancelled = false;
    fetchAccountById(accountId)
      .then((account) => { if (!cancelled) setState({ loading: false, account }); })
      .catch(() => { if (!cancelled) setState({ loading: false, account: null }); });
    return () => { cancelled = true; };
  }, [accountId]);
  const a = state.account;
  return (
    <Modal open title="Cuenta" onClose={onClose} maxWidth="max-w-md" closeOnBackdrop>
      {state.loading ? <Skeleton className="h-24 w-full" /> : !a ? (
        <p className="text-sm text-fam-muted">No se pudo cargar la cuenta.</p>
      ) : (
        <>
          <p className="mb-3 text-base font-semibold text-fam-text">{a.account_name}</p>
          <DefList
            columns={2}
            items={[
              { label: "RUC", value: a.ruc ? <span className="fam-id">{a.ruc}</span> : null },
              { label: "Tipo", value: a.account_type ? accountType(a.account_type) : null },
              { label: "Industria", value: a.industry },
              { label: "Ciudad", value: a.city },
            ]}
          />
          <div className="mt-5 flex justify-end">
            <Btn variant="primary" to={`/dashboard/crm-fam/accounts/${a.id}`}>Abrir cuenta</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── Contactos con canales directos (tel:, sms:, mailto: y wa.me los resuelve el dispositivo) ──
const digits = (phone) => String(phone).replace(/[^\d+]/g, "");
const CHANNEL = "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-fam-border text-fam-muted transition-colors duration-100 hover:bg-fam-subtle hover:text-fam-text";

export function ContactChannels({ contact }) {
  const phone = contact.mobile || contact.phone;
  return (
    <span className="flex shrink-0 gap-1.5">
      {phone && (
        <>
          <a href={`https://wa.me/${String(phone).replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" title="WhatsApp" className={CHANNEL}><FiMessageCircle className="h-4 w-4" aria-hidden="true" /></a>
          <a href={`tel:${digits(phone)}`} aria-label="Llamar" title="Llamar" className={CHANNEL}><FiPhone className="h-4 w-4" aria-hidden="true" /></a>
          <a href={`sms:${digits(phone)}`} aria-label="Mensaje de texto" title="Mensaje de texto" className={CHANNEL}><FiMessageSquare className="h-4 w-4" aria-hidden="true" /></a>
        </>
      )}
      {contact.email && <a href={`mailto:${contact.email}`} aria-label="Correo" title="Correo" className={CHANNEL}><FiMail className="h-4 w-4" aria-hidden="true" /></a>}
    </span>
  );
}

// `seed` permite mostrar el contacto directo de un lead que aún no tiene cuenta.
export function ContactsModal({ title, accountId, seed = [], onAddContact, onClose }) {
  const [contacts, setContacts] = useState(accountId ? null : seed);
  useEffect(() => {
    if (!accountId) return undefined;
    let cancelled = false;
    fetchContacts({ account_id: accountId, limit: 100 })
      .then((res) => { if (!cancelled) setContacts(listOf(res)); })
      .catch(() => { if (!cancelled) setContacts([]); });
    return () => { cancelled = true; };
  }, [accountId]);

  return (
    <Modal open title={title} onClose={onClose} maxWidth="max-w-lg" closeOnBackdrop>
      {contacts === null ? (
        <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-fam-muted">{accountId ? "Esta cuenta aún no tiene contactos." : "Aún no hay contactos registrados."}</p>
      ) : (
        <ul className="divide-y divide-fam-border">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-fam-text">{c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Contacto sin nombre"}</span>
                <span className="block truncate text-[13px] text-fam-muted">{[c.job_title, c.mobile || c.phone, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</span>
              </span>
              <ContactChannels contact={c} />
            </li>
          ))}
        </ul>
      )}
      {onAddContact && (
        <div className="mt-5 flex justify-end">
          <Btn icon={FiPlus} onClick={onAddContact}>Agregar contacto</Btn>
        </div>
      )}
    </Modal>
  );
}

// ─── Requerimiento de compra ─────────────────────────────────────────────────
export const PURCHASE_STATUS = {
  pending_commercial: ["Pendiente comercial", "warning"],
  pending_backoffice: ["Pendiente backoffice", "warning"],
  offer_sent: ["Oferta enviada", "info"],
  pending_manager_signature: ["Pendiente firma de gerencia", "warning"],
  pending_client_signature: ["Pendiente firma del cliente", "warning"],
  offer_signed: ["Oferta firmada", "success"],
  offer_rejected_by_commercial: ["Oferta rechazada (comercial)", "danger"],
  price_improvement_requested: ["Mejora de precio solicitada", "warning"],
  client_registration_requested: ["Registro de cliente solicitado", "warning"],
  client_registered: ["Cliente registrado", "success"],
  inspection_requested: ["Inspección solicitada", "warning"],
  business_case_in_progress: ["Business Case en curso", "info"],
  business_case_under_review: ["Business Case en revisión", "warning"],
  business_case_feasibility_approved: ["Factibilidad aprobada", "success"],
  business_case_rejected: ["Business Case rechazado", "danger"],
  delivered_signed: ["Entregado y firmado", "success"],
  rejected: ["Rechazado", "danger"],
};
export const OFFER_KINDS = { venta: "Venta", alquiler: "Alquiler", alquiler_transferencia_dominio: "Alquiler con transferencia", comodato: "Comodato" };

// El estado y el avance del expediente se muestran con components/OpportunityJourney.jsx.

// Elige el tipo de proceso y abre el formulario del módulo de compras; al crear, lo liga a la oportunidad.
export function PurchasePickerModal({ opportunity, onClose, onCreated }) {
  const [flow, setFlow] = useState(null); // null | "private" | "public"

  const done = async (result, type) => {
    const purchaseId = result?.data?.id || result?.id || result?.request?.id || null;
    if (purchaseId) {
      await linkPurchaseToOpportunity(opportunity.id, { purchase_id: purchaseId, purchase_type: type }).catch(() => {});
    }
    onCreated();
  };

  if (flow === "private") return <PrivatePurchaseRequestModal isOpen onClose={onClose} onSuccess={(r) => done(r, "private")} />;
  if (flow === "public") return <NewPurchaseRequestModal isOpen onClose={onClose} onSuccess={(r) => done(r, "public")} />;

  const option = "w-full rounded-lg border border-fam-border px-4 py-3 text-left transition-colors duration-100 hover:bg-fam-subtle";
  return (
    <Modal open title="Requerimiento de compra" onClose={onClose} maxWidth="max-w-md" closeOnBackdrop>
      <p className="mb-4 text-sm text-fam-muted">Elige el tipo de proceso para “{opportunity.name}”.</p>
      <div className="space-y-2">
        <button type="button" onClick={() => setFlow("private")} className={option}>
          <span className="block text-sm font-medium text-fam-text">Compra privada</span>
          <span className="block text-[13px] text-fam-muted">Venta, alquiler o comodato a cliente final</span>
        </button>
        <button type="button" onClick={() => setFlow("public")} className={option}>
          <span className="block text-sm font-medium text-fam-text">Compra pública</span>
          <span className="block text-[13px] text-fam-muted">Proceso con entidad pública (pasa a ACP)</span>
        </button>
      </div>
    </Modal>
  );
}
