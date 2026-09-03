import React, { useState, useEffect, useCallback } from 'react';
import kickoffApi from '../api/kickoffApi';
import { isoToInputEc, inputEcToIso } from '../api/kickoffDateUtils';
import { getUsers } from '../../../core/api/usersApi';
import toast from 'react-hot-toast';

// ── Status labels ─────────────────────────────────────────────────────────────

const EVENT_STATUS_LABELS = {
  draft:     'Borrador',
  scheduled: 'Programado',
  active:    'En curso',
  paused:    'Pausado',
  finished:  'Finalizado',
  cancelled: 'Cancelado',
};

const PRES_STATUS_LABELS = {
  pending:          'Pendiente',
  ready:            'Listo',
  active:           'En presentación',
  questions_open:   'Preguntas abiertas',
  questions_closed: 'Preguntas cerradas',
  finished:         'Finalizada',
  skipped:          'Omitida',
};

// ── Canva URL parser ──────────────────────────────────────────────────────────
// Accepts: HTML embed code, smart link URL, or direct embed URL
function parseCanvaInput(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  // HTML embed code — extract src from <iframe>
  const srcMatch = s.match(/src=["']([^"']*canva\.com[^"']*)["']/);
  if (srcMatch) {
    const base = srcMatch[1].split('?')[0];
    return { canva_url: base, canva_embed_url: base + '?embed' };
  }
  // Plain URL
  if (s.startsWith('http')) {
    const base = s.split('?')[0];
    return { canva_url: base, canva_embed_url: base + '?embed' };
  }
  return null;
}

const EMPTY_EVENT = { name: 'Kick Off 2026', description: '', event_date: '', status: 'draft', moderation_active: true };
const EMPTY_PRES  = { title: '', description: '', scheduled_start: '', scheduled_end: '', canva_url: '', canva_embed_url: '', fallback_url: '', sort_order: 0, presenter_user_id: '', is_intro: false };

export default function KickoffAdminConfig({ eventId, onBack }) {
  const [event,        setEvent]       = useState(null);
  const [presArr,      setPresArr]     = useState([]);
  const [users,        setUsers]       = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [saving,       setSaving]      = useState(false);
  const [tab,          setTab]         = useState('event');
  const [newPres,      setNewPres]     = useState(EMPTY_PRES);
  const [editPres,     setEditPres]    = useState(null);
  const [canvaRaw,     setCanvaRaw]    = useState('');
  const [canvaEditRaw, setCanvaEditRaw] = useState('');

  // ── data loading ─────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      let evtData = null, presData = [];
      const toFormDates = (arr) => arr.map(p => ({
        ...p,
        scheduled_start: isoToInputEc(p.scheduled_start),
        scheduled_end:   isoToInputEc(p.scheduled_end),
      }));

      if (eventId) {
        const [evtRes, presRes] = await Promise.all([
          kickoffApi.getEvent(eventId),
          kickoffApi.getPresentations(eventId),
        ]);
        evtData  = evtRes.data;
        presData = toFormDates(presRes.data || []);
      } else {
        const evtRes = await kickoffApi.getAdminCurrentEvent();
        evtData = evtRes.data;
        if (evtData?.id) {
          const presRes = await kickoffApi.getPresentations(evtData.id);
          presData = toFormDates(presRes.data || []);
        }
      }
      if (evtData) setEvent(evtData);
      setPresArr(presData);
    } catch { toast.error('Error al cargar datos del evento'); }
    finally { setLoading(false); }
  }, [eventId]);


  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    getUsers().then(u => setUsers(Array.isArray(u) ? u : [])).catch(() => {});
  }, []);

  // ── event handlers ───────────────────────────────────────────────────────────

  const saveEvent = async () => {
    if (!event?.event_date) { toast.error('La fecha del evento es obligatoria'); return; }
    setSaving(true);
    try {
      if (event?.id) {
        const res = await kickoffApi.updateEvent(event.id, event);
        setEvent(res.data);
        toast.success('Evento actualizado');
      } else {
        const res = await kickoffApi.createEvent(event || EMPTY_EVENT);
        setEvent(res.data);
        toast.success('Evento creado');
      }
      await loadAll();
    } catch (err) { toast.error(err?.response?.data?.message || 'Error al guardar evento'); }
    finally { setSaving(false); }
  };

  const deleteEvent = async () => {
    if (!event?.id) return;
    if (!window.confirm(`¿Eliminar el evento "${event.name}"?\n\nEsta acción eliminará también todas las presentaciones, bloques y preguntas asociadas. No se puede deshacer.`)) return;
    setSaving(true);
    try {
      await kickoffApi.deleteEvent(event.id);
      setEvent(null);
      setPresArr([]);
      setEditPres(null);
      toast.success('Evento eliminado');
    } catch (err) { toast.error(err?.response?.data?.message || 'No se pudo eliminar el evento'); }
    finally { setSaving(false); }
  };

  // ── presentation handlers ─────────────────────────────────────────────────────

  const presPayload = (pres) => ({
    ...pres,
    scheduled_start: inputEcToIso(pres.scheduled_start),
    scheduled_end:   inputEcToIso(pres.scheduled_end),
  });

  const addPresentation = async () => {
    if (!event?.id) { toast.error('Crea el evento primero'); return; }
    if (!newPres.title) { toast.error('El título es obligatorio'); return; }
    setSaving(true);
    try {
      await kickoffApi.createPresentation(event.id, presPayload(newPres));
      setNewPres(EMPTY_PRES);
      setCanvaRaw('');
      toast.success('Presentación agregada');
      await loadAll();
    } catch (err) { toast.error(err?.response?.data?.message || 'Error al crear presentación'); }
    finally { setSaving(false); }
  };

  const saveEditPres = async () => {
    if (!editPres?.id) return;
    if (!editPres.title) { toast.error('El título es obligatorio'); return; }
    setSaving(true);
    try {
      await kickoffApi.updatePresentation(editPres.id, presPayload(editPres));
      setEditPres(null);
      setCanvaEditRaw('');
      toast.success('Presentación actualizada');
      await loadAll();
    } catch (err) { toast.error(err?.response?.data?.message || 'Error al actualizar presentación'); }
    finally { setSaving(false); }
  };

  const deletePres = async (pres) => {
    if (!window.confirm(`¿Eliminar la presentación "${pres.title}"?\n\nSe eliminarán también sus bloques y preguntas asociadas.`)) return;
    try {
      await kickoffApi.deletePresentation(pres.id);
      if (editPres?.id === pres.id) { setEditPres(null); setCanvaEditRaw(''); }
      toast.success('Presentación eliminada');
      await loadAll();
    } catch (err) { toast.error(err?.response?.data?.message || 'No se pudo eliminar'); }
  };

  const genQr = async (presId) => {
    try {
      await kickoffApi.regenerateQr(presId, { expires_in_hours: 12 });
      toast.success('QR generado / actualizado (válido 12 h)');
    } catch { toast.error('Error al generar QR'); }
  };

  // ── canva helpers ─────────────────────────────────────────────────────────────

  const applyCanva = (raw, forEdit) => {
    const parsed = parseCanvaInput(raw);
    if (forEdit) {
      setCanvaEditRaw(raw);
      if (parsed) setEditPres(v => ({ ...v, canva_url: parsed.canva_url, canva_embed_url: parsed.canva_embed_url }));
    } else {
      setCanvaRaw(raw);
      if (parsed) setNewPres(v => ({ ...v, canva_url: parsed.canva_url, canva_embed_url: parsed.canva_embed_url }));
    }
  };

  // ── render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              ← Todos los eventos
            </button>
          )}
          <h2 className="text-xl font-bold text-slate-900">
            {event?.name || 'Nuevo evento'}
          </h2>
        </div>
        <span className="text-xs text-slate-400">Solo visible para administradores</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {[['event','Evento'], ['presentations','Presentaciones']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Event tab ──────────────────────────────────────────────────────────── */}
      {tab === 'event' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4">
          {event?.id && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2">
              <span>ID:</span><strong className="text-slate-600">#{event.id}</strong>
              <span className="ml-auto">Estado actual: <strong className="text-slate-700">{event.status}</strong></span>
            </div>
          )}
          <Field label="Nombre del evento">
            <input value={event?.name || ''} onChange={e => setEvent(v => ({ ...v, name: e.target.value }))}
              className={inputCls} placeholder="Kick Off 2026" />
          </Field>
          <Field label="Descripción">
            <textarea value={event?.description || ''} onChange={e => setEvent(v => ({ ...v, description: e.target.value }))}
              rows={3} className={inputCls} placeholder="Descripción del evento…" />
          </Field>
          <Field label="Fecha del evento *">
            <input type="date" value={event?.event_date?.split?.('T')[0] || ''}
              onChange={e => setEvent(v => ({ ...v, event_date: e.target.value }))}
              className={inputCls} required />
          </Field>
          <Field label="Estado">
            <select value={event?.status || 'draft'} onChange={e => setEvent(v => ({ ...v, status: e.target.value }))} className={inputCls}>
              {Object.entries(EVENT_STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer select-none">
            <input type="checkbox" checked={event?.moderation_active ?? true}
              onChange={e => setEvent(v => ({ ...v, moderation_active: e.target.checked }))}
              className="w-4 h-4 accent-blue-600" />
            Moderación activa (las preguntas pasan por revisión antes de ser públicas)
          </label>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={event?.is_open ?? false}
              onChange={e => setEvent(v => ({ ...v, is_open: e.target.checked }))}
              className="w-4 h-4 accent-green-600" />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-slate-700">
                🌐 Abrir módulo a todos los colaboradores
              </span>
              <span className="text-xs text-slate-400">
                Cuando está activo, cualquier usuario autenticado puede ver el cronograma y participar. Actívalo el día del evento.
              </span>
            </span>
          </label>
          <div className="flex items-center gap-3 pt-2 flex-wrap">
            <button disabled={saving} onClick={saveEvent}
              className="px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? 'Guardando…' : event?.id ? 'Actualizar evento' : 'Crear evento'}
            </button>
            {event?.id && (
              <button disabled={saving} onClick={deleteEvent}
                className="px-4 py-2.5 text-sm font-semibold bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors border border-red-200 disabled:opacity-50">
                Eliminar evento
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Presentations tab ──────────────────────────────────────────────────── */}
      {tab === 'presentations' && (
        <div className="flex flex-col gap-6">

          {/* Table of existing presentations */}
          {presArr.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    {['#','Título','Presentador','Estado','Acciones'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {presArr.map((p, i) => (
                    <tr key={p.id} className={`hover:bg-slate-50 ${editPres?.id === p.id ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800 max-w-[180px]">
                        <span className="truncate block">{p.title}</span>
                        {p.is_intro && (
                          <span className="mt-0.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Introducción
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{p.presenter_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-100 rounded-full px-2 py-0.5">{PRES_STATUS_LABELS[p.status] || p.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 whitespace-nowrap">
                          <button onClick={() => { setEditPres({ ...p }); setCanvaEditRaw(''); }}
                            className="text-xs text-blue-600 hover:underline font-medium">Editar</button>
                          <button onClick={() => deletePres(p)}
                            className="text-xs text-red-500 hover:underline">Eliminar</button>
                          <button onClick={() => genQr(p.id)}
                            className="text-xs text-purple-600 hover:underline">QR</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Edit form (inline) */}
          {editPres && (
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-blue-900 text-sm">Editando: <em>{editPres.title}</em></h3>
                <button onClick={() => { setEditPres(null); setCanvaEditRaw(''); }}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium">✕ Cancelar</button>
              </div>
              <PresForm pres={editPres} onChange={setEditPres} users={users}
                canvaRaw={canvaEditRaw} onCanvaChange={raw => applyCanva(raw, true)} />
              <button disabled={saving || !editPres.title} onClick={saveEditPres}
                className="self-start px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>

            </div>
          )}

          {/* Add new presentation */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4">
            <h3 className="font-semibold text-slate-800 text-sm">Agregar nueva presentación</h3>
            <PresForm pres={newPres} onChange={setNewPres} users={users}
              canvaRaw={canvaRaw} onCanvaChange={raw => applyCanva(raw, false)} />
            <button disabled={saving || !newPres.title || !event?.id} onClick={addPresentation}
              className="self-start px-6 py-2.5 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">
              {saving ? 'Guardando…' : !event?.id ? 'Crea el evento primero' : '+ Agregar presentación'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Shared presentation form component ───────────────────────────────────────

function PresForm({ pres, onChange, users, canvaRaw, onCanvaChange }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Título *">
          <input value={pres.title || ''} onChange={e => onChange(v => ({ ...v, title: e.target.value }))} className={inputCls} />
        </Field>
        <Field label="Presentador">
          <select value={pres.presenter_user_id || ''} onChange={e => onChange(v => ({ ...v, presenter_user_id: e.target.value || null }))} className={inputCls}>
            <option value="">— sin presentador asignado —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.fullname || u.email}</option>
            ))}
          </select>
        </Field>
        <Field label="Inicio programado">
          <input type="datetime-local" value={pres.scheduled_start || ''} onChange={e => onChange(v => ({ ...v, scheduled_start: e.target.value }))} className={inputCls} />
        </Field>
        <Field label="Fin programado">
          <input type="datetime-local" value={pres.scheduled_end || ''} onChange={e => onChange(v => ({ ...v, scheduled_end: e.target.value }))} className={inputCls} />
        </Field>
        <Field label="Orden">
          <input type="number" value={pres.sort_order ?? 0} onChange={e => onChange(v => ({ ...v, sort_order: +e.target.value }))} className={inputCls} />
        </Field>
      </div>
      <Field label="Descripción">
        <textarea value={pres.description || ''} onChange={e => onChange(v => ({ ...v, description: e.target.value }))} rows={2} className={inputCls} />
      </Field>

      <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(pres.is_intro)}
          onChange={e => onChange(v => ({ ...v, is_intro: e.target.checked }))}
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
        />
        <span className="text-sm">
          <span className="font-medium text-slate-800">Presentación de introducción</span>
          <span className="block text-xs text-slate-500">No exige aportes ni preguntas, y sus aportes no cuentan en el ranking.</span>
        </span>
      </label>

      {/* Canva smart paste */}
      <Field label="Canva — pega el código HTML de inserción o el enlace inteligente">
        <textarea
          value={canvaRaw}
          onChange={e => onCanvaChange(e.target.value)}
          rows={3}
          className={inputCls + ' font-mono text-xs'}
          placeholder={'Pega aquí el código <iframe> de Canva o la URL:\nhttps://www.canva.com/design/ID.../view'}
        />
        {pres.canva_embed_url && (
          <p className="text-xs text-green-700 mt-1">✓ URL embed detectada: <span className="font-mono">{pres.canva_embed_url}</span></p>
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="URL Canva (abrir presentación)">
          <input value={pres.canva_url || ''} onChange={e => onChange(v => ({ ...v, canva_url: e.target.value }))}
            className={inputCls} placeholder="https://www.canva.com/design/…/view" />
        </Field>
        <Field label="URL embed Canva (iframe)">
          <input value={pres.canva_embed_url || ''} onChange={e => onChange(v => ({ ...v, canva_embed_url: e.target.value }))}
            className={inputCls} placeholder="https://www.canva.com/design/…/view?embed" />
        </Field>
      </div>
      <Field label="URL de respaldo (fallback)">
        <input value={pres.fallback_url || ''} onChange={e => onChange(v => ({ ...v, fallback_url: e.target.value }))} className={inputCls} />
      </Field>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50';

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
