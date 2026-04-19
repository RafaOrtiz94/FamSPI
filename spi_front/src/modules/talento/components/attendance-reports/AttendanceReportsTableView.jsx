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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 max-h-[500px] overflow-y-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-slate-800" onClick={() => handleSort("date")}>Fecha<SortIcon field="date" /></th>
              <th className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-slate-800" onClick={() => handleSort("fullname")}>Colaborador<SortIcon field="fullname" /></th>
              <th className="px-4 py-3 text-left font-semibold">Departamento</th>
              <th className="px-4 py-3 text-left font-semibold">Estado</th>
              <th className="px-4 py-3 text-left font-semibold">Imprevistas</th>
              <th className="px-4 py-3 text-left font-semibold">Oper. campo</th>
              <th className="px-4 py-3 text-left font-semibold">Disc.</th>
              <th className="px-4 py-3 text-left font-semibold">Geo</th>
              <th className="px-4 py-3 text-left font-semibold">E/S completas</th>
              <th className="px-4 py-3 text-right font-semibold cursor-pointer hover:bg-slate-800" onClick={() => handleSort("total_hours")}>Horas<SortIcon field="total_hours" /></th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedRows.map((row) => {
              const fieldOpsSummary = getFieldOpsBreakdown(row);
              const fieldOpsTimes = getFieldOpsTimeSummary(row);
              const unexpectedMarks = getUnexpectedMarks(row);
              return (
              <tr
                key={`${row.id}-${row.date}`}
                className="bg-white hover:bg-slate-50 cursor-pointer"
                onClick={() => onRowClick?.(row)}
              >
                <td className="px-4 py-3 text-slate-700">{formatDateSafe(row.date, "dd/MM/yyyy")}</td>
                <td className="px-4 py-3">
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
                      <div className="font-semibold text-slate-950">{row.fullname || row.email || "Usuario"}</div>
                      <div className="text-xs text-slate-500">{row.email || "-"}</div>
                    </div>
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-700">{row.department_name || "-"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {row.attendance_status_label || "Sin estado"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {getUnexpectedExitLabel(row) ? (
                    <div className="space-y-1 text-xs">
                      <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-1 font-medium text-rose-700">
                        {getUnexpectedExitLabel(row)}
                      </span>
                      {unexpectedMarks ? (
                        <div className="flex flex-col gap-1 text-[11px] text-rose-800">
                          <span>Salida inesperada: {unexpectedMarks.out}</span>
                          <span>Entrada inesperada: {unexpectedMarks.in}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {getFieldOpsCount(row) > 0 ? (
                    <div className="space-y-1 text-xs">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 font-medium text-blue-700">
                        {getFieldOpsCount(row)} evento{getFieldOpsCount(row) === 1 ? "" : "s"}
                      </span>
                      <div className="flex flex-col gap-1 text-[11px] text-slate-600">
                        <span>Oficina/viaje: {fieldOpsSummary.officeExit} salida / {fieldOpsSummary.officeEntry} entrada</span>
                        <span>Cliente: {fieldOpsSummary.clientEntry} entrada / {fieldOpsSummary.clientExit} salida</span>
                        {unexpectedMarks ? (
                          <span className="text-rose-700">
                            Imprevista cliente: {unexpectedMarks.clientIn} entrada / {unexpectedMarks.clientOut} salida
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.has_discrepancy ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
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
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
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
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-slate-800">Normal</div>
                    <div>Entrada: {formatTimeSafe(row.entry_time) || "--"}</div>
                    <div>Salida: {formatTimeSafe(row.exit_time) || "--"}</div>
                    <div className="pt-1 font-semibold text-rose-700">Inesperada</div>
                    <div>Salida: {unexpectedMarks?.out || "--"}</div>
                    <div>Entrada: {unexpectedMarks?.in || "--"}</div>
                    <div className="pt-1 font-semibold text-blue-700">Campo (oficina/viaje)</div>
                    <div>Salida: {fieldOpsTimes.officeExit}</div>
                    <div>Entrada: {fieldOpsTimes.officeEntry}</div>
                    <div className="pt-1 font-semibold text-violet-700">Cliente</div>
                    <div>Entrada: {fieldOpsTimes.clientEntry !== "--" ? fieldOpsTimes.clientEntry : unexpectedMarks?.clientIn || "--"}</div>
                    <div>Salida: {fieldOpsTimes.clientExit !== "--" ? fieldOpsTimes.clientExit : unexpectedMarks?.clientOut || "--"}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {row.total_hours ? `${Number(row.total_hours).toFixed(1)}h` : "--"}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onProfileClick?.(row);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300"
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
                      className="ml-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    >
                      Mapa
                    </button>
                  ) : null}
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
