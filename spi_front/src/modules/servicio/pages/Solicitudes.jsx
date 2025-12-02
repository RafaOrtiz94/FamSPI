import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiFileText } from "react-icons/fi";
import { getRequests } from "../../../core/api/requestsApi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";

const normalize = (value) => (value || "").toString().toLowerCase();

const SolicitudesTecnicas = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRequests({ pageSize: 50 });
      if (Array.isArray(data?.rows)) return setRequests(data.rows);
      if (Array.isArray(data?.result?.rows)) return setRequests(data.result.rows);
      if (Array.isArray(data?.data?.rows)) return setRequests(data.data.rows);
      if (Array.isArray(data)) return setRequests(data);
      setRequests([]);
    } catch (err) {
      console.warn("No se pudieron cargar solicitudes", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openRequests = useMemo(
    () => requests.filter((r) => !["cerrado", "cancelado", "finalizado"].includes(normalize(r.status))),
    [requests]
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-gray-500">Gestión de solicitudes</p>
          <h1 className="text-2xl font-semibold text-gray-900">Solicitudes técnicas</h1>
        </div>
        <Button variant="secondary" icon={FiRefreshCw} onClick={load} disabled={loading}>
          Actualizar
        </Button>
      </div>

      <Card className="p-5">
        {loading ? (
          <p className="text-sm text-gray-500">Cargando solicitudes...</p>
        ) : requests.length ? (
          <div className="space-y-3">
            {openRequests.length ? (
              <p className="text-sm text-gray-600">{openRequests.length} abiertas actualmente</p>
            ) : (
              <p className="text-sm text-gray-600">Todas las solicitudes están al día.</p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Responsable</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id || r._id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{r.nombre_cliente || r.client || "Cliente"}</td>
                      <td className="px-4 py-3">{r.tipo || r.type}</td>
                      <td className="px-4 py-3 capitalize">{r.status || "pendiente"}</td>
                      <td className="px-4 py-3">{r.responsable || r.assignee || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No hay solicitudes registradas.</p>
        )}
      </Card>

      <Card className="p-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Crear o revisar solicitudes</h3>
          <p className="text-sm text-gray-600">
            Ingresa al flujo completo para generar nuevas solicitudes o aprobar las existentes.
          </p>
        </div>
        <a
          href="/requests"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          <FiFileText /> Ir a solicitudes
        </a>
      </Card>
    </div>
  );
};

export default SolicitudesTecnicas;
