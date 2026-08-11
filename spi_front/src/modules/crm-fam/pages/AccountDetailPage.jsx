import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { useAccount } from "../hooks/useCrmAccounts";
import { updateAccount, fetchAccountTimeline } from "../../../core/api/crmFamApi";

const EDITABLE_FIELDS = [
  { name: "account_name", label: "Nombre", required: true },
  { name: "account_type", label: "Tipo", type: "select", options: ["", "empresa", "persona_natural", "gobierno", "ong"] },
  { name: "ruc", label: "RUC" },
  { name: "industry", label: "Industria" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Teléfono" },
  { name: "city", label: "Ciudad" },
  { name: "country", label: "País" },
  { name: "website", label: "Sitio web" },
  { name: "description", label: "Descripción", type: "textarea" },
];

function Field({ field, value, editing, onChange }) {
  if (!editing) {
    if (field.name === "website" && value) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline text-sm break-all">
          {value}
        </a>
      );
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
        {field.options.map(o => <option key={o} value={o}>{o || "Seleccionar..."}</option>)}
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

export default function AccountDetailPage() {
  const { id } = useParams();
  const { data: account, loading, error, refresh } = useAccount(id);

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
      .then(res => setTimeline(Array.isArray(res) ? res : (res?.data ?? [])))
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
            {timeline.map((item, i) => (
              <li key={item.id ?? i} className="ml-4">
                <span className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-[#2563EB] border-2 border-white" />
                <p className="text-xs text-[#6B7280] mb-0.5">
                  {item.occurred_at
                    ? new Date(item.occurred_at).toLocaleDateString("es-PE", { year: "numeric", month: "short", day: "numeric" })
                    : "—"}
                </p>
                <p className="text-sm text-[#1F2937]">{item.description || item.event_type || "Evento"}</p>
                {item.details && (
                  <p className="text-xs text-[#6B7280] mt-0.5">{typeof item.details === "string" ? item.details : JSON.stringify(item.details)}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
