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
import BusinessCasePage from "../modules/comercial/pages/BusinessCase";
import DashboardServicio from "../modules/servicio/pages/Dashboard";
import ServicioMantenimientos from "../modules/servicio/pages/Mantenimientos";
import ServicioSolicitudes from "../modules/servicio/pages/Solicitudes";
import ServicioDisponibilidad from "../modules/servicio/pages/Disponibilidad";
import ServicioCapacitaciones from "../modules/servicio/pages/Capacitaciones";
import ServicioEquipos from "../modules/servicio/pages/Equipos";
import ServicioAprobaciones from "../modules/servicio/pages/Aprobaciones";
import ServicioAplicaciones from "../modules/servicio/pages/Aplicaciones";
import DashboardTalento from "../modules/talento/Dashboard";
import DashboardTI from "../modules/talento/DashboardTI";
import DashboardOperaciones from "../modules/operaciones/Dashboard";
import DashboardCalidad from "../modules/calidad/Dashboard";
import ClientRequests from "../modules/backoffice/pages/ClientRequests";
import ClientRequestReview from "../modules/backoffice/pages/ClientRequestReview";

// 📋 Páginas de Talento Humano
import Usuarios from "../modules/talento/pages/Usuarios";
import Departamentos from "../modules/talento/pages/Departamentos";

// 🧾 Páginas compartidas
import RequestsPage from "../modules/RequestsPage";
import MantenimientosPage from "../modules/MantenimientosPage";
import DocumentsPage from "../modules/DocumentsPage";
import Auditoria from "../modules/gerencia/Auditoria";
import ConfigurationPage from "../pages/ConfigurationPage";

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
              "acp_comercial",
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

          {/* Subrutas Comercial */}
          <Route element={<ProtectedRoute allowedRoles={["comercial", "jefe_comercial", "gerencia", "ti", "acp_comercial"]} />}>
            <Route path="/dashboard/comercial/solicitudes" element={<SolicitudesPage />} />
            <Route path="/dashboard/comercial/clientes" element={<ClientesPage />} />
            <Route path="/dashboard/comercial/new-client-request" element={<NewClientRequest />} />
            <Route path="/dashboard/comercial/equipment-purchases" element={<EquipmentPurchasesPage />} />
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
          </Route>

          <Route path="/dashboard/servicio-tecnico" element={<DashboardServicio />} />
          <Route path="/dashboard/servicio-tecnico/mantenimientos" element={<ServicioMantenimientos />} />
          <Route path="/dashboard/servicio-tecnico/solicitudes" element={<ServicioSolicitudes />} />
          <Route path="/dashboard/servicio-tecnico/disponibilidad" element={<ServicioDisponibilidad />} />
          <Route path="/dashboard/servicio-tecnico/capacitaciones" element={<ServicioCapacitaciones />} />
          <Route path="/dashboard/servicio-tecnico/equipos" element={<ServicioEquipos />} />
          <Route path="/dashboard/servicio-tecnico/aprobaciones" element={<ServicioAprobaciones />} />
          <Route path="/dashboard/servicio-tecnico/aplicaciones" element={<ServicioAplicaciones />} />
          <Route path="/dashboard/talento-humano" element={<DashboardTalento />} />
          <Route path="/dashboard/ti" element={<DashboardTI />} />
          <Route path="/dashboard/operaciones" element={<DashboardOperaciones />} />
          <Route path="/dashboard/calidad" element={<DashboardCalidad />} />
          <Route path="/dashboard/clientes" element={<ClientesPage />} />

          {/* Subrutas Backoffice */}
          <Route element={<ProtectedRoute allowedRoles={["backoffice_comercial", "gerencia"]} />}>
            <Route path="/dashboard/backoffice/client-requests" element={<ClientRequests />} />
            <Route path="/dashboard/backoffice/client-request/:id" element={<ClientRequestReview />} />
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
          <Route path="/configuration" element={<ConfigurationPage />} />
          <Route path="/first-login-signature" element={<FirstLoginSignature />} />
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
