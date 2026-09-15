import React, { useCallback, useEffect, useState } from "react";
import { FiCheck, FiClock, FiInbox, FiRefreshCw, FiSearch, FiSend } from "react-icons/fi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import Button from "../../../core/ui/components/Button";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import {
  createInternalSuggestionBoxSubmission,
  getSuggestionBoxSubmission,
  listSuggestionBoxSubmissions,
  updateSuggestionBoxSubmissionStatus,
} from "../../../core/api/suggestionBoxApi";

const MANAGER_ROLES = new Set([
  "calidad",
  "jefe_calidad",
  "jefe_de_calidad",
  "gerencia",
  "gerencia_general",
  "gerente_general",
  "director",
  "gerente",
  "ti",
  "jefe_ti",
  "jefe_de_ti",
  "admin_ti",
  "admin",
  "administrador",
  "desarrollador",
  "soporte",
]);

const EMPTY_FORM = { submission_type: "suggestion", subject: "", message: "" };
const FIELD_CLASS = "w-full min-h-11 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none transition-colors duration-150 focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20";
const STATUS_LABELS = { received: "Recibido", in_review: "En revision", resolved: "Resuelto", closed: "Cerrado" };
const TYPE_LABELS = { suggestion: "Sugerencia", complaint: "Queja" };

const statusClass = (status) => ({
  received: "bg-[#FEF3C7] text-[#D97706]",
  in_review: "bg-[#DBEAFE] text-[#1D4ED8]",
  resolved: "bg-[#DCFCE7] text-[#16A34A]",
  closed: "bg-[#F3F4F6] text-[#1F2937]",
}[status] || "bg-[#F3F4F6] text-[#1F2937]");

const collectRoles = (user) => [user?.role, user?.scope, ...(user?.extra_roles || [])]
  .filter(Boolean)
  .map((value) => String(value).trim().toLowerCase());

