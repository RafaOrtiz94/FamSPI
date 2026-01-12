import React, { useMemo } from "react";
import { FiCalendar } from "react-icons/fi";

const monthNames = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

const MantenimientosList = ({ items = [], loading = false }) => {
  const normalized = useMemo(() => items || [], [items]);

  // Agrupar por mes usando fecha programada o fecha de creación
  const grouped = useMemo(() => {
    const map = new Map();
    normalized.forEach((r) => {
      const dateStr = r.scheduled_date || r.fecha_programada || r.created_at || r.fecha;
      const d = dateStr ? new Date(dateStr) : new Date();
      const m = d.getMonth();
      const arr = map.get(m) || [];
      arr.push(r);
      map.set(m, arr);
    });
    return map;
  }, [normalized]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FiCalendar /> Cronograma Anual de Mantenimientos
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Resumen por mes (pendientes vs cumplidos).
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">Cargando cronograma...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {monthNames.map((name, i) => {
            const arr = grouped.get(i) || [];
            const pendientes = arr.filter((x) => (x.estado || x.status) === "pendiente" || (x.estado || x.status) === "pending").length;
            const cumplidos = arr.filter((x) => (x.estado || x.status) === "cumplido" || (x.estado || x.status) === "done" || (x.estado || x.status) === "approved").length;

            return (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{name}</h3>
                  <span className="text-xs text-gray-500">{arr.length} total</span>
                </div>

                <div className="flex items-center gap-3 mt-2">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">{pendientes} pendientes</span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">{cumplidos} cumplidos</span>
                </div>

                <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                  {arr.slice(0, 10).map((x) => (
                    <li key={x.id} className="text-sm text-gray-700 dark:text-gray-300 flex justify-between">
                      <span>{x.equipo_nombre || `Equipo ${x.id_equipo}`} — {x.tipo}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(x.scheduled_date || x.created_at || x.fecha).toLocaleDateString()}
                      </span>
                    </li>
                  ))}

                  {arr.length === 0 && (
                    <li className="text-sm text-gray-400">Sin mantenimientos.</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MantenimientosList;
