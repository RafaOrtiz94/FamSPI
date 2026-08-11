/**
 * src/modules/attendance/attendance.routes.js
 * -------------------------------------------
 * 📋 Attendance API Routes
 */

const router = require("express").Router();
const multer = require("multer");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const controller = require("./attendance.controller");
const regularizationsController = require("./attendanceRegularizations.controller");
const periodsController = require("./attendancePeriods.controller");
const geofenceController = require("./attendanceGeofence.controller");
const shortcutController = require("./attendanceShortcut.controller");
const teleworkRequestsController = require("./teleworkRequests.controller");
const { requireAttendanceReportAccess, hasReportingAccess } = require("./attendance.auth");

const requireAttendanceOpsAccess = (req, res, next) => {
  if (hasReportingAccess(req.user || {})) return next();
  return res.status(403).json({
    ok: false,
    code: "ATTENDANCE_OPS_FORBIDDEN",
    message: "No tienes permisos para consultar salud operacional de asistencia",
  });
};

const requireExactTalentHumanRole = (req, res, next) => {
  const candidates = [
    req.user?.role,
    req.user?.scope,
    req.user?.role_name,
    req.user?.rol,
    ...(Array.isArray(req.user?.roles) ? req.user.roles : []),
    ...(Array.isArray(req.user?.scopes) ? req.user.scopes : []),
  ].map(normalizeRoleToken);

  if (candidates.includes("talento_humano")) return next();
  return res.status(403).json({
    ok: false,
    code: "TELEWORK_APPROVAL_FORBIDDEN",
    message: "Solo el usuario con rol talento_humano puede aprobar solicitudes de teletrabajo",
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
  keyGenerator: (req) => {
    if (req.user?.id) return `uid:${String(req.user.id)}`;
    return ipKeyGenerator(req);
  },
  message: {
    ok: false,
    code: "ATTENDANCE_MARK_RATE_LIMIT",
    message: "Demasiadas marcaciones en poco tiempo. Espera un momento e intenta de nuevo.",
  },
});

const operationalEvidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

const operationalEvidenceMiddleware = operationalEvidenceUpload.fields([
  { name: "start_odometer_photo", maxCount: 1 },
  { name: "end_odometer_photo", maxCount: 1 },
]);
const birthdayBenefitUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
});

// 🗣️ Siri Smart Attendance (iPhone Shortcuts)
router.post("/shortcut/run-smart-mark", verifyToken, attendanceMarkLimiter, shortcutController.runSmartMark);
router.post("/shortcut/token", verifyToken, shortcutController.issueToken);
router.post(
  "/shortcut/admin/token/:userId",
  verifyToken,
  requireRole(["ti"]),
  shortcutController.adminIssueTokenForUser
);
router.get(
  "/shortcut/admin/tokens/:userId",
  verifyToken,
  requireRole(["ti"]),
  shortcutController.listTokensForUser
);
router.post(
  "/shortcut/admin/tokens/:tokenId/revoke",
  verifyToken,
  requireRole(["ti"]),
  shortcutController.revokeToken
);

// Clock in/out endpoints
router.post("/clock-in", verifyToken, attendanceMarkLimiter, controller.clockIn);
router.post("/clock-out-lunch", verifyToken, attendanceMarkLimiter, controller.clockOutLunch);
router.post("/clock-in-lunch", verifyToken, attendanceMarkLimiter, controller.clockInLunch);
router.post("/clock-out", verifyToken, attendanceMarkLimiter, controller.clockOut);
router.post("/late-justification", verifyToken, controller.justifyLateArrival);
router.post("/regularize-entry", verifyToken, controller.requestEntryRegularization);

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
router.post("/marcar/salida-oficina", verifyToken, attendanceMarkLimiter, operationalEvidenceMiddleware, controller.clockOutOperational);
router.post("/marcar/entrada-oficina", verifyToken, attendanceMarkLimiter, operationalEvidenceMiddleware, controller.clockInOperational);
router.post("/marcar/salida-campo", verifyToken, attendanceMarkLimiter, operationalEvidenceMiddleware, controller.clockOutOperational);
router.post("/marcar/entrada-campo", verifyToken, attendanceMarkLimiter, operationalEvidenceMiddleware, controller.clockInOperational);
router.post("/marcar/almuerzo-salida-operacional", verifyToken, attendanceMarkLimiter, controller.clockOutOperationalLunch);
router.post("/marcar/almuerzo-entrada-operacional", verifyToken, attendanceMarkLimiter, controller.clockInOperationalLunch);
router.post("/marcar/llegada-destino", verifyToken, attendanceMarkLimiter, controller.clockInDestino);
router.post("/marcar/cierre-viaje", verifyToken, attendanceMarkLimiter, operationalEvidenceMiddleware, controller.clockCloseTrip);

