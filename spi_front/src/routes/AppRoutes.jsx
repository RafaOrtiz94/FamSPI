import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";


// ðŸ§  Contextos y protecciones
import { ProtectedRoute } from "../core/auth/ProtectedRoute";
import { RoleRedirect } from "../core/auth/ProtectedRoute";

// ðŸ  Layouts
import PublicLayout from "../core/layout/PublicLayout";
import DashboardLayout from "../core/layout/DashboardLayout";

// ðŸªª PÃ¡ginas pÃºblicas
import Login from "../modules/shared/pages/Login";
import LoginCallback from "../modules/shared/pages/LoginCallback";
import NotFound from "../modules/shared/pages/NotFound";
import Unauthorized from "../modules/shared/pages/Unauthorized";
import RolePending from "../modules/shared/pages/RolePending";
import AttendanceAction from "../modules/shared/pages/AttendanceAction";
import MobileShortcuts from "../modules/shared/pages/MobileShortcuts";

// ðŸ§­ Dashboards por rol
import LinksInteres from "../modules/shared/pages/LinksInteres";

// ðŸ“‹ PÃ¡ginas de Talento Humano
import PermisosPage from "../modules/shared/solicitudes/pages/PermisosPage";
import BirthdayBenefitRedeemPage from "../modules/talento/pages/BirthdayBenefitRedeemPage";
import CollaboratorCommandCenter from "../modules/talento/pages/CollaboratorCommandCenter";
import PeopleAdminHub from "../modules/talento/pages/PeopleAdminHub";

// ðŸ§¾ PÃ¡ginas compartidas
import RequestsPage from "../modules/RequestsPage";
import MantenimientosPage from "../modules/MantenimientosPage";
import DocumentsPage from "../modules/DocumentsPage";
import Auditoria from "../modules/gerencia/Auditoria";
import ConfigurationPage from "../pages/ConfigurationPage";
import MyProfilePage from "../modules/profile/MyProfilePage";
import AuditPrepPage from "../modules/audit-prep/AuditPrepPage";
import Modal from "../core/ui/components/Modal";

// ðŸ“ Sistema de Firma Digital
import DocumentSigner from "../modules/signature/components/DocumentSigner";
import DocumentVerification from "../modules/signature/pages/DocumentVerification";
import SignatureDashboard from "../modules/signature/pages/SignatureDashboard";
import SignatureWorkflowVerificationPage from "../modules/signature/pages/SignatureWorkflowVerificationPage";


