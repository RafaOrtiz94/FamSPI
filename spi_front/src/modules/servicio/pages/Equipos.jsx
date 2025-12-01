import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiCpu } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import api from "../../../core/api";

const estadoChip = (estado) => {
  const value = (estado || "").toString().toLowerCase();
  if (["operativo", "ok"].includes(value)) return "bg-green-100 text-green-700";
  if (["en_mantenimiento", "maintenance"].includes(value)) return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-700";
};

const EquiposPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/servicio/equipos");
      if (Array.isArray(data?.rows)) return setRows(data.rows);
      if (Array.isArray(data?.result?.rows)) return setRows(data.result.rows);
      if (Array.isArray(data?.data)) return setRows(data.data);
      if (Array.isArray(data)) return setRows(data);
      setRows([]);
    } catch (err) {
      console.warn("No se pudieron cargar equipos", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const operational = useMemo(() => rows.filter((r) => (r.estado || "").toLowerCase() === "operativo"), [rows]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-gray-500">Inventario técnico</p>
          <h1 className="text-2xl font-semibold text-gray-900">Equipos de servicio</h1>
        </div>
        <Button variant="secondary" icon={FiRefreshCw} onClick={load} disabled={loading}>
          Actualizar
        </Button>
      </div>

      <Card className="p-5">
        {loading ? (
          <p className="text-sm text-gray-500">Cargando equipos...</p>
        ) : rows.length ? (
          <div className="space-y-2 mb-4">
            <p className="text-sm text-gray-600">
              {operational.length} operativos de {rows.length} en total.
            </p>
          </div>
        ) : null}

        {rows.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((eq) => (
              <div key={eq.id || eq._id} className="border rounded-lg p-4 space-y-2 bg-white">
                <div className="flex items-center gap-2 text-blue-600 font-semibold">
                  <FiCpu />
                  <span>{eq.nombre || eq.serial || "Equipo"}</span>
                </div>
                <p className="text-sm text-gray-600">Tipo: {eq.tipo || eq.category || "—"}</p>
                <p className="text-sm text-gray-600">Ubicación: {eq.ubicacion || eq.location || "—"}</p>
                <p className="text-sm text-gray-600">Responsable: {eq.responsable || "—"}</p>
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${estadoChip(eq.estado)}`}>
                  {eq.estado || "Sin estado"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No hay equipos registrados.</p>
        )}
      </Card>
    </div>
  );
};

export default EquiposPage;
