import { useState, useCallback, useEffect } from "react";
import { useContacts } from "../hooks/useCrmContacts";
import { createContact, updateContact, deleteContact, fetchAccounts } from "../../../core/api/crmFamApi";
import SearchableSelect from "../../../core/ui/components/SearchableSelect";

function useAccountOptions() {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    fetchAccounts({ limit: 500 })
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res?.data ?? []);
        setOptions(rows.map((a) => ({ value: a.id, label: a.account_name })));
      })
      .catch(() => setOptions([]));
  }, []);
  return options;
}

const LIMIT = 20;

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  job_title: "",
  email: "",
  phone: "",
  account_id: "",
};

function Skeleton() {
  const p = <div className="h-4 bg-gray-200 rounded w-3/4" />;
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-3">{p}</td>
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

function ContactModal({ contact, onClose, onSaved }) {
  const [form, setForm] = useState(contact ? { ...contact, account_id: contact.account_id ?? "" } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const accountOptions = useAccountOptions();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim()) { setErr("Nombre requerido"); return; }
    setSaving(true);
    setErr(null);
    try {
      const payload = { ...form, account_id: form.account_id || null };
      if (contact?.id) {
        await updateContact(contact.id, payload);
      } else {
        await createContact(payload);
      }
      onSaved();
    } catch (ex) {
      setErr(ex.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-[16px] shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
          {contact?.id ? "Editar contacto" : "Nuevo contacto"}
        </h2>
        {err && (
          <div className="mb-3 rounded-[12px] bg-[#DC2626]/10 border border-[#DC2626]/30 px-3 py-2 text-sm text-[#DC2626]">
            {err}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Nombre *</label>
              <input
                className="w-full border border-[#E5E7EB] rounded-[12px] px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:border-[#2563EB]"
                value={form.first_name}
                onChange={set("first_name")}
                placeholder="Nombre"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Apellido</label>
              <input
                className="w-full border border-[#E5E7EB] rounded-[12px] px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:border-[#2563EB]"
                value={form.last_name}
                onChange={set("last_name")}
                placeholder="Apellido"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Cargo</label>
            <input
              className="w-full border border-[#E5E7EB] rounded-[12px] px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:border-[#2563EB]"
              value={form.job_title}
              onChange={set("job_title")}
              placeholder="Cargo"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Email</label>
            <input
              type="email"
              className="w-full border border-[#E5E7EB] rounded-[12px] px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:border-[#2563EB]"
              value={form.email}
              onChange={set("email")}
              placeholder="email@empresa.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Telefono</label>
            <input
              className="w-full border border-[#E5E7EB] rounded-[12px] px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:border-[#2563EB]"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+57 300 0000000"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Cuenta (opcional)</label>
            <SearchableSelect
              options={accountOptions}
              value={form.account_id}
              onChange={(value) => setForm((f) => ({ ...f, account_id: value }))}
              placeholder="Buscar cuenta por nombre..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[12px] border border-[#E5E7EB] text-sm text-[#6B7280] hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-[12px] bg-[#2563EB] text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetailModal({ contact, onClose }) {
  const fields = [
    ["Nombre", [contact.first_name, contact.last_name].filter(Boolean).join(" ")],
    ["Cargo", contact.job_title],
    ["Empresa / Cuenta", contact.account_name || contact.account_id || "—"],
    ["Email", contact.email],
    ["Telefono", contact.phone],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-[16px] shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Detalle de contacto</h2>
        <dl className="space-y-2">
          {fields.map(([label, val]) => (
            <div key={label} className="flex gap-2">
              <dt className="text-xs font-medium text-[#6B7280] w-32 shrink-0">{label}</dt>
              <dd className="text-sm text-[#1F2937] break-all">{val || "—"}</dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[12px] border border-[#E5E7EB] text-sm text-[#6B7280] hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const [q, setQ] = useState("");
  const [accountId, setAccountId] = useState("");
  const [offset, setOffset] = useState(0);
  const [modal, setModal] = useState(null); // null | { type: "new"|"edit"|"detail", contact? }
  const accountOptions = useAccountOptions();

  const params = { q: q || undefined, account_id: accountId || undefined, limit: LIMIT, offset };
  const { data, loading, error, refresh } = useContacts(params);

  const rows = Array.isArray(data) ? data : (data?.data ?? []);
  const total = Array.isArray(data) ? rows.length : (data?.total ?? rows.length);
  const hasNext = offset + LIMIT < total;
  const hasPrev = offset > 0;

  const handleDelete = useCallback(async (contact) => {
    if (!window.confirm(`Eliminar contacto "${contact.first_name} ${contact.last_name || ""}".trim()? Esta accion no se puede deshacer.`)) return;
    try {
      await deleteContact(contact.id);
      refresh();
    } catch (ex) {
      alert(ex.message || "Error al eliminar");
    }
  }, [refresh]);

  const closeModal = useCallback(() => setModal(null), []);
  const onSaved = useCallback(() => { setModal(null); refresh(); }, [refresh]);

  return (
    <div className="p-6 bg-[#F9FAFB] min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1F2937]">Contactos</h1>
        <button
          onClick={() => setModal({ type: "new" })}
          className="px-4 py-2 rounded-[12px] bg-[#2563EB] text-white text-sm font-medium hover:bg-blue-700"
        >
          Nuevo contacto
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          className="border border-[#E5E7EB] rounded-[12px] px-3 py-2 text-sm text-[#1F2937] bg-white focus:outline-none focus:border-[#2563EB] flex-1 sm:flex-none sm:w-64"
          placeholder="Buscar contacto..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setOffset(0); }}
        />
        <select
          className="border border-[#E5E7EB] rounded-[12px] px-3 py-2 text-sm text-[#1F2937] bg-white focus:outline-none focus:border-[#2563EB] flex-1 sm:flex-none sm:w-56 hidden sm:block"
          value={accountId}
          onChange={(e) => { setAccountId(e.target.value); setOffset(0); }}
        >
          <option value="">Todas las cuentas</option>
          {accountOptions.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-[12px] bg-[#DC2626]/10 border border-[#DC2626]/30 px-4 py-3 text-sm text-[#DC2626]">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-[16px] border border-[#E5E7EB] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden sm:table-cell">Cargo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Empresa</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden sm:table-cell">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden sm:table-cell">Telefono</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {loading ? (
              <Skeleton />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#6B7280]">
                  Sin contactos
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3 font-medium text-[#1F2937]">
                    {[c.first_name, c.last_name].filter(Boolean).join(" ")}
                  </td>
                  <td className="px-4 py-3 text-[#6B7280] hidden sm:table-cell">{c.job_title || "—"}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{c.account_name || c.account_id || "—"}</td>
                  <td className="px-4 py-3 text-[#6B7280] hidden sm:table-cell">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-[#6B7280] hidden sm:table-cell">{c.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setModal({ type: "detail", contact: c })}
                        className="text-xs px-3 py-1 rounded-[8px] border border-[#E5E7EB] text-[#1F2937] hover:bg-gray-50"
                      >
                        Ver
                      </button>
                      <button
                        onClick={() => setModal({ type: "edit", contact: c })}
                        className="text-xs px-3 py-1 rounded-[8px] border border-[#2563EB] text-[#2563EB] hover:bg-blue-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className="text-xs px-3 py-1 rounded-[8px] border border-[#DC2626] text-[#DC2626] hover:bg-red-50"
                      >
                        Eliminar
                      </button>
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
              className="px-3 py-1 rounded-[8px] border border-[#E5E7EB] text-sm text-[#1F2937] disabled:opacity-40 hover:bg-gray-50"
            >
              Anterior
            </button>
            <button
              disabled={!hasNext}
              onClick={() => setOffset((o) => o + LIMIT)}
              className="px-3 py-1 rounded-[8px] border border-[#E5E7EB] text-sm text-[#1F2937] disabled:opacity-40 hover:bg-gray-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal?.type === "new" && (
        <ContactModal onClose={closeModal} onSaved={onSaved} />
      )}
      {modal?.type === "edit" && (
        <ContactModal contact={modal.contact} onClose={closeModal} onSaved={onSaved} />
      )}
      {modal?.type === "detail" && (
        <DetailModal contact={modal.contact} onClose={closeModal} />
      )}
    </div>
  );
}
