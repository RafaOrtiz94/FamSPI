/**
 * Attendance Overtime Automatic Scheduler
 * ---------------------------------------
 * Automatically closes shifts after 8 hours and starts overtime tracking
 */

const db = require("../config/db");
const logger = require("../config/logger");

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

    // Find all active shifts that have passed their auto_shift_end_at time
    const result = await db.query(
      `
      SELECT
        id, user_id, date, entry_time, auto_shift_end_at,
        lunch_start_time, lunch_end_time
      FROM user_attendance_records
      WHERE exit_time IS NULL
        AND auto_shift_end_at IS NOT NULL
        AND auto_closed_at IS NULL
        AND NOW() >= auto_shift_end_at
      `,
      []
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

  // Update the shift record to mark it as auto-closed and set overtime start
  await db.query(
    `
    UPDATE user_attendance_records
    SET auto_closed_at = $1, overtime_start_at = $2, updated_at = NOW()
    WHERE id = $3
    `,
    [now, auto_shift_end_at, id]  // overtime_start_at = auto_shift_end_at
  );

  logger.info(`[ATTENDANCE SCHEDULER] Successfully auto-closed shift ${id}, overtime starts at ${auto_shift_end_at}`);
};

/**
 * Get scheduler status for monitoring
 */
const getSchedulerStatus = async () => {
  try {
    // Count pending auto-closures
    const pendingResult = await db.query(
      `
      SELECT COUNT(*) as pending_count
      FROM user_attendance_records
      WHERE exit_time IS NULL
        AND auto_shift_end_at IS NOT NULL
        AND auto_closed_at IS NULL
        AND NOW() >= auto_shift_end_at
      `,
      []
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

// Alias for Cloud Scheduler compatibility
const runOnce = processAutomaticOvertime;

module.exports = {
  processAutomaticOvertime,
  getSchedulerStatus,
  triggerManualRun,
  runOnce,
};
