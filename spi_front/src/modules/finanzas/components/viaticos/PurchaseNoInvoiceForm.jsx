import React, { useState } from 'react';
import { FiUpload, FiX } from 'react-icons/fi';

export default function PurchaseNoInvoiceForm({ onSubmit, loading = false, allowance = {} }) {
  const [form, setForm] = useState({
    description: '',
    total: '',
    purchase_date: '',
    justification: '',
    file: null,
  });

  const [errors, setErrors] = useState({});

  const parseRange = (notes, visitDate) => {
    const inicio = notes?.match(/Inicio:\s*(\d{4}-\d{2}-\d{2})/)?.[1];
    const cierre = notes?.match(/Cierre:\s*(\d{4}-\d{2}-\d{2})/)?.[1];
    const base = visitDate ? String(visitDate).slice(0, 10) : '';
    return { min: inicio || base, max: cierre || base };
  };
  const { min: dateMin, max: dateMax } = parseRange(allowance?.notes, allowance?.visit_date);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) {
      setErrors((p) => ({ ...p, [name]: '' }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm((p) => ({ ...p, file }));
      if (errors.file) {
        setErrors((p) => ({ ...p, file: '' }));
      }
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!form.description.trim()) newErrors.description = 'Requerido';
    if (!form.total || Number(form.total) <= 0) newErrors.total = 'Monto válido requerido';
    if (!form.purchase_date) newErrors.purchase_date = 'Requerido';
    if (!form.justification.trim()) newErrors.justification = 'Requerido';
    if (!form.file) newErrors.file = 'Requiere justificante';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (form.file) {
      const reader = new FileReader();
      reader.onload = () => {
        onSubmit({
          description: form.description,
          total: parseFloat(form.total),
          purchase_date: form.purchase_date,
          justification: form.justification,
          file_base64: reader.result.split(',')[1],
          file_name: form.file.name,
        });
      };
      reader.readAsDataURL(form.file);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-[#E5E7EB] bg-white p-6">
      <div>
        <label className="mb-1 block text-xs font-medium text-[#374151]">Descripción</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows="3"
          placeholder="Detalla qué fue comprado"
          className={`w-full rounded-md border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2 ${
            errors.description ? 'border-[#DC2626] bg-[#FEE2E2]' : 'border-[#D1D5DB]'
          }`}
        />
        {errors.description && <p className="mt-1 text-xs text-[#DC2626]">{errors.description}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#374151]">Monto total</label>
          <input
            type="number"
            step="0.01"
            name="total"
            value={form.total}
            onChange={handleChange}
            placeholder="0.00"
            className={`w-full rounded-md border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2 ${
              errors.total ? 'border-[#DC2626] bg-[#FEE2E2]' : 'border-[#D1D5DB]'
            }`}
          />
          {errors.total && <p className="mt-1 text-xs text-[#DC2626]">{errors.total}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#374151]">Fecha de compra {dateMin && dateMax ? `(${dateMin} — ${dateMax})` : ''}</label>
          <input
            type="date"
            name="purchase_date"
            value={form.purchase_date}
            onChange={handleChange}
            min={dateMin}
            max={dateMax || ''}
            className={`w-full rounded-md border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2 ${
              errors.purchase_date ? 'border-[#DC2626] bg-[#FEE2E2]' : 'border-[#D1D5DB]'
            }`}
          />
          {errors.purchase_date && <p className="mt-1 text-xs text-[#DC2626]">{errors.purchase_date}</p>}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[#374151]">Justificación</label>
        <textarea
          name="justification"
          value={form.justification}
          onChange={handleChange}
          rows="2"
          placeholder="Explica por qué se realizó esta compra"
          className={`w-full rounded-md border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2 ${
            errors.justification ? 'border-[#DC2626] bg-[#FEE2E2]' : 'border-[#D1D5DB]'
          }`}
        />
        {errors.justification && <p className="mt-1 text-xs text-[#DC2626]">{errors.justification}</p>}
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-[#374151]">Justificante</label>
        <div
          className={`flex items-center gap-3 rounded-md border-2 border-dashed p-4 transition ${
            form.file
              ? 'border-[#16A34A] bg-[#DCFCE7]'
              : 'border-[#D1D5DB] bg-[#F9FAFB] hover:border-[#9CA3AF]'
          }`}
        >
          {form.file ? (
            <>
              <span className="text-sm text-[#16A34A]">✓ {form.file.name}</span>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, file: null }))}
                className="ml-auto cursor-pointer text-[#16A34A] hover:text-[#DC2626]"
              >
                <FiX size={18} />
              </button>
            </>
          ) : (
            <>
              <FiUpload className="text-[#6B7280]" size={18} />
              <label className="flex-1 cursor-pointer">
                <span className="text-sm text-[#2563EB]">Selecciona archivo</span>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*,.pdf"
                  className="hidden"
                />
              </label>
            </>
          )}
        </div>
        {errors.file && <p className="mt-1 text-xs text-[#DC2626]">{errors.file}</p>}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.97] disabled:opacity-60 hover:bg-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2 cursor-pointer touch-manipulation min-h-11"
        >
          {loading ? 'Agregando...' : 'Agregar Compra'}
        </button>
      </div>
    </form>
  );
}
