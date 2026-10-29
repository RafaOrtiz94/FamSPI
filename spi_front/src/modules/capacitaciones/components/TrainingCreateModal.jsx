import React, { useEffect, useMemo, useState } from "react";
import {
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { listTrainingParticipants } from "../../../core/api/trainingsApi";
import Modal from "../../../core/ui/components/Modal";

// ─── Pasos ───────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, short: "Datos" },
  { id: 2, short: "Personas" },
];

// ─── Opciones ────────────────────────────────────────────────────────────────

const EVENT_TYPE_OPTS = [
  { value: "capacitacion", label: "Capacitación" },
  { value: "induccion",    label: "Inducción" },
  { value: "charla",       label: "Charla" },
  { value: "reunion",      label: "Reunión" },
];

const DELIVERY_TYPE_OPTS = [
  {
    value: "interna",
    label: "La dicta alguien de la empresa",
    desc:  "El creador es el responsable. Todos firmarán digitalmente el registro.",
  },
  {
    value: "externa_instructor",
    label: "Viene un instructor externo",
    desc:  "El instructor externo firma en papel; los participantes lo firman digitalmente después.",
  },
  {
    value: "externa_desplazamiento",
    label: "Los colaboradores van a otro lugar",
    desc:  "Se desplazan a capacitarse fuera. No requiere firma digital.",
  },
];

const MODALITY_OPTS = [
  { value: "presencial", label: "Presencial" },
  { value: "virtual",    label: "Virtual" },
  { value: "hibrida",    label: "Híbrida" },
];

const EMPTY_FORM = {
  event_type:         "capacitacion",
  type:               "interna",
  title:              "",
  scheduled_date:     "",
  scheduled_time_start: "08:00",
  scheduled_time_end:   "09:00",
  duration_hours:     0,
  duration_minutes:   0,
  location:           "",
  area:               "",
  modality:           "presencial",
  trainer_name:       "",
  objectives:         "",
  material:           "",
};

// ─── Primitivos ───────────────────────────────────────────────────────────────

