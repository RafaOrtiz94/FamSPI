const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { runOnce: runMantenimiento } = require('../modules/mantenimientos/mantenimiento.scheduler');
const { runOnce: runExpiredReservations } = require('../jobs/checkExpiredReservations');
const { runOnce: processAttendanceOvertime } = require('../jobs/attendanceOvertimeScheduler');
const { runOnce: runContractReminderEmails } = require('../jobs/equipmentContractReminderEmails');
const { runOnce: runNotificationDispatchQueue } = require('../jobs/processNotificationDispatchQueue');
const { runOnce: runBusinessCasePreflowExpiry } = require('../jobs/businessCasePreflowExpiryScheduler');
const { runOnce: runBusinessCaseDeterminationsGateExpiry } = require('../jobs/businessCaseDeterminationsGateExpiryScheduler');
const { runOnce: runBusinessCaseSheetQueue } = require('../jobs/businessCaseSheetGenerationQueueScheduler');
const { runOnce: runDatabaseBackupToDrive } = require('../jobs/databaseBackupToDrive');
const { runOnce: runPermisosPendingExpiry } = require('../jobs/permisosPendingExpiryScheduler');
const { runOnce: runPermisosRecoveryCoordinationExpiry } = require('../jobs/permisosRecoveryCoordinationExpiryScheduler');
const { runOnce: runExternalCaseSyncQueue } = require('../jobs/externalCaseSyncScheduler');
const permisosService = require('../modules/permisos/permisos.service');

const jobsAuth = require('../middlewares/jobsAuth');

// Todos los endpoints de jobs usan autenticación por JOBS_KEY
router.use(jobsAuth);

// Endpoint para mantenimiento reminders
router.post('/mantenimiento/reminders', async (req, res) => {
    try {
        await runMantenimiento();
        res.json({ success: true, message: 'Recordatorios de mantenimiento procesados' });
    } catch (error) {
        console.error('Error en job de mantenimiento:', error);
        res.status(500).json({ error: 'Falló el procesamiento de recordatorios' });
    }
});

// Endpoint para reservas expiradas
router.post('/equipment/reservations/expired', async (req, res) => {
    try {
        await runExpiredReservations();
        res.json({ success: true, message: 'Reservas expiradas procesadas' });
    } catch (error) {
        console.error('Error en job de reservas expiradas:', error);
        res.status(500).json({ error: 'Falló el procesamiento de reservas' });
    }
});

// Endpoint para recordatorios de contrato (110 dias, aviso a 15 dias)
router.post('/equipment/contracts/reminders', async (req, res) => {
    try {
        const result = await runContractReminderEmails();
        res.json({ success: true, message: 'Recordatorios de contrato procesados', data: result });
    } catch (error) {
        console.error('Error en job de recordatorios de contrato:', error);
        res.status(500).json({ error: 'Fallo el procesamiento de recordatorios de contrato' });
    }
});

// Endpoint para attendance overtime processing
router.post('/attendance/overtime', async (req, res) => {
    try {
        const result = await processAttendanceOvertime();
        res.json({ 
            success: true, 
            message: 'Procesamiento de overtime completado',
            data: result
        });
    } catch (error) {
        console.error('Error en job de attendance overtime:', error);
        res.status(500).json({ 
            error: 'Falló el procesamiento de overtime',
            details: error.message
        });
    }
});

// Endpoint para procesar cola asincrona de notificaciones (email/chat)
router.post('/notifications/dispatch', async (req, res) => {
    try {
        const result = await runNotificationDispatchQueue();
        res.json({
            success: true,
            message: 'Cola de notificaciones procesada',
            data: result
        });
    } catch (error) {
        console.error('Error en job de cola de notificaciones:', error);
        res.status(500).json({
            error: 'Falló el procesamiento de cola de notificaciones',
            details: error.message
        });
    }
});

router.post('/business-case/preflow/expiry', async (_req, res) => {
    try {
        const result = await runBusinessCasePreflowExpiry();
        res.json({
            success: true,
            message: 'Expiraciones de preflujo de Business Case procesadas',
            data: result
        });
    } catch (error) {
        console.error('Error en job de expiracion preflujo BC:', error);
        res.status(500).json({
            error: 'Fallo el procesamiento de expiracion preflujo BC',
            details: error.message
        });
    }
});

router.post('/business-case/determinations-gate/expiry', async (_req, res) => {
    try {
        const result = await runBusinessCaseDeterminationsGateExpiry();
        res.json({
            success: true,
            message: 'Expiraciones de ventana de determinaciones procesadas',
            data: result
        });
    } catch (error) {
        console.error('Error en job de expiracion determinaciones:', error);
        res.status(500).json({
            error: 'Fallo el procesamiento de expiracion de determinaciones',
            details: error.message
        });
    }
});

