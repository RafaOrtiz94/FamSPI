# DOCUMENTO DE DISENO DEL SISTEMA (DS)

## Nombre del modulo
Talento Humano

## Arquitectura del modulo
- Capa de presentacion: frontend React o consumidores internos del SPI.
- Capa API: rutas Express bajo prefijos del backend.
- Capa de negocio: controladores y servicios del modulo.
- Capa de persistencia: consultas SQL directas y tablas asociadas.
- Capa transversal: autenticacion, autorizacion, auditoria y notificaciones cuando aplica.

## Componentes del sistema
### Controladores
- `backend/src/modules/talento_humano/hr.controller.js`
- `backend/src/modules/permisos/permisos.controller.js`
- `backend/src/modules/vacaciones/vacaciones.controller.js`
- `backend/src/modules/personnel-requests/personnel-requests.controller.js`
- `backend/src/modules/collaborators/collaborators.controller.js`
- `backend/src/modules/departments/departments.controller.js`
- `backend/src/modules/attendance/attendance.controller.js`

### Servicios
- `backend/src/modules/permisos/permisos.service.js`
- `backend/src/modules/vacaciones/vacaciones.service.js`
- `backend/src/modules/personnel-requests/personnel-requests.service.js`
- `backend/src/modules/collaborators/collaborators.service.js`
- `backend/src/modules/attendance/attendance.service.js`

### Modelos
- Sin ORM; SQL directo y reglas de negocio en servicios.

### Rutas
- `backend/src/modules/talento_humano/hr.routes.js`
- `backend/src/modules/permisos/permisos.routes.js`
- `backend/src/modules/vacaciones/vacaciones.routes.js`
- `backend/src/modules/personnel-requests/personnel-requests.routes.js`
- `backend/src/modules/collaborators/collaborators.routes.js`
- `backend/src/modules/departments/departments.routes.js`
- `backend/src/modules/attendance/attendance.routes.js`

### Componentes de interfaz
- `spi_front/src/modules/talento/pages/ColaboradoresHub.jsx`
- `spi_front/src/modules/talento/pages/PersonnelWorkspace.jsx`
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- `spi_front/src/modules/talento/pages/Departamentos.jsx`
- `spi_front/src/modules/talento/pages/Usuarios.jsx`
- `spi_front/src/modules/shared/solicitudes/pages/PermisosPage.jsx`
- `spi_front/src/core/api/permisosApi.js`
- `spi_front/src/core/api/vacationsApi.js`
- `spi_front/src/core/api/personnelRequestsApi.js`
- `spi_front/src/core/api/collaboratorsApi.js`
- `spi_front/src/core/api/departmentsApi.js`
- `spi_front/src/core/api/attendanceApi.js`

## Modelo de datos asociado
- `employees`
- `users`
- `departments`
- `permisos_vacaciones`
- `permisos_vacaciones_firmas`
- `permisos_estudios_matriculas`
- `vacaciones_solicitudes`
- `vacaciones_solicitudes_firmas`
- `vacaciones_saldos_historicos`
- `personnel_requests`
- `personnel_request_history`
- `personnel_request_comments`
- `personnel_request_profiles`
- `personnel_request_documents`
- `collaborator_profiles`
- `collaborator_documents`
- `user_attendance_records`
- `attendance_exceptions`
- `attendance_overtime`

## Interfaces API
### RRHH (legacy en prefijo)
- `POST /api/v1/talento-humano/api/v1/hr/employees`
- `GET /api/v1/talento-humano/api/v1/hr/employees`
- `PUT /api/v1/talento-humano/api/v1/hr/employees/:id`
- `POST /api/v1/talento-humano/api/v1/hr/documents/:id`

### Permisos
- `GET /api/v1/permisos/legal-verification/:token`
- `POST /api/v1/permisos`
- `POST /api/v1/permisos/estudios/matricula`
- `GET /api/v1/permisos/estudios/matricula/activa`
- `GET /api/v1/permisos/estudios/matriculas`
- `GET /api/v1/permisos/estudios/matriculas/pendientes`
- `POST /api/v1/permisos/estudios/matriculas/:id/revisar`
- `POST /api/v1/permisos/:id/aprobar-parcial`
- `POST /api/v1/permisos/:id/justificantes`
- `POST /api/v1/permisos/:id/aprobar-final`
- `POST /api/v1/permisos/:id/rechazar`
- `POST /api/v1/permisos/:id/cancelar`
- `POST /api/v1/permisos/:id/cancelar/revisar`
- `POST /api/v1/permisos/:id/recovery-plan`
- `GET /api/v1/permisos/pendientes`
- `GET /api/v1/permisos/mis-solicitudes`
- `GET /api/v1/permisos/resumen-colaboradores`
- `GET /api/v1/permisos/legal-coverage`

