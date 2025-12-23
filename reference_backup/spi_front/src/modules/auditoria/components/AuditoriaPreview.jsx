// src/modules/auditoria/components/AuditoriaPreview.jsx
import React, { useEffect, useState } from "react";
import { FiEye, FiClock, FiRefreshCw } from "react-icons/fi";
import toast from "react-hot-toast";
import { getAuditoria } from "../../../core/api/auditoriaApi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";

export default function AuditoriaPreview({ limit = 100 }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await getAuditoria({ page: 1, limit });
      if (res.ok) setLogs(res.results || []);
      else setLogs(res.data || res.audits || []);
    } catch (err) {
      console.error("❌ Error cargando auditoría:", err);
      toast.error("Error al obtener registros de auditoría");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <Card className="p-6 bg-white rounded-2xl border border-neutral-100 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-neutral-800">
          <FiClock className="text-blue-600" /> Últimos Registros de Auditoría
        </h2>
        <Button
          onClick={fetchLogs}
          className="bg-blue-600 text-white flex items-center gap-2 hover:bg-blue-700 rounded-xl"
        >
          <FiRefreshCw /> Actualizar
        </Button>
      </div>

      <div className="overflow-x-auto max-h-[420px] border rounded-lg">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : logs.length === 0 ? (
          <p className="text-neutral-500 text-sm p-4">Sin registros recientes.</p>
        ) : (
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 sticky top-0">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Módulo</th>
                <th className="px-4 py-3 font-medium">Acción</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr
                  key={log.id}
                  className="border-b border-neutral-100 hover:bg-neutral-50 transition-all"
                >
                  <td className="px-4 py-2 text-neutral-500">{i + 1}</td>
                  <td className="px-4 py-2 font-medium text-neutral-800">
                    {log.usuario_email || log.email || "—"}
                  </td>
                  <td className="px-4 py-2 text-neutral-700">{log.modulo || log.module}</td>
                  <td className="px-4 py-2 text-blue-600 font-semibold">
                    {log.accion || log.action}
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{log.ip || "—"}</td>
                  <td className="px-4 py-2 text-neutral-500">
                    {new Date(log.creado_en || log.created_at).toLocaleString(
                      "es-EC"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
