import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAccounts } from "../hooks/useCrmAccounts";
import { createAccount } from "../../../core/api/crmFamApi";

const ACCOUNT_TYPES = [
  { value: "", label: "Todos los tipos" },
  { value: "empresa", label: "Empresa" },
  { value: "persona_natural", label: "Persona Natural" },
  { value: "gobierno", label: "Gobierno" },
  { value: "ong", label: "ONG" },
];

const LIMIT = 20;

const EMPTY_FORM = {
  account_name: "",
  account_type: "",
  ruc: "",
  industry: "",
  city: "",
};

const skCell = "px-4 py-3";
const skCellHidden = "px-4 py-3 hidden sm:table-cell";
function SkeletonRows() {
  const pulse = <div className="animate-pulse bg-gray-200 h-4 rounded w-full" />;
  return Array.from({ length: 5 }).map((_, i) => (
    <tr key={i} className="border-b border-[#E5E7EB]">
      <td className={skCell}>{pulse}</td>
      <td className={skCellHidden}>{pulse}</td>
      <td className={skCell}>{pulse}</td>
      <td className={skCellHidden}>{pulse}</td>
      <td className={skCellHidden}>{pulse}</td>
      <td className={skCellHidden}>{pulse}</td>
      <td className={skCell}>{pulse}</td>
    </tr>
  ));
}

export default function AccountsPage() {
  const navigate = useNavigate();

  // Filters state
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [accountType, setAccountType] = useState("");
  const [offset, setOffset] = useState(0);

  // Debounce q 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Reset offset on filter change
  useEffect(() => { setOffset(0); }, [debouncedQ, accountType]);

  const params = {
    ...(debouncedQ ? { q: debouncedQ } : {}),
    ...(accountType ? { account_type: accountType } : {}),
    limit: LIMIT,
    offset,
  };

  const { data, loading, error, refresh } = useAccounts(params);

  // Normalize data: API may return array or { data, total }
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
    if (!form.account_name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createAccount(form);
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

  return (
    <div className="p-6 bg-[#F9FAFB] min-h-full">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[#1F2937]">Cuentas</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#2563EB] text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          Nueva cuenta
        </button>
      </header>

      {/* Filters */}
      <section className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Buscar por nombre, RUC..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#2563EB] flex-1 sm:flex-none sm:w-64"
        />
        <select
          value={accountType}
          onChange={e => setAccountType(e.target.value)}
          className="border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        >
          {ACCOUNT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </section>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-[#FEE2E2] border border-[#DC2626] text-[#DC2626] rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#1E293B] text-white">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">RUC</th>
              <th className="px-4 py-3 text-left font-medium">Tipo</th>
              <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Industria</th>
              <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Ciudad</th>
              <th className="px-4 py-3 text-left font-medium hidden sm:table-cell"># Opp</th>
              <th className="px-4 py-3 text-left font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#6B7280]">
                  Sin resultados
                </td>
              </tr>
            ) : (
              rows.map(acc => (
                <tr
                  key={acc.id}
                  onClick={() => navigate(`/dashboard/crm-fam/accounts/${acc.id}`)}
                  className="border-b border-[#E5E7EB] hover:bg-[#334155]/5 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-[#1F2937]">{acc.account_name}</td>
                  <td className="px-4 py-3 text-[#6B7280] hidden sm:table-cell">{acc.ruc || "—"}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{acc.account_type || "—"}</td>
                  <td className="px-4 py-3 text-[#6B7280] hidden sm:table-cell">{acc.industry || "—"}</td>
                  <td className="px-4 py-3 text-[#6B7280] hidden sm:table-cell">{acc.city || "—"}</td>
                  <td className="px-4 py-3 text-[#6B7280] hidden sm:table-cell">{acc.opportunities_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/dashboard/crm-fam/accounts/${acc.id}`); }}
                      className="text-[#2563EB] hover:underline text-sm font-medium"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))
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

      {/* Modal nueva cuenta */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] w-full max-w-md p-6 shadow-none">
            <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Nueva cuenta</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-medium text-[#1F2937] mb-1">
                  Nombre <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  name="account_name"
                  value={form.account_name}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1F2937] mb-1">Tipo</label>
                <select
                  name="account_type"
                  value={form.account_type}
                  onChange={handleFormChange}
                  className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                >
                  <option value="">Seleccionar...</option>
                  <option value="empresa">Empresa</option>
                  <option value="persona_natural">Persona Natural</option>
                  <option value="gobierno">Gobierno</option>
                  <option value="ong">ONG</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1F2937] mb-1">RUC</label>
                <input
                  name="ruc"
                  value={form.ruc}
                  onChange={handleFormChange}
                  className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1F2937] mb-1">Industria</label>
                <input
                  name="industry"
                  value={form.industry}
                  onChange={handleFormChange}
                  className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1F2937] mb-1">Ciudad</label>
                <input
                  name="city"
                  value={form.city}
                  onChange={handleFormChange}
                  className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              {saveError && (
                <p className="text-sm text-[#DC2626]">{saveError}</p>
              )}
              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm border border-[#E5E7EB] rounded-xl text-[#1F2937] hover:bg-[#334155]/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-[#2563EB] text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