### Vacaciones
- `GET /api/v1/vacaciones/legal-verification/:token`
- `POST /api/v1/vacaciones`
- `GET /api/v1/vacaciones`
- `PATCH /api/v1/vacaciones/:id/status`
- `POST /api/v1/vacaciones/:id/cancel`
- `POST /api/v1/vacaciones/:id/cancel/review`
- `GET /api/v1/vacaciones/summary/data`

### Solicitudes de personal
- `POST /api/v1/personnel-requests`
- `GET /api/v1/personnel-requests`
- `GET /api/v1/personnel-requests/stats`
- `GET /api/v1/personnel-requests/:id`
- `PATCH /api/v1/personnel-requests/:id/collaborator`
- `PATCH /api/v1/personnel-requests/:id/applicant`
- `PATCH /api/v1/personnel-requests/:id/status`
- `POST /api/v1/personnel-requests/:id/hire`
- `GET /api/v1/personnel-requests/:id/profile`
- `PUT /api/v1/personnel-requests/:id/profile`
- `POST /api/v1/personnel-requests/:id/documents`
- `POST /api/v1/personnel-requests/:id/comments`

### Colaboradores, departamentos y asistencia
- `GET /api/v1/collaborators/stats`
- `GET /api/v1/collaborators`
- `GET /api/v1/collaborators/:id/profile`
- `PUT /api/v1/collaborators/:id/profile`
- `POST /api/v1/collaborators/:id/documents`
- `GET /api/v1/departments`
- `GET /api/v1/departments/:id`
- `POST /api/v1/departments`
- `PUT /api/v1/departments/:id`
- `DELETE /api/v1/departments/:id`
- `POST /api/v1/attendance/clock-in`
- `POST /api/v1/attendance/clock-out-lunch`
- `POST /api/v1/attendance/clock-in-lunch`
- `POST /api/v1/attendance/clock-out`
- `POST /api/v1/attendance/exception`
- `POST /api/v1/attendance/exception/status`
- `GET /api/v1/attendance/today`
- `GET /api/v1/attendance/range`
- `GET /api/v1/attendance/pdf/:userId`

## Dependencias tecnicas
- Autenticacion y Sesiones.
- Usuarios y Perfiles.
- Documentos/Archivos/Firma.
- Notificaciones y Comunicaciones.
- Reportes y Auditoria.

## Controles de seguridad y operacion
### Control de acceso
- JWT obligatorio en rutas privadas.
- `requireRole` aplicado en operaciones de aprobacion, gestion de personal y perfiles.

### Autenticacion
- Usuario autenticado requerido para toda operacion no publica.
- Verificacion publica por token para validacion legal de permisos/vacaciones.

### Autorizacion
- Matriz por rol (talento_humano, jefaturas, gerencia, admin).
- Restricciones por ownership en solicitudes y comentarios.

### Registro de auditoria
- Eventos de cambios en solicitudes, aprobaciones y documentos.
- Integracion con `logAction` en acciones de RRHH.

### Proteccion de datos
- Validaciones de entrada y tipo de archivo en cargas documentales.
- Datos sensibles de colaboradores protegidos por control de rol.

## Riesgos tecnicos detectados
- Prefijo redundante de rutas HR puede generar consumo incorrecto en integraciones.
- `departments.routes.js` protege con JWT pero no define `requireRole` explicito.
- Servicios de permisos/vacaciones/personnel ejecutan DDL runtime (riesgo de deriva de esquema).
- Dependencia de Drive para evidencia legal/documental.

## Diagrama tecnico
`mermaid
flowchart LR
  UI[Frontend o consumidor] --> API[API TH]
  API --> CTRL[Controladores]
  CTRL --> SVC[Servicios]
  SVC --> DB[(Base de datos)]
  SVC --> EXT[Dependencias externas o modulos transversales]
`
