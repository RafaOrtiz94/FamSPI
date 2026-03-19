import React, { useEffect, useState } from "react";
import { FiClock, FiRefreshCw } from "react-icons/fi";
import toast from "react-hot-toast";

import { getAuditoria } from "../../../core/api/auditoriaApi";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import { formatDateTimeSafe } from "../../../shared/utils/dateUtils";
import {
  getAuditActionLabel,
  getAuditActorLabel,
  getAuditModuleLabel,
} from "../utils/auditDisplay";

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
      console.error("Error cargando auditoria:", err);
      toast.error("Error al obtener registros de auditoria");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <Card className="rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-800">
          <FiClock className="text-blue-600" /> Ultimos registros de auditoria
        </h2>
        <Button
          onClick={fetchLogs}
          className="flex items-center gap-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
        >
          <FiRefreshCw /> Actualizar
        </Button>
      </div>

      <div className="max-h-[420px] overflow-x-auto rounded-lg border">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">Sin registros recientes.</p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Modulo</th>
                <th className="px-4 py-3 font-medium">Accion</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => (
                <tr
                  key={log.id}
                  className="border-b border-neutral-100 transition-all hover:bg-neutral-50"
                >
                  <td className="px-4 py-2 text-neutral-500">{index + 1}</td>
                  <td className="px-4 py-2 font-medium text-neutral-800">
                    {getAuditActorLabel(log)}
                  </td>
                  <td className="px-4 py-2 text-neutral-700">{getAuditModuleLabel(log)}</td>
                  <td className="px-4 py-2 font-semibold text-blue-600">
                    {getAuditActionLabel(log)}
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{log.ip || "-"}</td>
                  <td className="px-4 py-2 text-neutral-500">
                    {formatDateTimeSafe(log.creado_en || log.created_at)}
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
