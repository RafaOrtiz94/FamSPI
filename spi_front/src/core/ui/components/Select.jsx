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
    {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}
    <select
      value={value}
      onChange={onChange}
      className={`w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 ${className}`}
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
