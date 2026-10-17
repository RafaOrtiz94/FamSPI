/**
 * GeoIP utilities using geoip-lite for offline IP geolocation
 * Best-effort location detection for security auditing
 */

const logger = require('../config/logger');

// Lazy load geoip-lite to avoid issues if not installed
let geoip;
try {
  geoip = require('geoip-lite');
} catch (error) {
  logger.warn("geoip-lite not available, location detection disabled");
  geoip = null;
}

/**
 * Get geo location information for an IP address
 * @param {string} ip - IP address to lookup
 * @returns {Object} Location information or unresolved status
 */
function getGeoLocation(ip) {
  if (!geoip || !ip) {
    return { status: 'unresolved', ip };
  }

  try {
    const geo = geoip.lookup(ip);
    if (!geo) {
      return { status: 'not_found', ip };
    }

    return {
      status: 'resolved',
      ip,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      ll: geo.ll, // [latitude, longitude]
      timezone: geo.timezone,
      source: 'geoip-lite'
    };

  } catch (error) {
    logger.error({ error, ip }, "Error in geoip lookup");
    return { status: 'error', ip, error: error.message };
  }
}

/**
 * Get client IP from Express request (reused from auth middleware)
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
         req.headers["cf-connecting-ip"] ||
         req.headers["x-real-ip"] ||
         req.socket?.remoteAddress ||
         req.connection?.remoteAddress ||
         req.ip ||
         "unknown";
}

module.exports = {
  getGeoLocation,
  getClientIp
};