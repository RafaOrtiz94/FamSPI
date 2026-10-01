import { useState, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useOpportunity } from "../hooks/useCrmOpportunities";
import {
  fetchPipelineStages,
  fetchLostReasons,
  closeOpportunityWon,
  closeOpportunityLost,
  changeOpportunityStage,
  suspendOpportunity,
} from "../../../core/api/crmFamApi";
import {
  createProjectFromOpportunity,
  fetchWorkspaces,
} from "../../../core/api/workManagementApi";

const HEALTH_COLORS = {
  gray:   { bg: "#F3F4F6", text: "#6B7280", label: "Sin Blue Sheet" },
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

function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-white border border-[#E5E7EB] rounded-2xl p-5 ${className}`}>
      {title && <h3 className="text-sm font-semibold text-[#1E293B] mb-3">{title}</h3>}
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[#6B7280]">{label}</span>
      <span className="text-sm text-[#1F2937]">{value ?? "—"}</span>
    </div>
  );
}

function fmt(val) { return val ?? "—"; }

function fmtMoney(val) {
  if (val == null || val === "") return "—";
  return Number(val).toLocaleString("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 0 });
}

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("es-PE");
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// --- Modals ---

function ModalWon({ opp, onClose, onDone }) {
  const [form, setForm] = useState({
    won_amount: opp?.estimated_amount ?? "",
    actual_close_date: todayISO(),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const handle = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await closeOpportunityWon(opp.id, {
        won_amount: Number(form.won_amount),
        actual_close_date: form.actual_close_date,
      });
      onDone();
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Cerrar como Ganada" onClose={onClose}>
      <form onSubmit={handle} className="flex flex-col gap-3">
        <div>
          <label className="block text-sm font-medium text-[#1F2937] mb-1">Monto ganado</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.won_amount}
            onChange={e => setForm(f => ({ ...f, won_amount: e.target.value }))}
            className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1F2937] mb-1">Fecha de cierre real</label>
          <input
            type="date"
            value={form.actual_close_date}
            onChange={e => setForm(f => ({ ...f, actual_close_date: e.target.value }))}
            className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>
        <ModalActions onClose={onClose} saving={saving} err={err} label="Confirmar" />
      </form>
    </ModalShell>
  );
}

function ModalLost({ opp, onClose, onDone }) {
  const [reasons, setReasons] = useState([]);
  const [form, setForm] = useState({ lost_reason_id: "", lost_reason_detail: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetchLostReasons()
      .then(r => setReasons(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, []);

  const handle = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const payload = { ...form };
      if (!payload.lost_reason_id) delete payload.lost_reason_id;
      await closeOpportunityLost(opp.id, payload);
      onDone();
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Cerrar como Perdida" onClose={onClose}>
      <form onSubmit={handle} className="flex flex-col gap-3">
        <div>
          <label className="block text-sm font-medium text-[#1F2937] mb-1">Razon de perdida</label>
          <select
            value={form.lost_reason_id}
            onChange={e => setForm(f => ({ ...f, lost_reason_id: e.target.value }))}
            className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="">Seleccionar...</option>
            {reasons.map(r => (
              <option key={r.id} value={r.id}>{r.name ?? r.reason ?? r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1F2937] mb-1">Detalle</label>
          <textarea
            value={form.lost_reason_detail}
            onChange={e => setForm(f => ({ ...f, lost_reason_detail: e.target.value }))}
            rows={3}
            className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none"
          />
        </div>
        <ModalActions onClose={onClose} saving={saving} err={err} label="Confirmar" />
      </form>
    </ModalShell>
  );
}

function ModalStage({ opp, onClose, onDone }) {
  const [stages, setStages] = useState([]);
  const [stageId, setStageId] = useState(opp?.stage_id ?? "");
  const [warning, setWarning] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetchPipelineStages()
      .then(s => setStages(Array.isArray(s) ? s : []))
      .catch(() => {});
  }, []);

  const handle = async (e) => {
    e.preventDefault();
    if (!stageId) return;
    setSaving(true);
    setErr(null);
    setWarning(null);
    try {
      const res = await changeOpportunityStage(opp.id, { stage_id: stageId });
      if (res?.warning) setWarning(res.warning);
      onDone();
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Cambiar etapa" onClose={onClose}>
      <form onSubmit={handle} className="flex flex-col gap-3">
        <div>
          <label className="block text-sm font-medium text-[#1F2937] mb-1">Etapa</label>
          <select
            value={stageId}
            onChange={e => setStageId(e.target.value)}
            className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="">Seleccionar...</option>
            {stages.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        {warning && (
          <p className="text-sm text-[#D97706] bg-[#FEF3C7] px-3 py-2 rounded-xl">{warning}</p>
        )}
        <ModalActions onClose={onClose} saving={saving} err={err} label="Cambiar" />
      </form>
    </ModalShell>
  );
}

function ModalSuspend({ opp, onClose, onDone }) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const handle = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await suspendOpportunity(opp.id, { notes });
      onDone();
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Suspender oportunidad" onClose={onClose}>
      <form onSubmit={handle} className="flex flex-col gap-3">
        <div>
          <label className="block text-sm font-medium text-[#1F2937] mb-1">Notas</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none"
          />
        </div>
        <ModalActions onClose={onClose} saving={saving} err={err} label="Suspender" />
      </form>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] w-full max-w-md p-6 shadow-none max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ModalCreateWorkProject({ opp, onClose, onDone }) {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState({
    workspace_id: "",
    name: `WM · ${opp?.name || ""}`,
    description: opp?.description || "",
    priority: "medium",
    status: "draft",
    default_board_name: "Seguimiento comercial",
  });

  useEffect(() => {
    let cancelled = false;
    fetchWorkspaces()
      .then((rows) => {
        if (cancelled) return;
        const nextRows = Array.isArray(rows) ? rows : [];
        setWorkspaces(nextRows);
        setForm((current) => ({
          ...current,
          workspace_id: current.workspace_id || nextRows[0]?.id || "",
        }));
      })
      .catch((error) => {
        if (!cancelled) {
          setErr(error?.message || "No se pudieron cargar los workspaces.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handle = async (event) => {
    event.preventDefault();
    if (!form.workspace_id) {
      setErr("Selecciona un workspace para continuar.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const project = await createProjectFromOpportunity(opp.id, form);
      onDone();
      navigate(`/dashboard/work-management/projects/${project.id}`);
    } catch (error) {
      const backendMessage = error?.response?.data?.message || error?.message || "No se pudo crear el proyecto.";
      setErr(backendMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Crear proyecto en Work Management" onClose={onClose}>
      <form onSubmit={handle} className="flex flex-col gap-3">
        {loading ? (
          <div className="space-y-2">
            <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : (
          <>
            {!workspaces.length ? (
              <p className="rounded-xl bg-[#FEF3C7] px-3 py-2 text-sm text-[#92400E]">
                No tienes workspaces disponibles. Crea uno primero en Work Management.
              </p>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-[#1F2937] mb-1">Workspace</label>
              <select
                value={form.workspace_id}
                onChange={(e) => setForm((current) => ({ ...current, workspace_id: e.target.value }))}
                className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1F2937] mb-1">Nombre del proyecto</label>
              <input
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1F2937] mb-1">Descripcion</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                rows={3}
                className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-[#1F2937] mb-1">Prioridad</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((current) => ({ ...current, priority: e.target.value }))}
                  className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Critica</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1F2937] mb-1">Estado inicial</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))}
                  className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Activo</option>
                </select>
              </div>
            </div>
          </>
        )}

        <ModalActions
          onClose={onClose}
          saving={saving}
          err={err}
          label="Crear proyecto"
        />
      </form>
    </ModalShell>
  );
}

function ModalActions({ onClose, saving, err, label }) {
  return (
    <>
      {err && <p className="text-sm text-[#DC2626]">{err}</p>}
      <div className="flex justify-end gap-3 mt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm border border-[#E5E7EB] rounded-xl text-[#1F2937] hover:bg-[#334155]/5 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-[#2563EB] text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando..." : label}
        </button>
      </div>
    </>
  );
}

// --- Main page ---

export default function OpportunityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: opp, loading, error, refresh } = useOpportunity(id);

  const [modal, setModal] = useState(null); // 'won' | 'lost' | 'stage' | 'suspend'

  const closeModal = useCallback(() => setModal(null), []);
  const handleDone = useCallback(() => { setModal(null); refresh(); }, [refresh]);

  if (loading) {
    return (
      <div className="p-6 bg-[#F9FAFB] min-h-full">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-40 bg-gray-200 rounded-2xl" />
          <div className="h-40 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="p-6 bg-[#F9FAFB] min-h-full">
        <div className="px-4 py-3 bg-[#FEE2E2] border border-[#DC2626] text-[#DC2626] rounded-xl text-sm">
          {error ?? "Oportunidad no encontrada"}
        </div>
        <button
          onClick={() => navigate("/dashboard/crm-fam/opportunities")}
          className="mt-4 text-sm text-[#2563EB] hover:underline"
        >
          Volver a oportunidades
        </button>
      </div>
    );
  }

  const health = HEALTH_COLORS[opp.health_status] ?? HEALTH_COLORS.gray;
  const statusCfg = OPP_STATUS[opp.status] ?? OPP_STATUS.open;
  const isOpen = opp.status === "open";

  const activities = Array.isArray(opp.recent_activities) ? opp.recent_activities : [];
  const actionItems = Array.isArray(opp.open_action_items) ? opp.open_action_items : [];

  return (
    <div className="p-6 bg-[#F9FAFB] min-h-full">
      {/* Breadcrumb */}
      <nav className="text-sm text-[#6B7280] mb-5 flex items-center gap-1">
        <Link to="/dashboard/crm-fam/opportunities" className="hover:text-[#2563EB] transition-colors">
          Oportunidades
        </Link>
        <span>/</span>
        <span className="text-[#1F2937] font-medium">{opp.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Basic data */}
          <Card title="Datos de la oportunidad">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-[#1F2937]">{opp.name}</h2>
              <Badge bg={statusCfg.bg} text={statusCfg.text} label={statusCfg.label} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cuenta" value={fmt(opp.account_name)} />
              <Field label="Monto estimado" value={fmtMoney(opp.estimated_amount)} />
              <Field label="Probabilidad" value={opp.probability != null ? `${opp.probability}%` : null} />
              <Field label="Cierre estimado" value={fmtDate(opp.estimated_close_date)} />
              <Field label="Fuente" value={fmt(opp.source)} />
              <Field label="Propietario" value={fmt(opp.owner_name)} />
            </div>
            {opp.description && (
              <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                <p className="text-xs text-[#6B7280] mb-1">Descripcion</p>
                <p className="text-sm text-[#1F2937]">{opp.description}</p>
              </div>
            )}
          </Card>

          {/* Stage + actions */}
          <Card title="Etapa y acciones">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-medium text-[#1F2937]">
                {opp.stage_name ?? "Sin etapa"}
              </span>
              {opp.probability != null && (
                <span className="text-sm text-[#6B7280]">— {opp.probability}% probabilidad</span>
              )}
            </div>
            {isOpen ? (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setModal("stage")}
                  className="px-3 py-2 text-sm border border-[#E5E7EB] rounded-xl text-[#1F2937] hover:bg-[#334155]/5 transition-colors"
                >
                  Cambiar etapa
                </button>
                <button
                  onClick={() => setModal("won")}
                  className="px-3 py-2 text-sm bg-[#DCFCE7] text-[#16A34A] rounded-xl hover:bg-green-200 transition-colors font-medium"
                >
                  Cerrar Ganada
                </button>
                <button
                  onClick={() => setModal("lost")}
                  className="px-3 py-2 text-sm bg-[#FEE2E2] text-[#DC2626] rounded-xl hover:bg-red-200 transition-colors font-medium"
                >
                  Cerrar Perdida
                </button>
                <button
                  onClick={() => setModal("suspend")}
                  className="px-3 py-2 text-sm bg-[#F3F4F6] text-[#6B7280] rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Suspender
                </button>
              </div>
            ) : (
              <p className="text-sm text-[#6B7280]">Estado: {statusCfg.label}. No disponible acciones de cierre.</p>
            )}
            <div className="mt-3">
              <button
                onClick={() => setModal("work-project")}
                className="px-3 py-2 text-sm border border-[#2563EB] text-[#2563EB] rounded-xl hover:bg-[#EFF6FF] transition-colors font-medium"
              >
                Crear proyecto WM
              </button>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Health + Blue Sheet */}
          <Card title="Salud del negocio">
            <div className="flex items-center gap-3 mb-4">
              <Badge bg={health.bg} text={health.text} label={health.label} />
              {opp.health_score != null && (
                <span className="text-sm text-[#6B7280]">{opp.health_score} pts</span>
              )}
            </div>
            <Link
              to={`/dashboard/crm-fam/opportunities/${id}/blue-sheet`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#2563EB] text-[#2563EB] text-sm font-medium hover:bg-[#EFF6FF] transition-colors"
            >
              {opp.health_status == null || opp.health_status === "gray"
                ? "Iniciar Blue Sheet"
                : "Ver / Seguimiento Blue Sheet"}
            </Link>
          </Card>

          {/* Recent activities */}
          <Card title="Ultimas actividades">
            {activities.length === 0 ? (
              <p className="text-sm text-[#6B7280]">Sin actividades recientes.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {activities.map((a, i) => (
                  <li key={a.id ?? i} className="text-sm text-[#1F2937] border-b border-[#E5E7EB] pb-2 last:border-0 last:pb-0">
                    <span className="font-medium">{a.activity_type ?? a.type}</span>
                    {a.subject && <span className="text-[#6B7280]"> — {a.subject}</span>}
                    {a.activity_date && (
                      <div className="text-xs text-[#6B7280] mt-0.5">{fmtDate(a.activity_date)}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Open action items */}
          <Card title="Action Items abiertos">
            {actionItems.length === 0 ? (
              <p className="text-sm text-[#6B7280]">Sin action items abiertos.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {actionItems.map((a, i) => (
                  <li key={a.id ?? i} className="text-sm text-[#1F2937] border-b border-[#E5E7EB] pb-2 last:border-0 last:pb-0">
                    <span>{a.description ?? a.title ?? a.action}</span>
                    {a.due_date && (
                      <div className="text-xs text-[#6B7280] mt-0.5">Vence: {fmtDate(a.due_date)}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Modals */}
      {modal === "won" && <ModalWon opp={opp} onClose={closeModal} onDone={handleDone} />}
      {modal === "lost" && <ModalLost opp={opp} onClose={closeModal} onDone={handleDone} />}
      {modal === "stage" && <ModalStage opp={opp} onClose={closeModal} onDone={handleDone} />}
      {modal === "suspend" && <ModalSuspend opp={opp} onClose={closeModal} onDone={handleDone} />}
      {modal === "work-project" && (
        <ModalCreateWorkProject opp={opp} onClose={closeModal} onDone={handleDone} />
      )}
    </div>
  );
}
