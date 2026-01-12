/**
 * API Normalization Middleware
 *
 * Normalizes API payloads to accept both canonical and legacy field names,
 * while always emitting canonical field names in responses.
 *
 * Logs usage of legacy field names for migration tracking.
 */

const logger = require('../config/logger');

// ============================================================================
// FIELD NAME MAPPINGS
// ============================================================================

// Maps legacy field names to canonical field names
const FIELD_MAPPINGS = {
  // Business Case fields
  bc_type: 'businessCaseType',
  bc_id: 'businessCaseId',
  business_case_id: 'businessCaseId',

  // Calculation fields
  calculation_mode: 'calculationMode',
  annual_quantity: 'annualQuantity',
  monthly_quantity: 'monthlyQuantity',
  annualQty: 'annualQuantity',
  monthlyQty: 'monthlyQuantity',

  // Determination fields
  detId: 'determinationId',
  determination_id: 'determinationId',

  // Equipment fields
  equipmentConfig: 'equipmentConfiguration',
  primary: 'primaryEquipment',
  backup: 'backupEquipment',
  secondary: 'secondaryEquipment',

  // Form fields
  lisIncludes: 'includesLis',
  lisIncludesHardware: 'includesLisHardware',
  requirementsDeadlineMonths: 'deadlineMonths',
  requirementsProjectedDeadlineMonths: 'projectedDeadlineMonths',
};

// ============================================================================
// LEGACY USAGE TRACKING
// ============================================================================

// In-memory tracking of legacy field usage (for development monitoring)
const legacyUsageStats = new Map();
const MAX_TRACKED_KEYS = 1000;

// Track usage of legacy field names
const trackLegacyUsage = (fieldName, endpoint, method) => {
  if (!legacyUsageStats.has(fieldName)) {
    legacyUsageStats.set(fieldName, {
      field: fieldName,
      canonical: FIELD_MAPPINGS[fieldName],
      endpoints: new Set(),
      methods: new Set(),
      usageCount: 0,
      firstSeen: new Date(),
      lastSeen: new Date()
    });
  }

  const stat = legacyUsageStats.get(fieldName);
  stat.endpoints.add(endpoint);
  stat.methods.add(method);
  stat.usageCount++;
  stat.lastSeen = new Date();

  // Log legacy usage in development
  if (process.env.NODE_ENV === 'development') {
    logger.debug({
      legacyField: fieldName,
      canonicalField: stat.canonical,
      endpoint,
      method,
      usageCount: stat.usageCount
    }, 'Legacy field usage detected');
  }

  // Prevent memory leaks in production
  if (legacyUsageStats.size > MAX_TRACKED_KEYS) {
    // Remove oldest entries (simple cleanup)
    const entries = Array.from(legacyUsageStats.entries());
    entries.sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    const toRemove = entries.slice(0, 100);
    toRemove.forEach(([key]) => legacyUsageStats.delete(key));
  }
};

// Get legacy usage statistics
const getLegacyUsageStats = () => {
  return Array.from(legacyUsageStats.values()).map(stat => ({
    ...stat,
    endpoints: Array.from(stat.endpoints),
    methods: Array.from(stat.methods)
  }));
};

// ============================================================================
// INPUT NORMALIZATION (Accept both legacy and canonical)
// ============================================================================

/**
 * Recursively normalizes request data to canonical field names
 * @param {any} data - Request data (object, array, or primitive)
 * @param {string} endpoint - API endpoint path
 * @param {string} method - HTTP method
 * @returns {any} - Normalized data with canonical field names
 */
const normalizeInputData = (data, endpoint = '', method = '') => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => normalizeInputData(item, endpoint, method));
  }

  const normalized = {};

  for (const [key, value] of Object.entries(data)) {
    let canonicalKey = key;

    // Check if this is a legacy field name
    if (FIELD_MAPPINGS[key]) {
      canonicalKey = FIELD_MAPPINGS[key];
      trackLegacyUsage(key, endpoint, method);

      // Warn if both legacy and canonical versions are present
      if (data[canonicalKey] !== undefined) {
        logger.warn({
          legacyField: key,
          canonicalField: canonicalKey,
          endpoint,
          method
        }, 'Both legacy and canonical field names present in request');
      }
    }

    // Recursively normalize nested objects/arrays
    normalized[canonicalKey] = normalizeInputData(value, endpoint, method);
  }

  return normalized;
};

/**
 * Normalizes URL parameters
 * @param {Object} params - URL parameters
 * @param {string} endpoint - API endpoint path
 * @param {string} method - HTTP method
 * @returns {Object} - Normalized parameters
 */
