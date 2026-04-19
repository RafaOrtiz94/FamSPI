import React, { createContext, useContext, useMemo } from "react";
import { useJsApiLoader } from "@react-google-maps/api";

const GoogleMapsContext = createContext(null);

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
// Combined libraries needed across all map components:
// - 'marker': for AdvancedMarkerElement (used in ScheduleWorkspace, LocationManager, AttendanceMapView)
const REQUIRED_LIBRARIES = Object.freeze(["marker"]);

export function GoogleMapsProvider({ children }) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: REQUIRED_LIBRARIES,
    // No 'id' prop: use the default loader instance globally
  });

  const value = useMemo(() => ({ isLoaded, loadError }), [isLoaded, loadError]);

  return (
    <GoogleMapsContext.Provider value={value}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMaps() {
  const context = useContext(GoogleMapsContext);
  if (!context) {
    throw new Error("useGoogleMaps must be used within a GoogleMapsProvider");
  }
  return context;
}
