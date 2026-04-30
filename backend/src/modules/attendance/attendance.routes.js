/**
 * src/modules/attendance/attendance.routes.js
 * -------------------------------------------
 * 📋 Attendance API Routes
 */

const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { verifyToken } = require("../../middlewares/auth");
const controller = require("./attendance.controller");
const { requireAttendanceReportAccess, hasReportingAccess } = require("./attendance.auth");

const requireAttendanceOpsAccess = (req, res, next) => {
  if (hasReportingAccess(req.user || {})) return next();
  return res.status(403).json({
    ok: false,
    code: "ATTENDANCE_OPS_FORBIDDEN",
    message: "No tienes permisos para consultar salud operacional de asistencia",
  });
};

const normalizeRoleToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const TEAM_LEAD_ROLES = new Set([
  "jefe_comercial",
  "jefe_de_comercial",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "jefe_ti",
  "jefe_logistica",
  "jefe_operaciones",
  "jefe_talento_humano",
  "jefe_de_talento_humano",
]);

const requireAttendanceTeamAccess = (req, res, next) => {
  const roleTokens = [
    req.user?.role,
    req.user?.scope,
    req.user?.role_name,
    req.user?.rol,
    ...(Array.isArray(req.user?.roles) ? req.user.roles : []),
    ...(Array.isArray(req.user?.scopes) ? req.user.scopes : []),
  ]
    .map(normalizeRoleToken)
    .filter(Boolean);

  if (roleTokens.some((role) => TEAM_LEAD_ROLES.has(role))) return next();
  return res.status(403).json({
    ok: false,
    code: "ATTENDANCE_TEAM_FORBIDDEN",
    message: "Solo jefaturas pueden consultar asistencia por equipo",
  });
};

const attendanceReportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    code: "ATTENDANCE_REPORT_RATE_LIMIT",
    message: "Demasiadas consultas al reporte de asistencia, intenta de nuevo en unos segundos",
  },
});

// Per-user rate limit for clock-in/out marking endpoints (prevents GPS-retry spam)
const attendanceMarkLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || req.ip || "unknown"),
  message: {
    ok: false,
    code: "ATTENDANCE_MARK_RATE_LIMIT",
    message: "Demasiadas marcaciones en poco tiempo. Espera un momento e intenta de nuevo.",
  },
});

// Clock in/out endpoints
router.post("/clock-in", verifyToken, attendanceMarkLimiter, controller.clockIn);
router.post("/clock-out-lunch", verifyToken, attendanceMarkLimiter, controller.clockOutLunch);
router.post("/clock-in-lunch", verifyToken, attendanceMarkLimiter, controller.clockInLunch);
router.post("/clock-out", verifyToken, attendanceMarkLimiter, controller.clockOut);
router.post("/late-justification", verifyToken, controller.justifyLateArrival);

// Spanish aliases for iPhone shortcuts
router.post("/marcar/entrada", verifyToken, attendanceMarkLimiter, controller.clockIn);
router.post("/marcar/almuerzo-salida", verifyToken, attendanceMarkLimiter, controller.clockOutLunch);
router.post("/marcar/almuerzo-entrada", verifyToken, attendanceMarkLimiter, controller.clockInLunch);
router.post("/marcar/salida", verifyToken, attendanceMarkLimiter, controller.clockOut);

// 📍 Field Attendance Aliases (Commercial & Tech Service)
router.post("/marcar/visita-entrada", verifyToken, attendanceMarkLimiter, controller.clockInField);
router.post("/marcar/visita-salida", verifyToken, attendanceMarkLimiter, controller.clockOutField);
router.post("/marcar/cliente-entrada", verifyToken, attendanceMarkLimiter, controller.clockInField);
router.post("/marcar/cliente-salida", verifyToken, attendanceMarkLimiter, controller.clockOutField);

// 🚨 Unexpected Exit Aliases (iPhone Shortcut compatible)
router.post("/marcar/salida-imprevista", verifyToken, attendanceMarkLimiter, controller.clockOutUnexpected);
router.post("/marcar/regreso-imprevisto", verifyToken, attendanceMarkLimiter, controller.clockInUnexpected);
router.post("/marcar/entrada-imprevista", verifyToken, attendanceMarkLimiter, controller.clockInUnexpected);
router.post("/marcar/llegada-imprevista", verifyToken, attendanceMarkLimiter, controller.clockUnexpectedArrival);
router.post("/marcar/retorno-imprevisto", verifyToken, attendanceMarkLimiter, controller.clockUnexpectedReturn);
router.post("/marcar/salida-oficina", verifyToken, attendanceMarkLimiter, controller.clockOutOperational);
router.post("/marcar/entrada-oficina", verifyToken, attendanceMarkLimiter, controller.clockInOperational);
router.post("/marcar/salida-campo", verifyToken, attendanceMarkLimiter, controller.clockOutOperational);
router.post("/marcar/entrada-campo", verifyToken, attendanceMarkLimiter, controller.clockInOperational);
router.post("/marcar/llegada-destino", verifyToken, attendanceMarkLimiter, controller.clockInDestino);
router.post("/marcar/cierre-viaje", verifyToken, attendanceMarkLimiter, controller.clockCloseTrip);

router.post("/location-sync", verifyToken, controller.syncLocation);
router.post("/exception", verifyToken, attendanceMarkLimiter, controller.registerException);
router.post("/exception/status", verifyToken, attendanceMarkLimiter, controller.updateExceptionStatus);
router.get("/exception/active", verifyToken, controller.getActiveException);

// Overtime endpoints
router.post("/overtime", verifyToken, controller.markOvertime);
router.get("/overtime", verifyToken, controller.getOvertimeRecords);

// Query endpoints
router.get("/today", verifyToken, controller.getToday);
router.get("/user/:userId", verifyToken, requireAttendanceReportAccess("param"), controller.getUserAttendance);
router.get(
  "/range",
  verifyToken,
  requireAttendanceReportAccess("query", { allowAll: true }),
  attendanceReportLimiter,
  controller.getRange
);
router.get("/team-range", verifyToken, requireAttendanceTeamAccess, attendanceReportLimiter, controller.getTeamRange);
router.get("/non-compliance", verifyToken, attendanceReportLimiter, controller.getAttendanceNonCompliance);
router.post("/non-compliance/:userId/schedule-meeting", verifyToken, controller.scheduleAttendanceFollowUpMeeting);
// Operational health endpoint response:
// { ok, data: { timezone, todayEc, cutoffEc, since48h, activeFlows, geoQuality, policyWatch, pendingLocationQueue } }
router.get("/operational-health", verifyToken, requireAttendanceOpsAccess, controller.getOperationalHealth);

// PDF generation
router.get("/pdf/:userId", verifyToken, requireAttendanceReportAccess("param", { allowAll: true }), controller.generatePDF);

module.exports = router;
