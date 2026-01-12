/**
 * backend/src/utils/normalizers.js
 * ---------------------------------
 * 📋 Shared normalization utilities for API responses
 * - Date/time normalization
 * - Numeric field normalization
 * - Safe serialization helpers
 */

/**
 * Normalize date/time values to ISO strings or null
 * Handles PostgreSQL DateTime objects, JS Date, strings, and edge cases
 */
const normalizeDateTime = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  if (typeof v === "number") return new Date(v).toISOString();

  // Handle PostgreSQL DateTime custom objects
  if (typeof v === "object") {
    if (v.toISOString && typeof v.toISOString === "function") {
      try {
        return v.toISOString();
      } catch (e) {
        console.warn("[normalizeDateTime] Error calling toISOString on object:", e);
      }
    }
    if (v.toString && typeof v.toString === "function") {
      const str = v.toString();
      if (str !== "[object Object]") {
        return str;
      }
    }
    // Last resort: avoid "[object Object]"
    console.warn("[normalizeDateTime] Unable to convert object to string:", Object.prototype.toString.call(v));
    return null;
  }
  return null;
};

/**
 * Convert string numbers to numbers, handle nulls gracefully
 */
const toNumberOrZero = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const numValue = parseFloat(v);
    return isNaN(numValue) ? 0 : numValue;
  }
  return 0;
};

/**
 * Normalize an empty object to null (handles cases where {} is returned)
 */
const normalizeEmptyObjectToNull = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && Object.keys(v).length === 0) return null;
  return v;
};

/**
 * Apply normalization to a database row with date/time fields
 */
const normalizeRow = (row, dateFields = [], numericFields = []) => {
  if (!row || typeof row !== "object") return row;

  const normalized = { ...row };

  // Normalize date/time fields
  dateFields.forEach(field => {
    if (normalized[field] !== undefined) {
      normalized[field] = normalizeDateTime(normalized[field]);
    }
  });

  // Normalize numeric fields
  numericFields.forEach(field => {
    if (normalized[field] !== undefined) {
      normalized[field] = toNumberOrZero(normalized[field]);
    }
  });

  return normalized;
};

/**
 * Normalize business case specific fields
 */
const normalizeBusinessCase = (row) => {
  const dateFields = [
    'created_at', 'updated_at', 'planned_date', 'approved_date',
    'rejected_date', 'scheduled_at', 'completed_at'
  ];
  const numericFields = ['budget', 'cost', 'profit_margin'];

  return normalizeRow(row, dateFields, numericFields);
};

/**
 * Normalize request/solicitud specific fields
 */
const normalizeRequest = (row) => {
  const dateFields = [
    'created_at', 'updated_at', 'planned_date', 'scheduled_at',
    'approved_at', 'rejected_at', 'completed_at'
  ];
  const numericFields = ['quantity', 'budget', 'estimated_cost'];

  return normalizeRow(row, dateFields, numericFields);
};

module.exports = {
  normalizeDateTime,
  toNumberOrZero,
  normalizeEmptyObjectToNull,
  normalizeRow,
  normalizeBusinessCase,
  normalizeRequest,
};