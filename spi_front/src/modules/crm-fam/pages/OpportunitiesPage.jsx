import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useOpportunities } from "../hooks/useCrmOpportunities";
import {
  createOpportunity,
  fetchPipelineStages,
  fetchLeads,
  updateLead,
  disqualifyLead,
  linkLeadAccount,
  createLeadContact,
  promoteLeadToOpportunity,
  fetchOpportunityPurchaseStatus,
  linkPurchaseToOpportunity,
  createActivity,
  fetchActivities,
  changeOpportunityStage,
  fetchAccounts,
  fetchAccountById,
  createAccount,
  createContact,
  fetchContacts,
  updateOpportunity,
} from "../../../core/api/crmFamApi";
import SearchableSelect from "../../../core/ui/components/SearchableSelect";
import Modal from "../../../core/ui/components/Modal";
import { FiInbox, FiBriefcase, FiUsers, FiUserPlus, FiShoppingCart, FiPhone, FiMail, FiMessageSquare, FiMessageCircle } from "react-icons/fi";
import { PrivatePurchaseRequestModal } from "../../../core/ui/components/RequestModals";
import NewPurchaseRequestModal from "../../../shared/purchases/NewPurchaseRequestModal";

const PURCHASE_STATUS_LABELS = {
  pending_commercial: "Pendiente comercial",
  pending_backoffice: "Pendiente backoffice",
  offer_sent: "Oferta enviada",
  pending_manager_signature: "Pendiente firma gerencia",
  pending_client_signature: "Pendiente firma cliente",
  offer_signed: "Oferta firmada",
  offer_rejected_by_commercial: "Oferta rechazada (comercial)",
  price_improvement_requested: "Mejora de precio solicitada",
  client_registration_requested: "Registro de cliente solicitado",
  client_registered: "Cliente registrado",
  inspection_requested: "Inspección solicitada",
  business_case_in_progress: "Business case en curso",
  business_case_under_review: "Business case en revisión",
  business_case_feasibility_approved: "Factibilidad aprobada",
  business_case_rejected: "Business case rechazado",
  delivered_signed: "Entregado y firmado",
  rejected: "Rechazado",
};

const OFFER_KIND_LABELS = { venta: "Venta", alquiler: "Alquiler", alquiler_transferencia_dominio: "Alquiler con transferencia", comodato: "Comodato" };

const purchaseStatusLabel = (status) =>
  PURCHASE_STATUS_LABELS[status] || String(status || "").replaceAll("_", " ");

// ponytail: tel:/sms:/mailto: los resuelve el sistema operativo (app nativa en iOS/Android,
// Phone Link / cliente de correo en Windows); wa.me rutea solo a app o WhatsApp Web.
const contactHref = {
  whatsapp: (phone) => `https://wa.me/${String(phone).replace(/\D/g, "")}`,
  call: (phone) => `tel:${String(phone).replace(/[^\d+]/g, "")}`,
  sms: (phone) => `sms:${String(phone).replace(/[^\d+]/g, "")}`,
  email: (email) => `mailto:${email}`,
};

const LIMIT = 20;

// Tokens de boton por variante (DESIGN.md §7 Components / Buttons)
const BTN_PRIMARY = "rounded-xl bg-[#2563EB] text-white transition-transform duration-[120ms] ease-out hover:bg-[#1D4ED8] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
const BTN_SECONDARY = "rounded-xl bg-white border border-[#D1D5DB] text-[#1F2937] transition-transform duration-[120ms] ease-out hover:bg-[#F9FAFB] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
const BTN_DANGER_SOFT = "rounded-xl bg-white border border-[#DC2626] text-[#DC2626] transition-transform duration-[120ms] ease-out hover:bg-[#FEE2E2] active:scale-[0.97] cursor-pointer";
const BTN_SUCCESS_SOFT = "rounded-xl bg-white border border-[#16A34A] text-[#16A34A] transition-transform duration-[120ms] ease-out hover:bg-[#DCFCE7] active:scale-[0.97] cursor-pointer";
const CARD_BASE = "rounded-xl border border-[#E5E7EB] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition-shadow duration-150";
const CARD_INTERACTIVE = `${CARD_BASE} cursor-pointer hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)] hover:border-[#D1D5DB]`;
const KANBAN_TONES = [
  { rail: "#2563EB", bg: "#EFF6FF", chip: "#DBEAFE", text: "#1D4ED8" },
  { rail: "#0F766E", bg: "#ECFDF5", chip: "#CCFBF1", text: "#0F766E" },
  { rail: "#D97706", bg: "#FFFBEB", chip: "#FEF3C7", text: "#B45309" },
  { rail: "#7C3AED", bg: "#F5F3FF", chip: "#EDE9FE", text: "#6D28D9" },
  { rail: "#DB2777", bg: "#FDF2F8", chip: "#FCE7F3", text: "#BE185D" },
  { rail: "#475569", bg: "#F8FAFC", chip: "#E2E8F0", text: "#334155" },
];
const LEAD_TONE = { rail: "#2563EB", bg: "#EFF6FF", chip: "#DBEAFE", text: "#1D4ED8" };
const QUALIFIED_TONE = { rail: "#16A34A", bg: "#F0FDF4", chip: "#DCFCE7", text: "#15803D" };

const getColumnTone = (index = 0) => KANBAN_TONES[index % KANBAN_TONES.length];

const HEALTH_COLORS = {
  gray:   { bg: "#F3F4F6", text: "#6B7280", label: "Iniciar Blue Sheet" },
  green:  { bg: "#DCFCE7", text: "#16A34A", label: "Buena" },
  yellow: { bg: "#FEF3C7", text: "#D97706", label: "Regular" },
  red:    { bg: "#FEE2E2", text: "#DC2626", label: "Critica" },
};

const OPP_STATUS = {
  open:      { bg: "#EFF6FF", text: "#1D4ED8", label: "Abierta" },
  won:       { bg: "#DCFCE7", text: "#16A34A", label: "Ganada" },
  lost:      { bg: "#FEE2E2", text: "#DC2626", label: "Perdida" },
  suspended: { bg: "#F3F4F6", text: "#6B7280", label: "Suspendida" },
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "open", label: "Abierta" },
  { value: "won", label: "Ganada" },
  { value: "lost", label: "Perdida" },
  { value: "suspended", label: "Suspendida" },
];

const SOURCE_OPTIONS = [
  { value: "directo", label: "Directo" },
  { value: "referido", label: "Referido" },
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
  { value: "licitacion", label: "Licitacion" },
];

const EMPTY_FORM = {
  name: "",
  account_id: "",
  stage_id: "",
  estimated_amount: "",
  estimated_close_date: "",
  source: "",
};

function Badge({ bg, text, label }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}

