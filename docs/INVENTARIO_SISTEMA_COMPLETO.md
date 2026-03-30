# 🗺️ Mapa de Inventario del Sistema FamSPI

Este documento detalla cada módulo, componente, widget y funcionalidad del sistema FamSPI, organizado por áreas operativas. No asume datos; es un inventario basado en la exploración directa del código fuente (frontend y backend).

---

## 1. Área 01: Gobierno, Seguridad y Core
Módulo central encargado de la autenticación, seguridad, auditoría y componentes transversales.

### **Frontend**
- **Módulo Shared**:
    - **Páginas**: `Login.jsx`, `LoginCallback.jsx`, `FirstLoginSignature.jsx`, `Unauthorized.jsx`, `NotFound.jsx`.
    - **Componentes**: `AttendanceAction.jsx`, `LinksInteres.jsx`.
- **Módulo Auditoría**:
    - **Componentes**: `AuditoriaPreview.jsx`.
    - **Utils**: `auditDisplay.js`.
- **Core UI (Componentes Transversales)**:
    - `Button.jsx`, `Input.jsx`, `Select.jsx`, `Card.jsx`, `Modal.jsx`, `Table.jsx`, `Badge.jsx`, `Alert.jsx`.
    - `ErrorBoundary.jsx`, `LoadingOverlay.jsx`, `ProcessingOverlay.jsx`, `SaveStatusIndicator.jsx`.
    - `Header.jsx`, `Footer.jsx`, `NavigationBar.jsx`, `NotificationBell.jsx`.
    - `HelpTicketFab.jsx` (Soporte TI).
- **Widgets de Core**:
    - `AttendanceWidget.jsx` (Marcado de asistencia).
    - `GmailAuthWidget.jsx` (Integración correo).
    - `InternalLopdpConsentModal.jsx` (Aviso legal LOPDP).

### **Backend**
- **Módulo Auth**: Control de sesiones y autenticación (`auth.controller.js`).
- **Módulo Security**: SIEM, Whitelist, Holidays, Privacy (`security.siem.js`, `security.whitelist.js`).
- **Módulo Auditoría**: Registro de trazas de auditoría (`auditoria.service.js`).
- **Módulo Notifications**: `notificationManager.js` (Email, Push, SSE).

---

## 2. Área 02: Talento Humano y Control Laboral
Gestión del ciclo de vida del colaborador, desde la solicitud de personal hasta la desvinculación.

### **Frontend**
- **Módulo Talento**:
    - **Páginas**: `CollaboratorCommandCenter.jsx` (Dashboard principal), `ColaboradoresHub.jsx`, `PersonnelWorkspace.jsx`, `Solicitudes.jsx`, `Usuarios.jsx`, `Departamentos.jsx`, `AsistenciaReportes.jsx`.
    - **Componentes de Command Center**: `EntityBrowserSection.jsx`, `WorkspaceTabsSection.jsx`, `CommandCenterSummaryStrip.jsx`, `CommandCenterJourneyPanel.jsx`.
    - **Workspace del Colaborador**: `PersonnelProfile.jsx` (Formulario de perfil), `PersonnelChecklist.jsx` (Checklist operativo), `PersonnelDocuments.jsx` (Expediente digital), `PersonnelHeader.jsx`, `PersonnelSidebar.jsx`.
    - **Formularios/Modales**: `PersonnelRequestForm.jsx`, `PersonnelApprovalsModal.jsx`, `DocumentPreviewModal.jsx`.
- **Módulo Solicitudes (Shared)**:
    - `PermisosPage.jsx`, `PermisoVacacionModal.jsx`, `UploadJustificantesModal.jsx`.

### **Backend**
- **Módulo Collaborators**: Gestión de expedientes (`collaborators.service.js`).
- **Módulo Personnel Requests**: Flujo de aprobación de nuevas plazas (`personnel-requests.service.js`).
- **Módulo Attendance**: Control de asistencia, horas extras y geolocalización (`attendance.service.js`).
- **Módulo Vacaciones/Permisos**: Gestión de días libres y justificaciones (`vacaciones.service.js`, `permisos.service.js`).

---

## 3. Área 03: Comercial y Business Case
Gestión de clientes, prospección, cronogramas y análisis de viabilidad económica (Business Case).