// Lazy loaded components
const PurchasesWorkspace = lazy(() => import("../modules/shared/purchases-workspace/PurchasesWorkspace"));
const DashboardGerencia = lazy(() => import("../modules/gerencia/Dashboard"));
const PurchasesAlbumPage = lazy(() => import("../modules/gerencia/PurchasesAlbumPage"));
const DashboardFinanzas = lazy(() => import("../modules/finanzas/Dashboard"));
const ViaticosWorkspace = lazy(() => import("../modules/finanzas/pages/ViaticosWorkspace"));
const DashboardComercial = lazy(() => import("../modules/comercial/pages/Dashboard"));
const SolicitudesPage = lazy(() => import("../modules/comercial/pages/Solicitudes"));
const ClientesPage = lazy(() => import("../modules/comercial/pages/Clientes"));
const NewClientRequest = lazy(() => import("../modules/comercial/pages/NewClientRequest"));
const DeliveryCeilingsPage = lazy(() => import("../modules/comercial/pages/DeliveryCeilings"));
const BusinessCaseWorkspace = lazy(() => import("../modules/comercial/pages/BusinessCaseWorkspace"));
const BusinessCaseObservabilityDashboard = lazy(() => import("../modules/comercial/pages/BusinessCaseObservabilityDashboard"));
const OpportunitiesPage = lazy(() => import("../modules/comercial/pages/OpportunitiesPage"));
const OpportunityWorkspace = lazy(() => import("../modules/comercial/pages/OpportunityWorkspace"));
const FamSheetsDashboardPage = lazy(() => import("../modules/comercial/pages/FamSheetsDashboardPage"));
const EquipmentWorkspace = lazy(() => import("../modules/equipment/pages/EquipmentWorkspace"));
const PlanificacionMensual = lazy(() => import("../modules/comercial/pages/PlanificacionMensual"));
const ClientesPlanShell    = lazy(() => import("../modules/comercial/pages/ClientesPlanShell"));
const AprobacionCronogramas = lazy(() => import("../modules/comercial/pages/AprobacionCronogramas"));
const DashboardServicio = lazy(() => import("../modules/servicio/pages/Dashboard"));
const ServicioMantenimientos = lazy(() => import("../modules/servicio/pages/Mantenimientos"));
const ServicioSolicitudes = lazy(() => import("../modules/servicio/pages/Solicitudes"));
const ServicioDisponibilidad = lazy(() => import("../modules/servicio/pages/Disponibilidad"));
const ServicioCapacitaciones = lazy(() => import("../modules/servicio/pages/Capacitaciones"));
const ServicioEquipos = lazy(() => import("../modules/servicio/pages/Equipos"));
const ServicioAprobaciones = lazy(() => import("../modules/servicio/pages/Aprobaciones"));
const ServicioAplicaciones = lazy(() => import("../modules/servicio/pages/Aplicaciones"));
const ServicioDesinfeccion = lazy(() => import("../modules/servicio/pages/Desinfeccion"));
const ServicioAsistencia = lazy(() => import("../modules/servicio/pages/Asistencia"));
const ServicioVerificacionEquipos = lazy(() => import("../modules/servicio/pages/VerificacionEquipos"));
const ServicioExternalCasesWorkspace = lazy(() => import("../modules/servicio/pages/ExternalCasesWorkspace"));
const DashboardTalento = lazy(() => import("../modules/talento/Dashboard"));
const DashboardTI = lazy(() => import("../modules/talento/DashboardTI"));
const TicketsWorkspace = lazy(() => import("../modules/ti/pages/TicketsWorkspace"));
const TIDeviceManagementPage = lazy(() => import("../modules/ti/pages/TIDeviceManagementPage"));
const TIModuleAccessPage = lazy(() => import("../modules/ti/pages/TIModuleAccessPage"));
const TIShortcutTokenPage = lazy(() => import("../modules/ti/pages/TIShortcutTokenPage"));
const TIAssetsFinancieroPage = lazy(() => import("../modules/ti/pages/TIAssetsFinancieroPage"));
const CollabDeliveriesFinancieroPage = lazy(() => import("../modules/collab/pages/CollabDeliveriesFinancieroPage"));
const CollabDeliveriesGerenciaPage   = lazy(() => import("../modules/collab/pages/CollabDeliveriesGerenciaPage"));
const TIActasPage = lazy(() => import("../modules/ti/pages/TIActasPage"));
const SignatureWorkflowDetailPage = lazy(() => import("../modules/signature/pages/SignatureWorkflowDetailPage"));
const DashboardOperaciones = lazy(() => import("../modules/operaciones/Dashboard"));
const DashboardCalidad = lazy(() => import("../modules/calidad/Dashboard"));
const CA0101Workspace = lazy(() => import("../modules/calidad/pages/CA0101Workspace"));
const CA0102Workspace = lazy(() => import("../modules/calidad/pages/CA0102Workspace"));
const CA0103Workspace = lazy(() => import("../modules/calidad/pages/CA0103Workspace"));
const CA0104Workspace = lazy(() => import("../modules/calidad/pages/CA0104Workspace"));
const CA0105Workspace = lazy(() => import("../modules/calidad/pages/CA0105Workspace"));
const CA0106Workspace = lazy(() => import("../modules/calidad/pages/CA0106Workspace"));
const CA0107Workspace = lazy(() => import("../modules/calidad/pages/CA0107Workspace"));
const CA0108Workspace = lazy(() => import("../modules/calidad/pages/CA0108Workspace"));
const CA0109Workspace = lazy(() => import("../modules/calidad/pages/CA0109Workspace"));
const CA0110Workspace = lazy(() => import("../modules/calidad/pages/CA0110Workspace"));
const CA0111Workspace = lazy(() => import("../modules/calidad/pages/CA0111Workspace"));
const CA0112Workspace = lazy(() => import("../modules/calidad/pages/CA0112Workspace"));
const CA0113Workspace = lazy(() => import("../modules/calidad/pages/CA0113Workspace"));
const CA0114Workspace = lazy(() => import("../modules/calidad/pages/CA0114Workspace"));
const CA0115Workspace = lazy(() => import("../modules/calidad/pages/CA0115Workspace"));
const CA0116Workspace = lazy(() => import("../modules/calidad/pages/CA0116Workspace"));
const CA0117Workspace = lazy(() => import("../modules/calidad/pages/CA0117Workspace"));
const DashboardLogistica = lazy(() => import("../modules/logistica/Dashboard"));
const ClientRequests = lazy(() => import("../modules/backoffice/pages/ClientRequests"));
const ClientRequestReview = lazy(() => import("../modules/backoffice/pages/ClientRequestReview"));
const DeterminationsCatalog = lazy(() => import("../modules/operaciones/pages/DeterminationsCatalog"));
const AsistenciaReportes = lazy(() => import("../modules/talento/pages/AsistenciaReportes"));
const TechnicalTestResponsiblePage = lazy(() => import("../modules/talento/pages/TechnicalTestResponsiblePage"));
const DocumentosReportePage = lazy(() => import("../modules/talento/pages/DocumentosReportePage"));

// â”€â”€ Capacitaciones â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CapacitacionesWorkspace = lazy(() => import("../modules/capacitaciones/pages/CapacitacionesWorkspace"));
const CapacitacionDetailPage  = lazy(() => import("../modules/capacitaciones/pages/CapacitacionDetailPage"));

// â”€â”€ Usuarios externos (ing_servicio_ext / esp_app_ext) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ExtUserDashboard = lazy(() => import("../modules/ext-users/pages/ExtUserDashboard"));

