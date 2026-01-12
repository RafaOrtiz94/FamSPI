/**
 * Off-Hours Policy for Ecuador Timezone
 * Evaluates if a timestamp falls outside business hours
 */

const logger = require('../config/logger');

/**
 * Business hours configuration for Ecuador
 */
const BUSINESS_HOURS = {
  timezone: 'America/Guayaquil',
  workDays: [1, 2, 3, 4, 5], // Monday-Friday (0=Sunday, 6=Saturday)
  startHour: 7,  // 07:30
  startMinute: 30,
  endHour: 20,   // 20:00
  endMinute: 0
};

/**
 * Check if a timestamp is outside business hours
 * @param {string|Date} timestamp - Timestamp to evaluate
 * @param {Object} options - Override options
 * @param {Array} options.holidays - Array of holiday dates (YYYY-MM-DD)
 * @returns {Object} Evaluation result
 */
function isOffHours(timestamp, options = {}) {
  try {
    const date = new Date(timestamp);

    // Convert to Ecuador timezone
    const ecuadorTime = new Date(date.toLocaleString("en-US", {
      timeZone: BUSINESS_HOURS.timezone
    }));

    const dayOfWeek = ecuadorTime.getDay(); // 0=Sunday, 6=Saturday
    const hour = ecuadorTime.getHours();
    const minute = ecuadorTime.getMinutes();
    const dateStr = ecuadorTime.toISOString().split('T')[0];
    const currentMinutes = hour * 60 + minute;

    // Check holidays
    const holidays = options.holidays || process.env.HOLIDAYS_EC?.split(',') || [];
    if (holidays.includes(dateStr)) {
      return {
        isOffHours: true,
        reason: 'holiday',
        localTimeISO: ecuadorTime.toISOString(),
        date: dateStr,
        dayOfWeek,
        currentMinutes,
        workDayStart: null,
        workDayEnd: null
      };
    }

    // Check weekend
    if (!BUSINESS_HOURS.workDays.includes(dayOfWeek)) {
      return {
        isOffHours: true,
        reason: 'weekend',
        localTimeISO: ecuadorTime.toISOString(),
        date: dateStr,
        dayOfWeek,
        currentMinutes,
        workDayStart: null,
        workDayEnd: null
      };
    }

    // Check business hours on work days
    const workDayStart = BUSINESS_HOURS.startHour * 60 + BUSINESS_HOURS.startMinute;
    const workDayEnd = BUSINESS_HOURS.endHour * 60 + BUSINESS_HOURS.endMinute;

    if (currentMinutes < workDayStart || currentMinutes >= workDayEnd) {
      return {
        isOffHours: true,
        reason: 'offhours',
        localTimeISO: ecuadorTime.toISOString(),
        date: dateStr,
        dayOfWeek,
        currentMinutes,
        workDayStart,
        workDayEnd
      };
    }

    // Within business hours
    return {
      isOffHours: false,
      reason: 'business_hours',
      localTimeISO: ecuadorTime.toISOString(),
      date: dateStr,
      dayOfWeek,
      currentMinutes,
      workDayStart,
      workDayEnd
    };

  } catch (error) {
    logger.error({ error, timestamp }, "Error evaluating off-hours policy");

    // On error, assume off-hours for security
    return {
      isOffHours: true,
      reason: 'error',
      localTimeISO: timestamp,
      date: null,
      dayOfWeek: null,
      currentMinutes: null,
      workDayStart: null,
      workDayEnd: null,
      error: error.message
    };
  }
}

/**
 * Get business hours configuration
 * @returns {Object} Business hours config
 */
function getBusinessHours() {
  return { ...BUSINESS_HOURS };
}

module.exports = {
  isOffHours,
  getBusinessHours,
  BUSINESS_HOURS
};