/**
 * Request Context Middleware
 * Initializes AsyncLocalStorage context for each request
 */

const { runWithContext, getClientIp } = require('../utils/requestContext');

/**
 * Middleware that initializes request context
 * Must be registered early in the middleware stack
 */
const requestContextMiddleware = (req, res, next) => {
  // Generate correlation ID if not provided via header
  const correlationId = req.headers['x-correlation-id'] || require('crypto').randomUUID();

  // Get initial context values
  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';

  const initialContext = {
    correlationId,
    ip: clientIp,
    userAgent,
    requestId: correlationId, // Alias for compatibility
    startTime: new Date().toISOString()
  };

  // Set correlation ID header in response for tracing
  res.setHeader('x-correlation-id', correlationId);

  // Run the request within the context
  return runWithContext(initialContext, () => next());
};

module.exports = requestContextMiddleware;