router.post('/permisos/recovery/expiry', async (_req, res) => {
    try {
        const result = await runPermisosRecoveryCoordinationExpiry();
        res.json({
            success: true,
            message: 'Expiraciones de coordinacion de recuperacion procesadas',
            data: result
        });
    } catch (error) {
        console.error('Error en job de expiracion de coordinacion de recuperacion:', error);
        res.status(500).json({
            error: 'Fallo el procesamiento de expiracion de coordinacion de recuperacion',
            details: error.message
        });
    }
});

router.post('/attendance/geo-sanitize', async (req, res) => {
    const apply = String(req.body?.apply ?? req.query?.apply ?? 'true').toLowerCase() === 'true';
    const timezone = String(process.env.APP_TIMEZONE || process.env.TZ || 'America/Guayaquil');
    const cutoffDate = String(req.body?.cutoffDate || req.query?.cutoffDate || '').trim();

    const textTargets = [
        ['user_attendance_records', 'entry_location', 'date'],
        ['user_attendance_records', 'lunch_start_location', 'date'],
        ['user_attendance_records', 'lunch_end_location', 'date'],
        ['user_attendance_records', 'exit_location', 'date'],
        ['attendance_exceptions', 'start_location', 'date'],
        ['attendance_exceptions', 'arrival_location', 'date'],
        ['attendance_exceptions', 'departure_location', 'date'],
        ['attendance_exceptions', 'return_location', 'date'],
    ];

    const numericTargets = [
        ['client_visit_logs', 'lat_entrada', 'lng_entrada', 'visit_date'],
        ['client_visit_logs', 'lat_salida', 'lng_salida', 'visit_date'],
        ['prospect_visits', 'check_in_lat', 'check_in_lng', 'visit_date'],
        ['prospect_visits', 'check_out_lat', 'check_out_lng', 'visit_date'],
    ];

    const isValidIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(cutoffDate);
    let cutoff = cutoffDate;

    try {
        if (!isValidIsoDate) {
            const cutoffResult = await db.query(
                `SELECT ((NOW() AT TIME ZONE $1)::date - INTERVAL '2 day')::date AS cutoff`,
                [timezone]
            );
            cutoff = cutoffResult.rows?.[0]?.cutoff;
        }

        await db.query('BEGIN');
        const report = { apply, timezone, cutoff, textTargets: [], numericTargets: [] };

        for (const [table, column, dateColumn] of textTargets) {
            const countSql = `
                WITH parsed AS (
                    SELECT id, regexp_match(
                        btrim(${column}),
                        '^([+-]?\\d+(?:\\.\\d+)?)\\s*,\\s*([+-]?\\d+(?:\\.\\d+)?)$'
                    ) AS m
                    FROM ${table}
                    WHERE ${dateColumn} <= $1::date
                      AND ${column} IS NOT NULL
                      AND btrim(${column}) <> ''
                )
                SELECT COUNT(*)::int AS total
                FROM parsed
                WHERE m IS NULL
                   OR abs((m)[1]::double precision) > 90
                   OR abs((m)[2]::double precision) > 180
                   OR (abs((m)[1]::double precision) <= 0.0005 AND abs((m)[2]::double precision) <= 0.0005)
            `;
            const before = await db.query(countSql, [cutoff]);
            const invalidCount = Number(before.rows?.[0]?.total || 0);
            let updated = 0;

            if (apply && invalidCount > 0) {
                const updateSql = `
                    WITH invalid_rows AS (
                        SELECT id
                        FROM (
                            SELECT id, regexp_match(
                                btrim(${column}),
                                '^([+-]?\\d+(?:\\.\\d+)?)\\s*,\\s*([+-]?\\d+(?:\\.\\d+)?)$'
                            ) AS m
                            FROM ${table}
                            WHERE ${dateColumn} <= $1::date
                              AND ${column} IS NOT NULL
                              AND btrim(${column}) <> ''
                        ) s
                        WHERE m IS NULL
                           OR abs((m)[1]::double precision) > 90
                           OR abs((m)[2]::double precision) > 180
                           OR (abs((m)[1]::double precision) <= 0.0005 AND abs((m)[2]::double precision) <= 0.0005)
                    )
                    UPDATE ${table} t
                    SET ${column} = NULL, updated_at = NOW()
                    FROM invalid_rows i
                    WHERE t.id = i.id
                `;
                const updateResult = await db.query(updateSql, [cutoff]);
                updated = updateResult.rowCount || 0;
            }

            report.textTargets.push({ table, column, invalidCount, updated });
        }

        for (const [table, lat, lng, dateColumn] of numericTargets) {
            const countResult = await db.query(
                `
                SELECT COUNT(*)::int AS total
                FROM ${table}
                WHERE ${dateColumn} <= $1::date
                  AND ${lat} IS NOT NULL
                  AND ${lng} IS NOT NULL
                  AND (
                    abs(${lat}) > 90
                    OR abs(${lng}) > 180
                    OR (abs(${lat}) <= 0.0005 AND abs(${lng}) <= 0.0005)
                  )
                `,
                [cutoff]
            );
            const invalidCount = Number(countResult.rows?.[0]?.total || 0);
            let updated = 0;

            if (apply && invalidCount > 0) {
                const updateResult = await db.query(
                    `
                    UPDATE ${table}
                    SET ${lat} = NULL, ${lng} = NULL, updated_at = NOW()
                    WHERE ${dateColumn} <= $1::date
                      AND ${lat} IS NOT NULL
                      AND ${lng} IS NOT NULL
                      AND (
                        abs(${lat}) > 90
                        OR abs(${lng}) > 180
                        OR (abs(${lat}) <= 0.0005 AND abs(${lng}) <= 0.0005)
                      )
                    `,
                    [cutoff]
                );
                updated = updateResult.rowCount || 0;
            }

            report.numericTargets.push({ table, lat, lng, invalidCount, updated });
        }

        if (apply) {
            await db.query('COMMIT');
        } else {
            await db.query('ROLLBACK');
        }

        return res.json({
            success: true,
            message: apply ? 'Saneamiento geo aplicado' : 'Saneamiento geo simulado (dry-run)',
            data: report,
        });
    } catch (error) {
        await db.query('ROLLBACK').catch(() => null);
        console.error('Error en job de saneamiento geo de asistencia:', error);
        return res.status(500).json({
            error: 'Falló el saneamiento geo de asistencia',
            details: error.message,
        });
    }
});

