import { useState, useEffect, useCallback } from "react";
import {
  fetchActivities,
  createActivity,
  completeActivity,
  updateActivity,
  uploadDocument,
  fetchOpportunities,
} from "../../../core/api/crmFamApi";
import SearchableSelect from "../../../core/ui/components/SearchableSelect";
import FileUploadZone from "../../../core/ui/components/FileUploadZone";

const LIMIT = 20;

const TYPE_LABELS = {
  llamada: "Llamada",
  reunion: "Reunion",
  email: "Email",
  visita: "Visita",
  demo: "Demo",
  propuesta: "Propuesta",
  seguimiento: "Seguimiento",
};

const STATUS_COLORS = {
  scheduled: { bg: "#EFF6FF", text: "#1D4ED8" },
  visited_pending_followup: { bg: "#FEF3C7", text: "#D97706" },
  completed: { bg: "#DCFCE7", text: "#16A34A" },
  cancelled: { bg: "#FEE2E2", text: "#DC2626" },
};

const STATUS_LABELS = {
  scheduled: "Programada",
  visited_pending_followup: "Visitada, pendiente de cierre",
  completed: "Completada",
  cancelled: "Cancelada",
};

const FOLLOWUP_LABELS = {
  pending_followup: "Pendiente de comentarios y resultado",
  incomplete_followup: "Cierre incompleto",
  completed: "Cierre registrado",
  not_applicable: "Sin seguimiento requerido",
};

const EMPTY_FORM = {
  activity_type: "",
  subject: "",
  scheduled_at: "",
  duration_minutes: "",
  description: "",
  opportunity_id: "",
};

