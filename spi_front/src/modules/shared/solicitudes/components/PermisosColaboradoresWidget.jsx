import React, { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiUser, FiClock, FiCheckCircle, FiAlertCircle, FiEye } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { getResumenColaboradores } from "../../../../core/api/permisosApi";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";

const PermisosColaboradoresWidget = () => {
  const { showToast } = useUI();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await getResumenColaboradores();
      setRows(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      console.error("Error cargando resumen de colaboradores:", error);
      showToast("No se pudo cargar el resumen de colaboradores", "warning");
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

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const nameA = (a.user_fullname || a.user_email || "").toLowerCase();
      const nameB = (b.user_fullname || b.user_email || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [rows]);

  if (loading && rows.length === 0) {
    return (
      <Card className="p-6 border border-gray-200">
        <p className="text-sm text-gray-500">Cargando resumen...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 border border-gray-200 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">Talento Humano</p>
          <h3 className="text-lg font-semibold text-gray-900">
            Resumen por colaborador
          </h3>
          <p className="text-sm text-gray-500">
            Estado de permisos y vacaciones con fechas detalladas.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4">
        {sortedRows.length === 0 ? (
          <p className="text-sm text-gray-500">No hay solicitudes registradas.</p>
        ) : (
          sortedRows.map((row) => (
            <div key={row.user_email} className="border border-gray-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                    <FiUser />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {row.user_fullname || row.user_email}
                    </p>
                    <p className="text-xs text-gray-500">{row.user_email}</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {row.permisos.total + row.vacaciones.items.length} solicitudes
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Permisos solicitados</p>
                  <p className="text-lg font-semibold text-slate-900">{row.permisos.total}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <p className="text-xs text-emerald-600">Aprobacion completa</p>
                  <p className="text-lg font-semibold text-emerald-800">{row.permisos.aprobacion_completa}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-600">Aprobacion parcial</p>
                  <p className="text-lg font-semibold text-amber-800">{row.permisos.aprobacion_parcial}</p>
                </div>
                <div className="p-3 bg-rose-50 rounded-lg">
                  <p className="text-xs text-rose-600">Pendientes</p>
                  <p className="text-lg font-semibold text-rose-800">{row.permisos.pendientes}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600">Dias asignados</p>
                  <p className="text-lg font-semibold text-blue-800">{row.vacaciones.dias_disponibles}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <p className="text-xs text-emerald-600">Dias restantes</p>
                  <p className="text-lg font-semibold text-emerald-800">{row.vacaciones.dias_restantes}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-600">Dias aprobados</p>
                  <p className="text-lg font-semibold text-amber-800">{row.vacaciones.dias_aprobados}</p>
                </div>
                <div className="p-3 bg-rose-50 rounded-lg">
                  <p className="text-xs text-rose-600">Dias pendientes</p>
                  <p className="text-lg font-semibold text-rose-800">{row.vacaciones.dias_pendientes}</p>
                </div>
              </div>

              {row.vacaciones?.missing_hire_date && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  <FiAlertCircle />
                  Falta fecha de ingreso en el perfil del colaborador para calcular vacaciones.
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <FiClock /> Permisos con fechas
                  </p>
                  {row.permisos.items.length ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {row.permisos.items.map((item) => (
                        <div key={`permiso-${item.id}`} className="border border-gray-100 rounded-lg p-2 text-xs text-gray-600">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-gray-800">
                              {item.tipo_permiso || "Permiso"}
                            </span>
                            <span className="text-xs">
                              {item.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <FiCalendar className="text-gray-400" />
                            <span>{item.fecha_inicio || "Sin fecha"} - {item.fecha_fin || "Sin fecha"}</span>
                          </div>
                          {Array.isArray(item.justificantes_urls) && item.justificantes_urls.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.justificantes_urls.map((url, idx) => (
                                <a
                                  key={`${item.id}-doc-${idx}`}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded text-[10px] font-medium text-blue-700 hover:bg-blue-50"
                                >
                                  <FiEye className="w-3 h-3" />
                                  Documento {idx + 1}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No registra permisos.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <FiCheckCircle /> Vacaciones con fechas
                  </p>
                  {row.vacaciones.items.length ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {row.vacaciones.items.map((item) => (
                        <div key={`vac-${item.id}`} className="border border-gray-100 rounded-lg p-2 text-xs text-gray-600">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-gray-800">
                              {item.duracion_dias} dia(s)
                            </span>
                            <span className="text-xs">
                              {item.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <FiCalendar className="text-gray-400" />
                            <span>{item.fecha_inicio || "Sin fecha"} - {item.fecha_fin || "Sin fecha"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No registra vacaciones.</p>
                  )}
                </div>
              </div>

              {(row.permisos.aprobacion_parcial > 0 || row.vacaciones.dias_pendientes > 0) && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  <FiAlertCircle />
                  Hay solicitudes pendientes de gestion.
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

export default PermisosColaboradoresWidget;
