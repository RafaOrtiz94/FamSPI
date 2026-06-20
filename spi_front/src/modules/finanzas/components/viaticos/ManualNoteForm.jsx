import React, { useState, useCallback } from 'react';
import { FiUpload, FiX } from 'react-icons/fi';

const EXPENSE_CATEGORIES = [
  { value: 'combustible', label: 'COMBUSTIBLE' },
  { value: 'alimentacion', label: 'ALIMENTACIÓN' },
  { value: 'hospedaje', label: 'HOSPEDAJE' },
  { value: 'transporte', label: 'TRANSPORTE' },
  { value: 'movilidad', label: 'MOVILIDAD' },
  { value: 'materiales', label: 'MATERIALES' },
];

const EXPENSE_MODES = [
  { value: 'with_card', label: 'Con tarjeta' },
  { value: 'without_card', label: 'Sin tarjeta' },
];

const EMPTY = {
  issue_date: '', supplier_ruc: '', supplier_name: '',
  establishment: '', emission_point: '', sequential: '',
  expense_description: '', expense_mode: '', total: '', file: null,
};

const ctrl = 'w-full min-h-10 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:border-blue-600';
const ctrlErr = 'border-red-400 bg-red-50';

function parseRange(notes, visitDate) {
  const base = visitDate ? String(visitDate).slice(0, 10) : '';
  const min = notes?.match(/Inicio:\s*(\d{4}-\d{2}-\d{2})/)?.[1] || base;
  const max = notes?.match(/Cierre:\s*(\d{4}-\d{2}-\d{2})/)?.[1] || base;
  return { min, max };
}