function Skeleton() {
  const p = <div className="h-4 bg-gray-200 rounded w-3/4" />;
  return (
    <div className="grid gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-[18px] border border-[#E5E7EB] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            {p}
            <div className="h-6 w-24 rounded-full bg-gray-200" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="h-14 rounded-[14px] bg-gray-100" />
            <div className="h-14 rounded-[14px] bg-gray-100" />
            <div className="h-14 rounded-[14px] bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TypeBadge({ type }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-[6px] text-xs font-medium"
      style={{ background: "#F3F4F6", color: "#374151" }}
    >
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] ?? { bg: "#F3F4F6", text: "#374151" };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-[6px] text-xs font-medium"
      style={{ background: colors.bg, color: colors.text }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function NewActivityModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [opportunityOptions, setOpportunityOptions] = useState([]);

  useEffect(() => {
    fetchOpportunities({ limit: 500 })
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res?.data ?? []);
        setOpportunityOptions(rows.map((o) => ({ value: o.id, label: o.name })));
      })
      .catch(() => setOpportunityOptions([]));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.activity_type) { setErr("Tipo requerido"); return; }
    if (!form.subject.trim()) { setErr("Asunto requerido"); return; }
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        activity_type: form.activity_type,
        subject: form.subject.trim(),
        scheduled_at: form.scheduled_at || null,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        description: form.description || null,
        opportunity_id: form.opportunity_id || null,
      };
      await createActivity(payload);
      onSaved();
    } catch (ex) {
      setErr(ex.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[16px] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-[#1F2937]">Nueva actividad</h2>
        {err && (
          <div className="mb-3 rounded-[12px] border border-[#DC2626]/30 bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">
            {err}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#6B7280]">Tipo *</label>
            <select
              className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none"
              value={form.activity_type}
              onChange={set("activity_type")}
            >
              <option value="">Seleccionar tipo</option>
              {Object.entries(TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#6B7280]">Asunto *</label>
            <input
              className="w-full rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none"
              value={form.subject}
              onChange={set("subject")}
              placeholder="Asunto de la actividad"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#6B7280]">Fecha programada</label>
            <input
              type="datetime-local"
              className="w-full rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none"
              value={form.scheduled_at}
              onChange={set("scheduled_at")}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#6B7280]">Duracion (minutos)</label>
            <input
              type="number"
              min="0"
              className="w-full rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none"
              value={form.duration_minutes}
              onChange={set("duration_minutes")}
              placeholder="60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#6B7280]">Descripcion</label>
            <textarea
              rows={3}
              className="w-full resize-none rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none"
              value={form.description}
              onChange={set("description")}
              placeholder="Descripcion opcional"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#6B7280]">Oportunidad (opcional)</label>
            <SearchableSelect
              options={opportunityOptions}
              value={form.opportunity_id}
              onChange={(value) => setForm((f) => ({ ...f, opportunity_id: value }))}
              placeholder="Buscar oportunidad por nombre..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[12px] border border-[#E5E7EB] px-4 py-2 text-sm text-[#6B7280] hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[12px] bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompleteModal({ activity, onClose, onSaved }) {
  const [outcome, setOutcome] = useState(activity?.outcome || "");
  const [notes, setNotes] = useState(activity?.outcome_notes || "");
  const [nextStep, setNextStep] = useState(activity?.next_step || "");
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("evidencia_visita");
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      if (!outcome.trim()) {
        setErr("Registra que se logro con la visita.");
        setSaving(false);
        return;
      }
      if (!notes.trim()) {
        setErr("Agrega comentarios de la visita.");
        setSaving(false);
        return;
      }
      await completeActivity(activity.id, {
        outcome: outcome.trim(),
        outcome_notes: notes.trim(),
        next_step: nextStep.trim() || null,
      });
      if (evidenceFile) {
        const formData = new FormData();
        formData.append("file", evidenceFile);
        formData.append("activity_id", activity.id);
        formData.append("account_id", activity.account_id || "");
        formData.append("opportunity_id", activity.opportunity_id || "");
        formData.append("document_name", documentName.trim() || evidenceFile.name);
        formData.append("document_type", documentType);
        await uploadDocument(formData);
      }
      onSaved();
    } catch (ex) {
      setErr(ex.message || "Error al completar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[20px] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold text-[#1F2937]">Cerrar seguimiento de visita</h2>
        <p className="mb-4 text-sm text-[#6B7280]">{activity.subject}</p>
        {activity.visit_client_name && (
          <div className="mb-4 rounded-[16px] border border-[#FEF3C7] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
            La visita a <strong>{activity.visit_client_name}</strong> ya fue registrada en asistencia.
            Falta documentar comentarios, resultado y evidencia comercial.
          </div>
        )}
        {err && (
          <div className="mb-3 rounded-[12px] border border-[#DC2626]/30 bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">
            {err}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#6B7280]">Que se logro con la visita *</label>
            <textarea
              rows={3}
              className="w-full resize-none rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Ejemplo: se valido necesidad, se obtuvo compromiso de compra, se levanto requerimiento tecnico..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#6B7280]">Comentarios de la visita *</label>
            <textarea
              rows={4}
              className="w-full resize-none rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Registra acuerdos, objeciones, personas contactadas y contexto relevante."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#6B7280]">Proximo paso</label>
            <textarea
              rows={2}
              className="w-full resize-none rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="Ejemplo: enviar cotizacion, coordinar demo, levantar Business Case..."
            />
          </div>
          <div className="rounded-[16px] border border-[#E5E7EB] bg-white p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-[#1F2937]">Documento de evidencia opcional</p>
              <p className="mt-1 text-xs text-[#6B7280]">
                Adjunta actas, minutas, requerimientos o evidencia relacionada con la visita.
              </p>
            </div>
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#6B7280]">Nombre del documento</label>
                <input
                  className="min-h-10 w-full rounded-[12px] border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder={evidenceFile?.name || "Opcional"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#6B7280]">Tipo de documento</label>
                <select
                  className="min-h-10 w-full rounded-[12px] border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                >
                  <option value="evidencia_visita">Evidencia de visita</option>
                  <option value="acta_reunion">Acta / minuta</option>
                  <option value="requerimiento">Requerimiento</option>
                  <option value="cotizacion">Cotizacion</option>
                </select>
              </div>
            </div>
            <FileUploadZone
              id={`crm-activity-evidence-${activity.id}`}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              label="Guardar cierre y adjuntar"
              description="PDF, Office o imagen. Maximo 15 MB."
              file={evidenceFile}
              onFileChange={setEvidenceFile}
              onUpload={() => handleSubmit({ preventDefault: () => {} })}
              uploading={saving && Boolean(evidenceFile)}
              disabled={saving}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[12px] border border-[#E5E7EB] px-4 py-2 text-sm text-[#6B7280] hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[12px] bg-[#16A34A] px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar cierre"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CrmActivitiesPage() {
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit: LIMIT,
        offset,
        ...(typeFilter && { activity_type: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
      };
      const result = await fetchActivities(params);
      setData(result);
    } catch (ex) {
      setError(ex.message || "Error al cargar actividades");
    } finally {
      setLoading(false);
    }
  }, [offset, typeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const rows = Array.isArray(data) ? data : (data?.data ?? []);
  const total = Array.isArray(data) ? rows.length : (data?.total ?? rows.length);
  const hasNext = offset + LIMIT < total;
  const hasPrev = offset > 0;

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setOffset(0);
  };

  const handleCancel = useCallback(async (activity) => {
    if (!window.confirm(`Cancelar la actividad "${activity.subject}"?`)) return;
    try {
      await updateActivity(activity.id, { status: "cancelled" });
      load();
    } catch (ex) {
      alert(ex.message || "Error al cancelar");
    }
  }, [load]);

  const closeModal = useCallback(() => setModal(null), []);
  const onSaved = useCallback(() => { setModal(null); load(); }, [load]);

  const formatDate = (iso) => {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-full bg-[#F9FAFB] p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Actividades</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Seguimiento comercial conectado a visitas registradas en asistencia.
          </p>
        </div>
        <button
          onClick={() => setModal({ type: "new" })}
          className="rounded-[12px] bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nueva actividad
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <select
          className="rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none"
          value={typeFilter}
          onChange={handleFilterChange(setTypeFilter)}
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select
          className="rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#2563EB] focus:outline-none"
          value={statusFilter}
          onChange={handleFilterChange(setStatusFilter)}
        >
          <option value="">Todos los estados</option>
          <option value="scheduled">Programada</option>
          <option value="visited_pending_followup">Visitada pendiente de cierre</option>
          <option value="completed">Completada</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-[12px] border border-[#DC2626]/30 bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <Skeleton />
        ) : rows.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-[#CBD5E1] bg-white px-6 py-10 text-center">
            <p className="text-sm font-semibold text-[#1F2937]">Sin actividades</p>
            <p className="mt-1 text-sm text-[#6B7280]">
              Cuando una visita del cronograma se registre en asistencia, quedara aqui para documentar su cierre.
            </p>
          </div>
        ) : (
          rows.map((a) => {
            const needsFollowup = a.status === "visited_pending_followup" || a.followup_status === "incomplete_followup";
            const isScheduledVisit = a.activity_type === "visita" && Boolean(a.is_scheduled_visit);
            const documents = Array.isArray(a.documents) ? a.documents : [];
            const customerLabel = a.visit_client_name || a.account_name || a.opportunity_name || "Sin cliente vinculado";
            const visitDate = a.hora_salida || a.completed_at || a.scheduled_at || a.visit_date;

            return (
              <article
                key={a.id}
                className={`rounded-[20px] border bg-white p-4 shadow-sm transition hover:shadow-md ${
                  needsFollowup ? "border-[#F59E0B]/40 ring-1 ring-[#F59E0B]/10" : "border-[#E5E7EB]"
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeBadge type={a.activity_type} />
                      <StatusBadge status={a.status} />
                      {needsFollowup && (
                        <span className="rounded-full bg-[#FFFBEB] px-2.5 py-1 text-xs font-semibold text-[#B45309]">
                          Pendiente de cierre comercial
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2 break-words text-lg font-semibold text-[#0F172A]">{a.subject}</h2>
                    <p className="mt-1 text-sm text-[#64748B]">
                      {customerLabel} · {formatDate(visitDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {needsFollowup && (
                      <button
                        onClick={() => setModal({ type: "complete", activity: a })}
                        className="rounded-[12px] border border-[#16A34A] px-3 py-2 text-xs font-semibold text-[#15803D] hover:bg-[#DCFCE7]"
                      >
                        Registrar cierre
                      </button>
                    )}
                    {a.status === "scheduled" && !isScheduledVisit && (
                      <button
                        onClick={() => setModal({ type: "complete", activity: a })}
                        className="rounded-[12px] border border-[#16A34A] px-3 py-2 text-xs font-semibold text-[#15803D] hover:bg-[#DCFCE7]"
                      >
                        Completar
                      </button>
                    )}
                    {a.status === "scheduled" && !isScheduledVisit && (
                      <button
                        onClick={() => handleCancel(a)}
                        className="rounded-[12px] border border-[#DC2626] px-3 py-2 text-xs font-semibold text-[#DC2626] hover:bg-[#FEE2E2]"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>

                {needsFollowup && (
                  <div className="mt-4 rounded-[16px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
                    Visita registrada en asistencia. Falta completar comentarios, resultado de la visita y evidencia si aplica.
                  </div>
                )}

                {isScheduledVisit && a.status === "scheduled" && (
                  <div className="mt-4 rounded-[16px] border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1D4ED8]">
                    Esta visita viene del cronograma. Se marcara como realizada solo cuando el usuario registre la visita desde Asistencia.
                  </div>
                )}

                {(a.outcome || a.outcome_notes || a.next_step) && (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[16px] bg-[#F8FAFC] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Logro</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[#0F172A]">{a.outcome || "Pendiente"}</p>
                    </div>
                    <div className="rounded-[16px] bg-[#F8FAFC] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Comentarios</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[#0F172A]">{a.outcome_notes || "Pendiente"}</p>
                    </div>
                    <div className="rounded-[16px] bg-[#F8FAFC] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Proximo paso</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[#0F172A]">{a.next_step || "Sin siguiente paso"}</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-3 border-t border-[#E5E7EB] pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                    <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 font-medium">
                      {FOLLOWUP_LABELS[a.followup_status] || "Seguimiento sin evaluar"}
                    </span>
                    <span>{a.documents_count || 0} documento(s)</span>
                  </div>
                  {documents.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {documents.slice(0, 3).map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.drive_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-[#CBD5E1] px-3 py-1 text-xs font-medium text-[#2563EB] hover:bg-[#EFF6FF]"
                        >
                          {doc.document_name || "Documento"}
                        </a>
                      ))}
                      {documents.length > 3 && (
                        <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-xs text-[#64748B]">
                          +{documents.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {!loading && rows.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-[#6B7280]">
            {offset + 1}-{Math.min(offset + rows.length, total)} de {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={!hasPrev}
              onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
              className="rounded-[8px] border border-[#E5E7EB] px-3 py-1 text-sm text-[#1F2937] hover:bg-gray-50 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              disabled={!hasNext}
              onClick={() => setOffset((o) => o + LIMIT)}
              className="rounded-[8px] border border-[#E5E7EB] px-3 py-1 text-sm text-[#1F2937] hover:bg-gray-50 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {modal?.type === "new" && (
        <NewActivityModal onClose={closeModal} onSaved={onSaved} />
      )}
      {modal?.type === "complete" && (
        <CompleteModal activity={modal.activity} onClose={closeModal} onSaved={onSaved} />
      )}
    </div>
  );
}
