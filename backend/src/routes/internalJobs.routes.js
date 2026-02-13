const express = require('express');
const router = express.Router();
const { runOnce: runMantenimiento } = require('../modules/mantenimientos/mantenimiento.scheduler');
const { runOnce: runExpiredReservations } = require('../jobs/checkExpiredReservations');
const { runOnce: processAttendanceOvertime } = require('../jobs/attendanceOvertimeScheduler');

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

module.exports = router;