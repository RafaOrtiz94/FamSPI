import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchOpportunityById,
  fetchBlueSheetByOpportunity,
  createBlueSheet,
  updateBlueSheetGeneral,
  submitBlueSheet,
  approveBlueSheet,
  observeBlueSheet,
  reopenBlueSheet,
  fetchBuyingInfluences,
  createBuyingInfluence,
  deleteBuyingInfluence,
  fetchWinResults,
  createWinResult,
  fetchCompetitors,
  createCompetitor,
  deleteCompetitor,
  fetchStrengths,
  createStrength,
  deleteStrength,
  fetchRedFlags,
  createRedFlag,
  deleteRedFlag,
  fetchBlueSheetScorecard,
  saveBlueSheetScorecard,
  fetchActionItems,
  createActionItem,
  deleteActionItem,
} from "../../../core/api/crmFamApi";
import { getUsers } from "../../../core/api/usersApi";

// ─── Constants ───────────────────────────────────────────────────────────────

const BS_STATUS = {
  draft:             { label: "Borrador",                color: "#6B7280", bg: "#F3F4F6" },
  in_progress:       { label: "En progreso",             color: "#D97706", bg: "#FEF3C7" },
  ready_for_review:  { label: "En revisión",             color: "#0EA5E9", bg: "#E0F2FE" },
  observed:          { label: "Observado",               color: "#D97706", bg: "#FEF3C7" },
  approved:          { label: "Aprobado",                color: "#16A34A", bg: "#DCFCE7" },
  needs_update:      { label: "Necesita actualización",  color: "#DC2626", bg: "#FEE2E2" },
};

const RF_COLORS = { low: "#6B7280", medium: "#D97706", high: "#DC2626", critical: "#7C3AED" };

const EDITABLE_STATUSES = ["draft", "in_progress", "needs_update", "observed"];

