/**
 * Middleware: Legacy Write Guard
 *
 * Prevents direct writes to legacy tables when V2 unification is enabled.
 * All purchase-related writes must go through the facade.
 */

const logger = require("../config/logger");
const { logAction } = require("../utils/audit");

const V2_ENABLED = process.env.REQUESTS_UNIFICATION_V2 === 'true';

// Legacy tables that should not be written to directly when V2 is enabled
const LEGACY_WRITE_BLOCKED_TABLES = [
    'equipment_purchase_requests',
    'equipment_purchases' // if it exists
];

/**
 * Middleware to block legacy writes when V2 is enabled
 */
function blockLegacyWrites(req, res, next) {
    if (!V2_ENABLED) {
        return next();
    }

    // This middleware is applied at the service level, but we can detect
    // legacy write attempts by monitoring specific routes or adding markers

    // For now, just log that V2 is enabled
    if (req.path && req.path.includes('/equipment-purchases')) {
        logger.warn('Legacy equipment-purchases endpoint called while V2 is enabled', {
            path: req.path,
            method: req.method,
            userId: req.user?.id,
            v2_enabled: true
        });
    }

    next();
}

/**
 * Function to check if a legacy write is blocked
 */
function isLegacyWriteBlocked(tableName, operation = 'write') {
    if (!V2_ENABLED) {
        return false;
    }

    if (LEGACY_WRITE_BLOCKED_TABLES.includes(tableName)) {
        logger.warn(`Legacy write blocked: ${operation} on ${tableName}`, {
            table: tableName,
            operation,
            v2_enabled: true,
            blocked: true
        });

        // Log for monitoring
        logAction({
            module: 'legacy_write_guard',
            action: 'write_blocked',
            entity: tableName,
            details: {
                operation,
                reason: 'V2_UNIFICATION_ENABLED'
            }
        });

        return true;
    }

    return false;
}

/**
 * Error for blocked legacy writes
 */
function createLegacyWriteBlockedError(tableName, operation = 'write') {
    const error = new Error(
        `Legacy write blocked: ${operation} on ${tableName} is not allowed when REQUESTS_UNIFICATION_V2=true. Use purchaseRequestsFacade instead.`
    );
    error.status = 403;
    error.code = 'LEGACY_WRITE_BLOCKED';
    error.details = {
        table: tableName,
        operation,
        reason: 'V2_UNIFICATION_ENABLED',
        suggestion: 'Use purchaseRequestsFacade for all purchase operations'
    };
    return error;
}

/**
 * Safe legacy write wrapper - only allows writes when V2 is disabled
 */
async function safeLegacyWrite(tableName, operation, writeFunction) {
    if (isLegacyWriteBlocked(tableName, operation)) {
        throw createLegacyWriteBlockedError(tableName, operation);
    }

    try {
        const result = await writeFunction();

        // Log successful legacy writes for monitoring (when V2 is disabled)
        if (!V2_ENABLED) {
            logAction({
                module: 'legacy_write_guard',
                action: 'legacy_write_success',
                entity: tableName,
                details: {
                    operation,
                    result_count: Array.isArray(result) ? result.length : 1
                }
            });
        }

        return result;
    } catch (error) {
        // Log failed legacy writes
        logAction({
            module: 'legacy_write_guard',
            action: 'legacy_write_failed',
            entity: tableName,
            details: {
                operation,
                error: error.message
            }
        });
        throw error;
    }
}

module.exports = {
    blockLegacyWrites,
    isLegacyWriteBlocked,
    createLegacyWriteBlockedError,
    safeLegacyWrite,
    LEGACY_WRITE_BLOCKED_TABLES
};