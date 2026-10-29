# INFORME DE VALIDACION DEL MODULO

## Nombre del modulo
Talento Humano y Gestion de Personal

## Descripcion del modulo
Administra procesos internos de personal: expedientes de colaboradores, permisos, vacaciones, asistencia, estructura departamental y solicitudes de cobertura de vacantes.

## Alcance funcional
- Registro y mantenimiento de personal (`employees`).
- Gestion de permisos y vacaciones con flujo de aprobacion.
- Gestion de matrículas de estudios y validaciones asociadas.
- Solicitudes de personal con ciclo de seleccion/contratacion.
- Gestion de perfiles y documentos de colaboradores.
- Control de asistencia, excepciones y horas extra.
- CRUD de departamentos organizacionales.

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

## Endpoints de API
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

## Tablas de base de datos asociadas
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

## Dependencias con otros modulos
- Autenticacion y Sesiones.
- Usuarios y Perfiles.
- Documentos/Archivos/Firma.
- Notificaciones y Comunicaciones.
- Reportes y Auditoria.

## Controles de seguridad
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

## Riesgos operativos
- Prefijo redundante de rutas HR puede generar consumo incorrecto en integraciones.
- `departments.routes.js` protege con JWT pero no define `requireRole` explicito.
- Servicios de permisos/vacaciones/personnel ejecutan DDL runtime (riesgo de deriva de esquema).
- Dependencia de Drive para evidencia legal/documental.

## Posibles escenarios de falla
- Aprobador no valido en flujo de permisos o vacaciones.
- Inconsistencia entre perfil de solicitud y perfil consolidado de colaborador.
- Fallo en carga de documento durante contratacion.
- Marcaciones de asistencia fuera de secuencia temporal esperada.

## Nivel de criticidad
ALTO

## Prioridad de validacion
ALTA

---

## BASE DOCUMENTAL PARA VALIDACION

## Requerimientos del usuario (URS)
- `URS-TH-001`: El sistema debe permitir registrar y administrar informacion de personal interno.
- `URS-TH-002`: El sistema debe permitir gestionar permisos y vacaciones con aprobacion por jerarquia.
- `URS-TH-003`: El sistema debe permitir gestionar solicitudes de personal hasta contratacion.
- `URS-TH-004`: El sistema debe permitir mantener perfiles y documentos de colaboradores.
- `URS-TH-005`: El sistema debe permitir registrar asistencia, excepciones y horas extra.

## Requerimientos funcionales
- `RF-TH-001`: Soportar CRUD de departamentos y consultas de estructura organizacional.
- `RF-TH-002`: Aplicar reglas de aprobacion parcial/final y cancelacion en permisos/vacaciones.
- `RF-TH-003`: Persistir expediente de solicitud de personal con perfil y documentos.
- `RF-TH-004`: Vincular solicitudes de personal con colaboradores/postulantes de forma consistente.
- `RF-TH-005`: Emitir reportes de asistencia y consolidar datos por rango y usuario.

## Resumen del diseno tecnico
- Modulo distribuido en subdominios (`permisos`, `vacaciones`, `personnel-requests`, `collaborators`, `attendance`).
- SQL directo y validaciones de negocio por servicio.
- Frontend con workspaces de colaborador y solicitudes de personal.
- Integracion documental en Drive para evidencias y firmas legales.

## Escenarios de prueba
### Funcionalidad
- Caso: Registrar permiso por salud con justificantes y aprobacion final.
- Resultado esperado: Cambio de estado correcto y firmas de flujo persistidas.

### Seguridad
- Caso: Usuario sin rol de Talento Humano intenta editar perfil de colaborador.
- Resultado esperado: `403` y sin cambios en `collaborator_profiles`.

### Manejo de errores
- Caso: Subida de documento invalido en solicitud de personal.
- Resultado esperado: Error controlado y solicitud sin corrupcion de expediente.

### Integridad de datos
- Caso: Contratar postulante desde solicitud de personal.
- Resultado esperado: Vinculo coherente entre `personnel_requests`, `users`, perfil y documentos.

---

## MATRIZ DE TRAZABILIDAD

| Requerimiento | Componente | Prueba |
|---|---|---|
| REQ-TH-001 Gestion de personal | `hr.controller` | Crear/editar empleado y verificar `employees` |
| REQ-TH-002 Permisos y vacaciones | `permisos.service` + `vacaciones.service` | Ejecutar flujo completo de aprobacion/cancelacion |
| REQ-TH-003 Solicitudes de personal | `personnel-requests.service` | Crear solicitud, adjuntar perfil/documentos y contratar |
| REQ-TH-004 Expediente de colaboradores | `collaborators.service` | Actualizar perfil y validar persistencia documental |
| REQ-TH-005 Asistencia y overtime | `attendance.controller` | Registrar marcaciones/excepcion y validar reporte PDF |
