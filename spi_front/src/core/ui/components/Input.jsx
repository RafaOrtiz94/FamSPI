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
    {label && <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 transition placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${className}`}
      {...rest}
    />
  </div>
);

export default Input;
