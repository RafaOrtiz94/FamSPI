import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { GoogleMap, InfoWindowF, MarkerF } from "@react-google-maps/api";
import { useGoogleMaps } from "../../../../core/contexts/GoogleMapsContext";
import { calculateCenter, transformToMarkers, getMarkerColor } from "../../utils/attendanceGeo";
import { formatTimeSafe } from "../../../../shared/utils/dateUtils";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_MAP_ID_RAW = String(process.env.REACT_APP_GOOGLE_MAPS_MAP_ID || "").trim();
const HAS_VALID_MAP_ID = Boolean(GOOGLE_MAPS_MAP_ID_RAW && GOOGLE_MAPS_MAP_ID_RAW !== "DEMO_MAP_ID");
const GOOGLE_MAPS_MAP_ID = HAS_VALID_MAP_ID ? GOOGLE_MAPS_MAP_ID_RAW : undefined;

const mapContainerStyle = {
  width: "100%",
  height: "500px",
};

const EVENT_CATEGORY_BY_TYPE = Object.freeze({
  entry: "Normal",
  exit: "Normal",
  lunch_start: "Normal",
  lunch_end: "Normal",
  op_lunch_start: "Campo",
  op_lunch_end: "Campo",
  office_exit: "Campo",
  office_entry: "Campo",
  client_entry: "Cliente",
  client_exit: "Cliente",
  arrival: "Cliente",
  departure: "Cliente",
});

const EVENT_LABEL_BY_TYPE = Object.freeze({
  entry: "Entrada normal",
  exit: "Salida normal",
  lunch_start: "Salida almuerzo",
  lunch_end: "Entrada almuerzo",
  op_lunch_start: "Salida almuerzo operacional",
  op_lunch_end: "Entrada almuerzo operacional",
  office_exit: "Salida oficina/viaje",
  office_entry: "Entrada oficina/viaje",
  client_entry: "Entrada cliente",
  client_exit: "Salida cliente",
  arrival: "Entrada cliente",
  departure: "Salida cliente",
});

const MAP_LEGEND_ITEMS = [
  { key: "normal", label: "Normal E/S", type: "entry" },
  { key: "field", label: "Campo E/S", type: "office_exit" },
  { key: "client", label: "Cliente E/S", type: "client_entry" },
];

const EVENT_SHORT_BY_TYPE = Object.freeze({
  entry: "EN",
  exit: "SA",
  lunch_start: "AL-S",
  lunch_end: "AL-E",
  op_lunch_start: "OP-A-S",
  op_lunch_end: "OP-A-E",
  office_exit: "C-S",
  office_entry: "C-E",
  client_entry: "CL-E",
  client_exit: "CL-S",
  arrival: "CL-E",
  departure: "CL-S",
});

const USER_RING_COLORS = ["#0f766e", "#7c3aed", "#dc2626", "#2563eb", "#be123c", "#1d4ed8", "#0f766e", "#ea580c"];
const getUserRingColor = (marker = {}) => {
  const seed = String(marker?.userId || marker?.fullname || marker?.id || "");
  if (!seed) return "#1f2937";
  const hash = seed.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return USER_RING_COLORS[Math.abs(hash) % USER_RING_COLORS.length];
};