// â”€â”€ CRM-Fam â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CrmDashboardPage     = lazy(() => import("../modules/crm-fam/pages/CrmDashboardPage"));
const AccountsPage         = lazy(() => import("../modules/crm-fam/pages/AccountsPage"));
const AccountDetailPage    = lazy(() => import("../modules/crm-fam/pages/AccountDetailPage"));
const ContactsPage         = lazy(() => import("../modules/crm-fam/pages/ContactsPage"));
const LeadsPage            = lazy(() => import("../modules/crm-fam/pages/LeadsPage"));
const CrmOpportunitiesPage = lazy(() => import("../modules/crm-fam/pages/OpportunitiesPage"));
const OpportunityDetailPage= lazy(() => import("../modules/crm-fam/pages/OpportunityDetailPage"));
const BlueSheetPage        = lazy(() => import("../modules/crm-fam/pages/BlueSheetPage"));
const CrmActivitiesPage    = lazy(() => import("../modules/crm-fam/pages/CrmActivitiesPage"));
const CrmReportsPage       = lazy(() => import("../modules/crm-fam/pages/CrmReportsPage"));
const CrmSettingsPage      = lazy(() => import("../modules/crm-fam/pages/CrmSettingsPage"));
const CrmShell             = lazy(() => import("../modules/crm-fam/pages/CrmShell"));
const WorkManagementPage   = lazy(() => import("../modules/work-management/pages/WorkManagementPage"));

// â”€â”€ Kick Off 2026 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AllNotificationsPage    = lazy(() => import("../modules/notifications/pages/AllNotificationsPage"));
const KickoffPage             = lazy(() => import("../modules/kickoff/pages/KickoffPage"));
const KickoffPresentationPage = lazy(() => import("../modules/kickoff/pages/KickoffPresentationPage"));
const KickoffQuestionRoomPage = lazy(() => import("../modules/kickoff/pages/KickoffQuestionRoomPage"));
const KickoffQREntryPage      = lazy(() => import("../modules/kickoff/pages/KickoffQREntryPage"));
const FamDaysPage             = lazy(() => import("../modules/famdays/pages/FamDaysPage"));
const FamDaysQREntryPage      = lazy(() => import("../modules/famdays/pages/FamDaysQREntryPage"));
const WorldCup2026PortalPage  = lazy(() => import("../modules/world-cup-2026/pages/WorldCup2026PortalPage"));

const routeFallback = (
  <div className="flex justify-center items-center min-h-[50vh]">
    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
  </div>
);

const commercialDashboardRoles = [
  "comercial",
  "jefe_comercial",
  "backoffice_comercial",
  "acp_comercial",
  "gerencia",
  "gerencia_general",
  "gerente_general",
  "director",
];

const peopleNavigationRoles = [
  "ti",
  "jefe_ti",
];

// Las paginas legacy de compras (equipment-purchases, acp-compras,
// backoffice|logistica|operaciones/private-purchases) redirigen al panel
// unificado. Traduce el param legacy de id (requestId para publicas,
// purchaseId para privadas) al requestId/requestType que PurchasesWorkspace
// usa para el deep-link, para que abrir un enlace de notificacion siga
// llevando al expediente correcto en vez de solo a la lista general.
const makeLegacyPurchaseRedirect = (purchaseType, legacyIdParam) => () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const legacyId = params.get(legacyIdParam);
  params.delete(legacyIdParam);
  params.set("tab", purchaseType);
  if (legacyId) {
    params.set("requestId", legacyId);
    params.set("requestType", purchaseType);
  }
  return <Navigate to={`/dashboard/purchases/workspace?${params.toString()}`} replace />;
};

const LegacyPublicPurchaseRedirect = makeLegacyPurchaseRedirect("public", "requestId");
const LegacyPrivatePurchaseRedirect = makeLegacyPurchaseRedirect("private", "purchaseId");

const AppRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const backgroundLocation = location.state?.backgroundLocation;

  const closeProfileModal = () => {
    if (backgroundLocation) {
      navigate(-1);
      return;
    }
    navigate("/dashboard", { replace: true });
  };

  const profileModalElement = (
    <Modal
      open
      onClose={closeProfileModal}
      title="Mi Perfil"
      maxWidth="max-w-6xl"
    >
      <MyProfilePage embedded />
    </Modal>
  );

  return (
    <Suspense fallback={routeFallback}>
      <Routes location={backgroundLocation || location}>
      {/* =======================================
          ðŸŒ RUTAS PÃšBLICAS
      ======================================= */}
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/login/callback" element={<LoginCallback />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/registro-en-proceso" element={<RolePending />} />
        <Route path="/predicciones/mundial-2026" element={<WorldCup2026PortalPage />} />

        {/* ðŸ“ VerificaciÃ³n pÃºblica de documentos firmados */}
        <Route path="/verificar/:token" element={<DocumentVerification />} />
        <Route path="/verificar/famsign/:token" element={<SignatureWorkflowVerificationPage />} />
        {/* ðŸš€ Kick Off 2026 â€” entrada por QR (validaciÃ³n por token, sin rol previo) */}
        <Route path="/kickoff/sala/:token" element={<KickoffQREntryPage />} />
        <Route path="/famdays/sala/:token" element={<FamDaysQREntryPage />} />
        <Route path="/cumpleanos/canje/:token" element={<BirthdayBenefitRedeemPage />} />
      </Route>

      {/* =======================================
          ðŸ”’ RUTAS PRIVADAS (requieren token JWT)
      ======================================= */}
      <Route
        element={
          <ProtectedRoute
            allowedRoles={[
              "gerencia",
              "gerencia_general",
              "finanzas",
              "financiero",
              "jefe_finanzas",
              "jefe_financiero",
              "comercial",
              "jefe_comercial",
              "backoffice_comercial",
              "acp_comercial",
              "servicio_tecnico",
              "jefe_tecnico",
              "jefe_servicio",
              "jefe_servicio_tecnico",
              "tecnico",
              "ing_servicio",
              "esp_app",
              "ing_servicio_ext",
              "esp_app_ext",
              "talento_humano",
              "ti",
              "jefe_ti",
              "admin_ti",
              "operaciones",
              "jefe_operaciones",
              "jefe_de_operaciones",
              "logistica",
              "jefe_logistica",
              "calidad",
              "jefe_calidad",
            ]}
          />
        }
      >
        {/* RedirecciÃ³n automÃ¡tica segÃºn rol */}
        <Route path="/dashboard" element={<RoleRedirect />} />

        {/* ðŸ“± Atajos de asistencia (requiere login previo) */}
        <Route path="/mobile-shortcuts" element={<MobileShortcuts />} />
        <Route path="/asistencia/mobile-shortcuts" element={<MobileShortcuts />} />
        <Route path="/asistencia/marcar/:action" element={<AttendanceAction />} />

        {/* Layout principal */}
        <Route element={<DashboardLayout />}>
          {/* Dashboards principales */}
          <Route path="/dashboard/gerencia" element={<DashboardGerencia />} />
          <Route path="/dashboard/gerencia/aprobaciones-contratos" element={<PurchasesAlbumPage />} />
          <Route path="/dashboard/gerencia/compras-album" element={<PurchasesAlbumPage />} />
          <Route path="/dashboard/finanzas" element={<DashboardFinanzas />} />
          <Route element={<ProtectedRoute allowedRoles={commercialDashboardRoles} />}>
            <Route path="/dashboard/comercial" element={<DashboardComercial />} />
          </Route>

          {/* Subrutas Comercial */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["comercial", "jefe_comercial", "jefe_financiero", "gerencia", "gerencia_general"]}
              />
            }
          >
            <Route path="/dashboard/comercial/solicitudes" element={<SolicitudesPage />} />
            <Route element={<ClientesPlanShell />}>
              <Route path="/dashboard/comercial/clientes" element={<ClientesPage />} />
              <Route path="/dashboard/comercial/planificacion" element={<PlanificacionMensual />} />
            </Route>
            <Route path="/dashboard/comercial/new-client-request" element={<NewClientRequest />} />
            <Route path="/dashboard/comercial/equipment-purchases" element={<LegacyPublicPurchaseRedirect />} />
            <Route path="/dashboard/comercial/delivery-ceilings" element={<DeliveryCeilingsPage />} />
            <Route path="/dashboard/comercial/famsheets" element={<OpportunitiesPage />} />
            <Route path="/dashboard/comercial/famsheets/dashboard" element={<FamSheetsDashboardPage />} />
            <Route path="/dashboard/comercial/famsheets/:id" element={<OpportunityWorkspace />} />
            <Route path="/dashboard/comercial/opportunities" element={<Navigate to="/dashboard/comercial/famsheets" replace />} />
            <Route path="/dashboard/comercial/opportunities/:id" element={<OpportunityWorkspace />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["acp_comercial"]} />}>
            <Route path="/dashboard/comercial/acp-compras" element={<LegacyPublicPurchaseRedirect />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["jefe_comercial", "gerencia", "gerencia_general", "admin", "administrador"]} />}>
            <Route path="/dashboard/comercial/aprobaciones-planificacion" element={<AprobacionCronogramas />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  // Debe coincidir con businessCaseRoles del backend
                  // (ver CONTEXT.md del modulo business-case) -- mantener
                  // sincronizado para no bloquear a un rol que el backend
                  // si autoriza.
                  "comercial",
                  "asesor_comercial",
                  "analista_comercial",
                  "acp_comercial",
                  "backoffice",
                  "backoffice_comercial",
                  "jefe_comercial",
                  "jefe_de_comercial",
                  "gerencia",
                  "gerencia_general",
                  "operaciones",
                  "jefe_operaciones",
                  "jefe_de_operaciones",
                  "servicio_tecnico",
                  "jefe_tecnico",
                  "jefe_servicio",
                  "jefe_servicio_tecnico",
                  "ing_servicio",
                  "esp_app",
                  "jefe_financiero",
                  "jefe_ti",
                ]}
              />
            }
          >
            <Route path="/dashboard/business-case" element={<BusinessCaseWorkspace />} />
            <Route path="/dashboard/comercial/business-case" element={<BusinessCaseWorkspace />} />
            <Route path="/dashboard/business-case/workspace" element={<BusinessCaseWorkspace />} />
            <Route path="/dashboard/business-case/workspace/:id" element={<BusinessCaseWorkspace />} />
          </Route>
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "jefe_comercial",
                  "jefe_tecnico",
                  "jefe_operaciones",
                  "gerencia",
                  "gerencia_general",
                  "admin",
                  "administrador",
                ]}
              />
            }
          >
            <Route
              path="/dashboard/business-case/observabilidad"
              element={<BusinessCaseObservabilityDashboard />}
            />
          </Route>

          {/* Dashboard usuarios externos (ing_servicio_ext / esp_app_ext) */}
          <Route
            element={<ProtectedRoute allowedRoles={["ing_servicio_ext", "esp_app_ext"]} strictRoles />}
          >
            <Route path="/dashboard/ext" element={<ExtUserDashboard />} />
          </Route>

          <Route path="/dashboard/servicio-tecnico" element={<DashboardServicio />} />
          <Route path="/dashboard/servicio-tecnico/cronograma" element={<ServicioDisponibilidad mode="cronograma" />} />
          <Route path="/dashboard/servicio-tecnico/inspecciones" element={<Navigate to="/dashboard/servicio-tecnico/solicitudes" replace />} />
          <Route path="/dashboard/servicio-tecnico/correctivos" element={<ServicioMantenimientos initialTab="corrective" />} />
          <Route path="/dashboard/servicio-tecnico/mantenimientos" element={<ServicioMantenimientos />} />
          <Route path="/dashboard/servicio-tecnico/solicitudes" element={<ServicioSolicitudes />} />
          <Route path="/dashboard/servicio-tecnico/disponibilidad" element={<ServicioDisponibilidad />} />
          <Route path="/dashboard/servicio-tecnico/capacitaciones" element={<ServicioCapacitaciones />} />
          <Route path="/dashboard/servicio-tecnico/equipos" element={<ServicioEquipos />} />
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "comercial",
                  "jefe_comercial",
                  "backoffice_comercial",
                  "acp_comercial",
                  "servicio_tecnico",
                  "tecnico",
                  "ing_servicio",
                  "esp_app",
                  "jefe_tecnico",
                  "jefe_servicio",
                  "jefe_servicio_tecnico",
                  "operaciones",
                  "jefe_operaciones",
                  "logistica",
                  "jefe_logistica",
                  "gerencia",
                  "gerencia_general",
                  "ti",
                  "admin_ti",
                  "admin",
                  "administrador",
                ]}
              />
            }
          >
            <Route path="/dashboard/equipos" element={<EquipmentWorkspace />} />
            <Route path="/dashboard/equipos/activos" element={<EquipmentWorkspace />} />
          </Route>
          <Route path="/dashboard/servicio-tecnico/aprobaciones" element={<ServicioAprobaciones />} />
          <Route path="/dashboard/servicio-tecnico/aplicaciones" element={<ServicioAplicaciones />} />
          <Route path="/dashboard/servicio-tecnico/desinfeccion" element={<ServicioDesinfeccion />} />
          <Route path="/dashboard/servicio-tecnico/asistencia" element={<ServicioAsistencia />} />
          <Route path="/dashboard/servicio-tecnico/verificacion" element={<ServicioVerificacionEquipos />} />
          <Route
            element={<ProtectedRoute allowedRoles={["servicio_tecnico", "jefe_tecnico", "jefe_servicio", "jefe_servicio_tecnico", "tecnico", "ing_servicio", "esp_app"]} />}
          >
            <Route path="/dashboard/servicio-tecnico/workspace-procedimiento" element={<Navigate to="/dashboard/purchases/workspace?tab=public&subtab=tecnica" replace />} />
            <Route path="/dashboard/servicio-tecnico/retiros" element={<Navigate to="/dashboard/servicio-tecnico/solicitudes" replace />} />
          </Route>
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "servicio_tecnico",
                  "tecnico",
                  "ing_servicio",
                  "esp_app",
                  "jefe_tecnico",
                  "jefe_servicio",
                  "jefe_servicio_tecnico",
                  "ti",
                  "jefe_ti",
                  "admin_ti",
                  "gerencia",
                  "gerencia_general",
                ]}
              />
            }
          >
            <Route path="/dashboard/servicio-tecnico/casos-externos" element={<ServicioExternalCasesWorkspace />} />
            <Route path="/dashboard/ti/casos-externos" element={<ServicioExternalCasesWorkspace />} />
          </Route>
          <Route
            element={<ProtectedRoute allowedRoles={["jefe_tecnico", "jefe_servicio", "jefe_servicio_tecnico", "tecnico", "ing_servicio"]} />}
          >
            <Route path="/dashboard/servicio-tecnico/entregas-privadas" element={<Navigate to="/dashboard/purchases/workspace?tab=private" replace />} />
          </Route>
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["talento_humano", "jefe_talento_humano", "ti", "jefe_ti", "admin_ti"]}
                strictRoles
              />
            }
          >
            <Route path="/dashboard/talento-humano" element={<DashboardTalento />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={["ti", "jefe_ti", "admin_ti"]} />}>
            <Route path="/dashboard/ti" element={<DashboardTI />} />
            <Route path="/dashboard/ti/workspace" element={<TicketsWorkspace />} />
            <Route path="/dashboard/ti/dispositivos" element={<TIDeviceManagementPage />} />
            <Route path="/dashboard/ti/actas" element={<TIActasPage />} />
            <Route path="/dashboard/ti/mantenimientos" element={<Navigate to="/dashboard/ti/dispositivos" replace />} />
            <Route path="/dashboard/ti/shortcut-token" element={<TIShortcutTokenPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={["jefe_ti", "admin_ti"]} />}>
            <Route path="/dashboard/ti/modulos" element={<TIModuleAccessPage />} />
            <Route path="/dashboard/ti/modulos/*" element={<TIModuleAccessPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={[
            "financiero", "jefe_financiero", "finanzas", "jefe_finanzas", "contador",
            "ti", "jefe_ti", "admin_ti", "gerencia", "gerencia_general",
          ]} />}>
            <Route path="/dashboard/ti/activos" element={<TIAssetsFinancieroPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={["financiero", "jefe_financiero", "talento_humano", "jefe_tecnico", "jefe_servicio"]} />}>
            <Route path="/dashboard/collab/entregas" element={<CollabDeliveriesFinancieroPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={["gerencia_general", "gerencia"]} />}>
            <Route path="/dashboard/collab/resumen" element={<CollabDeliveriesGerenciaPage />} />
          </Route>
          <Route path="/dashboard/operaciones" element={<DashboardOperaciones />} />
          <Route path="/dashboard/logistica" element={<DashboardLogistica />} />
          <Route path="/dashboard/calidad" element={<DashboardCalidad />} />
          <Route path="/dashboard/calidad/temperatura" element={<CA0101Workspace />} />
          <Route path="/dashboard/calidad/limpieza" element={<CA0102Workspace />} />
          <Route path="/dashboard/calidad/buenas-practicas" element={<CA0103Workspace />} />
          <Route path="/dashboard/calidad/plagas" element={<CA0104Workspace />} />
          <Route path="/dashboard/calidad/documentos" element={<CA0105Workspace />} />
          <Route path="/dashboard/calidad/recall" element={<CA0106Workspace />} />
          <Route path="/dashboard/calidad/quejas" element={<CA0107Workspace />} />
          <Route path="/dashboard/calidad/refrigerados" element={<CA0108Workspace />} />
          <Route path="/dashboard/calidad/capa" element={<CA0109Workspace />} />
          <Route path="/dashboard/calidad/riesgos" element={<CA0110Workspace />} />
          <Route path="/dashboard/calidad/incidentes" element={<CA0111Workspace />} />
          <Route path="/dashboard/calidad/higiene" element={<CA0112Workspace />} />
          <Route path="/dashboard/calidad/comunicaciones" element={<CA0113Workspace />} />
          <Route path="/dashboard/calidad/areas" element={<CA0114Workspace />} />
          <Route path="/dashboard/calidad/auditorias" element={<CA0115Workspace />} />
          <Route path="/dashboard/calidad/muestreo" element={<CA0116Workspace />} />
          <Route path="/dashboard/calidad/tecnovigilancia" element={<CA0117Workspace />} />
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "comercial",
                  "jefe_comercial",
                  "backoffice_comercial",
                  "acp_comercial",
                  "gerencia",
                  "gerencia_general",
                  "operaciones",
                  "jefe_operaciones",
                  "jefe_de_operaciones",
                  "admin",
                  "administrador",
                  "ti",
                ]}
              />
            }
          >
            <Route path="/dashboard/clientes" element={<ClientesPage />} />
          </Route>
          <Route path="/dashboard/operaciones/determinaciones" element={<DeterminationsCatalog />} />
          <Route path="/dashboard/links-interes" element={<LinksInteres />} />

          {/* Subrutas Operaciones - Compras Privadas */}
          <Route element={<ProtectedRoute allowedRoles={["jefe_operaciones", "jefe_de_operaciones"]} />}>
            <Route path="/dashboard/operaciones/clientes" element={<ClientesPage />} />
            <Route path="/dashboard/operaciones/private-purchases" element={<LegacyPrivatePurchaseRedirect />} />
          </Route>

          {/* Subrutas LogÃ­stica - Compras Privadas */}
          <Route element={<ProtectedRoute allowedRoles={["jefe_logistica"]} />}>
            <Route path="/dashboard/logistica/private-purchases" element={<LegacyPrivatePurchaseRedirect />} />
          </Route>

          {/* Pruebas tÃ©cnicas asignadas â€” accesible para cualquier usuario autenticado */}
          <Route path="/dashboard/talento-humano/pruebas-tecnicas" element={<TechnicalTestResponsiblePage />} />

          {/* Capacitaciones */}
          <Route path="/dashboard/capacitaciones" element={<CapacitacionesWorkspace />} />
          <Route path="/dashboard/capacitaciones/:id" element={<CapacitacionDetailPage />} />

          {/* Subrutas Talento Humano */}
          <Route
            element={<ProtectedRoute allowedRoles={["talento_humano", "gerencia_general"]} />}
          >
            <Route path="/dashboard/talento-humano/reporte-documentacion" element={<DocumentosReportePage />} />
          </Route>
          <Route path="/dashboard/talento-humano/command-center" element={<CollaboratorCommandCenter />} />
          <Route path="/dashboard/talento-humano/command-center/:kind" element={<CollaboratorCommandCenter />} />
          <Route path="/dashboard/talento-humano/command-center/:kind/:id" element={<CollaboratorCommandCenter />} />
          <Route path="/dashboard/talento-humano/colaboradores" element={<CollaboratorCommandCenter initialView="colaboradores" />} />
          <Route path="/dashboard/talento-humano/colaboradores/:id" element={<CollaboratorCommandCenter initialView="colaboradores" />} />
          <Route element={<ProtectedRoute allowedRoles={peopleNavigationRoles} strictRoles />}>
            <Route path="/dashboard/talento-humano/gestion" element={<PeopleAdminHub initialTab="usuarios" />} />
            <Route path="/dashboard/talento-humano/usuarios" element={<PeopleAdminHub initialTab="usuarios" />} />
            <Route path="/dashboard/talento-humano/departamentos" element={<PeopleAdminHub initialTab="departamentos" />} />
          </Route>
          <Route
            path="/dashboard/talento-humano/solicitudes"
            element={<CollaboratorCommandCenter initialView="solicitudes" />}
          />
          <Route
            element={<ProtectedRoute allowedRoles={["talento_humano", "gerencia", "gerencia_general", "admin"]} />}
          >
            <Route path="/dashboard/talento-humano/workspace-personal" element={<CollaboratorCommandCenter initialView="solicitudes" />} />
            <Route path="/dashboard/talento-humano/workspace-personal/:id" element={<CollaboratorCommandCenter initialView="solicitudes" />} />
          </Route>
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "talento_humano",
                  "jefe_talento_humano",
                  "jefe_de_talento_humano",
                  "analista_talento_humano",
                  "asistente_talento_humano",
                  "auxiliar_talento_humano",
                  "rh",
                  "rrhh",
                  "gerencia",
                  "gerencia_general",
                  "gerente_general",
                  "director",
                  "finanzas",
                  "financiero",
                  "jefe_finanzas",
                  "jefe_financiero",
                  "admin",
                  "administrador",
                ]}
              />
            }
          >
            <Route
              path="/dashboard/talento-humano/asistencia-reportes"
              element={<AsistenciaReportes />}
            />
          </Route>
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "finanzas",
                  "financiero",
                  "jefe_finanzas",
                  "jefe_financiero",
                  "gerencia",
                  "gerencia_general",
                  "comercial",
                  "jefe_comercial",
                  "acp_comercial",
                  "backoffice_comercial",
                  "servicio_tecnico",
                  "tecnico",
                  "ing_servicio",
                  "esp_app",
                  "jefe_tecnico",
                  "jefe_servicio",
                  "jefe_servicio_tecnico",
                  "ti",
                  "jefe_ti",
                  "talento_humano",
                  "jefe_talento_humano",
                  "ing_servicio_ext",
                  "esp_app_ext",
                ]}
              />
            }
          >
            <Route path="/dashboard/finanzas/viaticos" element={<ViaticosWorkspace />} />
          </Route>
          <Route path="/dashboard/talento-humano/permisos" element={<PermisosPage />} />

          {/* AuditorÃ­a (solo Gerencia y TI) */}
          <Route element={<ProtectedRoute allowedRoles={["gerencia", "gerencia_general", "gerente_general", "ti"]} />}>
            <Route path="/dashboard/auditoria" element={<Auditoria />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "admin_ti",
                  "jefe_ti",
                  "ti",
                  "gerencia",
                  "gerencia_general",
                  "calidad",
                  "finanzas",
                  "financiero",
                  "comercial",
                  "jefe_comercial",
                  "talento_humano",
                  "operaciones",
                  "jefe_calidad",
                ]}
              />
            }
          >
            <Route path="/dashboard/auditoria/preparacion" element={<AuditPrepPage />} />
          </Route>

          {/* Rutas compartidas */}
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/mantenimientos" element={<MantenimientosPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/configuration" element={<ConfigurationPage />} />
          <Route path="/dashboard/mi-perfil" element={backgroundLocation ? null : profileModalElement} />
          <Route path="/dashboard/notificaciones" element={<AllNotificationsPage />} />

          {/* ðŸš€ Kick Off 2026 â€” acceso controlado por backend (whitelist + is_open) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard/kickoff" element={<KickoffPage />} />
            <Route path="/dashboard/kickoff/presentacion/:presentationId" element={<KickoffPresentationPage />} />
            <Route path="/dashboard/kickoff/sala/:presentationId" element={<KickoffQuestionRoomPage />} />
            <Route path="/dashboard/famdays" element={<FamDaysPage />} />
          </Route>

          {/* ðŸ“ Sistema de Firma Digital â€” transversal: cualquier rol activo puede ser firmante */}
          <Route
            element={<ProtectedRoute allowedRoles={[]} />}
          >
            <Route path="/dashboard/signatures" element={<Navigate to="/dashboard/signatures/inbox" replace />} />
            <Route path="/dashboard/signatures/inbox" element={<SignatureDashboard />} />
            <Route path="/dashboard/signatures/created" element={<SignatureDashboard />} />
            <Route path="/dashboard/signatures/completed" element={<SignatureDashboard />} />
            <Route path="/dashboard/signatures/all" element={<SignatureDashboard />} />
            <Route path="/dashboard/signatures/:documentId/sign" element={<DocumentSigner />} />
            <Route path="/dashboard/signatures/workflows/:workflowId" element={<SignatureWorkflowDetailPage />} />
          </Route>
          {/* Subrutas Backoffice */}
          <Route
            element={(
              <ProtectedRoute
                allowedRoles={[
                  "backoffice_comercial",
                  "gerencia",
                  "calidad",
                  "jefe_calidad",
                  "comercial",
                  "jefe_comercial",
                  "acp_comercial",
                ]}
              />
            )}
          >
            <Route path="/dashboard/backoffice/client-requests" element={<ClientRequests />} />
            <Route path="/dashboard/backoffice/client-request/:id" element={<ClientRequestReview />} />
            <Route
              element={(
                <ProtectedRoute
                  allowedRoles={[
                    "backoffice_comercial",
                    "gerencia",
                    "comercial",
                    "jefe_comercial",
                    "acp_comercial",
                  ]}
                />
              )}
            >
              <Route path="/dashboard/backoffice/private-purchases" element={<LegacyPrivatePurchaseRedirect />} />
            </Route>
          </Route>

          {/* â”€â”€ CRM-Fam â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "comercial","jefe_comercial","jefe_de_comercial",
                  "backoffice_comercial","asesor_comercial","analista_comercial",
                  "acp_comercial","backoffice",
                  "gerencia","gerencia_general","gerente_general","director","gerente",
                  "jefe_ti","jefe_de_ti",
                ]}
              />
            }
          >
            <Route element={<CrmShell />}>
              <Route path="/dashboard/crm-fam"                               element={<CrmDashboardPage />} />
              <Route path="/dashboard/crm-fam/accounts"                     element={<AccountsPage />} />
              <Route path="/dashboard/crm-fam/accounts/:id"                 element={<AccountDetailPage />} />
              <Route path="/dashboard/crm-fam/contacts"                     element={<ContactsPage />} />
              <Route path="/dashboard/crm-fam/leads"                        element={<LeadsPage />} />
              <Route path="/dashboard/crm-fam/opportunities"                element={<CrmOpportunitiesPage />} />
              <Route path="/dashboard/crm-fam/opportunities/:id"            element={<OpportunityDetailPage />} />
              <Route path="/dashboard/crm-fam/opportunities/:opportunityId/blue-sheet" element={<BlueSheetPage />} />
              <Route path="/dashboard/crm-fam/activities"                   element={<CrmActivitiesPage />} />
              <Route path="/dashboard/crm-fam/reports"                      element={<CrmReportsPage />} />
              <Route path="/dashboard/crm-fam/settings"                     element={<CrmSettingsPage />} />
            </Route>
          </Route>

          {/* ðŸ›’ Workspace de Compras Unificado */}
          <Route
            element={(
              <ProtectedRoute
                allowedRoles={[
                  "comercial",
                  "jefe_comercial",
                  "acp_comercial",
                  "gerencia",
                  "gerencia_general",
                  "jefe_tecnico",
                  "jefe_servicio",
                  "jefe_servicio_tecnico",
                  "tecnico",
                  "ing_servicio",
                  "jefe_operaciones",
                  "operaciones",
                  "jefe_logistica",
                  "logistica",
                  "backoffice_comercial",
                ]}
              />
            )}
          >
            <Route path="/dashboard/purchases/workspace" element={<PurchasesWorkspace />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "comercial",
                  "jefe_comercial",
                  "backoffice_comercial",
                  "asesor_comercial",
                  "analista_comercial",
                  "acp_comercial",
                  "backoffice",
                  "gerencia",
                  "gerencia_general",
                  "gerente_general",
                  "director",
                  "gerente",
                  "jefe_ti",
                  "jefe_de_ti",
                  "admin",
                  "administrador",
                  "jefe_servicio",
                  "jefe_servicio_tecnico",
                  "jefe_tecnico",
                  "ing_servicio",
                  "esp_app",
                  "tecnico",
                  "operaciones",
                  "jefe_operaciones",
                  "logistica",
                  "jefe_logistica",
                ]}
              />
            }
          >
            <Route path="/dashboard/work-management" element={<WorkManagementPage />} />
            <Route path="/dashboard/work-management/projects/:projectId" element={<WorkManagementPage />} />
          </Route>
        </Route>

      </Route>

      {/* =======================================
          ðŸ” REDIRECCIONES Y ERRORES
      ======================================= */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
      </Routes>
      {backgroundLocation ? (
        <Routes>
          <Route
            path="/dashboard/mi-perfil"
            element={
              profileModalElement
            }
          />
        </Routes>
      ) : null}
    </Suspense>
  );
};

export default AppRoutes;
