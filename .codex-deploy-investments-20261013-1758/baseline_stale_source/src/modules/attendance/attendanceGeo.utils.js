const normalizeCoordinateString = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, "");

const parseCoordinatePair = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const latObj = Number(value.lat);
    const lngObj = Number(value.lng);
    if (Number.isFinite(latObj) && Number.isFinite(lngObj) && latObj >= -90 && latObj <= 90 && lngObj >= -180 && lngObj <= 180) {
      return { lat: latObj, lng: lngObj };
    }
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsedJson = JSON.parse(trimmed);
        const latJson = Number(parsedJson?.lat);
        const lngJson = Number(parsedJson?.lng);
        if (Number.isFinite(latJson) && Number.isFinite(lngJson) && latJson >= -90 && latJson <= 90 && lngJson >= -180 && lngJson <= 180) {
          return { lat: latJson, lng: lngJson };
        }
      } catch (_error) {
        // Falls back to comma-separated parser
      }
    }
  }

  const normalized = normalizeCoordinateString(value);
  if (!normalized || !normalized.includes(",")) return null;

  const [latRaw, lngRaw] = normalized.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  return { lat, lng };
};

module.exports = {
  normalizeCoordinateString,
  parseCoordinatePair,
};
