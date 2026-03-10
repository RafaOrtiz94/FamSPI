# DOCUMENTO DE DISENO DEL SISTEMA (DS)

## Nombre del modulo
TI Soporte y Tickets

## Arquitectura del modulo
- Capa de presentacion: frontend React o consumidores internos del SPI.
- Capa API: rutas Express bajo prefijos del backend.
- Capa de negocio: controladores y servicios del modulo.
- Capa de persistencia: consultas SQL directas y tablas asociadas.
- Capa transversal: autenticacion, autorizacion, auditoria y notificaciones cuando aplica.

## Componentes del sistema
### Controladores
- `backend/src/modules/support-tickets/supportTickets.controller.js`

### Servicios
- `backend/src/modules/support-tickets/supportTickets.service.js`

### Modelos
- Sin ORM; SQL directo con reglas de transicion y SLA en servicio.

### Rutas
- `backend/src/modules/support-tickets/supportTickets.routes.js`

### Componentes de interfaz
- `spi_front/src/modules/ti/pages/TicketsWorkspace.jsx`
- `spi_front/src/core/api/supportTicketsApi.js`

## Modelo de datos asociado
- `support_tickets`
- `support_ticket_events`
- `support_ticket_comments`

## Interfaces API
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

## Dependencias tecnicas
- Autenticacion y Sesiones.
- Usuarios y Perfiles.
- Notificaciones y Comunicaciones.
- Reportes y Auditoria (consumo de trazabilidad y KPI).

## Controles de seguridad y operacion
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

## Riesgos tecnicos detectados
- Dependencia de notificaciones para comunicar cambios al solicitante.
- Saturacion de tickets criticos puede degradar tiempos SLA.
- Si falla la inicializacion de esquema runtime, puede bloquear operacion.
- Error en matriz de transiciones impacta continuidad del workflow TI.

## Diagrama tecnico
`mermaid
flowchart LR
  UI[Frontend o consumidor] --> API[API SUP]
  API --> CTRL[Controladores]
  CTRL --> SVC[Servicios]
  SVC --> DB[(Base de datos)]
  SVC --> EXT[Dependencias externas o modulos transversales]
`
