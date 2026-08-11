# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)

## Nombre del modulo
Comercial y Gestion de Clientes

## Descripcion funcional
Gestiona el ciclo comercial interno: solicitudes corporativas, alta y seguimiento de nuevos clientes, compras publicas/privadas asociadas al proceso comercial y planificacion mensual de visitas.

## Logica funcional observada
- Solicitudes generales por rol comercial.
- Flujo de nuevo cliente con consentimiento y checklist.
- Gestion de cartera de clientes, asignaciones y visitas.
- Compras publicas de equipos y su flujo de entrega.
- Compras privadas con transiciones de estado y timeline.
- Cronogramas mensuales de visitas y aprobaciones gerenciales.

## Especificaciones funcionales
### FRS-COM-001
**Descripcion:** Solicitudes generales por rol comercial.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-COM-002
**Descripcion:** Flujo de nuevo cliente con consentimiento y checklist.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-COM-003
**Descripcion:** Gestion de cartera de clientes, asignaciones y visitas.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-COM-004
**Descripcion:** Compras publicas de equipos y su flujo de entrega.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-COM-005
**Descripcion:** Compras privadas con transiciones de estado y timeline.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-COM-006
**Descripcion:** Cronogramas mensuales de visitas y aprobaciones gerenciales.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

## Endpoints API relacionados
### Solicitudes y nuevo cliente
- `POST /api/v1/requests`
- `GET /api/v1/requests`
- `GET /api/v1/requests/:id`
- `PUT /api/v1/requests/:id/resubmit`
- `POST /api/v1/requests/:id/cancel`
- `GET /api/v1/requests/public/consent/:token`
- `POST /api/v1/requests/new-client/consent-token`
- `POST /api/v1/requests/new-client/consent-token/verify`
- `POST /api/v1/requests/new-client`
- `GET /api/v1/requests/new-client/my`
- `GET /api/v1/requests/new-client`
- `GET /api/v1/requests/new-client/summary`
- `GET /api/v1/requests/new-client/:id`
- `PUT /api/v1/requests/new-client/:id/quality-checklist`
- `PUT /api/v1/requests/new-client/:id/process`
- `PUT /api/v1/requests/new-client/:id`

### Clientes
- `GET /api/v1/clients`
- `GET /api/v1/clients/:id`
- `PUT /api/v1/clients/:id`
- `POST /api/v1/clients/:id/assign`
- `POST /api/v1/clients/:id/visit-status`
- `POST /api/v1/clients/prospect-visit`

### Compras publicas
- `GET /api/v1/equipment-purchases/events`
- `GET /api/v1/equipment-purchases/meta`
- `GET /api/v1/equipment-purchases/stats`
- `GET /api/v1/equipment-purchases`
- `GET /api/v1/equipment-purchases/:id`
- `POST /api/v1/equipment-purchases`
- `POST /api/v1/equipment-purchases/:id/start-availability`
- `POST /api/v1/equipment-purchases/:id/request-proforma`
- `POST /api/v1/equipment-purchases/:id/upload-contract`
- `POST /api/v1/equipment-purchases/:id/request-delivery-dates`
- `POST /api/v1/equipment-purchases/:id/complete-delivery`

### Compras privadas
- `GET /api/v1/private-purchases/events`
- `GET /api/v1/private-purchases`
- `GET /api/v1/private-purchases/:id`
- `POST /api/v1/private-purchases`
- `POST /api/v1/private-purchases/:id/transition`
- `GET /api/v1/private-purchases/:id/transitions`
- `POST /api/v1/private-purchases/:id/start-business-case`
- `POST /api/v1/private-purchases/:id/request-client-registration`
- `POST /api/v1/private-purchases/:id/complete-delivery`
- `GET /api/v1/private-purchases/:id/timeline`

### Cronogramas comerciales
- `GET /api/v1/schedules`
- `GET /api/v1/schedules/pending-approval`
- `GET /api/v1/schedules/team`
- `GET /api/v1/schedules/analytics`
- `GET /api/v1/schedules/approved/current`
- `GET /api/v1/schedules/:id`
- `POST /api/v1/schedules`
- `PUT /api/v1/schedules/:id`
- `DELETE /api/v1/schedules/:id`
- `POST /api/v1/schedules/:id/submit`
- `POST /api/v1/schedules/:id/visits`
- `PUT /api/v1/schedules/:id/visits/:visitId`
- `DELETE /api/v1/schedules/:id/visits/:visitId`
- `POST /api/v1/schedules/:id/approve`
- `POST /api/v1/schedules/:id/reject`

## Validaciones y controles funcionales
### Control de acceso
- JWT obligatorio en rutas privadas.
- `requireRole` explicito en operaciones sensibles de clientes, cronogramas y compras publicas.

### Autenticacion
- Acceso autenticado para todo endpoint no publico.
- Unico endpoint publico del modulo: consentimiento por token.

### Autorizacion
- Reglas por rol comercial, jefaturas, backoffice, gerencia y actores tecnicos.
- Transiciones de compras privadas condicionadas por estado + rol.

### Registro de auditoria
- Registro de acciones en solicitudes y clientes (`logAction`).
- Timeline de eventos para compras privadas/publicas.

### Proteccion de datos
- Validaciones de payload y archivos con `multer`.
- Evidencias en Drive con trazabilidad documental.

## Dependencias funcionales
- Autenticacion y Sesiones.
- Usuarios y Perfiles.
- Inventario y Equipos.
- Documentos/Archivos/Firma.
- Notificaciones y Comunicaciones.
- Business Case Comercial.
- Servicio Tecnico y Mantenimientos.

## Observaciones
- Alta complejidad del workflow comercial (riesgo de desalineacion de estado).
- Coexistencia de flujos legacy y V2 en fachada de solicitudes/compras.
- Endpoints de compras privadas sin `requireRole` uniforme en ruta (control desplazado a capa servicio/state machine).
- Dependencia de integraciones Drive/Gmail para continuidad de proceso.
