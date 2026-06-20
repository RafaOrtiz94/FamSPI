import React, { useState } from 'react';
import {
  FiFileText,
  FiTrash2,
  FiEdit2,
  FiCheck,
  FiX,
  FiCheckCircle,
  FiClock,
  FiXCircle,
} from 'react-icons/fi';

const EXPENSE_CATEGORIES = [
  { value: 'combustible', label: 'COMBUSTIBLE' },
  { value: 'alimentacion', label: 'ALIMENTACION' },
  { value: 'hospedaje', label: 'HOSPEDAJE' },
  { value: 'transporte', label: 'TRANSPORTE' },
  { value: 'movilidad', label: 'MOVILIDAD' },
  { value: 'materiales', label: 'MATERIALES' },
];

const EXPENSE_MODES = [
  { value: 'with_card', label: 'Con tarjeta' },
  { value: 'without_card', label: 'Sin tarjeta' },
];

const STATUS = {
  pendiente_clasificacion: { bg: 'bg-amber-100', text: 'text-amber-800', Icon: FiClock, label: 'Pendiente' },
  clasificada: { bg: 'bg-emerald-100', text: 'text-emerald-800', Icon: FiCheckCircle, label: 'Clasificada' },
  rechazada: { bg: 'bg-red-100', text: 'text-red-800', Icon: FiXCircle, label: 'Rechazada' },
};

const cellInput = 'w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-blue-600';

const toMoney = (value) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
    .format(Number.isFinite(Number(value)) ? Number(value) : 0);

const fmtDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-EC');
};

const getCategoryLabel = (value) =>
  EXPENSE_CATEGORIES.find((item) => item.value === String(value || '').toLowerCase())?.label || value || '—';

const getExpenseModeLabel = (value) =>
  EXPENSE_MODES.find((item) => item.value === String(value || '').toLowerCase())?.label || 'Sin definir';

const ExpenseModeBadge = ({ value }) => {
  const isWithCard = value === 'with_card';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
      isWithCard ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
    }`}>
      {getExpenseModeLabel(value)}
    </span>
  );
};

function EditRow({ note, dateMin, dateMax, onSave, onCancel }) {
  const [form, setForm] = useState({
    issue_date: note.issue_date ? String(note.issue_date).slice(0, 10) : '',
    supplier_ruc: note.supplier_ruc || '',
    expense_description: note.details_text || note.expense_description || note.category || '',
    total: note.total || '',
    expense_mode: note.expense_mode || '',
  });

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <tr className="bg-blue-50">
      <td className="px-3 py-2">
        <input
          type="date"
          value={form.issue_date}
          min={dateMin}
          max={dateMax}
          onChange={(e) => set('issue_date', e.target.value)}
          className={cellInput}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={form.supplier_ruc}
          onChange={(e) => set('supplier_ruc', e.target.value)}
          className={`${cellInput} font-mono`}
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={form.expense_description}
          onChange={(e) => set('expense_description', e.target.value)}
          className={cellInput}
        >
          <option value="">Selecciona</option>
          {EXPENSE_CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>{category.label}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          value={form.expense_mode}
          onChange={(e) => set('expense_mode', e.target.value)}
          className={cellInput}
        >
          <option value="">Selecciona</option>
          {EXPENSE_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>{mode.label}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          step="0.01"
          value={form.total}
          onChange={(e) => set('total', e.target.value)}
          className={`${cellInput} font-mono text-right`}
        />
      </td>
      <td className="px-3 py-2" />
      <td className="px-3 py-2 text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => onSave(note.id, {
              issue_date: form.issue_date,
              supplier_ruc: form.supplier_ruc,
              expense_description: form.expense_description,
              expense_mode: form.expense_mode,
              subtotal_12: 0,
              subtotal_0: 0,
              iva: 0,
              total: parseFloat(form.total) || 0,
            })}
            className="cursor-pointer rounded-lg bg-emerald-100 p-1.5 text-emerald-700 transition hover:bg-emerald-200 active:scale-[0.97] focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <FiCheck size={13} />
          </button>
          <button
            onClick={onCancel}
            className="cursor-pointer rounded-lg bg-slate-100 p-1.5 text-slate-600 transition hover:bg-slate-200 active:scale-[0.97] focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <FiX size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function ManualNotesTable({
  notes = [],
  isFinance = false,
  isRequester = false,
  onUpdate = null,
  onDelete = null,
  dateMin = '',
  dateMax = '',
}) {
  const [editingId, setEditingId] = useState(null);

  if (!notes.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 py-8 text-center">
        <FiFileText className="h-8 w-8 text-slate-300" />
        <p className="text-xs text-slate-400">No hay notas de venta manuales</p>
      </div>
    );
  }

  const handleSave = (noteId, payload) => {
    if (onUpdate) onUpdate(noteId, payload);
    setEditingId(null);
  };

  const canEdit = isRequester || isFinance;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fecha</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">RUC</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Concepto</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Modo</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total</th>
            <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">Estado</th>
            <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {notes.map((note) => {
            if (editingId === note.id) {
              return (
                <EditRow
                  key={note.id}
                  note={note}
                  dateMin={dateMin}
                  dateMax={dateMax}
                  onSave={handleSave}
                  onCancel={() => setEditingId(null)}
                />
              );
            }

            const badge = STATUS[note.status] || STATUS.pendiente_clasificacion;
            const BadgeIcon = badge.Icon;

            return (
              <tr key={note.id} className="bg-white transition-colors hover:bg-slate-50">
                <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{fmtDate(note.issue_date)}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{note.supplier_ruc || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-slate-700">{getCategoryLabel(note.details_text || note.expense_description)}</td>
                <td className="px-3 py-2.5"><ExpenseModeBadge value={note.expense_mode} /></td>
                <td className="px-3 py-2.5 text-right font-mono text-sm font-semibold text-slate-900">{toMoney(note.total)}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.bg} ${badge.text}`}>
                    <BadgeIcon size={11} />
                    {badge.label}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {note.drive_link && (
                      <a
                        href={note.drive_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer text-slate-400 transition hover:text-blue-600 focus:outline-none"
                      >
                        <FiFileText size={14} />
                      </a>
                    )}
                    {canEdit && onUpdate && (
                      <button
                        onClick={() => setEditingId(note.id)}
                        className="cursor-pointer text-slate-400 transition hover:text-blue-600 active:scale-[0.97] focus:outline-none"
                      >
                        <FiEdit2 size={14} />
                      </button>
                    )}
                    {isRequester && onDelete && (
                      <button
                        onClick={() => onDelete(note.id)}
                        className="cursor-pointer text-slate-400 transition hover:text-red-600 active:scale-[0.97] focus:outline-none"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
