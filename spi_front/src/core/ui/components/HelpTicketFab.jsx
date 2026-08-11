import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCamera,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
  FiHelpCircle,
  FiImage,
  FiLoader,
  FiMessageSquare,
  FiRefreshCw,
  FiSend,
  FiStar,
  FiUpload,
} from "react-icons/fi";
import {
  closeSupportTicketByRequester,
  createSupportTicket,
  getSupportTicketEvidenceFile,
  listMySupportTickets,
  listSupportTicketComments,
  rateSupportTicket,
  reopenSupportTicket,
} from "../../api/supportTicketsApi";
import { useUI } from "../UIContext";
import Button from "./Button";
import Modal from "./Modal";

const DRAFT_STORAGE_KEY = "spi_support_ticket_draft";
const DRAFT_FIELDS = ["ticket_type", "priority", "impact", "urgency", "category", "subcategory", "title", "description"];

const saveDraftToStorage = (formData) => {
  try {
    const draft = {};
    DRAFT_FIELDS.forEach((k) => { draft[k] = formData[k] || ""; });
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {}
};

const loadDraftFromStorage = () => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.title?.trim() && !parsed.description?.trim()) return null;
    return parsed;
  } catch { return null; }
};

const clearDraftFromStorage = () => {
  try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
};

const TYPE_OPTIONS = [
  { value: "fallo", label: "Fallo" },
  { value: "implementacion", label: "Implementación" },
  { value: "requerimiento", label: "Requerimiento" },
  { value: "problema", label: "Problema" },
];

const PRIORITY_OPTIONS = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

const LVL_OPTIONS = [
  { value: "bajo", label: "Bajo" },
  { value: "medio", label: "Medio" },
  { value: "alto", label: "Alto" },
];

const EMPTY_FORM = {
  ticket_type: "fallo",
  priority: "media",
  impact: "medio",
  urgency: "medio",
  category: "",
  subcategory: "",
  title: "",
  description: "",
  evidence_photos: [],
};

const fmtDate = (value) => {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("es-EC", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(value));
  } catch { return null; }
};

const badgeClassByStatus = {
  abierto: "bg-[#FEF3C7] text-[#B45309]",
  triage: "bg-[#DBEAFE] text-[#1D4ED8]",
  en_progreso: "bg-[#DBEAFE] text-[#1D4ED8]",
  en_espera: "bg-[#FEF3C7] text-[#B45309]",
  resuelto: "bg-[#DCFCE7] text-[#166534]",
  cerrado: "bg-[#F3F4F6] text-[#475569]",
  reabierto: "bg-[#FEE2E2] text-[#B91C1C]",
};

const statusLabel = (status) => {
  if (!status) return "-";
  return String(status).replaceAll("_", " ");
};

function FieldShell({ children, label, hint, error, className = "" }) {
  return (
    <label className={`flex min-w-0 flex-col gap-2 text-sm text-slate-700 ${className}`}>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
        {hint ? <span className="text-xs leading-relaxed text-slate-500">{hint}</span> : null}
      </div>
      {children}
      {error ? <span className="text-xs text-[#DC2626]">{error}</span> : null}
    </label>
  );
}

