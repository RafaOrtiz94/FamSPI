import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { FiAlertCircle, FiArrowLeft, FiX } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import {
  createComment, createContact, deleteAction, deleteComment,
  deleteCompetitor, deleteFlag, deleteInfluence, getOpportunity,
  linkProcess, lookupProcess, saveAction, saveCompetitor, saveFlag,
  saveInfluence, searchContacts, unlinkProcess, updateOpportunity,
  updateRating,
} from "../api/opportunitiesApi";

// ─── Dominio ────────────────────────────────────────────────────────────────

const ETAPAS = {
  prospect:  "Prospecto",
  qualify:   "Calificando",
  pursue:    "Persiguiendo",
  close:     "Cierre",
  won:       "Ganado",
  lost:      "Perdido",
  archived:  "Archivado",
};

const ETAPA_COLOR = {
  prospect: "bg-amber-100 text-amber-800",
  qualify:  "bg-sky-100 text-sky-800",
  pursue:   "bg-blue-100 text-blue-800",
  close:    "bg-slate-100 text-slate-700",
  won:      "bg-emerald-100 text-emerald-800",
  lost:     "bg-rose-100 text-rose-800",
  archived: "bg-slate-100 text-slate-500",
};

const ROLES_IC = {
  economic:      "Económico (E)",
  technical:     "Técnico (T)",
  user:          "Usuario (U)",
  coach:         "Coach (C)",
};

const INFLUENCIAS = {
  high:   "Alta (A)",
  medium: "Media (M)",
  low:    "Baja (B)",
};

const MODOS = {
  growth:        "Crecimiento (C)",
  problem:       "Problema (P)",
  equilibrium:   "Equilibrio (E)",
  overconfident: "Exceso de confianza (EC)",
};

const POSICION_COMPETITIVA = {
  unique:   "Única alternativa",
  dominant: "Dominante",
  shared:   "Compartida",
  zero:     "Cero",
};

const ESTADO_ACCION = {
  pending:     "Pendiente",
  in_progress: "En curso",
  done:        "Completada",
  cancelled:   "Cancelada",
};

const ESTADO_BANDERA = {
  open:       "Abierta",
  mitigating: "Mitigando",
  resolved:   "Resuelta",
};

const SEVERIDAD_COLOR = {
  low:      "bg-slate-100 text-slate-700",
  medium:   "bg-amber-100 text-amber-800",
  high:     "bg-orange-100 text-orange-800",
  critical: "bg-rose-100 text-rose-800",
};

const SEVERIDAD_LABEL = {
  low:      "Baja",
  medium:   "Media",
  high:     "Alta",
  critical: "Crítica",
};

const CRITERIOS = [
  { id: "tiene_presupuesto",       label: "Existe suficiente presupuesto" },
  { id: "tiene_acceso",            label: "Tenemos el acceso que necesitamos" },
  { id: "entiende_proceso_compra", label: "Tenemos un claro entendimiento del proceso de compra del cliente" },
  { id: "relacion_con_eb",         label: "Tenemos una relación fuerte con la IC Económica" },
  { id: "tiene_coach",             label: "Tenemos por lo menos un Coach" },
];

const PESTANAS = [
  { id: "analisis",    label: "Análisis" },
  { id: "influencias", label: "Influencias" },
  { id: "valoracion",  label: "Valoración" },
  { id: "situacion",   label: "Situación" },
  { id: "competencia", label: "Competencia" },
  { id: "plan",        label: "Plan" },
  { id: "coaching",    label: "Coaching" },
  { id: "vinculos",    label: "Vínculos" },
];

// ─── Primitivos UI ──────────────────────────────────────────────────────────

const Lbl = ({ children }) => (
  <span className="block text-xs font-medium text-slate-600">{children}</span>
);

const Campo = ({ className = "", ...props }) => (
  <input
    {...props}
    className={`w-full min-h-[40px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 ${className}`}
  />
);

const Sel = ({ className = "", ...props }) => (
  <select
    {...props}
    className={`w-full min-h-[40px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 ${className}`}
  />
);

const Area = ({ className = "", ...props }) => (
  <textarea
    {...props}
    className={`w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 resize-none ${className}`}
  />
);

const GF = ({ label, children }) => (
  <div className="grid gap-1">
    <Lbl>{label}</Lbl>
    {children}
  </div>
);

const BtnPrimario = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`rounded-2xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 ${className}`}
  >
    {children}
  </button>
);

const BtnNaval = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`rounded-2xl bg-[#1E293B] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 ${className}`}
  >
    {children}
  </button>
);

