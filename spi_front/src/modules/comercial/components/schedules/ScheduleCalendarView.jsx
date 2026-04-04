import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Popover } from "@headlessui/react";
import {
  FiAlertTriangle,
  FiCalendar,
  FiClock,
  FiMapPin,
  FiNavigation,
  FiTrash2,
  FiUser,
} from "react-icons/fi";
import Button from "../../../../core/ui/components/Button";
import Card from "../../../../core/ui/components/Card";
import ScheduleStatusBadge from "./ScheduleStatusBadge";
import { optimizeRoute as optimizeRouteApi } from "../../../../core/api/schedulesApi";

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
      client.shipping_latitude,
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
      client.shipping_longitude,
  );
  if (latitude === null || longitude === null) return null;
  return { lat: latitude, lng: longitude };
};

const getPriorityLabel = (priority) => {
  switch (Number(priority || 1)) {
    case 3:
      return "Alta";
    case 2:
      return "Media";
    default:
      return "Baja";
  }
};

const getPriorityColor = (priority) => {
  switch (Number(priority || 1)) {
    case 3:
      return "border-rose-200 bg-rose-50 text-rose-800";
    case 2:
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
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

const getVisitHours = (visit = {}) => {
  const durationMinutes = Number(visit.duracion_minutos || 0);
  if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
    return durationMinutes / 60;
  }
  const durationHours = Number(visit.duration_hours || 0);
  if (Number.isFinite(durationHours) && durationHours > 0) {
    return durationHours;
  }
  return 2;
};

const haversineDistanceKm = (from, to) => {
  if (!from || !to) return 0;
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

export const validateLogistics = (visits = [], clientsById = {}, orderedVisitIds = []) => {
  const indexById = orderedVisitIds.reduce((acc, visitId, index) => {
    acc[String(visitId)] = index;
    return acc;
  }, {});

  const orderedVisits = [...visits].sort((a, b) => {
    const aIndex = Object.prototype.hasOwnProperty.call(indexById, String(a.id))
      ? indexById[String(a.id)]
      : Number.MAX_SAFE_INTEGER;
    const bIndex = Object.prototype.hasOwnProperty.call(indexById, String(b.id))
      ? indexById[String(b.id)]
      : Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return Number(b.priority || 1) - Number(a.priority || 1);
  });

  const warnedVisitIds = new Set();
  const alerts = [];

  for (let index = 0; index < orderedVisits.length - 1; index += 1) {
    const current = orderedVisits[index];
    const next = orderedVisits[index + 1];
    const currentClient = clientsById[String(current.client_request_id)] || {};
    const nextClient = clientsById[String(next.client_request_id)] || {};
    const currentCoords = resolveCoordinatesFromVisit(current, currentClient);
    const nextCoords = resolveCoordinatesFromVisit(next, nextClient);
    if (!currentCoords || !nextCoords) continue;

    const distanceKm = haversineDistanceKm(currentCoords, nextCoords);
    if (distanceKm > 250) {
      warnedVisitIds.add(String(current.id));
      warnedVisitIds.add(String(next.id));
      alerts.push({
        from: current.id,
        to: next.id,
        distanceKm,
      });
    }
  }

  return {
    warnedVisitIds,
    alerts,
  };
};

const CapacityRing = ({ percentage }) => {
  const safePercentage = Math.max(0, Math.min(100, Number(percentage || 0)));
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  return (
    <div className="relative h-11 w-11">
      <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r={radius} stroke="currentColor" strokeWidth="4" fill="none" className="text-slate-200" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={safePercentage >= 100 ? "text-rose-500" : safePercentage >= 75 ? "text-amber-500" : "text-emerald-500"}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-slate-700">
        {Math.round(safePercentage)}%
      </span>
    </div>
  );
};

const ScheduleCalendarView = ({
  schedule,
  clients = [],
  onUpdateVisit,
  onRemoveVisit,
  onRequestEdit,
  editingLocked,
  holidaysSet = new Set(),
  onQuickAdd,
  onSelectedDateChange,
  onRouteContextChange,
}) => {
  const optimizeDebounceRef = useRef(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [optimizedOrders, setOptimizedOrders] = useState({});
  const [routeSummaryByDate, setRouteSummaryByDate] = useState({});
  const [routeSegmentsByDate, setRouteSegmentsByDate] = useState({});
  const [routePointsByDate, setRoutePointsByDate] = useState({});
  const [searchByDate, setSearchByDate] = useState({});

  const findClient = useCallback(
    (id) => clients.find((client) => String(client.id) === String(id)),
    [clients],
  );

  const clientsById = useMemo(
    () =>
      clients.reduce((acc, client) => {
        acc[String(client.id)] = client;
        return acc;
      }, {}),
    [clients],
  );

  const grouped = useMemo(() => groupByDate(schedule?.visits || []), [schedule?.visits]);
  const sortedDateEntries = useMemo(
    () => Object.entries(grouped).sort(([a], [b]) => new Date(a) - new Date(b)),
    [grouped],
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
    [],
  );

  const orderVisitsForDisplay = useCallback(
    (dateKey, visits = []) => {
      const optimizedOrder = optimizedOrders[dateKey] || [];
      if (!optimizedOrder.length) {
        return [...visits].sort((a, b) => Number(b.priority || 1) - Number(a.priority || 1));
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
        return Number(b.priority || 1) - Number(a.priority || 1);
      });
    },
    [optimizedOrders],
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
  const selectedRouteSummary = useMemo(
    () => routeSummaryByDate[selectedDate] || null,
    [routeSummaryByDate, selectedDate],
  );
  const selectedRouteSegments = useMemo(
    () => routeSegmentsByDate[selectedDate] || [],
    [routeSegmentsByDate, selectedDate],
  );

  const runRouteOptimization = useCallback(
    async (dateKey) => {
      if (!schedule?.id || !dateKey) return;
      setRouteLoading(true);
      setRouteError("");
      try {
        const response = await optimizeRouteApi({ schedule_ids: [schedule.id] });
        const routeEntries = Array.isArray(response?.routes_by_date) ? response.routes_by_date : [];
        const matchedRoute = routeEntries.find(
          (entry) => String(entry?.planned_date || "") === String(dateKey || ""),
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
          setRouteError("No se encontro una ruta para el dia seleccionado.");
          return;
        }
        if (!matchedRoute.optimized && matchedRoute.reason) {
          setRouteError(matchedRoute.reason);
        }
      } catch (error) {
        const message = error?.response?.data?.message || error?.message || "No se pudo optimizar la ruta.";
        setRouteError(message);
      } finally {
        setRouteLoading(false);
      }
    },
    [schedule?.id],
  );

  const requestOptimizedRoute = useCallback(
    (dateKey) => {
      if (!dateKey) return;
      if (optimizeDebounceRef.current) {
        clearTimeout(optimizeDebounceRef.current);
      }
      optimizeDebounceRef.current = setTimeout(() => {
        runRouteOptimization(dateKey);
      }, 320);
    },
    [runRouteOptimization],
  );

  useEffect(() => {
    if (selectedDate) {
      requestOptimizedRoute(selectedDate);
    }
  }, [selectedDate, requestOptimizedRoute]);

  const selectedVisits = useMemo(() => {
    if (!selectedDate) return [];
    return orderVisitsForDisplay(selectedDate, grouped[selectedDate] || []);
  }, [grouped, orderVisitsForDisplay, selectedDate]);

  useEffect(() => {
    onSelectedDateChange?.(selectedDate);
  }, [onSelectedDateChange, selectedDate]);

  useEffect(() => {
    onRouteContextChange?.({
      selectedDate,
      dateLabel: selectedDate ? getCurrentDateLabel(selectedDate) : "",
      mapMarkers,
      routeSummary: selectedRouteSummary,
      routeSegments: selectedRouteSegments,
      routeLoading,
      routeError,
      selectedVisits,
    });
  }, [
    mapMarkers,
    onRouteContextChange,
    routeError,
    routeLoading,
    selectedDate,
    selectedRouteSegments,
    selectedRouteSummary,
    selectedVisits,
  ]);

  const isLocked = Boolean(editingLocked && schedule?.status === "approved");

  const handleChangePriority = (visit, value) => {
    if (isLocked) {
      onRequestEdit?.(schedule);
      return;
    }
    const priority = Number(value) || 1;
    onUpdateVisit?.(schedule.id, visit.id, { priority });
  };

  const handleChangeClient = (visit, value) => {
    if (isLocked) {
      onRequestEdit?.(schedule);
      return;
    }
    const selected = findClient(value);
    const city = selected?.shipping_city || selected?.shipping_province || selected?.shipping_address || visit.city;
    onUpdateVisit?.(schedule.id, visit.id, { client_request_id: Number(value), city });
  };

  const handleQuickAdd = async (date, client, closePopover) => {
    if (!client || !date || !onQuickAdd) return;
    await onQuickAdd({
      date,
      client,
    });
    setSearchByDate((prev) => ({ ...prev, [date]: "" }));
    closePopover?.();
  };

  if (!schedule) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        Selecciona o crea un cronograma para comenzar.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <FiCalendar className="text-slate-600" size={20} />
            Calendario {schedule.month}/{schedule.year}
          </h3>
          <p className="text-sm text-slate-600">Selecciona el dia y gestiona visitas en tiempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={FiNavigation}
            onClick={() => requestOptimizedRoute(selectedDate)}
            disabled={!selectedDate || routeLoading}
          >
            {routeLoading ? "Optimizando..." : "Optimizar ruta"}
          </Button>
          <ScheduleStatusBadge status={schedule.status} />
        </div>
      </div>

      {routeError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{routeError}</div>
      ) : null}

      {sortedDateEntries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <FiCalendar className="mx-auto mb-3 text-slate-300" size={42} />
          <p className="text-sm text-slate-500">No hay visitas planificadas para este cronograma.</p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedDateEntries.map(([date, visits]) => {
          const orderedVisits = orderVisitsForDisplay(date, visits);
          const totalHours = orderedVisits.reduce((acc, visit) => acc + getVisitHours(visit), 0);
          const occupancyPct = Math.min(100, (totalHours / 8) * 100);
          const logistics = validateLogistics(orderedVisits, clientsById, optimizedOrders[date] || []);
          const isSelected = selectedDate === date;
          const isHoliday = holidaysSet?.has?.(date);
          const quickSearch = searchByDate[date] || "";
          const filteredClients = clients
            .filter((client) => {
              if (!quickSearch.trim()) return true;
              const term = quickSearch.toLowerCase();
              const fields = [
                client.commercial_name,
                client.nombre,
                client.name,
                client.email,
                client.shipping_city,
                client.shipping_province,
                String(client.id || ""),
              ]
                .filter(Boolean)
                .map((item) => String(item).toLowerCase());
              return fields.some((item) => item.includes(term));
            })
            .slice(0, 8);

          return (
            <motion.div
              key={date}
              layout
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                isSelected ? "border-cyan-300 ring-2 ring-cyan-100" : "border-slate-200"
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedDate(date)}
                className="w-full border-b border-slate-200 bg-slate-50 px-4 py-3 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {new Date(date).toLocaleDateString("es-EC", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                      })}
                    </p>
                    <p className="text-xs text-slate-500">
                      {orderedVisits.length} visitas · {totalHours.toFixed(1)}h planificadas
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isHoliday ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
                        Feriado
                      </span>
                    ) : null}
                    <CapacityRing percentage={occupancyPct} />
                  </div>
                </div>
              </button>

              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <Popover className="relative">
                    {({ close }) => (
                      <>
                        <Popover.Button
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Quick add
                        </Popover.Button>
                        <Popover.Panel className="absolute z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                          <p className="mb-2 text-xs font-semibold text-slate-700">Agregar visita al {date}</p>
                          <input
                            value={quickSearch}
                            onChange={(event) =>
                              setSearchByDate((prev) => ({ ...prev, [date]: event.target.value }))
                            }
                            placeholder="Buscar cliente"
                            className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                          <div className="max-h-56 space-y-1 overflow-y-auto">
                            {filteredClients.length ? (
                              filteredClients.map((client) => {
                                const label =
                                  client.commercial_name ||
                                  client.nombre ||
                                  client.name ||
                                  client.display_name ||
                                  `Cliente #${client.id}`;
                                return (
                                  <button
                                    key={client.id}
                                    type="button"
                                    onClick={() => handleQuickAdd(date, client, close)}
                                    className="w-full rounded-lg border border-slate-100 px-2 py-2 text-left text-sm hover:bg-slate-50"
                                  >
                                    <p className="font-medium text-slate-900">{label}</p>
                                    <p className="text-xs text-slate-500">
                                      {client.shipping_city || "Sin ciudad"} · ID {client.id}
                                    </p>
                                  </button>
                                );
                              })
                            ) : (
                              <p className="text-xs text-slate-400">No se encontraron clientes.</p>
                            )}
                          </div>
                        </Popover.Panel>
                      </>
                    )}
                  </Popover>

                  {logistics.alerts.length ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700">
                      <FiAlertTriangle size={12} />
                      {logistics.alerts.length} alerta logistica
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500">Sin alertas logisticas</span>
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {orderedVisits.map((visit) => {
                    const client = findClient(visit.client_request_id) || {};
                    const label = resolveVisitLabel(visit, client);
                    const isWarned = logistics.warnedVisitIds.has(String(visit.id));

                    return (
                      <motion.div
                        key={visit.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className={`rounded-xl border p-3 ${getPriorityColor(visit.priority || 1)}`}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div>
                            <p className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                              <FiUser size={14} className="text-slate-500" />
                              {label}
                            </p>
                            <p className="mt-1 flex items-center gap-3 text-xs text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                <FiMapPin size={12} />
                                {visit.city || visit.client_city || visit.client_province || "Sin ciudad"}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <FiClock size={12} />
                                {getVisitHours(visit).toFixed(1)}h
                              </span>
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getPriorityColor(visit.priority || 1)}`}>
                              {getPriorityLabel(visit.priority || 1)}
                            </span>
                            {isWarned ? <FiAlertTriangle className="text-rose-600" size={15} /> : null}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          <select
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:opacity-60"
                            value={visit.client_request_id || ""}
                            onChange={(event) => handleChangeClient(visit, event.target.value)}
                            disabled={isLocked}
                          >
                            <option value="">Selecciona cliente</option>
                            {clients.map((option) => {
                              const optionLabel =
                                option.commercial_name ||
                                option.nombre ||
                                option.name ||
                                option.display_name ||
                                option.email ||
                                option.identificador ||
                                `Cliente #${option.id}`;
                              return (
                                <option key={option.id} value={option.id}>
                                  {optionLabel}
                                </option>
                              );
                            })}
                          </select>

                          <div className="flex items-center gap-2">
                            <select
                              className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:opacity-60"
                              value={visit.priority || 1}
                              onChange={(event) => handleChangePriority(visit, event.target.value)}
                              disabled={isLocked}
                            >
                              <option value={1}>Baja</option>
                              <option value={2}>Media</option>
                              <option value={3}>Alta</option>
                            </select>
                            {onRemoveVisit && !isLocked ? (
                              <Button
                                size="sm"
                                variant="danger"
                                icon={FiTrash2}
                                onClick={() => onRemoveVisit(schedule.id, visit.id)}
                              >
                                Quitar
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        {visit.notes ? (
                          <div className="mt-2 rounded-lg border border-slate-200 bg-white/70 px-2 py-1 text-xs text-slate-600">
                            {visit.notes}
                          </div>
                        ) : null}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Card className="border border-slate-200">
        <div className="p-4 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Dia seleccionado: {selectedDate ? getCurrentDateLabel(selectedDate) : "-"}</p>
          <p className="mt-1">Las alertas logisticas se activan cuando la distancia entre visitas supera 250 km en un mismo dia.</p>
        </div>
      </Card>
    </div>
  );
};

export default ScheduleCalendarView;

