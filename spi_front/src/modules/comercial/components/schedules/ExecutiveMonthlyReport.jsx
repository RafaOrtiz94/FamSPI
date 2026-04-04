import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CircleF, GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import {
  FiPrinter,
  FiUsers,
  FiMapPin,
  FiStar,
  FiX,
  FiAlertTriangle,
} from "react-icons/fi";
import Button from "../../../../core/ui/components/Button";
import { fetchScheduleDetail, fetchTeamSchedules } from "../../../../core/api/schedulesApi";
import { fetchClients } from "../../../../core/api/clientsApi";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
const DEFAULT_MAP_CENTER = { lat: -1.831239, lng: -78.183406 };

const toCoordinateNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveCoordinates = (visit = {}, client = {}) => {
  const lat = toCoordinateNumber(
    visit.latitude ??
      visit.client_latitude ??
      visit.catalog_latitude ??
      visit.request_latitude ??
      client.latitude ??
      client.latitud ??
      client.lat ??
      client.client_latitude ??
      client.shipping_latitude,
  );
  const lng = toCoordinateNumber(
    visit.longitude ??
      visit.client_longitude ??
      visit.catalog_longitude ??
      visit.request_longitude ??
      client.longitude ??
      client.longitud ??
      client.lng ??
      client.client_longitude ??
      client.shipping_longitude,
  );

  if (lat === null || lng === null) return null;
  return { lat, lng };
};

