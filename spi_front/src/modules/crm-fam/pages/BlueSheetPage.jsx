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
  fetchBlueSheetCompleteness,
  fetchElementRedFlags,
  toggleElementRedFlag,
  fetchBlueSheetVersions,
  fetchReviewComments,
  createReviewComment,
  resolveReviewComment,
  downloadBlueSheetPdf,
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
const ELEMENT_TYPE_LABELS = {
  buying_influence: "Compradores",
  competitor: "Competidores",
  scorecard_criterion: "Scorecard",
  action_item: "Acciones",
};

const EDITABLE_STATUSES = ["draft", "in_progress", "needs_update", "observed"];

// Plantillas ligeras: solo prellenan texto inicial (objetivo/situación) para
// no arrancar de cero cada vez -- nada de IA, son 3 presets estáticos por
// tipo de venta frecuente en FAM. El usuario los edita libremente después.
const BS_TEMPLATES = {
  blank: { label: "En blanco", data: {} },
  new_client: {
    label: "Cliente nuevo",
    data: {
      sales_objective_text: "Cerrar la primera venta con este cliente y establecer una relación comercial recurrente.",
      customer_situation_current: "Cliente sin historial de compras previas con FAM. Evaluando proveedores.",
      customer_situation_desired: "Cliente convertido, con primer pedido facturado y proceso de reorden establecido.",
    },
  },
  renewal: {
    label: "Renovación / recompra",
    data: {
      sales_objective_text: "Renovar el contrato/servicio vigente antes de su vencimiento, evitando fuga a la competencia.",
      customer_situation_current: "Cliente activo con contrato o equipo próximo a vencer/renovar.",
      customer_situation_desired: "Renovación firmada con condiciones iguales o mejores, sin interrupción de servicio.",
    },
  },
  upsell: {
    label: "Expansión (upsell/cross-sell)",
    data: {
      sales_objective_text: "Ampliar el alcance actual del cliente con equipos/servicios adicionales.",
      customer_situation_current: "Cliente activo satisfecho con la solución actual, con necesidad detectada de mayor capacidad o alcance.",
      customer_situation_desired: "Cliente con la solución ampliada operando y facturada.",
    },
  },
};

