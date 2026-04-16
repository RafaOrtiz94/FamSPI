const normalizeCoordinateString = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, "");

const parseCoordinatePair = (value) => {
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
