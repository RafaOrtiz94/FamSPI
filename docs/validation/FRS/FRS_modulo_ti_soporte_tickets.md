# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)

## Nombre del modulo
TI Soporte y Tickets

## Descripcion funcional
Implementa la mesa de ayuda TI para incidentes y requerimientos internos, con gestion de estados, asignacion de responsables, comentarios, trazabilidad de eventos y control SLA.

## Logica funcional observada
- Registro de tickets por cualquier usuario autenticado.
- Vista del solicitante y workspace especializado de TI.
- Asignacion de ticket, cambios de estado y reglas de transicion.
- Comentarios publicos e internos por ticket.
- Cierre por solicitante, reapertura y encuesta de satisfaccion.
- KPI operativos: atrasos SLA, tiempos de respuesta, ciclo y entrega.

## Especificaciones funcionales
### FRS-SUP-001
**Descripcion:** Registro de tickets por cualquier usuario autenticado.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-SUP-002
**Descripcion:** Vista del solicitante y workspace especializado de TI.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-SUP-003
**Descripcion:** Asignacion de ticket, cambios de estado y reglas de transicion.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-SUP-004
**Descripcion:** Comentarios publicos e internos por ticket.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-SUP-005
**Descripcion:** Cierre por solicitante, reapertura y encuesta de satisfaccion.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-SUP-006
**Descripcion:** KPI operativos: atrasos SLA, tiempos de respuesta, ciclo y entrega.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

## Endpoints API relacionados
### Solicitudes del usuario
- `POST /api/v1/support-tickets`
- `GET /api/v1/support-tickets/my`
- `GET /api/v1/support-tickets/:id/events`
- `GET /api/v1/support-tickets/:id/comments`
- `POST /api/v1/support-tickets/:id/comments`
- `POST /api/v1/support-tickets/:id/reopen`
- `POST /api/v1/support-tickets/:id/close`
- `POST /api/v1/support-tickets/:id/satisfaction`

### Workspace TI
- `GET /api/v1/support-tickets/workspace/list`
- `GET /api/v1/support-tickets/workspace/kpi`
- `PATCH /api/v1/support-tickets/:id/assign-self`
- `PATCH /api/v1/support-tickets/:id/status`

## Validaciones y controles funcionales
### Control de acceso
- JWT global para todas las rutas de soporte.
- Acciones de workspace restringidas a `TI_ROLES`.

### Autenticacion
- Requiere usuario autenticado para crear/consultar tickets.

### Autorizacion
- El solicitante solo accede a sus tickets.
- TI puede gestionar asignacion, estado y comentarios internos.
- Validacion de transiciones de estado en servicio.

### Registro de auditoria
- Eventos por ticket (`created`, `assigned`, `status_changed`, `commented`, `reopened`, `closed_by_requester`).
- KPI derivados de eventos y timestamps de ciclo.

### Proteccion de datos
- Comentarios con visibilidad `public` o `internal`.
- Validacion de payload (tipo, prioridad, severidad, longitud minima).

## Dependencias funcionales
- Autenticacion y Sesiones.
- Usuarios y Perfiles.
- Notificaciones y Comunicaciones.
- Reportes y Auditoria (consumo de trazabilidad y KPI).

## Observaciones
- Dependencia de notificaciones para comunicar cambios al solicitante.
- Saturacion de tickets criticos puede degradar tiempos SLA.
- Si falla la inicializacion de esquema runtime, puede bloquear operacion.
- Error en matriz de transiciones impacta continuidad del workflow TI.
