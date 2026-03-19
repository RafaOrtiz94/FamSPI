import React from "react";

const Input = ({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  className = "",
  containerClassName = "mb-3",
  ...rest
}) => (
  <div className={containerClassName}>
    {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 ${className}`}
      {...rest}
    />
  </div>
);

export default Input;