const TABS = [
  { key: "general",      label: "General" },
  { key: "buyers",       label: "Compradores" },
  { key: "results",      label: "Resultados" },
  { key: "competitors",  label: "Competidores" },
  { key: "strengths",    label: "Fortalezas" },
  { key: "redflags",     label: "Red Flags" },
  { key: "scorecard",    label: "Scorecard" },
  { key: "actions",      label: "Acciones" },
  { key: "history",      label: "Historial" },
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
    <div className="mb-3">
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

// Checklist visual de completitud -- antes solo se veia el % numerico
// (CompletionBar) sin saber que faltaba. Se apoya en el mismo desglose que
// ya usa el backend para calcular el score (crm.calculators.js#getCompletenessBreakdown),
// asi que nunca puede desincronizarse del numero real.
function CompletenessChecklist({ blueSheetId, fallbackScore, onJumpToTab }) {
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!blueSheetId) return;
    setLoading(true);
    fetchBlueSheetCompleteness(blueSheetId)
      .then((res) => setBreakdown(res))
      .catch(() => setBreakdown(null))
      .finally(() => setLoading(false));
  }, [blueSheetId]);

  const score = breakdown?.completeness_score ?? fallbackScore ?? 0;
  const items = Array.isArray(breakdown?.checklist) ? breakdown.checklist : [];
  const pendingCount = items.filter((i) => !i.met).length;

  return (
    <div className="mb-6">
      <CompletionBar value={score} />
      {!loading && items.length > 0 && onJumpToTab && (
        <NextBestActions items={items} onJump={onJumpToTab} />
      )}
      {!loading && items.length > 0 && (
        <div className="rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors text-left"
          >
            <span className="text-xs font-medium text-[#1F2937]">
              {pendingCount === 0 ? "Todos los criterios cumplidos" : `${pendingCount} criterio${pendingCount === 1 ? "" : "s"} pendiente${pendingCount === 1 ? "" : "s"}`}
            </span>
            <span className="text-xs text-[#2563EB] font-medium">{expanded ? "Ocultar" : "Ver detalle"}</span>
          </button>
          {expanded && (
            <ul className="divide-y divide-[#F1F5F9]">
              {items.map((item) => (
                <li key={item.key} className="flex items-center gap-2.5 px-4 py-2 text-sm">
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      item.met ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#F3F4F6] text-[#9CA3AF]"
                    }`}
                  >
                    {item.met ? "✓" : ""}
                  </span>
                  <span className={item.met ? "text-[#1F2937]" : "text-[#6B7280]"}>{item.label}</span>
                  <span className="ml-auto text-[10px] text-[#9CA3AF]">{item.points} pts</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Siguiente mejor acción: convierte los criterios de completitud aún NO
// cumplidos (mismo desglose que ya calcula el backend) en una lista corta y
// priorizada por puntos -- para que el usuario sepa exactamente qué hacer
// primero en vez de solo ver "68%" sin contexto accionable. Sin IA: es una
// reordenación determinística de datos que ya existen.
const CHECKLIST_KEY_TO_TAB = {
  sales_objective: "general", situation_current: "general", situation_desired: "general",
  buying_process: "general", strategy_summary: "general",
  economic_buyer: "buyers", coach: "buyers",
  win_results: "results",
  competitors: "competitors",
  strengths: "strengths",
  scorecard: "scorecard",
};

function NextBestActions({ items, onJump }) {
  const pending = items.filter((i) => !i.met).sort((a, b) => b.points - a.points).slice(0, 3);
  if (pending.length === 0) return null;
  return (
    <div className="mb-6 border border-[#BFDBFE] bg-[#EFF6FF] rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-[#1E3A8A] mb-2">Siguiente mejor acción</h3>
      <ul className="space-y-2">
        {pending.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[#1E3A8A]">{item.label} <span className="text-xs text-[#60A5FA]">(+{item.points} pts)</span></span>
            {CHECKLIST_KEY_TO_TAB[item.key] && (
              <button
                type="button"
                onClick={() => onJump(CHECKLIST_KEY_TO_TAB[item.key])}
                className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
              >
                Completar
              </button>
            )}
          </li>
        ))}
      </ul>
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

// Icono de red flag para marcar/desmarcar directamente sobre un elemento
// (comprador, competidor, criterio de scorecard, accion) -- ver
// useElementRedFlags mas abajo. "suggested" es solo para acciones vencidas:
// el sistema ya sugiere la bandera, un clic la confirma como red flag real.
function RedFlagIcon({ active, suggested, onClick, disabled, title }) {
  const stateCls = active
    ? "bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5]"
    : suggested
      ? "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]"
      : "bg-white text-[#CBD5E1] border-[#E5E7EB] hover:text-[#9CA3AF] hover:border-[#CBD5E1]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title || (active ? "Quitar red flag" : "Marcar red flag")}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${stateCls}`}
    >
      🚩
    </button>
  );
}

// Carga una sola vez (por Blue Sheet) el set de elementos que ya tienen red
// flag activa, y expone un toggle optimista compartido entre las 4 pestanas
// (Compradores, Competidores, Scorecard, Acciones) para que el estado no se
// pierda al cambiar de pestana.
function useElementRedFlags(blueSheetId) {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!blueSheetId) return;
    setLoading(true);
    try { setFlags(await fetchElementRedFlags(blueSheetId) || []); } catch { setFlags([]); }
    setLoading(false);
  }, [blueSheetId]);

  useEffect(() => { load(); }, [load]);

  const key = (type, id) => `${type}:${id}`;
  const flagsByKey = new Map(flags.map((f) => [key(f.related_entity_type, f.related_entity_id), f]));

  const isFlagged = (type, id) => flagsByKey.has(key(type, id));

  const toggle = async (type, id, label) => {
    // Optimista: refleja el cambio de inmediato, revierte si falla.
    const flaggedNow = isFlagged(type, id);
    setFlags((prev) => flaggedNow
      ? prev.filter((f) => !(f.related_entity_type === type && f.related_entity_id === id))
      : [...prev, { related_entity_type: type, related_entity_id: id, severity: "medium" }]);
    try {
      await toggleElementRedFlag(blueSheetId, { related_entity_type: type, related_entity_id: id, label });
    } catch (e) {
      setFlags((prev) => flaggedNow
        ? [...prev, { related_entity_type: type, related_entity_id: id, severity: "medium" }]
        : prev.filter((f) => !(f.related_entity_type === type && f.related_entity_id === id)));
      alert(e.message || "No se pudo actualizar la red flag");
    }
  };

  return { isFlagged, toggle, loading };
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

function TabBuyers({ bs, editable, redFlags }) {
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
                <th className="pb-2 pr-4 font-medium text-center">Red flag</th>
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
                  <td className="py-2 pr-4 text-center">
                    <RedFlagIcon
                      active={redFlags.isFlagged("buying_influence", b.id)}
                      onClick={() => redFlags.toggle("buying_influence", b.id, `Red flag en influenciador: ${b.full_name}`)}
                    />
                  </td>
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

// ─── Coverage Matrix: compradores × win-results, para ver de un vistazo a
// quién le falta "Win" personal registrado (Strategic Selling: sin Win propio
// por comprador, ese comprador no está realmente asegurado) ───────────────────

function CoverageMatrix({ buyers, results }) {
  const ROLE_SHORT = { economic_buyer: "EB", user_buyer: "UB", technical_buyer: "TB", coach: "Coach" };
  const rows = buyers.map((b) => {
    const own = results.filter((r) => r.buying_influence_id === b.id);
    return {
      buyer: b,
      hasWin: own.some((r) => r.result_type === "win"),
      hasResult: own.some((r) => r.result_type === "result"),
      count: own.length,
    };
  });
  const covered = rows.filter((r) => r.hasWin).length;
  const pct = rows.length ? Math.round((covered / rows.length) * 100) : 0;
  const gaps = rows.filter((r) => !r.hasWin);

  return (
    <div className="mb-5 border border-[#E5E7EB] rounded-xl p-4 bg-[#F9FAFB]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#1F2937]">Matriz de cobertura</h3>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ color: pct >= 75 ? "#15803D" : pct >= 40 ? "#D97706" : "#DC2626", backgroundColor: pct >= 75 ? "#DCFCE7" : pct >= 40 ? "#FEF3C7" : "#FEE2E2" }}
        >
          {covered}/{rows.length} compradores con Win propio ({pct}%)
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[#6B7280]">
              <th className="pb-1 pr-3 font-medium">Comprador</th>
              <th className="pb-1 pr-3 font-medium">Rol</th>
              <th className="pb-1 pr-3 font-medium text-center">Win</th>
              <th className="pb-1 pr-3 font-medium text-center">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.buyer.id} className="border-t border-[#E5E7EB]">
                <td className="py-1.5 pr-3 text-[#1F2937]">{r.buyer.full_name}</td>
                <td className="py-1.5 pr-3 text-[#6B7280]">{ROLE_SHORT[r.buyer.influence_role] || r.buyer.influence_role}</td>
                <td className="py-1.5 pr-3 text-center">{r.hasWin ? <span className="text-[#16A34A]">✓</span> : <span className="text-[#DC2626]">✗</span>}</td>
                <td className="py-1.5 pr-3 text-center">{r.hasResult ? <span className="text-[#16A34A]">✓</span> : <span className="text-[#9CA3AF]">–</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {gaps.length > 0 && (
        <p className="text-xs text-[#D97706] mt-2">
          Sin Win registrado: {gaps.map((g) => g.buyer.full_name).join(", ")}.
        </p>
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
      {buyers.length > 0 && <CoverageMatrix buyers={buyers} results={list} />}
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

function TabCompetitors({ bs, editable, redFlags }) {
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
                <div className="flex items-center gap-2 shrink-0">
                  <RedFlagIcon
                    active={redFlags.isFlagged("competitor", c.id)}
                    onClick={() => redFlags.toggle("competitor", c.id, `Competidor de riesgo: ${c.competitor_name}`)}
                  />
                  {editable && <button onClick={() => handleDelete(c.id)} className={btnDanger}>Eliminar</button>}
                </div>
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
                  <td className="py-2 pr-4 text-[#1F2937]">
                    {rf.flag_description || rf.flag_title}
                    {rf.related_entity_type && (
                      <span className="ml-2 text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wide">
                        · marcada desde {ELEMENT_TYPE_LABELS[rf.related_entity_type] || rf.related_entity_type}
                      </span>
                    )}
                  </td>
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

function TabScorecard({ bs, redFlags }) {
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
              <div className="flex items-center gap-2 shrink-0">
                <RedFlagIcon
                  active={redFlags.isFlagged("scorecard_criterion", c.id)}
                  onClick={() => redFlags.toggle("scorecard_criterion", c.id, `Respuesta baja en scorecard: ${c.name}`)}
                />
                <span className="text-lg font-semibold text-[#2563EB] min-w-[2rem] text-right">{answers[c.id] ?? 0}</span>
              </div>
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

function TabActions({ bs, editable, redFlags }) {
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
          {list.map(a => {
            const isOverdue = a.due_date
              && !["completed", "cancelled"].includes(a.status)
              && new Date(a.due_date) < new Date();
            return (
              <div key={a.id} className="border border-[#E5E7EB] rounded-xl p-4 flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[#1F2937] text-sm">{a.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: PRI_COLORS[a.priority] || "#6B7280", backgroundColor: "#F3F4F6" }}>
                      {PRI_LABELS[a.priority] || a.priority}
                    </span>
                  </div>
                  {a.due_date && (
                    <p className={`text-xs ${isOverdue ? "text-[#DC2626] font-medium" : "text-[#6B7280]"}`}>
                      Vence: {new Date(a.due_date).toLocaleDateString("es-PE")}{isOverdue ? " — vencida" : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <RedFlagIcon
                    active={redFlags.isFlagged("action_item", a.id)}
                    suggested={isOverdue && !redFlags.isFlagged("action_item", a.id)}
                    onClick={() => redFlags.toggle("action_item", a.id, `Tarea vencida: ${a.title}`)}
                    title={isOverdue && !redFlags.isFlagged("action_item", a.id) ? "Sugerida: tarea vencida — clic para confirmar red flag" : undefined}
                  />
                  {editable && <button onClick={() => handleDelete(a.id)} className={btnDanger}>Eliminar</button>}
                </div>
              </div>
            );
          })}
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

// ─── Tab: Historial (comentarios de revision + versiones) ────────────────────
// Los dos endpoints existian en el backend sin ninguna pantalla que los
// consumiera -- version_history (snapshot en cada aprobacion) y los
// comentarios que un manager deja al observar. Se agrupan en una sola
// pestana porque conceptualmente son "que paso con este Blue Sheet".
const REVIEW_SEVERITY_COLORS = { info: "#6B7280", low: "#6B7280", medium: "#D97706", high: "#DC2626" };

function TabHistory({ bs, editable }) {
  const [comments, setComments] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState({ section_name: "", comment_text: "" });
  const [posting, setPosting] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, v] = await Promise.all([
        fetchReviewComments(bs.id).catch(() => []),
        fetchBlueSheetVersions(bs.id).catch(() => []),
      ]);
      setComments(Array.isArray(c) ? c : []);
      setVersions(Array.isArray(v) ? v : []);
    } finally {
      setLoading(false);
    }
  }, [bs.id]);

  useEffect(() => { load(); }, [load]);

  const handlePostComment = async () => {
    if (!newComment.comment_text.trim()) return;
    setPosting(true);
    try {
      await createReviewComment(bs.id, { ...newComment, section_name: newComment.section_name || null });
      setNewComment({ section_name: "", comment_text: "" });
      load();
    } catch (e) { alert(e.message || "Error"); }
    setPosting(false);
  };

  const handleResolve = async (id) => {
    setResolvingId(id);
    try { await resolveReviewComment(bs.id, id); load(); } catch (e) { alert(e.message || "Error"); }
    setResolvingId(null);
  };

  if (loading) return <p className="text-sm text-[#6B7280]">Cargando...</p>;

  const pendingComments = comments.filter((c) => !c.is_resolved);
  const resolvedComments = comments.filter((c) => c.is_resolved);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#1F2937]">Comentarios de revisión</h3>
          <span className="text-xs text-[#6B7280]">{pendingComments.length} pendiente{pendingComments.length === 1 ? "" : "s"}</span>
        </div>

        {editable && (
          <div className="border border-[#E5E7EB] rounded-xl p-3 mb-4">
            <div className="flex gap-2 mb-2">
              <select
                className={`${inputCls} max-w-[200px]`}
                value={newComment.section_name}
                onChange={(e) => setNewComment((c) => ({ ...c, section_name: e.target.value }))}
              >
                {COMMENT_SECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <textarea
              className={textareaCls}
              rows={2}
              placeholder="Deja una nota sobre esta sección (visible para todo el equipo, sin necesidad de observar todo el Blue Sheet)"
              value={newComment.comment_text}
              onChange={(e) => setNewComment((c) => ({ ...c, comment_text: e.target.value }))}
            />
            <div className="flex justify-end mt-2">
              <button onClick={handlePostComment} disabled={posting || !newComment.comment_text.trim()} className={btnPrimary}>
                {posting ? "Guardando..." : "Comentar"}
              </button>
            </div>
          </div>
        )}

        {comments.length === 0 ? (
          <p className="text-sm text-[#6B7280]">Sin comentarios registrados.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {[...pendingComments, ...resolvedComments].map((c) => (
              <div key={c.id} className={`border rounded-xl p-3 ${c.is_resolved ? "border-[#E5E7EB] opacity-60" : "border-[#FDE68A] bg-[#FFFBEB]"}`}>
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {c.section_name && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                          {COMMENT_SECTION_OPTIONS.find((o) => o.value === c.section_name)?.label || c.section_name}
                        </span>
                      )}
                      <span className="text-xs font-medium" style={{ color: REVIEW_SEVERITY_COLORS[c.severity] || "#6B7280" }}>
                        {c.severity}
                      </span>
                      {c.requires_correction && !c.is_resolved && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#DC2626]">Requiere corrección</span>
                      )}
                      {c.is_resolved && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#16A34A]">Resuelto</span>
                      )}
                    </div>
                    <p className="text-sm text-[#1F2937]">{c.comment_text}</p>
                    <p className="text-xs text-[#9CA3AF] mt-1">
                      {c.created_by_name || "—"} · {new Date(c.created_at).toLocaleDateString("es-EC")}
                    </p>
                  </div>
                  {!c.is_resolved && editable && (
                    <button onClick={() => handleResolve(c.id)} disabled={resolvingId === c.id} className={`${btnSecondary} shrink-0`}>
                      {resolvingId === c.id ? "..." : "Marcar resuelto"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[#1F2937] mb-3">Historial de versiones</h3>
        {versions.length === 0 ? (
          <p className="text-sm text-[#6B7280]">Aún no hay versiones aprobadas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-[#6B7280] text-left">
                  <th className="pb-2 pr-4 font-medium">Versión</th>
                  <th className="pb-2 pr-4 font-medium">Motivo</th>
                  <th className="pb-2 pr-4 font-medium">Por</th>
                  <th className="pb-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id} className="border-b border-[#E5E7EB] last:border-0">
                    <td className="py-2 pr-4 font-medium text-[#1F2937]">v{v.version_number}</td>
                    <td className="py-2 pr-4 text-[#6B7280]">{v.reason || "-"}</td>
                    <td className="py-2 pr-4 text-[#6B7280]">{v.created_by_name || "—"}</td>
                    <td className="py-2 text-[#6B7280]">{new Date(v.created_at).toLocaleDateString("es-EC")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal: Aprobar / Observar / Reabrir con motivo real ──────────────────────
// Antes estos 3 botones mandaban {} siempre -- el backend ya guarda el motivo
// (approval_notes, crm_review_comments por seccion, reopen_reason) pero nadie
// lo escribia nunca, asi que el comercial jamas veia por que se observo o
// reabrio su Blue Sheet.
const COMMENT_SECTION_OPTIONS = [
  { value: "", label: "General (sin sección)" },
  { value: "general", label: "General" },
  { value: "buyers", label: "Compradores" },
  { value: "results", label: "Resultados" },
  { value: "competitors", label: "Competidores" },
  { value: "strengths", label: "Fortalezas" },
  { value: "scorecard", label: "Scorecard" },
  { value: "actions", label: "Acciones" },
];

function emptyComment() {
  return { section_name: "", comment_text: "", severity: "medium", requires_correction: false };
}

function ReviewActionModal({ action, onClose, onSubmit, busy }) {
  const [notes, setNotes] = useState("");
  const [comments, setComments] = useState([emptyComment()]);

  const titles = { approve: "Aprobar Blue Sheet", observe: "Observar Blue Sheet", reopen: "Reabrir Blue Sheet" };
  const submitLabels = { approve: "Aprobar", observe: "Observar", reopen: "Reabrir" };

  const setCommentField = (idx, field, value) => {
    setComments((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };
  const addComment = () => setComments((prev) => [...prev, emptyComment()]);
  const removeComment = (idx) => setComments((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    if (action === "observe") {
      const valid = comments.filter((c) => c.comment_text.trim());
      if (!valid.length) return alert("Escribe al menos un comentario explicando qué falta corregir.");
      onSubmit({ comments: valid.map((c) => ({ ...c, section_name: c.section_name || null })) });
    } else if (action === "approve") {
      onSubmit({ notes: notes.trim() || null });
    } else if (action === "reopen") {
      if (!notes.trim()) return alert("Escribe el motivo de la reapertura.");
      onSubmit({ reason: notes.trim() });
    }
  };

  return (
    <Modal title={titles[action]} onClose={onClose}>
      {action === "observe" ? (
        <div>
          <p className="text-sm text-[#6B7280] mb-4">
            El comercial verá cada comentario junto a la sección que corresponde cuando vuelva a abrir este Blue Sheet.
          </p>
          <div className="flex flex-col gap-4 mb-4">
            {comments.map((c, idx) => (
              <div key={idx} className="border border-[#E5E7EB] rounded-xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Comentario {idx + 1}</span>
                  {comments.length > 1 && (
                    <button onClick={() => removeComment(idx)} className="text-xs text-[#DC2626] hover:underline">Quitar</button>
                  )}
                </div>
                <Field label="Sección">
                  <select className={inputCls} value={c.section_name} onChange={(e) => setCommentField(idx, "section_name", e.target.value)}>
                    {COMMENT_SECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Comentario" required>
                  <textarea className={textareaCls} rows={2} value={c.comment_text} onChange={(e) => setCommentField(idx, "comment_text", e.target.value)} />
                </Field>
                <div className="flex items-center gap-4">
                  <Field label="Severidad">
                    <select className={inputCls} value={c.severity} onChange={(e) => setCommentField(idx, "severity", e.target.value)}>
                      <option value="low">Bajo</option>
                      <option value="medium">Medio</option>
                      <option value="high">Alto</option>
                    </select>
                  </Field>
                  <label className="flex items-center gap-2 text-sm text-[#1F2937] mb-4">
                    <input type="checkbox" checked={c.requires_correction} onChange={(e) => setCommentField(idx, "requires_correction", e.target.checked)} />
                    Requiere corrección
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addComment} className={`${btnSecondary} mb-4`}>+ Otro comentario</button>
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className={btnSecondary}>Cancelar</button>
            <button onClick={handleSubmit} disabled={busy} className={btnPrimary}>{busy ? "Guardando..." : submitLabels[action]}</button>
          </div>
        </div>
      ) : (
        <div>
          <Field label={action === "reopen" ? "Motivo de la reapertura" : "Nota de aprobación (opcional)"} required={action === "reopen"}>
            <textarea className={textareaCls} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="flex gap-3 justify-end mt-2">
            <button onClick={onClose} className={btnSecondary}>Cancelar</button>
            <button onClick={handleSubmit} disabled={busy} className={btnPrimary}>{busy ? "Guardando..." : submitLabels[action]}</button>
          </div>
        </div>
      )}
    </Modal>
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
  const [template, setTemplate] = useState("blank");
  const [activeTab, setActiveTab] = useState("general");
  const [actionLoading, setActionLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const elementRedFlags = useElementRedFlags(bs?.id);

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
      const newBs = await createBlueSheet(opportunityId, BS_TEMPLATES[template]?.data || {});
      setBs(newBs);
    } catch (e) {
      alert(e.message || "Error al crear Blue Sheet");
    } finally {
      setCreating(false);
    }
  };

  const [reviewModal, setReviewModal] = useState(null); // 'approve' | 'observe' | 'reopen' | null

  const handleAction = async (action, payload = {}) => {
    setActionLoading(true);
    try {
      let result;
      if (action === "submit") result = await submitBlueSheet(bs.id);
      else if (action === "approve") result = await approveBlueSheet(bs.id, payload);
      else if (action === "observe") result = await observeBlueSheet(bs.id, payload);
      else if (action === "reopen") result = await reopenBlueSheet(bs.id, payload);
      if (result) setBs(result);
      else await load();
      setReviewModal(null);
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
            <button
              onClick={async () => {
                setPdfLoading(true);
                try { await downloadBlueSheetPdf(bs.id); } catch { /* noop: fallo silencioso, no bloquea la vista */ }
                setPdfLoading(false);
              }}
              disabled={pdfLoading}
              className={btnSecondary}
            >
              {pdfLoading ? "Generando…" : "Descargar PDF"}
            </button>
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
                <button onClick={() => setReviewModal("approve")} disabled={actionLoading} className="px-4 py-2 rounded-xl text-sm font-medium bg-[#16A34A] text-white hover:bg-[#15803D] disabled:opacity-50">
                  Aprobar
                </button>
                <button onClick={() => setReviewModal("observe")} disabled={actionLoading} className="px-4 py-2 rounded-xl text-sm font-medium bg-[#FEF3C7] text-[#D97706] hover:bg-[#FDE68A] disabled:opacity-50">
                  Observar
                </button>
              </>
            )}
            {canReopen && (
              <button onClick={() => setReviewModal("reopen")} disabled={actionLoading} className={btnSecondary}>
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
          <div className="flex flex-col items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[#6B7280]">
              Plantilla inicial
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-[#1F2937] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                {Object.entries(BS_TEMPLATES).map(([key, t]) => (
                  <option key={key} value={key}>{t.label}</option>
                ))}
              </select>
            </label>
            <button onClick={handleCreate} disabled={creating} className={btnPrimary}>
              {creating ? "Creando..." : "Crear Blue Sheet"}
            </button>
          </div>
        </div>
      )}

      {/* BS content */}
      {bs && (
        <>
          {bs.status === "needs_update" && bs.reopen_reason && (
            <div className="mb-4 px-4 py-3 bg-[#FEE2E2] border border-[#DC2626] text-[#991B1B] rounded-xl text-sm">
              <b>Motivo de la reapertura:</b> {bs.reopen_reason}
            </div>
          )}
          {bs.status === "observed" && (
            <div className="mb-4 px-4 py-3 bg-[#FEF3C7] border border-[#D97706] text-[#92400E] rounded-xl text-sm">
              Este Blue Sheet fue observado. Revisa los comentarios en la pestaña <b>Historial</b> antes de volver a enviarlo.
            </div>
          )}
          {bs.status === "approved" && bs.approval_notes && (
            <div className="mb-4 px-4 py-3 bg-[#DCFCE7] border border-[#16A34A] text-[#14532D] rounded-xl text-sm">
              <b>Nota de aprobación:</b> {bs.approval_notes}
            </div>
          )}
          <CompletenessChecklist blueSheetId={bs.id} fallbackScore={bs.completeness_score || 0} onJumpToTab={setActiveTab} />

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
              <TabBuyers bs={bs} editable={editable} redFlags={elementRedFlags} />
            )}
            {activeTab === "results" && (
              <TabResults bs={bs} editable={editable} />
            )}
            {activeTab === "competitors" && (
              <TabCompetitors bs={bs} editable={editable} redFlags={elementRedFlags} />
            )}
            {activeTab === "strengths" && (
              <TabStrengths bs={bs} editable={editable} />
            )}
            {activeTab === "redflags" && (
              <TabRedFlags bs={bs} editable={editable} />
            )}
            {activeTab === "scorecard" && (
              <TabScorecard bs={bs} redFlags={elementRedFlags} />
            )}
            {activeTab === "actions" && (
              <TabActions bs={bs} editable={editable} redFlags={elementRedFlags} />
            )}
            {activeTab === "history" && (
              <TabHistory bs={bs} editable={editable} />
            )}
          </div>
        </>
      )}

      {reviewModal && (
        <ReviewActionModal
          action={reviewModal}
          busy={actionLoading}
          onClose={() => setReviewModal(null)}
          onSubmit={(payload) => handleAction(reviewModal, payload)}
        />
      )}
    </div>
  );
}
