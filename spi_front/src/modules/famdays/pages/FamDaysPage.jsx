import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { getUsers } from '../../../core/api/usersApi';
import Modal from '../../../core/ui/components/Modal';
import famdaysApi from '../api/famdaysApi';

const FRONTEND_URL = process.env.REACT_APP_FRONTEND_URL || window.location.origin;

const emptyEvent = {
  name: 'FamDays',
  description: '',
  event_date: '',
  status: 'scheduled',
  moderation_active: true,
  is_open: false,
};

const emptyPresentation = {
  title: '',
  description: '',
  scheduled_start: '',
  scheduled_end: '',
  sort_order: 0,
};

function toDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function toDatetimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function statusLabel(status) {
  return {
    scheduled: 'Programado',
    active: 'Activo',
    pending: 'Pendiente',
  }[status] || status || 'Sin estado';
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename, headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  rows.forEach((row) => lines.push(row.map(csvEscape).join(',')));
  const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function EventQr({ eventId }) {
  const canvasRef = useRef(null);
  const [qr, setQr] = useState(null);
  const [busy, setBusy] = useState(false);
  const url = qr?.token ? `${FRONTEND_URL}/famdays/sala/${qr.token}` : '';

  const loadQr = useCallback(async () => {
    if (!eventId) return;
    const res = await famdaysApi.getActiveQr(eventId);
    setQr(res.data || null);
  }, [eventId]);

  useEffect(() => { loadQr().catch(() => {}); }, [loadQr]);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, { width: 180, margin: 1, color: { dark: '#102a43', light: '#ffffff' } });
  }, [url]);

  const regenerate = async () => {
    setBusy(true);
    try {
      const res = await famdaysApi.regenerateQr(eventId, {});
      setQr(res.data);
      toast.success('QR del evento actualizado');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo generar el QR');
    } finally {
      setBusy(false);
    }
  };

  const downloadQr = () => {
    if (!canvasRef.current || !url) return;
    const link = document.createElement('a');
    link.href = canvasRef.current.toDataURL('image/png');
    link.download = `famdays-qr-evento-${eventId}.png`;
    link.click();
  };

  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-600">QR unico del evento</p>
      <h3 className="mt-1 text-lg font-black text-slate-950">Entrada a preguntas FamDays</h3>
      <p className="mt-1 text-sm text-slate-500">
        Este codigo abre una sala general de preguntas para todo el evento. No se genera QR por presentacion.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
          {url ? <canvas ref={canvasRef} /> : <div className="flex h-[180px] w-[180px] items-center justify-center text-center text-sm text-slate-400">QR no generado</div>}
        </div>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={regenerate}
            disabled={busy}
            className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
          >
            {busy ? 'Generando...' : 'Generar / reemplazar QR'}
          </button>
          {url && (
            <button
              type="button"
              onClick={downloadQr}
              className="ml-2 mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-100 sm:mt-0"
            >
              Descargar QR
            </button>
          )}
          {url && <p className="mt-3 break-all rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">{url}</p>}
        </div>
      </div>
    </section>
  );
}

