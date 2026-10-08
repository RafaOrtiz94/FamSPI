import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  FiAlertCircle,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiEyeOff,
  FiGlobe,
  FiInbox,
  FiMessageSquare,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiThumbsUp,
  FiUsers,
} from "react-icons/fi";
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

// Quien puede ver los reportes (tabs "Externos"/"Internos"). Espejo de MANAGER_ROLES
// en suggestionBox.service.js (backend) -- ese es el que realmente autoriza la API;
// esta lista solo decide que se muestra en pantalla.
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
  "talento_humano",
]);

const EMPTY_FORM = { submission_type: "suggestion", subject: "", message: "", is_anonymous: false };
const FIELD_CLASS = "w-full min-h-11 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none transition-all duration-150 focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10";
const STATUS_LABELS = { received: "Recibido", in_review: "En revision", resolved: "Resuelto", closed: "Cerrado" };
const STATUS_DOT = { received: "bg-[#D97706]", in_review: "bg-[#1D4ED8]", resolved: "bg-[#16A34A]", closed: "bg-[#9CA3AF]" };
const TYPE_LABELS = { suggestion: "Sugerencia", complaint: "Queja" };
const TYPE_ICON = { suggestion: FiThumbsUp, complaint: FiAlertCircle };
const EASE_OUT = [0.23, 1, 0.32, 1];

const statusClass = (status) => ({
  received: "bg-[#FEF3C7] text-[#D97706]",
  in_review: "bg-[#DBEAFE] text-[#1D4ED8]",
  resolved: "bg-[#DCFCE7] text-[#16A34A]",
  closed: "bg-[#F3F4F6] text-[#1F2937]",
}[status] || "bg-[#F3F4F6] text-[#1F2937]");

const collectRoles = (user) => [user?.role, user?.scope, ...(user?.extra_roles || [])]
  .filter(Boolean)
  .map((value) => String(value).trim().toLowerCase());

const TABS = [
  { id: "send", label: "Registrar", icon: FiSend, managerOnly: false },
  { id: "external", label: "Externos", icon: FiGlobe, managerOnly: true },
  { id: "internal", label: "Internos", icon: FiUsers, managerOnly: true },
];

