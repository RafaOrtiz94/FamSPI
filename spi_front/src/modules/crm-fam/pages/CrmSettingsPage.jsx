import { useState, useEffect, useCallback } from "react";
import {
  fetchPipelineStages, createPipelineStage, updatePipelineStage,
  fetchScorecardCriteria, createScorecardCriterion, updateScorecardCriterion,
  fetchLostReasons, createLostReason, updateLostReason,
} from "../../../core/api/crmFamApi";

// ── helpers ──────────────────────────────────────────────────────────────────

function SkeletonRows({ cols = 5 }) {
  return Array.from({ length: 3 }).map((_, i) => (
    <tr key={i} className="border-b border-[#E5E7EB] animate-pulse">
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  ));
}

function ErrorBanner({ msg }) {
  return (
    <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
      {msg}
    </div>
  );
}

function Badge({ active }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-green-100 text-green-700" : "bg-gray-100 text-[#6B7280]"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

// ── Modal base ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, onSubmit, submitting, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1F2937]">{title}</h2>
          <button
            onClick={onClose}
            className="text-[#6B7280] hover:text-[#1F2937] text-lg leading-none"
          >
            ×
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          {children}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm text-[#6B7280] hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#6B7280]">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none";

// ── Tab: Etapas del Pipeline ──────────────────────────────────────────────────

const stageDefaults = {
  name: "",
  order_index: "",
  probability_default: "",
  requires_blue_sheet: false,
};

function PipelineStagesTab() {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // null | { mode: "create"|"edit", data: {} }
  const [form, setForm] = useState(stageDefaults);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPipelineStages();
      setStages(data || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Error al cargar etapas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(stageDefaults);
    setModal({ mode: "create" });
  }

  function openEdit(stage) {
    setForm({
      name: stage.name || "",
      order_index: stage.order_index ?? "",
      probability_default: stage.probability_default ?? "",
      requires_blue_sheet: !!stage.requires_blue_sheet,
    });
    setModal({ mode: "edit", id: stage.id });
  }

  async function handleSubmit() {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        order_index: form.order_index !== "" ? Number(form.order_index) : undefined,
        probability_default:
          form.probability_default !== "" ? Number(form.probability_default) : undefined,
        requires_blue_sheet: form.requires_blue_sheet,
      };
      if (modal.mode === "create") {
        await createPipelineStage(payload);
      } else {
        await updatePipelineStage(modal.id, payload);
      }
      setModal(null);
      load();
    } catch (e) {
      setError(e?.response?.data?.message || "Error al guardar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(stage) {
    try {
      await updatePipelineStage(stage.id, { is_active: !stage.is_active });
      load();
    } catch (e) {
      setError(e?.response?.data?.message || "Error al actualizar estado.");
    }
  }

  return (
    <div>
      {error && <ErrorBanner msg={error} />}
      <div className="mb-4 flex justify-end">
        <button
          onClick={openCreate}
          className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nueva etapa
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[#E5E7EB] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-left text-xs font-medium text-[#6B7280]">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Orden</th>
              <th className="px-4 py-3">Prob. Default</th>
              <th className="px-4 py-3">Requiere BS</th>
              <th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={6} />
            ) : stages.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[#6B7280]">
                  Sin etapas configuradas.
                </td>
              </tr>
            ) : (
              stages.map((s) => (
                <tr key={s.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3 font-medium text-[#1F2937]">{s.name}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{s.order_index ?? "—"}</td>
                  <td className="px-4 py-3 text-[#6B7280]">
                    {s.probability_default != null ? `${s.probability_default}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-[#6B7280]">{s.requires_blue_sheet ? "Sí" : "No"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(s)} title="Toggle activo">
                      <Badge active={s.is_active} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(s)}
                      className="text-[#2563EB] hover:underline text-xs"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          title={modal.mode === "create" ? "Nueva etapa" : "Editar etapa"}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
          submitting={submitting}
        >
          <Field label="Nombre *">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </Field>
          <Field label="Orden">
            <input
              type="number"
              className={inputCls}
              value={form.order_index}
              onChange={(e) => setForm((f) => ({ ...f, order_index: e.target.value }))}
              min={0}
            />
          </Field>
          <Field label="Probabilidad default (0-100)">
            <input
              type="number"
              className={inputCls}
              value={form.probability_default}
              onChange={(e) => setForm((f) => ({ ...f, probability_default: e.target.value }))}
              min={0}
              max={100}
            />
          </Field>
          <Field label="">
            <label className="flex items-center gap-2 text-sm text-[#1F2937]">
              <input
                type="checkbox"
                checked={form.requires_blue_sheet}
                onChange={(e) => setForm((f) => ({ ...f, requires_blue_sheet: e.target.checked }))}
                className="rounded"
              />
              Requiere Blue Sheet
            </label>
          </Field>
        </Modal>
      )}
    </div>
  );
}

// ── Tab: Criterios Scorecard ──────────────────────────────────────────────────

const criterionDefaults = {
  criterion_name: "",
  criterion_description: "",
  weight: "",
  display_order: "",
};

function ScorecardCriteriaTab() {
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(criterionDefaults);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchScorecardCriteria();
      setCriteria(data || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Error al cargar criterios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(criterionDefaults);
    setModal({ mode: "create" });
  }

  function openEdit(c) {
    setForm({
      criterion_name: c.criterion_name || "",
      criterion_description: c.criterion_description || "",
      weight: c.weight ?? "",
      display_order: c.display_order ?? "",
    });
    setModal({ mode: "edit", id: c.id });
  }

  async function handleSubmit() {
    if (!form.criterion_name.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        criterion_name: form.criterion_name.trim(),
        criterion_description: form.criterion_description.trim() || undefined,
        weight: form.weight !== "" ? Number(form.weight) : undefined,
        display_order: form.display_order !== "" ? Number(form.display_order) : undefined,
      };
      if (modal.mode === "create") {
        await createScorecardCriterion(payload);
      } else {
        await updateScorecardCriterion(modal.id, payload);
      }
      setModal(null);
      load();
    } catch (e) {
      setError(e?.response?.data?.message || "Error al guardar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(c) {
    try {
      await updateScorecardCriterion(c.id, { is_active: !c.is_active });
      load();
    } catch (e) {
      setError(e?.response?.data?.message || "Error al actualizar estado.");
    }
  }

  return (
    <div>
      {error && <ErrorBanner msg={error} />}
      <div className="mb-4 flex justify-end">
        <button
          onClick={openCreate}
          className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nuevo criterio
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[#E5E7EB] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-left text-xs font-medium text-[#6B7280]">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Peso</th>
              <th className="px-4 py-3">Orden</th>
              <th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={5} />
            ) : criteria.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[#6B7280]">
                  Sin criterios configurados.
                </td>
              </tr>
            ) : (
              criteria.map((c) => (
                <tr key={c.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3 font-medium text-[#1F2937]">{c.criterion_name}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{c.weight ?? "—"}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{c.display_order ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(c)} title="Toggle activo">
                      <Badge active={c.is_active} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(c)}
                      className="text-[#2563EB] hover:underline text-xs"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          title={modal.mode === "create" ? "Nuevo criterio" : "Editar criterio"}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
          submitting={submitting}
        >
          <Field label="Nombre *">
            <input
              className={inputCls}
              value={form.criterion_name}
              onChange={(e) => setForm((f) => ({ ...f, criterion_name: e.target.value }))}
              required
            />
          </Field>
          <Field label="Descripcion">
            <textarea
              className={`${inputCls} resize-none`}
              rows={3}
              value={form.criterion_description}
              onChange={(e) => setForm((f) => ({ ...f, criterion_description: e.target.value }))}
            />
          </Field>
          <Field label="Peso (1-10)">
            <input
              type="number"
              className={inputCls}
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
              min={1}
              max={10}
            />
          </Field>
          <Field label="Orden">
            <input
              type="number"
              className={inputCls}
              value={form.display_order}
              onChange={(e) => setForm((f) => ({ ...f, display_order: e.target.value }))}
              min={0}
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}

// ── Tab: Razones de Perdida ───────────────────────────────────────────────────

const lostReasonDefaults = {
  reason_name: "",
  reason_description: "",
  display_order: "",
};

function LostReasonsTab() {
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(lostReasonDefaults);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLostReasons();
      setReasons(data || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Error al cargar razones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(lostReasonDefaults);
    setModal({ mode: "create" });
  }

  function openEdit(r) {
    setForm({
      reason_name: r.reason_name || "",
      reason_description: r.reason_description || "",
      display_order: r.display_order ?? "",
    });
    setModal({ mode: "edit", id: r.id });
  }

  async function handleSubmit() {
    if (!form.reason_name.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        reason_name: form.reason_name.trim(),
        reason_description: form.reason_description.trim() || undefined,
        display_order: form.display_order !== "" ? Number(form.display_order) : undefined,
      };
      if (modal.mode === "create") {
        await createLostReason(payload);
      } else {
        await updateLostReason(modal.id, payload);
      }
      setModal(null);
      load();
    } catch (e) {
      setError(e?.response?.data?.message || "Error al guardar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(r) {
    try {
      await updateLostReason(r.id, { is_active: !r.is_active });
      load();
    } catch (e) {
      setError(e?.response?.data?.message || "Error al actualizar estado.");
    }
  }

  return (
    <div>
      {error && <ErrorBanner msg={error} />}
      <div className="mb-4 flex justify-end">
        <button
          onClick={openCreate}
          className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nueva razon
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[#E5E7EB] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-left text-xs font-medium text-[#6B7280]">
              <th className="px-4 py-3">Razon</th>
              <th className="px-4 py-3">Descripcion</th>
              <th className="px-4 py-3">Orden</th>
              <th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={5} />
            ) : reasons.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[#6B7280]">
                  Sin razones configuradas.
                </td>
              </tr>
            ) : (
              reasons.map((r) => (
                <tr key={r.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3 font-medium text-[#1F2937]">{r.reason_name}</td>
                  <td className="px-4 py-3 text-[#6B7280] max-w-xs truncate">
                    {r.reason_description || "—"}
                  </td>
                  <td className="px-4 py-3 text-[#6B7280]">{r.display_order ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(r)} title="Toggle activo">
                      <Badge active={r.is_active} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(r)}
                      className="text-[#2563EB] hover:underline text-xs"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          title={modal.mode === "create" ? "Nueva razon de perdida" : "Editar razon de perdida"}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
          submitting={submitting}
        >
          <Field label="Razon *">
            <input
              className={inputCls}
              value={form.reason_name}
              onChange={(e) => setForm((f) => ({ ...f, reason_name: e.target.value }))}
              required
            />
          </Field>
          <Field label="Descripcion">
            <textarea
              className={`${inputCls} resize-none`}
              rows={3}
              value={form.reason_description}
              onChange={(e) => setForm((f) => ({ ...f, reason_description: e.target.value }))}
            />
          </Field>
          <Field label="Orden">
            <input
              type="number"
              className={inputCls}
              value={form.display_order}
              onChange={(e) => setForm((f) => ({ ...f, display_order: e.target.value }))}
              min={0}
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "stages", label: "Etapas del Pipeline", Component: PipelineStagesTab },
  { id: "scorecard", label: "Criterios Scorecard", Component: ScorecardCriteriaTab },
  { id: "lost", label: "Razones de Perdida", Component: LostReasonsTab },
];

export default function CrmSettingsPage() {
  const [activeTab, setActiveTab] = useState("stages");
  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.Component;

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#1E293B]">Configuracion CRM</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Administra etapas del pipeline, criterios de scorecard y razones de perdida.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-[#E5E7EB] bg-white p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? "bg-[#2563EB] text-white shadow-sm"
                : "text-[#6B7280] hover:text-[#1F2937]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {ActiveComponent && <ActiveComponent />}
    </div>
  );
}
