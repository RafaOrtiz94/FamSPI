/**
 * Attendance Overtime Automatic Scheduler
 * ---------------------------------------
 * Automatically closes shifts after 8 hours and starts overtime tracking
 */

const db = require("../config/db");
const logger = require("../config/logger");
const { ATTENDANCE_TIMEZONE, getBusinessDate } = require("../modules/attendance/attendance.utils");
const notificationManager = require("../modules/notifications/notificationManager");

const OPERATIONAL_EXCEPTION_TYPES = ["operacion_campo", "operacion_de_campo", "salida_oficina", "viaje", "campo"];
const OPERATIONAL_OVERTIME_THRESHOLD_HOURS = Number(process.env.ATTENDANCE_OPERATIONAL_OVERTIME_THRESHOLD_HOURS || 8);

/**
 * Process automatic shift closures and overtime start
 * Runs every 5 minutes to check for shifts that have exceeded 8 hours
 * Uses PostgreSQL advisory lock to prevent concurrent execution in multi-instance deployments
 */
const processAutomaticOvertime = async () => {
  const ADVISORY_LOCK_KEY = 123456789; // Unique key for attendance scheduler
  let lockAcquired = false;

  try {
    // Try to acquire advisory lock (non-blocking)
    const lockResult = await db.query('SELECT pg_try_advisory_lock($1) as lock_acquired', [ADVISORY_LOCK_KEY]);
    lockAcquired = lockResult.rows[0].lock_acquired;

    if (!lockAcquired) {
      logger.info('[ATTENDANCE SCHEDULER] Another instance is running. Skipping this execution.');
      return { skipped: true, reason: 'lock_already_held' };
    }

    const startTime = Date.now();
    const now = new Date();

    logger.info(`[ATTENDANCE SCHEDULER] Starting automatic overtime processing at ${now.toISOString()}`);

    const currentBusinessDate = getBusinessDate(now);

    // Find all active shifts that must be closed automatically:
    // 1) Shifts that exceeded auto_shift_end_at
    // 2) Shifts from previous business dates (must not remain open into the next day)
    const result = await db.query(
      `
      SELECT
        id, user_id, date, entry_time, auto_shift_end_at,
        lunch_start_time, lunch_end_time
      FROM user_attendance_records ar
      WHERE ar.exit_time IS NULL
        AND (
          (
            ar.auto_shift_end_at IS NOT NULL
            AND ar.auto_closed_at IS NULL
            AND NOW() >= ar.auto_shift_end_at
          )
          OR ar.date < $1::date
        )
        AND NOT EXISTS (
          SELECT 1
          FROM attendance_exceptions ex
          WHERE ex.user_id = ar.user_id
            AND ex.date = ar.date
            AND UPPER(COALESCE(ex.status, '')) <> 'COMPLETED'
        )
      `,
      [currentBusinessDate]
    );

    const shiftsToClose = result.rows;
    logger.info(`[ATTENDANCE SCHEDULER] Found ${shiftsToClose.length} shifts to auto-close`);

    let processedCount = 0;
    let errorCount = 0;

    for (const shift of shiftsToClose) {
      try {
        await processShiftClosure(shift);
        processedCount++;
      } catch (shiftError) {
        logger.error({ shiftError, shiftId: shift.id }, "Error processing individual shift closure");
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;

    logger.info(`[ATTENDANCE SCHEDULER] Completed processing ${processedCount} shifts successfully, ${errorCount} errors. Duration: ${duration}ms`);

    return {
      processedCount,
      errorCount,
      duration,
      totalFound: shiftsToClose.length
    };

  } catch (error) {
    logger.error({ error }, "❌ Error in automatic overtime scheduler");
    return { error: error.message };
  } finally {
    // Always release the lock if we acquired it
    if (lockAcquired) {
      try {
        await db.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
      } catch (unlockError) {
        logger.error({ unlockError }, 'Error releasing advisory lock');
      }
    }
  }
};

/**
 * Process individual shift closure
 */
const processShiftClosure = async (shift) => {
  const { id, user_id, auto_shift_end_at } = shift;
  const now = new Date();

  logger.info(`[ATTENDANCE SCHEDULER] Auto-closing shift ${id} for user ${user_id}`);

  const closeAt = auto_shift_end_at || now;

  // Update the shift record to mark it as auto-closed and set overtime start
  await db.query(
    `
    UPDATE user_attendance_records
    SET
      exit_time = COALESCE(exit_time, $2),
      lunch_end_time = CASE
        WHEN lunch_start_time IS NOT NULL AND lunch_end_time IS NULL
          THEN $2
        ELSE lunch_end_time
      END,
      auto_closed_at = $1,
      overtime_start_at = CASE
        WHEN auto_shift_end_at IS NOT NULL THEN auto_shift_end_at
        ELSE NULL
      END,
      updated_at = NOW()
    WHERE id = $3
    `,
    [now, closeAt, id]
  );

  logger.info(
    `[ATTENDANCE SCHEDULER] Successfully auto-closed shift ${id} at ${closeAt.toISOString()} (${ATTENDANCE_TIMEZONE})`
  );
};

/**
 * Get scheduler status for monitoring
 */
const getSchedulerStatus = async () => {
  try {
    const currentBusinessDate = getBusinessDate(new Date());

    // Count pending auto-closures
    const pendingResult = await db.query(
      `
      SELECT COUNT(*) as pending_count
      FROM user_attendance_records ar
      WHERE ar.exit_time IS NULL
        AND (
          (
            ar.auto_shift_end_at IS NOT NULL
            AND ar.auto_closed_at IS NULL
            AND NOW() >= ar.auto_shift_end_at
          )
          OR ar.date < $1::date
        )
        AND NOT EXISTS (
          SELECT 1
          FROM attendance_exceptions ex
          WHERE ex.user_id = ar.user_id
            AND ex.date = ar.date
            AND UPPER(COALESCE(ex.status, '')) <> 'COMPLETED'
        )
      `,
      [currentBusinessDate]
    );

    // Count recently auto-closed shifts (last 24 hours)
    const recentClosuresResult = await db.query(
      `
      SELECT COUNT(*) as recent_closures
      FROM user_attendance_records
      WHERE auto_closed_at >= NOW() - INTERVAL '24 hours'
      `,
      []
    );

    return {
      pendingAutoClosures: parseInt(pendingResult.rows[0].pending_count),
      recentAutoClosures: parseInt(recentClosuresResult.rows[0].recent_closures),
      lastRun: new Date().toISOString(),
      status: 'active'
    };

  } catch (error) {
    logger.error({ error }, "Error getting scheduler status");
    return {
      error: error.message,
      status: 'error'
    };
  }
};

/**
 * Manual trigger for testing (admin endpoint)
 */
const triggerManualRun = async () => {
  logger.info("[ATTENDANCE SCHEDULER] Manual trigger initiated");
  await processAutomaticOvertime();
  return { success: true, message: "Manual overtime processing completed" };
};

/**
 * Notify users with active operational exits that have exceeded 8 hours.
 * Sends one email per exception (tracked by op_overtime_notified_at).
 */
const processOperationalOvertimeNotifications = async () => {
  const thresholdMs = OPERATIONAL_OVERTIME_THRESHOLD_HOURS * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - thresholdMs);

  const { rows } = await db.query(
    `SELECT ex.id, ex.user_id, ex.start_time, ex.type, ex.description,
            u.email AS user_email, u.fullname AS user_fullname, u.name AS user_name
       FROM attendance_exceptions ex
       JOIN users u ON u.id = ex.user_id
      WHERE LOWER(COALESCE(ex.type, '')) = ANY($1::text[])
        AND UPPER(COALESCE(ex.status, '')) <> 'COMPLETED'
        AND ex.start_time IS NOT NULL
        AND ex.start_time <= $2
        AND ex.op_overtime_notified_at IS NULL`,
    [OPERATIONAL_EXCEPTION_TYPES, cutoff]
  );

  if (!rows.length) return { scanned: 0, notified: 0 };

  let notified = 0;
  for (const row of rows) {
    try {
      const elapsedHours = Math.floor((Date.now() - new Date(row.start_time).getTime()) / 3600000);
      const displayName = row.user_fullname || row.user_name || row.user_email;

      await notificationManager.sendNotification({
        userId: row.user_id,
        customTitle: `Salida operacional activa por más de ${OPERATIONAL_OVERTIME_THRESHOLD_HOURS} horas`,
        customMessage: `Hola ${displayName}, tienes una salida operacional activa desde hace ${elapsedHours} horas. Si ya regresaste a la oficina, registra tu entrada operacional para cerrar el ciclo correctamente.`,
        type: "alert",
        source: "attendance_operational",
        priority: 2,
        email: true,
        meta: {
          exception_id: row.id,
          start_time: row.start_time,
          elapsed_hours: elapsedHours,
          email_to: row.user_email,
          target_path: "/dashboard/asistencia",
        },
      });

      await db.query(
        `UPDATE attendance_exceptions SET op_overtime_notified_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [row.id]
      );

      notified += 1;
      logger.info(
        { exceptionId: row.id, userId: row.user_id, elapsedHours },
        "[ATTENDANCE] Operational overtime notification sent"
      );
    } catch (err) {
      logger.warn({ err, exceptionId: row.id }, "[ATTENDANCE] Failed to send operational overtime notification");
    }
  }

  return { scanned: rows.length, notified };
};

// Alias for Cloud Scheduler compatibility
const runOnce = async () => {
  const overtime = await processAutomaticOvertime();
  const opNotifications = await processOperationalOvertimeNotifications();
  logger.info(
    `[ATTENDANCE SCHEDULER] op_overtime_notifications: scanned=${opNotifications.scanned} notified=${opNotifications.notified}`
  );
  return { overtime, opNotifications };
};

module.exports = {
  processAutomaticOvertime,
  processOperationalOvertimeNotifications,
  getSchedulerStatus,
  triggerManualRun,
  runOnce,
};
