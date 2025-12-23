import React from "react";

const Select = ({
  label,
  options,
  value,
  onChange,
  children,
  className = "",
  containerClassName = "mb-3",
}) => (
  <div className={containerClassName}>
    {label && (
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
    )}
    <select
      value={value}
      onChange={onChange}
      className={`w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 ${className}`}
    >
      <option value="">Seleccione...</option>

      {/* ✅ Si hay "options", se mapean; si no, se renderizan los children */}
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
