import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, PolylineF } from "@react-google-maps/api";
import { useGoogleMaps } from "../../../../core/contexts/GoogleMapsContext";
import {
  FiBarChart2,
  FiMap,
  FiPlus,
  FiSend,
  FiTrash2,
} from "react-icons/fi";
import Button from "../../../../core/ui/components/Button";
import {
  WORKSPACE_3COL_CLASS,
  WORKSPACE_SIDEBAR_CLASS,
  WORKSPACE_MAIN_CLASS,
  WORKSPACE_CONTEXT_CLASS,
  WORKSPACE_PANEL_PADDING,
} from "../../../../core/ui/workspaceLayout";
import { useAuth } from "../../../../core/auth/useAuth";
import { useUI } from "../../../../core/ui/useUI";
import { fetchClients } from "../../../../core/api/clientsApi";
import ScheduleCalendarView from "./ScheduleCalendarView";
import ScheduleStatusBadge from "./ScheduleStatusBadge";
import ExecutiveMonthlyReport from "./ExecutiveMonthlyReport";
import ScheduleMapErrorBoundary from "./ScheduleMapErrorBoundary";
import Modal from "../../../../core/ui/components/Modal";
import { justifySchedule } from "../../../../core/api/schedulesApi";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
const GOOGLE_MAPS_MAP_ID = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
const DEFAULT_MAP_CENTER = { lat: -1.831239, lng: -78.183406 };
const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const CURRENT_DATE = new Date();
const DEFAULT_MONTH = CURRENT_DATE.getMonth() + 1;
const DEFAULT_YEAR = CURRENT_DATE.getFullYear();

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

const formatDistanceKm = (distanceKm) => {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return "0 km";
  return `${distanceKm.toFixed(1)} km`;
};

const formatDurationFromHours = (hours) => {
  if (!Number.isFinite(hours) || hours <= 0) return "0 min";
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

const statusTone = (status) => {
  if (status === "approved") return "border-emerald-200 bg-emerald-50";
  if (status === "pending_approval") return "border-amber-200 bg-amber-50";
  if (status === "rejected") return "border-rose-200 bg-rose-50";
  return "border-slate-200 bg-white";
};
const panelClass = "rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]";
const inputClass =
  "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-600 focus:ring-2 focus:ring-sky-500 focus:ring-offset-2";

const RouteContextPanel = ({ routeContext }) => {
  const { isLoaded: mapsLoaded, loadError } = useGoogleMaps();
  const [map, setMap] = useState(null);
  const advancedMarkersRef = useRef([]);

  const markers = useMemo(
    () => (Array.isArray(routeContext?.mapMarkers) ? routeContext.mapMarkers : []),
    [routeContext?.mapMarkers],
  );
  const polylinePath = markers.map((point) => ({ lat: point.lat, lng: point.lng }));
  const mapCenter = polylinePath[0] || DEFAULT_MAP_CENTER;
  const mapZoom = polylinePath.length > 1 ? 9 : 6;

  const fallbackDistanceKm = useMemo(() => {
    if (polylinePath.length < 2) return 0;
    let total = 0;
    for (let index = 0; index < polylinePath.length - 1; index += 1) {
      total += haversineDistanceKm(polylinePath[index], polylinePath[index + 1]);
    }
    return total;
  }, [polylinePath]);

  const summaryDistance =
    routeContext?.routeSummary?.estimated_distance_label || formatDistanceKm(fallbackDistanceKm);
  const summaryTime =
    routeContext?.routeSummary?.estimated_travel_time_label || formatDurationFromHours(fallbackDistanceKm / 55);

  useEffect(() => {
    if (!map || !mapsLoaded) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    advancedMarkersRef.current.forEach((item) => {
      try {
        item.marker.map = null;
      } catch {
        // noop
      }
    });
    advancedMarkersRef.current = [];

    markers.forEach((point) => {
      const badge = document.createElement("div");
      badge.style.minWidth = "22px";
      badge.style.height = "22px";
      badge.style.padding = "0 6px";
      badge.style.borderRadius = "9999px";
      badge.style.display = "flex";
      badge.style.alignItems = "center";
      badge.style.justifyContent = "center";
      badge.style.background = "#0f172a";
      badge.style.color = "#ffffff";
      badge.style.fontSize = "11px";
      badge.style.fontWeight = "700";
      badge.style.border = "2px solid #ffffff";
      badge.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
      badge.textContent = String(point.route_order || "");

      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: point.lat, lng: point.lng },
        title: `${point.route_order}. ${point.client_name}`,
        content: badge,
      });
      advancedMarkersRef.current.push({ marker });
    });

    return () => {
      advancedMarkersRef.current.forEach((item) => {
        try {
          item.marker.map = null;
        } catch {
          // noop
        }
      });
      advancedMarkersRef.current = [];
    };
  }, [map, mapsLoaded, markers]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Dia seleccionado</p>
        <p className="text-sm font-semibold text-slate-900">{routeContext?.dateLabel || "Selecciona un dia"}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Distancia</p>
          <p className="text-sm font-semibold text-slate-900">{summaryDistance}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Tiempo estimado</p>
          <p className="text-sm font-semibold text-slate-900">{summaryTime}</p>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        {!GOOGLE_MAPS_API_KEY ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-amber-700">
            Configura REACT_APP_GOOGLE_MAPS_API_KEY para visualizar el mapa.
          </div>
        ) : loadError ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-rose-700">
            No se pudo cargar Google Maps.
          </div>
        ) : !mapsLoaded ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">Cargando mapa...</div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={mapCenter}
            zoom={mapZoom}
            onLoad={setMap}
            onUnmount={() => {
              advancedMarkersRef.current.forEach((item) => {
                try {
                  item.marker.map = null;
                } catch {
                  // noop
                }
              });
              advancedMarkersRef.current = [];
              setMap(null);
            }}
            mapId={GOOGLE_MAPS_MAP_ID}
            options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false }}
          >
            {polylinePath.length >= 2 ? (
              <PolylineF
                path={polylinePath}
                options={{
                  geodesic: true,
                  strokeColor: "#0f172a",
                  strokeOpacity: 0.8,
                  strokeWeight: 4,
                }}
              />
            ) : null}
          </GoogleMap>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Resumen de ruta</p>
        <p className="text-xs text-slate-600">
          {routeContext?.routeLoading
            ? "Optimizando ruta..."
            : routeContext?.routeError
              ? routeContext.routeError
              : `${markers.length} paradas sincronizadas con el dia seleccionado.`}
        </p>
      </div>
    </div>
  );
};

