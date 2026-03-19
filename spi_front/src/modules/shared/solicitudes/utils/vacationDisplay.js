const HOURS_PER_VACATION_DAY = 8;
const MINUTES_PER_VACATION_DAY = HOURS_PER_VACATION_DAY * 60;

const roundToTwo = (value) => {
 const numeric = Number(value || 0);
 if (!Number.isFinite(numeric)) return 0;
 return Math.round((numeric + Number.EPSILON) * 100) / 100;
};

export const splitVacationDaysToDaysHours = (value) => {
 const totalDays = roundToTwo(value);
 const wholeDays = totalDays >= 0 ? Math.floor(totalDays) : Math.ceil(totalDays);
 const fractionalDays = totalDays - wholeDays;
 const totalMinutes = Math.round(Math.abs(fractionalDays) * MINUTES_PER_VACATION_DAY);
 const hours = Math.floor(totalMinutes / 60);
 const minutes = totalMinutes % 60;

 return {
 totalDays,
 days: wholeDays,
 hours,
 minutes,
 };
};

export const formatVacationDaysHours = (value) => {
 const { totalDays, days, hours, minutes } = splitVacationDaysToDaysHours(value);
 const safeDays = roundToTwo(totalDays);
 const parts = [];

 if (days !== 0 || (hours === 0 && minutes === 0)) {
 parts.push(`${days} dia${Math.abs(days) === 1 ? "" : "s"}`);
 }
 if (hours > 0) {
 parts.push(`${hours} hora${hours === 1 ? "" : "s"}`);
 }
 if (minutes > 0) {
 parts.push(`${minutes} min`);
 }

 return {
 text: parts.join(" ") || `${safeDays} dias`,
 shortText: parts.join(" ") || `${safeDays} d`,
 decimalText: `${safeDays} dias`,
 };
};
