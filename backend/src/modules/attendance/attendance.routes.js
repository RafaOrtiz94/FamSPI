/**
 * src/modules/attendance/attendance.routes.js
 * -------------------------------------------
 * 📋 Attendance API Routes
 */

const router = require("express").Router();
const { verifyToken } = require("../../middlewares/auth");
const controller = require("./attendance.controller");
const { requireAttendanceReportAccess } = require("./attendance.auth");

// Clock in/out endpoints
router.post("/clock-in", verifyToken, controller.clockIn);
router.post("/clock-out-lunch", verifyToken, controller.clockOutLunch);
router.post("/clock-in-lunch", verifyToken, controller.clockInLunch);
router.post("/clock-out", verifyToken, controller.clockOut);

// Spanish aliases for iPhone shortcuts
router.post("/marcar/entrada", verifyToken, controller.clockIn);
router.post("/marcar/almuerzo-salida", verifyToken, controller.clockOutLunch);
router.post("/marcar/almuerzo-entrada", verifyToken, controller.clockInLunch);
router.post("/marcar/salida", verifyToken, controller.clockOut);

// 📍 Field Attendance Aliases (Commercial & Tech Service)
router.post("/marcar/visita-entrada", verifyToken, controller.clockInField);
router.post("/marcar/visita-salida", verifyToken, controller.clockOutField);

// 🚨 Unexpected Exit Aliases (iPhone Shortcut compatible)
router.post("/marcar/salida-imprevista", verifyToken, controller.clockOutUnexpected);
router.post("/marcar/regreso-imprevisto", verifyToken, controller.clockInUnexpected);

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
router.get("/range", verifyToken, requireAttendanceReportAccess("query", { allowAll: true }), controller.getRange);

// PDF generation
router.get("/pdf/:userId", verifyToken, requireAttendanceReportAccess("param", { allowAll: true }), controller.generatePDF);

module.exports = router;
