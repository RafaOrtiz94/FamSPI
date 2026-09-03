import React, { useState } from "react";
import Button from "../../../core/ui/components/Button";

const inputClass = "w-full rounded-[var(--st-radius-md)] border px-3 py-2 text-xs outline-none";
const inputStyle = { borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" };

// Reemplaza los window.prompt() encadenados que existian por cada accion del
// caso correctivo (ceac_diagnosis, classify_case, close_case, etc.) -- una
// serie de dialogos nativos del navegador rompia el lenguaje visual del resto
// del rework (formularios reales con inputClass/inputStyle) y no dejaba
// rastro visible de que datos se estaban enviando antes de confirmar.
//
// `fields` describe el formulario de la accion activa; el field opcional
// `when` filtra campos segun el resto de valores ya capturados (ej.: el campo
// de proveedor solo aplica si classification === "software_lis").
const FIELD_TYPES = {
  text: (field, value, onChange) => (
    <input value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} className={inputClass} style={inputStyle} />
  ),
  textarea: (field, value, onChange) => (
    <textarea rows={field.rows || 3} value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} className={inputClass} style={inputStyle} />
  ),
  datetime: (field, value, onChange) => (
    <input type="datetime-local" value={value || ""} onChange={(event) => onChange(event.target.value)} className={inputClass} style={inputStyle} />
  ),
  number: (field, value, onChange) => (
    <input type="number" value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} className={inputClass} style={inputStyle} />
  ),
};

const CorrectiveActionForm = ({ title, fields = [], staticValues = {}, busy, onCancel, onSubmit }) => {
  const [values, setValues] = useState({});
  const visibleFields = fields.filter((field) => !field.when || field.when(values));

  const setValue = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));

  const missingRequired = visibleFields.some((field) => field.required && !String(values[field.key] || "").trim());

  const submit = () => {
    if (missingRequired) return;
    const payload = { ...staticValues };
    visibleFields.forEach((field) => {
      const raw = values[field.key];
      if (raw === undefined || raw === "") return;
      payload[field.key] = field.type === "number" ? Number(raw) : raw;
    });
    onSubmit(payload);
  };

  return (
    <div className="rounded-[var(--st-radius-md)] border p-3" style={{ borderColor: "var(--st-accent)", background: "var(--st-accent-soft)" }}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--st-accent-strong)" }}>{title}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {visibleFields.map((field) => (
          <div key={field.key} className={field.wide ? "sm:col-span-2" : undefined}>
            <label className="mb-1 block text-[11px] font-medium" style={{ color: "var(--st-text-muted)" }}>
              {field.label}{field.required ? " *" : ""}
            </label>
            {(FIELD_TYPES[field.type] || FIELD_TYPES.text)(field, values[field.key], (value) => setValue(field.key, value))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" loading={busy} disabled={missingRequired} onClick={submit}>Confirmar</Button>
      </div>
    </div>
  );
};

export default CorrectiveActionForm;
