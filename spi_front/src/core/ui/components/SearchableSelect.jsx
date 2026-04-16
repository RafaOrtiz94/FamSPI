import React, { useMemo, useState } from "react";

const SearchableSelect = ({
  options = [],
  value = "",
  onChange,
  placeholder = "Buscar...",
  className = "",
}) => {
  const [query, setQuery] = useState("");
  const normalizedQuery = String(query || "").trim().toLowerCase();

  const selectedOption = useMemo(
    () => (Array.isArray(options) ? options.find((option) => String(option.value) === String(value)) : null),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];
    if (!normalizedQuery) return options;
    return options.filter((option) => String(option.label || "").toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, options]);

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
      />
      <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const isActive = String(option.value) === String(value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange?.(option.value)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                  isActive ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>{option.label}</span>
                {isActive ? <span className="text-xs font-semibold">Activo</span> : null}
              </button>
            );
          })
        ) : (
          <div className="px-3 py-2 text-sm text-slate-500">Sin coincidencias</div>
        )}
      </div>
      {selectedOption ? (
        <div className="text-xs text-slate-500">Seleccionado: {selectedOption.label}</div>
      ) : null}
    </div>
  );
};

export default SearchableSelect;
