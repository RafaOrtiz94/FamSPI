import React, { useMemo, useState } from "react";
import { FiHelpCircle, FiLoader, FiSend, FiStar, FiX } from "react-icons/fi";
import {
 closeSupportTicketByRequester,
 createSupportTicket,
 listMySupportTickets,
 rateSupportTicket,
 reopenSupportTicket,
} from "../../api/supportTicketsApi";
import { useUI } from "../UIContext";

const TYPE_OPTIONS = [
 { value: "fallo", label: "Registrar fallo" },
 { value: "implementacion", label: "Nueva implementacion" },
 { value: "requerimiento", label: "Requerimiento" },
 { value: "problema", label: "Problema" },
];

const PRIORITY_OPTIONS = [
 { value: "baja", label: "Baja" },
 { value: "media", label: "Media" },
 { value: "alta", label: "Alta" },
 { value: "critica", label: "Critica" },
];

const LVL_OPTIONS = [
 { value: "bajo", label: "Bajo" },
 { value: "medio", label: "Medio" },
 { value: "alto", label: "Alto" },
];

const statusLabel = (status) => {
 if (!status) return "-";
 return String(status).replace("_", " ");
};

export default function HelpTicketFab() {
 const { showToast } = useUI();
 const [open, setOpen] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [loadingMine, setLoadingMine] = useState(false);
 const [myTickets, setMyTickets] = useState([]);
 const [busyTicketId, setBusyTicketId] = useState(null);

 const [form, setForm] = useState({
 ticket_type: "fallo",
 priority: "media",
 impact: "medio",
 urgency: "medio",
 category: "",
 subcategory: "",
 title: "",
 description: "",
 });

 const canSubmit = useMemo(() => {
 return form.title.trim().length >= 5 && form.description.trim().length >= 10 && !submitting;
 }, [form.title, form.description, submitting]);

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

 const handleOpen = async () => {
 setOpen(true);
 await loadMyTickets();
 };

 const isResolved = (status) => normalizeStatus(status) === "resuelto";
 const isClosed = (status) => normalizeStatus(status) === "cerrado";

 function normalizeStatus(value) {
 return String(value || "").trim().toLowerCase();
 }

 const handleChange = (field, value) => {
 setForm((prev) => ({ ...prev, [field]: value }));
 };

 const resetForm = () => {
 setForm({
 ticket_type: "fallo",
 priority: "media",
 impact: "medio",
 urgency: "medio",
 category: "",
 subcategory: "",
 title: "",
 description: "",
 });
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
 const scoreRaw = window.prompt("Califica atencion del 1 al 5");
 const score = Number(scoreRaw);
 if (!Number.isInteger(score) || score < 1 || score > 5) {
 showToast("Calificacion invalida", "warning");
 return;
 }
 const comment = window.prompt("Comentario opcional") || "";

 setBusyTicketId(ticketId);
 try {
 await rateSupportTicket(ticketId, { score, comment });
 showToast("Calificacion registrada", "success");
 await loadMyTickets();
 } catch (error) {
 showToast(error?.response?.data?.message || "No se pudo calificar", "error");
 } finally {
 setBusyTicketId(null);
 }
 };

 return (
 <div className="fixed bottom-20 left-3 z-[9998] sm:bottom-6 sm:left-4">
 <button
 onClick={handleOpen}
 className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-300"
 title="Ayuda y soporte"
 >
 <FiHelpCircle size={22} />
 </button>

 {open && (
 <div
 className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-900/40 p-3 sm:items-center sm:p-6"
 onMouseDown={(event) => {
 if (event.target === event.currentTarget) setOpen(false);
 }}
 >
 <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-2xl min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]">
 <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
 <div>
 <h3 className="text-sm font-semibold text-slate-900">Centro de Ayuda</h3>
 <p className="text-xs text-slate-500">Ticketing maduro para soporte TI, requerimientos e incidencias.</p>
 </div>
 <button
 onClick={() => setOpen(false)}
 className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
 >
 <FiX size={18} />
 </button>
 </div>

 <form onSubmit={handleSubmit} className="space-y-3 overflow-y-auto px-4 py-4 max-h-[52vh] sm:max-h-[48vh]">
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
 <label className="text-sm text-slate-700">
 Tipo
 <select
 value={form.ticket_type}
 onChange={(e) => handleChange("ticket_type", e.target.value)}
 className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"
 >
 {TYPE_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 </label>

 <label className="text-sm text-slate-700">
 Prioridad
 <select
 value={form.priority}
 onChange={(e) => handleChange("priority", e.target.value)}
 className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"
 >
 {PRIORITY_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 </label>

 <label className="text-sm text-slate-700">
 Impacto
 <select
 value={form.impact}
 onChange={(e) => handleChange("impact", e.target.value)}
 className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"
 >
 {LVL_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 </label>
 </div>

 <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
 <label className="text-sm text-slate-700">
 Urgencia
 <select
 value={form.urgency}
 onChange={(e) => handleChange("urgency", e.target.value)}
 className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"
 >
 {LVL_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 </label>

 <label className="text-sm text-slate-700 sm:col-span-2">
 Categoria
 <input
 value={form.category}
 onChange={(e) => handleChange("category", e.target.value)}
 placeholder="Ej: Acceso, ERP, VPN"
 className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"
 />
 </label>
 </div>

 <label className="block text-sm text-slate-700">
 Asunto
 <input
 value={form.title}
 onChange={(e) => handleChange("title", e.target.value)}
 placeholder="Describe brevemente el ticket"
 className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"
 maxLength={180}
 required
 />
 </label>

 <label className="block text-sm text-slate-700">
 Detalle
 <textarea
 value={form.description}
 onChange={(e) => handleChange("description", e.target.value)}
 placeholder="Incluye contexto, pasos y resultado esperado."
 className="mt-1 h-24 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"
 required
 />
 </label>

 <div className="flex items-center justify-end gap-2">
 <button
 type="button"
 onClick={() => setOpen(false)}
 className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
 >
 Cerrar
 </button>
 <button
 type="submit"
 disabled={!canSubmit}
 className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
 >
 {submitting ? <FiLoader className="animate-spin" /> : <FiSend />}
 Enviar ticket
 </button>
 </div>
 </form>

 <div className="border-t border-slate-200 px-4 py-3">
 <div className="mb-2 flex items-center justify-between">
 <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mis tickets recientes</p>
 <button
 type="button"
 onClick={loadMyTickets}
 className="text-xs text-blue-600 hover:text-blue-700"
 >
 Actualizar
 </button>
 </div>

 {loadingMine ? (
 <p className="text-xs text-slate-500">Cargando tickets...</p>
 ) : myTickets.length === 0 ? (
 <p className="text-xs text-slate-500">No tienes tickets registrados.</p>
 ) : (
 <div className="space-y-2 max-h-56 overflow-y-auto">
 {myTickets.map((ticket) => (
 <div key={ticket.id} className="rounded-lg border border-slate-200 px-3 py-2">
 <div className="flex items-center justify-between gap-2">
 <p className="text-xs font-semibold text-slate-800">{ticket.code || `#${ticket.id}`}</p>
 <span className="text-[11px] capitalize text-slate-500">{statusLabel(ticket.status)}</span>
 </div>
 <p className="line-clamp-1 text-xs text-slate-600">{ticket.title}</p>
 <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
 {isResolved(ticket.status) && (
 <button
 type="button"
 disabled={busyTicketId === ticket.id}
 onClick={() => handleCloseTicket(ticket.id)}
 className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-700"
 >
 Cerrar confirmado
 </button>
 )}
 {(isResolved(ticket.status) || isClosed(ticket.status)) && (
 <button
 type="button"
 disabled={busyTicketId === ticket.id}
 onClick={() => handleReopenTicket(ticket.id)}
 className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-700"
 >
 Reabrir
 </button>
 )}
 {(isResolved(ticket.status) || isClosed(ticket.status)) && (
 <button
 type="button"
 disabled={busyTicketId === ticket.id}
 onClick={() => handleRateTicket(ticket.id)}
 className="inline-flex items-center gap-1 rounded border border-violet-300 bg-violet-50 px-2 py-1 text-violet-700"
 >
 <FiStar size={12} />
 Calificar
 </button>
 )}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
