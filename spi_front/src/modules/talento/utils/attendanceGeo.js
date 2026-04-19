export const parseCoordinatePair = (coordinateString) => {
  if (!coordinateString || typeof coordinateString !== "string") {
    return null;
  }
  const parts = coordinateString.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
    return null;
  }
  const [lat, lng] = parts;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
};

export const isValidCoordinate = (coord) => {
  if (!coord || typeof coord.lat !== "number" || typeof coord.lng !== "number") {
    return false;
  }
  return coord.lat >= -90 && coord.lat <= 90 && coord.lng >= -180 && coord.lng <= 180;
};

export const calculateCenter = (coordinates = []) => {
  const validCoords = coordinates.filter(isValidCoordinate);
  if (validCoords.length === 0) {
    return { lat: -2.1898489, lng: -79.8894089 };
  }
  if (validCoords.length === 1) {
    return validCoords[0];
  }
  const sumLat = validCoords.reduce((acc, c) => acc + c.lat, 0);
  const sumLng = validCoords.reduce((acc, c) => acc + c.lng, 0);
  return {
    lat: sumLat / validCoords.length,
    lng: sumLng / validCoords.length,
  };
};

export const calculateBounds = (coordinates = []) => {
  const validCoords = coordinates.filter(isValidCoordinate);
  if (validCoords.length === 0) {
    return null;
  }
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  validCoords.forEach(({ lat, lng }) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  });
  return {
    north: maxLat,
    south: minLat,
    east: maxLng,
    west: minLng,
  };
};

const JITTER_RADIUS = 0.00015;

export const applyJitter = (coord, index, total) => {
  if (!isValidCoordinate(coord)) {
    return coord;
  }
  if (total <= 1) {
    return coord;
  }
  const angle = (index / total) * Math.PI * 2;
  const jitterFactor = JITTER_RADIUS * Math.sqrt(index + 1);
  return {
    lat: coord.lat + Math.sin(angle) * jitterFactor,
    lng: coord.lng + Math.cos(angle) * jitterFactor,
  };
};

export const transformToMarkers = (rows = [], getGeoPoints = (row) => []) => {
  const markers = [];
  rows.forEach((row, rowIndex) => {
    const geoPoints = getGeoPoints(row);
    geoPoints.forEach((point, ptIndex) => {
      const coord =
        (Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng))
          ? { lat: Number(point.lat), lng: Number(point.lng) }
          : parseCoordinatePair(point?.coord));
      if (coord) {
        markers.push({
          id: `${row.id}-${row.date}-${ptIndex}`,
          userId: row.user_id,
          date: row.date,
          label: point.label || point.type,
          type: point.type,
          hour: point.hour || point.time || null,
          coord: applyJitter(coord, rowIndex * 10 + ptIndex, rows.length * 3),
          fullname: row.fullname,
        });
      }
    });
  });
  return markers;
};

export const getMarkerColor = (type) => {
  const colors = {
    entry: "#22c55e",
    lunch_start: "#eab308",
    lunch_end: "#eab308",
    exit: "#ef4444",
    start: "#f97316",
    return: "#3b82f6",
    office_exit: "#f97316",
    office_entry: "#3b82f6",
    arrival: "#8b5cf6",
    departure: "#ec4899",
    client_entry: "#8b5cf6",
    client_exit: "#ec4899",
  };
  return colors[type] || "#6b7280";
};
