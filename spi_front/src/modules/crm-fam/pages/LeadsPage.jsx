import { useState, useCallback, useEffect, useMemo } from "react";
import { FiAlertCircle, FiRefreshCw } from "react-icons/fi";
import { useLeads } from "../hooks/useCrmLeads";
import { createLead, updateLead, disqualifyLead } from "../../../core/api/crmFamApi";
import { getUsers } from "../../../core/api/usersApi";
import Modal from "../../../core/ui/components/Modal";
import ECUADOR_LOCATIONS from "../../../data/ecuadorGeography";

const ADVISOR_ROLES = new Set([
  "comercial", "acp_comercial", "backoffice_comercial", "asesor_comercial", "analista_comercial", "backoffice",
]);
const normalizeRoleToken = (value) => String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const LIMIT = 20;

const STATUS_COLORS = {
  new:           { bg: '#EFF6FF', text: '#1D4ED8' },
  contacted:     { bg: '#FEF3C7', text: '#D97706' },
  qualified:     { bg: '#DCFCE7', text: '#16A34A' },
  unqualified:   { bg: '#FEE2E2', text: '#DC2626' },
  converted:     { bg: '#DCFCE7', text: '#16A34A' },
  disqualified:  { bg: '#F3F4F6', text: '#6B7280' },
};

const STATUS_LABELS = {
  new: 'Nuevo',
  contacted: 'Contactado',
  qualified: 'Calificado',
  unqualified: 'No calificado',
  converted: 'Convertido',
  disqualified: 'Descalificado',
};

const PRIORITY_LABELS = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

const SOURCE_OPTIONS = [
  { value: 'directo',        label: 'Directo' },
  { value: 'referido',       label: 'Referido' },
  { value: 'web',            label: 'Web' },
  { value: 'redes_sociales', label: 'Redes sociales' },
  { value: 'feria',          label: 'Feria' },
  { value: 'llamada_en_frio',label: 'Llamada en frio' },
  { value: 'otro',           label: 'Otro' },
];

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];
const PHONE_COUNTRY_CODES = [
  { value: "+593", label: "Ecuador +593" },
  { value: "+51", label: "Peru +51" },
];

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  company_name: '',
  email: '',
  phone: '',
  phone_country_code: '+593',
  phone_number: '',
  source: '',
  priority: 'medium',
  status: 'new',
  description: '',
  city: '',
  owner_user_id: '',
};

const inputCls = "min-h-[44px] w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-[#1F2937] shadow-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#6B7280]";
const labelCls = "mb-1 block text-xs font-medium text-[#1F2937]";
const ECUADOR_CITY_OPTIONS = [...new Map(
  ECUADOR_LOCATIONS
    .map((location) => String(location?.canton || "").trim())
    .filter(Boolean)
    .map((city) => [normalizeText(city), city]),
).values()].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

const getErrorMessage = (error, fallback = "No se pudo guardar. Revisa los datos e intenta nuevamente.") =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback;

const normalizeUserList = (users) => {
  if (Array.isArray(users)) return users;
  if (Array.isArray(users?.rows)) return users.rows;
  if (Array.isArray(users?.data)) return users.data;
  return [];
};

const parseLeadPhone = (phone = "") => {
  const value = String(phone || "").trim();
  const code = PHONE_COUNTRY_CODES.find((option) => value.startsWith(option.value))?.value || "+593";
  const number = value.startsWith(code) ? value.slice(code.length).trim() : value;
  return { phone_country_code: code, phone_number: number };
};

const buildPhoneValue = (form) => {
  const number = String(form.phone_number ?? form.phone ?? "").trim();
  if (!number) return null;
  const code = PHONE_COUNTRY_CODES.some((option) => option.value === form.phone_country_code)
    ? form.phone_country_code
    : "+593";
  return `${code} ${number}`;
};

