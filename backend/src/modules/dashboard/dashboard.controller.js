/**
 * ============================================================
 * 🎯 Controller: Dashboard (Paneles de Control)
 * ------------------------------------------------------------
 * Maneja requests para métricas y resúmenes de dashboards.
 * Endpoints protegidos con autenticación y autorización por rol.
 * ============================================================
 */

const service = require("./dashboard.service");
const { logAction } = require("../../utils/audit");
const logger = require("../../config/logger");

// Helper para clasificar errores PostgreSQL
const classifyPgError = (err) => {
    if (!err || !err.code) {
        return {
            type: 'DB_ERROR',
            statusCode: 503,
            message: 'Database error',
            code: 'DB_ERROR'
        };
    }

    // Errores de schema missing (tablas/columnas no existen)
    if (err.code === '42P01') { // undefined_table
        return {
            type: 'SCHEMA_MISSING',
            statusCode: 500,
            message: `Table does not exist: ${err.table || 'unknown'}`,
            code: 'SCHEMA_MISSING',
            details: { errorCode: err.code, table: err.table }
        };
    }

    if (err.code === '42703') { // undefined_column
        return {
            type: 'SCHEMA_MISSING',
            statusCode: 500,
            message: `Column does not exist: ${err.column || 'unknown'}`,
            code: 'SCHEMA_MISSING',
            details: { errorCode: err.code, column: err.column }
        };
    }

    // Otros errores de conexión/DB (connection lost, timeout, etc.)
    return {
        type: 'DB_ERROR',
        statusCode: 503,
        message: 'Database unavailable',
        code: 'DB_ERROR',
        details: { errorCode: err.code, message: err.message }
    };
};

// ============================================================
// 📊 Obtener resumen para dashboard comercial
// ============================================================
exports.getCommercialSummary = async (req, res) => {
    try {
        // Soporte para bypass cache con query param ?fresh=1
        const fresh = req.query.fresh === '1' || req.query.fresh === 'true';

        const summary = await service.getCommercialSummary({ fresh });

        await logAction({
            user_id: req.user?.id || null,
            module: "dashboard",
            action: "get_commercial_summary",
            entity: "dashboard_commercial",
            details: { summary_keys: Object.keys(summary) },
        });

        res.json({
            ok: true,
            message: "Resumen del dashboard comercial obtenido correctamente",
            data: summary,
        });

    } catch (error) {
        // Clasificar el error PostgreSQL
        const errorInfo = classifyPgError(error);

        logger.error({
            error: error.message,
            errorCode: error.code,
            errorType: errorInfo.type,
            user: req.user?.email,
            path: req.originalUrl
        }, `Dashboard error: ${errorInfo.message}`);

        // Responder con el código HTTP apropiado
        res.status(errorInfo.statusCode).json({
            ok: false,
            code: errorInfo.code,
            message: errorInfo.message,
            ...(errorInfo.details && { details: errorInfo.details })
        });
    }
};

module.exports = exports;
