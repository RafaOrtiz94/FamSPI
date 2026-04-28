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

// Clock in/out endpoints
router.post("/clock-in", verifyToken, controller.clockIn);
router.post("/clock-out-lunch", verifyToken, controller.clockOutLunch);
router.post("/clock-in-lunch", verifyToken, controller.clockInLunch);
router.post("/clock-out", verifyToken, controller.clockOut);
router.post("/late-justification", verifyToken, controller.justifyLateArrival);

// Spanish aliases for iPhone shortcuts
router.post("/marcar/entrada", verifyToken, controller.clockIn);
router.post("/marcar/almuerzo-salida", verifyToken, controller.clockOutLunch);
router.post("/marcar/almuerzo-entrada", verifyToken, controller.clockInLunch);
router.post("/marcar/salida", verifyToken, controller.clockOut);

// 📍 Field Attendance Aliases (Commercial & Tech Service)
router.post("/marcar/visita-entrada", verifyToken, controller.clockInField);
router.post("/marcar/visita-salida", verifyToken, controller.clockOutField);
router.post("/marcar/cliente-entrada", verifyToken, controller.clockInField);
router.post("/marcar/cliente-salida", verifyToken, controller.clockOutField);

// 🚨 Unexpected Exit Aliases (iPhone Shortcut compatible)
router.post("/marcar/salida-imprevista", verifyToken, controller.clockOutUnexpected);
router.post("/marcar/regreso-imprevisto", verifyToken, controller.clockInUnexpected);
router.post("/marcar/entrada-imprevista", verifyToken, controller.clockInUnexpected);
router.post("/marcar/llegada-imprevista", verifyToken, controller.clockUnexpectedArrival);
router.post("/marcar/retorno-imprevisto", verifyToken, controller.clockUnexpectedReturn);
router.post("/marcar/salida-oficina", verifyToken, controller.clockOutOperational);
router.post("/marcar/entrada-oficina", verifyToken, controller.clockInOperational);
router.post("/marcar/salida-campo", verifyToken, controller.clockOutOperational);
router.post("/marcar/entrada-campo", verifyToken, controller.clockInOperational);
router.post("/marcar/llegada-destino", verifyToken, controller.clockInDestino);
router.post("/marcar/cierre-viaje", verifyToken, controller.clockCloseTrip);

router.post("/location-sync", verifyToken, controller.syncLocation);
router.post("/exception", verifyToken, controller.registerException);
router.post("/exception/status", verifyToken, controller.updateExceptionStatus);
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
router.get("/operational-health", verifyToken, requireAttendanceOpsAccess, controller.getOperationalHealth);

// PDF generation
router.get("/pdf/:userId", verifyToken, requireAttendanceReportAccess("param", { allowAll: true }), controller.generatePDF);

module.exports = router;
