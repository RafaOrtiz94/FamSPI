import React, { useState } from 'react';
import { FiFile, FiTrash2, FiEdit2, FiCheckCircle, FiClock, FiXCircle, FiCheck, FiX } from 'react-icons/fi';

const formatMoney = (v) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
    .format(Number.isFinite(Number(v)) ? Number(v) : 0);

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-EC');
};

const EXPENSE_CATEGORIES = [
  { value: 'combustible', label: 'COMBUSTIBLE' },
  { value: 'alimentacion', label: 'ALIMENTACIÓN' },
  { value: 'hospedaje', label: 'HOSPEDAJE' },
  { value: 'transporte', label: 'TRANSPORTE' },
  { value: 'movilidad', label: 'MOVILIDAD' },
  { value: 'materiales', label: 'MATERIALES' },
];

const getCategoryLabel = (val) =>
  EXPENSE_CATEGORIES.find((c) => c.value === val)?.label || val || '—';

const STATUS_BADGE = {
  pendiente_clasificacion: { bg: 'bg-amber-100', text: 'text-amber-800', icon: FiClock, label: 'Pendiente' },
  clasificada: { bg: 'bg-emerald-100', text: 'text-emerald-800', icon: FiCheckCircle, label: 'Clasificada' },
  rechazada: { bg: 'bg-rose-100', text: 'text-rose-800', icon: FiXCircle, label: 'Rechazada' },
};

function InlineEdit({ note, dateMin, dateMax, onSave, onCancel }) {
  const [form, setForm] = useState({
    issue_date: note.issue_date ? String(note.issue_date).slice(0, 10) : '',
    supplier_ruc: note.supplier_ruc || '',
    supplier_name: note.supplier_name || '',
    establishment: note.establishment || '',
    emission_point: note.emission_point || '',
    sequential: note.sequential || '',
    expense_description: note.details_text || note.expense_description || note.category || '',
    total: note.total || '',
  });

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const inputCls = 'w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <tr className="bg-blue-50">
      <td className="px-3 py-2">
        <input type="date" name="issue_date" value={form.issue_date} onChange={handleChange}
          min={dateMin} max={dateMax} className={inputCls} />
      </td>
      <td className="px-3 py-2">
        <input type="text" name="supplier_ruc" value={form.supplier_ruc} onChange={handleChange}
          className={inputCls} placeholder="RUC" />
      </td>
      <td className="px-3 py-2">
        <select name="expense_description" value={form.expense_description} onChange={handleChange} className={inputCls}>
          <option value="">Selecciona</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input type="number" step="0.01" name="total" value={form.total} onChange={handleChange}
          className={`${inputCls} text-right`} />
      </td>
      <td className="px-3 py-2 text-center" colSpan={2}>
        <div className="flex justify-center gap-1">
          <button onClick={() => onSave(note.id, form)}
            className="cursor-pointer rounded bg-emerald-600 p-1 text-white hover:bg-emerald-700">
            <FiCheck size={14} />
          </button>
          <button onClick={onCancel}
            className="cursor-pointer rounded bg-slate-400 p-1 text-white hover:bg-slate-500">
            <FiX size={14} />
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
  onDelete = null,
  onUpdate = null,
  dateMin = '',
  dateMax = '',
}) {
  const [editingId, setEditingId] = useState(null);

  if (!notes.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
        No hay notas de venta manuales agregadas aún.
      </div>
    );
  }

  const handleSave = (noteId, form) => {
    if (onUpdate) {
      onUpdate(noteId, {
        issue_date: form.issue_date,
        supplier_ruc: form.supplier_ruc,
        supplier_name: form.supplier_name,
        subtotal_12: 0,
        subtotal_0: 0,
        iva: 0,
        total: parseFloat(form.total) || 0,
        expense_description: form.expense_description,
        emission_point: form.emission_point,
        sequential: form.sequential,
      });
    }
    setEditingId(null);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2 text-left">Fecha</th>
            <th className="px-3 py-2 text-left">RUC</th>
            <th className="px-3 py-2 text-left">Concepto</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2 text-center">Estado</th>
            <th className="px-3 py-2 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {notes.map((note) => {
            if (editingId === note.id) {
              return (
                <InlineEdit
                  key={note.id}
                  note={note}
                  dateMin={dateMin}
                  dateMax={dateMax}
                  onSave={handleSave}
                  onCancel={() => setEditingId(null)}
                />
              );
            }

            const badge = STATUS_BADGE[note.status] || STATUS_BADGE.pendiente_clasificacion;
            const BadgeIcon = badge.icon;

            return (
              <tr key={note.id} className="bg-white transition hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-700">{formatDate(note.issue_date)}</td>
                <td className="px-3 py-2 font-mono text-slate-500">{note.supplier_ruc || '—'}</td>
                <td className="px-3 py-2 text-slate-700">
                  {getCategoryLabel(note.details_text || note.expense_description)}
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">
                  {formatMoney(note.total)}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.bg} ${badge.text}`}>
                    <BadgeIcon size={11} />
                    {badge.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {note.drive_link && (
                      <a href={note.drive_link} target="_blank" rel="noopener noreferrer"
                        className="cursor-pointer text-blue-600 hover:text-blue-800 transition" title="Ver documento">
                        <FiFile size={14} />
                      </a>
                    )}
                    {(isRequester || isFinance) && onUpdate && (
                      <button onClick={() => setEditingId(note.id)}
                        className="cursor-pointer text-slate-500 hover:text-blue-600 transition" title="Editar">
                        <FiEdit2 size={14} />
                      </button>
                    )}
                    {isRequester && onDelete && (
                      <button onClick={() => onDelete(note.id)}
                        className="cursor-pointer text-slate-400 hover:text-rose-600 transition" title="Eliminar">
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