const ExecutiveMonthlyReport = ({ open, onClose, month, year }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [topClients, setTopClients] = useState([]);
  const [heatPoints, setHeatPoints] = useState([]);

  const { isLoaded: mapsLoaded, loadError } = useJsApiLoader({
    id: "executive-report-map",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const loadReport = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError("");
    try {
      const [teamSchedules, clientsPayload] = await Promise.all([
        fetchTeamSchedules(),
        fetchClients({ limit: 1500 }).catch(() => ({ clients: [] })),
      ]);

      const clientList = Array.isArray(clientsPayload?.clients) ? clientsPayload.clients : [];
      const clientsById = clientList.reduce((acc, client) => {
        acc[String(client.id)] = client;
        return acc;
      }, {});

      const schedulesForMonth = (teamSchedules || []).filter(
        (item) => Number(item.month) === Number(month) && Number(item.year) === Number(year),
      );

      const approvedSchedules = schedulesForMonth.filter((item) => item.status === "approved");

      const details = (
        await Promise.all(
          approvedSchedules.map((item) =>
            fetchScheduleDetail(item.id)
              .then((data) => data)
              .catch(() => null),
          ),
        )
      ).filter(Boolean);

      const summaryByAdvisor = schedulesForMonth.reduce((acc, schedule) => {
        const key = schedule.user_email || "sin_correo";
        if (!acc[key]) {
          acc[key] = {
            asesor: schedule.user_name || schedule.user_email || "Asesor",
            planificado: 0,
            realizado: 0,
          };
        }
        acc[key].planificado += Number(schedule.visits_count || 0);
        acc[key].realizado += Number(schedule.visits_visited || 0);
        return acc;
      }, {});

      const complianceRows = Object.values(summaryByAdvisor)
        .map((row) => ({
          ...row,
          eficacia: row.planificado > 0 ? Math.round((row.realizado / row.planificado) * 100) : 0,
        }))
        .sort((a, b) => b.eficacia - a.eficacia);

      const clientCounter = new Map();
      const pointsCounter = new Map();
      details.forEach((schedule) => {
        (schedule.visits || []).forEach((visit) => {
          const clientName =
            visit.client_name ||
            clientsById[String(visit.client_request_id)]?.commercial_name ||
            clientsById[String(visit.client_request_id)]?.nombre ||
            `Cliente #${visit.client_request_id}`;
          clientCounter.set(clientName, (clientCounter.get(clientName) || 0) + 1);

          const coords = resolveCoordinates(visit, clientsById[String(visit.client_request_id)] || {});
          if (!coords) return;
          const mapKey = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
          if (!pointsCounter.has(mapKey)) {
            pointsCounter.set(mapKey, { lat: coords.lat, lng: coords.lng, count: 0 });
          }
          pointsCounter.get(mapKey).count += 1;
        });
      });

      const topClientRows = [...clientCounter.entries()]
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      setRows(complianceRows);
      setTopClients(topClientRows);
      setHeatPoints([...pointsCounter.values()]);
    } catch (loadError) {
      setError(loadError?.message || "No se pudo generar el reporte ejecutivo");
    } finally {
      setLoading(false);
    }
  }, [open, month, year]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const mapCenter = useMemo(() => {
    if (!heatPoints.length) return DEFAULT_MAP_CENTER;
    return { lat: heatPoints[0].lat, lng: heatPoints[0].lng };
  }, [heatPoints]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/70 p-4 md:p-6 report-modal-root" role="dialog" aria-modal="true">
      <style>
        {`@media print {
          .report-no-print { display: none !important; }
          .report-modal-root {
            position: static !important;
            inset: auto !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .report-card {
            box-shadow: none !important;
            border: 1px solid #e2e8f0 !important;
            break-inside: avoid;
          }
          .report-print-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }`}
      </style>

      <div className="mx-auto flex h-full max-w-[1700px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="report-no-print flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Reporte ejecutivo</p>
            <h3 className="text-xl font-bold text-slate-900">
              Informe mensual {String(month).padStart(2, "0")}/{year}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={FiPrinter} onClick={() => window.print()}>
              Imprimir / Guardar PDF
            </Button>
            <Button variant="ghost" icon={FiX} onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">Generando reporte...</div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 report-print-grid">
              <section className="report-card rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FiUsers className="text-sky-600" />
                  <h4 className="font-semibold text-slate-900">Tabla de cumplimiento</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3">Asesor</th>
                        <th className="py-2 pr-3">Planificado</th>
                        <th className="py-2 pr-3">Realizado</th>
                        <th className="py-2">% Eficacia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length ? (
                        rows.map((row) => (
                          <tr key={row.asesor} className="border-t border-slate-100 text-slate-700">
                            <td className="py-2 pr-3 font-medium text-slate-900">{row.asesor}</td>
                            <td className="py-2 pr-3">{row.planificado}</td>
                            <td className="py-2 pr-3">{row.realizado}</td>
                            <td className="py-2">
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                {row.eficacia}%
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400">
                            Sin datos para el mes seleccionado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="report-card rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FiMapPin className="text-rose-600" />
                  <h4 className="font-semibold text-slate-900">Heatmap de visitas aprobadas</h4>
                </div>
                {!GOOGLE_MAPS_API_KEY ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    Configura REACT_APP_GOOGLE_MAPS_API_KEY para visualizar el mapa.
                  </div>
                ) : loadError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    No se pudo cargar Google Maps.
                  </div>
                ) : !mapsLoaded ? (
                  <div className="flex h-[520px] items-center justify-center text-sm text-slate-500">Cargando mapa...</div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <GoogleMap
                      mapContainerStyle={{ width: "100%", height: "520px" }}
                      center={mapCenter}
                      zoom={heatPoints.length > 0 ? 7 : 6}
                      options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false }}
                    >
                      {heatPoints.map((point) => (
                        <CircleF
                          key={`${point.lat}-${point.lng}`}
                          center={{ lat: point.lat, lng: point.lng }}
                          radius={Math.min(45000, 5000 + point.count * 2500)}
                          options={{
                            fillColor: "#ef4444",
                            fillOpacity: Math.min(0.65, 0.16 + point.count * 0.08),
                            strokeColor: "#b91c1c",
                            strokeOpacity: 0.6,
                            strokeWeight: 1,
                          }}
                        />
                      ))}
                    </GoogleMap>
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  Los circulos representan concentracion de visitas aprobadas del equipo.
                </p>
              </section>

              <section className="report-card rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FiStar className="text-amber-600" />
                  <h4 className="font-semibold text-slate-900">Top 10 clientes</h4>
                </div>
                <div className="space-y-2">
                  {topClients.length ? (
                    topClients.map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">Rank #{index + 1}</p>
                        </div>
                        <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                          {item.total}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">No hay visitas aprobadas para calcular ranking.</p>
                  )}
                </div>
                {topClients.length === 0 ? (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <FiAlertTriangle size={14} />
                    Aun no existen datos suficientes en el periodo seleccionado.
                  </div>
                ) : null}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutiveMonthlyReport;

