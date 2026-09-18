const crypto = require("crypto");

const normalizeText = (value, fallback = null) => {
  const text = String(value || "").trim();
  return text ? text : fallback;
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const resolveSourceChannel = (req = {}) => {
  const raw = normalizeText(
    req.headers?.["x-source-channel"] ||
      req.headers?.["source-channel"] ||
      req.body?.source_channel ||
      req.body?.sourceChannel ||
      req.query?.source_channel ||
      req.query?.sourceChannel,
    "web"
  );

  const normalized = String(raw).toLowerCase().replace(/[\s-]+/g, "_");
  const allowed = new Set(["web", "ios_shortcut", "android", "admin", "api", "scheduler", "system"]);
  return allowed.has(normalized) ? normalized : "api";
};

const getRequestContext = (req = {}, actionType = "attendance_mark") => {
  const requestId = normalizeText(req.headers?.["x-request-id"] || req.headers?.["request-id"] || req.body?.request_id);
  const correlationId = normalizeText(
    req.headers?.["x-correlation-id"] || req.headers?.["correlation-id"] || req.body?.correlation_id
  );
  const deviceId = normalizeText(req.headers?.["x-device-id"] || req.headers?.["device-id"] || req.body?.device_id);
  const sourceChannel = resolveSourceChannel(req);
  const ip = normalizeText(req.ip || req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress);
  const userAgent = normalizeText(req.headers?.["user-agent"]);
  const clientTimestamp = toIsoOrNull(req.body?.occurred_at || req.body?.occurredAt || req.body?.client_timestamp);
  const deviceTimestamp = toIsoOrNull(req.body?.device_timestamp || req.body?.deviceTimestamp);

  return {
    actionType,
    requestId,
    correlationId,
    deviceId,
    sourceChannel,
    ip,
    userAgent,
    clientTimestamp,
    deviceTimestamp,
  };
};

const computeIdempotencyHash = ({ userId, actionType, location = null, requestContext = {}, businessDate = null }) => {
  const payload = {
    userId: Number(userId || 0),
    actionType: String(actionType || "attendance_mark"),
    location: String(location || ""),
    businessDate: String(businessDate || ""),
    requestId: requestContext.requestId || "",
    correlationId: requestContext.correlationId || "",
    deviceId: requestContext.deviceId || "",
    sourceChannel: requestContext.sourceChannel || "",
    clientTimestamp: requestContext.clientTimestamp || "",
  };

  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
};

module.exports = {
  getRequestContext,
  computeIdempotencyHash,
  resolveSourceChannel,
};
