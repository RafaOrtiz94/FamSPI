const express = require('express');
const router = express.Router();
const { runOnce: runMantenimiento } = require('../modules/mantenimientos/mantenimiento.scheduler');
const { runOnce: runExpiredReservations } = require('../jobs/checkExpiredReservations');
const { runOnce: processAttendanceOvertime } = require('../jobs/attendanceOvertimeScheduler');
const { runOnce: runContractReminderEmails } = require('../jobs/equipmentContractReminderEmails');
const { runOnce: runNotificationDispatchQueue } = require('../jobs/processNotificationDispatchQueue');
const { runOnce: runBusinessCasePreflowExpiry } = require('../jobs/businessCasePreflowExpiryScheduler');
const { runOnce: runBusinessCaseDeterminationsGateExpiry } = require('../jobs/businessCaseDeterminationsGateExpiryScheduler');
const { runOnce: runBusinessCaseSheetQueue } = require('../jobs/businessCaseSheetGenerationQueueScheduler');
const { runOnce: runDatabaseBackupToDrive } = require('../jobs/databaseBackupToDrive');
const { runOnce: runPermisosRecoveryCoordinationExpiry } = require('../jobs/permisosRecoveryCoordinationExpiryScheduler');

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

module.exports = router;