export default function SuggestionBoxDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useUI();
  const prefersReducedMotion = useReducedMotion();
  const roles = collectRoles(user);
  const canManage = roles.some((role) => MANAGER_ROLES.has(role));
  const [tab, setTab] = useState("send");
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [sentReference, setSentReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("received");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ status: "", q: "" });

  const isReportTab = tab === "external" || tab === "internal";
  const visibleTabs = TABS.filter((item) => !item.managerOnly || canManage);

  const fadeIn = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25, ease: EASE_OUT } };

  const load = useCallback(async () => {
    if (!canManage || !isReportTab) return;
    setLoading(true);
    try {
      const result = await listSuggestionBoxSubmissions({ ...filters, source: tab });
      setRows(result?.data || []);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar el buzon", "error");
    } finally {
      setLoading(false);
    }
  }, [canManage, isReportTab, tab, filters, showToast]);

  useEffect(() => {
    setSelected(null);
    if (isReportTab) load();
  }, [load, tab, isReportTab]);

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    try {
      const result = await createInternalSuggestionBoxSubmission(form);
      setSentReference(result?.data?.reference_code || "registrada");
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
      <motion.header
        {...fadeIn}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E293B] via-[#1E293B] to-[#0F172A] px-5 py-6 text-white shadow-[0_15px_35px_rgba(15,23,42,0.12)] sm:px-7"
      >
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#2563EB]/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#93C5FD] ring-1 ring-white/15">
              <FiMessageSquare size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#93C5FD]">Canal interno</p>
              <h1 className="mt-1 text-2xl font-bold leading-tight">Buzón de sugerencias</h1>
              <p className="mt-2 max-w-lg text-sm leading-6 text-[#CBD5E1]">
                Registra una sugerencia o queja. Los reportes externos e internos se revisan por separado.
              </p>
            </div>
          </div>
          <AnimatePresence mode="wait">
            {isReportTab && (
              <motion.div
                key="stats"
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                className="grid w-full grid-cols-3 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.03] text-center text-xs backdrop-blur-sm lg:w-auto"
              >
                <div className="px-4 py-3">
                  <p className="font-mono text-lg font-semibold tabular-nums">{rows.length}</p>
                  <p className="text-[#93A3B8]">Cargados</p>
                </div>
                <div className="border-x border-white/15 px-4 py-3">
                  <p className="font-mono text-lg font-semibold tabular-nums text-[#FBBF24]">{rows.filter((row) => row.status === "received").length}</p>
                  <p className="text-[#93A3B8]">Nuevos</p>
                </div>
                <div className="px-4 py-3">
                  <p className="font-mono text-lg font-semibold tabular-nums text-[#60A5FA]">{rows.filter((row) => row.status === "in_review").length}</p>
                  <p className="text-[#93A3B8]">En revision</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.header>

      <div className="relative flex flex-wrap gap-1 border-b border-[#E5E7EB]">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`relative inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-4 text-sm font-semibold transition-colors ${tab === id ? "text-[#2563EB]" : "text-[#6B7280] hover:text-[#1F2937]"}`}
          >
            <Icon size={14} />
            {label}
            {tab === id && (
              <motion.span
                layoutId="suggestion-box-tab-underline"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#2563EB]"
                transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "send" && (
          <motion.div key="send" {...fadeIn} className="max-w-3xl">
            <AnimatePresence mode="wait">
              {sentReference ? (
                <motion.div
                  key="success"
                  initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                  className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-8"
                >
                  <motion.div
                    initial={prefersReducedMotion ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.05 }}
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#DCFCE7] text-[#16A34A]"
                  >
                    <FiCheckCircle size={26} />
                  </motion.div>
                  <h2 className="mt-5 text-xl font-semibold text-[#1F2937]">Mensaje registrado</h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#6B7280]">
                    Referencia <span className="font-mono font-semibold text-[#1F2937]">{sentReference}</span>. Puedes darle seguimiento desde el equipo responsable.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSentReference("")}
                    className="mt-6 min-h-11 cursor-pointer rounded-2xl bg-[#2563EB] px-5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#1D4ED8] active:scale-[0.97]"
                  >
                    Enviar otro mensaje
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={prefersReducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={prefersReducedMotion ? {} : { opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onSubmit={submit}
                  className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-6"
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="text-sm font-medium text-[#1F2937]">
                      Tipo
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        {Object.entries(TYPE_LABELS).map(([value, label]) => {
                          const Icon = TYPE_ICON[value];
                          const active = form.submission_type === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setForm((current) => ({ ...current, submission_type: value }))}
                              className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-all duration-150 active:scale-[0.97] ${
                                active
                                  ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                                  : "border-[#D1D5DB] bg-white text-[#6B7280] hover:border-[#9CA3AF]"
                              }`}
                            >
                              <Icon size={14} />
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </label>
                    <label className="text-sm font-medium text-[#1F2937]">
                      Asunto
                      <input required maxLength={160} value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} className={`${FIELD_CLASS} mt-1.5`} placeholder="Resume el tema en pocas palabras" />
                    </label>
                  </div>
                  <label className="mt-5 block text-sm font-medium text-[#1F2937]">
                    Mensaje
                    <textarea required maxLength={5000} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} className={`${FIELD_CLASS} mt-1.5 min-h-40 resize-y`} placeholder="Describe la situacion con el detalle que consideres necesario" />
                    <span className="mt-1 block text-right text-xs font-normal text-[#9CA3AF]">{form.message.length}/5000</span>
                  </label>

                  <label
                    className={`mt-5 flex cursor-pointer items-start gap-2.5 rounded-xl border p-3.5 text-sm transition-colors duration-150 ${
                      form.is_anonymous ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#E5E7EB] bg-[#F9FAFB]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.is_anonymous}
                      onChange={(event) => setForm((current) => ({ ...current, is_anonymous: event.target.checked }))}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#2563EB]"
                    />
                    <span className="text-[#1F2937]">
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <FiEyeOff size={13} className={form.is_anonymous ? "text-[#2563EB]" : "text-[#9CA3AF]"} />
                        Enviar de forma anónima
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-[#6B7280]">
                        Quien revise el buzón no vera tu nombre ni tu correo.
                      </span>
                    </span>
                  </label>

                  <div className="mt-5 flex justify-end">
                    <Button type="submit" icon={FiSend} loading={sending}>Enviar al buzon</Button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {isReportTab && (
          <motion.section key={tab} {...fadeIn} className="grid min-h-0 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="min-w-0 rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
              <div className="border-b border-[#E5E7EB] p-4">
                <div className="flex gap-2">
                  <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className={FIELD_CLASS}>
                    <option value="">Todos los estados</option>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <button type="button" onClick={load} className="min-h-11 shrink-0 cursor-pointer rounded-xl border border-[#D1D5DB] px-3 text-[#6B7280] transition-all duration-150 hover:border-[#9CA3AF] hover:bg-[#F9FAFB] active:scale-95">
                    <FiRefreshCw className={loading ? "animate-spin" : ""} />
                  </button>
                </div>
                <div className="relative mt-3">
                  <FiSearch className="absolute left-3 top-3.5 text-[#9CA3AF]" size={16} />
                  <input value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} onKeyDown={(event) => event.key === "Enter" && load()} placeholder="Buscar por asunto o referencia" className={`${FIELD_CLASS} pl-9`} />
                </div>
              </div>
              {loading ? (
                <div className="space-y-0.5 p-2">
                  {[0, 1, 2, 3].map((key) => (
                    <div key={key} className="animate-pulse space-y-2 p-3">
                      <div className="h-3 w-24 rounded bg-[#F1F5F9]" />
                      <div className="h-3.5 w-3/4 rounded bg-[#F1F5F9]" />
                      <div className="h-2.5 w-1/3 rounded bg-[#F1F5F9]" />
                    </div>
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                  className="p-10 text-center text-[#6B7280]"
                >
                  <FiInbox className="mx-auto mb-3 text-[#D1D5DB]" size={32} />
                  <p className="text-sm font-medium text-[#1F2937]">No hay registros</p>
                  <p className="mt-1 text-xs">Cambia los filtros o espera nuevos mensajes.</p>
                </motion.div>
              ) : (
                <div className="max-h-[620px] overflow-y-auto">
                  <AnimatePresence initial={false}>
                    {rows.map((row, index) => {
                      const isSelected = selected?.id === row.id;
                      return (
                        <motion.button
                          type="button"
                          key={row.id}
                          initial={prefersReducedMotion ? false : { opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: prefersReducedMotion ? 0 : Math.min(index, 8) * 0.02, ease: EASE_OUT }}
                          onClick={() => selectSubmission(row)}
                          className={`relative block w-full cursor-pointer border-b border-[#E5E7EB] p-4 text-left transition-colors duration-150 hover:bg-[#F9FAFB] ${isSelected ? "bg-[#EFF6FF]" : ""}`}
                        >
                          {isSelected && (
                            <motion.span layoutId="suggestion-box-row-accent" className="absolute inset-y-0 left-0 w-0.5 bg-[#2563EB]" transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} />
                          )}
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#6B7280]">
                              {row.status === "received" && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT.received} ${prefersReducedMotion ? "" : "animate-pulse"}`} />}
                              {row.reference_code}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}>{STATUS_LABELS[row.status]}</span>
                          </div>
                          <p className="mt-2 truncate text-sm font-semibold text-[#1F2937]">{row.subject}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#6B7280]">
                            {TYPE_LABELS[row.submission_type]}, {new Date(row.created_at).toLocaleString("es-EC")}
                            {row.is_anonymous && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-semibold text-[#6B7280]">
                                <FiEyeOff size={10} /> Anónimo
                              </span>
                            )}
                          </p>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div className="min-w-0 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
              <AnimatePresence mode="wait">
                {!selected ? (
                  <motion.div
                    key="empty"
                    initial={prefersReducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={prefersReducedMotion ? {} : { opacity: 0 }}
                    className="flex min-h-80 flex-col items-center justify-center text-center text-[#6B7280]"
                  >
                    <FiClock size={32} className="mb-3 text-[#D1D5DB]" />
                    <p className="text-sm font-medium text-[#1F2937]">Selecciona un registro</p>
                    <p className="mt-1 max-w-xs text-xs">El detalle, seguimiento y trazabilidad apareceran aqui.</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={selected.id}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? {} : { opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                  >
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-semibold text-[#2563EB]">{selected.reference_code}</p>
                        <h2 className="mt-1 text-xl font-semibold text-[#1F2937]">{selected.subject}</h2>
                      </div>
                      <span className={`h-fit rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(selected.status)}`}>{STATUS_LABELS[selected.status]}</span>
                    </div>

                    <dl className="mt-5 grid gap-3 rounded-xl bg-[#F9FAFB] p-4 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-[#6B7280]">Tipo</dt>
                        <dd className="mt-0.5 inline-flex items-center gap-1.5 font-medium text-[#1F2937]">
                          {(() => { const Icon = TYPE_ICON[selected.submission_type] || FiMessageSquare; return <Icon size={13} className="text-[#6B7280]" />; })()}
                          {TYPE_LABELS[selected.submission_type]}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[#6B7280]">Remitente</dt>
                        <dd className="mt-0.5 font-medium text-[#1F2937]">
                          {selected.is_anonymous ? (
                            <span className="inline-flex items-center gap-1 text-[#6B7280]">
                              <FiEyeOff size={12} /> Anónimo
                            </span>
                          ) : (
                            selected.reporter_name || selected.reporter_email || "No indicado"
                          )}
                        </dd>
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
                      <div className="mt-3 space-y-2">
                        {(selected.events || []).map((event, index) => (
                          <motion.div
                            key={event.id}
                            initial={prefersReducedMotion ? false : { opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.18, delay: prefersReducedMotion ? 0 : index * 0.03 }}
                            className="rounded-xl bg-[#F9FAFB] px-3 py-2 text-xs text-[#6B7280]"
                          >
                            <p className="font-medium text-[#1F2937]">{event.event_type === "submission_created" ? "Mensaje recibido" : "Seguimiento actualizado"}</p>
                            <p>{new Date(event.created_at).toLocaleString("es-EC")}{event.created_by_name ? `, ${event.created_by_name}` : ""}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
