/**
 * src/modules/attendance/attendance.routes.js
 * -------------------------------------------
 * 📋 Attendance API Routes
 */

const router = require("express").Router();
const { verifyToken } = require("../../middlewares/auth");
const controller = require("./attendance.controller");
const { generatePDF } = require("./attendance.service");

// Clock in/out endpoints
router.post("/clock-in", verifyToken, controller.clockIn);
router.post("/clock-out-lunch", verifyToken, controller.clockOutLunch);
router.post("/clock-in-lunch", verifyToken, controller.clockInLunch);
router.post("/clock-out", verifyToken, controller.clockOut);
router.post("/exception", verifyToken, controller.registerException);
router.post("/exception/status", verifyToken, controller.updateExceptionStatus);
router.get("/exception/active", verifyToken, controller.getActiveException);

// Overtime endpoints
router.post("/overtime", verifyToken, controller.markOvertime);
router.get("/overtime", verifyToken, controller.getOvertimeRecords);

// Query endpoints
router.get("/today", verifyToken, controller.getToday);
router.get("/user/:userId", verifyToken, controller.getUserAttendance);
router.get("/range", verifyToken, controller.getRange);

// PDF generation
router.get("/pdf/:userId", verifyToken, generatePDF);

module.exports = router;
