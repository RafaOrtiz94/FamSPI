const fs = require('fs');
const path = require('path');
const logger = require("../../config/logger");

// Load holidays configuration
let holidaysData = {};
try {
  const holidaysPath = path.join(__dirname, '../../config/holidays.ec.json');
  const holidaysContent = fs.readFileSync(holidaysPath, 'utf8');
  holidaysData = JSON.parse(holidaysContent);
  logger.info('[HOLIDAYS] Loaded holidays data for years:', Object.keys(holidaysData));
} catch (err) {
  logger.error('[HOLIDAYS] Error loading holidays configuration:', err.message);
  // Fallback to empty data to avoid crashes
  holidaysData = {};
}

/**
 * Check if a given date is a holiday in Ecuador
 * @param {Date|string} date - Date to check (Date object or ISO string)
 * @param {string} tz - Timezone (default: 'America/Guayaquil')
 * @returns {boolean} True if the date is a holiday
 */
function isHolidayEC(date, tz = 'America/Guayaquil') {
  try {
    // Convert to Date if string
    const checkDate = typeof date === 'string' ? new Date(date) : date;
    if (!(checkDate instanceof Date) || isNaN(checkDate.getTime())) {
      logger.warn('[HOLIDAYS] Invalid date provided:', date);
      return false;
    }

    // Adjust to timezone if needed (simplified - assumes date is already in correct TZ)
    const year = checkDate.getFullYear();
    const month = String(checkDate.getMonth() + 1).padStart(2, '0');
    const day = String(checkDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    // Check if year exists in holidays data
    const yearHolidays = holidaysData[year];
    if (!yearHolidays) {
      logger.debug(`[HOLIDAYS] No holidays data for year ${year}`);
      return false;
    }

    // Check if date is in holidays list
    const isHoliday = yearHolidays.includes(dateString);

    if (isHoliday) {
      logger.info(`[HOLIDAYS] Date ${dateString} is a holiday in Ecuador`);
    }

    return isHoliday;

  } catch (err) {
    logger.error('[HOLIDAYS] Error checking holiday:', err);
    return false; // Fail-safe: assume not holiday on error
  }
}

/**
 * Get all holidays for a specific year
 * @param {number} year - Year to get holidays for
 * @returns {Array<string>} Array of holiday dates in YYYY-MM-DD format
 */
function getHolidaysForYear(year) {
  return holidaysData[year] || [];
}

/**
 * Get all available years with holiday data
 * @returns {Array<number>} Array of years
 */
function getAvailableYears() {
  return Object.keys(holidaysData).map(y => parseInt(y)).sort();
}

/**
 * Check if a date falls on a weekend (Saturday or Sunday)
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if weekend
 */
function isWeekend(date) {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  const dayOfWeek = checkDate.getDay(); // 0 = Sunday, 6 = Saturday
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Enhanced off-hours check with holidays support
 * @param {Date|string} date - Date to check
 * @param {Object} schedule - Work schedule configuration
 * @returns {Object} { isOffHours: boolean, reason: string }
 */
function checkOffHoursWithHolidays(date, schedule = {}) {
  const {
    start = '07:30',
    end = '20:00',
    timezone = 'America/Guayaquil',
    workDays = [1, 2, 3, 4, 5] // Monday to Friday
  } = schedule;

  const checkDate = typeof date === 'string' ? new Date(date) : date;
  const dayOfWeek = checkDate.getDay(); // 0 = Sunday, 6 = Saturday

  // Check if it's a weekend
  if (isWeekend(checkDate)) {
    return { isOffHours: true, reason: 'weekend' };
  }

  // Check if it's a holiday
  if (isHolidayEC(checkDate, timezone)) {
    return { isOffHours: true, reason: 'holiday' };
  }

  // Check if it's a workday but outside business hours
  if (workDays.includes(dayOfWeek)) {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    const startTime = new Date(checkDate);
    startTime.setHours(startHour, startMin, 0, 0);

    const endTime = new Date(checkDate);
    endTime.setHours(endHour, endMin, 0, 0);

    if (checkDate < startTime || checkDate > endTime) {
      return { isOffHours: true, reason: 'offhours' };
    }
  }

  // Within business hours on workday
  return { isOffHours: false, reason: null };
}

module.exports = {
  isHolidayEC,
  getHolidaysForYear,
  getAvailableYears,
  isWeekend,
  checkOffHoursWithHolidays
};