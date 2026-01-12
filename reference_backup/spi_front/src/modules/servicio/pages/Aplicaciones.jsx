import React, { useEffect, useState, useCallback } from "react";
import { FiAlertTriangle, FiExternalLink, FiMapPin, FiRefreshCw, FiShield, FiCalendar, FiX } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { getAvailableTechnicalApplications } from "../../../core/api/technicalApplicationsApi";
import DesinfeccionStepper from "../components/DesinfeccionStepper";
import EntrenamientoStepper from "../components/EntrenamientoStepper";
import AsistenciaStepper from "../components/AsistenciaStepper";
import VerificacionStepper from "../components/VerificacionStepper";

const AplicacionesTecnicas = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDesinfeccionModal, setShowDesinfeccionModal] = useState(false);
  const [showEntrenamientoModal, setShowEntrenamientoModal] = useState(false);
  const [showAsistenciaModal, setShowAsistenciaModal] = useState(false);
  const [showVerificacionModal, setShowVerificacionModal] = useState(false);

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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Desinfección Card - Always shown */}
            <div
              className="p-4 rounded-xl border border-purple-200 bg-purple-50 shadow-sm space-y-3 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setShowDesinfeccionModal(true)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-purple-600">Aplicación Interna</p>
                  <h3 className="text-lg font-semibold text-gray-900">Desinfección de Instrumentos</h3>
                </div>
                <span className="px-2 py-[2px] text-xs rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                  F.ST-02
                </span>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <p>Registro de desinfección según V04</p>
                <p>Formulario digital con firma y evidencias</p>
              </div>

              <div className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700">
                <FiShield /> Abrir formulario
              </div>
            </div>

            {/* Planificación del Entrenamiento Card - Always shown */}
            <div
              className="p-4 rounded-xl border border-blue-200 bg-blue-50 shadow-sm space-y-3 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setShowEntrenamientoModal(true)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-blue-600">Aplicación Interna</p>
                  <h3 className="text-lg font-semibold text-gray-900">Planificación del Entrenamiento</h3>
                </div>
                <span className="px-2 py-[2px] text-xs rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  F.ST-04
                </span>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <p>Coordinación de fechas de entrenamiento</p>
                <p>Planificación con firma de compromiso</p>
              </div>

              <div className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">
                <FiCalendar /> Abrir formulario
              </div>
            </div>

            {/* Lista de Asistencia Card - Always shown */}
            <div
              className="p-4 rounded-xl border border-green-200 bg-green-50 shadow-sm space-y-3 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setShowAsistenciaModal(true)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-green-600">Aplicación Interna</p>
                  <h3 className="text-lg font-semibold text-gray-900">Lista de Asistencia</h3>
                </div>
                <span className="px-2 py-[2px] text-xs rounded-full bg-green-100 text-green-700 border border-green-200">
                  F.ST-05
                </span>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <p>Control de asistencia a entrenamientos</p>
                <p>Registro de participantes con firma digital</p>
              </div>

              <div className="inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700">
                <FiCalendar /> Abrir formulario
              </div>
            </div>

            {/* Verificación de Equipos Nuevos Card - Always shown */}
            <div
              className="p-4 rounded-xl border border-orange-200 bg-orange-50 shadow-sm space-y-3 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setShowVerificacionModal(true)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-orange-600">Aplicación Interna</p>
                  <h3 className="text-lg font-semibold text-gray-900">Verificación de Equipos</h3>
                </div>
                <span className="px-2 py-[2px] text-xs rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                  F.ST-09
                </span>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <p>Verificación técnica de equipos nuevos</p>
                <p>Resultados, análisis y evidencia fotográfica</p>
              </div>

              <div className="inline-flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700">
                <FiShield /> Abrir formulario
              </div>
            </div>

            {/* External Applications */}
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
        )}
      </Card>

      {/* Desinfección Modal */}
      {showDesinfeccionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Desinfección de Instrumentos y Partes</h2>
              <button
                onClick={() => setShowDesinfeccionModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <DesinfeccionStepper />
            </div>
          </div>
        </div>
      )}

      {/* Entrenamiento Modal */}
      {showEntrenamientoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Planificación del Entrenamiento</h2>
              <button
                onClick={() => setShowEntrenamientoModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <EntrenamientoStepper />
            </div>
          </div>
        </div>
      )}

      {/* Asistencia Modal */}
      {showAsistenciaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Lista de Asistencia de Entrenamiento</h2>
              <button
                onClick={() => setShowAsistenciaModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <AsistenciaStepper />
            </div>
          </div>
        </div>
      )}

      {/* Verificación Modal */}
      {showVerificacionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Verificación de Equipos Nuevos</h2>
              <button
                onClick={() => setShowVerificacionModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <VerificacionStepper />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AplicacionesTecnicas;
