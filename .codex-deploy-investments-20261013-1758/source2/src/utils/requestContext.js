/**
 * Request Context Management with AsyncLocalStorage
 * Provides centralized correlation tracking across the entire request lifecycle
 */

const { AsyncLocalStorage } = require('async_hooks');

const requestContext = new AsyncLocalStorage();

/**
 * Run a function within a request context
 * @param {Object} initial - Initial context values
 * @param {Function} fn - Function to execute in context
 */
function runWithContext(initial, fn) {
  const store = { ...initial };
  return requestContext.run(store, fn);
}

/**
 * Get current request context
 * @returns {Object|null} Current context or null if not in context
 */
function getContext() {
  return requestContext.getStore();
}

/**
 * Update current request context with partial values
 * @param {Object} partial - Values to merge into current context
 */
function updateContext(partial) {
  const current = getContext();
  if (current) {
    Object.assign(current, partial);
  }
}

/**
 * Get client IP from request (reused logic from auth controller)
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
  runWithContext,
  getContext,
  updateContext,
  getClientIp
};