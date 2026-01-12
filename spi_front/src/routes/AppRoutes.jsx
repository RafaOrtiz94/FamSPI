import React from "react";
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
<<<<<<< Updated upstream
=======
import FirstLoginSignature from "../modules/shared/pages/FirstLoginSignature";
import ActivationPending from "../modules/shared/pages/ActivationPending";
>>>>>>> Stashed changes
import NotFound from "../modules/shared/pages/NotFound";
import Unauthorized from "../modules/shared/pages/Unauthorized";

// 🧭 Dashboards por rol
import DashboardGerencia from "../modules/gerencia/Dashboard";
import DashboardFinanzas from "../modules/finanzas/Dashboard";
import DashboardComercial from "../modules/comercial/pages/Dashboard";
import NewClientRequest from "../modules/comercial/pages/NewClientRequest";
<<<<<<< Updated upstream
=======
import EquipmentPurchasesPage from "../modules/comercial/pages/EquipmentPurchases";
import ACPEquipmentPurchasesPage from "../modules/comercial/pages/ACPEquipmentPurchases";
import BusinessCasePage from "../modules/comercial/pages/BusinessCase";
import UnifiedBCView from "../modules/comercial/pages/UnifiedBCView";
import BusinessCaseWizard from "../modules/comercial/pages/BusinessCaseWizard";
import BusinessCaseWorkspace from "../modules/comercial/pages/BusinessCaseWorkspace";
import ManualBCForm from "../modules/comercial/pages/ManualBCForm";
import PlanificacionMensual from "../modules/comercial/pages/PlanificacionMensual";
import AprobacionCronogramas from "../modules/comercial/pages/AprobacionCronogramas";
>>>>>>> Stashed changes
import DashboardServicio from "../modules/servicio/pages/Dashboard";
import DashboardTalento from "../modules/talento/Dashboard";
import DashboardTI from "../modules/talento/DashboardTI";
import DashboardOperaciones from "../modules/operaciones/Dashboard";
import DashboardCalidad from "../modules/calidad/Dashboard";
import ClientRequests from "../modules/backoffice/pages/ClientRequests";
// import ClientRequestReview from "../modules/backoffice/pages/ClientRequestReview";

// 📋 Páginas de Talento Humano
import Usuarios from "../modules/talento/pages/Usuarios";
import Departamentos from "../modules/talento/pages/Departamentos";

// 🧾 Páginas compartidas
import RequestsPage from "../modules/RequestsPage";
import MantenimientosPage from "../modules/MantenimientosPage";
import DocumentsPage from "../modules/DocumentsPage";
import Auditoria from "../modules/gerencia/Auditoria";

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
      </Route>

      {/* =======================================
          🔒 RUTAS PRIVADAS (requieren token JWT)
      ======================================= */}
      <Route
        element={
          <ProtectedRoute
            allowedRoles={[
              "gerencia",
              "finanzas",
              "comercial",
              "jefe_comercial",
              "backoffice_comercial",
              "servicio_tecnico",
              "jefe_tecnico",
              "jefe_servicio_tecnico",
              "talento_humano",
              "ti",
              "operaciones",
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
<<<<<<< Updated upstream
          <Route path="/dashboard/comercial/new-client-request" element={<NewClientRequest />} />
=======

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

>>>>>>> Stashed changes
          <Route path="/dashboard/servicio-tecnico" element={<DashboardServicio />} />
          <Route path="/dashboard/talento-humano" element={<DashboardTalento />} />
          <Route path="/dashboard/ti" element={<DashboardTI />} />
          <Route path="/dashboard/operaciones" element={<DashboardOperaciones />} />
          <Route path="/dashboard/calidad" element={<DashboardCalidad />} />

          {/* Subrutas Backoffice */}
          <Route element={<ProtectedRoute allowedRoles={["backoffice_comercial", "gerencia"]} />}>
            <Route path="/dashboard/backoffice/client-requests" element={<ClientRequests />} />
            {/* <Route path="/dashboard/backoffice/client-request/:id" element={<ClientRequestReview />} /> */}
          </Route>

          {/* Subrutas Talento Humano */}
          <Route path="/dashboard/talento-humano/usuarios" element={<Usuarios />} />
          <Route path="/dashboard/talento-humano/departamentos" element={<Departamentos />} />

          {/* Auditoría (solo Gerencia y TI) */}
          <Route element={<ProtectedRoute allowedRoles={["gerencia", "ti"]} />}>
            <Route path="/dashboard/auditoria" element={<Auditoria />} />
          </Route>

          {/* Rutas compartidas */}
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/mantenimientos" element={<MantenimientosPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
        </Route>
<<<<<<< Updated upstream
=======

        {/* Pantalla de activación pendiente - fuera del layout del dashboard */}
        <Route path="/activation-pending" element={<ActivationPending />} />

>>>>>>> Stashed changes
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
