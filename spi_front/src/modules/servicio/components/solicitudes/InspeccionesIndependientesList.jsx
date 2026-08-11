import React, { useCallback, useEffect, useState } from "react";
import { FiAlertCircle, FiCalendar, FiClipboard, FiMapPin, FiRefreshCw } from "react-icons/fi";
import { getRequests } from "../../../../core/api/requestsApi";

const formatDate = (value) => {
  if (!value) return "N/D";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/D";
  return d.toLocaleDateString("es-EC", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const EmptyState = () => (
  <div className="flex min-h-64 flex-col items-center justify-center rounded-[16px] border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
    <div className="rounded-full border border-slate-200 bg-slate-50 p-3.5">
      <FiClipboard size={22} className="text-slate-300" />
    </div>
    <p className="mt-4 text-sm font-medium text-slate-700">Sin solicitudes independientes</p>
    <p className="mt-1 max-w-xs text-xs text-slate-400">
      Las solicitudes de inspección de ambiente creadas directamente aparecerán aquí.
    </p>
  </div>
);

const InspeccionesIndependientesList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getRequests({ pageSize: 100, type: "F.ST-20" });
      const rows = Array.isArray(resp?.rows) ? resp.rows : Array.isArray(resp) ? resp : [];
      setItems(rows);
    } catch {
      setError("No se pudieron cargar las solicitudes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Solicitudes de inspección de ambiente creadas directamente.
        </p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <FiAlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {loading && !items.length ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-[16px] bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {items.map((row) => {
            const payload =
              typeof row.payload === "string"
                ? JSON.parse(row.payload || "{}")
                : row.payload || {};
            return (
              <div
                key={row.id}
                className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Solicitud #{row.id}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {payload.cliente || payload.nombre_cliente || "Cliente sin registrar"}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    {row.status || "Pendiente"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                  {payload.ubicacion && (
                    <span className="inline-flex items-center gap-1">
                      <FiMapPin size={11} />
                      {payload.ubicacion}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <FiCalendar size={11} />
                    {formatDate(row.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InspeccionesIndependientesList;