function SkeletonRows() {
  const p = <div className="animate-pulse bg-gray-200 h-4 rounded w-full" />;
  return Array.from({ length: 5 }).map((_, i) => (
    <tr key={i} className="border-b border-[#E5E7EB]">
      <td className="px-4 py-3">{p}</td>
      <td className="px-4 py-3 hidden sm:table-cell">{p}</td>
      <td className="px-4 py-3">{p}</td>
      <td className="px-4 py-3 hidden md:table-cell">{p}</td>
      <td className="px-4 py-3 hidden md:table-cell">{p}</td>
      <td className="px-4 py-3 hidden md:table-cell">{p}</td>
      <td className="px-4 py-3">{p}</td>
      <td className="px-4 py-3">{p}</td>
    </tr>
  ));
}

function fmt(val) {
  if (val == null) return "—";
  return val;
}

function fmtMoney(val) {
  if (val == null || val === "") return "—";
  return Number(val).toLocaleString("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 0 });
}

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("es-PE");
}

function PurchaseStatusBadge({ opportunityId, navigate }) {
  const [purchase, setPurchase] = useState(undefined); // undefined = loading, null = sin solicitud

  useEffect(() => {
    let alive = true;
    fetchOpportunityPurchaseStatus(opportunityId)
      .then((res) => { if (alive) setPurchase(res || null); })
      .catch(() => { if (alive) setPurchase(null); });
    return () => { alive = false; };
  }, [opportunityId]);

  if (purchase === undefined) {
    return <div className="text-xs text-[#9CA3AF] mt-1">Cargando estado...</div>;
  }
  if (!purchase) {
    return <div className="text-xs text-[#9CA3AF] mt-1">Sin requerimiento de compra</div>;
  }
  const isPublic = purchase.purchase_type === "public";
  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge bg="#EFF6FF" text="#1D4ED8" label={isPublic ? "Compra pública" : (OFFER_KIND_LABELS[purchase.offer_kind] || "Compra privada")} />
        <Badge bg="#F3F4F6" text="#6B7280" label={purchaseStatusLabel(purchase.status)} />
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/purchases/workspace?tab=${isPublic ? "public" : "private"}`); }}
        className="cursor-pointer text-left text-xs text-[#2563EB] hover:underline"
      >
        Ver expediente
      </button>
    </div>
  );
}

function AddActivityModal({ opportunityId, onClose, onSaved }) {
  const [subject, setSubject] = useState("");
  const [activityType, setActivityType] = useState("llamada");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await createActivity({
        opportunity_id: opportunityId,
        subject: subject.trim(),
        activity_type: activityType,
        scheduled_at: scheduledAt || null,
      });
      onSaved();
    } catch (ex) {
      setErr(ex.message || "Error al guardar la actividad");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Agregar actividad" onClose={onClose} maxWidth="max-w-sm">
      {err && (
        <div className="mb-3 rounded-xl border border-[#DC2626]/30 bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">
          {err}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#1F2937]">Asunto</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Asunto de la actividad"
            className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#1F2937]">Tipo</label>
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
          >
            <option value="llamada">Llamada</option>
            <option value="reunion">Reunión</option>
            <option value="email">Email</option>
            <option value="visita">Visita</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#1F2937]">Fecha programada</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={`px-4 py-2 text-sm ${BTN_SECONDARY}`}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={`px-4 py-2 text-sm font-medium ${BTN_PRIMARY}`}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ActivitiesSummary({ opportunityId, onAddActivity }) {
  const [activities, setActivities] = useState(undefined); // undefined = loading

  const load = useCallback(() => {
    fetchActivities({ opportunity_id: opportunityId, limit: 5 })
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res?.data ?? []);
        setActivities(rows);
      })
      .catch(() => setActivities([]));
  }, [opportunityId]);

  useEffect(() => { load(); }, [load]);

  const pending = Array.isArray(activities) ? activities.filter(a => a.status === "scheduled") : [];

  return (
    <div className="mt-1.5 border-t border-[#F1F5F9] pt-1.5">
      {pending.length > 0 && (
        <div className="flex flex-col gap-0.5 mb-1">
          {pending.slice(0, 2).map(a => (
            <div key={a.id} className="text-[11px] text-[#6B7280] truncate">• {a.subject}</div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <Badge bg="#F3F4F6" text="#6B7280" label={`${pending.length} actividad${pending.length === 1 ? "" : "es"}`} />
        <button
          onClick={(e) => { e.stopPropagation(); onAddActivity(opportunityId, load); }}
          className="text-xs text-[#2563EB] hover:underline"
        >
          + Actividad
        </button>
      </div>
    </div>
  );
}

function CreateAccountFromLeadModal({ lead, accountOptions, onClose, onSaved }) {
  const [accountName, setAccountName] = useState(lead.company_name || "");
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const handleLinkExisting = async () => {
    if (!selectedId) return;
    setSaving(true);
    setErr(null);
    try {
      await linkLeadAccount(lead.id, { account_id: selectedId });
      onSaved();
    } catch (ex) {
      setErr(ex.message || "Error al vincular la cuenta");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!accountName.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await linkLeadAccount(lead.id, { account_name: accountName.trim() });
      onSaved();
    } catch (ex) {
      setErr(ex.message || "Error al crear y vincular la cuenta");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Cuenta del lead" onClose={onClose} maxWidth="max-w-md">
      {err && (
        <div className="mb-3 rounded-xl border border-[#DC2626]/30 bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">
          {err}
        </div>
      )}
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] p-3">
          <p className="text-sm font-semibold text-[#1E3A8A]">Vincula el lead a una cuenta desde el primer contacto</p>
          <p className="mt-1 text-xs text-[#1D4ED8]">El lead no se convierte ni cambia de etapa; solo queda asociado para contactos y seguimiento.</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#1F2937]">Cuenta existente</label>
          <SearchableSelect options={accountOptions} value={selectedId} onChange={setSelectedId} placeholder="Buscar cuenta por nombre..." />
          <button
            type="button"
            onClick={handleLinkExisting}
            disabled={!selectedId || saving}
            className={`mt-2 px-4 py-2 text-sm font-medium ${BTN_PRIMARY}`}
          >
            {saving ? "Vinculando..." : "Vincular cuenta"}
          </button>
        </div>

        <form onSubmit={handleCreate} className="border-t border-[#E5E7EB] pt-3">
          <label className="mb-1 block text-xs font-medium text-[#1F2937]">Crear cuenta nueva</label>
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Nombre de la cuenta"
            className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className={`px-4 py-2 text-sm ${BTN_SECONDARY}`}>Cancelar</button>
            <button type="submit" disabled={saving || !accountName.trim()} className={`px-4 py-2 text-sm font-medium ${BTN_PRIMARY}`}>
              {saving ? "Creando..." : "Crear y vincular"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function CreateContactModal({ initial = {}, accountOptions, defaultAccountId = "", leadId = null, onClose, onSaved }) {
  const [firstName, setFirstName] = useState(initial.first_name || "");
  const [lastName, setLastName] = useState(initial.last_name || "");
  const [email, setEmail] = useState(initial.email || "");
  const [phone, setPhone] = useState(initial.phone || "");
  const [accountId, setAccountId] = useState(defaultAccountId || initial.converted_account_id || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        account_id: accountId || null,
      };
      if (leadId) {
        await createLeadContact(leadId, payload);
      } else {
        await createContact(payload);
      }
      onSaved();
    } catch (ex) {
      setErr(ex.message || "Error al crear el contacto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Crear contacto" onClose={onClose} maxWidth="max-w-sm">
      {err && (
        <div className="mb-3 rounded-xl border border-[#DC2626]/30 bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">
          {err}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1F2937]">Nombre</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nombre" className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20" autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1F2937]">Apellido</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellido" className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#1F2937]">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#1F2937]">Telefono</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+593 99 000 0000" className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#1F2937]">Cuenta (opcional)</label>
          <SearchableSelect options={accountOptions} value={accountId} onChange={setAccountId} placeholder="Buscar cuenta por nombre..." />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={`px-4 py-2 text-sm ${BTN_SECONDARY}`}>Cancelar</button>
          <button type="submit" disabled={saving} className={`px-4 py-2 text-sm font-medium ${BTN_PRIMARY}`}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ContactsListModal({ opp, onClose, onAddContact }) {
  const [contacts, setContacts] = useState(undefined);

  useEffect(() => {
    if (!opp.account_id) { setContacts([]); return; }
    fetchContacts({ account_id: opp.account_id, limit: 100 })
      .then((res) => setContacts(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => setContacts([]));
  }, [opp.account_id]);

  const ACTION_BTN = "flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#1F2937] cursor-pointer";

  return (
    <Modal open title={`Contactos${opp.account_name ? ` · ${opp.account_name}` : ""}`} onClose={onClose} maxWidth="max-w-md">
      {!opp.account_id ? (
        <div className="flex flex-col items-center gap-1.5 py-6 text-center">
          <FiUsers size={28} className="text-[#D1D5DB]" />
          <p className="text-sm font-medium text-[#1F2937]">Esta oportunidad no tiene cuenta</p>
          <p className="text-xs text-[#6B7280]">Vincula una cuenta para ver sus contactos.</p>
        </div>
      ) : contacts === undefined ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-[#F3F4F6]" />)}
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-6 text-center">
          <FiUsers size={28} className="text-[#D1D5DB]" />
          <p className="text-sm font-medium text-[#1F2937]">Sin contactos en esta cuenta</p>
          <button onClick={onAddContact} className={`mt-1 px-4 py-2 text-sm font-medium ${BTN_PRIMARY}`}>Agregar contacto</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {contacts.map((c) => {
            const phone = c.mobile || c.phone;
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#1F2937]">{c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ")}</p>
                  <p className="truncate text-xs text-[#6B7280]">{[c.job_title, phone, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {phone && (
                    <>
                      <a href={contactHref.whatsapp(phone)} target="_blank" rel="noreferrer" title="WhatsApp" className={ACTION_BTN}><FiMessageCircle size={15} /></a>
                      <a href={contactHref.call(phone)} title="Llamar" className={ACTION_BTN}><FiPhone size={15} /></a>
                      <a href={contactHref.sms(phone)} title="Mensaje de texto" className={ACTION_BTN}><FiMessageSquare size={15} /></a>
                    </>
                  )}
                  {c.email && (
                    <a href={contactHref.email(c.email)} title="Correo" className={ACTION_BTN}><FiMail size={15} /></a>
                  )}
                </div>
              </div>
            );
          })}
          <button onClick={onAddContact} className={`mt-1 self-start px-4 py-2 text-sm ${BTN_SECONDARY}`}>Agregar contacto</button>
        </div>
      )}
    </Modal>
  );
}

function LeadContactsModal({ lead, onClose, onAddContact }) {
  const [contacts, setContacts] = useState(undefined);

  useEffect(() => {
    if (!lead.converted_account_id) {
      const direct = lead.converted_contact_id
        ? [{
            id: lead.converted_contact_id,
            full_name: lead.converted_contact_name,
            email: lead.converted_contact_email,
            phone: lead.converted_contact_phone,
          }]
        : [];
      setContacts(direct);
      return;
    }
    fetchContacts({ account_id: lead.converted_account_id, limit: 100 })
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res?.data ?? []);
        setContacts(rows);
      })
      .catch(() => setContacts([]));
  }, [lead]);

  const ACTION_BTN = "flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#1F2937] cursor-pointer";
  const title = lead.converted_account_name || lead.company_name || lead.full_name || "Lead";

  return (
    <Modal open title={`Contactos · ${title}`} onClose={onClose} maxWidth="max-w-md">
      {contacts === undefined ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-[#F3F4F6]" />)}
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-6 text-center">
          <FiUsers size={28} className="text-[#D1D5DB]" />
          <p className="text-sm font-medium text-[#1F2937]">Sin contactos registrados</p>
          <button onClick={onAddContact} className={`mt-1 px-4 py-2 text-sm font-medium ${BTN_PRIMARY}`}>Nuevo contacto</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {contacts.map((c) => {
            const phone = c.mobile || c.phone;
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#1F2937]">{c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Contacto sin nombre"}</p>
                  <p className="truncate text-xs text-[#6B7280]">{[c.job_title, phone, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {phone && (
                    <>
                      <a href={contactHref.whatsapp(phone)} target="_blank" rel="noreferrer" title="WhatsApp" className={ACTION_BTN}><FiMessageCircle size={15} /></a>
                      <a href={contactHref.call(phone)} title="Llamar" className={ACTION_BTN}><FiPhone size={15} /></a>
                      <a href={contactHref.sms(phone)} title="Mensaje de texto" className={ACTION_BTN}><FiMessageSquare size={15} /></a>
                    </>
                  )}
                  {c.email && (
                    <a href={contactHref.email(c.email)} title="Correo" className={ACTION_BTN}><FiMail size={15} /></a>
                  )}
                </div>
              </div>
            );
          })}
          <button onClick={onAddContact} className={`mt-1 self-start px-4 py-2 text-sm ${BTN_SECONDARY}`}>Nuevo contacto</button>
        </div>
      )}
    </Modal>
  );
}

function AccountModal({ opp, accountOptions, onClose, onLinked }) {
  const [account, setAccount] = useState(undefined);
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!opp.account_id) { setAccount(null); return; }
    fetchAccountById(opp.account_id)
      .then((res) => setAccount(res || null))
      .catch(() => setAccount(null));
  }, [opp.account_id]);

  const linkAccount = async (accountId) => {
    setSaving(true);
    setErr(null);
    try {
      await updateOpportunity(opp.id, { account_id: accountId });
      onLinked();
    } catch (ex) {
      setErr(ex.message || "No se pudo vincular la cuenta");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndLink = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const created = await createAccount({ account_name: newName.trim() });
      await updateOpportunity(opp.id, { account_id: created.id });
      onLinked();
    } catch (ex) {
      setErr(ex.message || "No se pudo crear la cuenta");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={opp.account_id ? "Cuenta" : "Vincular cuenta"} onClose={onClose} maxWidth="max-w-md">
      {err && (
        <div className="mb-3 rounded-xl border border-[#DC2626]/30 bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">{err}</div>
      )}
      {opp.account_id ? (
        account === undefined ? (
          <div className="h-24 animate-pulse rounded-xl bg-[#F3F4F6]" />
        ) : !account ? (
          <p className="text-sm text-[#6B7280]">No se pudo cargar la informacion de la cuenta.</p>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-base font-semibold text-[#1F2937]">{account.account_name}</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#6B7280]">
              <span>RUC: <span className="font-mono text-[#1F2937]">{account.ruc || "sin dato"}</span></span>
              <span>Tipo: {account.account_type || "sin dato"}</span>
              <span>Industria: {account.industry || "sin dato"}</span>
              <span>Ciudad: {account.city || "sin dato"}</span>
            </div>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1F2937]">Vincular cuenta existente</label>
            <SearchableSelect options={accountOptions} value={selectedId} onChange={setSelectedId} placeholder="Buscar cuenta por nombre..." />
            <button
              onClick={() => selectedId && linkAccount(selectedId)}
              disabled={!selectedId || saving}
              className={`mt-2 px-4 py-2 text-sm font-medium ${BTN_PRIMARY}`}
            >
              {saving ? "Vinculando..." : "Vincular"}
            </button>
          </div>
          <div className="border-t border-[#E5E7EB] pt-3">
            <label className="mb-1 block text-xs font-medium text-[#1F2937]">O crear cuenta nueva</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre de la cuenta"
              className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
            />
            <button
              onClick={handleCreateAndLink}
              disabled={!newName.trim() || saving}
              className={`mt-2 px-4 py-2 text-sm ${BTN_SECONDARY}`}
            >
              {saving ? "Creando..." : "Crear y vincular"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function PurchasePickerModal({ opp, onClose, onCreated }) {
  const [flow, setFlow] = useState(null); // null | 'private' | 'public'

  const handleSuccess = async (result, purchaseType) => {
    const purchaseId = result?.data?.id || result?.id || result?.request?.id || null;
    if (purchaseId) {
      await linkPurchaseToOpportunity(opp.id, { purchase_id: purchaseId, purchase_type: purchaseType }).catch(() => {});
    }
    onCreated();
  };

  if (flow === "private") {
    return (
      <PrivatePurchaseRequestModal
        isOpen
        onClose={onClose}
        onSuccess={(result) => handleSuccess(result, "private")}
      />
    );
  }
  if (flow === "public") {
    return (
      <NewPurchaseRequestModal
        isOpen
        onClose={onClose}
        onSuccess={(result) => handleSuccess(result, "public")}
      />
    );
  }
  return (
    <Modal open title="Requerimiento de compra" onClose={onClose} maxWidth="max-w-sm">
      <p className="mb-3 text-sm text-[#6B7280]">Selecciona el tipo de proceso para {opp.name}.</p>
      <div className="flex flex-col gap-2">
        <button onClick={() => setFlow("private")} className={`px-4 py-3 text-left text-sm font-medium ${BTN_SECONDARY}`}>
          Compra privada
          <span className="block text-xs font-normal text-[#6B7280]">Venta, alquiler o comodato a cliente final</span>
        </button>
        <button onClick={() => setFlow("public")} className={`px-4 py-3 text-left text-sm font-medium ${BTN_SECONDARY}`}>
          Compra pública
          <span className="block text-xs font-normal text-[#6B7280]">Proceso con entidad pública / handoff a ACP</span>
        </button>
      </div>
    </Modal>
  );
}

// Campos de negocio que una oportunidad deberia tener pero un lead recien calificado no trae.
// Se piden al pasar a Analisis (con opcion de omitir) y quedan marcados como pendientes en la
// tarjeta hasta que se completen aca mismo.
const OPP_FIELD_DEFS = [
  { key: "account_id", label: "Cuenta" },
  { key: "estimated_amount", label: "Monto estimado" },
  { key: "probability_override", label: "Probabilidad" },
  { key: "estimated_close_date", label: "Cierre estimado" },
  { key: "source", label: "Fuente" },
];

function OpportunityFieldsForm({ initial = {}, accountOptions, onSubmit, submitLabel, secondaryAction, busy, error }) {
  const [accountId, setAccountId] = useState(initial.account_id || "");
  const [amount, setAmount] = useState(initial.estimated_amount ?? "");
  const [probability, setProbability] = useState(initial.probability_override ?? "");
  const [closeDate, setCloseDate] = useState(initial.estimated_close_date ? String(initial.estimated_close_date).slice(0, 10) : "");
  const [source, setSource] = useState(initial.source || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      account_id: accountId || null,
      estimated_amount: amount ? Number(amount) : null,
      probability_override: probability ? Number(probability) : null,
      estimated_close_date: closeDate || null,
      source: source || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && (
        <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">{error}</div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#1F2937]">Cuenta</label>
        <SearchableSelect options={accountOptions} value={accountId} onChange={setAccountId} placeholder="Buscar cuenta por nombre..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#1F2937]">Monto estimado</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm font-mono focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#1F2937]">Probabilidad (%)</label>
          <input type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)}
            className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm font-mono focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#1F2937]">Cierre estimado</label>
        <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)}
          className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#1F2937]">Fuente</label>
        <select value={source} onChange={(e) => setSource(e.target.value)}
          className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20">
          <option value="">Seleccionar...</option>
          {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="mt-1 flex justify-end gap-2">
        {secondaryAction}
        <button type="submit" disabled={busy} className={`px-4 py-2 text-sm font-medium ${BTN_PRIMARY}`}>
          {busy ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function PromoteLeadModal({ lead, accountOptions, onClose, onPromote }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (fields) => {
    setBusy(true);
    setError(null);
    try {
      await onPromote(lead, fields);
    } catch (ex) {
      setError(ex.message || "No se pudo iniciar el analisis");
      setBusy(false);
    }
  };

  return (
    <Modal open title="Iniciar análisis de oportunidad" onClose={onClose} maxWidth="max-w-md">
      <p className="mb-3 text-sm text-[#6B7280]">
        Completa lo que ya sepas de {lead.full_name || lead.company_name}. Podés omitir y completarlo después desde la tarjeta.
      </p>
      <OpportunityFieldsForm
        accountOptions={accountOptions}
        onSubmit={submit}
        submitLabel="Iniciar análisis"
        busy={busy}
        error={error}
        secondaryAction={
          <button type="button" onClick={() => submit({})} disabled={busy} className={`px-4 py-2 text-sm ${BTN_SECONDARY}`}>
            Omitir por ahora
          </button>
        }
      />
    </Modal>
  );
}

function CompleteOpportunityModal({ opp, accountOptions, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (fields) => {
    setBusy(true);
    setError(null);
    try {
      await updateOpportunity(opp.id, fields);
      onSaved();
    } catch (ex) {
      setError(ex.message || "No se pudo guardar");
      setBusy(false);
    }
  };

  return (
    <Modal open title="Completar información" onClose={onClose} maxWidth="max-w-md">
      <OpportunityFieldsForm
        initial={opp}
        accountOptions={accountOptions}
        onSubmit={submit}
        submitLabel="Guardar"
        busy={busy}
        error={error}
        secondaryAction={
          <button type="button" onClick={onClose} className={`px-4 py-2 text-sm ${BTN_SECONDARY}`}>Cancelar</button>
        }
      />
    </Modal>
  );
}

function OpportunityCard({ opp, navigate, showAnalysisActions, onAddActivity, onOpenAccount, onOpenContacts, onAddContact, onOpenPurchase, onCompleteFields, purchaseReloadKey, draggable, onDragStart }) {
  const health = HEALTH_COLORS[opp.health_status] ?? HEALTH_COLORS.gray;
  const ICON_BTN = "flex h-8 w-8 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#64748B] shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:text-[#0F172A] cursor-pointer";
  const stop = (fn) => (e) => { e.stopPropagation(); fn(opp); };
  const missingFields = OPP_FIELD_DEFS.filter(f => !opp[f.key]);
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={() => navigate(`/dashboard/crm-fam/opportunities/${opp.id}`)}
      className={`${CARD_INTERACTIVE} group relative overflow-hidden p-3 pl-4 active:scale-[0.99] duration-[120ms] ease-out ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-[#2563EB] opacity-80 transition-all group-hover:w-1.5" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#0F172A] truncate">{opp.name}</div>
          {opp.opportunity_code && <div className="mt-0.5 text-[10px] font-mono uppercase tracking-[0.12em] text-[#94A3B8]">{opp.opportunity_code}</div>}
        </div>
        <Badge bg={health.bg} text={health.text} label={health.label} />
      </div>
      {missingFields.length > 0 ? (
        <div className="mt-2 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-2.5">
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
            {OPP_FIELD_DEFS.map(f => (
              <div key={f.key} className="min-w-0">
                <span className="block text-[#92600A]">{f.label}</span>
                <span className="block truncate font-medium text-[#1F2937]">
                  {f.key === "account_id" ? (opp.account_name || "—")
                    : f.key === "estimated_amount" ? (opp.estimated_amount != null ? fmtMoney(opp.estimated_amount) : "—")
                    : f.key === "probability_override" ? (opp.probability_override != null ? `${opp.probability_override}%` : "—")
                    : f.key === "estimated_close_date" ? (opp.estimated_close_date ? fmtDate(opp.estimated_close_date) : "—")
                    : (SOURCE_OPTIONS.find(o => o.value === opp.source)?.label || "—")}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={stop(onCompleteFields)}
            className="mt-1.5 cursor-pointer text-left text-[11px] font-medium text-[#D97706] hover:underline"
          >
            Completar información ({missingFields.length} pendiente{missingFields.length === 1 ? "" : "s"})
          </button>
        </div>
      ) : (
        <>
          {opp.account_name && (
            <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#475569]">
              <FiBriefcase size={12} className="shrink-0" />
              <span className="truncate">{opp.account_name}</span>
            </div>
          )}
          {opp.estimated_amount != null && (
            <div className="mt-2 text-lg font-semibold tracking-tight text-[#0F172A]">{fmtMoney(opp.estimated_amount)}</div>
          )}
        </>
      )}
      <PurchaseStatusBadge key={purchaseReloadKey} opportunityId={opp.id} navigate={navigate} />
      <ActivitiesSummary opportunityId={opp.id} onAddActivity={onAddActivity} />
      {showAnalysisActions && (
        <div className="mt-1.5 border-t border-[#F1F5F9] pt-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); navigate("/dashboard/comercial/new-client-request"); }}
            className="cursor-pointer text-left text-xs text-[#2563EB] hover:underline"
          >
            Solicitar creación de cliente
          </button>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#F1F5F9] pt-2.5">
        <div className="flex gap-1.5">
          <button onClick={stop(onOpenAccount)} title={opp.account_id ? "Ver cuenta" : "Vincular cuenta"} className={`${ICON_BTN} ${!opp.account_id ? "border-dashed border-[#93C5FD] text-[#2563EB]" : ""}`}>
            <FiBriefcase size={14} />
          </button>
          <button onClick={stop(onOpenContacts)} title="Contactos de la cuenta" className={ICON_BTN}>
            <FiUsers size={14} />
          </button>
          <button onClick={stop(onAddContact)} title="Agregar contacto" className={ICON_BTN}>
            <FiUserPlus size={14} />
          </button>
          <button onClick={stop(onOpenPurchase)} title="Solicitud de requerimiento de compra" className={ICON_BTN}>
            <FiShoppingCart size={14} />
          </button>
        </div>
        <button
          onClick={e => { e.stopPropagation(); navigate(`/dashboard/crm-fam/opportunities/${opp.id}/blue-sheet`); }}
          className="cursor-pointer transition-transform hover:scale-[1.02]"
          title="Abrir Blue Sheet"
        >
          <span className="rounded-full bg-[#F8FAFC] px-2 py-1 text-[11px] font-medium text-[#64748B] ring-1 ring-[#E2E8F0]">Blue Sheet</span>
        </button>
      </div>
    </div>
  );
}

function LeadCard({ lead, actions }) {
  const leadName = lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.company_name || `Lead ${lead.lead_code || lead.id}`;
  const accountName = lead.converted_account_name || lead.account_name || "";
  const contactCount = Number(lead.linked_contact_count) || 0;
  return (
    <div className={`${CARD_BASE} relative overflow-hidden border-[#BFDBFE] bg-gradient-to-br from-white to-[#EFF6FF] p-3 pl-4`}>
      <div className="absolute inset-y-0 left-0 w-1 bg-[#2563EB]" />
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-[#0F172A] truncate">{leadName}</div>
        <Badge bg="#EFF6FF" text="#1D4ED8" label="Lead" />
      </div>
      {lead.company_name && lead.full_name && (
        <div className="mt-1 text-xs text-[#475569] truncate">{lead.company_name}</div>
      )}
      {lead.city && <div className="mt-1 inline-flex rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-[#64748B] ring-1 ring-[#DBEAFE]">{lead.city}</div>}
      {lead.converted_account_id && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-2 text-xs text-[#1D4ED8]">
          <FiBriefcase size={14} className="shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#1E3A8A]">{accountName || "Cuenta vinculada"}</p>
            <p className="text-[11px] text-[#2563EB]">{contactCount} contacto{contactCount === 1 ? "" : "s"} asociado{contactCount === 1 ? "" : "s"}</p>
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

function Column({ title, count, total, tone = KANBAN_TONES[0], onDragOver, onDrop, dropActive, children }) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`flex min-w-[300px] max-w-[300px] flex-col gap-3 rounded-[1.35rem] border p-3 shadow-[0_10px_28px_rgba(15,23,42,0.07)] transition-all duration-150 ${dropActive ? "scale-[1.01] border-[#93C5FD] bg-[#DBEAFE]" : "border-[#E2E8F0] bg-white"}`}
    >
      <div className="rounded-2xl border border-white/70 p-3" style={{ background: `linear-gradient(135deg, ${tone.bg}, #FFFFFF)` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block truncate text-sm font-bold text-[#0F172A]">{title}</span>
            <span className="mt-1 block text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: tone.text }}>
              {count} registro{count === 1 ? "" : "s"}
            </span>
          </div>
          <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: tone.chip, color: tone.text }}>
            {count}
          </span>
        </div>
        {total > 0 && (
          <div className="mt-2 rounded-xl bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-[#0F172A] ring-1 ring-white">
            Pipeline: <span className="font-mono">{fmtMoney(total)}</span>
          </div>
        )}
      </div>
      {count === 0 ? (
        <div className="flex min-h-[130px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
            <FiInbox size={20} className="text-[#94A3B8]" />
          </div>
          <p className="text-xs font-medium text-[#64748B]">Sin movimientos por ahora</p>
          <p className="max-w-[190px] text-[11px] leading-relaxed text-[#94A3B8]">Arrastra oportunidades a esta etapa cuando avancen en el proceso.</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function KanbanView({ stages, rows, leads, loading, navigate, onQualifyLead, onDisqualifyLead, onPromoteLead, onMoveStage, accountOptions, onAccountCreated, onLeadChanged, onOpportunityChanged }) {
  const [activityModal, setActivityModal] = useState(null); // { opportunityId, refresh } | null
  const [accountModalLead, setAccountModalLead] = useState(null);
  const [contactModalLead, setContactModalLead] = useState(null);
  const [contactsModalLead, setContactsModalLead] = useState(null);
  const [dragOverStageId, setDragOverStageId] = useState(null);
  const [accountModalOpp, setAccountModalOpp] = useState(null);
  const [contactsModalOpp, setContactsModalOpp] = useState(null);
  const [addContactOpp, setAddContactOpp] = useState(null);
  const [purchaseModalOpp, setPurchaseModalOpp] = useState(null);
  const [purchaseReloadKey, setPurchaseReloadKey] = useState(0);
  const [promoteModalLead, setPromoteModalLead] = useState(null);
  const [completeFieldsOpp, setCompleteFieldsOpp] = useState(null);

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [stages]
  );

  const opportunityLeadIds = useMemo(() => new Set(rows.map(o => o.lead_id).filter(Boolean)), [rows]);
  const leadsNew = useMemo(() => leads.filter(l => ["new", "contacted"].includes(l.status)), [leads]);
  const leadsQualified = useMemo(
    () => leads.filter(l => l.status === "qualified" && !opportunityLeadIds.has(l.id)),
    [leads, opportunityLeadIds],
  );

  const byStage = useMemo(() => {
    const map = {};
    for (const opp of rows) {
      const key = opp.stage_id ?? "__none__";
      if (!map[key]) map[key] = [];
      map[key].push(opp);
    }
    return map;
  }, [rows]);

  const totalByStage = useMemo(() => {
    const map = {};
    for (const [key, opps] of Object.entries(byStage)) {
      map[key] = opps.reduce((sum, o) => sum + (Number(o.estimated_amount) || 0), 0);
    }
    return map;
  }, [byStage]);

  const renderLeadActions = (lead, { qualified = false } = {}) => (
    <div className="flex w-full flex-wrap items-center gap-2">
      {qualified ? (
        <button onClick={() => setPromoteModalLead(lead)} className={`px-3 py-1.5 text-xs font-medium ${BTN_PRIMARY}`}>Iniciar analisis</button>
      ) : (
        <>
          <button onClick={() => onQualifyLead(lead)} className={`px-3 py-1.5 text-xs font-medium ${BTN_SUCCESS_SOFT}`}>Calificar</button>
          <button onClick={() => onDisqualifyLead(lead)} className={`px-3 py-1.5 text-xs font-medium ${BTN_DANGER_SOFT}`}>Descalificar</button>
        </>
      )}
      {!lead.converted_account_id && (
        <button onClick={() => setAccountModalLead(lead)} title="Crear o vincular cuenta" className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${BTN_SECONDARY}`}>
          <FiBriefcase size={13} />
          Cuenta
        </button>
      )}
      {Number(lead.linked_contact_count) > 0 && (
        <button onClick={() => setContactsModalLead(lead)} title="Ver contactos registrados" aria-label="Ver contactos registrados" className={`inline-flex h-8 w-8 items-center justify-center ${BTN_SECONDARY}`}>
          <FiUsers size={14} />
        </button>
      )}
      <button onClick={() => setContactModalLead(lead)} title="Nuevo contacto" className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${BTN_SECONDARY}`}>
        <FiUserPlus size={13} />
        Nuevo contacto
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto rounded-[1.75rem] bg-gradient-to-br from-[#F8FAFC] to-[#EEF2FF] p-4 pb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex min-w-[300px] max-w-[300px] flex-col gap-3 rounded-[1.35rem] border border-[#E2E8F0] bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.07)]">
            <div className="h-20 animate-pulse rounded-2xl bg-[#F1F5F9]" />
            {Array.from({ length: 3 }).map((__, j) => (
              <div key={j} className="h-28 animate-pulse rounded-xl bg-[#F8FAFC]" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[1.75rem] bg-gradient-to-br from-[#F8FAFC] via-white to-[#EEF2FF] p-4 pb-5 shadow-inner">
      {/* Fase 1: Leads */}
      <div className="flex gap-4">
        <Column title="Leads" count={leadsNew.length} tone={LEAD_TONE}>
          {leadsNew.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              actions={renderLeadActions(lead)}
            />
          ))}
        </Column>

        {/* Fase 2: Leads calificados */}
        <Column title="Leads calificados" count={leadsQualified.length} tone={QUALIFIED_TONE}>
          {leadsQualified.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              actions={renderLeadActions(lead, { qualified: true })}
            />
          ))}
        </Column>

        {/* Fase 3-8: etapas reales de la oportunidad, arrastrables entre columnas */}
        {sortedStages.map((stage, index) => {
          const cards = byStage[stage.id] ?? [];
          const isAnalisis = stage.order_index === 1;
          return (
            <Column
              key={stage.id}
              title={stage.name}
              count={cards.length}
              total={totalByStage[stage.id] ?? 0}
              tone={getColumnTone(index)}
              dropActive={dragOverStageId === stage.id}
              onDragOver={(e) => { e.preventDefault(); setDragOverStageId(stage.id); }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStageId(null);
                const oppId = e.dataTransfer.getData("text/plain");
                if (oppId && oppId !== stage.id) onMoveStage(oppId, stage.id);
              }}
            >
              {cards.map(opp => (
                <OpportunityCard
                  key={opp.id}
                  opp={opp}
                  navigate={navigate}
                  showAnalysisActions={isAnalisis}
                  onAddActivity={(oppId, refresh) => setActivityModal({ opportunityId: oppId, refresh })}
                  onOpenAccount={setAccountModalOpp}
                  onOpenContacts={setContactsModalOpp}
                  onAddContact={setAddContactOpp}
                  onOpenPurchase={setPurchaseModalOpp}
                  onCompleteFields={setCompleteFieldsOpp}
                  purchaseReloadKey={purchaseReloadKey}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", opp.id)}
                />
              ))}
            </Column>
          );
        })}
      </div>

      {activityModal && (
        <AddActivityModal
          opportunityId={activityModal.opportunityId}
          onClose={() => setActivityModal(null)}
          onSaved={() => { activityModal.refresh(); setActivityModal(null); }}
        />
      )}
      {accountModalLead && (
        <CreateAccountFromLeadModal
          lead={accountModalLead}
          accountOptions={accountOptions}
          onClose={() => setAccountModalLead(null)}
          onSaved={() => { onAccountCreated(); onLeadChanged(); setAccountModalLead(null); }}
        />
      )}
      {contactModalLead && (
        <CreateContactModal
          initial={contactModalLead}
          accountOptions={accountOptions}
          leadId={contactModalLead.id}
          onClose={() => setContactModalLead(null)}
          onSaved={() => { onLeadChanged(); setContactModalLead(null); }}
        />
      )}
      {contactsModalLead && (
        <LeadContactsModal
          lead={contactsModalLead}
          onClose={() => setContactsModalLead(null)}
          onAddContact={() => { setContactModalLead(contactsModalLead); setContactsModalLead(null); }}
        />
      )}
      {accountModalOpp && (
        <AccountModal
          opp={accountModalOpp}
          accountOptions={accountOptions}
          onClose={() => setAccountModalOpp(null)}
          onLinked={() => { setAccountModalOpp(null); onAccountCreated(); onOpportunityChanged(); }}
        />
      )}
      {contactsModalOpp && (
        <ContactsListModal
          opp={contactsModalOpp}
          onClose={() => setContactsModalOpp(null)}
          onAddContact={() => { setAddContactOpp(contactsModalOpp); setContactsModalOpp(null); }}
        />
      )}
      {addContactOpp && (
        <CreateContactModal
          initial={{}}
          accountOptions={accountOptions}
          defaultAccountId={addContactOpp.account_id || ""}
          onClose={() => setAddContactOpp(null)}
          onSaved={() => setAddContactOpp(null)}
        />
      )}
      {purchaseModalOpp && (
        <PurchasePickerModal
          opp={purchaseModalOpp}
          onClose={() => setPurchaseModalOpp(null)}
          onCreated={() => { setPurchaseModalOpp(null); setPurchaseReloadKey(k => k + 1); }}
        />
      )}
      {promoteModalLead && (
        <PromoteLeadModal
          lead={promoteModalLead}
          accountOptions={accountOptions}
          onClose={() => setPromoteModalLead(null)}
          onPromote={async (lead, fields) => {
            await onPromoteLead(lead, fields);
            setPromoteModalLead(null);
          }}
        />
      )}
      {completeFieldsOpp && (
        <CompleteOpportunityModal
          opp={completeFieldsOpp}
          accountOptions={accountOptions}
          onClose={() => setCompleteFieldsOpp(null)}
          onSaved={() => { setCompleteFieldsOpp(null); onOpportunityChanged(); }}
        />
      )}
    </div>
  );
}

export default function OpportunitiesPage() {
  const navigate = useNavigate();

  const [viewMode] = useState("kanban");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("");
  const [stageId, setStageId] = useState("");
  const [offset, setOffset] = useState(0);
  const [stages, setStages] = useState([]);
  const [leads, setLeads] = useState([]);
  const [accountOptions, setAccountOptions] = useState([]);

  const refreshAccountOptions = useCallback(() => {
    fetchAccounts({ limit: 500 })
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res?.data ?? []);
        setAccountOptions(rows.map((a) => ({ value: a.id, label: a.account_name })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => { refreshAccountOptions(); }, [refreshAccountOptions]);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Reset offset on filter change
  useEffect(() => { setOffset(0); }, [debouncedQ, status, stageId]);

  // Load stages once
  useEffect(() => {
    fetchPipelineStages()
      .then(s => setStages(Array.isArray(s) ? s : []))
      .catch(() => {});
  }, []);

  // Leads asignados al usuario, para Fase 1 (Leads) y Fase 2 (Leads calificados).
  // Se excluyen los ya convertidos/descalificados: esos ya no son prospectos activos.
  const refreshLeads = useCallback(() => {
    fetchLeads({ limit: 200 })
      .then(res => {
        const all = Array.isArray(res?.data) ? res.data : [];
        setLeads(all.filter(l => !["converted", "disqualified"].includes(l.status)));
      })
      .catch(() => setLeads([]));
  }, []);
  useEffect(() => { refreshLeads(); }, [refreshLeads]);

  const params = viewMode === "kanban"
    ? { status: "open", limit: 500, offset: 0 }
    : {
        ...(debouncedQ ? { q: debouncedQ } : {}),
        ...(status ? { status } : {}),
        ...(stageId ? { stage_id: stageId } : {}),
        limit: LIMIT,
        offset,
      };

  const { data, loading, error, refresh } = useOpportunities(params);

  const rows = Array.isArray(data) ? data : (data?.data ?? []);
  const total = Array.isArray(data) ? data.length : (data?.total ?? 0);
  const hasNext = offset + LIMIT < total || rows.length === LIMIT;
  const hasPrev = offset > 0;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleCreate = useCallback(async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = { ...form };
      if (!payload.account_id) delete payload.account_id;
      if (!payload.stage_id) delete payload.stage_id;
      if (!payload.estimated_amount) delete payload.estimated_amount;
      if (!payload.estimated_close_date) delete payload.estimated_close_date;
      if (!payload.source) delete payload.source;
      if (payload.estimated_amount) payload.estimated_amount = Number(payload.estimated_amount);
      await createOpportunity(payload);
      setShowModal(false);
      setForm(EMPTY_FORM);
      refresh();
    } catch (err) {
      setSaveError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }, [form, refresh]);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setForm(EMPTY_FORM);
    setSaveError(null);
  }, []);

  const handleQualifyLead = useCallback(async (lead) => {
    try {
      await updateLead(lead.id, { status: "qualified" });
      refreshLeads();
    } catch (err) {
      alert(err.message || "Error al calificar");
    }
  }, [refreshLeads]);

  const handleDisqualifyLead = useCallback(async (lead) => {
    if (!window.confirm(`Descalificar lead "${lead.full_name || lead.company_name || ""}"?`)) return;
    try {
      await disqualifyLead(lead.id, { reason: "Manual" });
      refreshLeads();
    } catch (err) {
      alert(err.message || "Error al descalificar");
    }
  }, [refreshLeads]);

  const handlePromoteLead = useCallback(async (lead, fields) => {
    await promoteLeadToOpportunity(lead.id, fields);
    refreshLeads();
    refresh();
  }, [refreshLeads, refresh]);

  const handleMoveStage = useCallback(async (opportunityId, stageId) => {
    try {
      await changeOpportunityStage(opportunityId, { stage_id: stageId });
      refresh();
    } catch (err) {
      alert(err.message || "Error al mover la oportunidad de etapa");
    }
  }, [refresh]);

  return (
    <div className="p-6 bg-[#F9FAFB] min-h-full">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-[#1F2937]">Embudo de ventas</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className={`px-4 py-2 text-sm font-medium ${BTN_PRIMARY}`}
          >
            Nueva oportunidad
          </button>
        </div>
      </header>

      {/* Filters — table mode only */}
      {viewMode === "table" && (
        <section className="flex flex-wrap gap-3 mb-5">
          <input
            type="text"
            placeholder="Buscar..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#2563EB] w-56"
          />
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={stageId}
            onChange={e => setStageId(e.target.value)}
            className="border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="">Todas las etapas</option>
            {stages.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </section>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-[#FEE2E2] border border-[#DC2626] text-[#DC2626] rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Kanban view */}
      {viewMode === "kanban" ? (
        <KanbanView
          stages={stages}
          rows={rows}
          leads={leads}
          loading={loading}
          navigate={navigate}
          onQualifyLead={handleQualifyLead}
          onDisqualifyLead={handleDisqualifyLead}
          onPromoteLead={handlePromoteLead}
          onMoveStage={handleMoveStage}
          accountOptions={accountOptions}
          onAccountCreated={refreshAccountOptions}
          onLeadChanged={refreshLeads}
          onOpportunityChanged={refresh}
        />
      ) : (
        <>
          {/* Table */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#1E293B] text-white">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Cuenta</th>
                  <th className="px-4 py-3 text-left font-medium">Etapa</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Monto</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Prob.</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Cierre</th>
                  <th className="px-4 py-3 text-left font-medium">Salud</th>
                  <th className="px-4 py-3 text-left font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[#6B7280]">
                      Sin resultados
                    </td>
                  </tr>
                ) : (
                  rows.map(opp => {
                    const health = HEALTH_COLORS[opp.health_status] ?? HEALTH_COLORS.gray;
                    const statusCfg = OPP_STATUS[opp.status] ?? OPP_STATUS.open;
                    return (
                      <tr
                        key={opp.id}
                        onClick={() => navigate(`/dashboard/crm-fam/opportunities/${opp.id}`)}
                        className="border-b border-[#E5E7EB] hover:bg-[#334155]/5 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-[#1F2937]">
                          <div>{opp.name}</div>
                          <div className="mt-0.5">
                            <Badge bg={statusCfg.bg} text={statusCfg.text} label={statusCfg.label} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#6B7280] hidden sm:table-cell">{fmt(opp.account_name)}</td>
                        <td className="px-4 py-3 text-[#6B7280]">{fmt(opp.stage_name)}</td>
                        <td className="px-4 py-3 text-[#6B7280] hidden md:table-cell">{fmtMoney(opp.estimated_amount)}</td>
                        <td className="px-4 py-3 text-[#6B7280] hidden md:table-cell">
                          {opp.probability != null ? `${opp.probability}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-[#6B7280] hidden md:table-cell">{fmtDate(opp.estimated_close_date)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              navigate(`/dashboard/crm-fam/opportunities/${opp.id}/blue-sheet`);
                            }}
                            className="inline-block cursor-pointer hover:opacity-80 transition-opacity"
                            title="Abrir Blue Sheet"
                          >
                            <Badge bg={health.bg} text={health.text} label={health.label} />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              navigate(`/dashboard/crm-fam/opportunities/${opp.id}`);
                            }}
                            className="text-[#2563EB] hover:underline text-sm font-medium"
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && rows.length > 0 && (
            <div className="flex items-center gap-3 mt-4 justify-end">
              <button
                onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
                disabled={!hasPrev}
                className="px-3 py-1 text-sm border border-[#E5E7EB] rounded-xl text-[#1F2937] disabled:opacity-40 hover:bg-[#334155]/5 transition-colors"
              >
                Anterior
              </button>
              <span className="text-sm text-[#6B7280]">
                {offset + 1}–{offset + rows.length}
              </span>
              <button
                onClick={() => setOffset(o => o + LIMIT)}
                disabled={!hasNext}
                className="px-3 py-1 text-sm border border-[#E5E7EB] rounded-xl text-[#1F2937] disabled:opacity-40 hover:bg-[#334155]/5 transition-colors"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}

      <Modal open={showModal} title="Nueva oportunidad" onClose={handleCloseModal} maxWidth="max-w-md">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1F2937]">
              Nombre <span className="text-[#DC2626]">*</span>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleFormChange}
              required
              className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1F2937]">Cuenta (opcional)</label>
            <SearchableSelect
              options={accountOptions}
              value={form.account_id}
              onChange={(value) => setForm((f) => ({ ...f, account_id: value }))}
              placeholder="Buscar cuenta por nombre..."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1F2937]">Etapa</label>
            <select
              name="stage_id"
              value={form.stage_id}
              onChange={handleFormChange}
              className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
            >
              <option value="">Seleccionar...</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1F2937]">Monto estimado</label>
            <input
              name="estimated_amount"
              type="number"
              min="0"
              step="0.01"
              value={form.estimated_amount}
              onChange={handleFormChange}
              className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 font-mono"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1F2937]">Cierre estimado</label>
            <input
              name="estimated_close_date"
              type="date"
              value={form.estimated_close_date}
              onChange={handleFormChange}
              className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1F2937]">Fuente</label>
            <select
              name="source"
              value={form.source}
              onChange={handleFormChange}
              className="w-full min-h-10 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
            >
              <option value="">Seleccionar...</option>
              {SOURCE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {saveError && (
            <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">
              {saveError}
            </div>
          )}
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={handleCloseModal} className={`px-4 py-2 text-sm ${BTN_SECONDARY}`}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} className={`px-4 py-2 text-sm font-medium ${BTN_PRIMARY}`}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