const BtnSecundario = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 ${className}`}
  >
    {children}
  </button>
);

// ─── Componentes de dominio ──────────────────────────────────────────────────

const Semaforo = ({ puntuacion }) => {
  const config = useMemo(() => {
    if (puntuacion >= 80) return { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Sólida" };
    if (puntuacion >= 40) return { bg: "bg-amber-50 border-amber-200",   text: "text-amber-700",   label: "En desarrollo" };
    return                       { bg: "bg-rose-50 border-rose-200",      text: "text-rose-700",    label: "Crítica" };
  }, [puntuacion]);

  return (
    <div className={`rounded-2xl border px-4 py-3 text-center ${config.bg}`}>
      <div className={`text-3xl font-bold tracking-tight ${config.text}`}>{puntuacion}</div>
      <div className={`mt-0.5 text-xs font-medium ${config.text}`}>{config.label}</div>
    </div>
  );
};

// Chips S / N / D para los 5 criterios
const ChipSND = ({ value, onChange, disabled }) => (
  <div className="flex gap-2">
    {[
      { val: "S", label: "Sí", on: "bg-emerald-600 border-emerald-600 text-white", off: "bg-white border-slate-200 text-slate-600 hover:border-emerald-300" },
      { val: "N", label: "No", on: "bg-rose-600 border-rose-600 text-white",       off: "bg-white border-slate-200 text-slate-600 hover:border-rose-300" },
      { val: "D", label: "?",  on: "bg-slate-600 border-slate-600 text-white",     off: "bg-white border-slate-200 text-slate-500 hover:border-slate-400" },
    ].map(({ val, label, on, off }) => (
      <button
        key={val}
        type="button"
        disabled={disabled}
        onClick={() => onChange(val)}
        className={`min-h-[40px] w-14 rounded-2xl border text-sm font-semibold transition ${value === val ? on : off}`}
      >
        {label}
      </button>
    ))}
  </div>
);

// Slider Euforia-Pánico 1-10 con etiqueta contextual
const SliderEP = ({ value, onChange }) => {
  const info = useMemo(() => {
    if (value <= 2) return { label: "Euforia",    color: "text-emerald-700" };
    if (value <= 4) return { label: "Cómodo",     color: "text-emerald-600" };
    if (value <= 5) return { label: "Aceptable",  color: "text-slate-600"   };
    if (value <= 7) return { label: "Preocupado", color: "text-amber-700"   };
    if (value <= 9) return { label: "Con miedo",  color: "text-orange-700"  };
    return                  { label: "Pánico",    color: "text-rose-700"    };
  }, [value]);

  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between">
        <Lbl>Euforia-Pánico</Lbl>
        <span className={`text-xs font-semibold ${info.color}`}>{value} — {info.label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-emerald-600 w-10 shrink-0 text-center leading-tight">Euforia</span>
        <input type="range" min="1" max="10" step="1" value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-blue-600 h-1.5 cursor-pointer" />
        <span className="text-[10px] text-rose-600 w-10 shrink-0 text-center leading-tight">Pánico</span>
      </div>
    </div>
  );
};

// Slider -5..+5 para calificación de competidor o IC
const SliderPM = ({ label, value, onChange }) => (
  <div className="grid gap-1">
    <div className="flex items-center justify-between">
      <Lbl>{label}</Lbl>
      <span className={`text-xs font-semibold ${value > 0 ? "text-emerald-700" : value < 0 ? "text-rose-700" : "text-slate-500"}`}>
        {value > 0 ? `+${value}` : value}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-rose-500 w-5 text-center">-5</span>
      <input type="range" min="-5" max="5" step="1" value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-blue-600 h-1.5 cursor-pointer" />
      <span className="text-[10px] text-emerald-600 w-5 text-center">+5</span>
    </div>
    <div className="flex justify-between px-7 text-[10px] text-slate-400">
      <span>Ellos mejor</span><span>Empate</span><span>Yo mejor</span>
    </div>
  </div>
);

// Barra visual de un score -5..+5 para la lista de competidores
const BarraScore = ({ value }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full ${value > 0 ? "bg-emerald-500" : value < 0 ? "bg-rose-500" : "bg-slate-300"}`}
        style={{ width: `${((value + 5) / 10) * 100}%` }}
      />
    </div>
    <span className={`text-[10px] font-semibold w-6 text-right ${value > 0 ? "text-emerald-700" : value < 0 ? "text-rose-700" : "text-slate-400"}`}>
      {value > 0 ? `+${value}` : value}
    </span>
  </div>
);

const EstadoVacio = ({ titulo, texto }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
    <p className="text-sm font-medium text-slate-700">{titulo}</p>
    {texto ? <p className="mt-1 text-sm text-slate-500">{texto}</p> : null}
  </div>
);

// ─── Componente principal ────────────────────────────────────────────────────

