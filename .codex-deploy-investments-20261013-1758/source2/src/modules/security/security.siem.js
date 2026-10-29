const fetch = require('node-fetch');
const logger = require("../../config/logger");
const { logAction } = require("../../utils/audit");
const { SECURITY_SIEM_ENABLED, SECURITY_SIEM_WEBHOOK_URL, SECURITY_SIEM_TIMEOUT_MS, SECURITY_SIEM_RETRY_MAX } = require('../../config/security');
const SECURITY_JOBS_LOG_IDENTIFIER = "public.security_jobs_log";
const TABLE_CACHE_TTL_MS = 60 * 1000;
let securityJobsLogCache = {
  checkedAt: 0,
  exists: null,
};

/**
 * SIEM Integration Module
 * Sends sanitized security events to external SIEM systems
 */

async function isSecurityJobsLogAvailable() {
  const now = Date.now();
  if (
    securityJobsLogCache.exists !== null &&
    now - securityJobsLogCache.checkedAt < TABLE_CACHE_TTL_MS
  ) {
    return securityJobsLogCache.exists;
  }

  const db = require("../../config/db");
  const result = await db.query(
    "SELECT to_regclass($1)::text AS table_name",
    [SECURITY_JOBS_LOG_IDENTIFIER]
  );

  securityJobsLogCache = {
    checkedAt: now,
    exists: Boolean(result.rows[0]?.table_name),
  };

  return securityJobsLogCache.exists;
}

/**
 * Send security event to SIEM webhook
 * @param {Object} eventData - Security event data
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} Success status
 */
async function sendToSIEM(eventData, options = {}) {
  // Check if SIEM is enabled
  if (!SECURITY_SIEM_ENABLED) {
    logger.debug('[SIEM] SIEM integration disabled, skipping event');
    return true; // Consider success when disabled
  }

  if (!SECURITY_SIEM_WEBHOOK_URL) {
    logger.warn('[SIEM] SIEM webhook URL not configured');
    return false;
  }

  const correlationId = eventData.correlation_id || 'unknown';
  const maxRetries = SECURITY_SIEM_RETRY_MAX || 2;
  const timeoutMs = SECURITY_SIEM_TIMEOUT_MS || 2500;

  // Prepare sanitized payload for SIEM
  const siemPayload = {
    event: eventData.event || 'security.offhours_login',
    correlation_id: correlationId,
    timestamp: eventData.timestamp || new Date().toISOString(),
    actor_email: eventData.actor_email,
    reason: eventData.reason,
    ip: eventData.ip_masked || eventData.ip, // Should already be masked
    user_agent: eventData.user_agent_truncated || eventData.user_agent, // Should already be truncated
    meta: {
      env: process.env.NODE_ENV || 'unknown',
      app: 'spi_fam',
      version: process.env.npm_package_version || 'unknown'
    }
  };

  let lastError = null;

  // Retry logic
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`[SIEM] Sending event to SIEM (attempt ${attempt}/${maxRetries})`, {
        correlation_id: correlationId,
        url: SECURITY_SIEM_WEBHOOK_URL.replace(/\/\/.*@/, '//***:***@'), // Mask credentials in logs
        timeout: timeoutMs
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(SECURITY_SIEM_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SPI-FAM-Security-Center/1.0'
        },
        body: JSON.stringify(siemPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        logger.info('[SIEM] Event sent to SIEM successfully', {
          correlation_id: correlationId,
          status: response.status,
          attempt: attempt
        });

        // Log success in security_jobs_log
        await logJob('siem_webhook', 'success', {
          correlation_id: correlationId,
          attempt: attempt,
          response_status: response.status
        }).catch(err => logger.warn('[SIEM] Failed to log job success:', err.message));

        return true;
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        lastError = new Error(`SIEM webhook returned ${response.status}: ${errorText}`);

        logger.warn(`[SIEM] SIEM webhook failed (attempt ${attempt}/${maxRetries})`, {
          correlation_id: correlationId,
          status: response.status,
          error: errorText
        });
      }

    } catch (err) {
      lastError = err;

      if (err.name === 'AbortError') {
        logger.warn(`[SIEM] SIEM webhook timeout (attempt ${attempt}/${maxRetries})`, {
          correlation_id: correlationId,
          timeout: timeoutMs
        });
      } else {
        logger.warn(`[SIEM] SIEM webhook error (attempt ${attempt}/${maxRetries})`, {
          correlation_id: correlationId,
          error: err.message
        });
      }
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries failed
  logger.error('[SIEM] SIEM webhook failed after all retries', {
    correlation_id: correlationId,
    maxRetries,
    lastError: lastError?.message
  });

  // Log failure in security_jobs_log
  await logJob('siem_webhook', 'failed', {
    correlation_id: correlationId,
    maxRetries,
    last_error: lastError?.message
  }).catch(err => logger.warn('[SIEM] Failed to log job failure:', err.message));

  return false;
}

/**
 * Log security job operation
 * @param {string} jobName - Name of the job
 * @param {string} status - Status (success/failed)
 * @param {Object} details - Additional details
 * @returns {Promise<void>}
 */
async function logJob(jobName, status, details = {}) {
  const db = require("../../config/db");

  try {
    if (!(await isSecurityJobsLogAvailable())) {
      logger.info('[SIEM] Tabla security_jobs_log no disponible; se omite log auxiliar');
      return;
    }

    await db.query(`
      INSERT INTO security_jobs_log (job_name, status, details, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [jobName, status, JSON.stringify(details)]);
  } catch (err) {
    logger.error('[SIEM] Failed to log security job:', err);
    throw err;
  }
}

/**
 * Send off-hours login event to SIEM
 * @param {Object} eventData - Event data with actor info
 * @returns {Promise<boolean>} Success status
 */
async function sendOffHoursLoginToSIEM(eventData) {
  return sendToSIEM({
    event: 'security.offhours_login',
    correlation_id: eventData.correlationId,
    timestamp: new Date().toISOString(),
    actor_email: eventData.user.email,
    reason: eventData.offHoursCheck.reason,
    ip: eventData.ip_masked,
    user_agent: eventData.user_agent_truncated,
    // Additional SIEM-specific data
    geo_location: eventData.geo,
    schedule: eventData.schedule,
    whitelist_hit: eventData.whitelistResult?.isWhitelisted || false
  });
}

module.exports = {
  sendToSIEM,
  sendOffHoursLoginToSIEM,
  logJob
};
