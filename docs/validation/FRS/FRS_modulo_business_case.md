# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)

## Nombre del modulo
Business Case

## Descripcion funcional
Gestiona la evaluacion tecnico-economica de oportunidades comerciales, con secciones colaborativas por rol, calculos de rentabilidad, control de workflow por estados y exportacion de resultados para decision gerencial.

## Logica funcional observada
- Alta, consulta, edicion y cierre de business cases.
- Seleccion de equipamiento y determinaciones.
- Calculos economicos, ROI y decision de factibilidad.
- Gestion de inversiones, consumo y plan de despacho.
- Control de ownership por seccion y bloqueo/desbloqueo.
- Integracion con catalogos de equipos/determinaciones/plantillas.
- Observabilidad del workspace y feature flags de autosave.
- Cola de generacion de hojas BC y seguimiento de jobs.

## Especificaciones funcionales
### FRS-BC-001
**Descripcion:** Alta, consulta, edicion y cierre de business cases.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-BC-002
**Descripcion:** Seleccion de equipamiento y determinaciones.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-BC-003
**Descripcion:** Calculos economicos, ROI y decision de factibilidad.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-BC-004
**Descripcion:** Gestion de inversiones, consumo y plan de despacho.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-BC-005
**Descripcion:** Control de ownership por seccion y bloqueo/desbloqueo.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-BC-006
**Descripcion:** Integracion con catalogos de equipos/determinaciones/plantillas.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-BC-007
**Descripcion:** Observabilidad del workspace y feature flags de autosave.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-BC-008
**Descripcion:** Cola de generacion de hojas BC y seguimiento de jobs.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

## Endpoints API relacionados
### Core business case
- `GET /api/v1/business-case`
- `POST /api/v1/business-case`
- `GET /api/v1/business-case/:id`
- `PUT /api/v1/business-case/:id`
- `DELETE /api/v1/business-case/:id`
- `POST /api/v1/business-case/:id/equipment`
- `GET /api/v1/business-case/:id/determinations`
- `POST /api/v1/business-case/:id/determinations`
- `PUT /api/v1/business-case/:id/determinations/:detId`
- `DELETE /api/v1/business-case/:id/determinations/:detId`
- `GET /api/v1/business-case/:id/calculations`
- `POST /api/v1/business-case/:id/recalculate`
- `GET /api/v1/business-case/:id/export/pdf`
- `GET /api/v1/business-case/:id/export/excel`
- `POST /api/v1/business-case/:id/feasibility-decision`

### Workspace, ownership y observabilidad
- `GET /api/v1/business-case/:id/ui-guidance`
- `GET /api/v1/business-case/:id/ownership`
- `POST /api/v1/business-case/:id/ownership/complete`
- `POST /api/v1/business-case/:id/sections/:section/lock`
- `POST /api/v1/business-case/:id/sections/:section/unlock`
- `POST /api/v1/business-case/observability/frontend-events`
- `GET /api/v1/business-case/observability/metrics`
- `GET /api/v1/business-case/observability/dashboard`
- `GET /api/v1/business-case/feature-flags/autosave`
- `PUT /api/v1/business-case/feature-flags/autosave`

### Inversiones, consumo y despacho
- `GET /api/v1/business-case/:id/investments`
- `POST /api/v1/business-case/:id/investments`
- `PUT /api/v1/business-case/:id/investments/:invId`
- `DELETE /api/v1/business-case/:id/investments/:invId`
- `GET /api/v1/business-case/:id/investments/catalog`
- `POST /api/v1/business-case/:id/investments/catalog`
- `POST /api/v1/business-case/:id/investments/selections`
- `GET /api/v1/business-case/:id/consumption-items`
- `PUT /api/v1/business-case/:id/consumption-items`
- `GET /api/v1/business-case/:id/dispatch-workspace`
- `PUT /api/v1/business-case/:id/dispatch-workspace/commercial-plan`
- `PUT /api/v1/business-case/:id/dispatch-workspace/operations-control`

### Hojas BC y jobs
- `GET /api/v1/business-case/:id/sheets/preview`
- `POST /api/v1/business-case/:id/sheets/generate`
- `GET /api/v1/business-case/:id/sheets/jobs/latest`
- `GET /api/v1/business-case/:id/sheets/jobs/:jobId`
- `GET /api/v1/business-case/sheets/metrics`
- `POST /internal/jobs/business-case/sheets/process-queue`
- `POST /internal/jobs/business-case/preflow/expiry`
- `POST /internal/jobs/business-case/determinations-gate/expiry`

### Catalogos
- `GET /api/v1/equipment-catalog`
- `GET /api/v1/equipment-catalog/:id`
- `POST /api/v1/equipment-catalog`
- `PUT /api/v1/equipment-catalog/:id`
- `GET /api/v1/determinations-catalog`
- `POST /api/v1/determinations-catalog`
- `PUT /api/v1/determinations-catalog/:id`
- `DELETE /api/v1/determinations-catalog/:id`
- `GET /api/v1/calculation-templates`
- `POST /api/v1/calculation-templates`
- `PUT /api/v1/calculation-templates/:id`
- `DELETE /api/v1/calculation-templates/:id`

## Validaciones y controles funcionales
### Control de acceso
- JWT obligatorio y `requireRole` por endpoint de seccion/accion.
- Operaciones administrativas restringidas a roles de gerencia/admin.

### Autenticacion
- Usuario autenticado requerido para todo el modulo.

### Autorizacion
- ACL por rol y por etapa del workflow.
- Mecanismos de ownership y lock de secciones para evitar edicion indebida.

### Registro de auditoria
- Registro de transiciones de estado y ownership.
- Trazabilidad de jobs de generacion de hojas y eventos de observabilidad.

### Proteccion de datos
- Validaciones de compatibilidad de equipo y determinaciones.
- Manejo de concurrencia/idempotencia en operaciones sensibles.

## Dependencias funcionales
- Comercial y Gestion de Clientes.
- Inventario y Equipos.
- Notificaciones y Comunicaciones.
- Reportes y Auditoria.
- Servicio Tecnico y Mantenimientos.

## Observaciones
- Alta complejidad de estados y permisos por seccion.
- Dependencia de jobs asincronos para entrega de artefactos BC.
- Riesgo de dualidad de datos entre metadata legacy y estructura canonica.
- Carga de calculos intensivos y reportes puede impactar rendimiento.
