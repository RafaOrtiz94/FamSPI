import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiAlertTriangle,
  FiCalendar,
  FiClock,
  FiExternalLink,
  FiMapPin,
  FiNavigation,
  FiUser,
} from "react-icons/fi";
import { GoogleMap, MarkerF, PolylineF, useJsApiLoader } from "@react-google-maps/api";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import ScheduleStatusBadge from "./ScheduleStatusBadge";
import { optimizeRoute as optimizeRouteApi } from "../../../../core/api/schedulesApi";

const DEFAULT_MAP_CENTER = { lat: -1.831239, lng: -78.183406 };
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";

const groupByDate = (visits = []) =>
  visits.reduce((acc, visit) => {
    const key = String(visit?.planned_date || "").slice(0, 10);
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(visit);
    return acc;
  }, {});

const toCoordinateNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDistance = (meters = 0) => {
  const safeMeters = Number(meters || 0);
  if (!Number.isFinite(safeMeters) || safeMeters <= 0) return "0 km";
  if (safeMeters >= 1000) return `${(safeMeters / 1000).toFixed(1)} km`;
  return `${Math.round(safeMeters)} m`;
};

const formatDuration = (seconds = 0) => {
  const safeSeconds = Number(seconds || 0);
  if (!Number.isFinite(safeSeconds) || safeSeconds <= 0) return "0 min";
  const minutes = Math.round(safeSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

const getCurrentDateLabel = (dateValue) => {
  try {
    return new Date(dateValue).toLocaleDateString("es-EC", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch (_error) {
    return String(dateValue || "");
  }
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 3:
      return "bg-red-50 text-red-800 border-red-200";
    case 2:
      return "bg-amber-50 text-amber-800 border-amber-200";
    case 1:
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
};

const getPriorityLabel = (priority) => {
  switch (priority) {
    case 3:
      return "Alta";
    case 2:
      return "Media";
    case 1:
    default:
      return "Baja";
  }
};

const resolveVisitLabel = (visit = {}, client = {}) =>
  visit.client_name ||
  client.commercial_name ||
  client.nombre ||
  client.name ||
  client.display_name ||
  client.email ||
  client.identificador ||
  `Cliente #${visit.client_request_id}`;

const resolveCoordinatesFromVisit = (visit = {}, client = {}) => {
  const latitude = toCoordinateNumber(
    visit.latitude ??
      visit.client_latitude ??
      visit.catalog_latitude ??
      visit.request_latitude ??
      client.latitude ??
      client.latitud ??
      client.lat ??
      client.client_latitude ??
      client.shipping_latitude
  );
  const longitude = toCoordinateNumber(
    visit.longitude ??
      visit.client_longitude ??
      visit.catalog_longitude ??
      visit.request_longitude ??
      client.longitude ??
      client.longitud ??
      client.lng ??
      client.client_longitude ??
      client.shipping_longitude
  );
  if (latitude === null || longitude === null) return null;
  return { lat: latitude, lng: longitude };
};

const ScheduleCalendarView = ({
  schedule,
  clients = [],
  onUpdateVisit,
  onRemoveVisit,
  editingLocked,
  onRequestEdit,
}) => {
  const optimizeDebounceRef = useRef(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [optimizedOrders, setOptimizedOrders] = useState({});
  const [routeSummaryByDate, setRouteSummaryByDate] = useState({});
  const [routeSegmentsByDate, setRouteSegmentsByDate] = useState({});
  const [routePointsByDate, setRoutePointsByDate] = useState({});

  const { isLoaded: mapsLoaded, loadError } = useJsApiLoader({
    id: "schedule-calendar-map",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const findClient = useCallback(
    (id) => clients.find((client) => String(client.id) === String(id)),
    [clients]
  );

  const grouped = useMemo(() => groupByDate(schedule?.visits || []), [schedule?.visits]);
  const sortedDateEntries = useMemo(
    () => Object.entries(grouped).sort(([a], [b]) => new Date(a) - new Date(b)),
    [grouped]
  );

  useEffect(() => {
    if (!sortedDateEntries.length) {
      setSelectedDate("");
      return;
    }
    if (!selectedDate || !grouped[selectedDate]) {
      setSelectedDate(sortedDateEntries[0][0]);
    }
  }, [grouped, selectedDate, sortedDateEntries]);

  useEffect(
    () => () => {
      if (optimizeDebounceRef.current) {
        clearTimeout(optimizeDebounceRef.current);
      }
    },
    []
  );

  const orderVisitsForDisplay = useCallback(
    (dateKey, visits = []) => {
      const optimizedOrder = optimizedOrders[dateKey] || [];
      if (!optimizedOrder.length) {
        return [...visits].sort((a, b) => (b.priority || 1) - (a.priority || 1));
      }
      const indexById = optimizedOrder.reduce((acc, id, index) => {
        acc[String(id)] = index;
        return acc;
      }, {});
      return [...visits].sort((a, b) => {
        const aIndex = Object.prototype.hasOwnProperty.call(indexById, String(a.id))
          ? indexById[String(a.id)]
          : Number.MAX_SAFE_INTEGER;
        const bIndex = Object.prototype.hasOwnProperty.call(indexById, String(b.id))
          ? indexById[String(b.id)]
          : Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) return aIndex - bIndex;
        return (b.priority || 1) - (a.priority || 1);
      });
    },
    [optimizedOrders]
  );

  const fallbackMarkers = useMemo(() => {
    if (!selectedDate) return [];
    const visits = grouped[selectedDate] || [];
    return visits
      .map((visit, index) => {
        const client = findClient(visit.client_request_id) || {};
        const coordinates = resolveCoordinatesFromVisit(visit, client);
        if (!coordinates) return null;
        return {
          visit_id: visit.id,
          route_order: index + 1,
          client_name: resolveVisitLabel(visit, client),
          ...coordinates,
        };
      })
      .filter(Boolean);
  }, [findClient, grouped, selectedDate]);

  const selectedRoutePoints = routePointsByDate[selectedDate] || [];
  const mapMarkers = selectedRoutePoints.length ? selectedRoutePoints : fallbackMarkers;
  const polylinePath = mapMarkers.map((point) => ({ lat: point.lat, lng: point.lng }));
  const mapCenter = polylinePath[0] || DEFAULT_MAP_CENTER;
  const mapZoom = polylinePath.length > 1 ? 9 : 6;
  const selectedRouteSummary = routeSummaryByDate[selectedDate] || null;
  const selectedRouteSegments = routeSegmentsByDate[selectedDate] || [];

  const polylineOptions = !window.google?.maps
    ? {
        strokeOpacity: 0.85,
        strokeWeight: 4,
      }
    : {
        geodesic: true,
        strokeOpacity: 0.85,
        strokeWeight: 4,
        icons: [
          {
            icon: {
              path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 3,
              strokeOpacity: 0.9,
            },
            offset: "100%",
            repeat: "120px",
          },
        ],
      };

  const runRouteOptimization = useCallback(
    async (dateKey) => {
      if (!schedule?.id || !dateKey) return;
      setRouteLoading(true);
      setRouteError("");
      try {
        const response = await optimizeRouteApi({ schedule_ids: [schedule.id] });
        const routeEntries = Array.isArray(response?.routes_by_date) ? response.routes_by_date : [];
        const matchedRoute = routeEntries.find(
          (entry) => String(entry?.planned_date || "") === String(dateKey || "")
        );

        const nextOrders = {};
        const nextSummaries = {};
        const nextSegments = {};
        const nextPoints = {};

        routeEntries.forEach((entry) => {
          const date = String(entry?.planned_date || "");
          if (!date) return;
          nextOrders[date] = Array.isArray(entry?.ordered_visit_ids) ? entry.ordered_visit_ids : [];
          nextSummaries[date] = {
            optimized: Boolean(entry?.optimized),
            reason: entry?.reason || "",
            estimated_distance_meters: Number(entry?.estimated_distance_meters || 0),
            estimated_distance_label:
              entry?.estimated_distance_label || formatDistance(entry?.estimated_distance_meters || 0),
            estimated_travel_time_seconds: Number(entry?.estimated_travel_time_seconds || 0),
            estimated_travel_time_label:
              entry?.estimated_travel_time_label || formatDuration(entry?.estimated_travel_time_seconds || 0),
            google_maps_url: entry?.google_maps_url || null,
            waze_url: entry?.waze_url || null,
            excluded_visits: Array.isArray(entry?.excluded_visits) ? entry.excluded_visits : [],
            ordered_visits: Array.isArray(entry?.ordered_visits) ? entry.ordered_visits : [],
          };
          nextSegments[date] = Array.isArray(entry?.segments) ? entry.segments : [];
          nextPoints[date] = (entry?.ordered_visits || [])
            .map((visit, index) => {
              const lat = toCoordinateNumber(visit?.latitude);
              const lng = toCoordinateNumber(visit?.longitude);
              if (lat === null || lng === null) return null;
              return {
                visit_id: visit?.visit_id,
                route_order: Number(visit?.route_order || index + 1),
                client_name: visit?.client_name || `Cliente #${visit?.client_request_id || "N/D"}`,
                lat,
                lng,
              };
            })
            .filter(Boolean);
        });

        setOptimizedOrders((prev) => ({ ...prev, ...nextOrders }));
        setRouteSummaryByDate((prev) => ({ ...prev, ...nextSummaries }));
        setRouteSegmentsByDate((prev) => ({ ...prev, ...nextSegments }));
        setRoutePointsByDate((prev) => ({ ...prev, ...nextPoints }));

        if (!matchedRoute) {
          setRouteError("No se encontro una ruta para la fecha seleccionada.");
          return;
        }
        if (!matchedRoute.optimized && matchedRoute.reason) {
          setRouteError(matchedRoute.reason);
        }
      } catch (error) {
        const message =
          error?.response?.data?.message || error?.message || "No se pudo optimizar la ruta seleccionada.";
        setRouteError(message);
      } finally {
        setRouteLoading(false);
      }
    },
    [schedule?.id]
  );

  const requestOptimizedRoute = useCallback(
    (dateKey) => {
      if (!dateKey) return;
      if (optimizeDebounceRef.current) {
        clearTimeout(optimizeDebounceRef.current);
      }
      optimizeDebounceRef.current = setTimeout(() => {
        runRouteOptimization(dateKey);
      }, 350);
    },
    [runRouteOptimization]
  );

  const handleChangePriority = (visit, value) => {
    if (editingLocked && schedule.status === "approved") {
      onRequestEdit?.(schedule);
      return;
    }
    const priority = Number(value) || 1;
    onUpdateVisit?.(schedule.id, visit.id, { priority });
  };

  const handleChangeClient = (visit, value) => {
    if (editingLocked && schedule.status === "approved") {
      onRequestEdit?.(schedule);
      return;
    }
    const selected = findClient(value);
    const city = selected?.shipping_city || selected?.shipping_province || selected?.shipping_address || visit.city;
    onUpdateVisit?.(schedule.id, visit.id, { client_request_id: Number(value), city });
  };

  if (!schedule) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <FiCalendar className="text-slate-600" size={20} />
            Calendario {schedule.month}/{schedule.year}
          </h3>
          <p className="text-sm text-slate-600">Ruteo inteligente diario y orden de visitas optimizado</p>
        </div>
        <ScheduleStatusBadge status={schedule.status} />
      </div>

      <Card className="overflow-hidden border-0 shadow-lg shadow-slate-100/50 rounded-xl bg-white">
        <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-300">Ruta diaria</p>
              <p className="text-sm font-semibold">{selectedDate ? getCurrentDateLabel(selectedDate) : "Selecciona un dia"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              >
                {sortedDateEntries.length === 0 ? <option value="">Sin visitas</option> : null}
                {sortedDateEntries.map(([date]) => (
                  <option key={date} value={date}>
                    {new Date(date).toLocaleDateString("es-EC", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                    })}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="primary"
                icon={FiNavigation}
                onClick={() => requestOptimizedRoute(selectedDate)}
                disabled={!selectedDate || routeLoading}
              >
                Optimizar
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {!GOOGLE_MAPS_API_KEY ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Configura REACT_APP_GOOGLE_MAPS_API_KEY para visualizar el mapa.
            </div>
          ) : null}
          {loadError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              No se pudo cargar Google Maps.
            </div>
          ) : null}
          {routeError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{routeError}</div>
          ) : null}

          {selectedRouteSummary ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-900">
                  {selectedRouteSummary.ordered_visits?.length || mapMarkers.length || 0}
                </p>
                <p>Paradas del dia</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-900">
                  {selectedRouteSummary.estimated_distance_label || formatDistance(0)}
                </p>
                <p>Distancia estimada</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-900">
                  {selectedRouteSummary.estimated_travel_time_label || formatDuration(0)}
                </p>
                <p>Tiempo estimado</p>
              </div>
            </div>
          ) : null}

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {!mapsLoaded ? (
              <div className="flex h-[340px] items-center justify-center text-sm text-slate-600">
                Cargando mapa...
              </div>
            ) : (
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "340px" }}
                center={mapCenter}
                zoom={mapZoom}
                options={{
                  mapTypeControl: false,
                  streetViewControl: false,
                  fullscreenControl: false,
                }}
              >
                {mapMarkers.map((point) => (
                  <MarkerF
                    key={`${point.visit_id}-${point.route_order}`}
                    position={{ lat: point.lat, lng: point.lng }}
                    title={`${point.route_order}. ${point.client_name}`}
                    label={{
                      text: String(point.route_order || ""),
                    }}
                  />
                ))}
                {polylinePath.length >= 2 ? <PolylineF path={polylinePath} options={polylineOptions} /> : null}
              </GoogleMap>
            )}

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.03 }}
              onClick={() => requestOptimizedRoute(selectedDate)}
              disabled={!selectedDate || routeLoading}
              className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-slate-700/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiNavigation className={routeLoading ? "animate-spin" : ""} size={14} />
              {routeLoading ? "Optimizando..." : "Optimizar Ruta"}
            </motion.button>
          </div>

          {selectedRouteSummary?.google_maps_url || selectedRouteSummary?.waze_url ? (
            <div className="flex flex-wrap gap-2">
              {selectedRouteSummary?.google_maps_url ? (
                <a
                  href={selectedRouteSummary.google_maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <FiExternalLink size={12} />
                  Abrir en Google Maps
                </a>
              ) : null}
              {selectedRouteSummary?.waze_url ? (
                <a
                  href={selectedRouteSummary.waze_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <FiExternalLink size={12} />
                  Abrir en Waze
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      {selectedRouteSegments.length ? (
        <Card className="border border-slate-200 shadow-sm">
          <div className="p-4">
            <h4 className="text-sm font-semibold text-slate-900">Tramos estimados</h4>
            <div className="mt-3 space-y-2">
              {selectedRouteSegments.map((segment) => (
                <div
                  key={`${segment.segment_order}-${segment.from_visit_id}-${segment.to_visit_id}`}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 md:grid-cols-4"
                >
                  <span className="font-semibold">
                    #{segment.segment_order} {segment.from_client_name || "Origen"} -> {segment.to_client_name || "Destino"}
                  </span>
                  <span>{segment.estimated_distance_label || formatDistance(segment.estimated_distance_meters)}</span>
                  <span>{segment.estimated_travel_time_label || formatDuration(segment.estimated_travel_time_seconds)}</span>
                  <span className="text-slate-500">
                    {segment.estimated_distance_meters || 0} m / {segment.estimated_travel_time_seconds || 0} s
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      {sortedDateEntries.length === 0 ? (
        <div className="py-12 text-center">
          <FiCalendar className="mx-auto mb-4 text-slate-300" size={48} />
          <h4 className="mb-2 text-lg font-semibold text-slate-900">Sin visitas planificadas</h4>
          <p className="text-slate-600">Agrega visitas usando el formulario lateral</p>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sortedDateEntries.map(([date, visits]) => (
          <motion.div
            key={date}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-xl border-0 bg-white shadow-lg shadow-slate-100/60"
          >
            <div className="bg-slate-600 px-4 py-3">
              <div className="flex items-center justify-between text-white">
                <div>
                  <p className="text-sm font-semibold">
                    {new Date(date).toLocaleDateString("es-EC", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  <p className="text-xs opacity-90">
                    {new Set(visits.map((visit) => visit.city)).size} ciudades - {visits.length} visitas
                  </p>
                </div>
                <FiCalendar size={16} className="opacity-75" />
              </div>
            </div>

            <div className="space-y-3 p-4">
              <AnimatePresence initial={false}>
                {orderVisitsForDisplay(date, visits).map((visit) => {
                  const client = findClient(visit.client_request_id) || {};
                  const label = resolveVisitLabel(visit, client);
                  const routeOrder = optimizedOrders[date]?.findIndex(
                    (id) => String(id) === String(visit.id)
                  );
                  const routeIndex = routeOrder >= 0 ? routeOrder + 1 : null;

                  return (
                    <motion.div
                      key={visit.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`rounded-lg border p-4 shadow-sm transition-all duration-200 hover:shadow-md ${getPriorityColor(
                        visit.priority || 1
                      )}`}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <FiUser className="text-slate-500" size={14} />
                            <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-600">
                            <div className="flex items-center gap-1">
                              <FiMapPin size={12} />
                              <span>{visit.city || visit.client_city || visit.client_province || "Sin ciudad"}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <FiClock size={12} />
                              <span>{visit.duration_hours || 2}h</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`rounded-full border px-2 py-1 text-xs font-medium ${getPriorityColor(visit.priority || 1)}`}>
                            {getPriorityLabel(visit.priority || 1)}
                          </span>
                          {routeIndex ? (
                            <span className="rounded-full bg-cyan-100 px-2 py-1 text-[11px] font-semibold text-cyan-700">
                              Ruta #{routeIndex}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">#{visit.id}</span>
                          )}
                        </div>
                      </div>

                      {editingLocked && schedule.status === "approved" ? (
                        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                          <FiAlertTriangle className="text-amber-500" size={14} />
                          <span className="text-xs text-amber-700">Edicion bloqueada - solicita desbloqueo</span>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-700">Cliente</label>
                          <select
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                            value={visit.client_request_id || ""}
                            onChange={(event) => handleChangeClient(visit, event.target.value)}
                            disabled={editingLocked && schedule.status === "approved"}
                          >
                            <option value="">Selecciona cliente</option>
                            {clients.map((clientOption) => {
                              const clientLabel =
                                clientOption.commercial_name ||
                                clientOption.nombre ||
                                clientOption.name ||
                                clientOption.display_name ||
                                clientOption.email ||
                                clientOption.identificador ||
                                `Cliente #${clientOption.id}`;
                              return (
                                <option key={clientOption.id} value={clientOption.id}>
                                  {clientLabel}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-700">Prioridad</label>
                          <select
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                            value={visit.priority || 1}
                            onChange={(event) => handleChangePriority(visit, event.target.value)}
                            disabled={editingLocked && schedule.status === "approved"}
                          >
                            <option value={1}>Baja</option>
                            <option value={2}>Media</option>
                            <option value={3}>Alta</option>
                          </select>
                        </div>
                      </div>

                      {visit.notes ? (
                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <p className="text-xs text-slate-600">{visit.notes}</p>
                        </div>
                      ) : null}

                      {onRemoveVisit && !(editingLocked && schedule.status === "approved") ? (
                        <div className="mt-3">
                          <Button size="sm" variant="danger" onClick={() => onRemoveVisit(schedule.id, visit.id)}>
                            Eliminar visita
                          </Button>
                        </div>
                      ) : null}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ScheduleCalendarView;
