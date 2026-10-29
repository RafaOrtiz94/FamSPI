# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)

## Nombre del modulo
Talento Humano

## Descripcion funcional
Administra procesos internos de personal: expedientes de colaboradores, permisos, vacaciones, asistencia, estructura departamental y solicitudes de cobertura de vacantes.

## Logica funcional observada
- Registro y mantenimiento de personal (`employees`).
- Gestion de permisos y vacaciones con flujo de aprobacion.
- Gestion de matrículas de estudios y validaciones asociadas.
- Solicitudes de personal con ciclo de seleccion/contratacion.
- Gestion de perfiles y documentos de colaboradores.
- Control de asistencia, excepciones y horas extra.
- CRUD de departamentos organizacionales.

## Especificaciones funcionales
### FRS-TH-001
**Descripcion:** Registro y mantenimiento de personal (`employees`).

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-TH-002
**Descripcion:** Gestion de permisos y vacaciones con flujo de aprobacion.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-TH-003
**Descripcion:** Gestion de matrículas de estudios y validaciones asociadas.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-TH-004
**Descripcion:** Solicitudes de personal con ciclo de seleccion/contratacion.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-TH-005
**Descripcion:** Gestion de perfiles y documentos de colaboradores.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-TH-006
**Descripcion:** Control de asistencia, excepciones y horas extra.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-TH-007
**Descripcion:** CRUD de departamentos organizacionales.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

## Endpoints API relacionados
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

## Validaciones y controles funcionales
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

## Dependencias funcionales
- Autenticacion y Sesiones.
- Usuarios y Perfiles.
- Documentos/Archivos/Firma.
- Notificaciones y Comunicaciones.
- Reportes y Auditoria.

## Observaciones
- Prefijo redundante de rutas HR puede generar consumo incorrecto en integraciones.
- `departments.routes.js` protege con JWT pero no define `requireRole` explicito.
- Servicios de permisos/vacaciones/personnel ejecutan DDL runtime (riesgo de deriva de esquema).
- Dependencia de Drive para evidencia legal/documental.
