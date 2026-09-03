import React from "react";

const Select = ({
  label,
  options,
  value,
  onChange,
  children,
  className = "",
  containerClassName = "mb-3",
  includePlaceholder = true,
  placeholderLabel = "Seleccione...",
}) => (
  <div className={containerClassName}>
    {label && <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>}
    <select
      value={value}
      onChange={onChange}
      className={`w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${className}`}
    >
      {includePlaceholder ? <option value="">{placeholderLabel}</option> : null}
      {Array.isArray(options)
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  </div>
);

export default Select;
export { Select };
