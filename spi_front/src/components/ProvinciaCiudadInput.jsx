import React, { useState, useRef } from "react";
import { searchEcuadorLocations } from "../data/ecuadorGeography";

/**
 * Input de autocompletado de provincia/ciudad del Ecuador.
 *
 * Props:
 *   value        {string}   — valor actual del input (texto libre o "Canton, Provincia")
 *   onChange     {fn}       — fn(text) — se llama con el texto mientras el usuario escribe
 *   onSelect     {fn}       — fn({ canton, provincia, label }) — se llama al elegir una opción
 *   disabled     {boolean}
 *   placeholder  {string}
 *   className    {string}   — clases extra para el input
 *   error        {string}   — mensaje de error a mostrar
 *   id           {string}
 */
const ProvinciaCiudadInput = ({
  value = "",
  onChange,
  onSelect,
  disabled = false,
  placeholder = "Ej: Quito o Pichincha...",
  className = "",
  error,
  id,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);

  const baseInputClass =
    "w-full border rounded-xl px-4 py-2.5 transition-all outline-none " +
    "bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 " +
    "focus:border-blue-400 text-gray-900 placeholder-gray-400 " +
    "disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed";

  const handleChange = (e) => {
    const text = e.target.value;
    onChange?.(text);
    const results = searchEcuadorLocations(text);
    setSuggestions(results);
    setOpen(results.length > 0);
  };

  const handleFocus = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (value && value.length >= 2) {
      const results = searchEcuadorLocations(value);
      setSuggestions(results);
      setOpen(results.length > 0);
    }
  };

  const handleBlur = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  const handleSelect = (loc) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    onChange?.(loc.label);
    onSelect?.(loc);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={`${baseInputClass} ${error ? "border-rose-400 focus:ring-rose-100 focus:border-rose-400" : ""} ${className}`}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {suggestions.map((loc) => (
            <li key={loc.label}>
              <button
                type="button"
                className="w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(loc)}
              >
                <p className="text-sm font-medium text-slate-900">{loc.canton}</p>
                <p className="text-xs text-slate-500">{loc.provincia}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
};

export default ProvinciaCiudadInput;
