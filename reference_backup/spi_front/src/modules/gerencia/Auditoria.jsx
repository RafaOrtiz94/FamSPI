import React, { useEffect, useMemo, useState } from "react";
import {
  FiSearch,
  FiFilter,
  FiDownload,
  FiClock,
  FiRefreshCw,
  FiEye,
  FiX,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import toast from "react-hot-toast";
import { getAuditoria, exportAuditoriaCSV } from "../../core/api/auditoriaApi";
import api from "../../core/api";
import Card from "../../core/ui/components/Card";
import Button from "../../core/ui/components/Button";
import Input from "../../core/ui/components/Input";
import Modal from "../../core/ui/components/Modal";

/* ============================================================
   📋 Auditoría SPI Fam — Versión Final
   ------------------------------------------------------------
   • Paginación real con backend
   • Filtros por módulo, acción y fecha
   • Exportación CSV
   • Modal de detalles (campo details JSON)
   ============================================================ */
export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
  });
  const [filters, setFilters] = useState({
    module: "",
    action: "",
    date_from: "",
    date_to: "",
  });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionFilters, setSessionFilters] = useState({
    user_email: "",
    startDate: "",
    endDate: "",
  });

  // ============================================================
  // 🔹 Obtener registros de auditoría
  // ============================================================
  const fetchAuditoria = async (page = 1) => {
    setLoading(true);
    try {
      const res = await getAuditoria({ ...filters, page, limit: pagination.limit });
      if (res.ok) {
        setLogs(res.results || []);
        setPagination({
          total: res.total,
          page: res.page,
          limit: res.limit,
        });
      } else {
        toast.error("No se pudieron obtener los registros de auditoría.");
      }
    } catch (err) {
      console.error("❌ Error cargando auditoría:", err);
      toast.error("Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const { data } = await api.get("/auth/sessions");
      const list = data?.sessions || [];
      setSessions(list);
      setFilteredSessions(list);
    } catch (err) {
      console.error("❌ Error cargando sesiones:", err);
      toast.error("No se pudieron obtener las sesiones activas.");
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditoria(1);
    loadSessions();
  }, []);

  // ============================================================
  // 🔹 Exportar CSV (descarga directa)
  // ============================================================
  const handleExport = async () => {
    try {
      toast.loading("Generando archivo CSV...");
      const res = await api.get("/auditoria/export/csv", {
        params: filters,
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "audit_trail.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.dismiss();
      toast.success("✅ Archivo CSV descargado");
    } catch (err) {
      toast.dismiss();
      toast.error("Error al exportar CSV");
    }
  };

  // ============================================================
  // 🔹 Ver detalles (carga en modal)
  // ============================================================
  const openDetail = async (id) => {
    try {
      const { data } = await api.get(`/auditoria/${id}`);
      if (data.ok) setSelected(data.audit);
      else toast.error("Registro no encontrado");
    } catch (err) {
      console.error(err);
      toast.error("Error al obtener detalle");
    }
  };

  // ============================================================
  // 🔹 Limpiar filtros
  // ============================================================
  const resetFilters = () => {
    setFilters({ module: "", action: "", date_from: "", date_to: "" });
    fetchAuditoria(1);
  };

  const applySessionFilter = () => {
    try {
      let result = [...sessions];
      if (sessionFilters.user_email) {
        result = result.filter(
          (s) =>
            (s.user_email || "").toLowerCase() ===
            sessionFilters.user_email.toLowerCase()
        );
      }
      if (sessionFilters.startDate) {
        const fromDate = new Date(sessionFilters.startDate);
        result = result.filter((s) => new Date(s.login_time) >= fromDate);
      }
      if (sessionFilters.endDate) {
        const toDate = new Date(sessionFilters.endDate);
        result = result.filter((s) => new Date(s.login_time) <= toDate);
      }
      setFilteredSessions(result);
    } catch (err) {
      console.error("❌ Error filtrando sesiones:", err);
      toast.error("Error al filtrar la trazabilidad.");
    }
  };

  const resetSessionFilters = () => {
    setSessionFilters({ user_email: "", startDate: "", endDate: "" });
    setFilteredSessions(sessions);
  };

  const sessionUsers = useMemo(
    () =>
      [...new Set(sessions.map((s) => s.user_email).filter(Boolean))].sort(),
    [sessions]
  );

  // ============================================================
  // 🔹 Renderizado
  // ============================================================
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <FiClock className="text-accent" /> Auditoría del Sistema
        </h1>

        <div className="flex gap-2">
          <Button
            onClick={handleExport}
            className="bg-primary text-white flex items-center gap-2 hover:bg-primary-dark"
          >
            <FiDownload /> Exportar CSV
          </Button>
          <Button
            onClick={() => fetchAuditoria(pagination.page)}
            className="bg-accent text-white flex items-center gap-2 hover:bg-accent-dark"
          >
            <FiRefreshCw /> Actualizar
          </Button>
        </div>
      </div>

      {/* FILTROS */}
      <Card className="p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-sm text-gray-600">Módulo</label>
            <Input
              value={filters.module}
              onChange={(e) => setFilters({ ...filters, module: e.target.value })}
              placeholder="requests, users..."
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Acción</label>
            <Input
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              placeholder="create, update..."
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Desde</label>
            <Input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Hasta</label>
            <Input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              onClick={() => fetchAuditoria(1)}
              className="w-full bg-accent text-white hover:bg-accent-dark flex items-center justify-center gap-2"
            >
              <FiSearch /> Buscar
            </Button>
            <Button
              onClick={resetFilters}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center gap-2"
            >
              <FiFilter /> Limpiar
            </Button>
          </div>
        </div>
      </Card>

      {/* TABLA */}
      <Card className="overflow-x-auto p-0">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full"></div>
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No hay registros de auditoría.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Usuario</th>
                <th className="px-4 py-3 text-left">Módulo</th>
                <th className="px-4 py-3 text-left">Acción</th>
                <th className="px-4 py-3 text-left">IP</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-center">Ver</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((item, i) => {
                const user = item.usuario_email || item.email || "—";
                const modulo = item.modulo || item.module || "—";
                const accion = item.accion || item.action || "—";
                const fecha = item.creado_en || item.created_at;
                return (
                <tr key={item.id} className="border-t hover:bg-gray-50 transition-all">
                  <td className="px-4 py-2 text-gray-500">
                    {(pagination.page - 1) * pagination.limit + i + 1}
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-800">
                    {user}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{modulo}</td>
                  <td className="px-4 py-2 text-accent font-semibold">
                    {accion}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{item.ip || "—"}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {fecha ? new Date(fecha).toLocaleString("es-EC") : "—"}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => openDetail(item.id)}
                      className="p-2 rounded-full hover:bg-gray-200 transition-all"
                      title="Ver detalles"
                    >
                      <FiEye className="text-gray-700" />
                    </button>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* PAGINACIÓN */}
      {pagination.total > pagination.limit && (
        <div className="flex justify-between items-center px-2 text-sm text-gray-600">
          <p>
            Página {pagination.page} de{" "}
            {Math.ceil(pagination.total / pagination.limit)} — Total:{" "}
            {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={pagination.page <= 1}
              onClick={() => fetchAuditoria(pagination.page - 1)}
              className="bg-gray-200 text-gray-700 hover:bg-gray-300 flex items-center gap-1"
            >
              <FiChevronLeft /> Anterior
            </Button>
            <Button
              disabled={
                pagination.page >= Math.ceil(pagination.total / pagination.limit)
              }
              onClick={() => fetchAuditoria(pagination.page + 1)}
              className="bg-gray-200 text-gray-700 hover:bg-gray-300 flex items-center gap-1"
            >
              Siguiente <FiChevronRight />
            </Button>
          </div>
        </div>
      )}

      {/* MODAL DETALLE */}
      {selected && (
        <Modal isOpen={!!selected} onClose={() => setSelected(null)}>
          <div className="p-6 max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FiEye className="text-accent" /> Detalle de Auditoría
              </h2>
              <button
                onClick={() => setSelected(null)}
                className="p-2 hover:bg-gray-200 rounded-full"
              >
                <FiX />
              </button>
            </div>

            <div className="space-y-2 text-sm text-gray-700">
              <p><strong>Usuario:</strong> {selected.usuario_email || selected.email}</p>
              <p><strong>Módulo:</strong> {selected.modulo || selected.module}</p>
              <p><strong>Acción:</strong> {selected.accion || selected.action}</p>
              <p><strong>IP:</strong> {selected.ip}</p>
              <p>
                <strong>Fecha:</strong>{" "}
                {new Date(selected.creado_en || selected.created_at).toLocaleString("es-EC")}
              </p>
            </div>

            <div className="mt-4">
              <h3 className="font-semibold text-gray-700 mb-2">Datos Nuevos</h3>
              <pre className="text-xs bg-gray-50 p-3 rounded border overflow-auto max-h-72">
                {JSON.stringify(selected.datos_nuevos || selected.details || {}, null, 2)}
              </pre>
              {selected.datos_anteriores && (
                <>
                  <h3 className="font-semibold text-gray-700 mt-4 mb-2">Datos Anteriores</h3>
                  <pre className="text-xs bg-gray-50 p-3 rounded border overflow-auto max-h-72">
                    {JSON.stringify(selected.datos_anteriores, null, 2)}
                  </pre>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* TRAZABILIDAD DE SESIONES */}
      <Card className="p-6 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <FiClock className="text-accent" />
            Trazabilidad de Sesiones
          </h2>
          <div className="flex gap-2">
            <Button
              onClick={applySessionFilter}
              className="bg-accent text-white flex items-center gap-2 hover:bg-accent-dark"
              disabled={sessionsLoading}
            >
              <FiSearch /> Aplicar filtros
            </Button>
            <Button
              onClick={resetSessionFilters}
              className="bg-gray-200 text-gray-700 flex items-center gap-2 hover:bg-gray-300"
              disabled={sessionsLoading}
            >
              <FiFilter /> Limpiar
            </Button>
            <Button
              onClick={loadSessions}
              className="bg-primary text-white flex items-center gap-2 hover:bg-primary-dark"
              disabled={sessionsLoading}
            >
              <FiRefreshCw /> Recargar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-gray-600">Usuario</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={sessionFilters.user_email}
              onChange={(e) =>
                setSessionFilters({ ...sessionFilters, user_email: e.target.value })
              }
            >
              <option value="">Todos</option>
              {sessionUsers.map((email) => (
                <option key={email} value={email}>
                  {email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600">Desde</label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={sessionFilters.startDate}
              onChange={(e) =>
                setSessionFilters({ ...sessionFilters, startDate: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Hasta</label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={sessionFilters.endDate}
              onChange={(e) =>
                setSessionFilters({ ...sessionFilters, endDate: e.target.value })
              }
            />
          </div>
        </div>

        <div className="overflow-x-auto border rounded-xl">
          {sessionsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <p className="text-center text-gray-500 py-6">
              No hay sesiones registradas con los filtros actuales.
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">IP</th>
                  <th className="px-4 py-3 text-left">Inicio</th>
                  <th className="px-4 py-3 text-left">Cierre</th>
                  <th className="px-4 py-3 text-left">Agente</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session) => (
                  <tr key={session.id} className="border-t hover:bg-gray-50 transition-all">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {session.user_email}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{session.ip || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(session.login_time).toLocaleString("es-EC")}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {session.logout_time
                        ? new Date(session.logout_time).toLocaleString("es-EC")
                        : "Activa"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 truncate max-w-xs">
                      {session.user_agent || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