// Solicitud previa obligatoria para iniciar teletrabajo. La aprobacion se
// limita al rol exacto talento_humano, sin habilitar aliases ni administradores.
router.get("/telework/requests", verifyToken, teleworkRequestsController.list);
router.post("/telework/requests", verifyToken, attendanceMarkLimiter, teleworkRequestsController.create);
router.post(
  "/telework/requests/:id/decision",
  verifyToken,
  requireExactTalentHumanRole,
  teleworkRequestsController.decide
);

router.post("/location-sync", verifyToken, controller.syncLocation);
router.post("/exception", verifyToken, attendanceMarkLimiter, controller.registerException);
router.post("/permission-entry-start", verifyToken, attendanceMarkLimiter, controller.startPermissionEntry);
router.post("/permission-exit-finish", verifyToken, attendanceMarkLimiter, controller.finishPermissionExit);
router.post("/exception/status", verifyToken, attendanceMarkLimiter, controller.updateExceptionStatus);
router.get("/exception/active", verifyToken, controller.getActiveException);

// Overtime endpoints
router.post("/overtime", verifyToken, controller.markOvertime);
router.get("/overtime", verifyToken, controller.getOvertimeRecords);

// Query endpoints
router.get("/today", verifyToken, controller.getToday);
router.get("/live-presence", verifyToken, controller.getLivePresence);
router.get("/punctuality/summary", verifyToken, controller.getPunctualitySummary);
router.get("/workspace/overview", verifyToken, controller.getAttendanceWorkspaceOverview);
router.get("/workspace/breaches", verifyToken, controller.getAttendanceWorkspaceBreaches);
router.get("/workspace/collaborators/:userId", verifyToken, controller.getAttendanceWorkspaceCollaborator);
router.get("/birthday-benefit/qr/:token", controller.validateBirthdayBenefitQr);
router.post(
  "/birthday-benefit/:token/evidence",
  verifyToken,
  birthdayBenefitUpload.array("files", 6),
  controller.submitBirthdayBenefitEvidence
);
router.post("/birthday-benefit/:token/redeem", verifyToken, controller.redeemBirthdayBenefit);
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
router.get("/geofence/reference", verifyToken, requireAttendanceOpsAccess, geofenceController.getReference);

// Regularizations lifecycle (incremental v2)
router.post("/regularizations", verifyToken, regularizationsController.create);
router.get("/regularizations", verifyToken, regularizationsController.list);
router.post("/regularizations/:id/status", verifyToken, regularizationsController.transition);

// TH: gestión de justificaciones y regularizaciones por colaborador
router.get("/admin/collaborator/:userId/justifications-panel", verifyToken, controller.getCollaboratorJustificationsPanel);
router.get("/admin/regularizations-panel", verifyToken, controller.getGlobalRegularizationsPanel);
router.get("/admin/collaborator/:userId/birthday-benefit", verifyToken, controller.getCollaboratorBirthdayBenefit);
router.post("/admin/collaborator/:userId/birthday-benefit/qr", verifyToken, controller.generateCollaboratorBirthdayBenefitQr);
router.put("/admin/late-justification/:id", verifyToken, controller.updateLateJustification);
router.post("/admin/apply-entry-regularization", verifyToken, controller.applyEntryRegularization);

// Attendance periods lifecycle
router.get("/period/current", verifyToken, periodsController.getCurrent);
router.post("/period/:periodKey/status", verifyToken, periodsController.transition);

// PDF generation
router.get("/pdf/:userId", verifyToken, requireAttendanceReportAccess("param", { allowAll: true }), controller.generatePDF);
router.get("/pdf-bulk", verifyToken, requireAttendanceReportAccess("query", { allowAll: true }), controller.generateBulkPDF);
router.get("/monthly-report", verifyToken, requireAttendanceReportAccess("query", { allowAll: true }), controller.generateMonthlyReport);

module.exports = router;
