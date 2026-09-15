import React, { useState, useCallback } from 'react';
import { FiUpload, FiX } from 'react-icons/fi';

const EXPENSE_MODES = [
  { value: 'with_card', label: 'Con tarjeta' },
  { value: 'without_card', label: 'Sin tarjeta' },
];

const EMPTY = {
  description: '',
  total: '',
  purchase_date: '',
  justification: '',
  expense_mode: '',
  file: null,
};

const ctrl = 'w-full min-h-10 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:border-blue-600';
const ctrlErr = 'border-red-400 bg-red-50';

function parseRange(notes, visitDate) {
  const base = visitDate ? String(visitDate).slice(0, 10) : '';
  const min = notes?.match(/Inicio:\s*(\d{4}-\d{2}-\d{2})/)?.[1] || base;
  const max = notes?.match(/Cierre:\s*(\d{4}-\d{2}-\d{2})/)?.[1] || base;
  return { min, max };
}

export default function PurchaseNoInvoiceForm({ onSubmit, loading = false, allowance = {} }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [errors, setErrors] = useState({});

  const { min: dateMin, max: dateMax } = parseRange(allowance?.notes, allowance?.visit_date);

  const reset = useCallback(() => {
    setForm({ ...EMPTY });
    setErrors({});
  }, []);

  const set = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.description.trim()) nextErrors.description = 'Describe la compra realizada';
    if (!form.total || Number(form.total) <= 0) nextErrors.total = 'Ingresa un monto valido mayor a cero';
    if (!form.purchase_date) nextErrors.purchase_date = 'Selecciona la fecha de compra';
    if (!form.justification.trim()) nextErrors.justification = 'Explica por que se realizo esta compra';
    if (!form.expense_mode) nextErrors.expense_mode = 'Indica si el gasto fue con tarjeta o sin tarjeta';
    if (!form.file) nextErrors.file = 'Adjunta el justificante de la compra';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    const reader = new FileReader();
    reader.onload = () => {
      onSubmit({
        description: form.description,
        total: parseFloat(form.total),
        purchase_date: form.purchase_date,
        justification: form.justification,
        expense_mode: form.expense_mode,
        file_base64: reader.result.split(',')[1],
        file_name: form.file.name,
        mime_type: form.file.type || null,
      });
      reset();
    };
    reader.readAsDataURL(form.file);
  };

  const dateLabel = dateMin && dateMax && dateMin !== dateMax
    ? `Fecha de compra (${dateMin} al ${dateMax})`
    : 'Fecha de compra';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Descripcion</label>
        <textarea
          value={form.description}
          rows={3}
          placeholder="Describe detalladamente que se compro"
          onChange={(e) => set('description', e.target.value)}
          className={`${ctrl} resize-none ${errors.description ? ctrlErr : ''}`}
        />
        {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Monto total</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.total}
            placeholder="0.00"
            onChange={(e) => set('total', e.target.value)}
            className={`${ctrl} font-mono ${errors.total ? ctrlErr : ''}`}
          />
          {errors.total && <p className="mt-1 text-xs text-red-600">{errors.total}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">{dateLabel}</label>
          <input
            type="date"
            value={form.purchase_date}
            min={dateMin}
            max={dateMax}
            onChange={(e) => set('purchase_date', e.target.value)}
            className={`${ctrl} ${errors.purchase_date ? ctrlErr : ''}`}
          />
          {errors.purchase_date && <p className="mt-1 text-xs text-red-600">{errors.purchase_date}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Modo de gasto</label>
          <select
            value={form.expense_mode}
            onChange={(e) => set('expense_mode', e.target.value)}
            className={`${ctrl} ${errors.expense_mode ? ctrlErr : ''}`}
          >
            <option value="">Selecciona</option>
            {EXPENSE_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
          {errors.expense_mode && <p className="mt-1 text-xs text-red-600">{errors.expense_mode}</p>}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Justificacion</label>
        <textarea
          value={form.justification}
          rows={2}
          placeholder="Explica por que se realizo esta compra y que necesidad cubria"
          onChange={(e) => set('justification', e.target.value)}
          className={`${ctrl} resize-none ${errors.justification ? ctrlErr : ''}`}
        />
        {errors.justification && <p className="mt-1 text-xs text-red-600">{errors.justification}</p>}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Justificante</label>
        <div className={`flex min-h-[52px] items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition-colors ${
          form.file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-white hover:border-slate-400'
        } ${errors.file ? 'border-red-400 bg-red-50' : ''}`}>
          {form.file ? (
            <>
              <span className="flex-1 truncate text-sm text-emerald-700">{form.file.name}</span>
              <button
                type="button"
                onClick={() => set('file', null)}
                className="cursor-pointer text-emerald-600 transition-colors hover:text-red-600 focus:outline-none"
              >
                <FiX size={16} />
              </button>
            </>
          ) : (
            <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
              <FiUpload size={16} />
              <span>Selecciona archivo (imagen o PDF)</span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => set('file', e.target.files?.[0] || null)}
              />
            </label>
          )}
        </div>
        {errors.file && <p className="mt-1 text-xs text-red-600">{errors.file}</p>}
      </div>

      <div className="pt-1">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-11 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
        >
          {loading ? 'Guardando...' : 'Agregar compra'}
        </button>
      </div>
    </form>
  );
}