const AttendanceMapView = ({
  rows = [],
  getGeoPoints = (row) => row.geo_points || [],
  selectedUserId,
  onMarkerClick: handleMarkerClickProp,
  onProfileClick,
}) => {
  const [map, setMap] = useState(null);
  const [activeInfoMarker, setActiveInfoMarker] = useState(null);
  const [mapType, setMapType] = useState("roadmap");
  const advancedMarkersRef = useRef([]);

   const { isLoaded, loadError } = useGoogleMaps();

  const markers = useMemo(() => {
    return transformToMarkers(rows, getGeoPoints).filter((marker) => !["start", "return"].includes(String(marker?.type || "").toLowerCase()));
  }, [rows, getGeoPoints]);

  const center = useMemo(() => {
    const coords = markers.map((m) => m.coord);
    return calculateCenter(coords);
  }, [markers]);

  const uniqueUsers = useMemo(() => {
    const users = [...new Set(markers.map(m => m.userId))];
    return users.length;
  }, [markers]);

  const categoryCounts = useMemo(() => {
    const totals = {
      normal: 0,
      field: 0,
      client: 0,
    };

    markers.forEach((marker) => {
      const type = String(marker?.type || "").toLowerCase();
      if (type === "entry" || type === "exit" || type === "lunch_start" || type === "lunch_end") totals.normal += 1;
      if (type === "office_exit" || type === "office_entry") totals.field += 1;
      if (type === "client_entry" || type === "client_exit" || type === "arrival" || type === "departure") totals.client += 1;
    });

    return totals;
  }, [markers]);

  useEffect(() => {
    if (map && selectedUserId) {
      map.setZoom(16);
    } else if (map && uniqueUsers > 1) {
      map.setZoom(14);
    } else if (map) {
      map.setZoom(12);
    }
  }, [map, selectedUserId, uniqueUsers]);

  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  const clearAdvancedMarkers = useCallback(() => {
    advancedMarkersRef.current.forEach((item) => {
      try {
        if (item.marker && item.clickHandler && item.usesDomEvent) {
          item.marker.removeEventListener?.("gmp-click", item.clickHandler);
        } else {
          item.listener?.remove?.();
        }
      } catch {
        // noop
      }
      try {
        if (item.marker) {
          item.marker.map = null;
        }
      } catch {
        // noop
      }
    });
    advancedMarkersRef.current = [];
  }, []);

  const onMarkerClick = useCallback((marker) => {
    setActiveInfoMarker(marker);
    handleMarkerClickProp?.(marker);
  }, [handleMarkerClickProp]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    if (!HAS_VALID_MAP_ID) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    clearAdvancedMarkers();

    markers.forEach((marker) => {
      const initial = marker.fullname ? marker.fullname.split(" ").map((n) => n[0]).slice(0, 2).join("") : "?";
      const shortType = EVENT_SHORT_BY_TYPE[marker.type] || "EV";
      const userRingColor = getUserRingColor(marker);

      const chip = document.createElement("div");
      chip.style.width = "24px";
      chip.style.height = "24px";
      chip.style.borderRadius = "9999px";
      chip.style.position = "relative";
      chip.style.display = "flex";
      chip.style.alignItems = "center";
      chip.style.justifyContent = "center";
      chip.style.color = "#fff";
      chip.style.fontSize = "10px";
      chip.style.fontWeight = "700";
      chip.style.backgroundColor = getMarkerColor(marker.type);
      chip.style.border = `2px solid ${userRingColor}`;
      chip.style.boxShadow = "0 2px 6px rgba(0,0,0,0.25)";
      chip.textContent = initial;

      const typeBadge = document.createElement("span");
      typeBadge.textContent = shortType;
      typeBadge.style.position = "absolute";
      typeBadge.style.bottom = "-10px";
      typeBadge.style.left = "50%";
      typeBadge.style.transform = "translateX(-50%)";
      typeBadge.style.fontSize = "8px";
      typeBadge.style.fontWeight = "700";
      typeBadge.style.lineHeight = "1";
      typeBadge.style.padding = "2px 4px";
      typeBadge.style.borderRadius = "9999px";
      typeBadge.style.color = "#0f172a";
      typeBadge.style.backgroundColor = "#ffffff";
      typeBadge.style.border = "1px solid #cbd5e1";
      chip.appendChild(typeBadge);

      const advancedMarker = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: marker.coord,
        title: `${marker.fullname || "Usuario"} | ${EVENT_LABEL_BY_TYPE[marker.type] || marker.label || ""} | ${formatTimeSafe(marker.hour)}`,
        content: chip,
      });

      const clickHandler = () => onMarkerClick(marker);
      let listener = null;
      let usesDomEvent = false;

      if (typeof advancedMarker.addEventListener === "function") {
        advancedMarker.addEventListener("gmp-click", clickHandler);
        usesDomEvent = true;
      } else {
        listener = advancedMarker.addListener?.("click", clickHandler);
      }

      advancedMarkersRef.current.push({
        marker: advancedMarker,
        clickHandler,
        listener,
        usesDomEvent,
      });
    });

    return () => {
      clearAdvancedMarkers();
    };
  }, [clearAdvancedMarkers, isLoaded, map, markers, onMarkerClick]);

  const mapTypeControl = mapType === "roadmap" ? "satellite" : "roadmap";

  if (!GOOGLE_MAPS_API_KEY || loadError) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <svg className="mb-3 h-12 w-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.786-1.086 2.786-2.404V6.404c0-1.318-1.246-2.404-2.786-2.404H5.082C3.642 4 2.398 5.086 2.398 6.404v10.192c0 1.318 1.246 2.404 2.786 2.404z" />
        </svg>
        <p className="font-medium text-amber-800">API de Google Maps no configurada</p>
        <p className="mt-1 text-sm text-amber-700">Configura REACT_APP_GOOGLE_MAPS_API_KEY en .env</p>
      </div>
    );
  }

  if (markers.length === 0) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
        <svg className="mb-3 h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.657-4.657A7 7 0 0119 12a7 7 0 01-7 7 7 7 0 017 7 7 7 0 017-7c1.493 0 2.867.508 4.043 1.343z" />
        </svg>
        <p className="font-medium text-slate-600">Sin datos de geolocalización</p>
        <p className="mt-1 text-sm text-slate-500">Selecciona un rango con coordenadas registradas</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
        <div className="animate-spin rounded-full border-2 border-slate-300 h-8 w-8 border-t-slate-600" />
      </div>
    );
  }

  return (
    <div className="relative h-[500px] w-full overflow-hidden rounded-2xl border border-slate-200">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={14}
        onLoad={onMapLoad}
        onUnmount={() => {
          clearAdvancedMarkers();
          setMap(null);
        }}
        mapTypeId={mapType}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        }}
        mapId={GOOGLE_MAPS_MAP_ID}
      >
        {!HAS_VALID_MAP_ID &&
          markers.map((marker) => (
            <MarkerF
              key={marker.id}
              position={marker.coord}
              onClick={() => onMarkerClick(marker)}
              title={`${marker.fullname || "Usuario"} | ${EVENT_LABEL_BY_TYPE[marker.type] || marker.label || "Evento"} | ${formatTimeSafe(marker.hour)}`}
              label={{
                text: marker.fullname
                  ? marker.fullname
                      .split(" ")
                      .map((chunk) => chunk[0])
                      .slice(0, 2)
                      .join("")
                  : "?",
                color: "#ffffff",
                fontSize: "10px",
                fontWeight: "700",
              }}
              icon={{
                path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                scale: 10,
                fillColor: getMarkerColor(marker.type),
                fillOpacity: 1,
                strokeColor: getUserRingColor(marker),
                strokeWeight: 2,
              }}
            />
          ))}
        {activeInfoMarker && (
          <InfoWindowF
            position={activeInfoMarker.coord}
            onCloseClick={() => setActiveInfoMarker(null)}
          >
            <div className="p-1 min-w-[120px]">
              <p className="font-semibold">Colaborador: {activeInfoMarker.fullname}</p>
              <p className="text-sm text-slate-600">
                Tipo: {EVENT_LABEL_BY_TYPE[activeInfoMarker.type] || activeInfoMarker.label || "Evento"}
              </p>
              <p className="text-xs text-slate-500">
                Categoria: {EVENT_CATEGORY_BY_TYPE[activeInfoMarker.type] || "General"}
              </p>
              <p className="text-xs text-slate-500">Hora (EC): {formatTimeSafe(activeInfoMarker.hour)}</p>
              <p className="text-xs text-slate-500">
                Codigo: {EVENT_SHORT_BY_TYPE[activeInfoMarker.type] || "EV"}
              </p>
              <button
                type="button"
                onClick={() => onProfileClick?.(activeInfoMarker)}
                className="mt-1 inline-block text-xs text-blue-600 hover:underline"
              >
                Ver perfil diario
              </button>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
      <div className="absolute left-3 top-3 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (map) {
              map.setCenter(center);
              map.setZoom(uniqueUsers === 1 ? 16 : 14);
            }
          }}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-slate-50"
        >
          Restablecer
        </button>
        <button
          type="button"
          onClick={() => setMapType(mapTypeControl)}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-slate-50"
        >
          {mapType === "roadmap" ? "Satélite" : "Mapa"}
        </button>
      </div>
      <div className="absolute bottom-3 right-3 z-10 rounded-lg bg-white px-2 py-1 text-xs font-medium shadow-sm">
        {markers.length} puntos
      </div>
      <div className="absolute right-3 top-3 z-10 w-56 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Tipos de registros</p>
        <p className="mt-1 text-[11px] text-slate-500">Relleno = tipo, borde = colaborador, iniciales = colaborador, hora EC (UTC-5).</p>
        <div className="mt-2 space-y-1.5">
          {MAP_LEGEND_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: getMarkerColor(item.type) }}
                />
                <span className="text-slate-700">{item.label}</span>
              </div>
              <span className="font-semibold text-slate-900">
                {item.key === "normal" ? categoryCounts.normal : item.key === "field" ? categoryCounts.field : categoryCounts.client}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AttendanceMapView;