function FieldLabel({ children }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-sm text-[#1F2937] " +
  "outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition placeholder:text-[#9CA3AF]";

// ─── Stepper ─────────────────────────────────────────────────────────────────

function StepNode({ step, status, isLast }) {
  const colors = {
    done:   { bg: "#DCFCE7", border: "#16A34A", text: "#16A34A" },
    active: { bg: "#EFF6FF", border: "#2563EB", text: "#2563EB" },
    locked: { bg: "#F3F4F6", border: "#E5E7EB", text: "#9CA3AF" },
  };
  const c = colors[status];
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center" style={{ minWidth: 56 }}>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold"
          style={{ background: c.bg, borderColor: c.border, color: c.text }}
        >
          {status === "done" ? <FiCheck size={14} /> : step.id}
        </div>
        <span
          className="mt-1.5 text-center text-[10px] font-medium leading-tight"
          style={{ color: c.text, maxWidth: 64 }}
        >
          {step.short}
        </span>
      </div>
      {!isLast && (
        <div
          className="mb-5 h-px flex-1"
          style={{ background: status === "done" ? "#16A34A" : "#E5E7EB", minWidth: 16 }}
        />
      )}
    </div>
  );
}

// ─── Fila de colaborador ─────────────────────────────────────────────────────

function CollabRow({ c, isSel, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(c)}
      className={`flex w-full items-center gap-3 border-b border-[#F3F4F6] px-4 py-2.5 text-left last:border-0 transition-colors ${isSel ? "bg-[#EFF6FF]" : "hover:bg-[#F9FAFB]"}`}
    >
      <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-bold ${isSel ? "bg-[#2563EB] text-white" : "bg-[#F3F4F6] text-[#6B7280]"}`}>
        {isSel ? <FiCheck size={13} /> : (c.fullname?.[0] || "?").toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${isSel ? "text-[#1D4ED8]" : "text-[#1F2937]"}`}>{c.fullname}</p>
        <p className="truncate text-xs text-[#9CA3AF]">{c.cargo || c.email}</p>
      </div>
      {isSel && <FiCheck size={14} className="flex-none text-[#2563EB]" />}
    </button>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export default function TrainingCreateModal({ open, onClose, onSubmit, busy }) {
  const [step, setStep]         = useState(1);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [collabs, setCollabs]   = useState([]);
  const [searchQ, setSearchQ]   = useState("");
  const [selected, setSelected] = useState([]);
  const [loadingC, setLoadingC] = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (!open) return;
    setStep(1); setForm(EMPTY_FORM); setSelected([]); setSearchQ(""); setError(null);
  }, [open]);

  useEffect(() => {
    if (!open || collabs.length > 0) return;
    setLoadingC(true);
    listTrainingParticipants()
      .then((res) => setCollabs(Array.isArray(res) ? res : []))
      .catch(() => setCollabs([]))
      .finally(() => setLoadingC(false));
  }, [open, collabs.length]);

  const field = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const validateStep1 = () => {
    if (!form.title.trim()) return "Por favor escribe el nombre de la capacitación.";
    if (!form.scheduled_date) return "Necesitamos saber cuándo se realizará.";
    return null;
  };

  const validateStep2 = () => {
    if (selected.length === 0) return "Elige al menos una persona que participará.";
    return null;
  };

  const goNext = () => {
    const err = step === 1 ? validateStep1() : validateStep2();
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => s + 1);
  };

  const goBack = () => { setError(null); setStep((s) => s - 1); };

  // ── Participantes ────────────────────────────────────────────────────────────

  const groupedByArea = useMemo(() => {
    if (searchQ.trim()) return null;
    const map = new Map();
    for (const c of collabs) {
      const key = c.area?.trim() || "Sin área";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [collabs, searchQ]);

  const filtered = collabs.filter((c) => {
    if (!searchQ.trim()) return true;
    return `${c.fullname || ""} ${c.email || ""}`.toLowerCase().includes(searchQ.toLowerCase());
  });

  const toggle = (c) => {
    setSelected((prev) =>
      prev.some((s) => s.id === c.id)
        ? prev.filter((s) => s.id !== c.id)
        : [...prev, { id: c.id, fullname: c.fullname, cargo: c.cargo }]
    );
  };

  const isSelected = (c) => selected.some((s) => s.id === c.id);

  const selectAll = () => {
    const toAdd = collabs.filter((c) => !selected.some((s) => s.id === c.id));
    setSelected((prev) => [...prev, ...toAdd.map((c) => ({ id: c.id, fullname: c.fullname, cargo: c.cargo }))]);
  };

  const deselectAll = () => setSelected([]);

  const toggleArea = (areaCollabs) => {
    const allInArea = areaCollabs.every((c) => selected.some((s) => s.id === c.id));
    if (allInArea) {
      const areaIds = new Set(areaCollabs.map((c) => c.id));
      setSelected((prev) => prev.filter((s) => !areaIds.has(s.id)));
    } else {
      const toAdd = areaCollabs.filter((c) => !selected.some((s) => s.id === c.id));
      setSelected((prev) => [...prev, ...toAdd.map((c) => ({ id: c.id, fullname: c.fullname, cargo: c.cargo }))]);
    }
  };

  const isAreaSelected = (areaCollabs) =>
    areaCollabs.length > 0 && areaCollabs.every((c) => selected.some((s) => s.id === c.id));
  const isAreaPartial = (areaCollabs) =>
    areaCollabs.some((c) => selected.some((s) => s.id === c.id)) && !isAreaSelected(areaCollabs);

  // ── Envío ────────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError(null);
    try {
      // Calculate total hours from start and end time
      let totalHours = null;
      if (form.scheduled_time_start && form.scheduled_time_end) {
        const [startH, startM] = form.scheduled_time_start.split(':').map(Number);
        const [endH, endM] = form.scheduled_time_end.split(':').map(Number);
        totalHours = (endH + endM / 60) - (startH + startM / 60);
        if (totalHours < 0) totalHours += 24;
      }
      await onSubmit({
        event_type:         form.event_type,
        type:               form.type,
        title:              form.title,
        scheduled_date:     form.scheduled_date || null,
        scheduled_time_start: form.scheduled_time_start || null,
        scheduled_time_end: form.scheduled_time_end || null,
        duration_hours:     totalHours > 0 ? totalHours : (Number(form.duration_hours) + Number(form.duration_minutes) / 60) || null,
        location:           form.location  || null,
        area:               form.area      || null,
        modality:           form.modality,
        trainer_name:       form.type === "externa_instructor" ? (form.trainer_name || null) : null,
        trainer_type:       form.type === "interna" ? "interno" : "externo",
        attendees:          selected.map((s) => s.id),
        objectives:         form.objectives || null,
        material:           form.material || null,
      });
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "No se pudo crear la capacitación.");
    }
  };

  const stepStatus = (s) => (s < step ? "done" : s === step ? "active" : "locked");

  const STEP_TITLES = [
    "¿Qué actividad es y cuándo?",
    "¿Quiénes participan?",
  ];

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={onClose} title="" maxWidth="max-w-2xl" hideHeader>
      <div className="flex flex-col" style={{ maxHeight: "92dvh" }}>

        {/* Header */}
        <div className="flex flex-none items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
              Paso {step} de {STEPS.length}
            </p>
            <p className="text-base font-semibold text-[#1F2937]">
              {STEP_TITLES[step - 1]}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors">
            <FiX size={18} />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex flex-none items-start overflow-x-auto border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3">
          {STEPS.map((s, i) => (
            <StepNode key={s.id} step={s} status={stepStatus(s.id)} isLast={i === STEPS.length - 1} />
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* ── Paso 1: datos de agendamiento ── */}
          {step === 1 && (
            <>
              <div>
                <FieldLabel>¿Qué tipo de actividad es?</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPE_OPTS.map((o) => {
                    const active = form.event_type === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => field("event_type", o.value)}
                        className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                          active
                            ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-[#2563EB]/30"
                            : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#2563EB]/40"
                        }`}
                      >
                        {active && <FiCheck size={11} className="mr-1 inline" />}
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <FieldLabel>¿Quién la dicta?</FieldLabel>
                <div className="space-y-2">
                  {DELIVERY_TYPE_OPTS.map((o) => {
                    const active = form.type === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => field("type", o.value)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                          active
                            ? "border-[#2563EB] bg-[#EFF6FF] ring-1 ring-[#2563EB]/30"
                            : "border-[#E5E7EB] bg-white hover:border-[#2563EB]/40 hover:bg-[#F9FAFB]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 transition-colors ${active ? "border-[#2563EB] bg-[#2563EB]" : "border-[#D1D5DB]"}`}>
                            {active && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${active ? "text-[#1D4ED8]" : "text-[#1F2937]"}`}>{o.label}</p>
                            <p className="mt-0.5 text-xs text-[#6B7280]">{o.desc}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <FieldLabel>¿Cómo se llama? <span className="normal-case font-normal text-[#DC2626]">*</span></FieldLabel>
                <input
                  autoFocus
                  type="text"
                  className={inputCls}
                  placeholder="Ej. Taller de Seguridad Industrial"
                  value={form.title}
                  onChange={(e) => field("title", e.target.value)}
                />
              </div>

              <div>
                <FieldLabel>Área responsable</FieldLabel>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Ej. Producción, Administración, Ventas…"
                  value={form.area}
                  onChange={(e) => field("area", e.target.value)}
                />
              </div>

              <div>
                <FieldLabel>¿Cómo asisten los participantes?</FieldLabel>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {MODALITY_OPTS.map((o) => {
                    const active = form.modality === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => field("modality", o.value)}
                        className={`w-full rounded-xl border py-2.5 text-sm font-medium transition-all ${
                          active
                            ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-[#2563EB]/30"
                            : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#2563EB]/40"
                        }`}
                      >
                        {active && <FiCheck size={11} className="mr-1 inline" />}
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.type === "externa_instructor" && (
                <div>
                  <FieldLabel>Nombre del instructor externo</FieldLabel>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Nombre completo del instructor externo"
                    value={form.trainer_name}
                    onChange={(e) => field("trainer_name", e.target.value.toUpperCase())}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>¿Cuándo es? <span className="normal-case font-normal text-[#DC2626]">*</span></FieldLabel>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.scheduled_date}
                    onChange={(e) => field("scheduled_date", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Hora de inicio</FieldLabel>
                  <input
                    type="time"
                    className={inputCls}
                    value={form.scheduled_time_start}
                    onChange={(e) => field("scheduled_time_start", e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Hora de fin</FieldLabel>
                  <input
                    type="time"
                    className={inputCls}
                    value={form.scheduled_time_end}
                    onChange={(e) => field("scheduled_time_end", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>¿Dónde se realiza?</FieldLabel>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Sala de reuniones, plataforma virtual, dirección…"
                  value={form.location}
                  onChange={(e) => field("location", e.target.value)}
                />
              </div>

              <div>
                <FieldLabel>Objetivos de la capacitación</FieldLabel>
                <textarea
                  rows={2}
                  className={`${inputCls} resize-none`}
                  placeholder="Ej. Entender los protocolos de seguridad..."
                  value={form.objectives}
                  onChange={(e) => field("objectives", e.target.value)}
                />
              </div>

              <div>
                <FieldLabel>Material utilizado</FieldLabel>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Ej. Presentación interactiva, manual impreso..."
                  value={form.material}
                  onChange={(e) => field("material", e.target.value)}
                />
              </div>
            </>
          )}

          {/* ── Paso 2: participantes ── */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-[#9CA3AF]">
                    <FiSearch size={14} />
                  </span>
                  <input
                    autoFocus
                    type="text"
                    className={`${inputCls} pl-11`}
                    placeholder="Busca por nombre o correo…"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                  />
                </div>
                {selected.length > 0 && (
                  <span className="flex-none rounded-full bg-[#DBEAFE] px-2.5 py-1 text-xs font-semibold text-[#1D4ED8]">
                    {selected.length} {selected.length === 1 ? "persona" : "personas"}
                  </span>
                )}
              </div>

              {!searchQ && !loadingC && collabs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-[#9CA3AF]">Seleccionar:</span>
                  <button
                    type="button"
                    onClick={selectAll}
                    className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#374151] transition-colors hover:border-[#2563EB] hover:bg-[#EFF6FF] hover:text-[#1D4ED8]"
                  >
                    Todos ({collabs.length})
                  </button>
                  {groupedByArea?.map(([area, members]) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => toggleArea(members)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        isAreaSelected(members)
                          ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                          : isAreaPartial(members)
                          ? "border-[#93C5FD] bg-[#EFF6FF]/50 text-[#2563EB]"
                          : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#2563EB] hover:bg-[#EFF6FF] hover:text-[#1D4ED8]"
                      }`}
                    >
                      {isAreaSelected(members) && <FiCheck size={9} className="mr-0.5 inline" />}
                      {area} ({members.length})
                    </button>
                  ))}
                  {selected.length > 0 && (
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#9CA3AF] transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              )}

              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-2.5">
                  {selected.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-[#BFDBFE] bg-white px-2.5 py-1 text-xs font-medium text-[#1D4ED8] shadow-sm">
                      {s.fullname}
                      <button
                        type="button"
                        onClick={() => setSelected((prev) => prev.filter((p) => p.id !== s.id))}
                        className="ml-0.5 text-[#93C5FD] transition-colors hover:text-[#DC2626]"
                      >
                        <FiX size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white" style={{ maxHeight: 320, overflowY: "auto" }}>
                {loadingC ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#9CA3AF]">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
                    Cargando personas…
                  </div>
                ) : searchQ ? (
                  filtered.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[#9CA3AF]">No encontramos a nadie con ese nombre</p>
                  ) : filtered.slice(0, 100).map((c) => (
                    <CollabRow key={c.id} c={c} isSel={isSelected(c)} onToggle={toggle} />
                  ))
                ) : groupedByArea?.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#9CA3AF]">Sin colaboradores disponibles</p>
                ) : (
                  groupedByArea?.map(([area, members]) => (
                    <div key={area}>
                      <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">{area}</span>
                        <span className="text-[10px] text-[#9CA3AF]">{members.length} {members.length === 1 ? "persona" : "personas"}</span>
                      </div>
                      {members.map((c) => (
                        <CollabRow key={c.id} c={c} isSel={isSelected(c)} onToggle={toggle} />
                      ))}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#DC2626]">
              <span className="flex-none">⚠</span> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-none flex-col gap-3 border-t border-[#E5E7EB] bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={step === 1 ? onClose : goBack}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-all hover:bg-[#F9FAFB] active:scale-[0.97] sm:w-auto"
          >
            {step === 1 ? "Cancelar" : <><FiChevronLeft size={15} /> Anterior</>}
          </button>

          <div className="flex items-center justify-center gap-1.5">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className="rounded-full transition-all duration-300"
                style={{
                  width:  step === s.id ? 20 : 8,
                  height: 8,
                  background: step === s.id ? "#2563EB" : step > s.id ? "#93C5FD" : "#E5E7EB",
                }}
              />
            ))}
          </div>

          {step < STEPS.length ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#1D4ED8] active:scale-[0.97] sm:w-auto"
            >
              Continuar <FiChevronRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#1D4ED8] active:scale-[0.97] disabled:opacity-50 sm:w-auto"
            >
              {busy ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Agendando…</>
              ) : (
                <><FiCheck size={14} /> Agendar capacitación</>
              )}
            </button>
          )}
        </div>

      </div>
    </Modal>
  );
}
