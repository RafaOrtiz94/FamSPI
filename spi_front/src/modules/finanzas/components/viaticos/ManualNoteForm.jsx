import React, { useState } from 'react';
import { FiUpload, FiX } from 'react-icons/fi';

const EXPENSE_CATEGORIES = [
  { value: 'combustible', label: 'COMBUSTIBLE' },
  { value: 'alimentacion', label: 'ALIMENTACIÓN' },
  { value: 'hospedaje', label: 'HOSPEDAJE' },
  { value: 'transporte', label: 'TRANSPORTE' },
  { value: 'movilidad', label: 'MOVILIDAD' },
  { value: 'materiales', label: 'MATERIALES' },
];

export default function ManualNoteForm({ allowance, onSubmit, loading = false, destination = '' }) {
  const [form, setForm] = useState({
    issue_date: '',
    supplier_ruc: '',
    supplier_name: '',
    establishment: '',
    emission_point: '',
    sequential: '',
    expense_description: '',
    total: '',
    document_state: destination,
    file: null,
  });

  const [errors, setErrors] = useState({});

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
    const required = [
      'issue_date',
      'supplier_ruc',
      'supplier_name',
      'establishment',
      'emission_point',
      'sequential',
      'expense_description',
      'total',
    ];

    required.forEach((field) => {
      if (!form[field]) newErrors[field] = 'Requerido';
    });

    if (form.total && Number(form.total) <= 0) {
      newErrors.total = 'Total válido requerido';
    }

    if (!form.file) {
      newErrors.file = 'Requiere documento';
    }

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
          issue_date: form.issue_date,
          supplier_ruc: form.supplier_ruc,
          supplier_name: form.supplier_name,
          subtotal_12: 0,
          subtotal_0: 0,
          iva: 0,
          total: parseFloat(form.total),
          expense_description: form.expense_description,
          document_state: form.document_state,
          emission_point: form.emission_point,
          establishment: form.establishment,
          sequential: form.sequential,
          file_base64: reader.result.split(',')[1],
          file_name: form.file.name,
        });
      };
      reader.readAsDataURL(form.file);
    }
  };

  const visitDate = allowance?.visit_date ? String(allowance.visit_date).slice(0, 10) : '';
  // Calcular max agregando 30 días al visit_date (rango de tolerancia)
  const dateMin = visitDate;
  const dateMax = visitDate ? new Date(new Date(visitDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : '';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-[#E5E7EB] bg-white p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#374151]">Fecha {dateMin ? `(desde ${dateMin})` : ''}</label>
          <input
            type="date"
            name="issue_date"
            value={form.issue_date}
            onChange={handleChange}
            min={dateMin}
            max={dateMax || ''}
            className={`w-full rounded-md border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2 ${
              errors.issue_date
                ? 'border-[#DC2626] bg-[#FEE2E2]'
                : 'border-[#D1D5DB] bg-white hover:border-[#9CA3AF]'
            }`}
          />
          {errors.issue_date && <p className="mt-1 text-xs text-[#DC2626]">{errors.issue_date}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#374151]">Destino</label>
          <input
            type="text"
            name="document_state"
            value={form.document_state}
            disabled
            className="w-full rounded-md border border-[#D1D5DB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#6B7280] cursor-not-allowed"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#374151]">Establecimiento</label>
          <input
            type="text"
            name="establishment"
            value={form.establishment}
            onChange={handleChange}
            placeholder="Ej. 001"
            className={`w-full rounded-md border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2 ${
              errors.establishment ? 'border-[#DC2626]' : 'border-[#D1D5DB]'
            }`}
          />
          {errors.establishment && <p className="mt-1 text-xs text-[#DC2626]">{errors.establishment}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#374151]">Punto de Emisión</label>
          <input
            type="text"
            name="emission_point"
            value={form.emission_point}
            onChange={handleChange}
            placeholder="005"
            className={`w-full rounded-md border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2 ${
              errors.emission_point ? 'border-[#DC2626]' : 'border-[#D1D5DB]'
            }`}
          />
          {errors.emission_point && <p className="mt-1 text-xs text-[#DC2626]">{errors.emission_point}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#374151]">Secuencial</label>
          <input
            type="text"
            name="sequential"
            value={form.sequential}
            onChange={handleChange}
            placeholder="000288564"
            className={`w-full rounded-md border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2 ${
              errors.sequential ? 'border-[#DC2626]' : 'border-[#D1D5DB]'
            }`}
          />
          {errors.sequential && <p className="mt-1 text-xs text-[#DC2626]">{errors.sequential}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#374151]">RUC Proveedor</label>
          <input
            type="text"
            name="supplier_ruc"
            value={form.supplier_ruc}
            onChange={handleChange}
            placeholder="1891809946001"
            className={`w-full rounded-md border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2 ${
              errors.supplier_ruc ? 'border-[#DC2626]' : 'border-[#D1D5DB]'
            }`}
          />
          {errors.supplier_ruc && <p className="mt-1 text-xs text-[#DC2626]">{errors.supplier_ruc}</p>}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[#374151]">Razón Social (Proveedor)</label>
        <input
          type="text"
          name="supplier_name"
          value={form.supplier_name}
          onChange={handleChange}
          placeholder="VELARDE-VALENCIA S.A.S."
          className={`w-full rounded-md border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2 ${
            errors.supplier_name ? 'border-[#DC2626]' : 'border-[#D1D5DB]'
          }`}
        />
        {errors.supplier_name && <p className="mt-1 text-xs text-[#DC2626]">{errors.supplier_name}</p>}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[#374151]">Concepto del Gasto</label>
        <select
          name="expense_description"
          value={form.expense_description}
          onChange={handleChange}
          className={`w-full rounded-md border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2 ${
            errors.expense_description
              ? 'border-[#DC2626] bg-[#FEE2E2]'
              : 'border-[#D1D5DB] bg-white'
          }`}
        >
          <option value="">Selecciona un concepto</option>
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        {errors.expense_description && (
          <p className="mt-1 text-xs text-[#DC2626]">{errors.expense_description}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[#374151]">Total Factura</label>
        <input
          type="number"
          step="0.01"
          name="total"
          value={form.total}
          onChange={handleChange}
          placeholder="0.00"
          className={`w-full rounded-md border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2 ${
            errors.total ? 'border-[#DC2626]' : 'border-[#D1D5DB]'
          }`}
        />
        {errors.total && <p className="mt-1 text-xs text-[#DC2626]">{errors.total}</p>}
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-[#374151]">Documento (Imagen o PDF)</label>
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
          {loading ? 'Agregando...' : 'Agregar Nota'}
        </button>
      </div>
    </form>
  );
}