export default function SuggestionBoxDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useUI();
  const roles = collectRoles(user);
  const canManage = roles.some((role) => MANAGER_ROLES.has(role));
  const [tab, setTab] = useState("send");
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("received");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ status: "", q: "" });

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const result = await listSuggestionBoxSubmissions(filters);
      setRows(result?.data || []);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar el buzon", "error");
    } finally {
      setLoading(false);
    }
  }, [canManage, filters, showToast]);

  useEffect(() => {
    if (tab === "manage") load();
  }, [load, tab]);

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    try {
      const result = await createInternalSuggestionBoxSubmission(form);
      showToast(`Mensaje enviado. Referencia: ${result?.data?.reference_code || "registrada"}`, "success");
      setForm(EMPTY_FORM);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo enviar el mensaje", "error");
    } finally {
      setSending(false);
    }
  };

  const selectSubmission = async (row) => {
    try {
      const result = await getSuggestionBoxSubmission(row.id);
      const data = result?.data;
      setSelected(data);
      setStatus(data?.status || "received");
      setNotes(data?.resolution_notes || "");
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo abrir el registro", "error");
    }
  };

  const saveStatus = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateSuggestionBoxSubmissionStatus(selected.id, { status, resolution_notes: notes });
      showToast("Seguimiento actualizado", "success");
      await selectSubmission(selected);
      await load();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo actualizar el seguimiento", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${WORKSPACE_PAGE_CLASS} gap-5`}>
      <header className="rounded-2xl bg-[#1E293B] px-5 py-5 text-white shadow-[0_15px_35px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium text-[#D1D5DB]">Canal interno</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight">Buzon de sugerencias y quejas</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#D1D5DB]">
              Registra mejoras y da seguimiento a mensajes recibidos por el canal publico e interno.
            </p>
          </div>
          <div className="grid w-full grid-cols-3 overflow-hidden rounded-2xl border border-white/15 text-center text-xs lg:w-auto">
            <div className="px-4 py-3">
              <p className="font-mono text-lg font-semibold">{rows.length}</p>
              <p className="text-[#D1D5DB]">Cargados</p>
            </div>
            <div className="border-x border-white/15 px-4 py-3">
              <p className="font-mono text-lg font-semibold">{rows.filter((row) => row.status === "received").length}</p>
              <p className="text-[#D1D5DB]">Nuevos</p>
            </div>
            <div className="px-4 py-3">
              <p className="font-mono text-lg font-semibold">{rows.filter((row) => row.status === "in_review").length}</p>
              <p className="text-[#D1D5DB]">En revision</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex gap-2 border-b border-[#E5E7EB]">
        <button
          type="button"
          onClick={() => setTab("send")}
          className={`min-h-11 cursor-pointer border-b-2 px-4 text-sm font-semibold transition-colors ${tab === "send" ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-[#6B7280] hover:text-[#1F2937]"}`}
        >
          Enviar mensaje
        </button>
        {canManage && (
          <button
            type="button"
            onClick={() => setTab("manage")}
            className={`min-h-11 cursor-pointer border-b-2 px-4 text-sm font-semibold transition-colors ${tab === "manage" ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-[#6B7280] hover:text-[#1F2937]"}`}
          >
            Gestionar buzon
          </button>
        )}
      </div>

      {tab === "send" && (
        <form onSubmit={submit} className="max-w-3xl rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium text-[#1F2937]">
              Tipo
              <select value={form.submission_type} onChange={(event) => setForm((current) => ({ ...current, submission_type: event.target.value }))} className={`${FIELD_CLASS} mt-1.5`}>
                <option value="suggestion">Sugerencia</option>
                <option value="complaint">Queja</option>
              </select>
            </label>
            <label className="text-sm font-medium text-[#1F2937]">
              Asunto
              <input required maxLength={160} value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} className={`${FIELD_CLASS} mt-1.5`} />
            </label>
          </div>
          <label className="mt-5 block text-sm font-medium text-[#1F2937]">
            Mensaje
            <textarea required maxLength={5000} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} className={`${FIELD_CLASS} mt-1.5 min-h-40 resize-y`} />
            <span className="mt-1 block text-right text-xs font-normal text-[#6B7280]">{form.message.length}/5000</span>
          </label>
          <div className="mt-5 flex justify-end">
            <Button type="submit" icon={FiSend} loading={sending}>Enviar al buzon</Button>
          </div>
        </form>
      )}

      {tab === "manage" && (
        <section className="grid min-h-0 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="min-w-0 rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            <div className="border-b border-[#E5E7EB] p-4">
              <div className="flex gap-2">
                <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className={FIELD_CLASS}>
                  <option value="">Todos los estados</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <button type="button" onClick={load} className="min-h-11 cursor-pointer rounded-xl border border-[#D1D5DB] px-3 text-[#6B7280] transition-colors hover:bg-[#F9FAFB]">
                  <FiRefreshCw className={loading ? "animate-spin" : ""} />
                </button>
              </div>
              <div className="relative mt-3">
                <FiSearch className="absolute left-3 top-3.5 text-[#6B7280]" size={16} />
                <input value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} onKeyDown={(event) => event.key === "Enter" && load()} placeholder="Buscar por asunto o referencia" className={`${FIELD_CLASS} pl-9`} />
              </div>
            </div>
            {loading ? (
              <p className="p-8 text-center text-sm text-[#6B7280]">Cargando registros</p>
            ) : rows.length === 0 ? (
              <div className="p-10 text-center text-[#6B7280]">
                <FiInbox className="mx-auto mb-3 text-[#D1D5DB]" size={32} />
                <p className="text-sm font-medium text-[#1F2937]">No hay registros</p>
                <p className="mt-1 text-xs">Cambia los filtros o espera nuevos mensajes.</p>
              </div>
            ) : (
              <div className="max-h-[620px] overflow-y-auto">
                {rows.map((row) => (
                  <button
                    type="button"
                    key={row.id}
                    onClick={() => selectSubmission(row)}
                    className={`block w-full cursor-pointer border-b border-[#E5E7EB] p-4 text-left transition-colors hover:bg-[#F9FAFB] ${selected?.id === row.id ? "bg-[#DBEAFE]/45" : ""}`}
                  >
                    <div className="flex justify-between gap-3">
                      <span className="font-mono text-xs font-semibold text-[#6B7280]">{row.reference_code}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}>{STATUS_LABELS[row.status]}</span>
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold text-[#1F2937]">{row.subject}</p>
                    <p className="mt-1 text-xs text-[#6B7280]">{TYPE_LABELS[row.submission_type]}, {new Date(row.created_at).toLocaleString("es-EC")}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            {!selected ? (
              <div className="flex min-h-80 flex-col items-center justify-center text-center text-[#6B7280]">
                <FiClock size={32} className="mb-3 text-[#D1D5DB]" />
                <p className="text-sm font-medium text-[#1F2937]">Selecciona un registro</p>
                <p className="mt-1 max-w-xs text-xs">El detalle, seguimiento y trazabilidad apareceran aqui.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-semibold text-[#2563EB]">{selected.reference_code}</p>
                    <h2 className="mt-1 text-xl font-semibold text-[#1F2937]">{selected.subject}</h2>
                  </div>
                  <span className={`h-fit rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(selected.status)}`}>{STATUS_LABELS[selected.status]}</span>
                </div>

                <dl className="mt-5 grid gap-3 rounded-xl bg-[#F9FAFB] p-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-[#6B7280]">Origen</dt>
                    <dd className="font-medium text-[#1F2937]">{selected.source === "internal" ? "Interno" : "Externo"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#6B7280]">Remitente</dt>
                    <dd className="font-medium text-[#1F2937]">{selected.reporter_name || selected.reporter_email || "No indicado"}</dd>
                  </div>
                </dl>

                <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-[#1F2937]">{selected.message}</p>

                <div className="mt-6 border-t border-[#E5E7EB] pt-5">
                  <h3 className="font-semibold text-[#1F2937]">Seguimiento</h3>
                  <select value={status} onChange={(event) => setStatus(event.target.value)} className={`${FIELD_CLASS} mt-3`}>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notas de atencion o resolucion" maxLength={5000} className={`${FIELD_CLASS} mt-3 min-h-28 resize-y`} />
                  <div className="mt-4 flex justify-end">
                    <Button icon={FiCheck} loading={saving} onClick={saveStatus}>Guardar seguimiento</Button>
                  </div>
                </div>

                <div className="mt-6 border-t border-[#E5E7EB] pt-5">
                  <h3 className="text-sm font-semibold text-[#1F2937]">Trazabilidad</h3>
                  <div className="mt-3 space-y-3">
                    {(selected.events || []).map((event) => (
                      <div key={event.id} className="rounded-xl bg-[#F9FAFB] px-3 py-2 text-xs text-[#6B7280]">
                        <p className="font-medium text-[#1F2937]">{event.event_type === "submission_created" ? "Mensaje recibido" : "Seguimiento actualizado"}</p>
                        <p>{new Date(event.created_at).toLocaleString("es-EC")}{event.created_by_name ? `, ${event.created_by_name}` : ""}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
