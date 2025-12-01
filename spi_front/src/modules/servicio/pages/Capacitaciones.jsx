import React, { useCallback, useEffect, useState } from "react";
import { FiRefreshCw, FiBookOpen } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import api from "../../../core/api";

const CapacitacionesPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/servicio/capacitaciones");
      if (Array.isArray(data?.rows)) return setRows(data.rows);
      if (Array.isArray(data?.result?.rows)) return setRows(data.result.rows);
      if (Array.isArray(data?.data)) return setRows(data.data);
      if (Array.isArray(data)) return setRows(data);
      setRows([]);
    } catch (err) {
      console.warn("No se pudieron cargar capacitaciones", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-gray-500">Plan de formación</p>
          <h1 className="text-2xl font-semibold text-gray-900">Capacitaciones</h1>
        </div>
        <Button variant="secondary" icon={FiRefreshCw} onClick={load} disabled={loading}>
          Actualizar
        </Button>
      </div>

      <Card className="p-5">
        {loading ? (
          <p className="text-sm text-gray-500">Cargando capacitaciones...</p>
        ) : rows.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((cap) => (
              <div key={cap.id || cap._id} className="border rounded-lg p-4 space-y-2 bg-white">
                <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">{cap.area || "Equipo"}</p>
                <h3 className="text-lg font-semibold text-gray-900">{cap.tema || cap.title}</h3>
                <p className="text-sm text-gray-600">Responsable: {cap.responsable || cap.owner || "—"}</p>
                <p className="text-sm text-gray-600">Fecha: {cap.fecha || cap.date || "Por definir"}</p>
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full">
                  <FiBookOpen /> {cap.modalidad || cap.mode || "Presencial"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No hay capacitaciones programadas.</p>
        )}
      </Card>
    </div>
  );
};

export default CapacitacionesPage;
