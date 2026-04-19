import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap } from "@react-google-maps/api";
import { useGoogleMaps } from "../../../core/contexts/GoogleMapsContext";
import { FiEdit3, FiMapPin, FiPlus, FiSave, FiTrash2, FiX } from "react-icons/fi";
import {
  addClientLocation,
  fetchClientLocations,
  removeClientLocation,
  updateClientLocation,
} from "../../../core/api/clientsApi";

const DEFAULT_CENTER = { lat: -1.831239, lng: -78.183406 };
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
const GOOGLE_MAPS_MAP_ID = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID || "";

const toCoordinate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const LocationManager = ({
  clientId,
  canEdit = false,
  selectedLocationId = "",
  onSelectLocation = () => {},
  onLocationsChange = () => {},
}) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [map, setMap] = useState(null);
  const markerRef = useRef(null);
  const markerListenerRef = useRef(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    province: "",
    lat: "",
    lng: "",
    is_main: false,
  });

  const { isLoaded: mapLoaded } = useGoogleMaps();

  const parsedLocationId = selectedLocationId ? Number(selectedLocationId) : null;
  const selectedLocation = useMemo(
    () => locations.find((item) => item && Number(item.id) === Number(parsedLocationId)) || null,
    [locations, parsedLocationId],
  );

  const mapCenter = useMemo(() => {
    const lat = toCoordinate(form.lat);
    const lng = toCoordinate(form.lng);
    if (lat !== null && lng !== null) return { lat, lng };
    const selectedLat = toCoordinate(selectedLocation?.lat);
    const selectedLng = toCoordinate(selectedLocation?.lng);
    if (selectedLat !== null && selectedLng !== null) return { lat: selectedLat, lng: selectedLng };
    return DEFAULT_CENTER;
  }, [form.lat, form.lng, selectedLocation]);

  const resetForm = () => {
    setForm({
      name: "",
      address: "",
      city: "",
      province: "",
      lat: "",
      lng: "",
      is_main: false,
    });
    setEditingId(null);
    setShowForm(false);
    setError("");
  };

  const loadLocations = async () => {
    if (!clientId) {
      setLocations([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const items = await fetchClientLocations(clientId);
      setLocations(Array.isArray(items) ? items : []);
      onLocationsChange(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "No se pudieron cargar las sedes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    if (!parsedLocationId && locations.length) {
      const main = locations.find((item) => item.is_main) || locations[0];
      if (main) onSelectLocation(main);
    }
  }, [locations, parsedLocationId, onSelectLocation]);

  const beginCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const beginEdit = (location) => {
    setEditingId(location.id);
    setShowForm(true);
    setForm({
      name: location.name || "",
      address: location.address || "",
      city: location.city || "",
      province: location.province || "",
      lat: location.lat ?? "",
      lng: location.lng ?? "",
      is_main: Boolean(location.is_main),
    });
    setError("");
  };

  const handleSave = async () => {
    if (!clientId) return;
    const payload = {
      ...form,
      lat: form.lat === "" ? null : Number(form.lat),
      lng: form.lng === "" ? null : Number(form.lng),
    };
    if (!payload.name?.trim()) {
      setError("El nombre de la sede es obligatorio.");
      return;
    }
    if (!payload.address?.trim()) {
      setError("La direccion de la sede es obligatoria.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await updateClientLocation(clientId, editingId, payload);
      } else {
        await addClientLocation(clientId, payload);
      }
      await loadLocations();
      resetForm();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "No se pudo guardar la sede");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (locationId) => {
    if (!canEdit || !clientId) return;
    if (!window.confirm("¿Eliminar esta sede?")) return;
    setSaving(true);
    setError("");
    try {
      await removeClientLocation(clientId, locationId);
      await loadLocations();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "No se pudo eliminar la sede");
    } finally {
      setSaving(false);
    }
  };

  const clearAdvancedMarker = useCallback(() => {
    try {
      markerListenerRef.current?.remove?.();
      markerListenerRef.current = null;
    } catch {
      // noop
    }
    try {
      if (markerRef.current) {
        if (typeof markerRef.current.setMap === "function") {
          markerRef.current.setMap(null);
        } else {
          markerRef.current.map = null;
        }
      }
      markerRef.current = null;
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    if (!map || !mapLoaded || !window.google?.maps) return;

    clearAdvancedMarker();
    const hasMapId = Boolean(GOOGLE_MAPS_MAP_ID);
    const hasAdvancedMarker = Boolean(window.google.maps.marker?.AdvancedMarkerElement);

    if (hasMapId && hasAdvancedMarker) {
      const pin = document.createElement("div");
      pin.style.width = "16px";
      pin.style.height = "16px";
      pin.style.borderRadius = "9999px";
      pin.style.background = "#1d4ed8";
      pin.style.border = "2px solid #ffffff";
      pin.style.boxShadow = "0 2px 6px rgba(0,0,0,0.35)";

      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: mapCenter,
        content: pin,
        gmpDraggable: true,
        title: "Ubicacion de sede",
      });

      const listener = marker.addListener?.("dragend", (event) => {
        const lat = event?.latLng?.lat?.();
        const lng = event?.latLng?.lng?.();
        if (typeof lat !== "number" || typeof lng !== "number") return;
        setForm((prev) => ({ ...prev, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
      });

      markerRef.current = marker;
      markerListenerRef.current = listener || null;
    } else {
      const marker = new window.google.maps.Marker({
        map,
        position: mapCenter,
        draggable: true,
        title: "Ubicacion de sede",
      });

      const listener = marker.addListener?.("dragend", (event) => {
        const lat = event?.latLng?.lat?.();
        const lng = event?.latLng?.lng?.();
        if (typeof lat !== "number" || typeof lng !== "number") return;
        setForm((prev) => ({ ...prev, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
      });

      markerRef.current = marker;
      markerListenerRef.current = listener || null;
    }

    return () => {
      clearAdvancedMarker();
    };
  }, [clearAdvancedMarker, map, mapCenter, mapLoaded]);

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-slate-900">Sedes de instalación</p>
          <p className="text-xs text-slate-500">Selecciona la sede objetivo o registra una nueva.</p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={beginCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <FiPlus size={13} />
            Nueva sede
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Cargando sedes...
        </div>
      ) : null}

      {!loading && !locations.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Este cliente no tiene sedes registradas. Agrega al menos una para continuar.
        </div>
      ) : null}

      {!!locations.length ? (
        <div className="space-y-2">
          {locations.map((location) => {
            const isSelected = Number(parsedLocationId) === Number(location.id);
            return (
              <div
                key={location.id}
                className={`rounded-lg border p-3 ${isSelected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50"}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <button
                    type="button"
                    onClick={() => onSelectLocation(location)}
                    className="text-left"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {location.name} {location.is_main ? "(Principal)" : ""}
                    </p>
                    <p className="text-xs text-slate-600">
                      {location.address}
                      {location.city ? `, ${location.city}` : ""}
                      {location.province ? `, ${location.province}` : ""}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {location.lat !== null && location.lng !== null
                        ? `${Number(location.lat).toFixed(6)}, ${Number(location.lng).toFixed(6)}`
                        : "Sin coordenadas"}
                    </p>
                  </button>
                  {canEdit ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => beginEdit(location)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        <FiEdit3 size={12} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(location.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                      >
                        <FiTrash2 size={12} />
                        Eliminar
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {showForm ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">Nombre de sede</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: Hospital Norte"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">Ciudad</span>
              <input
                type="text"
                value={form.city}
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">Direccion</span>
              <input
                type="text"
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">Provincia</span>
              <input
                type="text"
                value={form.province}
                onChange={(event) => setForm((prev) => ({ ...prev, province: event.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">Principal</span>
              <select
                value={form.is_main ? "yes" : "no"}
                onChange={(event) => setForm((prev) => ({ ...prev, is_main: event.target.value === "yes" }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="no">No</option>
                <option value="yes">Si</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">Latitud</span>
              <input
                type="number"
                step="0.000001"
                value={form.lat}
                onChange={(event) => setForm((prev) => ({ ...prev, lat: event.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">Longitud</span>
              <input
                type="number"
                step="0.000001"
                value={form.lng}
                onChange={(event) => setForm((prev) => ({ ...prev, lng: event.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-2">
            {!GOOGLE_MAPS_API_KEY ? (
              <div className="px-2 py-3 text-xs text-amber-700">
                Configura `REACT_APP_GOOGLE_MAPS_API_KEY` para mover el pin en el mapa.
              </div>
            ) : !mapLoaded ? (
              <div className="px-2 py-3 text-xs text-slate-500">Cargando mapa...</div>
            ) : (
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "240px" }}
                center={mapCenter}
                zoom={12}
                onLoad={setMap}
                onUnmount={() => {
                  clearAdvancedMarker();
                  setMap(null);
                }}
                mapId={GOOGLE_MAPS_MAP_ID || undefined}
                options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false }}
              />
            )}
          </div>
          <p className="flex items-center gap-2 text-[11px] text-slate-500">
            <FiMapPin size={12} />
            Arrastra el pin para ajustar coordenadas manualmente.
          </p>

          {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <FiX size={12} />
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {editingId ? <FiSave size={12} /> : <FiPlus size={12} />}
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear sede"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LocationManager;
