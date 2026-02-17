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
import RolePending from "../modules/shared/pages/RolePending";

// 🧭 Dashboards por rol
import LinksInteres from "../modules/shared/pages/LinksInteres";

// 🛒 Workspace de Compras Unificado
import PurchasesWorkspace from "../modules/shared/purchases-workspace/PurchasesWorkspace";

// 📋 Páginas de Talento Humano
import PermisosPage from "../modules/shared/solicitudes/pages/PermisosPage";
import PersonnelWorkspace from "../modules/talento/pages/PersonnelWorkspace";
import ColaboradoresHub from "../modules/talento/pages/ColaboradoresHub";
import CollaboratorWorkspace from "../modules/talento/pages/CollaboratorWorkspace";

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
const DashboardGerencia = lazy(() => import("../modules/gerencia/Dashboard"));
const PurchasesAlbumPage = lazy(() => import("../modules/gerencia/PurchasesAlbumPage"));
const DashboardFinanzas = lazy(() => import("../modules/finanzas/Dashboard"));
const ViaticosWorkspace = lazy(() => import("../modules/finanzas/pages/ViaticosWorkspace"));
const DashboardComercial = lazy(() => import("../modules/comercial/pages/Dashboard"));
const SolicitudesPage = lazy(() => import("../modules/comercial/pages/Solicitudes"));
const ClientesPage = lazy(() => import("../modules/comercial/pages/Clientes"));
const NewClientRequest = lazy(() => import("../modules/comercial/pages/NewClientRequest"));
const EquipmentPurchasesPage = lazy(() => import("../modules/comercial/pages/EquipmentPurchases"));
const ACPEquipmentPurchasesPage = lazy(() => import("../modules/comercial/pages/ACPEquipmentPurchases"));
const BusinessCaseWorkspace = lazy(() => import("../modules/comercial/pages/BusinessCaseWorkspace"));
const PlanificacionMensual = lazy(() => import("../modules/comercial/pages/PlanificacionMensual"));
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
const ServicioTechnicalProcedureWorkspace = lazy(() => import("../modules/servicio/pages/TechnicalProcedureWorkspace"));
const ServicioPrivatePurchaseDeliveries = lazy(() => import("../modules/servicio/pages/PrivatePurchaseDeliveries"));
const TecnicoPrivatePurchases = lazy(() => import("../modules/servicio/pages/TecnicoPrivatePurchases"));
const DashboardTalento = lazy(() => import("../modules/talento/Dashboard"));
const DashboardTI = lazy(() => import("../modules/talento/DashboardTI"));
const TicketsWorkspace = lazy(() => import("../modules/ti/pages/TicketsWorkspace"));
const DashboardOperaciones = lazy(() => import("../modules/operaciones/Dashboard"));
const DashboardCalidad = lazy(() => import("../modules/calidad/Dashboard"));
const DashboardLogistica = lazy(() => import("../modules/logistica/Dashboard"));
const ClientRequests = lazy(() => import("../modules/backoffice/pages/ClientRequests"));
const ClientRequestReview = lazy(() => import("../modules/backoffice/pages/ClientRequestReview"));
const PrivatePurchasesPage = lazy(() => import("../modules/backoffice/pages/PrivatePurchases"));
const DeterminationsCatalog = lazy(() => import("../modules/operaciones/pages/DeterminationsCatalog"));
const OperacionesPrivatePurchases = lazy(() => import("../modules/operaciones/pages/OperacionesPrivatePurchases"));
const LogisticaPrivatePurchases = lazy(() => import("../modules/logistica/pages/LogisticaPrivatePurchases"));
const AsistenciaReportes = lazy(() => import("../modules/talento/pages/AsistenciaReportes"));

const routeFallback = (
  <div className="flex justify-center items-center min-h-[50vh]">
    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
  </div>
);