export default function OpportunityWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tab, setTab]             = useState("analisis");
  const [detalle, setDetalle]     = useState(null);
  const [contactos, setContactos] = useState([]);
  const [prevExp, setPrevExp]     = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState("");

  // ── Formulario análisis ──────────────────────────────────────────────────
  const [analisis, setAnalisis] = useState({
    title: "", empresa_area: "", singular_objective: "",
    objetivo_declarado_cliente: "", efectos_evaluacion: "",
    competencia_resumen: "", product_name: "",
    estimated_amount: "", periodo_anos: 1,
    target_close_date: "", funnel_stage: "prospect",
    competitive_position: "shared", tiempo_cliente_prioridades: "",
  });

  // ── Formulario 5 criterios ───────────────────────────────────────────────
  const [valoracion, setValoracion] = useState({
    tiene_presupuesto: "D", tiene_acceso: "D",
    entiende_proceso_compra: "D", relacion_con_eb: "D", tiene_coach: "D",
  });

  // ── Formularios subrecursos ──────────────────────────────────────────────
  const [forms, setForms] = useState({
    ic:          { full_name: "", role: "economic", influence_level: "medium", mode: "growth", euphoria_panic: 5, personal_win: "", business_result: "", contact_id: "", calificacion: 0, preferencia_competitiva: "neutral" },
    bandera:     { title: "", flag_type: "bandera_roja", severity: "medium", status: "open", description: "" },
    punto:       { title: "", flag_type: "punto_fuerte", severity: "low",    status: "open", description: "" },
    accion:      { title: "", description: "", due_date: "", assignee_user_id: "", status: "pending" },
    competidor:  { competitor_name: "", relationship_score: 0, technical_score: 0, price_score: 0, service_score: 0, timing_score: 0, notes: "" },
    comentario:  { body: "", visibility: "team", mention_user_ids: "" },
    vinculo:     { process_type: "business_case", process_id: "" },
    contacto:    { full_name: "", email: "", title: "" },
  });

  const patch = (clave, cambio) =>
    setForms((prev) => ({ ...prev, [clave]: { ...prev[clave], ...cambio } }));

  const puntuacion = detalle?.rating?.puntuacion ?? 0;

  // ── Alertas de cabecera ──────────────────────────────────────────────────
  const alertas = useMemo(() => {
    const ics   = detalle?.influences || [];
    const etapa = detalle?.opportunity?.funnel_stage;
    const out   = [];
    if (["pursue","close"].includes(etapa) && !ics.some((ic) => ic.role === "coach"))
      out.push({ id: "coach", label: "Sin Coach", cls: "bg-amber-100 text-amber-800" });
    if (etapa === "close" && !ics.some((ic) => ic.role === "economic"))
      out.push({ id: "eb", label: "Sin Económico", cls: "bg-rose-100 text-rose-800" });
    const brCriticas = (detalle?.flags || [])
      .filter((f) => f.flag_type !== "punto_fuerte" && f.severity === "critical" && f.status !== "resolved");
    if (brCriticas.length)
      out.push({ id: "br", label: `${brCriticas.length} BR crítica${brCriticas.length > 1 ? "s" : ""}`, cls: "bg-rose-100 text-rose-800" });
    return out;
  }, [detalle]);

  // ── Sincronizar estado local con respuesta API ───────────────────────────
  const sincronizar = useCallback((res) => {
    const opp = res?.opportunity || {};
    setAnalisis({
      title:                      opp.title || "",
      empresa_area:               opp.empresa_area || "",
      singular_objective:         opp.singular_objective || "",
      objetivo_declarado_cliente: opp.objetivo_declarado_cliente || "",
      efectos_evaluacion:         opp.efectos_evaluacion || "",
      competencia_resumen:        opp.competencia_resumen || "",
      product_name:               opp.product_name || "",
      estimated_amount:           opp.estimated_amount || "",
      periodo_anos:               opp.periodo_anos || 1,
      target_close_date:          opp.target_close_date ? String(opp.target_close_date).slice(0, 10) : "",
      funnel_stage:               opp.funnel_stage || "prospect",
      competitive_position:       opp.competitive_position || "shared",
      tiempo_cliente_prioridades: opp.tiempo_cliente_prioridades || "",
    });
    const r = res?.rating || {};
    setValoracion({
      tiene_presupuesto:       r.tiene_presupuesto       || "D",
      tiene_acceso:            r.tiene_acceso            || "D",
      entiende_proceso_compra: r.entiende_proceso_compra || "D",
      relacion_con_eb:         r.relacion_con_eb         || "D",
      tiene_coach:             r.tiene_coach             || "D",
    });
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const res = await getOpportunity(id);
      setDetalle(res);
      sincronizar(res);
      if (res?.opportunity?.account_id) {
        const ctcts = await searchContacts({ accountId: res.opportunity.account_id });
        setContactos(Array.isArray(ctcts) ? ctcts : []);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "No se pudo cargar el análisis.");
    } finally {
      setCargando(false);
    }
  }, [id, sincronizar]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Helper: ejecutar acción y refrescar ──────────────────────────────────
  const exec = async (fn, resetClave = null, resetVal = null) => {
    setGuardando(true);
    setError("");
    try {
      const res = await fn();
      setDetalle(res);
      sincronizar(res);
      if (resetClave) patch(resetClave, resetVal);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  // ── Guardar valoración criterio por criterio ─────────────────────────────
  const guardarCriterio = async (criterioId, val) => {
    const nueva = { ...valoracion, [criterioId]: val };
    setValoracion(nueva); // optimistic update
    try {
      await updateRating(id, nueva);
      const res = await getOpportunity(id);
      setDetalle(res);
      sincronizar(res);
    } catch (err) {
      setValoracion(valoracion); // revertir
      setError(err?.response?.data?.message || "No se pudo actualizar la valoración.");
    }
  };

  // ── Guardar análisis ─────────────────────────────────────────────────────
  const guardarAnalisis = (e) => {
    e.preventDefault();
    exec(() => updateOpportunity(id, {
      ...analisis,
      estimated_amount: Number(analisis.estimated_amount || 0),
      periodo_anos:     Number(analisis.periodo_anos    || 1),
    }));
  };

  if (!id) return <Navigate to="/dashboard/comercial/famsheets" replace />;

  if (cargando) {
    return (
      <div className={`${WORKSPACE_PAGE_CLASS} gap-5`}>
        {[1,2,3].map((n) => (
          <div key={n} className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-32 rounded-full bg-slate-200" />
            <div className="mt-3 h-7 w-2/3 rounded-full bg-slate-200" />
            <div className="mt-2 h-4 w-1/2 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  if (error && !detalle) {
    return (
      <div className={`${WORKSPACE_PAGE_CLASS} gap-5`}>
        <div className="flex items-center gap-2 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          <FiAlertCircle size={15} />
          {error}
        </div>
        <BtnNaval onClick={() => navigate("/dashboard/comercial/famsheets")}>
          Volver al listado
        </BtnNaval>
      </div>
    );
  }

  const opp = detalle?.opportunity || {};

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} gap-5`}>

      {/* ══════ CABECERA ══════════════════════════════════════════════════ */}
      <header className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

          {/* Texto */}
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => navigate("/dashboard/comercial/famsheets")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-800"
            >
              <FiArrowLeft size={13} />
              Análisis Estratégico
            </button>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${ETAPA_COLOR[opp.funnel_stage] || "bg-slate-100 text-slate-700"}`}>
                {ETAPAS[opp.funnel_stage] || opp.funnel_stage}
              </span>
              {opp.account_name && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                  {opp.account_name}
                </span>
              )}
              {alertas.map((a) => (
                <span key={a.id} className={`rounded-full px-3 py-1 text-xs font-semibold ${a.cls}`}>{a.label}</span>
              ))}
            </div>

            <h1 className="mt-3 text-[clamp(1.125rem,2.2vw,1.625rem)] font-bold leading-snug tracking-tight text-slate-900">
              {opp.singular_objective || opp.title || "Sin objetivo definido"}
            </h1>
            {opp.empresa_area && (
              <p className="mt-1 text-sm text-slate-500">{opp.empresa_area}</p>
            )}
          </div>

          {/* Métricas rápidas */}
          <div className="grid grid-cols-3 gap-3 lg:w-72 shrink-0">
            <Semaforo puntuacion={puntuacion} />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Monto</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                ${Number(opp.estimated_amount || 0).toLocaleString("es-EC")}
              </div>
              {(opp.periodo_anos || 1) > 1 && (
                <div className="text-[10px] text-slate-500">× {opp.periodo_anos} años</div>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Cierre</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {analisis.target_close_date || "—"}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Error inline */}
      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <FiAlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ══════ NAVEGACIÓN ════════════════════════════════════════════════ */}
      <nav className="flex flex-wrap gap-2">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setTab(p.id)}
            className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === p.id
                ? "bg-[#1E293B] text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            {p.label}
          </button>
        ))}
      </nav>

      {/* ══════ ANÁLISIS ══════════════════════════════════════════════════ */}
      {tab === "analisis" && (
        <form onSubmit={guardarAnalisis} className="grid gap-5">

          <Card>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Objetivo Singular de Ventas</h2>
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <GF label="Empresa / Área específica">
                  <Campo value={analisis.empresa_area} placeholder="MOVILAB / LABORATORIO AMBATO / HEMATOLOGÍA"
                    onChange={(e) => setAnalisis((p) => ({ ...p, empresa_area: e.target.value }))} />
                </GF>
                <GF label="Producto / Servicio / Solución">
                  <Campo value={analisis.product_name} placeholder="BIOMETRÍAS / XN 550"
                    onChange={(e) => setAnalisis((p) => ({ ...p, product_name: e.target.value }))} />
                </GF>
              </div>

              <GF label="Objetivo Singular (Qué + Cuánto + Cuándo)">
                <Area rows={3} value={analisis.singular_objective}
                  placeholder="Ej. $7.500/AÑO × 5 AÑOS — implementar XN 550 en la red de laboratorios para Q4-2026"
                  onChange={(e) => setAnalisis((p) => ({ ...p, singular_objective: e.target.value }))} />
              </GF>

              <div className="grid gap-4 sm:grid-cols-3">
                <GF label="Ingresos estimados (USD)">
                  <Campo type="number" min="0" value={analisis.estimated_amount}
                    onChange={(e) => setAnalisis((p) => ({ ...p, estimated_amount: e.target.value }))} />
                </GF>
                <GF label="Período (años)">
                  <Campo type="number" min="1" max="20" value={analisis.periodo_anos}
                    onChange={(e) => setAnalisis((p) => ({ ...p, periodo_anos: Number(e.target.value) }))} />
                </GF>
                <GF label="Fecha de cierre estimada">
                  <Campo type="date" value={analisis.target_close_date}
                    onChange={(e) => setAnalisis((p) => ({ ...p, target_close_date: e.target.value }))} />
                </GF>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <GF label="Etapa del embudo">
                  <Sel value={analisis.funnel_stage}
                    onChange={(e) => setAnalisis((p) => ({ ...p, funnel_stage: e.target.value }))}>
                    {Object.entries(ETAPAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Sel>
                </GF>

                <div className="grid gap-1">
                  <Lbl>Tiempo del cliente para sus prioridades</Lbl>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      ["urgente","Urgente"], ["activo","Activo"],
                      ["importante","Importante"], ["posteriormente","Posteriormente"],
                    ].map(([v, l]) => (
                      <button key={v} type="button"
                        onClick={() => setAnalisis((p) => ({ ...p, tiempo_cliente_prioridades: p.tiempo_cliente_prioridades === v ? "" : v }))}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          analisis.tiempo_cliente_prioridades === v
                            ? "border-[#1E293B] bg-[#1E293B] text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Objetivo Declarado del Cliente</h2>
            <div className="grid gap-4">
              <GF label="¿Qué dice el cliente que quiere?">
                <Area rows={2} value={analisis.objetivo_declarado_cliente}
                  placeholder="Ej. QUIERO MEJORES RESULTADOS AL MISMO COSTO ACTUAL $1.40/BIOMETRÍA"
                  onChange={(e) => setAnalisis((p) => ({ ...p, objetivo_declarado_cliente: e.target.value }))} />
              </GF>
              <GF label="Evaluación del objetivo — efectos, implicaciones y beneficios">
                <Area rows={3} value={analisis.efectos_evaluacion}
                  placeholder="Ej. Mejora resultados y mantiene costos. Va a seguir teniendo problemas en contajes blancos bajos y altos."
                  onChange={(e) => setAnalisis((p) => ({ ...p, efectos_evaluacion: e.target.value }))} />
              </GF>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Competencia</h2>
            <GF label="Competidores identificados (texto libre)">
              <Area rows={2} value={analisis.competencia_resumen}
                placeholder="Ej. Medilabor, Simed"
                onChange={(e) => setAnalisis((p) => ({ ...p, competencia_resumen: e.target.value }))} />
            </GF>
          </Card>

          <div className="flex justify-end">
            <BtnPrimario type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar análisis"}
            </BtnPrimario>
          </div>
        </form>
      )}

      {/* ══════ INFLUENCIAS ═══════════════════════════════════════════════ */}
      {tab === "influencias" && (
        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">

          {/* Formulario */}
          <Card>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Agregar Influencia Compradora</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await exec(
                  () => saveInfluence(id, forms.ic),
                  "ic",
                  { full_name: "", role: "economic", influence_level: "medium", mode: "growth", euphoria_panic: 5, personal_win: "", business_result: "", contact_id: "", calificacion: 0, preferencia_competitiva: "neutral" }
                );
              }}
              className="grid gap-4"
            >
              <GF label="Nombre y título / cargo">
                <Campo value={forms.ic.full_name} placeholder="DRA. LOURDES TABARES - JEFE DE LABORATORIO"
                  onChange={(e) => patch("ic", { full_name: e.target.value })} />
              </GF>

              <GF label="Contacto en el sistema (opcional)">
                <Sel value={forms.ic.contact_id} onChange={(e) => patch("ic", { contact_id: e.target.value })}>
                  <option value="">Sin contacto vinculado</option>
                  {contactos.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </Sel>
              </GF>

              <div className="grid gap-3 sm:grid-cols-3">
                <GF label="Rol">
                  <Sel value={forms.ic.role} onChange={(e) => patch("ic", { role: e.target.value })}>
                    {Object.entries(ROLES_IC).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Sel>
                </GF>
                <GF label="Influencia">
                  <Sel value={forms.ic.influence_level} onChange={(e) => patch("ic", { influence_level: e.target.value })}>
                    {Object.entries(INFLUENCIAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Sel>
                </GF>
                <GF label="Modo">
                  <Sel value={forms.ic.mode} onChange={(e) => patch("ic", { mode: e.target.value })}>
                    {Object.entries(MODOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Sel>
                </GF>
              </div>

              <SliderEP value={forms.ic.euphoria_panic} onChange={(v) => patch("ic", { euphoria_panic: v })} />

              <div className="grid gap-3 sm:grid-cols-2">
                <GF label="Triunfo personal">
                  <Area rows={3} value={forms.ic.personal_win} placeholder="¿Qué gana personalmente esta IC?"
                    onChange={(e) => patch("ic", { personal_win: e.target.value })} />
                </GF>
                <GF label="Resultado de negocio">
                  <Area rows={3} value={forms.ic.business_result} placeholder="¿Qué gana la organización?"
                    onChange={(e) => patch("ic", { business_result: e.target.value })} />
                </GF>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <GF label="Preferencia competitiva">
                  <Sel value={forms.ic.preferencia_competitiva} onChange={(e) => patch("ic", { preferencia_competitiva: e.target.value })}>
                    <option value="a_favor">A nuestro favor (+)</option>
                    <option value="neutral">Neutral (=)</option>
                    <option value="en_contra">En nuestra contra (-)</option>
                  </Sel>
                </GF>
                <SliderPM label="Calificación (+5 / -5)"
                  value={forms.ic.calificacion}
                  onChange={(v) => patch("ic", { calificacion: v })} />
              </div>

              <BtnPrimario type="submit" disabled={guardando}>
                {guardando ? "Guardando…" : "Agregar influencia"}
              </BtnPrimario>
            </form>

            {/* Alta rápida de contacto */}
            {opp.account_id && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="mb-3 text-xs font-medium text-slate-600 uppercase tracking-wide">Alta rápida de contacto</p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const nuevo = await createContact({ account_id: opp.account_id, ...forms.contacto });
                      setContactos((prev) => [nuevo, ...prev]);
                      patch("contacto", { full_name: "", email: "", title: "" });
                    } catch (err) {
                      setError(err?.response?.data?.message || "No se pudo crear el contacto.");
                    }
                  }}
                  className="grid gap-2"
                >
                  <Campo placeholder="Nombre completo" value={forms.contacto.full_name}
                    onChange={(e) => patch("contacto", { full_name: e.target.value })} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Campo placeholder="Cargo" value={forms.contacto.title}
                      onChange={(e) => patch("contacto", { title: e.target.value })} />
                    <Campo placeholder="Email" value={forms.contacto.email}
                      onChange={(e) => patch("contacto", { email: e.target.value })} />
                  </div>
                  <BtnSecundario type="submit">Crear contacto</BtnSecundario>
                </form>
              </div>
            )}
          </Card>

          {/* Lista de ICs */}
          <div className="grid gap-4 content-start">
            {!(detalle?.influences?.length) ? (
              <EstadoVacio
                titulo="No hay influencias registradas"
                texto="Agrega al menos un Económico (E) y un Coach (C) para avanzar en el embudo."
              />
            ) : detalle.influences.map((ic) => (
              <div key={ic.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-900">{ic.full_name}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-[#1E293B] px-2.5 py-0.5 text-[10px] font-semibold text-white">
                        {ROLES_IC[ic.role] || ic.role}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] text-slate-700">
                        {INFLUENCIAS[ic.influence_level] || ic.influence_level}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] text-slate-700">
                        {MODOS[ic.mode] || ic.mode}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${ic.euphoria_panic >= 7 ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                        EP {ic.euphoria_panic}
                      </span>
                      {ic.calificacion != null && (
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${ic.calificacion > 0 ? "bg-emerald-100 text-emerald-800" : ic.calificacion < 0 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600"}`}>
                          {ic.calificacion > 0 ? `+${ic.calificacion}` : ic.calificacion}
                        </span>
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={() => exec(() => deleteInfluence(id, ic.id))}
                    className="text-slate-300 transition hover:text-rose-500 p-1 shrink-0">
                    <FiX size={15} />
                  </button>
                </div>
                {(ic.personal_win || ic.business_result) && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {ic.personal_win && (
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-1">Triunfo personal</p>
                        <p className="text-xs text-slate-700">{ic.personal_win}</p>
                      </div>
                    )}
                    {ic.business_result && (
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-1">Resultado de negocio</p>
                        <p className="text-xs text-slate-700">{ic.business_result}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════ VALORACIÓN ════════════════════════════════════════════════ */}
      {tab === "valoracion" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">

          <Card>
            <h2 className="mb-1 text-base font-semibold text-slate-900">Valoración de la Oportunidad</h2>
            <p className="mb-5 text-sm text-slate-500">
              Cada criterio respondido con <strong>Sí</strong> suma 20 puntos. Máximo: 100.
            </p>
            <div className="grid gap-4">
              {CRITERIOS.map((c) => (
                <div key={c.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{c.label}</p>
                    <p className="mt-0.5 text-xs text-slate-400">20 puntos</p>
                  </div>
                  <ChipSND
                    value={valoracion[c.id]}
                    onChange={(val) => guardarCriterio(c.id, val)}
                    disabled={guardando}
                  />
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 content-start">
            <Card>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Puntuación total</p>
              <Semaforo puntuacion={puntuacion} />
              <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px]">
                <div className="rounded-xl bg-rose-50 py-1 text-rose-700">0-39 Crítica</div>
                <div className="rounded-xl bg-amber-50 py-1 text-amber-700">40-79 Desarrollo</div>
                <div className="rounded-xl bg-emerald-50 py-1 text-emerald-700">80-100 Sólida</div>
              </div>
            </Card>

            <Card>
              <p className="mb-3 text-sm font-semibold text-slate-900">Mi posición vs. la Competencia</p>
              <div className="grid gap-2">
                {Object.entries(POSICION_COMPETITIVA).map(([val, lbl]) => (
                  <button key={val} type="button"
                    onClick={() => exec(() => updateOpportunity(id, { competitive_position: val }))}
                    className={`rounded-2xl border px-4 py-2.5 text-left text-sm font-medium transition ${
                      opp.competitive_position === val
                        ? "border-[#1E293B] bg-[#1E293B] text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ══════ SITUACIÓN (Puntos Fuertes + Banderas Rojas) ═══════════════ */}
      {tab === "situacion" && (
        <div className="grid gap-5 xl:grid-cols-2">

          {/* PUNTOS FUERTES */}
          <div className="grid gap-4 content-start">
            <Card>
              <h2 className="mb-1 text-base font-semibold text-slate-900">Puntos Fuertes</h2>
              <p className="mb-4 text-sm text-slate-500">Áreas de diferenciación y oportunidades para mejorar la posición.</p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await exec(
                    () => saveFlag(id, { ...forms.punto, flag_type: "punto_fuerte" }),
                    "punto",
                    { title: "", flag_type: "punto_fuerte", severity: "low", status: "open", description: "" }
                  );
                }}
                className="grid gap-3"
              >
                <GF label="Punto fuerte">
                  <Campo value={forms.punto.title} placeholder="Ej. Relación directa con el Económico"
                    onChange={(e) => patch("punto", { title: e.target.value })} />
                </GF>
                <GF label="Descripción (opcional)">
                  <Area rows={2} value={forms.punto.description}
                    onChange={(e) => patch("punto", { description: e.target.value })} />
                </GF>
                <button type="submit" disabled={guardando}
                  className="rounded-2xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                  + Agregar punto fuerte
                </button>
              </form>
            </Card>

            {!(detalle?.flags || []).filter((f) => f.flag_type === "punto_fuerte").length ? (
              <EstadoVacio titulo="Sin puntos fuertes" texto="Registra los diferenciadores clave de esta oportunidad." />
            ) : (
              (detalle?.flags || []).filter((f) => f.flag_type === "punto_fuerte").map((pf) => (
                <div key={pf.id} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-emerald-900">{pf.title}</p>
                    <button type="button" onClick={() => exec(() => deleteFlag(id, pf.id))}
                      className="text-emerald-400 transition hover:text-rose-600 p-0.5 shrink-0">
                      <FiX size={13} />
                    </button>
                  </div>
                  {pf.description && <p className="mt-1 text-xs text-emerald-700">{pf.description}</p>}
                </div>
              ))
            )}
          </div>

          {/* BANDERAS ROJAS */}
          <div className="grid gap-4 content-start">
            <Card>
              <h2 className="mb-1 text-base font-semibold text-slate-900">Banderas Rojas</h2>
              <p className="mb-4 text-sm text-slate-500">Riesgos, brechas e incertidumbres que amenazan la venta.</p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await exec(
                    () => saveFlag(id, { ...forms.bandera, flag_type: "bandera_roja" }),
                    "bandera",
                    { title: "", flag_type: "bandera_roja", severity: "medium", status: "open", description: "" }
                  );
                }}
                className="grid gap-3"
              >
                <GF label="Bandera roja">
                  <Campo value={forms.bandera.title} placeholder="Ej. Base no descubierta / incertidumbre presupuestaria"
                    onChange={(e) => patch("bandera", { title: e.target.value })} />
                </GF>
                <div className="grid gap-3 sm:grid-cols-2">
                  <GF label="Severidad">
                    <Sel value={forms.bandera.severity} onChange={(e) => patch("bandera", { severity: e.target.value })}>
                      {Object.entries(SEVERIDAD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Sel>
                  </GF>
                  <GF label="Estado">
                    <Sel value={forms.bandera.status} onChange={(e) => patch("bandera", { status: e.target.value })}>
                      {Object.entries(ESTADO_BANDERA).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Sel>
                  </GF>
                </div>
                <GF label="Descripción (opcional)">
                  <Area rows={2} value={forms.bandera.description}
                    onChange={(e) => patch("bandera", { description: e.target.value })} />
                </GF>
                <button type="submit" disabled={guardando}
                  className="rounded-2xl bg-rose-600 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50">
                  + Agregar bandera roja
                </button>
              </form>
            </Card>

            {!(detalle?.flags || []).filter((f) => f.flag_type !== "punto_fuerte").length ? (
              <EstadoVacio titulo="Sin banderas rojas" texto="Las banderas críticas requieren una acción de mitigación." />
            ) : (
              (detalle?.flags || []).filter((f) => f.flag_type !== "punto_fuerte").map((br) => (
                <div key={br.id} className={`rounded-2xl border px-4 py-3 ${br.severity === "critical" ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERIDAD_COLOR[br.severity]}`}>
                          {SEVERIDAD_LABEL[br.severity]}
                        </span>
                        <span className="text-[10px] text-slate-500">{ESTADO_BANDERA[br.status]}</span>
                        {br.auto_generated && <span className="text-[10px] text-amber-600">Auto</span>}
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-900">{br.title}</p>
                    </div>
                    <button type="button" onClick={() => exec(() => deleteFlag(id, br.id))}
                      className="text-slate-300 transition hover:text-rose-600 p-0.5 shrink-0">
                      <FiX size={13} />
                    </button>
                  </div>
                  {br.description && <p className="mt-1 text-xs text-slate-600">{br.description}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ══════ COMPETENCIA ═══════════════════════════════════════════════ */}
      {tab === "competencia" && (
        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">

          <Card>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Registrar competidor</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await exec(
                  () => saveCompetitor(id, forms.competidor),
                  "competidor",
                  { competitor_name: "", relationship_score: 0, technical_score: 0, price_score: 0, service_score: 0, timing_score: 0, notes: "" }
                );
              }}
              className="grid gap-4"
            >
              <GF label="Nombre del competidor">
                <Campo value={forms.competidor.competitor_name} placeholder="Ej. Medilabor"
                  onChange={(e) => patch("competidor", { competitor_name: e.target.value })} />
              </GF>
              {[
                ["relationship_score","Relación"],
                ["technical_score","Técnica"],
                ["price_score","Precio"],
                ["service_score","Servicio"],
                ["timing_score","Timing"],
              ].map(([field, label]) => (
                <SliderPM key={field} label={label}
                  value={forms.competidor[field]}
                  onChange={(v) => patch("competidor", { [field]: v })} />
              ))}
              <GF label="Notas / evidencia">
                <Area rows={3} value={forms.competidor.notes} placeholder='Ej. "ME INTERESA LA OFERTA"'
                  onChange={(e) => patch("competidor", { notes: e.target.value })} />
              </GF>
              <BtnPrimario type="submit" disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar competidor"}
              </BtnPrimario>
            </form>
          </Card>

          <div className="grid gap-4 content-start">
            {!(detalle?.competitors?.length) ? (
              <EstadoVacio titulo="Sin competidores registrados" texto="Evalúa a cada competidor en los 5 ejes para sostener tu posición comercial." />
            ) : detalle.competitors.map((comp) => (
              <div key={comp.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{comp.competitor_name}</p>
                  <button type="button" onClick={() => exec(() => deleteCompetitor(id, comp.id))}
                    className="text-slate-300 transition hover:text-rose-500">
                    <FiX size={15} />
                  </button>
                </div>
                <div className="grid gap-3">
                  {[
                    ["relationship_score","Relación"],
                    ["technical_score","Técnica"],
                    ["price_score","Precio"],
                    ["service_score","Servicio"],
                    ["timing_score","Timing"],
                  ].map(([field, label]) => (
                    <div key={field} className="grid gap-1">
                      <p className="text-xs text-slate-500">{label}</p>
                      <BarraScore value={comp[field] ?? 0} />
                    </div>
                  ))}
                </div>
                {comp.notes && <p className="mt-3 text-xs text-slate-500 italic">"{comp.notes}"</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════ PLAN DE ACCIÓN ════════════════════════════════════════════ */}
      {tab === "plan" && (
        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">

          <Card>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Nueva acción</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await exec(
                  () => saveAction(id, forms.accion),
                  "accion",
                  { title: "", description: "", due_date: "", assignee_user_id: "", status: "pending" }
                );
              }}
              className="grid gap-3"
            >
              <GF label="Actividad">
                <Campo value={forms.accion.title}
                  placeholder="Ej. Reunión con Gerente General para presentar propuesta"
                  onChange={(e) => patch("accion", { title: e.target.value })} />
              </GF>
              <GF label="Perspectiva a proveer / descripción">
                <Area rows={3} value={forms.accion.description}
                  onChange={(e) => patch("accion", { description: e.target.value })} />
              </GF>
              <div className="grid gap-3 sm:grid-cols-2">
                <GF label="Fecha límite">
                  <Campo type="date" value={forms.accion.due_date}
                    onChange={(e) => patch("accion", { due_date: e.target.value })} />
                </GF>
                <GF label="Estado">
                  <Sel value={forms.accion.status} onChange={(e) => patch("accion", { status: e.target.value })}>
                    {Object.entries(ESTADO_ACCION).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Sel>
                </GF>
              </div>
              <BtnPrimario type="submit" disabled={guardando}>
                {guardando ? "Guardando…" : "Agregar acción"}
              </BtnPrimario>
            </form>
          </Card>

          <div className="grid gap-3 content-start">
            {!(detalle?.actions?.length) ? (
              <EstadoVacio titulo="Sin acciones definidas" texto="Cada bandera roja crítica debe tener una acción con responsable y fecha." />
            ) : detalle.actions.map((accion) => {
              const vencida = accion.due_date && new Date(accion.due_date) < new Date()
                && !["done","cancelled"].includes(accion.status);
              return (
                <div key={accion.id} className={`rounded-2xl border px-4 py-4 ${vencida ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          accion.status === "done"        ? "bg-emerald-100 text-emerald-800" :
                          accion.status === "cancelled"   ? "bg-slate-100 text-slate-600"     :
                          accion.status === "in_progress" ? "bg-blue-100 text-blue-800"       :
                          "bg-amber-100 text-amber-800"
                        }`}>
                          {ESTADO_ACCION[accion.status]}
                        </span>
                        {vencida && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Vencida</span>}
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-900">{accion.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Vence: {accion.due_date ? String(accion.due_date).slice(0, 10) : "Sin fecha"}
                        {accion.assignee_name ? ` · ${accion.assignee_name}` : ""}
                      </p>
                    </div>
                    <button type="button" onClick={() => exec(() => deleteAction(id, accion.id))}
                      className="text-slate-300 transition hover:text-rose-500 shrink-0">
                      <FiX size={15} />
                    </button>
                  </div>
                  {accion.description && <p className="mt-2 text-xs text-slate-600">{accion.description}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════ COACHING ══════════════════════════════════════════════════ */}
      {tab === "coaching" && (
        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">

          <Card>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Nuevo comentario</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await exec(
                  () => createComment(id, {
                    body: forms.comentario.body,
                    visibility: forms.comentario.visibility,
                    mention_user_ids: forms.comentario.mention_user_ids
                      .split(",").map((v) => v.trim()).filter(Boolean),
                  }),
                  "comentario",
                  { body: "", visibility: "team", mention_user_ids: "" }
                );
              }}
              className="grid gap-3"
            >
              <GF label="Comentario">
                <Area rows={5} value={forms.comentario.body} placeholder="Escribe aquí el comentario de coaching…"
                  onChange={(e) => patch("comentario", { body: e.target.value })} />
              </GF>
              <GF label="Visibilidad">
                <Sel value={forms.comentario.visibility} onChange={(e) => patch("comentario", { visibility: e.target.value })}>
                  <option value="team">Equipo</option>
                  <option value="private">Privado (solo gerente y vendedor)</option>
                </Sel>
              </GF>
              <BtnNaval type="submit" disabled={guardando}>
                {guardando ? "Publicando…" : "Publicar comentario"}
              </BtnNaval>
            </form>
          </Card>

          <div className="grid gap-3 content-start">
            {!(detalle?.comments?.length) ? (
              <EstadoVacio titulo="Sin comentarios" texto="Usa este espacio para coaching, acuerdos y seguimiento del equipo." />
            ) : detalle.comments.map((c) => (
              <div key={c.id} className={`rounded-2xl border px-4 py-4 ${c.visibility === "private" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.visibility === "private" ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
                      {c.visibility === "private" ? "Privado" : "Equipo"}
                    </span>
                    <span className="text-[10px] text-slate-500">{c.author_name || ""}</span>
                  </div>
                  <button type="button" onClick={() => exec(() => deleteComment(id, c.id))}
                    className="text-slate-300 transition hover:text-rose-500">
                    <FiX size={13} />
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-slate-800">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════ VÍNCULOS ══════════════════════════════════════════════════ */}
      {tab === "vinculos" && (
        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">

          <Card>
            <h2 className="mb-1 text-base font-semibold text-slate-900">Vincular expediente</h2>
            <p className="mb-4 text-sm text-slate-500">Opcional. Úsalo para reutilizar datos de un proceso existente en FamSPI.</p>
            <div className="grid gap-3">
              <GF label="Tipo de expediente">
                <Sel value={forms.vinculo.process_type} onChange={(e) => patch("vinculo", { process_type: e.target.value })}>
                  <option value="business_case">Business Case</option>
                  <option value="private_purchase">Compra privada</option>
                  <option value="equipment_purchase">Compra pública</option>
                </Sel>
              </GF>
              <GF label="ID del expediente">
                <Campo value={forms.vinculo.process_id} placeholder="UUID o número del expediente"
                  onChange={(e) => patch("vinculo", { process_id: e.target.value })} />
              </GF>
              <div className="grid gap-2 sm:grid-cols-2">
                <BtnSecundario type="button"
                  onClick={async () => {
                    try {
                      const prev = await lookupProcess(forms.vinculo.process_type, forms.vinculo.process_id);
                      setPrevExp(prev);
                    } catch {
                      setPrevExp(null);
                      setError("No se encontró el expediente.");
                    }
                  }}>
                  Buscar
                </BtnSecundario>
                <BtnPrimario type="button"
                  onClick={() => exec(
                    () => linkProcess(id, forms.vinculo),
                    "vinculo",
                    { process_type: "business_case", process_id: "" }
                  )}>
                  Vincular
                </BtnPrimario>
              </div>
              {prevExp && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-medium text-slate-900">{prevExp.title || prevExp.client_name || prevExp.id}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{prevExp.status} · {prevExp.client_name}</p>
                </div>
              )}
            </div>
          </Card>

          <div className="grid gap-3 content-start">
            {!(detalle?.links?.length) ? (
              <EstadoVacio titulo="Sin expedientes vinculados" texto="La vinculación es completamente opcional." />
            ) : detalle.links.map((link) => (
              <div key={link.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {link.process_type === "business_case"      ? "Business Case"   :
                       link.process_type === "private_purchase"   ? "Compra privada"  : "Compra pública"}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">{link.process_id}</p>
                  </div>
                  <button type="button" onClick={() => exec(() => unlinkProcess(id, link.id))}
                    className="text-slate-300 transition hover:text-rose-500">
                    <FiX size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