const TABS = [
  { key: "general",      label: "General" },
  { key: "buyers",       label: "Compradores" },
  { key: "results",      label: "Resultados" },
  { key: "competitors",  label: "Competidores" },
  { key: "strengths",    label: "Fortalezas" },
  { key: "redflags",     label: "Red Flags" },
  { key: "scorecard",    label: "Scorecard" },
  { key: "actions",      label: "Acciones" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = BS_STATUS[status] || { label: status, color: "#6B7280", bg: "#F3F4F6" };
  return (
    <span
      className="text-xs font-semibold px-3 py-1 rounded-full"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

function CompletionBar({ value = 0 }) {
  const pct = Math.min(100, Math.round(value));
  const color = pct >= 80 ? "#16A34A" : pct >= 50 ? "#D97706" : "#DC2626";
  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-[#6B7280]">Completitud</span>
        <span className="font-medium text-[#1F2937]">{pct}%</span>
      </div>
      <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-[#1F2937] text-base">{title}</h3>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#1F2937] text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-[#1F2937] mb-1">
        {label}{required && <span className="text-[#DC2626] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40";
const textareaCls = `${inputCls} resize-none`;
const btnPrimary = "px-4 py-2 rounded-xl text-sm font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50";
const btnSecondary = "px-4 py-2 rounded-xl text-sm font-medium border border-[#E5E7EB] text-[#1F2937] hover:bg-[#F9FAFB]";
const btnDanger = "px-3 py-1 rounded-lg text-xs font-medium bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA]";

// ─── Tab: General ─────────────────────────────────────────────────────────────

function TabGeneral({ bs, editable, onSaved }) {
  const [form, setForm] = useState({
    sales_objective_text: bs?.sales_objective_text || "",
    customer_situation_current: bs?.customer_situation_current || "",
    customer_situation_desired: bs?.customer_situation_desired || "",
    urgency_level: bs?.urgency_level || "medium",
    budget_status: bs?.budget_status || "unknown",
    budget_amount: bs?.budget_amount || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBlueSheetGeneral(bs.id, form);
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Objetivo declarado del cliente" required>
        <textarea
          className={textareaCls}
          rows={3}
          placeholder="Objetivo declarado del cliente"
          value={form.sales_objective_text}
          onChange={e => set("sales_objective_text", e.target.value)}
          disabled={!editable}
        />
      </Field>
      <Field label="Situación actual del cliente">
        <textarea
          className={textareaCls}
          rows={3}
          value={form.customer_situation_current}
          onChange={e => set("customer_situation_current", e.target.value)}
          disabled={!editable}
        />
      </Field>
      <Field label="Situación deseada del cliente">
        <textarea
          className={textareaCls}
          rows={3}
          value={form.customer_situation_desired}
          onChange={e => set("customer_situation_desired", e.target.value)}
          disabled={!editable}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nivel de urgencia">
          <select
            className={inputCls}
            value={form.urgency_level}
            onChange={e => set("urgency_level", e.target.value)}
            disabled={!editable}
          >
            <option value="low">Bajo</option>
            <option value="medium">Medio</option>
            <option value="high">Alto</option>
            <option value="critical">Crítico</option>
          </select>
        </Field>
        <Field label="Estado presupuesto">
          <select
            className={inputCls}
            value={form.budget_status}
            onChange={e => set("budget_status", e.target.value)}
            disabled={!editable}
          >
            <option value="unknown">Desconocido</option>
            <option value="identified">Identificado</option>
            <option value="approved">Aprobado</option>
            <option value="constrained">Limitado</option>
          </select>
        </Field>
      </div>
      <Field label="Monto presupuesto">
        <input
          type="number"
          className={inputCls}
          value={form.budget_amount}
          onChange={e => set("budget_amount", e.target.value)}
          disabled={!editable}
          placeholder="0"
        />
      </Field>
      {editable && (
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving} className={btnPrimary}>
            {saving ? "Guardando..." : "Guardar sección"}
          </button>
          {saved && <span className="text-sm text-[#16A34A] font-medium">Guardado</span>}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Compradores ─────────────────────────────────────────────────────────

function TabBuyers({ bs, editable }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ full_name: "", job_title: "", influence_role: "economic_buyer", receptivity: "even_keel", access_level: "direct" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await fetchBuyingInfluences(bs.id) || []); } catch {}
    setLoading(false);
  }, [bs.id]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.full_name.trim()) return alert("Nombre requerido");
    setSaving(true);
    try {
      await createBuyingInfluence(bs.id, form);
      setModal(false);
      setForm({ full_name: "", job_title: "", influence_role: "economic_buyer", receptivity: "even_keel", access_level: "direct" });
      load();
    } catch (e) { alert(e.message || "Error"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar comprador?")) return;
    try { await deleteBuyingInfluence(id); load(); } catch (e) { alert(e.message || "Error"); }
  };

  const ROLE_LABELS = { economic_buyer: "Comprador económico", user_buyer: "Comprador usuario", technical_buyer: "Comprador técnico", coach: "Coach" };
  const RECEPT_LABELS = { growth: "Crecimiento", trouble: "Problema", even_keel: "Neutral", overconfident: "Sobreconfiado" };
  const ACCESS_LABELS = { direct: "Directo", limited: "Limitado", none: "Sin acceso" };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-[#6B7280]">{list.length} compradores registrados</span>
        {editable && (
          <button onClick={() => setModal(true)} className={btnPrimary}>+ Nuevo comprador</button>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-[#6B7280]">Cargando...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-[#6B7280]">Sin compradores registrados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-[#6B7280] text-left">
                <th className="pb-2 pr-4 font-medium">Nombre</th>
                <th className="pb-2 pr-4 font-medium">Cargo</th>
                <th className="pb-2 pr-4 font-medium">Rol</th>
                <th className="pb-2 pr-4 font-medium">Receptividad</th>
                <th className="pb-2 pr-4 font-medium">Acceso</th>
                {editable && <th className="pb-2 font-medium">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {list.map(b => (
                <tr key={b.id} className="border-b border-[#E5E7EB] last:border-0">
                  <td className="py-2 pr-4 font-medium text-[#1F2937]">{b.full_name}</td>
                  <td className="py-2 pr-4 text-[#6B7280]">{b.job_title || "-"}</td>
                  <td className="py-2 pr-4">{ROLE_LABELS[b.influence_role] || b.influence_role}</td>
                  <td className="py-2 pr-4">{RECEPT_LABELS[b.receptivity] || b.receptivity}</td>
                  <td className="py-2 pr-4">{ACCESS_LABELS[b.access_level] || b.access_level}</td>
                  {editable && (
                    <td className="py-2">
                      <button onClick={() => handleDelete(b.id)} className={btnDanger}>Eliminar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <Modal title="Nuevo comprador" onClose={() => setModal(false)}>
          <Field label="Nombre" required>
            <input className={inputCls} value={form.full_name} onChange={e => set("full_name", e.target.value)} />
          </Field>
          <Field label="Cargo">
            <input className={inputCls} value={form.job_title} onChange={e => set("job_title", e.target.value)} />
          </Field>
          <Field label="Rol de influencia">
            <select className={inputCls} value={form.influence_role} onChange={e => set("influence_role", e.target.value)}>
              <option value="economic_buyer">Comprador económico</option>
              <option value="user_buyer">Comprador usuario</option>
              <option value="technical_buyer">Comprador técnico</option>
              <option value="coach">Coach</option>
            </select>
          </Field>
          <Field label="Receptividad">
            <select className={inputCls} value={form.receptivity} onChange={e => set("receptivity", e.target.value)}>
              <option value="growth">Crecimiento</option>
              <option value="trouble">Problema</option>
              <option value="even_keel">Neutral</option>
              <option value="overconfident">Sobreconfiado</option>
            </select>
          </Field>
          <Field label="Nivel de acceso">
            <select className={inputCls} value={form.access_level} onChange={e => set("access_level", e.target.value)}>
              <option value="direct">Directo</option>
              <option value="limited">Limitado</option>
              <option value="none">Sin acceso</option>
            </select>
          </Field>
          <div className="flex gap-3 justify-end mt-2">
            <button onClick={() => setModal(false)} className={btnSecondary}>Cancelar</button>
            <button onClick={handleCreate} disabled={saving} className={btnPrimary}>{saving ? "Guardando..." : "Crear"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Resultados (Win-Results) ────────────────────────────────────────────

function TabResults({ bs, editable }) {
  const [list, setList] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ buying_influence_id: "", result_type: "result", description: "", importance_level: "medium" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, b] = await Promise.all([fetchWinResults(bs.id), fetchBuyingInfluences(bs.id)]);
      setList(l || []);
      setBuyers(b || []);
      if (b?.length) setForm(f => ({ ...f, buying_influence_id: b[0].id }));
    } catch {}
    setLoading(false);
  }, [bs.id]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.buying_influence_id) return alert("Selecciona comprador");
    if (!form.description.trim()) return alert("Descripción requerida");
    setSaving(true);
    try {
      await createWinResult(form.buying_influence_id, { result_type: form.result_type, description: form.description, importance_level: form.importance_level });
      setModal(false);
      load();
    } catch (e) { alert(e.message || "Error"); }
    setSaving(false);
  };

  const IMP_LABELS = { low: "Bajo", medium: "Medio", high: "Alto", critical: "Crítico" };
  const TYPE_LABELS = { win: "Win", result: "Resultado" };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-[#6B7280]">{list.length} resultados</span>
        {editable && buyers.length > 0 && (
          <button onClick={() => setModal(true)} className={btnPrimary}>+ Agregar resultado</button>
        )}
        {editable && buyers.length === 0 && (
          <span className="text-xs text-[#D97706]">Agrega compradores primero</span>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-[#6B7280]">Cargando...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-[#6B7280]">Sin resultados registrados.</p>
      ) : (
        <div className="space-y-3">
          {list.map(r => {
            const buyer = buyers.find(b => b.id === r.buying_influence_id);
            return (
              <div key={r.id} className="border border-[#E5E7EB] rounded-xl p-4">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-[#1F2937] text-sm">{TYPE_LABELS[r.result_type] || r.result_type}</span>
                  <span className="text-xs text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-full">{IMP_LABELS[r.importance_level] || r.importance_level}</span>
                </div>
                <p className="text-sm text-[#1F2937] mb-1">{r.description}</p>
                {buyer && <p className="text-xs text-[#6B7280]">Comprador: {buyer.full_name}</p>}
              </div>
            );
          })}
        </div>
      )}
      {modal && (
        <Modal title="Agregar resultado" onClose={() => setModal(false)}>
          <Field label="Comprador" required>
            <select className={inputCls} value={form.buying_influence_id} onChange={e => set("buying_influence_id", e.target.value)}>
              {buyers.map(b => <option key={b.id} value={b.id}>{b.full_name}</option>)}
            </select>
          </Field>
          <Field label="Tipo">
            <select className={inputCls} value={form.result_type} onChange={e => set("result_type", e.target.value)}>
              <option value="win">Win</option>
              <option value="result">Resultado</option>
            </select>
          </Field>
          <Field label="Descripción" required>
            <textarea className={textareaCls} rows={3} value={form.description} onChange={e => set("description", e.target.value)} />
          </Field>
          <Field label="Importancia">
            <select className={inputCls} value={form.importance_level} onChange={e => set("importance_level", e.target.value)}>
              <option value="low">Bajo</option>
              <option value="medium">Medio</option>
              <option value="high">Alto</option>
              <option value="critical">Crítico</option>
            </select>
          </Field>
          <div className="flex gap-3 justify-end mt-2">
            <button onClick={() => setModal(false)} className={btnSecondary}>Cancelar</button>
            <button onClick={handleCreate} disabled={saving} className={btnPrimary}>{saving ? "Guardando..." : "Crear"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Competidores ────────────────────────────────────────────────────────

function TabCompetitors({ bs, editable }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ competitor_name: "", threat_level: "medium", known_strengths: "", known_weaknesses: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await fetchCompetitors(bs.id) || []); } catch {}
    setLoading(false);
  }, [bs.id]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.competitor_name.trim()) return alert("Nombre requerido");
    setSaving(true);
    try {
      await createCompetitor(bs.id, form);
      setModal(false);
      setForm({ competitor_name: "", threat_level: "medium", known_strengths: "", known_weaknesses: "" });
      load();
    } catch (e) { alert(e.message || "Error"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar competidor?")) return;
    try { await deleteCompetitor(id); load(); } catch (e) { alert(e.message || "Error"); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-[#6B7280]">{list.length} competidores</span>
        {editable && <button onClick={() => setModal(true)} className={btnPrimary}>+ Agregar competidor</button>}
      </div>
      {loading ? (
        <p className="text-sm text-[#6B7280]">Cargando...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-[#6B7280]">Sin competidores registrados.</p>
      ) : (
        <div className="space-y-3">
          {list.map(c => (
            <div key={c.id} className="border border-[#E5E7EB] rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-[#1F2937] text-sm">{c.competitor_name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: RF_COLORS[c.threat_level] || "#6B7280", backgroundColor: "#F3F4F6" }}>
                      {c.threat_level}
                    </span>
                  </div>
                  {c.known_strengths && <p className="text-xs text-[#16A34A] mb-1">Fortalezas: {c.known_strengths}</p>}
                  {c.known_weaknesses && <p className="text-xs text-[#DC2626]">Debilidades: {c.known_weaknesses}</p>}
                </div>
                {editable && <button onClick={() => handleDelete(c.id)} className={btnDanger}>Eliminar</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && (
        <Modal title="Agregar competidor" onClose={() => setModal(false)}>
          <Field label="Nombre" required>
            <input className={inputCls} value={form.competitor_name} onChange={e => set("competitor_name", e.target.value)} />
          </Field>
          <Field label="Nivel de amenaza">
            <select className={inputCls} value={form.threat_level} onChange={e => set("threat_level", e.target.value)}>
              <option value="low">Bajo</option>
              <option value="medium">Medio</option>
              <option value="high">Alto</option>
              <option value="critical">Crítico</option>
            </select>
          </Field>
          <Field label="Fortalezas conocidas">
            <input className={inputCls} value={form.known_strengths} onChange={e => set("known_strengths", e.target.value)} />
          </Field>
          <Field label="Debilidades conocidas">
            <input className={inputCls} value={form.known_weaknesses} onChange={e => set("known_weaknesses", e.target.value)} />
          </Field>
          <div className="flex gap-3 justify-end mt-2">
            <button onClick={() => setModal(false)} className={btnSecondary}>Cancelar</button>
            <button onClick={handleCreate} disabled={saving} className={btnPrimary}>{saving ? "Guardando..." : "Crear"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Fortalezas ─────────────────────────────────────────────────────────

function TabStrengths({ bs, editable }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ strength_category: "", strength_description: "", relevance_score: 3 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await fetchStrengths(bs.id) || []); } catch {}
    setLoading(false);
  }, [bs.id]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.strength_description.trim()) return alert("Descripción requerida");
    setSaving(true);
    try {
      await createStrength(bs.id, form);
      setModal(false);
      setForm({ strength_category: "", strength_description: "", relevance_score: 3 });
      load();
    } catch (e) { alert(e.message || "Error"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar fortaleza?")) return;
    try { await deleteStrength(id); load(); } catch (e) { alert(e.message || "Error"); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-[#6B7280]">{list.length} fortalezas</span>
        {editable && <button onClick={() => setModal(true)} className={btnPrimary}>+ Agregar fortaleza</button>}
      </div>
      {loading ? (
        <p className="text-sm text-[#6B7280]">Cargando...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-[#6B7280]">Sin fortalezas registradas.</p>
      ) : (
        <div className="space-y-3">
          {list.map(s => (
            <div key={s.id} className="border border-[#E5E7EB] rounded-xl p-4 flex justify-between items-start">
              <div className="flex-1">
                {s.strength_category && <p className="text-xs text-[#6B7280] mb-1">{s.strength_category}</p>}
                <p className="text-sm text-[#1F2937]">{s.strength_description}</p>
                <div className="flex items-center gap-1 mt-2">
                  {[1,2,3,4,5].map(n => (
                    <div key={n} className="w-4 h-4 rounded-full" style={{ backgroundColor: n <= s.relevance_score ? "#2563EB" : "#E5E7EB" }} />
                  ))}
                  <span className="text-xs text-[#6B7280] ml-1">{s.relevance_score}/5</span>
                </div>
              </div>
              {editable && <button onClick={() => handleDelete(s.id)} className={`${btnDanger} ml-4`}>Eliminar</button>}
            </div>
          ))}
        </div>
      )}
      {modal && (
        <Modal title="Agregar fortaleza" onClose={() => setModal(false)}>
          <Field label="Categoría">
            <input className={inputCls} value={form.strength_category} onChange={e => set("strength_category", e.target.value)} />
          </Field>
          <Field label="Descripción" required>
            <textarea className={textareaCls} rows={3} value={form.strength_description} onChange={e => set("strength_description", e.target.value)} />
          </Field>
          <Field label={`Relevancia: ${form.relevance_score}/5`}>
            <input type="range" min={1} max={5} step={1} className="w-full" value={form.relevance_score} onChange={e => set("relevance_score", Number(e.target.value))} />
          </Field>
          <div className="flex gap-3 justify-end mt-2">
            <button onClick={() => setModal(false)} className={btnSecondary}>Cancelar</button>
            <button onClick={handleCreate} disabled={saving} className={btnPrimary}>{saving ? "Guardando..." : "Crear"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Red Flags ───────────────────────────────────────────────────────────

function TabRedFlags({ bs, editable }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ flag_description: "", severity: "medium", mitigation_plan: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await fetchRedFlags(bs.id) || []); } catch {}
    setLoading(false);
  }, [bs.id]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.flag_description.trim()) return alert("Descripción requerida");
    setSaving(true);
    try {
      await createRedFlag(bs.id, form);
      setModal(false);
      setForm({ flag_description: "", severity: "medium", mitigation_plan: "" });
      load();
    } catch (e) { alert(e.message || "Error"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar red flag?")) return;
    try { await deleteRedFlag(id); load(); } catch (e) { alert(e.message || "Error"); }
  };

  const SEV_LABELS = { low: "Bajo", medium: "Medio", high: "Alto", critical: "Crítico" };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-[#6B7280]">{list.length} red flags</span>
        {editable && <button onClick={() => setModal(true)} className={btnPrimary}>+ Nueva red flag</button>}
      </div>
      {loading ? (
        <p className="text-sm text-[#6B7280]">Cargando...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-[#6B7280]">Sin red flags registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-[#6B7280] text-left">
                <th className="pb-2 pr-4 font-medium">Descripción</th>
                <th className="pb-2 pr-4 font-medium">Severidad</th>
                <th className="pb-2 pr-4 font-medium">Plan de mitigación</th>
                {editable && <th className="pb-2 font-medium">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {list.map(rf => (
                <tr key={rf.id} className="border-b border-[#E5E7EB] last:border-0">
                  <td className="py-2 pr-4 text-[#1F2937]">{rf.flag_description}</td>
                  <td className="py-2 pr-4">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: RF_COLORS[rf.severity] || "#6B7280", backgroundColor: "#F3F4F6" }}>
                      {SEV_LABELS[rf.severity] || rf.severity}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-[#6B7280]">{rf.mitigation_plan || "-"}</td>
                  {editable && (
                    <td className="py-2">
                      <button onClick={() => handleDelete(rf.id)} className={btnDanger}>Eliminar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <Modal title="Nueva Red Flag" onClose={() => setModal(false)}>
          <Field label="Descripción" required>
            <textarea className={textareaCls} rows={3} value={form.flag_description} onChange={e => set("flag_description", e.target.value)} />
          </Field>
          <Field label="Severidad">
            <select className={inputCls} value={form.severity} onChange={e => set("severity", e.target.value)}>
              <option value="low">Bajo</option>
              <option value="medium">Medio</option>
              <option value="high">Alto</option>
              <option value="critical">Crítico</option>
            </select>
          </Field>
          <Field label="Plan de mitigación">
            <textarea className={textareaCls} rows={3} value={form.mitigation_plan} onChange={e => set("mitigation_plan", e.target.value)} />
          </Field>
          <div className="flex gap-3 justify-end mt-2">
            <button onClick={() => setModal(false)} className={btnSecondary}>Cancelar</button>
            <button onClick={handleCreate} disabled={saving} className={btnPrimary}>{saving ? "Guardando..." : "Crear"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: Scorecard ───────────────────────────────────────────────────────────

function TabScorecard({ bs }) {
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchBlueSheetScorecard(bs.id);
      setData(d);
      const initial = {};
      (d?.answers || []).forEach(a => { initial[a.criterion_id] = a.score ?? 0; });
      setAnswers(initial);
    } catch {}
    setLoading(false);
  }, [bs.id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveBlueSheetScorecard(bs.id, answers);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { alert(e.message || "Error"); }
    setSaving(false);
  };

  const totalScore = Object.values(answers).reduce((s, v) => s + (Number(v) || 0), 0);

  if (loading) return <p className="text-sm text-[#6B7280]">Cargando...</p>;
  if (!data?.criteria?.length) return <p className="text-sm text-[#6B7280]">Sin criterios de scorecard configurados.</p>;

  return (
    <div>
      <div className="space-y-6 mb-6">
        {data.criteria.map(c => (
          <div key={c.id} className="border border-[#E5E7EB] rounded-xl p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-medium text-[#1F2937] text-sm">{c.name}</p>
                {c.description && <p className="text-xs text-[#6B7280] mt-0.5">{c.description}</p>}
              </div>
              <span className="text-lg font-semibold text-[#2563EB] min-w-[2rem] text-right">{answers[c.id] ?? 0}</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={1}
              className="w-full"
              value={answers[c.id] ?? 0}
              onChange={e => setAnswers(a => ({ ...a, [c.id]: Number(e.target.value) }))}
            />
            <div className="flex justify-between text-xs text-[#6B7280] mt-1">
              <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] mb-4">
        <span className="font-medium text-[#1F2937]">Score total</span>
        <span className="text-xl font-bold text-[#2563EB]">{totalScore} / {data.criteria.length * 5}</span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? "Guardando..." : "Guardar Scorecard"}
        </button>
        {saved && <span className="text-sm text-[#16A34A] font-medium">Guardado</span>}
      </div>
    </div>
  );
}

// ─── Tab: Acciones ────────────────────────────────────────────────────────────

function TabActions({ bs, editable }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: "", priority: "medium", due_date: "", owner_user_id: "" });
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await fetchActionItems(bs.id) || []); } catch {}
    setLoading(false);
  }, [bs.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getUsers().then((res) => setUsers(Array.isArray(res) ? res : [])).catch(() => setUsers([]));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.title.trim()) return alert("Título requerido");
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.owner_user_id) delete payload.owner_user_id;
      if (!payload.due_date) delete payload.due_date;
      await createActionItem(bs.id, payload);
      setModal(false);
      setForm({ title: "", priority: "medium", due_date: "", owner_user_id: "" });
      load();
    } catch (e) { alert(e.message || "Error"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar acción?")) return;
    try { await deleteActionItem(id); load(); } catch (e) { alert(e.message || "Error"); }
  };

  const PRI_COLORS = { low: "#6B7280", medium: "#D97706", high: "#DC2626", urgent: "#7C3AED" };
  const PRI_LABELS = { low: "Bajo", medium: "Medio", high: "Alto", urgent: "Urgente" };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-[#6B7280]">{list.length} acciones</span>
        {editable && <button onClick={() => setModal(true)} className={btnPrimary}>+ Nueva acción</button>}
      </div>
      {loading ? (
        <p className="text-sm text-[#6B7280]">Cargando...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-[#6B7280]">Sin acciones registradas.</p>
      ) : (
        <div className="space-y-3">
          {list.map(a => (
            <div key={a.id} className="border border-[#E5E7EB] rounded-xl p-4 flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-[#1F2937] text-sm">{a.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: PRI_COLORS[a.priority] || "#6B7280", backgroundColor: "#F3F4F6" }}>
                    {PRI_LABELS[a.priority] || a.priority}
                  </span>
                </div>
                {a.due_date && (
                  <p className="text-xs text-[#6B7280]">Vence: {new Date(a.due_date).toLocaleDateString("es-PE")}</p>
                )}
              </div>
              {editable && <button onClick={() => handleDelete(a.id)} className={`${btnDanger} ml-4`}>Eliminar</button>}
            </div>
          ))}
        </div>
      )}
      {modal && (
        <Modal title="Nueva acción" onClose={() => setModal(false)}>
          <Field label="Título" required>
            <input className={inputCls} value={form.title} onChange={e => set("title", e.target.value)} />
          </Field>
          <Field label="Prioridad">
            <select className={inputCls} value={form.priority} onChange={e => set("priority", e.target.value)}>
              <option value="low">Bajo</option>
              <option value="medium">Medio</option>
              <option value="high">Alto</option>
              <option value="urgent">Urgente</option>
            </select>
          </Field>
          <Field label="Fecha límite">
            <input type="date" className={inputCls} value={form.due_date} onChange={e => set("due_date", e.target.value)} />
          </Field>
          <Field label="Usuario responsable">
            <select className={inputCls} value={form.owner_user_id} onChange={e => set("owner_user_id", e.target.value)}>
              <option value="">(opcional)</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.fullname || u.email}</option>
              ))}
            </select>
          </Field>
          <div className="flex gap-3 justify-end mt-2">
            <button onClick={() => setModal(false)} className={btnSecondary}>Cancelar</button>
            <button onClick={handleCreate} disabled={saving} className={btnPrimary}>{saving ? "Guardando..." : "Crear"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BlueSheetPage() {
  const { opportunityId } = useParams();
  const [opp, setOpp] = useState(null);
  const [bs, setBs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, b] = await Promise.allSettled([
        fetchOpportunityById(opportunityId),
        fetchBlueSheetByOpportunity(opportunityId),
      ]);
      if (o.status === "fulfilled") setOpp(o.value);
      if (b.status === "fulfilled") setBs(b.value);
    } catch (e) {
      setError(e.message || "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const newBs = await createBlueSheet(opportunityId, {});
      setBs(newBs);
    } catch (e) {
      alert(e.message || "Error al crear Blue Sheet");
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (action, ...args) => {
    setActionLoading(true);
    try {
      let result;
      if (action === "submit") result = await submitBlueSheet(bs.id);
      else if (action === "approve") result = await approveBlueSheet(bs.id, {});
      else if (action === "observe") result = await observeBlueSheet(bs.id, {});
      else if (action === "reopen") result = await reopenBlueSheet(bs.id, {});
      if (result) setBs(result);
      else await load();
    } catch (e) {
      alert(e.message || "Error");
    } finally {
      setActionLoading(false);
    }
  };

  const editable = bs && EDITABLE_STATUSES.includes(bs.status);
  const status = bs?.status;

  const canSubmit = bs && ["draft","in_progress","needs_update","observed"].includes(status);
  const canApproveObserve = bs && ["ready_for_review","observed"].includes(status);
  const canReopen = bs && ["approved","observed"].includes(status);

  if (loading) {
    return (
      <div className="p-6 bg-[#F9FAFB] min-h-full flex items-center justify-center">
        <p className="text-sm text-[#6B7280]">Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-[#F9FAFB] min-h-full">
        <p className="text-sm text-[#DC2626]">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#F9FAFB] min-h-full">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[#6B7280] mb-6">
        <Link to="/dashboard/crm-fam/opportunities" className="hover:text-[#2563EB]">Oportunidades</Link>
        <span>/</span>
        {opp && (
          <>
            <Link to={`/dashboard/crm-fam/opportunities/${opportunityId}`} className="hover:text-[#2563EB]">
              {opp.name || `Oportunidad #${opportunityId}`}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-[#1F2937] font-medium">Blue Sheet</span>
      </nav>

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#1E293B]">
            {opp?.name || `Oportunidad #${opportunityId}`}
          </h1>
          {bs && (
            <p className="text-sm text-[#6B7280] mt-0.5">Blue Sheet #{bs.id}</p>
          )}
        </div>
        {bs && (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={bs.status} />
            {canSubmit && (
              <button
                onClick={() => handleAction("submit")}
                disabled={actionLoading}
                className={btnPrimary}
              >
                Enviar para revisión
              </button>
            )}
            {canApproveObserve && (
              <>
                <button onClick={() => handleAction("approve")} disabled={actionLoading} className="px-4 py-2 rounded-xl text-sm font-medium bg-[#16A34A] text-white hover:bg-[#15803D] disabled:opacity-50">
                  Aprobar
                </button>
                <button onClick={() => handleAction("observe")} disabled={actionLoading} className="px-4 py-2 rounded-xl text-sm font-medium bg-[#FEF3C7] text-[#D97706] hover:bg-[#FDE68A] disabled:opacity-50">
                  Observar
                </button>
              </>
            )}
            {canReopen && (
              <button onClick={() => handleAction("reopen")} disabled={actionLoading} className={btnSecondary}>
                Reabrir
              </button>
            )}
          </div>
        )}
      </header>

      {/* No BS yet */}
      {!bs && (
        <div className="border border-dashed border-[#E5E7EB] rounded-2xl p-12 text-center">
          <p className="text-[#6B7280] mb-4">No hay Blue Sheet para esta oportunidad.</p>
          <button onClick={handleCreate} disabled={creating} className={btnPrimary}>
            {creating ? "Creando..." : "Crear Blue Sheet"}
          </button>
        </div>
      )}

      {/* BS content */}
      {bs && (
        <>
          <CompletionBar value={bs.completeness_score || 0} />

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-[#E5E7EB] overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === t.key
                    ? "border-[#2563EB] text-[#2563EB]"
                    : "border-transparent text-[#6B7280] hover:text-[#1F2937]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
            {activeTab === "general" && (
              <TabGeneral bs={bs} editable={editable} onSaved={load} />
            )}
            {activeTab === "buyers" && (
              <TabBuyers bs={bs} editable={editable} />
            )}
            {activeTab === "results" && (
              <TabResults bs={bs} editable={editable} />
            )}
            {activeTab === "competitors" && (
              <TabCompetitors bs={bs} editable={editable} />
            )}
            {activeTab === "strengths" && (
              <TabStrengths bs={bs} editable={editable} />
            )}
            {activeTab === "redflags" && (
              <TabRedFlags bs={bs} editable={editable} />
            )}
            {activeTab === "scorecard" && (
              <TabScorecard bs={bs} />
            )}
            {activeTab === "actions" && (
              <TabActions bs={bs} editable={editable} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
