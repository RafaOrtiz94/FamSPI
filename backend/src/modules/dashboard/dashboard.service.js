/**
 * ============================================================
 * 🎯 Service: Dashboard (Paneles de Control)
 * ------------------------------------------------------------
 * Proporciona métricas y resúmenes para dashboards por rol.
 * Optimizado para consultas eficientes y cache potencial.
 * ============================================================
 */

const { pool } = require("../../config/db");
const logger = require("../../config/logger");

/**
 * 🔍 Clasifica errores PostgreSQL para determinar el tipo de respuesta HTTP apropiada
 * @param {Error} err - Error de PostgreSQL
 * @returns {Object} { type: 'SCHEMA_MISSING'|'DB_ERROR', statusCode: 500|503, message: string }
 */
function classifyPgError(err) {
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
}

// Cache in-memory simple para performance
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 60 segundos

function getCachedData(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    cache.delete(key); // Eliminar cache expirado
    return null;
}

function setCachedData(key, data) {
    cache.set(key, {
        data,
        timestamp: Date.now()
    });
}

/**
 * 📊 Obtener resumen para dashboard comercial
 */
// Mapping de estados basado en datos reales de la DB
const STATE_MAPPINGS = {
    // Business Case states (basado en current_stage)
    bc: {
        active: ['draft', 'waiting_proforma', 'new'], // Estados considerados activos
        completed: ['completed', 'approved'], // Estados considerados completados
    },
    // Request states (basado en status)
    requests: {
        pending: ['pendiente'], // Estados considerados pendientes
    }
};

async function getCommercialSummary(options = {}) {
    const { fresh = false } = options; // Para bypass cache manual
    const cacheKey = 'commercial_summary';

    // Intentar obtener datos del cache (a menos que se pida fresh)
    if (!fresh) {
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
            // Agregar metadata de cache para hit
            cachedData._metadata.cache = {
                hit: true,
                bypassed: false,
                ttlSeconds: CACHE_TTL / 1000
            };
            logger.info("📊 Dashboard comercial: datos servidos desde cache");
            return cachedData;
        }
    }

    const client = await pool.connect();

    try {
        // Ejecutar todas las consultas en paralelo para mejor performance
        // ⚠️ IMPORTANTE: NO usar .catch() aquí - los errores de schema deben propagarse
        // para que el controller pueda devolver el código HTTP apropiado (500 vs 503)
        const [
            bcStatusResult,
            requestsStatusResult,
            newClientsResult,
            monthlyTrendResult,
        ] = await Promise.all([
            // KPI: Business Case por estado (usando vista si existe, sino tabla directa)
            client.query(`
                SELECT current_stage as status, COUNT(*) as total
                FROM bc_master
                GROUP BY current_stage
                ORDER BY total DESC
                LIMIT 10
            `),

            // KPI: Solicitudes por estado
            client.query(`
                SELECT status, COUNT(*) as total
                FROM requests
                GROUP BY status
                ORDER BY total DESC
                LIMIT 10
            `),

            // KPI: Clientes nuevos últimos 30 días
            client.query(`
                SELECT COUNT(*) as nuevos_30d
                FROM clients
                WHERE created_at >= NOW() - INTERVAL '30 days'
            `),

            // KPI: Tendencia mensual (últimos 6 meses) de solicitudes
            client.query(`
                SELECT
                  to_char(date_trunc('month', created_at), 'YYYY-MM') as mes,
                  COUNT(*) as total
                FROM requests
                WHERE created_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
                GROUP BY 1
                ORDER BY 1
                LIMIT 6
            `),
        ]);

        // Calcular métricas agregadas con mappings reales
        const totalBC = bcStatusResult.rows.reduce((sum, row) => sum + parseInt(row.total), 0);
        const bcActivos = bcStatusResult.rows
            .filter(r => STATE_MAPPINGS.bc.active.includes(r.status))
            .reduce((sum, row) => sum + parseInt(row.total), 0);
        const bcCompletados = bcStatusResult.rows
            .filter(r => STATE_MAPPINGS.bc.completed.includes(r.status))
            .reduce((sum, row) => sum + parseInt(row.total), 0);

        const solicitudesPendientes = requestsStatusResult.rows
            .filter(r => STATE_MAPPINGS.requests.pending.includes(r.status))
            .reduce((sum, row) => sum + parseInt(row.total), 0);

        const clientesNuevos30d = parseInt(newClientsResult.rows[0]?.nuevos_30d || 0);

        // Normalizar labels para charts (máximo 8 items, agrupar resto en "Otros")
        const normalizeChartData = (rows, maxItems = 8) => {
            if (rows.length <= maxItems) {
                return {
                    labels: rows.map(r => r.status || r.mes),
                    data: rows.map(r => parseInt(r.total)),
                    hasData: rows.length > 0
                };
            }

            const topItems = rows.slice(0, maxItems - 1);
            const otherTotal = rows.slice(maxItems - 1).reduce((sum, row) => sum + parseInt(row.total), 0);

            return {
                labels: [...topItems.map(r => r.status || r.mes), 'Otros'],
                data: [...topItems.map(r => parseInt(r.total)), otherTotal],
                hasData: true
            };
        };

        // Preparar payload final con datos normalizados
        const payload = {
            kpis: {
                totalBC,
                bcActivos,
                bcCompletados,
                solicitudesPendientes,
                clientesNuevos30d,
            },
            charts: {
                bcStatus: normalizeChartData(bcStatusResult.rows),
                requestsMonthly: {
                    ...normalizeChartData(monthlyTrendResult.rows.map(r => ({ status: r.mes, total: r.total }))),
                    labels: monthlyTrendResult.rows.map(r => r.mes),
                    data: monthlyTrendResult.rows.map(r => parseInt(r.total)),
                },
            },
            // Metadata para debugging/transparencia
            _metadata: {
                stateMappings: STATE_MAPPINGS,
                dataSources: {
                    bcMaster: bcStatusResult.rows.length,
                    requests: requestsStatusResult.rows.length,
                    clients: clientesNuevos30d,
                    monthlyTrend: monthlyTrendResult.rows.length
                }
            }
        };

        // Cachear el resultado para futuras consultas
        setCachedData(cacheKey, payload);

        // Agregar metadata de cache (no sensible)
        payload._metadata.cache = {
            hit: false, // Esta es la primera carga, no hit
            bypassed: fresh,
            ttlSeconds: CACHE_TTL / 1000
        };

        logger.info("📊 Dashboard comercial summary generado correctamente", {
            totalBC,
            bcActivos,
            solicitudesPendientes
        });
        return payload;

    } catch (error) {
        logger.error("❌ Error obteniendo summary comercial:", error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    getCommercialSummary,
};