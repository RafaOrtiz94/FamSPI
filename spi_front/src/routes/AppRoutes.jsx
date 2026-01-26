import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";


// 🧠 Contextos y protecciones
import { ProtectedRoute } from "../core/auth/ProtectedRoute";
import { RoleRedirect } from "../core/auth/ProtectedRoute";

// 🏠 Layouts
import PublicLayout from "../core/layout/PublicLayout";
import DashboardLayout from "../core/layout/DashboardLayout";

// 🪪 Páginas públicas
import Login from "../modules/shared/pages/Login";
import LoginCallback from "../modules/shared/pages/LoginCallback";
import FirstLoginSignature from "../modules/shared/pages/FirstLoginSignature";
import NotFound from "../modules/shared/pages/NotFound";
import Unauthorized from "../modules/shared/pages/Unauthorized";

// 🧭 Dashboards por rol
import DashboardGerencia from "../modules/gerencia/Dashboard";
import DashboardFinanzas from "../modules/finanzas/Dashboard";
import DashboardComercial from "../modules/comercial/pages/Dashboard";
import SolicitudesPage from "../modules/comercial/pages/Solicitudes";
import ClientesPage from "../modules/comercial/pages/Clientes";
import NewClientRequest from "../modules/comercial/pages/NewClientRequest";
import EquipmentPurchasesPage from "../modules/comercial/pages/EquipmentPurchases";
import ACPEquipmentPurchasesPage from "../modules/comercial/pages/ACPEquipmentPurchases";
import BusinessCasePage from "../modules/comercial/pages/BusinessCase";
import UnifiedBCView from "../modules/comercial/pages/UnifiedBCView";
import BusinessCaseWizard from "../modules/comercial/pages/BusinessCaseWizard";
import BusinessCaseWorkspace from "../modules/comercial/pages/BusinessCaseWorkspace";
import ManualBCForm from "../modules/comercial/pages/ManualBCForm";
import PlanificacionMensual from "../modules/comercial/pages/PlanificacionMensual";
import AprobacionCronogramas from "../modules/comercial/pages/AprobacionCronogramas";
import DashboardServicio from "../modules/servicio/pages/Dashboard";
import ServicioMantenimientos from "../modules/servicio/pages/Mantenimientos";
import ServicioSolicitudes from "../modules/servicio/pages/Solicitudes";
import ServicioDisponibilidad from "../modules/servicio/pages/Disponibilidad";
import ServicioCapacitaciones from "../modules/servicio/pages/Capacitaciones";
import ServicioEquipos from "../modules/servicio/pages/Equipos";
import ServicioAprobaciones from "../modules/servicio/pages/Aprobaciones";
import ServicioAplicaciones from "../modules/servicio/pages/Aplicaciones";
import ServicioDesinfeccion from "../modules/servicio/pages/Desinfeccion";
import ServicioAsistencia from "../modules/servicio/pages/Asistencia";
import ServicioVerificacionEquipos from "../modules/servicio/pages/VerificacionEquipos";
import ServicioPrivatePurchaseDeliveries from "../modules/servicio/pages/PrivatePurchaseDeliveries";
import TecnicoPrivatePurchases from "../modules/servicio/pages/TecnicoPrivatePurchases";
import DashboardTalento from "../modules/talento/Dashboard";
import DashboardTI from "../modules/talento/DashboardTI";
import DashboardOperaciones from "../modules/operaciones/Dashboard";
import DashboardCalidad from "../modules/calidad/Dashboard";
import DashboardLogistica from "../modules/logistica/Dashboard";
import ClientRequests from "../modules/backoffice/pages/ClientRequests";
import ClientRequestReview from "../modules/backoffice/pages/ClientRequestReview";
import PrivatePurchasesPage from "../modules/backoffice/pages/PrivatePurchases";
import DeterminationsCatalog from "../modules/operaciones/pages/DeterminationsCatalog";
import OperacionesPrivatePurchases from "../modules/operaciones/pages/OperacionesPrivatePurchases";
import LogisticaPrivatePurchases from "../modules/logistica/pages/LogisticaPrivatePurchases";

// 🛒 Workspace de Compras Unificado
import PurchasesWorkspace from "../modules/shared/purchases-workspace/PurchasesWorkspace";

// 📋 Páginas de Talento Humano
import Usuarios from "../modules/talento/pages/Usuarios";
import Departamentos from "../modules/talento/pages/Departamentos";
import PermisosPage from "../modules/shared/solicitudes/pages/PermisosPage";