function EventQaPanel({ eventId, canModerate }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadQuestions = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await famdaysApi.getEventQuestions(eventId);
      setQuestions(res.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudieron cargar las preguntas');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const act = async (questionId, action) => {
    try {
      if (action === 'highlight') await famdaysApi.highlightQuestion(questionId);
      if (action === 'answer') await famdaysApi.answerQuestion(questionId);
      if (action === 'hide') await famdaysApi.hideQuestion(questionId);
      toast.success('Pregunta actualizada');
      await loadQuestions();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo actualizar la pregunta');
    }
  };

  return (
    <div className="mt-4 rounded-3xl border border-emerald-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Preguntas generales</p>
          <p className="text-xs text-slate-500">Una sola bandeja para presentadores y asistentes.</p>
        </div>
        <button type="button" onClick={loadQuestions} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
          Actualizar
        </button>
      </div>
      {loading ? (
        <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-400">Cargando preguntas...</div>
      ) : questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">Aun no hay preguntas registradas para el evento.</div>
      ) : (
        <div className="space-y-3">
          {questions.map((question) => (
            <article key={question.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">{question.display_name || 'Anonimo'}</span>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase text-slate-500">{statusLabel(question.status)}</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-700">{question.question_text}</p>
              {canModerate && question.status !== 'hidden' && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                  <button type="button" onClick={() => act(question.id, 'highlight')} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
                    Destacar
                  </button>
                  <button type="button" onClick={() => act(question.id, 'answer')} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                    Marcar respondida
                  </button>
                  <button type="button" onClick={() => act(question.id, 'hide')} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
                    Ocultar
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function EventConfigForm({ form, setForm, saving, onSave, submitLabel }) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={form.name || ''} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="Nombre del evento" />
        <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" type="date" value={form.event_date || ''} onChange={(e) => setForm((v) => ({ ...v, event_date: e.target.value }))} />
        <select className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={form.status || 'scheduled'} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))}>
          {['scheduled', 'active'].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
        </select>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {form.status === 'active'
            ? 'El QR queda abierto porque el evento esta activo.'
            : 'Se activara automaticamente en la fecha programada.'}
        </div>
      </div>
      <textarea className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" rows={3} value={form.description || ''} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} placeholder="Descripcion" />
      <button type="button" disabled={saving} onClick={onSave} className="mt-3 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60">
        {submitLabel}
      </button>
    </div>
  );
}

export default function FamDaysPage() {
  const [access, setAccess] = useState({ can_access: true, is_admin: false, is_configurator: false });
  const [event, setEvent] = useState(null);
  const [presentations, setPresentations] = useState([]);
  const [form, setForm] = useState(emptyEvent);
  const [presentationForm, setPresentationForm] = useState(emptyPresentation);
  const [users, setUsers] = useState([]);
  const [configuratorIds, setConfiguratorIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPresentationId, setEditingPresentationId] = useState(null);
  const [editForm, setEditForm] = useState(emptyPresentation);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const canConfigure = access.is_configurator;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const accessRes = await famdaysApi.getMyAccess();
      const nextAccess = accessRes.data || { can_access: true, is_admin: false, is_configurator: false };
      setAccess(nextAccess);
      const eventRes = nextAccess.is_configurator ? await famdaysApi.getAdminCurrentEvent() : await famdaysApi.getCurrentEvent();
      const nextEvent = eventRes.data;
      setEvent(nextEvent);
      setForm(nextEvent ? { ...nextEvent, event_date: toDateInput(nextEvent.event_date) } : emptyEvent);
      if (nextEvent?.id) {
        const presRes = await famdaysApi.getPresentations(nextEvent.id);
        setPresentations((presRes.data || []).map((p) => ({
          ...p,
          scheduled_start: toDatetimeInput(p.scheduled_start),
          scheduled_end: toDatetimeInput(p.scheduled_end),
        })));
      } else {
        setPresentations([]);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo cargar FamDays');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConfiguratorData = useCallback(async () => {
    if (!access.is_admin) return;
    try {
      const [userRows, configRows] = await Promise.all([
        getUsers({ active: true }),
        famdaysApi.listConfigurators(),
      ]);
      setUsers(Array.isArray(userRows) ? userRows : []);
      setConfiguratorIds((configRows.data || []).slice(0, 1).map((row) => Number(row.user_id)));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudieron cargar configuradores');
    }
  }, [access.is_admin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadConfiguratorData(); }, [loadConfiguratorData]);

  const saveEvent = async () => {
    if (!form.name || !form.event_date) {
      toast.error('Nombre y fecha son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, event_date: form.event_date, is_open: form.status === 'active' };
      const res = event?.id ? await famdaysApi.updateEvent(event.id, payload) : await famdaysApi.createEvent(payload);
      setEvent(res.data);
      toast.success('Evento guardado');
      setShowEventModal(false);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const addPresentation = async () => {
    if (!event?.id || !presentationForm.title) {
      toast.error('Crea el evento y agrega un titulo de presentacion');
      return;
    }
    setSaving(true);
    try {
      await famdaysApi.createPresentation(event.id, {
        ...presentationForm,
        scheduled_start: toIso(presentationForm.scheduled_start),
        scheduled_end: toIso(presentationForm.scheduled_end),
      });
      setPresentationForm(emptyPresentation);
      toast.success('Presentacion agregada');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo crear la presentacion');
    } finally {
      setSaving(false);
    }
  };

  const startEditPresentation = (presentation) => {
    setEditingPresentationId(presentation.id);
    setEditForm({
      title: presentation.title || '',
      description: presentation.description || '',
      scheduled_start: presentation.scheduled_start || '',
      scheduled_end: presentation.scheduled_end || '',
      sort_order: presentation.sort_order ?? 0,
    });
  };

  const cancelEditPresentation = () => {
    setEditingPresentationId(null);
    setEditForm(emptyPresentation);
  };

  const saveEditPresentation = async (presentationId) => {
    if (!editForm.title) {
      toast.error('El titulo es obligatorio');
      return;
    }
    setSaving(true);
    try {
      await famdaysApi.updatePresentation(presentationId, {
        ...editForm,
        scheduled_start: toIso(editForm.scheduled_start),
        scheduled_end: toIso(editForm.scheduled_end),
      });
      toast.success('Presentacion actualizada');
      cancelEditPresentation();
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo actualizar la presentacion');
    } finally {
      setSaving(false);
    }
  };

  const removePresentation = async (presentation) => {
    if (!window.confirm(`¿Eliminar la presentacion "${presentation.title}"? Esta accion no se puede deshacer.`)) {
      return;
    }
    setSaving(true);
    try {
      await famdaysApi.deletePresentation(presentation.id);
      toast.success('Presentacion eliminada');
      if (editingPresentationId === presentation.id) cancelEditPresentation();
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo eliminar la presentacion');
    } finally {
      setSaving(false);
    }
  };

  const openReport = async () => {
    if (!event?.id) return;
    setShowReportModal(true);
    setLoadingReport(true);
    try {
      const res = await famdaysApi.getEventSummary(event.id);
      setReport(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo cargar el reporte');
    } finally {
      setLoadingReport(false);
    }
  };

  const downloadReportCsv = () => {
    if (!report) return;
    const headers = ['Presentacion', 'Tipo', 'Autor', 'Texto', 'Estado', 'Respuesta'];
    const rows = [
      ...report.questions.map((q) => [
        q.presentation_title, 'Pregunta', q.display_name, q.question_text, q.status, q.answer_text || '',
      ]),
      ...report.aportes.map((a) => [
        a.presentation_title, 'Aporte', a.collaborator_name, a.aporte_text, a.status, a.avg_rating ?? '',
      ]),
    ];
    downloadCsv(`famdays-reporte-${event?.name || 'evento'}.csv`, headers, rows);
  };

  const toggleConfigurator = (userId) => {
    setConfiguratorIds((current) => current.includes(userId) ? [] : [userId]);
  };

  const saveConfigurators = async () => {
    if (configuratorIds.length !== 1) {
      toast.error('Selecciona un configurador para FamDays');
      return;
    }
    setSaving(true);
    try {
      const res = await famdaysApi.setConfigurators(configuratorIds.slice(0, 1));
      setConfiguratorIds((res.data || []).slice(0, 1).map((row) => Number(row.user_id)));
      toast.success('Configurador actualizado');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudieron guardar configuradores');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#f6fbf7] p-8 text-sm font-semibold text-slate-500">Cargando FamDays...</div>;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dff7e8,transparent_34%),linear-gradient(135deg,#f7fbf8,#eef7f2)] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 rounded-[2rem] border border-white/80 bg-white/90 p-8 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600">Famproject Cia. Ltda.</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">FamDays</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Evento con varias presentaciones y un solo codigo QR para una sala general de preguntas.
          </p>
        </header>

        {access.is_admin && (
          <section className="mb-6 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-600">Configuradores</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Selecciona quien configura FamDays</h2>
                <p className="mt-1 text-sm text-slate-500">Solo jefe_ti asigna al configurador. Esa persona presenta y configura todo el evento.</p>
              </div>
              <button type="button" disabled={saving} onClick={saveConfigurators} className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                Guardar configuradores
              </button>
            </div>
            <div className="mt-4 grid max-h-72 gap-2 overflow-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {users.map((candidate) => {
                const id = Number(candidate.id);
                return (
                  <label key={candidate.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm">
                    <input type="radio" name="famdays-configurator" checked={configuratorIds.includes(id)} onChange={() => toggleConfigurator(id)} className="mt-1" />
                    <span className="min-w-0">
                      <span className="block truncate font-black text-slate-800">{candidate.fullname || candidate.name || candidate.email}</span>
                      <span className="block truncate text-xs text-slate-500">{candidate.email || 'Sin correo'} - {candidate.role || 'Sin rol'}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {canConfigure && !event?.id && (
          <section className="mb-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Configuracion</p>
            <div className="mt-4">
              <EventConfigForm form={form} setForm={setForm} saving={saving} onSave={saveEvent} submitLabel="Crear evento" />
            </div>
          </section>
        )}

        {canConfigure && event?.id && (
          <section className="mb-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Configuracion</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">{event.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{event.description || 'Sin descripcion'}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-700">
                  {statusLabel(event.status)}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">Fecha: {toDateInput(event.event_date) || 'Sin fecha'}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowEventModal(true)}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700"
                >
                  Editar proyecto
                </button>
                <button
                  type="button"
                  onClick={openReport}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700"
                >
                  Ver reporte
                </button>
              </div>
            </div>
            <EventQr eventId={event.id} />
          </section>
        )}

        <Modal open={showEventModal} onClose={() => setShowEventModal(false)} title="Editar proyecto">
          <EventConfigForm form={form} setForm={setForm} saving={saving} onSave={saveEvent} submitLabel="Guardar evento" />
        </Modal>

        <Modal open={showReportModal} onClose={() => setShowReportModal(false)} title="Reporte FamDays" maxWidth="max-w-3xl">
          {loadingReport ? (
            <div className="p-4 text-sm font-semibold text-slate-500">Cargando reporte...</div>
          ) : !report ? (
            <div className="p-4 text-sm font-semibold text-slate-500">No se pudo cargar el reporte.</div>
          ) : (
            <div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-3 text-center">
                  <p className="text-2xl font-black text-slate-950">{report.stats.total_questions}</p>
                  <p className="text-xs font-semibold text-slate-500">Preguntas</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-center">
                  <p className="text-2xl font-black text-slate-950">{report.stats.answered_questions}</p>
                  <p className="text-xs font-semibold text-slate-500">Respondidas</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-center">
                  <p className="text-2xl font-black text-slate-950">{report.stats.total_aportes}</p>
                  <p className="text-xs font-semibold text-slate-500">Aportes</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-center">
                  <p className="text-2xl font-black text-slate-950">{report.stats.avg_rating_overall ?? '-'}</p>
                  <p className="text-xs font-semibold text-slate-500">Rating promedio</p>
                </div>
              </div>

              <button
                type="button"
                onClick={downloadReportCsv}
                className="mt-4 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
              >
                Descargar CSV
              </button>

              <p className="mt-5 text-xs font-black uppercase tracking-widest text-slate-400">Preguntas</p>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                {report.questions.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin preguntas registradas.</p>
                ) : report.questions.map((q) => (
                  <div key={q.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm">
                    <p className="text-xs font-black uppercase text-slate-400">{q.presentation_title} - {q.display_name}</p>
                    <p className="mt-1 text-slate-700">{q.question_text}</p>
                    {q.answer_text && <p className="mt-1 text-xs font-semibold text-emerald-700">Respuesta: {q.answer_text}</p>}
                  </div>
                ))}
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-widest text-slate-400">Aportes</p>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                {report.aportes.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin aportes registrados.</p>
                ) : report.aportes.map((a) => (
                  <div key={a.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm">
                    <p className="text-xs font-black uppercase text-slate-400">{a.presentation_title} - {a.collaborator_name}</p>
                    <p className="mt-1 text-slate-700">{a.aporte_text}</p>
                    {a.avg_rating != null && <p className="mt-1 text-xs font-semibold text-amber-700">Rating: {a.avg_rating}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>

        {event?.id && (
          <section className="mb-6 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <EventQaPanel eventId={event.id} canModerate={canConfigure} />
          </section>
        )}

        {canConfigure && event?.id && (
          <section className="mb-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Nueva presentacion</p>
            <p className="mt-1 text-sm text-slate-500">El presentador sera el configurador asignado al evento completo.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm md:col-span-2" value={presentationForm.title} onChange={(e) => setPresentationForm((v) => ({ ...v, title: e.target.value }))} placeholder="Titulo" />
              <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" type="datetime-local" value={presentationForm.scheduled_start} onChange={(e) => setPresentationForm((v) => ({ ...v, scheduled_start: e.target.value }))} />
              <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" type="datetime-local" value={presentationForm.scheduled_end} onChange={(e) => setPresentationForm((v) => ({ ...v, scheduled_end: e.target.value }))} />
              <input className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" type="number" value={presentationForm.sort_order} onChange={(e) => setPresentationForm((v) => ({ ...v, sort_order: Number(e.target.value) }))} placeholder="Orden" />
            </div>
            <textarea className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" rows={2} value={presentationForm.description} onChange={(e) => setPresentationForm((v) => ({ ...v, description: e.target.value }))} placeholder="Descripcion breve" />
            <button type="button" disabled={saving} onClick={addPresentation} className="mt-3 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60">Agregar presentacion</button>
          </section>
        )}

        <section className="rounded-[2rem] border border-white bg-white/95 p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-600">Agenda</p>
              <h2 className="text-2xl font-black text-slate-950">{event?.name || 'No hay evento activo'}</h2>
            </div>
            {event && <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-700">{statusLabel(event.status)}</span>}
          </div>
          {!canConfigure ? (
            <div className="rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/50 p-8 text-center text-sm font-semibold text-slate-600">
              {event
                ? (event.status === 'active'
                  ? 'El evento esta activo. Escanea el codigo QR que proyecta el organizador para entrar a la sala general de preguntas.'
                  : 'Este evento aun no esta activo. Cuando comience, escanea el codigo QR que proyecte el organizador para participar.')
                : 'Aun no hay un evento FamDays programado.'}
            </div>
          ) : presentations.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Aun no hay presentaciones registradas.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {presentations.map((presentation) => (
                <article key={presentation.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                  {editingPresentationId === presentation.id ? (
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Editando presentacion</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-5">
                        <input
                          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm md:col-span-2"
                          value={editForm.title}
                          onChange={(e) => setEditForm((v) => ({ ...v, title: e.target.value }))}
                          placeholder="Titulo"
                        />
                        <input
                          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                          type="datetime-local"
                          value={editForm.scheduled_start}
                          onChange={(e) => setEditForm((v) => ({ ...v, scheduled_start: e.target.value }))}
                        />
                        <input
                          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                          type="datetime-local"
                          value={editForm.scheduled_end}
                          onChange={(e) => setEditForm((v) => ({ ...v, scheduled_end: e.target.value }))}
                        />
                        <input
                          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                          type="number"
                          value={editForm.sort_order}
                          onChange={(e) => setEditForm((v) => ({ ...v, sort_order: Number(e.target.value) }))}
                          placeholder="Orden"
                        />
                      </div>
                      <textarea
                        className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                        rows={2}
                        value={editForm.description}
                        onChange={(e) => setEditForm((v) => ({ ...v, description: e.target.value }))}
                        placeholder="Descripcion breve"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => saveEditPresentation(presentation.id)}
                          className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-white disabled:opacity-60"
                        >
                          Guardar cambios
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={cancelEditPresentation}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Presentacion #{presentation.sort_order}</p>
                          <h3 className="mt-1 text-lg font-black text-slate-950">{presentation.title}</h3>
                          <p className="mt-1 text-sm text-slate-500">{presentation.description || 'Sin descripcion'}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                          {presentation.scheduled_start ? presentation.scheduled_start.replace('T', ' ') : 'Sin horario'}
                        </span>
                      </div>
                      {canConfigure && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditPresentation(presentation)}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700"
                          >
                            Editar / reagendar
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => removePresentation(presentation)}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black text-rose-700 disabled:opacity-60"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
