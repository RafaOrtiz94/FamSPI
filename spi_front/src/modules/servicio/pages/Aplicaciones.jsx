import React, { useEffect, useState, useCallback } from "react";
import { FiAlertTriangle, FiExternalLink, FiMapPin, FiRefreshCw } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { getAvailableTechnicalApplications } from "../../../core/api/technicalApplicationsApi";

const AplicacionesTecnicas = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getAvailableTechnicalApplications();
      setApplications(Array.isArray(result) ? result : []);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        setError("Sesión expirada o sin permisos. Inicia sesión nuevamente para ver las aplicaciones disponibles.");
      } else {
        setError("No se pudieron cargar las aplicaciones técnicas disponibles.");
      }
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-gray-500">Documentos y rutas técnicas disponibles</p>
          <h1 className="text-2xl font-semibold text-gray-900">Aplicaciones técnicas</h1>
        </div>
        <Button variant="secondary" icon={FiRefreshCw} onClick={loadApplications} disabled={loading}>
          Recargar
        </Button>
      </div>

      {error && (
        <Card className="p-4 border border-amber-200 bg-amber-50 text-amber-800 flex items-start gap-3">
          <FiAlertTriangle className="mt-1" />
          <div>
            <p className="font-medium">Aviso</p>
            <p className="text-sm text-amber-800/80">{error}</p>
          </div>
        </Card>
      )}

      <Card className="p-5">
        {loading ? (
          <p className="text-sm text-gray-500">Cargando aplicaciones disponibles...</p>
        ) : applications.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {applications.map((app) => (
              <div key={app.id || app._id || app.name} className="p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-500">Cliente</p>
                    <h3 className="text-lg font-semibold text-gray-900">{app.client || app.cliente || "Cliente"}</h3>
                  </div>
                  {app.status && (
                    <span className="px-2 py-[2px] text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                      {app.status}
                    </span>
                  )}
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                  {app.location && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <FiMapPin className="text-blue-500" />
                      <span className="truncate">{app.location}</span>
                    </div>
                  )}
                  {app.assignee && <p>Asignado a: {app.assignee}</p>}
                  {app.type && <p>Tipo: {app.type}</p>}
                </div>

                {app.url && (
                  <a
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                    href={app.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FiExternalLink /> Abrir documento
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No hay aplicaciones disponibles para mostrar.</p>
        )}
      </Card>
    </div>
  );
};

export default AplicacionesTecnicas;

