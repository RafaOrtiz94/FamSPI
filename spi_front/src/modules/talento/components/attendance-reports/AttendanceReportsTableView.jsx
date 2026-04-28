import React, { useMemo, useState } from "react";
import { formatDateSafe, formatTimeSafe } from "../../../../shared/utils/dateUtils";

const getInitial = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0]?.[0]?.toUpperCase() || "?";
};

const getColorFromName = (name) => {
  if (!name) return "bg-slate-400";
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-violet-500",
    "bg-cyan-500",
    "bg-orange-500",
    "bg-indigo-500",
  ];
  const index = Math.abs(name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
  return colors[index];
};

const UserAvatar = ({ name, size = "md" }) => {
  const initial = getInitial(name);
  const bgColor = getColorFromName(name);
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };

  return (
    <div
      className={`${sizeClasses[size] || sizeClasses.md} flex items-center justify-center rounded-full font-semibold text-white ${bgColor}`}
    >
      {initial}
    </div>
  );
};

const getUnexpectedExitLabel = (row = {}) => {
  if (!row?.exception_id) return null;
  const status = String(row.exception_status || "").trim().toUpperCase();
  if (status === "ACTIVE") return "Imprevista activa";
  if (status === "ON_SITE") return "En sitio";
  if (status === "RETURNING") return "Retornando";
  if (status === "COMPLETED") return "Imprevista cerrada";
  return "Imprevista";
};

const getUnexpectedMarks = (row = {}) => {
  const hasUnexpected = Boolean(row?.exception_id);
  if (!hasUnexpected) return null;

  return {
    out: formatTimeSafe(row?.start_time) || "--",
    in: formatTimeSafe(row?.return_time) || "--",
    clientIn: formatTimeSafe(row?.arrival_time) || "--",
    clientOut: formatTimeSafe(row?.departure_time) || "--",
  };
};

const getFieldOpsCount = (row = {}) => {
  if (Array.isArray(row?.field_events)) {
    return row.field_events.filter((event) => Boolean(event?.time || event?.timestamp || event?.occurred_at)).length;
  }
  return 0;
};

const normalizeFieldEventType = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const getFieldOpsBreakdown = (row = {}) => {
  const summary = {
    officeExit: 0,
    officeEntry: 0,
    clientEntry: 0,
    clientExit: 0,
  };

  const events = Array.isArray(row?.field_events) ? row.field_events : [];
  events.forEach((event) => {
    const hasTime = Boolean(event?.time || event?.timestamp || event?.occurred_at);
    if (!hasTime) return;

    const type = normalizeFieldEventType(event?.type || event?.event_type);
    if (type === "office_exit" || type === "field_out") summary.officeExit += 1;
    if (type === "office_entry") summary.officeEntry += 1;
    if (type === "client_entry" || type === "arrival") summary.clientEntry += 1;
    if (type === "client_exit" || type === "departure") summary.clientExit += 1;
  });

  return summary;
};

const isOperationalExceptionType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return [
    "operacion_campo",
    "operacion_de_campo",
    "salida_oficina",
    "viaje",
    "campo",
  ].includes(normalized);
};

const getFieldOpsTimeSummary = (row = {}) => {
  const summary = {
    officeExit: [],
    officeEntry: [],
    clientEntry: [],
    clientExit: [],
  };

  const events = Array.isArray(row?.field_events) ? row.field_events : [];
  events.forEach((event) => {
    const rawTime = event?.time || event?.timestamp || event?.occurred_at;
    if (!rawTime) return;
    const timeLabel = formatTimeSafe(rawTime);
    if (!timeLabel) return;

    const type = normalizeFieldEventType(event?.type || event?.event_type);
    if (type === "office_exit" || type === "field_out") summary.officeExit.push(timeLabel);
    if (type === "office_entry") summary.officeEntry.push(timeLabel);
    if (type === "client_entry" || type === "arrival") summary.clientEntry.push(timeLabel);
    if (type === "client_exit" || type === "departure") summary.clientExit.push(timeLabel);
  });

  const lastOrDash = (list = []) => (list.length > 0 ? list[list.length - 1] : "--");
  return {
    officeExit: lastOrDash(summary.officeExit),
    officeEntry: lastOrDash(summary.officeEntry),
    clientEntry: lastOrDash(summary.clientEntry),
    clientExit: lastOrDash(summary.clientExit),
  };
};