router.post('/permisos/pending/expiry', async (_req, res) => {
    try {
        const result = await runPermisosPendingExpiry();
        res.json({
            success: true,
            message: 'Expiraciones de solicitudes pendientes procesadas',
            data: result
        });
    } catch (error) {
        console.error('Error en job de expiracion de solicitudes pendientes:', error);
        res.status(500).json({
            error: 'Fallo el procesamiento de expiracion de solicitudes pendientes',
            details: error.message
        });
    }
});

router.post('/permisos/calendar/recreate', async (req, res) => {
    try {
        const rawSolicitudId =
            req.body?.solicitudId ??
            req.body?.id ??
            req.query?.solicitudId ??
            req.query?.id;
        const solicitudId = Number(rawSolicitudId);
        if (!Number.isInteger(solicitudId) || solicitudId <= 0) {
            return res.status(400).json({
                error: 'Solicitud invalida',
                message: 'Debes enviar solicitudId numerico en body o query',
            });
        }

        const rawIncludeGeneralNotice =
            req.body?.includeGeneralNotice ??
            req.query?.includeGeneralNotice;
        const includeGeneralNotice = rawIncludeGeneralNotice === undefined
            ? true
            : !['false', '0', 'no', 'off'].includes(String(rawIncludeGeneralNotice).trim().toLowerCase());

        const result = await permisosService.recreateCalendarEventForSolicitud({
            solicitudId,
            includeGeneralNotice,
        });

        res.json({
            success: true,
            message: 'Evento de calendario recreado para solicitud aprobada',
            data: result,
        });
    } catch (error) {
        console.error('Error recreando evento de calendario de permisos:', error);
        res.status(error.status || 500).json({
            error: 'Fallo el re-agendado de calendario',
            details: error.message,
        });
    }
});

router.post('/business-case/sheets/process-queue', async (req, res) => {
    try {
        const rawLimit = req.body?.limit ?? req.query?.limit;
        const parsedLimit = Number(rawLimit);
        const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;
        const result = await runBusinessCaseSheetQueue(limit ? { limit } : {});
        res.json({
            success: true,
            message: 'Cola de generacion de hojas BC procesada',
            data: result
        });
    } catch (error) {
        console.error('Error en job de cola de hojas BC:', error);
        res.status(500).json({
            error: 'Fallo el procesamiento de cola de hojas BC',
            details: error.message
        });
    }
});

// Endpoint para respaldo de base de datos en Drive
router.post('/database/backup', async (_req, res) => {
    try {
        const result = await runDatabaseBackupToDrive();
        res.json({
            success: true,
            message: 'Respaldo de base de datos completado',
            data: result
        });
    } catch (error) {
        console.error('Error en job de respaldo de base de datos:', error);
        res.status(500).json({
            error: 'Fallo el respaldo de base de datos',
            details: error.message
        });
    }
});

router.post('/external-cases/sync', async (req, res) => {
    try {
        const rawLimit = req.body?.limit ?? req.query?.limit;
        const parsedLimit = Number(rawLimit);
        const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;
        const result = await runExternalCaseSyncQueue(limit ? { limit } : {});
        res.json({
            success: true,
            message: 'Cola de sincronización de casos externos procesada',
            data: result
        });
    } catch (error) {
        console.error('Error en job de sincronización de casos externos:', error);
        res.status(500).json({
            error: 'Falló el procesamiento de cola de casos externos',
            details: error.message
        });
    }
});

module.exports = router;
