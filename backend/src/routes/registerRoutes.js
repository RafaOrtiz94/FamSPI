const authRoutes = require("../modules/auth/auth.routes");
const requestRoutes = require("../modules/requests/requests.routes");
const approvalRoutes = require("../modules/approvals/approvals.routes");
const finRoutes = require("../modules/finanzas/finanzas.routes");
const hrRoutes = require("../modules/talento_humano/hr.routes");
const auditRoutes = require("../modules/auditoria/audit.routes");
const auditPrepRoutes = require("../modules/audit-prep/auditPrep.routes");
const securityRoutes = require("../modules/security/security.routes");
const managementRoutes = require("../modules/management/management.routes");
const documentsRoutes = require("../modules/documents/documents.routes");
const filesRoutes = require("../modules/files/files.routes");
const servicioRoutes = require("../modules/servicio/servicio.routes");
const technicalApplicationsRoutes = require("../modules/technical-applications/technicalApplications.routes");
const departmentsRoutes = require("../modules/departments/departments.routes");
const usersRoutes = require("../modules/users/users.routes");
const inventarioRoutes = require("../modules/inventario/inventario.routes");
const attendanceRoutes = require("../modules/attendance/attendance.routes");
const gmailRoutes = require("../modules/gmail/gmail.routes");
const equipmentPurchaseRoutes = require("../modules/equipment-purchases/equipmentPurchases.routes");
const personnelRequestsRoutes = require("../modules/personnel-requests/personnel-requests.routes");
const permisosRoutes = require("../modules/permisos/permisos.routes");
const vacacionesRoutes = require("../modules/vacaciones/vacaciones.routes");
const clientsRoutes = require("../modules/clients/clients.routes");
const schedulesRoutes = require("../modules/schedules/schedules.routes");
const privatePurchasesRoutes = require("../modules/private-purchases/privatePurchases.routes");
const applicantsRoutes = require("../modules/applicants/applicants.routes");
const {
  businessCaseRoutes,
  equipmentCatalogRoutes,
  determinationsCatalogRoutes,
  calculationTemplatesRoutes,
} = require("../modules/business-case/businessCase.routes");
const notificationsRoutes = require("../modules/notifications/notifications.routes");
const userProfileRoutes = require("../modules/user-profile/userProfile.routes");
const userCertificationsRoutes = require("../modules/user-certifications/userCertifications.routes");
const collaboratorsRoutes = require("../modules/collaborators/collaborators.routes");
const offboardingRoutes = require("../modules/offboarding/offboarding.routes");
const signatureRoutes = require("../modules/signature/signature.routes");
const signatureV1Routes = require("../modules/signature/signature.v1.routes");
const dashboardRoutes = require("../modules/dashboard/dashboard.routes");
const supportTicketsRoutes = require("../modules/support-tickets/supportTickets.routes");
const viaticosRoutes = require("../modules/viaticos/viaticos.routes");
const mantenimientosRoutes = require("../modules/mantenimientos/mantenimientos.routes");
const integrationsRoutes = require("../modules/integrations/integrations.routes");
const externalCasesRoutes = require("../modules/servicio/externalCases.routes");
const internalJobsRouter = require("./internalJobs.routes");

function mountPublicRoutes(app) {
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/applicants", applicantsRoutes);
}

function mountPrivateRoutes(app) {
  app.use("/api/v1/requests", requestRoutes);
  app.use("/api/v1/approvals", approvalRoutes);
  app.use("/api/v1/finanzas", finRoutes);
  app.use("/api/v1/talento-humano", hrRoutes);
  app.use("/api/v1/departments", departmentsRoutes);
  app.use("/api/v1/auditoria", auditRoutes);
  app.use("/api/v1/audit-prep", auditPrepRoutes);
  app.use("/api/v1/security", securityRoutes);
  app.use("/api/v1/management", managementRoutes);
  app.use("/api/v1/documents", documentsRoutes);
  app.use("/api/v1/files", filesRoutes);
  app.use("/api/v1/servicio", servicioRoutes);
  app.use("/api/v1/technical-applications", technicalApplicationsRoutes);
  app.use("/api/v1/business-case", businessCaseRoutes);
  app.use("/api/v1/equipment-catalog", equipmentCatalogRoutes);
  app.use("/api/v1/determinations-catalog", determinationsCatalogRoutes);
  app.use("/api/v1/calculation-templates", calculationTemplatesRoutes);
  app.use("/api/v1/mantenimientos", mantenimientosRoutes);
  app.use("/api/v1/integrations", integrationsRoutes);
  app.use("/api/v1/servicio/external-cases", externalCasesRoutes);
  app.use("/api/v1/users", usersRoutes);
  app.use("/api/v1/collaborators", collaboratorsRoutes);
  app.use("/api/v1/offboarding", offboardingRoutes);
  app.use("/api/v1/inventario", inventarioRoutes);
  app.use("/api/v1/attendance", attendanceRoutes);
  // Alias for iPhone shortcuts and Spanish-speaking users
  app.use("/asistencia", attendanceRoutes);
  app.use("/api/v1/gmail", gmailRoutes);
  app.use("/api/v1/equipment-purchases", equipmentPurchaseRoutes);
  app.use("/api/v1/private-purchases", privatePurchasesRoutes);
  app.use("/api/v1/personnel-requests", personnelRequestsRoutes);
  app.use("/api/v1/permisos", permisosRoutes);
  app.use("/api/v1/vacaciones", vacacionesRoutes);
  app.use("/api/v1/clients", clientsRoutes);
  app.use("/api/v1/schedules", schedulesRoutes);
  app.use("/api/v1/notifications", notificationsRoutes);
  app.use("/api/v1/dashboard", dashboardRoutes);
  app.use("/api/v1/support-tickets", supportTicketsRoutes);
  app.use("/api/v1/viaticos", viaticosRoutes);
  app.use("/internal/jobs", internalJobsRouter);
  app.use("/api/v1/users/me/profile", userProfileRoutes);
  app.use("/api/v1/users", userCertificationsRoutes);
  app.use("/api/v1/signature", signatureV1Routes);
  app.use("/api", signatureRoutes);
}

module.exports = {
  mountPublicRoutes,
  mountPrivateRoutes,
};