const AttendanceReportsTableView = ({ rows = [], onRowClick, onProfileClick, onMapClick }) => {
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");

  const sortedRows = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    const sorted = [...rows].sort((a, b) => {
      let aVal, bVal;
      if (sortField === "date") {
        aVal = new Date(a.date).getTime();
        bVal = new Date(b.date).getTime();
      } else if (sortField === "fullname") {
        aVal = String(a.fullname || "").toLowerCase();
        bVal = String(b.fullname || "").toLowerCase();
      } else if (sortField === "total_hours") {
        aVal = Number(a.total_hours) || 0;
        bVal = Number(b.total_hours) || 0;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [rows, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return (
      <span className="ml-1 inline-block text-current">
        {sortDirection === "asc" ? "^" : "v"}
      </span>
    );
  };

  if (!Array.isArray(sortedRows) || sortedRows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-3">
        <p className="text-xs font-medium text-slate-600">
          Horas en formato 24h (hora Ecuador, UTC-5).
        </p>
        <p className="text-xs text-slate-500">
          Registros: <span className="font-semibold text-slate-700">{sortedRows.length}</span>
        </p>
      </div>
      <div className="max-h-[560px] overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-track-slate-100 scrollbar-thumb-slate-300">
        <table className="min-w-[1640px] divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th
                className="sticky left-0 top-0 z-30 w-32 cursor-pointer bg-slate-900 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hover:bg-slate-800"
                onClick={() => handleSort("date")}
              >
                Fecha
                <SortIcon field="date" />
              </th>
              <th
                className="sticky left-32 top-0 z-30 w-80 cursor-pointer bg-slate-900 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hover:bg-slate-800"
                onClick={() => handleSort("fullname")}
              >
                Colaborador
                <SortIcon field="fullname" />
              </th>
              <th className="sticky top-0 z-20 w-48 bg-slate-900 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Departamento</th>
              <th className="sticky top-0 z-20 w-44 bg-slate-900 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Estado</th>
              <th className="sticky top-0 z-20 w-64 bg-slate-900 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Imprevistas</th>
              <th className="sticky top-0 z-20 w-64 bg-slate-900 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Operación campo</th>
              <th className="sticky top-0 z-20 w-24 bg-slate-900 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Disc.</th>
              <th className="sticky top-0 z-20 w-24 bg-slate-900 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Geo</th>
              <th className="sticky top-0 z-20 w-[440px] bg-slate-900 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Resumen de marcaciones</th>
              <th
                className="sticky top-0 z-20 w-28 cursor-pointer bg-slate-900 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide hover:bg-slate-800"
                onClick={() => handleSort("total_hours")}
              >
                Horas
                <SortIcon field="total_hours" />
              </th>
              <th className="sticky top-0 z-20 w-40 bg-slate-900 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedRows.map((row) => {
              const fieldOpsSummary = getFieldOpsBreakdown(row);
              const fieldOpsTimes = getFieldOpsTimeSummary(row);
              const unexpectedMarks = getUnexpectedMarks(row);
              const fieldOpsCount = getFieldOpsCount(row);
              const operationalSpanDays = Number(row?.operational_span_days || 0);
              const hasOperationalMultiDay = isOperationalExceptionType(row?.exception_type) && operationalSpanDays > 1;
              const operationalElapsedHours = Number(row?.operational_elapsed_hours || 0);
              const collaboratorLabel = row.fullname || row.email || "Usuario";
              return (
              <tr
                key={`${row.id}-${row.date}`}
                className="group cursor-pointer bg-white hover:bg-slate-50"
                onClick={() => onRowClick?.(row)}
              >
                <td className="sticky left-0 z-20 bg-white px-4 py-3 text-slate-700 group-hover:bg-slate-50">
                  <div className="font-semibold text-slate-800">{formatDateSafe(row.date, "dd/MM/yyyy")}</div>
                </td>
                <td className="sticky left-32 z-20 bg-white px-4 py-3 group-hover:bg-slate-50">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onProfileClick?.(row);
                    }}
                    className="flex items-center gap-3 text-left hover:opacity-80"
                  >
                    <UserAvatar name={row.fullname || row.email} size="md" />
                    <div>
                      <div className="font-semibold text-slate-950">{collaboratorLabel}</div>
                      <div className="text-xs text-slate-500">{row.email || "-"}</div>
                    </div>
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-700">{row.department_name || "-"}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {row.attendance_status_label || "Sin estado"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {getUnexpectedExitLabel(row) ? (
                    <div className="space-y-2 text-xs">
                      <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-1 font-medium text-rose-700">
                        {getUnexpectedExitLabel(row)}
                      </span>
                      {unexpectedMarks ? (
                        <div className="rounded-lg border border-rose-100 bg-rose-50/70 p-2 text-[11px] text-rose-800">
                          <div>Salida: <span className="font-semibold">{unexpectedMarks.out}</span></div>
                          <div>Entrada: <span className="font-semibold">{unexpectedMarks.in}</span></div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {fieldOpsCount > 0 ? (
                    <div className="space-y-2 text-xs">
                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-1 font-medium text-blue-700">
                        {fieldOpsCount} evento{fieldOpsCount === 1 ? "" : "s"}
                      </span>
                      <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-2 text-[11px] text-slate-700">
                        <div>Oficina/viaje: <span className="font-semibold">{fieldOpsSummary.officeExit}</span> salida / <span className="font-semibold">{fieldOpsSummary.officeEntry}</span> entrada</div>
                        <div>Cliente: <span className="font-semibold">{fieldOpsSummary.clientEntry}</span> entrada / <span className="font-semibold">{fieldOpsSummary.clientExit}</span> salida</div>
                        {unexpectedMarks ? (
                          <div className="text-rose-700">
                            Imprevista cliente: {unexpectedMarks.clientIn} entrada / {unexpectedMarks.clientOut} salida
                          </div>
                        ) : null}
                      </div>
                      {hasOperationalMultiDay ? (
                        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-[11px] text-indigo-800">
                          <div className="font-semibold">Operaci&oacute;n multi-d&iacute;a</div>
                          <div>
                            Duraci&oacute;n: {operationalSpanDays} d&iacute;as ({Number.isFinite(operationalElapsedHours) ? operationalElapsedHours.toFixed(1) : "0.0"} h)
                          </div>
                          <div>
                            Rango: {formatDateSafe(row?.operational_start_date, "dd/MM/yyyy") || "--"} - {formatDateSafe(row?.operational_end_date, "dd/MM/yyyy") || "--"}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    hasOperationalMultiDay ? (
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-[11px] text-indigo-800">
                        <div className="font-semibold">Operaci&oacute;n multi-d&iacute;a</div>
                        <div>
                          Duraci&oacute;n: {operationalSpanDays} d&iacute;as ({Number.isFinite(operationalElapsedHours) ? operationalElapsedHours.toFixed(1) : "0.0"} h)
                        </div>
                        <div>
                          Rango: {formatDateSafe(row?.operational_start_date, "dd/MM/yyyy") || "--"} - {formatDateSafe(row?.operational_end_date, "dd/MM/yyyy") || "--"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.has_discrepancy ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765 1.36 2.722 3.78 5.392 4.402a1.94 1.94 0 011.823 2.04l-.588 4.308a1.94 1.94 0 01-1.913 1.597H6.837a1.94 1.94 0 01-1.913-1.597L4.336 9.541A1.94 1.94 0 016.16 7.5c.48-.062 1.105-.143 1.823-.01 1.48-.32 2.525-1.38 3.01-2.22a1.521 1.521 0 00-1.08-2.063l-.928-.17c-.87-.158-1.65-.06-2.304.275-.64.33-1.152.885-1.465 1.547l-.295.063a.29.29 0 00-.198.35c.063.166.19.31.345.39l.928.482c.32.166.672.253 1.037.253.448 0 .873-.139 1.238-.38.345-.227.598-.553.738-.95l.218-.62c.233-.663.114-1.42-.32-2.006a.29.29 0 00-.345-.062l-.928.17zM10 13a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                      </svg>
                      !
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.has_geo ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      Geo
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <div className="grid grid-cols-1 gap-2 text-xs lg:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <div className="mb-1 font-semibold text-slate-800">Normal</div>
                      <div>Entrada: <span className="font-medium">{formatTimeSafe(row.entry_time) || "--"}</span></div>
                      <div>Salida: <span className="font-medium">{formatTimeSafe(row.exit_time) || "--"}</span></div>
                    </div>
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-2">
                      <div className="mb-1 font-semibold text-rose-700">Inesperada</div>
                      <div>Salida: <span className="font-medium">{unexpectedMarks?.out || "--"}</span></div>
                      <div>Entrada: <span className="font-medium">{unexpectedMarks?.in || "--"}</span></div>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
                      <div className="mb-1 font-semibold text-blue-700">Oficina / viaje</div>
                      <div>Salida: <span className="font-medium">{fieldOpsTimes.officeExit}</span></div>
                      <div>Entrada: <span className="font-medium">{fieldOpsTimes.officeEntry}</span></div>
                    </div>
                    <div className="rounded-lg border border-violet-200 bg-violet-50 p-2">
                      <div className="mb-1 font-semibold text-violet-700">Cliente</div>
                      <div>
                        Entrada: <span className="font-medium">{fieldOpsTimes.clientEntry !== "--" ? fieldOpsTimes.clientEntry : unexpectedMarks?.clientIn || "--"}</span>
                      </div>
                      <div>
                        Salida: <span className="font-medium">{fieldOpsTimes.clientExit !== "--" ? fieldOpsTimes.clientExit : unexpectedMarks?.clientOut || "--"}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {row.total_hours ? `${Number(row.total_hours).toFixed(1)}h` : "--"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onProfileClick?.(row);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                    >
                      Ver perfil
                    </button>
                    {onMapClick && row.has_geo ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onMapClick?.(row);
                        }}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:border-blue-300 hover:bg-blue-100"
                      >
                        Mapa
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceReportsTableView;