const AppRoutes = () => {
  return (
    <Suspense fallback={routeFallback}>
      <Routes>
      {/* Ruta directa para /registro-en-proceso (fallback duro) */}
      <Route path="/registro-en-proceso" element={<RolePending />} />
      {/* =======================================
          🌐 RUTAS PÚBLICAS
      ======================================= */}
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/login/callback" element={<LoginCallback />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/registro-en-proceso" element={<RolePending />} />

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
              "financiero",
              "jefe_finanzas",
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
              "jefe_ti",
              "admin_ti",
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
          <Route path="/dashboard/gerencia/aprobaciones-contratos" element={<PurchasesAlbumPage />} />
          <Route path="/dashboard/gerencia/compras-album" element={<PurchasesAlbumPage />} />
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
            <Route path="/dashboard/business-case" element={<BusinessCaseWorkspace />} />
            <Route path="/dashboard/comercial/business-case" element={<BusinessCaseWorkspace />} />
            <Route path="/dashboard/business-case/workspace" element={<BusinessCaseWorkspace />} />
            <Route path="/dashboard/business-case/workspace/:id" element={<BusinessCaseWorkspace />} />
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
            element={<ProtectedRoute allowedRoles={["servicio_tecnico", "jefe_tecnico", "jefe_servicio_tecnico", "tecnico"]} />}
          >
            <Route path="/dashboard/servicio-tecnico/workspace-procedimiento" element={<ServicioTechnicalProcedureWorkspace />} />
          </Route>
          <Route
            element={<ProtectedRoute allowedRoles={["jefe_tecnico", "jefe_servicio_tecnico", "tecnico"]} />}
          >
            <Route path="/dashboard/servicio-tecnico/entregas-privadas" element={<ServicioPrivatePurchaseDeliveries />} />
            <Route path="/dashboard/servicio-tecnico/compras-privadas" element={<TecnicoPrivatePurchases />} />
          </Route>
          <Route path="/dashboard/talento-humano" element={<DashboardTalento />} />
          <Route element={<ProtectedRoute allowedRoles={["ti", "jefe_ti", "admin_ti"]} />}>
            <Route path="/dashboard/ti" element={<DashboardTI />} />
            <Route path="/dashboard/ti/workspace" element={<TicketsWorkspace />} />
          </Route>
          <Route path="/dashboard/operaciones" element={<DashboardOperaciones />} />
          <Route path="/dashboard/logistica" element={<DashboardLogistica />} />
          <Route path="/dashboard/calidad" element={<DashboardCalidad />} />
          <Route path="/dashboard/clientes" element={<ClientesPage />} />
          <Route path="/dashboard/operaciones/determinaciones" element={<DeterminationsCatalog />} />
          <Route path="/dashboard/links-interes" element={<LinksInteres />} />

          {/* Subrutas Operaciones - Compras Privadas */}
          <Route element={<ProtectedRoute allowedRoles={["jefe_operaciones"]} />}>
            <Route path="/dashboard/operaciones/private-purchases" element={<OperacionesPrivatePurchases />} />
          </Route>

          {/* Subrutas Logística - Compras Privadas */}
          <Route element={<ProtectedRoute allowedRoles={["jefe_logistica"]} />}>
            <Route path="/dashboard/logistica/private-purchases" element={<LogisticaPrivatePurchases />} />
          </Route>

          {/* Subrutas Talento Humano */}
          <Route path="/dashboard/talento-humano/colaboradores" element={<ColaboradoresHub />} />
          <Route path="/dashboard/talento-humano/colaboradores/:id" element={<CollaboratorWorkspace />} />
          <Route path="/dashboard/talento-humano/usuarios" element={<ColaboradoresHub initialTab="usuarios" />} />
          <Route path="/dashboard/talento-humano/departamentos" element={<ColaboradoresHub initialTab="departamentos" />} />
          <Route
            path="/dashboard/talento-humano/solicitudes"
            element={<ColaboradoresHub initialTab="solicitudes" />}
          />
          <Route
            element={<ProtectedRoute allowedRoles={["talento_humano", "gerencia", "gerencia_general", "admin"]} />}
          >
            <Route path="/dashboard/talento-humano/workspace-personal" element={<PersonnelWorkspace />} />
            <Route path="/dashboard/talento-humano/workspace-personal/:id" element={<PersonnelWorkspace />} />
          </Route>
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "talento_humano",
                  "jefe_talento_humano",
                  "gerencia",
                  "gerencia_general",
                  "finanzas",
                  "financiero",
                  "jefe_finanzas",
                  "jefe_financiero",
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
                  "jefe_tecnico",
                  "jefe_servicio_tecnico",
                ]}
              />
            }
          >
            <Route path="/dashboard/finanzas/viaticos" element={<ViaticosWorkspace />} />
          </Route>
          <Route path="/dashboard/talento-humano/permisos" element={<PermisosPage />} />

          {/* Auditoría (solo Gerencia y TI) */}
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
                  "jefe_tecnico",
                  "jefe_servicio_tecnico",
                  "tecnico",
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
    </Suspense>
  );
};

export default AppRoutes;