const HelpTicketFab = forwardRef(function HelpTicketFab(props, ref) {
  const { showToast } = useUI();
  const fileInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [myTickets, setMyTickets] = useState([]);
  const [busyTicketId, setBusyTicketId] = useState(null);
  const [evidenceLoadingId, setEvidenceLoadingId] = useState(null);
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [ticketComments, setTicketComments] = useState({});
  const [commentsLoading, setCommentsLoading] = useState(null);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);

  const canSubmit = useMemo(() => {
    return form.title.trim().length >= 5 && form.description.trim().length >= 10 && !submitting;
  }, [form.description, form.title, submitting]);

  const loadMyTickets = async () => {
    setLoadingMine(true);
    try {
      const tickets = await listMySupportTickets();
      setMyTickets(Array.isArray(tickets) ? tickets.slice(0, 8) : []);
    } catch (_error) {
      showToast("No se pudieron cargar tus tickets", "error");
    } finally {
      setLoadingMine(false);
    }
  };

  const handleExpandTicket = async (ticketId) => {
    if (expandedTicketId === ticketId) {
      setExpandedTicketId(null);
      return;
    }
    setExpandedTicketId(ticketId);
    if (!ticketComments[ticketId]) {
      setCommentsLoading(ticketId);
      try {
        const comments = await listSupportTicketComments(ticketId);
        setTicketComments((prev) => ({ ...prev, [ticketId]: Array.isArray(comments) ? comments : [] }));
      } catch {
        setTicketComments((prev) => ({ ...prev, [ticketId]: [] }));
      } finally {
        setCommentsLoading(null);
      }
    }
  };

  const handleOpen = async () => {
    setOpen(true);
    const isFormEmpty = !form.title.trim() && !form.description.trim() && !form.category.trim();
    if (isFormEmpty) {
      const draft = loadDraftFromStorage();
      if (draft) {
        setForm({ ...EMPTY_FORM, ...draft, evidence_photos: [] });
        showToast("Se recupero tu borrador guardado", "info");
      }
    }
    await loadMyTickets();
  };

  useImperativeHandle(ref, () => ({ open: () => handleOpen() }));

  const normalizeStatus = (value) => String(value || "").trim().toLowerCase();
  const isResolved = (status) => normalizeStatus(status) === "resuelto";
  const isClosed = (status) => normalizeStatus(status) === "cerrado";

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      saveDraftToStorage(next);
      return next;
    });
  };

  const resetForm = () => {
    photoPreviews.forEach(({ url }) => URL.revokeObjectURL(url));
    setPhotoPreviews([]);
    setForm(EMPTY_FORM);
    clearDraftFromStorage();
  };

  const handleCloseIntent = () => {
    if (submitting) return;
    setOpen(false);
    // Form state NOT reset — draft lives in memory + localStorage for next open
  };

  const handleSelectPhoto = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (files.length > 5) showToast("Puedes adjuntar hasta 5 evidencias", "warning");

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (files.some((file) => !allowed.includes(file.type))) {
      showToast("Todas las evidencias deben ser JPG, PNG o WEBP", "warning");
      event.target.value = "";
      return;
    }

    if (files.some((file) => file.size > 8 * 1024 * 1024)) {
      showToast("Cada evidencia puede pesar hasta 8 MB", "warning");
      event.target.value = "";
      return;
    }

    const selectedFiles = files.slice(0, 5);
    photoPreviews.forEach(({ url }) => URL.revokeObjectURL(url));
    setPhotoPreviews(selectedFiles.map((file) => ({ file, url: URL.createObjectURL(file) })));
    setForm((prev) => ({ ...prev, evidence_photos: selectedFiles }));
  };

  const handleRemovePhoto = (index) => {
    const removed = photoPreviews[index];
    if (removed?.url) URL.revokeObjectURL(removed.url);
    setPhotoPreviews((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setForm((prev) => ({
      ...prev,
      evidence_photos: prev.evidence_photos.filter((_, itemIndex) => itemIndex !== index),
    }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await createSupportTicket(form);
      showToast("Ticket enviado a TI", "success");
      resetForm();
      await loadMyTickets();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo registrar el ticket", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEvidence = async (attachment) => {
    const attachmentId = attachment?.id;
    if (!attachmentId) return;

    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      showToast("Habilita las ventanas emergentes para abrir la evidencia", "warning");
      return;
    }
    previewWindow.opener = null;
    previewWindow.document.title = "Cargando evidencia";
    previewWindow.document.body.textContent = "Cargando evidencia...";

    setEvidenceLoadingId(attachmentId);
    try {
      const { blob } = await getSupportTicketEvidenceFile(attachmentId);
      const objectUrl = URL.createObjectURL(blob);
      previewWindow.location.replace(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      previewWindow.close();
      showToast(error?.response?.data?.message || "No se pudo abrir la evidencia", "error");
    } finally {
      setEvidenceLoadingId(null);
    }
  };

  const handleCloseTicket = async (ticketId) => {
    setBusyTicketId(ticketId);
    try {
      await closeSupportTicketByRequester(ticketId, { comment: "Confirmado por solicitante" });
      showToast("Ticket cerrado", "success");
      await loadMyTickets();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cerrar", "error");
    } finally {
      setBusyTicketId(null);
    }
  };

  const handleReopenTicket = async (ticketId) => {
    const reason = window.prompt("Motivo de reapertura") || "";
    if (!reason.trim()) return;

    setBusyTicketId(ticketId);
    try {
      await reopenSupportTicket(ticketId, { reason });
      showToast("Ticket reabierto", "success");
      await loadMyTickets();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo reabrir", "error");
    } finally {
      setBusyTicketId(null);
    }
  };

  const handleRateTicket = async (ticketId) => {
    const scoreRaw = window.prompt("Califica atención del 1 al 5");
    const score = Number(scoreRaw);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      showToast("Calificación inválida", "warning");
      return;
    }

    const comment = window.prompt("Comentario opcional") || "";

    setBusyTicketId(ticketId);
    try {
      await rateSupportTicket(ticketId, { score, comment });
      showToast("Calificación registrada", "success");
      await loadMyTickets();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo calificar", "error");
    } finally {
      setBusyTicketId(null);
    }
  };

  return (
    <>
      {/* Trigger button: only visible on desktop; mobile uses MobileFabDock */}
      <div className="hidden sm:block fixed bottom-6 left-4 z-20">
        <button
          type="button"
          onClick={handleOpen}
          className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_15px_35px_rgba(15,23,42,0.12)] transition-transform duration-150 ease-out hover:bg-slate-50 active:scale-[0.97] [touch-action:manipulation]"
          title="Ayuda y soporte"
        >
          <FiHelpCircle size={22} />
        </button>
      </div>

      <Modal open={open} onClose={handleCloseIntent} closeOnBackdrop={false} disableClose={submitting} title="Soporte TI" maxWidth="max-w-5xl">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
          <section className="min-w-0 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-5">
            <div className="mb-5 flex flex-col gap-1">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[1.125rem] font-semibold leading-tight text-[#1F2937]">Registrar ticket</h3>
                {(form.title.trim() || form.description.trim()) && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="shrink-0 text-[11px] font-semibold text-slate-400 transition-colors hover:text-rose-500"
                  >
                    Limpiar borrador
                  </button>
                )}
              </div>
              <p className="text-sm leading-relaxed text-[#6B7280]">
                Describe el problema, requerimiento o implementación. Si tienes evidencia visual, adjúntala aquí.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <FieldShell label="Tipo">
                  <select
                    value={form.ticket_type}
                    onChange={(event) => handleChange("ticket_type", event.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] outline-none ring-0 transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </FieldShell>

                <FieldShell label="Prioridad">
                  <select
                    value={form.priority}
                    onChange={(event) => handleChange("priority", event.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] outline-none ring-0 transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </FieldShell>

                <FieldShell label="Impacto">
                  <select
                    value={form.impact}
                    onChange={(event) => handleChange("impact", event.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] outline-none ring-0 transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  >
                    {LVL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </FieldShell>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
                <FieldShell label="Urgencia">
                  <select
                    value={form.urgency}
                    onChange={(event) => handleChange("urgency", event.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] outline-none ring-0 transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  >
                    {LVL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </FieldShell>

                <FieldShell label="Categoría" hint="Ejemplo: ERP, correo, VPN, impresoras">
                  <input
                    value={form.category}
                    onChange={(event) => handleChange("category", event.target.value)}
                    placeholder="Área o sistema afectado"
                    className="min-h-[44px] w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] outline-none transition placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  />
                </FieldShell>
              </div>

              <FieldShell label="Asunto" hint="Resume el problema en una línea clara.">
                <input
                  value={form.title}
                  onChange={(event) => handleChange("title", event.target.value)}
                  placeholder="No puedo ingresar al sistema de inventario"
                  className="min-h-[44px] w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] outline-none transition placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  maxLength={180}
                  required
                />
              </FieldShell>

              <FieldShell label="Detalle" hint="Incluye contexto, pasos realizados y el resultado esperado.">
                <textarea
                  value={form.description}
                  onChange={(event) => handleChange("description", event.target.value)}
                  placeholder="Qué estabas haciendo, qué falló y desde cuándo ocurre."
                  className="min-h-[132px] w-full rounded-xl border border-[#D1D5DB] px-3 py-3 text-sm leading-relaxed text-[#1F2937] outline-none transition placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
                  required
                />
              </FieldShell>

              <FieldShell
                label="Evidencia fotográfica"
                hint="Opcional. Adjunta hasta 5 capturas o fotos. JPG, PNG o WEBP, máximo 8 MB por imagen."
              >
                <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-[#F8FAFC] p-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleSelectPhoto}
                  />

                  {photoPreviews.length ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-2 rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-semibold text-[#1D4ED8]">
                          <FiCamera size={13} /> {photoPreviews.length} evidencia{photoPreviews.length !== 1 ? "s" : ""}
                        </div>
                        <Button type="button" variant="secondary" size="sm" icon={FiUpload} onClick={() => fileInputRef.current?.click()}>
                          Cambiar selección
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {photoPreviews.map(({ file, url }, index) => (
                          <div key={`${file.name}-${file.lastModified}`} className="min-w-0 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
                            <img src={url} alt={`Vista previa de evidencia ${index + 1}`} className="h-28 w-full object-cover" />
                            <div className="space-y-2 p-3">
                              <p className="truncate text-xs font-semibold text-[#1F2937]">{file.name}</p>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] text-[#6B7280]">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                <button type="button" onClick={() => handleRemovePhoto(index)} className="cursor-pointer text-xs font-semibold text-[#DC2626] hover:underline">
                                  Quitar
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl bg-white px-5 py-8 text-center transition hover:bg-slate-50 active:scale-[0.99]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[#2563EB]">
                        <FiImage size={22} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[#1F2937]">Agregar foto de evidencia</p>
                        <p className="text-xs leading-relaxed text-[#6B7280]">
                          Úsala cuando el error se vea en pantalla, en un dispositivo o en un equipo físico.
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              </FieldShell>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#E5E7EB] pt-4">
                {(form.title.trim() || form.description.trim()) && (
                  <span className="mr-auto flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Borrador guardado
                  </span>
                )}
                <Button type="button" variant="ghost" onClick={handleCloseIntent} disabled={submitting}>
                  Cerrar
                </Button>
                <Button type="submit" variant="primary" icon={submitting ? FiLoader : FiSend} disabled={!canSubmit} className="min-w-[180px]">
                  {submitting ? "Enviando ticket" : "Enviar ticket"}
                </Button>
              </div>
            </form>
          </section>

          <aside className="min-w-0 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[1.125rem] font-semibold leading-tight text-[#1F2937]">Mis tickets recientes</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">Sigue su estado y confirma el cierre cuando TI resuelva el caso.</p>
              </div>
              <Button type="button" size="sm" variant="secondary" icon={FiRefreshCw} onClick={loadMyTickets} disabled={loadingMine}>
                Actualizar
              </Button>
            </div>

            {loadingMine ? (
              <div className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-5 text-sm text-[#64748B]">
                <FiLoader className="animate-spin text-[#2563EB]" />
                Cargando tickets...
              </div>
            ) : myTickets.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#D1D5DB] bg-[#F8FAFC] px-5 py-10 text-center">
                <FiAlertCircle size={24} className="text-[#94A3B8]" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#1F2937]">Aún no tienes tickets</p>
                  <p className="text-xs leading-relaxed text-[#6B7280]">Cuando registres uno, aparecerá aquí con su estado y evidencia adjunta.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {myTickets.map((ticket) => (
                  <article key={ticket.id} className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-[#64748B]">{ticket.code || `#${ticket.id}`}</p>
                        <h4 className="mt-1 line-clamp-2 text-sm font-semibold text-[#1F2937]">{ticket.title}</h4>
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${badgeClassByStatus[normalizeStatus(ticket.status)] || "bg-[#F3F4F6] text-[#475569]"}`}>
                        {statusLabel(ticket.status)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748B]">
                      <span className="rounded-full bg-[#F8FAFC] px-2.5 py-1 capitalize">{statusLabel(ticket.ticket_type)}</span>
                      {ticket.evidence_photos?.length ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#DBEAFE] px-2.5 py-1 font-semibold text-[#1D4ED8]">
                          <FiImage size={12} /> {ticket.evidence_photos.length} evidencia{ticket.evidence_photos.length !== 1 ? "s" : ""}
                        </span>
                      ) : null}
                      {ticket.comments_count > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F0FDF4] px-2.5 py-1 font-semibold text-[#166534]">
                          <FiMessageSquare size={11} /> {ticket.comments_count}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleExpandTicket(ticket.id)}
                        className="ml-auto inline-flex items-center gap-1 font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
                      >
                        {expandedTicketId === ticket.id ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                        {expandedTicketId === ticket.id ? "Ocultar" : "Ver detalle"}
                      </button>
                    </div>

                    {expandedTicketId === ticket.id && (
                      <div className="mt-3 space-y-3 border-t border-[#E5E7EB] pt-3">
                        <div>
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Descripción</div>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#374151]">{ticket.description}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                          {ticket.category ? (
                            <div className="col-span-2">
                              <span className="font-semibold text-[#6B7280]">Categoría: </span>
                              <span className="text-[#1F2937]">{ticket.category}{ticket.subcategory ? ` › ${ticket.subcategory}` : ""}</span>
                            </div>
                          ) : null}
                          <div>
                            <span className="font-semibold text-[#6B7280]">Prioridad: </span>
                            <span className="capitalize text-[#1F2937]">{ticket.priority || "-"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-[#6B7280]">Urgencia: </span>
                            <span className="capitalize text-[#1F2937]">{ticket.urgency || "-"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-[#6B7280]">Impacto: </span>
                            <span className="capitalize text-[#1F2937]">{ticket.impact || "-"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-[#6B7280]">Asignado a: </span>
                            <span className="text-[#1F2937]">{ticket.assigned_ti_name || "Sin asignar"}</span>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-[#6B7280]">
                          <div><span className="font-semibold">Creado: </span>{fmtDate(ticket.created_at) || "-"}</div>
                          {ticket.resolved_at && (
                            <div><span className="font-semibold">Resuelto: </span>{fmtDate(ticket.resolved_at)}</div>
                          )}
                          {ticket.on_hold_reason && (
                            <div><span className="font-semibold">Motivo en espera: </span>{ticket.on_hold_reason}</div>
                          )}
                        </div>

                        <div>
                          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">
                            Comentarios de TI
                          </div>
                          {commentsLoading === ticket.id ? (
                            <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                              <FiLoader size={12} className="animate-spin" /> Cargando...
                            </div>
                          ) : (ticketComments[ticket.id] || []).length ? (
                            <div className="space-y-2">
                              {(ticketComments[ticket.id]).map((comment) => (
                                <div key={comment.id} className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2">
                                  <div className="mb-1 flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold text-[#1F2937]">{comment.author_name}</span>
                                    <span className="text-[10px] text-[#94A3B8]">{fmtDate(comment.created_at)}</span>
                                  </div>
                                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#374151]">{comment.message}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-[#94A3B8]">Sin comentarios de TI aún.</p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      {isResolved(ticket.status) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          icon={FiCheckCircle}
                          disabled={busyTicketId === ticket.id}
                          onClick={() => handleCloseTicket(ticket.id)}
                        >
                          Confirmar cierre
                        </Button>
                      ) : null}

                      {(isResolved(ticket.status) || isClosed(ticket.status)) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busyTicketId === ticket.id}
                          onClick={() => handleReopenTicket(ticket.id)}
                        >
                          Reabrir
                        </Button>
                      ) : null}

                      {(isResolved(ticket.status) || isClosed(ticket.status)) ? (
                        ticket.satisfaction_score != null ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF9C3] px-2.5 py-1 text-[11px] font-semibold text-[#854D0E]">
                            <FiStar size={11} className="fill-[#CA8A04] text-[#CA8A04]" />
                            Calificado {ticket.satisfaction_score}/5
                            {ticket.satisfaction_comment ? ` · "${ticket.satisfaction_comment}"` : ""}
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            icon={FiStar}
                            disabled={busyTicketId === ticket.id}
                            onClick={() => handleRateTicket(ticket.id)}
                          >
                            Calificar
                          </Button>
                        )
                      ) : null}

                      {(ticket.evidence_photos || []).map((attachment, index) => (
                        <button
                          key={attachment.id}
                          type="button"
                          disabled={evidenceLoadingId === attachment.id}
                          onClick={() => handleOpenEvidence(attachment)}
                          className="inline-flex min-h-[36px] items-center gap-2 rounded-2xl px-3 py-1.5 text-sm font-semibold text-[#2563EB] transition hover:bg-[#EFF6FF]"
                        >
                          {evidenceLoadingId === attachment.id ? <FiLoader size={14} className="animate-spin" /> : <FiExternalLink size={14} />}
                          {evidenceLoadingId === attachment.id ? "Abriendo..." : `Evidencia ${index + 1}`}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      </Modal>
    </>
  );
});

export default HelpTicketFab;
