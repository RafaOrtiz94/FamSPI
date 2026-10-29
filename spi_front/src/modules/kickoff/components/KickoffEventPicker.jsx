import React, { useEffect, useState } from 'react';
import kickoffApi from '../api/kickoffApi';
import { formatEcDate } from '../api/kickoffDateUtils';
import toast from 'react-hot-toast';

const C = { navy: '#0a1628', cyan: '#00a8d4', gold: '#c49a10', muted: '#6b8aaa', line: '#dce8f5' };

const STATUS_META = {
  draft:     { label: 'Borrador',   color: '#94a3b8', bg: '#f1f5f9' },
  scheduled: { label: 'Programado', color: '#2563eb', bg: '#eff6ff' },
  active:    { label: 'En curso',   color: '#16a34a', bg: '#f0fdf4' },
  paused:    { label: 'Pausado',    color: C.gold,    bg: '#fefce8' },
  finished:  { label: 'Finalizado', color: '#64748b', bg: '#f8fafc' },
  cancelled: { label: 'Cancelado',  color: '#dc2626', bg: '#fef2f2' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ color: m.color, background: m.bg }}
    >
      {m.label}
    </span>
  );
}

export default function KickoffEventPicker({ onSelect, currentEventId }) {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', event_date: '', description: '', status: 'draft' });

  const load = async () => {
    try {
      const res = await kickoffApi.listEvents();
      setEvents(res.data || []);
    } catch {
      toast.error('No se pudieron cargar los eventos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.event_date) {
      toast.error('El nombre y la fecha son obligatorios');
      return;
    }
    try {
      const res = await kickoffApi.createEvent(form);
      toast.success('Evento creado');
      setCreating(false);
      setForm({ name: '', event_date: '', description: '', status: 'draft' });
      await load();
      onSelect(res.data.id);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al crear el evento');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 rounded-full border-t-transparent animate-spin" style={{ borderColor: `${C.cyan} transparent transparent transparent` }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-black tracking-widest font-mono mb-1" style={{ color: C.muted }}>
            ADMINISTRACIÓN
          </p>
          <h2 className="text-xl font-black" style={{ color: C.navy }}>Eventos Kick Off</h2>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            Selecciona un evento para configurarlo o crea uno nuevo.
          </p>
        </div>
        <button
          onClick={() => setCreating(c => !c)}
          className="px-4 py-2 rounded-xl text-sm font-black tracking-wide transition-all active:scale-95"
          style={
            creating
              ? { background: '#f1f5f9', color: C.muted, border: `1px solid ${C.line}` }
              : { background: C.cyan, color: '#fff', border: `1px solid ${C.cyan}` }
          }
        >
          {creating ? '✕ Cancelar' : '+ Nuevo evento'}
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: '#f8fafc', border: `1.5px solid ${C.cyan}40` }}
        >
          <p className="text-xs font-black tracking-widest font-mono" style={{ color: C.cyan }}>NUEVO EVENTO</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold" style={{ color: C.muted }}>Nombre *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Kick Off 2026 — Prueba"
                className="rounded-xl px-3 py-2 text-sm outline-none border focus:border-blue-400 transition-colors"
                style={{ borderColor: C.line }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold" style={{ color: C.muted }}>Fecha *</label>
              <input
                type="date"
                value={form.event_date}
                onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                className="rounded-xl px-3 py-2 text-sm outline-none border focus:border-blue-400 transition-colors"
                style={{ borderColor: C.line }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold" style={{ color: C.muted }}>Estado inicial</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="rounded-xl px-3 py-2 text-sm outline-none border focus:border-blue-400 transition-colors"
                style={{ borderColor: C.line }}
              >
                <option value="draft">Borrador (solo admins lo ven)</option>
                <option value="scheduled">Programado (visible para todos)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold" style={{ color: C.muted }}>Descripción</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Evento de prueba, simulacro..."
                className="rounded-xl px-3 py-2 text-sm outline-none border focus:border-blue-400 transition-colors"
                style={{ borderColor: C.line }}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-sm font-black tracking-wide transition-all active:scale-95"
              style={{ background: C.cyan, color: '#fff' }}
            >
              Crear evento
            </button>
          </div>
        </form>
      )}

      {/* Events list */}
      {events.length === 0 && !creating && (
        <div className="text-center py-12 text-sm" style={{ color: C.muted }}>
          No hay eventos creados aún.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {events.map(ev => {
          const isCurrentForUsers = ev.id === currentEventId;
          return (
            <div
              key={ev.id}
              className="rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 transition-all"
              style={{
                background: '#fff',
                border: `1.5px solid ${isCurrentForUsers ? `${C.cyan}60` : C.line}`,
                boxShadow: isCurrentForUsers ? `0 0 0 3px ${C.cyan}12` : 'none',
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-black text-sm" style={{ color: C.navy }}>{ev.name}</h3>
                  <StatusBadge status={ev.status} />
                  {isCurrentForUsers && (
                    <span
                      className="text-xs font-black px-2 py-0.5 rounded-full"
                      style={{ background: `${C.cyan}14`, color: C.cyan, border: `1px solid ${C.cyan}30` }}
                    >
                      ● Visible para todos
                    </span>
                  )}
                </div>
                <p className="text-xs" style={{ color: C.muted }}>
                  {formatEcDate(ev.event_date)}
                  {ev.presentation_count > 0 && (
                    <span className="ml-2">· {ev.presentation_count} presentación{ev.presentation_count !== 1 ? 'es' : ''}</span>
                  )}
                  {ev.description && <span className="ml-2">· {ev.description}</span>}
                </p>
              </div>
              <button
                onClick={() => onSelect(ev.id)}
                className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all active:scale-95 hover:opacity-90"
                style={{ background: C.navy, color: '#fff' }}
              >
                Configurar →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
