const logger = require("../../config/logger");

const sanitizeAuditFilters = (filters = {}) => ({
  start: String(filters.start || "").trim() || null,
  end: String(filters.end || "").trim() || null,
  userId: filters.userId ?? null,
  userIds: Array.isArray(filters.userIds) ? filters.userIds : [],
  departmentId: filters.departmentId ?? null,
  status: filters.status ?? null,
  quickRange: filters.quickRange ?? null,
  onlyDiscrepancies: Boolean(filters.onlyDiscrepancies),
  onlyWithGeo: Boolean(filters.onlyWithGeo),
  timezone: String(filters.timezone || "").trim() || null,
});

const sanitizeAuditResult = (result = {}) => ({
  total: Number(result.total || 0),
  filteredTotal: Number(result.filteredTotal || 0),
  warnings: Array.isArray(result.warnings) ? result.warnings : [],
});

const logAttendanceReportAccess = ({
  requester = {},
  filters = {},
  result = {},
  action = "attendance_report_access",
}) => {
  const auditEntry = {
    action,
    requester: {
      id: requester.id ?? null,
      email: requester.email ?? null,
      role: requester.role ?? null,
    },
    filters: sanitizeAuditFilters(filters),
    result: sanitizeAuditResult(result),
    timestamp: new Date().toISOString(),
  };

  logger.info(auditEntry, "[ATTENDANCE_AUDIT] Report access logged");
  return auditEntry;
};

module.exports = {
  logAttendanceReportAccess,
  sanitizeAuditFilters,
  sanitizeAuditResult,
};
