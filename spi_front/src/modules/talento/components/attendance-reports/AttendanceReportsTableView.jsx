import React from "react";
import { formatDateSafe, formatTimeSafe } from "../../../../shared/utils/dateUtils";

const AttendanceReportsTableView = ({ rows = [], onRowClick, onProfileClick }) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold">Colaborador</th>
              <th className="px-4 py-3 text-left font-semibold">Departamento</th>
              <th className="px-4 py-3 text-left font-semibold">Estado</th>
              <th className="px-4 py-3 text-left font-semibold">Marcas</th>
              <th className="px-4 py-3 text-right font-semibold">Horas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={`${row.id}-${row.date}`}
                className="bg-white"
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
                    className="text-left"
                  >
                    <div className="font-semibold text-slate-950">{row.fullname || row.email || "Usuario"}</div>
                    <div className="text-xs text-slate-500">{row.email || "-"}</div>
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-700">{row.department_name || "-"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {row.attendance_status_label || "Sin estado"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <div className="space-y-1 text-xs">
                    <div>Entrada: {formatTimeSafe(row.entry_time) || "--"}</div>
                    <div>
                      Almuerzo: {formatTimeSafe(row.lunch_start_time) || "--"} /{" "}
                      {formatTimeSafe(row.lunch_end_time) || "--"}
                    </div>
                    <div>Salida: {formatTimeSafe(row.exit_time) || "--"}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {row.total_hours ? `${Number(row.total_hours).toFixed(1)}h` : "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceReportsTableView;
