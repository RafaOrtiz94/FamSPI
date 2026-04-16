import React from "react";
import SearchableSelect from "../../../../core/ui/components/SearchableSelect";

const AttendanceReportsToolbar = ({
  title = "Consulta administrativa",
  description = "Usa este bloque para revisar estados de jornada sin generar el PDF oficial.",
  actionLabel = "Consultar rango",
  onAction,
  disabled = false,
  clearLabel = "Limpiar filtros",
  onClear,
  clearDisabled = false,
  quickFilters = [],
  onQuickFilter,
  warningText,
  onlyDiscrepancies = false,
  onToggleDiscrepancies,
  onlyWithGeo = false,
  onToggleWithGeo,
  departmentId = "",
  departmentOptions = [],
  onChangeDepartment,
  userOptions = [],
  selectedUserId = "",
  onSelectUser,
  children,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {actionLabel}
        </button>
      </div>
      {onClear ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClear}
            disabled={clearDisabled}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {clearLabel}
          </button>
        </div>
      ) : null}
      {Array.isArray(quickFilters) && quickFilters.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {quickFilters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onQuickFilter?.(item.key)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                item.active
                  ? "border-blue-200 bg-blue-50 text-blue-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      {warningText ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          {warningText}
        </div>
      ) : null}
      {typeof onToggleDiscrepancies === "function" ? (
        <button
          type="button"
          onClick={() => onToggleDiscrepancies(!onlyDiscrepancies)}
          className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
            onlyDiscrepancies
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-current" />
          Solo discrepancias
        </button>
      ) : null}
      {typeof onToggleWithGeo === "function" ? (
        <button
          type="button"
          onClick={() => onToggleWithGeo(!onlyWithGeo)}
          className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
            onlyWithGeo
              ? "border-cyan-200 bg-cyan-50 text-cyan-800"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-current" />
          Solo geolocalizacion
        </button>
      ) : null}
      {typeof onChangeDepartment === "function" ? (
        <label className="block max-w-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Departamento
          </span>
          <select
            value={departmentId}
            onChange={(event) => onChangeDepartment(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="">Todos los departamentos</option>
            {departmentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {typeof onSelectUser === "function" ? (
        <div className="max-w-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Usuario</span>
          <SearchableSelect
            options={userOptions}
            value={selectedUserId}
            onChange={onSelectUser}
            placeholder="Buscar usuario por nombre o correo"
          />
        </div>
      ) : null}
      {children ? <div>{children}</div> : null}
    </div>
  );
};

export default AttendanceReportsToolbar;
