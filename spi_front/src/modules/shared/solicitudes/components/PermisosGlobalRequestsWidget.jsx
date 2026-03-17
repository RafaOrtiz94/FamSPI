import React, { useEffect, useMemo, useState } from "react";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { getResumenColaboradores } from "../../../../core/api/permisosApi";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";

const normalizeStatus = (status = "") => {
  const value = String(status || "").toLowerCase();
  if (["approved", "aprobado"].includes(value)) return "approved";
  if (["rejected", "rechazado"].includes(value)) return "rejected";
  if (value === "partially_approved") return "partially_approved";
  if (value === "pending_final") return "pending_final";
  return "pending";
};

const STATUS_META = {
  approved: { label: "Aprobado", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rechazado", className: "bg-rose-50 text-rose-700 border-rose-200" },
  partially_approved: { label: "Parcial", className: "bg-blue-50 text-blue-700 border-blue-200" },
  pending_final: { label: "Pendiente final", className: "bg-purple-50 text-purple-700 border-purple-200" },
  pending: { label: "Pendiente", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

const INITIAL_VISIBLE_ROWS = 25;

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-EC");
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-EC");
};

const PermisosGlobalRequestsWidget = () => {
  const { showToast } = useUI();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ROWS);

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await getResumenColaboradores();
      const collaborators = Array.isArray(response?.data) ? response.data : [];
      const flattened = collaborators.flatMap((collaborator) => {
        const ownerName = collaborator.user_fullname || collaborator.user_email || "Colaborador";
        const ownerEmail = collaborator.user_email || "";

        const permisos = (collaborator.permisos?.items || []).map((item) => ({
          key: `permiso-${item.id}`,
          id: item.id,
          tipo: "permiso",
          detalle: item.tipo_permiso || "permiso",
          colaborador: ownerName,
          colaborador_email: ownerEmail,
          fecha_inicio: item.fecha_inicio,
          fecha_fin: item.fecha_fin,
          creado: item.created_at,
          status: normalizeStatus(item.status),
        }));

        const vacaciones = (collaborator.vacaciones?.items || []).map((item) => ({
          key: `vacacion-${item.id}`,
          id: item.id,
          tipo: "vacaciones",
          detalle: `${item.duracion_dias || 0} día(s)`,
          colaborador: ownerName,
          colaborador_email: ownerEmail,
          fecha_inicio: item.fecha_inicio,
          fecha_fin: item.fecha_fin,
          creado: item.created_at,
          status: normalizeStatus(item.status),
        }));

        return [...permisos, ...vacaciones];
      });

      flattened.sort((a, b) => {
        const left = a.creado ? new Date(a.creado).getTime() : 0;
        const right = b.creado ? new Date(b.creado).getTime() : 0;
        return right - left;
      });

      setRows(flattened);
    } catch (error) {
      console.error("Error cargando solicitudes globales:", error);
      showToast("No se pudo cargar el resumen global de solicitudes", "warning");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useScopedAutoUpdate(
    [DATA_UPDATE_SCOPES.PERMISOS, DATA_UPDATE_SCOPES.VACACIONES],
    () => {
      load({ silent: true });
    },
  );

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !term ||
        row.colaborador.toLowerCase().includes(term) ||
        row.colaborador_email.toLowerCase().includes(term) ||
        row.detalle.toLowerCase().includes(term) ||
        String(row.id).includes(term);
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_ROWS);
  }, [search, statusFilter]);

  const visibleRows = useMemo(
    () => filteredRows.slice(0, visibleCount),
    [filteredRows, visibleCount]
  );

  const metrics = useMemo(() => {
    const base = {
      total: filteredRows.length,
      approved: 0,
      rejected: 0,
      pending: 0,
    };
    filteredRows.forEach((row) => {
      if (row.status === "approved") base.approved += 1;
      else if (row.status === "rejected") base.rejected += 1;
      else base.pending += 1;
    });
    return base;
  }, [filteredRows]);

  return (
    <Card className="p-6 border border-gray-200 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">Supervisión ejecutiva</p>
          <h3 className="text-lg font-semibold text-gray-900">Solicitudes globales de colaboradores</h3>
          <p className="text-sm text-gray-500">Visibilidad consolidada de permisos y vacaciones para control y auditoría.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500 uppercase font-semibold">Total</p>
          <p className="text-xl font-bold text-slate-800">{metrics.total}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs text-emerald-600 uppercase font-semibold">Aprobadas</p>
          <p className="text-xl font-bold text-emerald-800">{metrics.approved}</p>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs text-rose-600 uppercase font-semibold">Rechazadas</p>
          <p className="text-xl font-bold text-rose-800">{metrics.rejected}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-600 uppercase font-semibold">Pendientes</p>
          <p className="text-xl font-bold text-amber-800">{metrics.pending}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar colaborador, correo, detalle o #id"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
        >
          <option value="all">Todos los estados</option>
          <option value="approved">Aprobado</option>
          <option value="rejected">Rechazado</option>
          <option value="pending">Pendiente</option>
          <option value="partially_approved">Parcial</option>
          <option value="pending_final">Pendiente final</option>
        </select>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 flex items-center">
          Registros visibles: <span className="ml-1 font-semibold text-gray-900">{visibleRows.length}</span>
          <span className="ml-1 text-gray-400">/ {filteredRows.length}</span>
        </div>
      </div>

      <div className="overflow-auto border border-gray-200 rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Solicitud</th>
              <th className="text-left px-3 py-2 font-semibold">Colaborador</th>
              <th className="text-left px-3 py-2 font-semibold">Detalle</th>
              <th className="text-left px-3 py-2 font-semibold">Fechas</th>
              <th className="text-left px-3 py-2 font-semibold">Creado</th>
              <th className="text-left px-3 py-2 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-gray-500" colSpan={6}>Cargando solicitudes...</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-gray-500" colSpan={6}>No hay solicitudes para el filtro actual.</td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const meta = STATUS_META[row.status] || STATUS_META.pending;
                return (
                  <tr key={row.key} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-gray-800">#{row.id}</div>
                      <div className="text-xs text-gray-500 uppercase">{row.tipo}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{row.colaborador}</div>
                      <div className="text-xs text-gray-500">{row.colaborador_email || "-"}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-700 capitalize">{row.detalle}</td>
                    <td className="px-3 py-2 text-gray-700">{formatDate(row.fecha_inicio)} - {formatDate(row.fecha_fin)}</td>
                    <td className="px-3 py-2 text-gray-700">{formatDateTime(row.creado)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${meta.className}`}>
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filteredRows.length > INITIAL_VISIBLE_ROWS && (
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-gray-600">
            Mostrando <span className="font-semibold text-gray-900">{visibleRows.length}</span> de{" "}
            <span className="font-semibold text-gray-900">{filteredRows.length}</span> registros
          </p>
          <div className="flex gap-2">
            {visibleRows.length < filteredRows.length && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setVisibleCount((current) => Math.min(filteredRows.length, current + INITIAL_VISIBLE_ROWS))}
                className="text-xs"
              >
                Ver más
              </Button>
            )}
            {visibleRows.length > INITIAL_VISIBLE_ROWS && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setVisibleCount(INITIAL_VISIBLE_ROWS)}
                className="text-xs"
              >
                Mostrar menos
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

export default PermisosGlobalRequestsWidget;