### **Frontend**
- **Módulo Comercial**:
    - **Páginas**: `Clientes.jsx`, `Solicitudes.jsx`, `BusinessCaseWorkspace.jsx`, `PlanificacionMensual.jsx`, `AprobacionCronogramas.jsx`.
    - **Business Case Workspace (Secciones)**: `ClientDataSection.jsx`, `LabSection.jsx`, `EquipmentSection.jsx`, `CalculationsSection.jsx`, `InvestmentsSection.jsx`, `RentabilitySection.jsx`, `FeasibilitySection.jsx`, `LISSection.jsx`, `DispatchWorkspaceSection.jsx`.
    - **Componentes de Cronograma**: `ScheduleCalendarView.jsx`, `ScheduleEditor.jsx`, `ScheduleManager.jsx`, `TeamScheduleOverview.jsx`.
    - **Widgets**: `ACPClientRequestsWidget.jsx`, `JefeClientReportsWidget.jsx`, `MyClientRequestsWidget.jsx`.
    - **Formularios**: `NewClientRequestForm.jsx`, `LocationManager.jsx`, `EquipmentSelector.jsx`.

### **Backend**
- **Módulo Business Case**: Orquestador de cálculos, estados y exportaciones (`BusinessCaseOrchestrator.service.js`, `businessCaseCalculator.service.js`).
- **Módulo Clients**: CRM y gestión de carteras (`clients.service.js`).
- **Módulo Schedules**: Planificación de visitas y optimización (`schedules.service.js`).
- **Módulo Requests**: Gestión de solicitudes comerciales y backoffice (`requests.service.js`).

---

## 4. Área 04: Operaciones, Servicio y Logística
Gestión técnica, inventario, mantenimientos y catálogos de equipos/reactivos.

### **Frontend**
- **Módulo Servicio**:
    - **Páginas**: `Dashboard.jsx`, `Solicitudes.jsx`, `Equipos.jsx`, `Mantenimientos.jsx`, `Disponibilidad.jsx`, `TechnicalProcedureWorkspace.jsx`.
    - **Steppers Operativos**: `AsistenciaStepper.jsx`, `DesinfeccionStepper.jsx`, `EntrenamientoStepper.jsx`, `VerificacionStepper.jsx`.
    - **Vistas por Rol**: `TecnicoView.jsx`, `JefeTecnicoView.jsx`.
- **Módulo Operaciones**:
    - **Catálogos**: `EquipmentCatalog.jsx`, `DeterminationsCatalog.jsx`, `CalculationTemplates.jsx`.
    - **Componentes**: `FormulaEditor.jsx`.
- **Módulo Logística**:
    - `LogisticaPrivatePurchases.jsx`.

### **Backend**
- **Módulo Servicio**: Inspecciones, órdenes de servicio y préstamos (`servicio.controller.js`).
- **Módulo Mantenimientos**: Scheduler de preventivos y correctivos (`mantenimientos.service.js`).
- **Módulo Inventario**: Control de stock y reactivos (`inventario.service.js`).
- **Módulo Private Purchases**: Gestión de compras y entregas (`privatePurchases.service.js`).

---

## 5. Área 05: Finanzas y Gerencia
Dashboards estratégicos, auditoría de alto nivel y gestión de viáticos.

### **Frontend**
- **Módulo Finanzas**:
    - `ViaticosWorkspace.jsx`.
- **Módulo Gerencia**:
    - **Dashboards**: `Dashboard.jsx`, `ChartCard.jsx`.
    - **Aprobaciones**: `PrivatePurchaseApprovalsWidget.jsx`.
    - **Auditoría**: `Auditoria.jsx`.

### **Backend**
- **Módulo Finanzas**: Procesamiento de viáticos y pagos (`finanzas.service.js`).
- **Módulo Viáticos**: `viaticos.service.js`.
- **Módulo Dashboard**: Agregación de KPIs estratégicos (`dashboard.service.js`).

---

## 6. Firma Digital y Verificación
Transversal a todas las áreas que requieren validez legal.

### **Frontend**
- **Módulo Signature**:
    - `SignatureDashboard.jsx`, `DocumentSigner.jsx`, `DocumentVerification.jsx`.

### **Backend**
- **Módulo Signature**: Generación y validación de firmas criptográficas (`signature.controller.js`).

---

**Nota Técnica**: El sistema utiliza una arquitectura basada en micro-módulos en el frontend y servicios orientados a dominio en el backend, con una fuerte integración con Google Drive para la persistencia documental.
