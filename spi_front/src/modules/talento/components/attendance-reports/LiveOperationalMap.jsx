import React, { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap, InfoWindowF, MarkerF } from "@react-google-maps/api";
import { FiAlertTriangle, FiMapPin, FiRefreshCw } from "react-icons/fi";
import { getAttendanceLiveMap } from "../../../../core/api/attendanceApi";
import { useGoogleMaps } from "../../../../core/contexts/GoogleMapsContext";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
const REFRESH_MS = 60 * 1000;
const FRESH_MINUTES = 30;
const STALE_MINUTES = 120;
const DEFAULT_CENTER = { lat: -1.8312, lng: -78.1834 }; // Ecuador

const freshnessOf = (minutes) => {
  if (minutes <= FRESH_MINUTES) return { key: "fresh", color: "#16A34A", label: "Reciente" };
  if (minutes <= STALE_MINUTES) return { key: "aging", color: "#D97706", label: "Hace un rato" };
  return { key: "stale", color: "#DC2626", label: "Desactualizada" };
};

const formatAge = (minutes) => {
  if (minutes < 1) return "hace menos de 1 min";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `hace ${hours} h ${rest} min` : `hace ${hours} h`;
};

const formatClock = (iso) => new Intl.DateTimeFormat("es-EC", {
  hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil",
}).format(new Date(iso));

const markerIcon = (color) => ({
  path: "M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z",
  fillColor: color,
  fillOpacity: 1,
  strokeColor: "#FFFFFF",
  strokeWeight: 1.5,
  scale: 1.6,
  anchor: window.google?.maps ? new window.google.maps.Point(12, 22) : undefined,
});

/**
 * Ultima ubicacion conocida de quienes estan en salida operacional activa.
 * No es seguimiento continuo: cada punto es la ultima marcacion con coordenadas
 * y siempre se muestra su antiguedad.
 */
export default function LiveOperationalMap() {
  const { isLoaded, loadError } = useGoogleMaps();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [map, setMap] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await getAttendanceLiveMap();
      setEntries(result.data);
      setGeneratedAt(result.generatedAt);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudo cargar el mapa de salidas operacionales.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Sin consultar con la pestaña oculta: evita lecturas innecesarias de ubicaciones.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const located = useMemo(() => entries.filter((entry) => entry.position), [entries]);
  const unlocated = useMemo(() => entries.filter((entry) => !entry.position), [entries]);
  const selected = located.find((entry) => entry.user_id === selectedId) || null;

  useEffect(() => {
    if (!map || !located.length || !window.google?.maps) return;
    const bounds = new window.google.maps.LatLngBounds();
    located.forEach((entry) => bounds.extend({ lat: entry.position.lat, lng: entry.position.lng }));
    map.fitBounds(bounds, 60);
    if (located.length === 1) map.setZoom(14);
    // Solo al cargar el mapa o cambiar quien esta localizado, no en cada refresco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, located.map((entry) => entry.user_id).join(",")]);

  const focus = (entry) => {
    setSelectedId(entry.user_id);
    if (map && entry.position) {
      map.panTo({ lat: entry.position.lat, lng: entry.position.lng });
      map.setZoom(Math.max(map.getZoom() || 0, 15));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <FiAlertTriangle className="mt-0.5 shrink-0" size={14} aria-hidden="true" />
        <p>
          Cada punto es la <strong>última marcación con ubicación</strong> de la persona (inicio de la salida, llegada,
          visita o almuerzo). No es seguimiento continuo: entre marcaciones no se sabe dónde está. Revisa siempre la hora del punto.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-3">
          {["fresh", "aging", "stale"].map((key) => {
            const info = freshnessOf(key === "fresh" ? 0 : key === "aging" ? FRESH_MINUTES + 1 : STALE_MINUTES + 1);
            return (
              <span key={key} className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: info.color }} />
                {key === "fresh" ? `Hasta ${FRESH_MINUTES} min` : key === "aging" ? `${FRESH_MINUTES}–${STALE_MINUTES} min` : `Más de ${STALE_MINUTES / 60} h`}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {generatedAt && <span>Consultado a las {formatClock(generatedAt)}</span>}
          <button
            type="button"
            onClick={() => { setLoading(true); load(); }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-50"
          >
            <FiRefreshCw size={12} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            Actualizar
          </button>
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          {!GOOGLE_MAPS_API_KEY || loadError ? (
            <div className="flex h-[420px] items-center justify-center bg-amber-50 p-6 text-center text-sm text-amber-800">
              El mapa no está disponible (falta la clave de Google Maps o no se pudo cargar). La lista de la derecha sigue mostrando la hora de cada punto.
            </div>
          ) : !isLoaded ? (
            <div className="flex h-[420px] items-center justify-center bg-slate-50 text-sm text-slate-500">Cargando mapa…</div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "420px" }}
              center={DEFAULT_CENTER}
              zoom={6}
              onLoad={setMap}
              onUnmount={() => setMap(null)}
              options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: true }}
            >
              {located.map((entry) => (
                <MarkerF
                  key={entry.user_id}
                  position={{ lat: entry.position.lat, lng: entry.position.lng }}
                  icon={markerIcon(freshnessOf(entry.position.age_minutes).color)}
                  title={`${entry.display_name} · ${formatAge(entry.position.age_minutes)}`}
                  onClick={() => setSelectedId(entry.user_id)}
                />
              ))}
              {selected && (
                <InfoWindowF
                  position={{ lat: selected.position.lat, lng: selected.position.lng }}
                  onCloseClick={() => setSelectedId(null)}
                >
                  <div className="max-w-[220px] text-xs text-slate-700">
                    <p className="text-sm font-semibold text-slate-900">{selected.display_name}</p>
                    <p>{selected.status_label} · {selected.destination_label}</p>
                    <p className="mt-1">{selected.position.source_label}</p>
                    <p className="font-semibold">
                      {formatClock(selected.position.at)} ({formatAge(selected.position.age_minutes)})
                    </p>
                  </div>
                </InfoWindowF>
              )}
            </GoogleMap>
          )}
        </div>

        <div className="max-h-[420px] space-y-2 overflow-y-auto">
          {!loading && !entries.length && !error && (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              No hay salidas operacionales activas en este momento.
            </p>
          )}
          {located.map((entry) => {
            const fresh = freshnessOf(entry.position.age_minutes);
            return (
              <button
                key={entry.user_id}
                type="button"
                onClick={() => focus(entry)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  entry.user_id === selectedId ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-2">
                  <FiMapPin size={15} style={{ color: fresh.color }} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{entry.display_name}</p>
                    <p className="truncate text-xs text-slate-500">{entry.status_label} · {entry.destination_label}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {entry.position.source_label} · <strong>{formatClock(entry.position.at)}</strong> ({formatAge(entry.position.age_minutes)})
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
          {unlocated.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-600">Sin ubicación registrada</p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                {unlocated.map((entry) => (
                  <li key={entry.user_id}>{entry.display_name} · {entry.destination_label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