export default function ManualNoteForm({ allowance, onSubmit, loading = false, destination = '' }) {
  const [form, setForm] = useState({ ...EMPTY, document_state: destination });
  const [errors, setErrors] = useState({});

  const { min: dateMin, max: dateMax } = parseRange(allowance?.notes, allowance?.visit_date);

  const reset = useCallback(() => {
    setForm({ ...EMPTY, document_state: allowance?.city || destination });
    setErrors({});
  }, [allowance?.city, destination]);

  const set = (name, value) => {
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: undefined }));
  };

  const validate = () => {
    const e = {};
    const required = ['issue_date', 'establishment', 'emission_point', 'sequential', 'supplier_ruc', 'supplier_name', 'expense_description', 'expense_mode', 'total'];
    required.forEach((f) => { if (!form[f]) e[f] = 'Campo requerido'; });
    if (form.total && Number(form.total) <= 0) e.total = 'Ingresa un monto válido mayor a cero';
    if (!form.file) e.file = 'Adjunta el documento de respaldo';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    const reader = new FileReader();
    reader.onload = () => {
      onSubmit({
        issue_date: form.issue_date,
        supplier_ruc: form.supplier_ruc,
        supplier_name: form.supplier_name,
        establishment: form.establishment,
        emission_point: form.emission_point,
        sequential: form.sequential,
        expense_description: form.expense_description,
        expense_mode: form.expense_mode,
        subtotal_12: 0, subtotal_0: 0, iva: 0,
        total: parseFloat(form.total),
        document_state: form.document_state,
        file_base64: reader.result.split(',')[1],
        file_name: form.file.name,
      });
      reset();
    };
    reader.readAsDataURL(form.file);
  };

  const dateLabel = dateMin && dateMax && dateMin !== dateMax
    ? `Fecha (${dateMin} al ${dateMax})`
    : dateMin ? `Fecha (${dateMin})` : 'Fecha';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">{dateLabel}</label>
          <input type="date" value={form.issue_date} min={dateMin} max={dateMax}
            onChange={(e) => set('issue_date', e.target.value)}
            className={`${ctrl} ${errors.issue_date ? ctrlErr : ''}`} />
          {errors.issue_date && <p className="mt-1 text-xs text-red-600">{errors.issue_date}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Destino</label>
          <input type="text" value={form.document_state} disabled
            className="w-full min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 cursor-not-allowed" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Establecimiento</label>
          <input type="text" value={form.establishment} placeholder="001"
            onChange={(e) => set('establishment', e.target.value)}
            className={`${ctrl} ${errors.establishment ? ctrlErr : ''}`} />
          {errors.establishment && <p className="mt-1 text-xs text-red-600">{errors.establishment}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Punto de emisión</label>
          <input type="text" value={form.emission_point} placeholder="005"
            onChange={(e) => set('emission_point', e.target.value)}
            className={`${ctrl} ${errors.emission_point ? ctrlErr : ''}`} />
          {errors.emission_point && <p className="mt-1 text-xs text-red-600">{errors.emission_point}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Secuencial</label>
          <input type="text" value={form.sequential} placeholder="000288564"
            onChange={(e) => set('sequential', e.target.value)}
            className={`${ctrl} ${errors.sequential ? ctrlErr : ''}`} />
          {errors.sequential && <p className="mt-1 text-xs text-red-600">{errors.sequential}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">RUC proveedor</label>
          <input type="text" value={form.supplier_ruc} placeholder="1891809946001"
            onChange={(e) => set('supplier_ruc', e.target.value)}
            className={`${ctrl} font-mono ${errors.supplier_ruc ? ctrlErr : ''}`} />
          {errors.supplier_ruc && <p className="mt-1 text-xs text-red-600">{errors.supplier_ruc}</p>}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Razón social</label>
        <input type="text" value={form.supplier_name} placeholder="VELARDE-VALENCIA S.A.S."
          onChange={(e) => set('supplier_name', e.target.value)}
          className={`${ctrl} ${errors.supplier_name ? ctrlErr : ''}`} />
        {errors.supplier_name && <p className="mt-1 text-xs text-red-600">{errors.supplier_name}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Concepto del gasto</label>
          <select value={form.expense_description}
            onChange={(e) => set('expense_description', e.target.value)}
            className={`${ctrl} ${errors.expense_description ? ctrlErr : ''}`}>
            <option value="">Selecciona un concepto</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {errors.expense_description && <p className="mt-1 text-xs text-red-600">{errors.expense_description}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Modo de gasto</label>
          <select value={form.expense_mode}
            onChange={(e) => set('expense_mode', e.target.value)}
            className={`${ctrl} ${errors.expense_mode ? ctrlErr : ''}`}>
            <option value="">Selecciona un modo</option>
            {EXPENSE_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
          {errors.expense_mode && <p className="mt-1 text-xs text-red-600">{errors.expense_mode}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Total factura</label>
          <input type="number" step="0.01" min="0.01" value={form.total} placeholder="0.00"
            onChange={(e) => set('total', e.target.value)}
            className={`${ctrl} font-mono ${errors.total ? ctrlErr : ''}`} />
          {errors.total && <p className="mt-1 text-xs text-red-600">{errors.total}</p>}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Documento (imagen o PDF)</label>
        <div className={`flex min-h-[52px] items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition-colors ${
          form.file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-white hover:border-slate-400'
        } ${errors.file ? 'border-red-400 bg-red-50' : ''}`}>
          {form.file ? (
            <>
              <span className="flex-1 truncate text-sm text-emerald-700">{form.file.name}</span>
              <button type="button" onClick={() => set('file', null)}
                className="cursor-pointer text-emerald-600 hover:text-red-600 transition-colors focus:outline-none">
                <FiX size={16} />
              </button>
            </>
          ) : (
            <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
              <FiUpload size={16} />
              <span>Selecciona archivo</span>
              <input type="file" accept="image/*,.pdf" className="hidden"
                onChange={(e) => set('file', e.target.files?.[0] || null)} />
            </label>
          )}
        </div>
        {errors.file && <p className="mt-1 text-xs text-red-600">{errors.file}</p>}
      </div>

      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={loading}
          className="inline-flex min-h-11 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2">
          {loading ? 'Guardando...' : 'Agregar nota'}
        </button>
      </div>
    </form>
  );
}