// 🧾 Páginas compartidas
import RequestsPage from "../modules/RequestsPage";
import MantenimientosPage from "../modules/MantenimientosPage";
import DocumentsPage from "../modules/DocumentsPage";
import Auditoria from "../modules/gerencia/Auditoria";
import ConfigurationPage from "../pages/ConfigurationPage";
import MyProfilePage from "../modules/profile/MyProfilePage";
import AuditPrepPage from "../modules/audit-prep/AuditPrepPage";

// 📝 Sistema de Firma Digital
import DocumentSigner from "../modules/signature/components/DocumentSigner";
import DocumentVerification from "../modules/signature/pages/DocumentVerification";
import SignatureDashboard from "../modules/signature/pages/SignatureDashboard";


// Lazy loaded components
const Solicitudes = lazy(() => import("../modules/talento/pages/Solicitudes"));
const AsistenciaReportes = lazy(() => import("../modules/talento/pages/AsistenciaReportes"));

const AppRoutes = () => {
  return (
    <Routes>
      {/* =======================================
          🌐 RUTAS PÚBLICAS
      ======================================= */}
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/login/callback" element={<LoginCallback />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* 📝 Verificación pública de documentos firmados */}
        <Route path="/verificar/:token" element={<DocumentVerification />} />
      </Route>

      {/* =======================================
          🔒 RUTAS PRIVADAS (requieren token JWT)
      ======================================= */}
      <Route
        element={
          <ProtectedRoute
            allowedRoles={[
              "gerencia",
              "gerencia_general",
              "finanzas",
              "jefe_financiero",
              "comercial",
              "jefe_comercial",
              "backoffice_comercial",
              "acp_comercial",
              "servicio_tecnico",
              "jefe_tecnico",
              "jefe_servicio_tecnico",
              "talento_humano",
              "ti",
              "operaciones",
              "jefe_logistica",
              "calidad",
            ]}
          />
        }
      >
        {/* Redirección automática según rol */}
        <Route path="/dashboard" element={<RoleRedirect />} />

        {/* Layout principal */}
        <Route element={<DashboardLayout />}>
          {/* Dashboards principales */}
          <Route path="/dashboard/gerencia" element={<DashboardGerencia />} />
          <Route path="/dashboard/finanzas" element={<DashboardFinanzas />} />
          <Route path="/dashboard/comercial" element={<DashboardComercial />} />

          {/* Subrutas Comercial */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["comercial", "jefe_comercial", "gerencia", "gerencia_general"]}
              />
            }
          >
            <Route path="/dashboard/comercial/solicitudes" element={<SolicitudesPage />} />
            <Route path="/dashboard/comercial/clientes" element={<ClientesPage />} />
            <Route path="/dashboard/comercial/new-client-request" element={<NewClientRequest />} />
            <Route path="/dashboard/comercial/equipment-purchases" element={<EquipmentPurchasesPage />} />
            <Route path="/dashboard/comercial/planificacion" element={<PlanificacionMensual />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["acp_comercial"]} />}>
            <Route path="/dashboard/comercial/acp-compras" element={<ACPEquipmentPurchasesPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["jefe_comercial", "gerencia", "gerencia_general", "admin", "administrador"]} />}>
            <Route path="/dashboard/comercial/aprobaciones-planificacion" element={<AprobacionCronogramas />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "comercial",
                  "acp_comercial",
                  "jefe_comercial",
                  "gerencia",
                  "gerencia_general",
                  "operaciones",
                  "jefe_operaciones",
                  "servicio_tecnico",
                  "jefe_tecnico",
                  "jefe_servicio_tecnico",
                ]}
              />
            }
          >
            <Route path="/dashboard/business-case" element={<BusinessCasePage />} />
            <Route path="/dashboard/comercial/business-case" element={<BusinessCasePage />} />
            <Route path="/dashboard/business-case/:id/view" element={<UnifiedBCView />} />
            {/* Wizard route removed - no longer accessible from UI */}
            <Route path="/dashboard/business-case/workspace" element={<BusinessCaseWorkspace />} />
            <Route path="/dashboard/business-case/workspace/:id" element={<BusinessCaseWorkspace />} />
            <Route path="/dashboard/business-case/:id/manual-form" element={<ManualBCForm />} />
          </Route>

          <Route path="/dashboard/servicio-tecnico" element={<DashboardServicio />} />
          <Route path="/dashboard/servicio-tecnico/mantenimientos" element={<ServicioMantenimientos />} />
          <Route path="/dashboard/servicio-tecnico/solicitudes" element={<ServicioSolicitudes />} />
          <Route path="/dashboard/servicio-tecnico/disponibilidad" element={<ServicioDisponibilidad />} />
          <Route path="/dashboard/servicio-tecnico/capacitaciones" element={<ServicioCapacitaciones />} />
          <Route path="/dashboard/servicio-tecnico/equipos" element={<ServicioEquipos />} />
          <Route path="/dashboard/servicio-tecnico/aprobaciones" element={<ServicioAprobaciones />} />
          <Route path="/dashboard/servicio-tecnico/aplicaciones" element={<ServicioAplicaciones />} />
          <Route path="/dashboard/servicio-tecnico/desinfeccion" element={<ServicioDesinfeccion />} />
          <Route path="/dashboard/servicio-tecnico/asistencia" element={<ServicioAsistencia />} />
          <Route path="/dashboard/servicio-tecnico/verificacion" element={<ServicioVerificacionEquipos />} />
          <Route
            element={<ProtectedRoute allowedRoles={["jefe_tecnico", "jefe_servicio_tecnico", "tecnico"]} />}
          >
            <Route path="/dashboard/servicio-tecnico/entregas-privadas" element={<ServicioPrivatePurchaseDeliveries />} />
            <Route path="/dashboard/servicio-tecnico/compras-privadas" element={<TecnicoPrivatePurchases />} />
          </Route>
          <Route path="/dashboard/talento-humano" element={<DashboardTalento />} />
          <Route path="/dashboard/ti" element={<DashboardTI />} />
          <Route path="/dashboard/operaciones" element={<DashboardOperaciones />} />
          <Route path="/dashboard/logistica" element={<DashboardLogistica />} />
          <Route path="/dashboard/calidad" element={<DashboardCalidad />} />
          <Route path="/dashboard/clientes" element={<ClientesPage />} />
          <Route path="/dashboard/operaciones/determinaciones" element={<DeterminationsCatalog />} />

          {/* Subrutas Operaciones - Compras Privadas */}
          <Route element={<ProtectedRoute allowedRoles={["jefe_operaciones"]} />}>
            <Route path="/dashboard/operaciones/private-purchases" element={<OperacionesPrivatePurchases />} />
          </Route>

          {/* Subrutas Logística - Compras Privadas */}
          <Route element={<ProtectedRoute allowedRoles={["jefe_logistica"]} />}>
            <Route path="/dashboard/logistica/private-purchases" element={<LogisticaPrivatePurchases />} />
          </Route>

          {/* Subrutas Talento Humano */}
          <Route path="/dashboard/talento-humano/usuarios" element={<Usuarios />} />
          <Route path="/dashboard/talento-humano/departamentos" element={<Departamentos />} />
          <Route
            path="/dashboard/talento-humano/solicitudes"
            element={
              <Suspense fallback={<div className="flex justify-center items-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>}>
                <Solicitudes />
              </Suspense>
            }
          />
          <Route
            path="/dashboard/talento-humano/asistencia-reportes"
            element={
              <Suspense fallback={<div className="flex justify-center items-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>}>
                <AsistenciaReportes />
              </Suspense>
            }
          />
          <Route path="/dashboard/talento-humano/permisos" element={<PermisosPage />} />

          {/* Auditoría (solo Gerencia y TI) */}
          <Route element={<ProtectedRoute allowedRoles={["gerencia", "ti"]} />}>
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
          <Route path="/dashboard/mi-perfil" element={<MyProfilePage />} />
          <Route path="/first-login-signature" element={<FirstLoginSignature />} />

          {/* 📝 Sistema de Firma Digital */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "gerencia",
                  "gerencia_general",
                  "ti",
                  "jefe_ti",
                  "admin_ti",
                  "comercial",
                  "jefe_comercial",
                  "talento_humano",
                  "finanzas",
                  "calidad"
                ]}
              />
            }
          >
            <Route path="/dashboard/signatures" element={<SignatureDashboard />} />
            <Route path="/dashboard/signatures/:documentId/sign" element={<DocumentSigner />} />
          </Route>
          {/* Subrutas Backoffice */}
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
            <Route path="/dashboard/backoffice/client-requests" element={<ClientRequests />} />
            <Route path="/dashboard/backoffice/client-request/:id" element={<ClientRequestReview />} />
            <Route path="/dashboard/backoffice/private-purchases" element={<PrivatePurchasesPage />} />
          </Route>

          {/* 🛒 Workspace de Compras Unificado */}
          <Route
            element={(
              <ProtectedRoute
                allowedRoles={[
                  "comercial",
                  "jefe_comercial",
                  "acp_comercial",
                  "gerencia",
                  "gerencia_general",
                  "jefe_operaciones",
                  "jefe_logistica",
                  "backoffice_comercial",
                ]}
              />
            )}
          >
            <Route path="/dashboard/purchases/workspace" element={<PurchasesWorkspace />} />
          </Route>
        </Route>

      </Route>

      {/* =======================================
          🔁 REDIRECCIONES Y ERRORES
      ======================================= */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