const normalizeParams = (params, endpoint, method) => {
  if (!params || typeof params !== 'object') {
    return params;
  }

  const normalized = {};

  for (const [key, value] of Object.entries(params)) {
    const canonicalKey = FIELD_MAPPINGS[key] || key;
    if (FIELD_MAPPINGS[key]) {
      trackLegacyUsage(key, endpoint, method);
    }
    normalized[canonicalKey] = value;
  }

  return normalized;
};

// ============================================================================
// OUTPUT CANONICALIZATION (Always emit canonical names)
// ============================================================================

/**
 * Ensures response data uses canonical field names
 * @param {any} data - Response data
 * @returns {any} - Response data with canonical field names
 */
const canonicalizeOutputData = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => canonicalizeOutputData(item));
  }

  const canonicalized = {};

  for (const [key, value] of Object.entries(data)) {
    // Always use canonical field names in output
    const canonicalKey = FIELD_MAPPINGS[key] || key;
    canonicalized[canonicalKey] = canonicalizeOutputData(value);
  }

  return canonicalized;
};

// ============================================================================
// MIDDLEWARE FUNCTIONS
// ============================================================================

/**
 * Express middleware for API payload normalization
 */
const normalizeApiPayloads = (req, res, next) => {
  const endpoint = req.originalUrl || req.url;
  const method = req.method;

  try {
    // Normalize request body
    if (req.body && typeof req.body === 'object') {
      req.body = normalizeInputData(req.body, endpoint, method);
    }

    // Normalize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = normalizeInputData(req.query, endpoint, method);
    }

    // Normalize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = normalizeParams(req.params, endpoint, method);
    }

    // Store original response.json method
    const originalJson = res.json;

    // Override response.json to canonicalize output
    res.json = function(data) {
      const canonicalizedData = canonicalizeOutputData(data);
      return originalJson.call(this, canonicalizedData);
    };

    next();
  } catch (error) {
    logger.error({
      error: error.message,
      endpoint,
      method,
      stack: error.stack
    }, 'Error in API normalization middleware');

    // Continue with original data if normalization fails
    next();
  }
};

/**
 * Middleware to log legacy field usage statistics
 */
const logLegacyUsageStats = (req, res, next) => {
  // Log stats every 100 requests in development
  if (process.env.NODE_ENV === 'development' && Math.random() < 0.01) {
    const stats = getLegacyUsageStats();
    if (stats.length > 0) {
      logger.info({
        totalLegacyFields: stats.length,
        topLegacyFields: stats
          .sort((a, b) => b.usageCount - a.usageCount)
          .slice(0, 5)
          .map(s => ({
            field: s.field,
            canonical: s.canonical,
            usageCount: s.usageCount,
            endpoints: s.endpoints.length
          }))
      }, 'Legacy field usage statistics');
    }
  }

  next();
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a field name is legacy
 * @param {string} fieldName - Field name to check
 * @returns {boolean} - True if field name is legacy
 */
const isLegacyField = (fieldName) => {
  return FIELD_MAPPINGS.hasOwnProperty(fieldName);
};

/**
 * Get canonical field name for a given field
 * @param {string} fieldName - Field name (legacy or canonical)
 * @returns {string} - Canonical field name
 */
const getCanonicalFieldName = (fieldName) => {
  return FIELD_MAPPINGS[fieldName] || fieldName;
};

/**
 * Get legacy field name for a canonical field
 * @param {string} canonicalName - Canonical field name
 * @returns {string|null} - Legacy field name or null if not found
 */
const getLegacyFieldName = (canonicalName) => {
  const entry = Object.entries(FIELD_MAPPINGS).find(([legacy, canonical]) => canonical === canonicalName);
  return entry ? entry[0] : null;
};

/**
 * Validate that normalization works correctly
 * @param {Object} original - Original data with legacy names
 * @param {Object} expectedCanonical - Expected canonical result
 * @returns {boolean} - True if normalization works correctly
 */
const validateNormalization = (original, expectedCanonical) => {
  try {
    const normalized = normalizeInputData(original);
    const canonicalized = canonicalizeOutputData(normalized);
    return JSON.stringify(canonicalized) === JSON.stringify(expectedCanonical);
  } catch (error) {
    logger.error({ error: error.message }, 'Normalization validation failed');
    return false;
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  normalizeApiPayloads,
  logLegacyUsageStats,
  normalizeInputData,
  canonicalizeOutputData,
  normalizeParams,
  trackLegacyUsage,
  getLegacyUsageStats,
  isLegacyField,
  getCanonicalFieldName,
  getLegacyFieldName,
  validateNormalization,
  FIELD_MAPPINGS
};