const ScheduleWorkspace = ({
  schedules = [],
  activeSchedule,
  holidays,
  loading,
  error,
  loadScheduleDetail,
  create,
  addVisit,
  updateVisit,
  removeVisit,
  submit,
  remove,
}) => {
  const { role, user } = useAuth();
  const { showToast } = useUI();
  const roleLower = (role || "").toLowerCase();
  const canEditSchedules = ["comercial", "acp_comercial", "backoffice", "backoffice_comercial"].includes(roleLower);
  const canSeeExecutiveReport = ["jefe_comercial", "gerencia"].includes((user?.role || "").toLowerCase());

  const [selectedMonth, setSelectedMonth] = useState(DEFAULT_MONTH);
  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [createNotes, setCreateNotes] = useState("");
  const [routeContext, setRouteContext] = useState({});
  const [unlockedScheduleId, setUnlockedScheduleId] = useState(null);
  const [showExecutiveReport, setShowExecutiveReport] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [modalJustifySchedule, setModalJustifySchedule] = useState(false);

  useEffect(() => {
    let active = true;
    const loadClients = async () => {
      setClientsLoading(true);
      try {
        const payload = await fetchClients({ limit: 1500 });
        if (!active) return;
        setClients(Array.isArray(payload?.clients) ? payload.clients : []);
      } catch (_error) {
        if (active) setClients([]);
      } finally {
        if (active) setClientsLoading(false);
      }
    };
    loadClients();
    return () => {
      active = false;
    };
  }, []);

  const yearOptions = useMemo(() => {
    const years = new Set([DEFAULT_YEAR - 1, DEFAULT_YEAR, DEFAULT_YEAR + 1]);
    schedules.forEach((item) => {
      if (item?.year) years.add(Number(item.year));
    });
    return [...years].sort((a, b) => b - a);
  }, [schedules]);

  const schedulesByYear = useMemo(
    () =>
      [...schedules]
        .filter((item) => Number(item.year) === Number(selectedYear))
        .sort((a, b) => Number(b.month) - Number(a.month)),
    [schedules, selectedYear],
  );

  const scheduleForPeriod = useMemo(
    () =>
      schedules.find(
        (item) => Number(item.month) === Number(selectedMonth) && Number(item.year) === Number(selectedYear),
      ) || null,
    [schedules, selectedMonth, selectedYear],
  );

  useEffect(() => {
    if (!scheduleForPeriod) return;
    if (activeSchedule?.id === scheduleForPeriod.id) return;
    loadScheduleDetail(scheduleForPeriod.id);
  }, [activeSchedule?.id, loadScheduleDetail, scheduleForPeriod]);

  const displayedSchedule = useMemo(() => {
    if (!scheduleForPeriod) return null;
    if (activeSchedule?.id === scheduleForPeriod.id) {
      return activeSchedule;
    }
    return scheduleForPeriod;
  }, [activeSchedule, scheduleForPeriod]);

  const editingLocked = Boolean(
    displayedSchedule?.status === "approved" && unlockedScheduleId !== displayedSchedule?.id,
  );
  const holidaySet = useMemo(() => new Set(Array.isArray(holidays?.dates) ? holidays.dates : []), [holidays?.dates]);

  const businessMetrics = useMemo(() => {
    const totalSchedules = schedules.length;
    const activeSchedules = schedules.filter((item) => item.status === "approved").length;
    const pendingSchedules = schedules.filter((item) => item.status === "pending_approval").length;
    const activeVisits = Array.isArray(displayedSchedule?.visits) ? displayedSchedule.visits : [];

    const totalVisits = activeVisits.length;
    const completedVisits = activeVisits.filter((visit) => visit.visit_status === "visited").length;
    const efficiencyRate = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;

    const citiesCovered = new Set(
      activeVisits
        .map((visit) => visit.city || visit.client_city || visit.client_province)
        .filter(Boolean),
    ).size;

    const highPriorityVisits = activeVisits.filter((visit) => Number(visit.priority || 1) === 3).length;

    return {
      totalSchedules,
      activeSchedules,
      pendingSchedules,
      totalVisits,
      completedVisits,
      efficiencyRate,
      citiesCovered,
      highPriorityVisits,
      avgVisitsPerSchedule: totalSchedules > 0 ? Math.round(totalVisits / totalSchedules) : 0,
    };
  }, [displayedSchedule?.visits, schedules]);

  const handleSelectSchedule = useCallback(
    (schedule) => {
      if (!schedule) return;
      setSelectedMonth(Number(schedule.month));
      setSelectedYear(Number(schedule.year));
      setUnlockedScheduleId(null);
      loadScheduleDetail(schedule.id);
    },
    [loadScheduleDetail],
  );

  const handleCreateSchedule = async () => {
    if (!canEditSchedules) return;
    if (scheduleForPeriod) {
      showToast("Ya existe un cronograma para ese periodo", "warning");
      return;
    }

    setBusyAction("create");
    try {
      const created = await create({ month: Number(selectedMonth), year: Number(selectedYear), notes: createNotes || null });
      setCreateNotes("");
      if (created?.id) {
        await loadScheduleDetail(created.id);
      }
      showToast("Cronograma creado", "success");
    } catch (createError) {
      showToast(createError?.message || "No se pudo crear el cronograma", "error");
    } finally {
      setBusyAction("");
    }
  };

  const handleSubmitSchedule = async () => {
    if (!displayedSchedule?.id) return;
    setBusyAction("submit");
    try {
      await submit(displayedSchedule.id);
      showToast("Cronograma enviado para aprobacion", "success");
    } catch (submitError) {
      showToast(submitError?.message || "No se pudo enviar", "error");
    } finally {
      setBusyAction("");
    }
  };

  const handleDeleteSchedule = async () => {
    if (!displayedSchedule?.id) return;
    if (!window.confirm("Eliminar este cronograma? Esta accion no se puede deshacer.")) return;

    setBusyAction("delete");
    try {
      await remove(displayedSchedule.id);
      showToast("Cronograma eliminado", "success");
    } catch (removeError) {
      showToast(removeError?.message || "No se pudo eliminar", "error");
    } finally {
      setBusyAction("");
    }
  };

  const handleQuickAdd = useCallback(
    async ({ date, client }) => {
      if (!displayedSchedule?.id || !client) return;
      if (editingLocked) {
        showToast("Desbloquea el cronograma aprobado para editar", "warning");
        return;
      }

      if (holidaySet.has(date)) {
        const confirmed = window.confirm(
          `El dia ${date} esta marcado como feriado. Deseas agregar la visita de todas formas?`,
        );
        if (!confirmed) return;
      }

      const city = client.shipping_city || client.shipping_province || client.shipping_address || "Ciudad no especificada";
      try {
        await addVisit(displayedSchedule.id, {
          client_request_id: Number(client.id),
          planned_date: date,
          city,
          priority: 2,
          notes: null,
        });
      } catch (addError) {
        showToast(addError?.message || "No se pudo agregar la visita", "error");
      }
    },
    [displayedSchedule?.id, addVisit, editingLocked, holidaySet, showToast],
  );

  const [justificationMonthly, setJustificationMonthly] = useState("");
  const [isJustifyingMonthly, setIsJustifyingMonthly] = useState(false);

  useEffect(() => {
    if (displayedSchedule?.general_justification) {
      setJustificationMonthly(displayedSchedule.general_justification);
    } else {
      setJustificationMonthly("");
    }
  }, [displayedSchedule?.id, displayedSchedule?.general_justification]);

  const handleJustifySchedule = async () => {
    if (!displayedSchedule?.id || !justificationMonthly.trim()) return;
    setIsJustifyingMonthly(true);
    try {
      await justifySchedule(displayedSchedule.id, justificationMonthly);
      showToast("Justificacion mensual guardada", "success");
      setModalJustifySchedule(false);
      loadScheduleDetail(displayedSchedule.id);
    } catch (error) {
      showToast(error?.message || "No se pudo guardar la justificacion", "error");
    } finally {
      setIsJustifyingMonthly(false);
    }
  };

  return (
    <div className={WORKSPACE_3COL_CLASS}>
      <aside className={`${WORKSPACE_SIDEBAR_CLASS} ${WORKSPACE_PANEL_PADDING} space-y-4`}>
        <div className={panelClass + " p-4"}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planificacion mensual</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight text-slate-900">Workspace de cronogramas</h1>
        </div>

        <div className={panelClass + " grid grid-cols-2 gap-3 p-4"}>
          <label className="text-xs text-slate-600">
            Mes
            <select
              className={inputClass}
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(Number(event.target.value))}
            >
              {MONTHS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-600">
            Ano
            <select
              className={inputClass}
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
            >
              {yearOptions.map((yearOption) => (
                <option key={yearOption} value={yearOption}>
                  {yearOption}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={panelClass + " space-y-3 p-4"}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</p>
          {!scheduleForPeriod && canEditSchedules ? (
            <>
              <textarea
                value={createNotes}
                onChange={(event) => setCreateNotes(event.target.value)}
                rows={2}
                placeholder="Notas del cronograma"
                className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
              />
              <Button
                variant="primary"
                icon={FiPlus}
                onClick={handleCreateSchedule}
                loading={busyAction === "create"}
                className="w-full"
              >
                Crear cronograma {String(selectedMonth).padStart(2, "0")}/{selectedYear}
              </Button>
            </>
          ) : null}

          {displayedSchedule ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">
                  {MONTHS[Number(displayedSchedule.month || 1) - 1]} {displayedSchedule.year}
                </span>
              </div>

              {editingLocked ? (
                <Button variant="warning" onClick={() => setUnlockedScheduleId(displayedSchedule.id)} className="w-full">
                  Habilitar edicion
                </Button>
              ) : null}

              {canEditSchedules && ["draft", "rejected"].includes(displayedSchedule.status) ? (
                <Button
                  variant="success"
                  icon={FiSend}
                  onClick={handleSubmitSchedule}
                  loading={busyAction === "submit"}
                  className="w-full"
                >
                  Enviar aprobacion
                </Button>
              ) : null}

              {canEditSchedules && ["draft", "rejected"].includes(displayedSchedule.status) ? (
                <Button
                  variant="danger"
                  icon={FiTrash2}
                  onClick={handleDeleteSchedule}
                  loading={busyAction === "delete"}
                  className="w-full"
                >
                  Eliminar cronograma
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-slate-500">Sin cronograma activo para el periodo seleccionado.</p>
          )}

          {canSeeExecutiveReport ? (
            <Button variant="secondary" icon={FiBarChart2} onClick={() => setShowExecutiveReport(true)} className="w-full">
              Generar informe mensual
            </Button>
          ) : null}
        </div>

        <div className={panelClass + " space-y-2 p-4"}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cronogramas</p>
            <span className="text-xs text-slate-400">{schedulesByYear.length}</span>
          </div>
          {schedulesByYear.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-3 text-xs text-slate-500">
              No hay cronogramas para {selectedYear}.
            </div>
          ) : (
            schedulesByYear.map((schedule) => {
              const isActive = displayedSchedule?.id === schedule.id;
              return (
                <button
                  key={schedule.id}
                  type="button"
                  onClick={() => handleSelectSchedule(schedule)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition ${statusTone(schedule.status)} ${
                    isActive ? "ring-2 ring-cyan-200" : "hover:border-cyan-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      {MONTHS[Number(schedule.month || 1) - 1]} {schedule.year}
                    </p>
                    <ScheduleStatusBadge status={schedule.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">ID #{schedule.id}</p>
                </button>
              );
            })
          )}
        </div>

        <div className={panelClass + " p-4"}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">KPI Section</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-slate-50 p-2">
              <p className="text-slate-500">Activos</p>
              <p className="text-sm font-semibold text-slate-900">{businessMetrics.activeSchedules}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2">
              <p className="text-slate-500">Pendientes</p>
              <p className="text-sm font-semibold text-slate-900">{businessMetrics.pendingSchedules}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2">
              <p className="text-slate-500">Visitas</p>
              <p className="text-sm font-semibold text-slate-900">{businessMetrics.totalVisits}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2">
              <p className="text-slate-500">Eficiencia</p>
              <p className="text-sm font-semibold text-slate-900">{businessMetrics.efficiencyRate}%</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2">
              <p className="text-slate-500">Ciudades</p>
              <p className="text-sm font-semibold text-slate-900">{businessMetrics.citiesCovered}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2">
              <p className="text-slate-500">Alta prioridad</p>
              <p className="text-sm font-semibold text-slate-900">{businessMetrics.highPriorityVisits}</p>
            </div>
          </div>
          {businessMetrics.efficiencyRate < 100 && displayedSchedule?.status === "approved" && (
            <div className="mt-2">
              {displayedSchedule.general_justification ? (
                <div className="rounded-lg bg-amber-50 p-2 text-[10px] border border-amber-100">
                  <p className="font-bold text-amber-800">Justificación mensual:</p>
                  <p className="text-slate-600 line-clamp-2">{displayedSchedule.general_justification}</p>
                  <button 
                    onClick={() => setModalJustifySchedule(true)}
                    className="mt-1 text-cyan-700 hover:underline"
                  >
                    Editar
                  </button>
                </div>
              ) : (
                <Button
                  size="xs"
                  variant="warning"
                  className="w-full text-[10px]"
                  onClick={() => setModalJustifySchedule(true)}
                >
                  Justificar bajo cumplimiento mensual
                </Button>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className={`${WORKSPACE_MAIN_CLASS} ${WORKSPACE_PANEL_PADDING}`}>
        {error ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}

        {(clientsLoading || clients.length > 0 || loading) && (
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {clientsLoading ? "Cargando clientes..." : `${clients.length} clientes disponibles`}
            </p>
            {loading ? <span className="text-xs text-slate-400">Sincronizando...</span> : null}
          </div>
        )}

        <ScheduleCalendarView
          schedule={displayedSchedule}
          clients={clients}
          onUpdateVisit={updateVisit}
          onRemoveVisit={removeVisit}
          editingLocked={editingLocked}
          onQuickAdd={handleQuickAdd}
          onRequestEdit={() => setUnlockedScheduleId(displayedSchedule?.id || null)}
          holidaysSet={holidaySet}
          onRouteContextChange={setRouteContext}
        />
      </main>

      <aside className={`${WORKSPACE_CONTEXT_CLASS} ${WORKSPACE_PANEL_PADDING}`}>
        <div className="mb-4 flex items-center gap-2">
          <FiMap className="text-slate-600" size={16} />
          <p className="text-sm font-semibold text-slate-900">Context Panel</p>
        </div>

        <ScheduleMapErrorBoundary>
          <RouteContextPanel routeContext={routeContext} />
        </ScheduleMapErrorBoundary>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Validacion de feriados</p>
          <p className="mt-1">Los dias festivos bloquean quick-add y requieren confirmacion explicita.</p>
          <p className="mt-2">Feriados cargados: {holidaySet.size}</p>
        </div>
      </aside>

      {canSeeExecutiveReport ? (
        <ExecutiveMonthlyReport
          open={showExecutiveReport}
          onClose={() => setShowExecutiveReport(false)}
          month={selectedMonth}
          year={selectedYear}
        />
      ) : null}

      <Modal
        open={modalJustifySchedule}
        onClose={() => setModalJustifySchedule(false)}
        title={`Justificar cumplimiento mensual - ${MONTHS[selectedMonth - 1]} ${selectedYear}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-semibold">Bajo cumplimiento detectado ({businessMetrics.efficiencyRate}%).</p>
            <p className="mt-1">Use este espacio para justificar el motivo global por el cual no se cumplió la meta de visitas del mes.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Justificación general
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              rows={5}
              value={justificationMonthly}
              onChange={(e) => setJustificationMonthly(e.target.value)}
              placeholder="Ej: Problemas logísticos nacionales, feriados extendidos, cambio de estrategia comercial..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalJustifySchedule(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleJustifySchedule}
              loading={isJustifyingMonthly}
              disabled={!justificationMonthly.trim()}
            >
              Guardar justificación
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ScheduleWorkspace;