const buildLeadPayload = (form) => {
  const payload = {
    first_name: String(form.first_name || "").trim(),
    last_name: String(form.last_name || "").trim() || null,
    company_name: String(form.company_name || "").trim() || null,
    email: String(form.email || "").trim() || null,
    phone: buildPhoneValue(form),
    source: form.source || null,
    priority: form.priority || "medium",
    status: form.status || "new",
    interest_description: String(form.description || form.interest_description || "").trim() || null,
    city: String(form.city || "").trim() || null,
  };
  if (form.owner_user_id) payload.owner_user_id = Number(form.owner_user_id);
  return payload;
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || { bg: '#F3F4F6', text: '#6B7280' };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function Skeleton() {
  const p = <div className="h-4 bg-gray-200 rounded w-3/4" />;
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-3">{p}</td>
          <td className="px-4 py-3 hidden sm:table-cell">{p}</td>
          <td className="px-4 py-3 hidden sm:table-cell">{p}</td>
          <td className="px-4 py-3">{p}</td>
          <td className="px-4 py-3 hidden sm:table-cell">{p}</td>
          <td className="px-4 py-3 hidden sm:table-cell">{p}</td>
          <td className="px-4 py-3">{p}</td>
        </tr>
      ))}
    </>
  );
}

function LeadModal({ lead, onClose, onSaved }) {
  const isEdit = Boolean(lead?.id);
  const [form, setForm] = useState(
    isEdit
      ? {
          ...EMPTY_FORM,
          ...lead,
          ...parseLeadPhone(lead?.phone),
          description: lead?.interest_description || lead?.description || "",
        }
      : { ...EMPTY_FORM },
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [advisors, setAdvisors] = useState([]);
  const [citySuggestionsOpen, setCitySuggestionsOpen] = useState(false);
  const normalizedCity = normalizeText(form.city);
  const citySuggestions = useMemo(
    () => ECUADOR_CITY_OPTIONS
      .filter((city) => !normalizedCity || normalizeText(city).includes(normalizedCity))
      .slice(0, 8),
    [normalizedCity],
  );

  useEffect(() => {
    getUsers()
      .then((users) => {
        const list = normalizeUserList(users);
        setAdvisors(list.filter((u) => ADVISOR_ROLES.has(normalizeRoleToken(u.role))));
      })
      .catch((error) => {
        setAdvisors([]);
        setErr(getErrorMessage(error, "No se pudo cargar el listado de asesores. Puedes guardar el lead asignado a ti mismo."));
      });
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim()) { setErr('El nombre del lead es obligatorio.'); return; }
    setSaving(true);
    setErr(null);
    try {
      const payload = buildLeadPayload(form);
      if (isEdit) {
        await updateLead(lead.id, payload);
      } else {
        await createLead(payload);
      }
      onSaved();
    } catch (ex) {
      setErr(getErrorMessage(ex));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={isEdit ? "Editar lead" : "Nuevo lead"}
      onClose={onClose}
      maxWidth="max-w-3xl"
      disableClose={saving}
      closeOnBackdrop={false}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-[#6B7280]">
          Registra el contacto inicial y asigna un asesor responsable. El formulario no se cerrara por clic fuera para evitar perdida de datos.
        </p>
        {err && (
          <div className="flex items-start gap-2 rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] px-3 py-2.5 text-sm text-[#DC2626]">
            <FiAlertCircle className="mt-0.5 shrink-0" size={16} />
            <span>{err}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Nombre *</label>
              <input className={inputCls} value={form.first_name} onChange={set('first_name')} placeholder="Nombre" disabled={saving} />
            </div>
            <div>
              <label className={labelCls}>Apellido</label>
              <input className={inputCls} value={form.last_name} onChange={set('last_name')} placeholder="Apellido" disabled={saving} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Empresa</label>
              <input className={inputCls} value={form.company_name} onChange={set('company_name')} placeholder="Empresa" disabled={saving} />
            </div>
            <div>
              <label className={labelCls}>Ciudad</label>
              <div className="relative">
                <input
                  className={`${inputCls} pr-10`}
                  value={form.city}
                  onFocus={() => setCitySuggestionsOpen(true)}
                  onBlur={() => setCitySuggestionsOpen(false)}
                  onChange={(event) => {
                    setCitySuggestionsOpen(true);
                    setForm((current) => ({ ...current, city: event.target.value }));
                  }}
                  placeholder="Escribe para buscar una ciudad"
                  disabled={saving}
                  autoComplete="off"
                  aria-label="Ciudad del lead"
                  aria-autocomplete="list"
                />
                {form.city ? (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setForm((current) => ({ ...current, city: "" }));
                      setCitySuggestionsOpen(false);
                    }}
                    disabled={saving}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#1F2937] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Limpiar ciudad"
                  >
                    x
                  </button>
                ) : null}
                {citySuggestionsOpen && normalizedCity && citySuggestions.length > 0 ? (
                  <div
                    className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-[0_4px_16px_rgba(0,0,0,0.10)]"
                    role="listbox"
                    aria-label="Ciudades sugeridas"
                  >
                    {citySuggestions.map((city) => (
                      <button
                        key={city}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setForm((current) => ({ ...current, city }));
                          setCitySuggestionsOpen(false);
                        }}
                        className="block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-[#1F2937] hover:bg-[#EFF6FF] hover:text-[#1D4ED8]"
                        role="option"
                        aria-selected={form.city === city}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Asesor asignado</label>
              <select className={inputCls} value={form.owner_user_id || ""} onChange={set('owner_user_id')} disabled={saving}>
                <option value="">Yo mismo</option>
                {advisors.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullname || u.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Fuente</label>
              <select className={inputCls} value={form.source || ""} onChange={set('source')} disabled={saving}>
                <option value="">Seleccionar...</option>
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={form.email} onChange={set('email')} placeholder="email@empresa.com" disabled={saving} />
            </div>
            <div>
              <label className={labelCls}>Telefono</label>
              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(130px,0.42fr)_1fr]">
                <select
                  className={inputCls}
                  value={form.phone_country_code}
                  onChange={set('phone_country_code')}
                  disabled={saving}
                  aria-label="Codigo de pais"
                >
                  {PHONE_COUNTRY_CODES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <input
                  className={inputCls}
                  value={form.phone_number}
                  onChange={set('phone_number')}
                  placeholder={form.phone_country_code === "+51" ? "999 999 999" : "99 000 0000"}
                  disabled={saving}
                  inputMode="tel"
                  autoComplete="tel-national"
                />
              </div>
            </div>
          </div>
          <div className={`grid grid-cols-1 gap-3 ${isEdit ? "sm:grid-cols-2" : ""}`}>
            <div>
              <label className={labelCls}>Prioridad</label>
              <select className={inputCls} value={form.priority} onChange={set('priority')} disabled={saving}>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
            {isEdit && (
              <div>
                <label className={labelCls}>Estado</label>
                <select className={inputCls} value={form.status} onChange={set('status')} disabled={saving}>
                  {Object.keys(STATUS_LABELS).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Descripcion</label>
            <textarea
              className={inputCls + " resize-none"}
              rows={3}
              value={form.description}
              onChange={set('description')}
              placeholder="Descripcion opcional..."
              disabled={saving}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-[#E5E7EB] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-[#D1D5DB] bg-white px-4 text-sm font-medium text-[#1F2937] transition-transform duration-[120ms] active:scale-[0.97] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-medium text-white shadow-sm transition-transform duration-[120ms] active:scale-[0.97] hover:bg-[#1D4ED8] disabled:cursor-wait disabled:opacity-60"
            >
              {saving && <FiRefreshCw size={15} className="animate-spin" />}
              {saving ? 'Guardando...' : 'Guardar lead'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export default function LeadsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [modal, setModal] = useState(null); // null | { type: 'new'|'edit', lead? }
  const [successMsg, setSuccessMsg] = useState(null);

  const params = { q: q || undefined, status: status || undefined, limit: LIMIT, offset };
  const { data, loading, error, refresh } = useLeads(params);

  const rows = Array.isArray(data) ? data : (data?.data ?? []);
  const total = Array.isArray(data) ? rows.length : (data?.total ?? rows.length);
  const hasNext = offset + LIMIT < total;
  const hasPrev = offset > 0;

  const handleDisqualify = useCallback(async (lead) => {
    if (!window.confirm(`Descalificar lead "${[lead.first_name, lead.last_name].filter(Boolean).join(' ')}"?`)) return;
    try {
      await disqualifyLead(lead.id, { reason: 'Manual' });
      refresh();
    } catch (ex) {
      alert(ex.message || 'Error al descalificar');
    }
  }, [refresh]);

  const closeModal = useCallback(() => setModal(null), []);

  const onSaved = useCallback(() => {
    setModal(null);
    refresh();
  }, [refresh]);

  const handleQualify = useCallback(async (lead) => {
    try {
      await updateLead(lead.id, { status: 'qualified' });
      refresh();
      setSuccessMsg('Lead calificado');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (ex) {
      alert(ex.message || 'Error al calificar');
    }
  }, [refresh]);

  const canQualify = (s) => s === 'new' || s === 'contacted';

  return (
    <div className="p-6 bg-[#F9FAFB] min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1F2937]">Leads</h1>
        <button
          onClick={() => setModal({ type: 'new' })}
          className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-sm font-medium hover:bg-blue-700"
        >
          Nuevo lead
        </button>
      </div>

      {/* Success */}
      {successMsg && (
        <div className="mb-4 rounded-xl bg-[#DCFCE7] border border-[#16A34A]/30 px-4 py-3 text-sm text-[#16A34A] font-medium">
          {successMsg}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          className="border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] bg-white focus:outline-none focus:border-[#2563EB] w-64"
          placeholder="Buscar lead..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setOffset(0); }}
        />
        <select
          className="border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] bg-white focus:outline-none focus:border-[#2563EB]"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setOffset(0); }}
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/30 px-4 py-3 text-sm text-[#DC2626]">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1E293B]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide hidden sm:table-cell">Empresa</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide hidden sm:table-cell">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide hidden sm:table-cell">Prioridad</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide hidden sm:table-cell">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {loading ? (
              <Skeleton />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#6B7280]">
                  Sin leads
                </td>
              </tr>
            ) : (
              rows.map((lead) => (
                <tr key={lead.id} className="hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3 font-medium text-[#1F2937]">
                    {[lead.first_name, lead.last_name].filter(Boolean).join(' ')}
                  </td>
                  <td className="px-4 py-3 text-[#6B7280] hidden sm:table-cell">{lead.company_name || '—'}</td>
                  <td className="px-4 py-3 text-[#6B7280] hidden sm:table-cell">{lead.email || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3 text-[#6B7280] hidden sm:table-cell">{PRIORITY_LABELS[lead.priority] || lead.priority || '—'}</td>
                  <td className="px-4 py-3 text-[#6B7280] hidden sm:table-cell">
                    {lead.created_at ? new Date(lead.created_at).toLocaleDateString('es-CO') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setModal({ type: 'edit', lead })}
                        className="text-xs px-3 py-1 rounded-lg border border-[#E5E7EB] text-[#1F2937] hover:bg-gray-50 whitespace-nowrap"
                      >
                        Ver/Editar
                      </button>
                      {canQualify(lead.status) && (
                        <button
                          onClick={() => handleQualify(lead)}
                          className="text-xs px-3 py-1 rounded-lg border border-[#16A34A] text-[#16A34A] hover:bg-green-50 whitespace-nowrap"
                        >
                          Calificar
                        </button>
                      )}
                      {lead.status !== 'disqualified' && lead.status !== 'converted' && (
                        <button
                          onClick={() => handleDisqualify(lead)}
                          className="text-xs px-3 py-1 rounded-lg border border-[#DC2626] text-[#DC2626] hover:bg-red-50 whitespace-nowrap"
                        >
                          Descalificar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginacion */}
      {!loading && rows.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-[#6B7280]">
            {offset + 1}–{Math.min(offset + rows.length, total)} de {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={!hasPrev}
              onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
              className="px-3 py-1 rounded-lg border border-[#E5E7EB] text-sm text-[#1F2937] disabled:opacity-40 hover:bg-gray-50"
            >
              Anterior
            </button>
            <button
              disabled={!hasNext}
              onClick={() => setOffset((o) => o + LIMIT)}
              className="px-3 py-1 rounded-lg border border-[#E5E7EB] text-sm text-[#1F2937] disabled:opacity-40 hover:bg-gray-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'new' && (
        <LeadModal onClose={closeModal} onSaved={onSaved} />
      )}
      {modal?.type === 'edit' && (
        <LeadModal lead={modal.lead} onClose={closeModal} onSaved={onSaved} />
      )}
    </div>
  );
}
