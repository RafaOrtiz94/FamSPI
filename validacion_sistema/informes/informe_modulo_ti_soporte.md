# INFORME DE VALIDACION DEL MODULO

## Nombre del modulo
TI Soporte y Tickets

## Descripcion del modulo
Implementa la mesa de ayuda TI para incidentes y requerimientos internos, con gestion de estados, asignacion de responsables, comentarios, trazabilidad de eventos y control SLA.

## Alcance funcional
- Registro de tickets por cualquier usuario autenticado.
- Vista del solicitante y workspace especializado de TI.
- Asignacion de ticket, cambios de estado y reglas de transicion.
- Comentarios publicos e internos por ticket.
- Cierre por solicitante, reapertura y encuesta de satisfaccion.
- KPI operativos: atrasos SLA, tiempos de respuesta, ciclo y entrega.

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

## Endpoints de API
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

## Tablas de base de datos asociadas
- `support_tickets`
- `support_ticket_events`
- `support_ticket_comments`

## Dependencias con otros modulos
- Autenticacion y Sesiones.
- Usuarios y Perfiles.
- Notificaciones y Comunicaciones.
- Reportes y Auditoria (consumo de trazabilidad y KPI).

## Controles de seguridad
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

## Riesgos operativos
- Dependencia de notificaciones para comunicar cambios al solicitante.
- Saturacion de tickets criticos puede degradar tiempos SLA.
- Si falla la inicializacion de esquema runtime, puede bloquear operacion.
- Error en matriz de transiciones impacta continuidad del workflow TI.

## Posibles escenarios de falla
- Ticket en estado no permitido por transicion solicitada.
- Comentario interno enviado por usuario no TI.
- Reapertura concurrente sobre ticket ya en progreso.
- KPI desalineado por eventos incompletos o faltantes.

## Nivel de criticidad
ALTO

## Prioridad de validacion
MEDIA-ALTA

---

## BASE DOCUMENTAL PARA VALIDACION

## Requerimientos del usuario (URS)
- `URS-TI-001`: El sistema debe permitir registrar tickets de soporte con prioridad y tipo.
- `URS-TI-002`: El sistema debe permitir a TI asignar y gestionar tickets por estado.
- `URS-TI-003`: El sistema debe permitir trazar historial y comentarios por ticket.
- `URS-TI-004`: El sistema debe permitir cerrar, reabrir y calificar satisfaccion.
- `URS-TI-005`: El sistema debe mostrar KPI de cumplimiento SLA y carga operativa.

## Requerimientos funcionales
- `RF-TI-001`: Persistir ticket y generar codigo unico por registro.
- `RF-TI-002`: Enforzar transiciones validas de estado en backend.
- `RF-TI-003`: Registrar eventos y comentarios con visibilidad controlada.
- `RF-TI-004`: Calcular KPI y vencimientos SLA desde metrica temporal.
- `RF-TI-005`: Notificar automaticamente cambios relevantes de ticket.

## Resumen del diseno tecnico
- Servicio unico `supportTickets.service` con logica de negocio y SLA.
- Persistencia SQL transaccional + eventos asociados.
- Workspace React de TI con filtros, KPI y acciones inline.
- Integracion con modulo de notificaciones para alertas de ciclo.

## Escenarios de prueba
### Funcionalidad
- Caso: Crear ticket y asignarlo a analista TI.
- Resultado esperado: Estado actualizado, evento registrado y notificaciones emitidas.

### Seguridad
- Caso: Usuario no TI intenta cambiar estado de ticket.
- Resultado esperado: `403` y estado intacto.

### Manejo de errores
- Caso: Solicitar transicion invalida de estado.
- Resultado esperado: Error de negocio y sin evento de cambio.

### Integridad de datos
- Caso: Cerrar ticket resuelto y registrar calificacion.
- Resultado esperado: `closed_by_requester=true`, CSAT persistido y trazabilidad completa.

---

## MATRIZ DE TRAZABILIDAD

| Requerimiento | Componente | Prueba |
|---|---|---|
| REQ-TI-001 Registro de tickets | `supportTickets.service.createTicket` | Crear ticket y validar `support_tickets` + codigo |
| REQ-TI-002 Gestion por TI | `assignTicketToSelf` + `updateTicketStatus` | Asignar y transicionar segun matriz permitida |
| REQ-TI-003 Trazabilidad | `createEvent` + `addTicketComment` | Verificar eventos/comentarios y visibilidad |
| REQ-TI-004 Cierre/reapertura/CSAT | `closeTicketByRequester`, `reopenTicket`, `rateTicketSatisfaction` | Ejecutar ciclo completo y validar campos SLA/CSAT |
| REQ-TI-005 KPI de workspace | `getWorkspaceKpis` | Consultar KPI y validar calculos de tiempos/vencidos |
