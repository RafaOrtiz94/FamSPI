# FRS — MÓDULO TI, SOPORTE Y TICKETS

**Sistema:** FamSPI
**Versión:** 2.0
**Fecha:** 2026-06-18
**Estado:** En revisión
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5

---

## 1. Introducción

El presente documento especifica de forma funcional el comportamiento observable del módulo TI, Soporte y Tickets del sistema FamSPI. Cada especificación describe el endpoint real expuesto, las entradas que recibe, el proceso que ejecuta el servicio y la salida producida. Esta descripción se deriva directamente del código implementado en `supportTickets.routes.js` y `supportTickets.service.js`.

## 2. Descripción funcional

El módulo implementa una mesa de ayuda TI interna que cubre el ciclo completo de atención: creación de tickets por cualquier colaborador autenticado, clasificación por tipo y prioridad con cálculo automático de SLA, asignación a técnico TI, evolución del estado mediante transiciones validadas, comunicación entre partes (comentarios públicos e internos), cierre por el solicitante y retroalimentación de satisfacción. El workspace exclusivo para roles TI centraliza la gestión de carga y expone KPI de cumplimiento operativo.

El esquema de base de datos se inicializa mediante la función `ensureSupportSchema()` que crea en tiempo de ejecución las tablas `support_tickets`, `support_ticket_events` y `support_ticket_comments` si no existen.

## 3. Especificaciones funcionales

### FRS-TI-001 — Creación de ticket

**Endpoint:** `POST /api/v1/support-tickets`
**Acceso:** Cualquier usuario autenticado

**Entradas:**
```json
{
  "ticket_type": "fallo | implementacion | requerimiento | problema",
  "title": "string (max 180 caracteres)",
  "description": "string",
  "priority": "baja | media | alta | critica (default: media)",
  "impact": "bajo | medio | alto (default: medio)",
  "urgency": "bajo | medio | alto (default: medio)",
  "category": "string (opcional)",
  "subcategory": "string (opcional)"
}
```

**Proceso:**
1. Valida que `ticket_type` pertenezca a `TICKET_TYPES` y `priority` a `TICKET_PRIORITIES`.
2. Valida que `impact` y `urgency` pertenezcan a `ALLOWED_LVL`.
3. Calcula `first_response_due_at` y `resolution_due_at` según `SLA_HOURS_BY_PRIORITY[priority]`.
4. Genera `code` único con formato controlado.
5. Inserta en `support_tickets` con estado `abierto` y `sla_response_breached = false`.
6. Registra evento `created` en `support_ticket_events`.
7. Dispara notificación al equipo TI mediante `notificationsService`.

**Salida:** HTTP 201 con el objeto ticket creado incluyendo `id`, `code`, `status`, `first_response_due_at`, `resolution_due_at`.

---

### FRS-TI-002 — Consulta de tickets propios

**Endpoint:** `GET /api/v1/support-tickets/my`
**Acceso:** Cualquier usuario autenticado

**Entradas:** Sin body. El filtro se aplica sobre `req.user.id`.

**Proceso:**
1. Consulta `support_tickets` WHERE `requester_id = req.user.id`.
2. Ordena por `created_at DESC`.
3. Incluye datos calculados de vencimiento SLA.

**Salida:** HTTP 200 con array de tickets del solicitante. Cada ticket incluye `code`, `ticket_type`, `priority`, `status`, `sla_response_breached`, `sla_resolution_breached`, `created_at`, `resolved_at`.

---

### FRS-TI-003 — Consulta de eventos de un ticket

**Endpoint:** `GET /api/v1/support-tickets/:id/events`
**Acceso:** Cualquier usuario autenticado

**Entradas:** Parámetro de ruta `id` (bigint, id del ticket).

**Proceso:**
1. Verifica que el ticket con `id` existe en `support_tickets`.
2. Si el solicitante no es TI, verifica que `requester_id = req.user.id`.
3. Consulta `support_ticket_events` WHERE `ticket_id = id` ordenado por `created_at ASC`.

**Salida:** HTTP 200 con array de eventos. Cada evento incluye `event_type`, `payload`, `created_by`, `created_at`.

---

### FRS-TI-004 — Consulta de comentarios de un ticket

**Endpoint:** `GET /api/v1/support-tickets/:id/comments`
**Acceso:** Cualquier usuario autenticado

**Entradas:** Parámetro de ruta `id`.

**Proceso:**
1. Verifica que el ticket existe y el solicitante tiene acceso.
2. Si el rol del usuario no pertenece a `TI_ROLES`, filtra WHERE `visibility = 'public'`.
3. Si el rol pertenece a `TI_ROLES`, devuelve todos los comentarios independientemente de `visibility`.

**Salida:** HTTP 200 con array de comentarios incluyendo `body`, `visibility`, `created_by`, `created_at`.

---

### FRS-TI-005 — Agregar comentario a un ticket

**Endpoint:** `POST /api/v1/support-tickets/:id/comments`
**Acceso:** Cualquier usuario autenticado

**Entradas:**
```json
{
  "body": "string (texto del comentario)",
  "visibility": "public | internal (default: public)"
}
```

**Proceso:**
1. Valida que `visibility` pertenezca a `COMMENT_VISIBILITY`.
2. Si `visibility = internal` y el usuario no pertenece a `TI_ROLES`, rechaza con 403.
3. Inserta en `support_ticket_comments` con `ticket_id`, `author_id = req.user.id`, `body`, `visibility`.
4. Registra evento `commented` en `support_ticket_events`.
5. Si es un comentario público de TI y `first_response_at` es null, establece `first_response_at = NOW()`.

**Salida:** HTTP 201 con el comentario creado.

---

### FRS-TI-006 — Reapertura de ticket por el solicitante

**Endpoint:** `POST /api/v1/support-tickets/:id/reopen`
**Acceso:** Cualquier usuario autenticado

**Entradas:** Parámetro de ruta `id`. Sin body adicional requerido.

**Proceso:**
1. Verifica que `requester_id = req.user.id`.
2. Verifica que el estado actual pertenezca a los estados desde los que `reabierto` es una transición válida (`resuelto`, `cerrado`).
3. Actualiza `status = 'reabierto'`, incrementa `reopened_count`, establece `last_reopened_at = NOW()`.
4. Registra evento `reopened` en `support_ticket_events`.

**Salida:** HTTP 200 con el ticket actualizado.

---

### FRS-TI-007 — Cierre de ticket por el solicitante

**Endpoint:** `POST /api/v1/support-tickets/:id/close`
**Acceso:** Cualquier usuario autenticado

**Entradas:** Parámetro de ruta `id`.

**Proceso:**
1. Verifica que `requester_id = req.user.id`.
2. Verifica que la transición a `cerrado` es válida desde el estado actual.
3. Actualiza `status = 'cerrado'`, `closed_by_requester = true`.
4. Registra evento `closed_by_requester` en `support_ticket_events`.

**Salida:** HTTP 200 con el ticket actualizado.

---

### FRS-TI-008 — Registro de satisfacción (CSAT)

**Endpoint:** `POST /api/v1/support-tickets/:id/satisfaction`
**Acceso:** Cualquier usuario autenticado

**Entradas:**
```json
{
  "score": 1 | 2 | 3 | 4 | 5,
  "comment": "string (opcional)"
}
```

**Proceso:**
1. Verifica que `requester_id = req.user.id`.
2. Verifica que el ticket está en estado `resuelto` o `cerrado`.
3. Actualiza `satisfaction_score` y `satisfaction_comment`.
4. Registra evento `satisfaction_rated` en `support_ticket_events`.

**Salida:** HTTP 200 confirmando el registro de la calificación.

---

### FRS-TI-009 — Workspace TI: listado de tickets

**Endpoint:** `GET /api/v1/support-tickets/workspace/list`
**Acceso:** `TI_ROLES` únicamente (`requireRole(TI_ROLES)`)

**Entradas:** Query params opcionales: `status`, `assigned_to`, `priority`, `page`, `limit`.

**Proceso:**
1. Valida rol mediante `requireRole(TI_ROLES)`.
2. Consulta `support_tickets` con los filtros aplicados.
3. Incluye datos de `requester` (nombre, email) y `assigned_ti_user`.
4. Calcula y agrega alertas de vencimiento SLA en tiempo real comparando timestamps con `NOW()`.

**Salida:** HTTP 200 con array paginado de tickets. Incluye `total`, `page`, `limit` y datos de cada ticket con indicadores SLA.

---

### FRS-TI-010 — Workspace TI: KPI operativos

**Endpoint:** `GET /api/v1/support-tickets/workspace/kpi`
**Acceso:** `TI_ROLES` únicamente

**Entradas:** Query params opcionales: `from`, `to` (rango de fechas).

**Proceso:**
1. Valida rol mediante `requireRole(TI_ROLES)`.
2. Agrega métricas desde `support_tickets` y `support_ticket_events`:
   - Tickets por estado.
   - Tickets con `sla_response_breached = true` y `sla_resolution_breached = true`.
   - Tiempo promedio de primera respuesta (`first_response_at - created_at`).
   - Tiempo promedio de resolución (`resolved_at - created_at`).
   - CSAT promedio (`AVG(satisfaction_score)`).
   - Carga por técnico (`assigned_ti_user_id`).

**Salida:** HTTP 200 con objeto de métricas estructurado.

---

### FRS-TI-011 — Auto-asignación de técnico TI

**Endpoint:** `PATCH /api/v1/support-tickets/:id/assign-self`
**Acceso:** `TI_ROLES` únicamente

**Entradas:** Parámetro de ruta `id`.

**Proceso:**
1. Valida rol mediante `requireRole(TI_ROLES)`.
2. Actualiza `assigned_ti_user_id = req.user.id`.
3. Si `first_response_at` es null, establece `first_response_at = NOW()`.
4. Registra evento `assigned` en `support_ticket_events` con `payload = { assigned_to: req.user.id }`.
5. Notifica al solicitante mediante `notificationsService`.

**Salida:** HTTP 200 con el ticket actualizado incluyendo los datos del técnico asignado.

---

### FRS-TI-012 — Cambio de estado por TI

**Endpoint:** `PATCH /api/v1/support-tickets/:id/status`
**Acceso:** `TI_ROLES` únicamente

**Entradas:**
```json
{
  "status": "triage | en_progreso | en_espera | resuelto | cerrado",
  "on_hold_reason": "string (requerido si status = en_espera)"
}
```

**Proceso:**
1. Valida rol mediante `requireRole(TI_ROLES)`.
2. Normaliza el estado con `normalizeStatus()` (alias `terminado → resuelto`).
3. Verifica que la transición desde el estado actual sea válida en `ALLOWED_TRANSITIONS`.
4. Si la transición no es válida, rechaza con HTTP 400.
5. Actualiza `status` y `on_hold_reason` si aplica.
6. Si nuevo estado es `resuelto`, establece `resolved_at = NOW()`.
7. Registra evento `status_changed` con estados anterior y nuevo.

**Salida:** HTTP 200 con el ticket actualizado.

## 4. Tabla de endpoints completos

| Método | Endpoint | Acceso | Función |
|---|---|---|---|
| POST | `/api/v1/support-tickets` | Autenticado | Crear ticket |
| GET | `/api/v1/support-tickets/my` | Autenticado | Listar tickets propios |
| GET | `/api/v1/support-tickets/:id/events` | Autenticado | Ver eventos del ticket |
| GET | `/api/v1/support-tickets/:id/comments` | Autenticado | Ver comentarios (filtrado por rol) |
| POST | `/api/v1/support-tickets/:id/comments` | Autenticado | Agregar comentario |
| POST | `/api/v1/support-tickets/:id/reopen` | Autenticado | Reabrir ticket |
| POST | `/api/v1/support-tickets/:id/close` | Autenticado | Cerrar ticket (solicitante) |
| POST | `/api/v1/support-tickets/:id/satisfaction` | Autenticado | Registrar CSAT |
| GET | `/api/v1/support-tickets/workspace/list` | `TI_ROLES` | Workspace TI — listado |
| GET | `/api/v1/support-tickets/workspace/kpi` | `TI_ROLES` | Workspace TI — KPI |
| PATCH | `/api/v1/support-tickets/:id/assign-self` | `TI_ROLES` | Auto-asignarse ticket |
| PATCH | `/api/v1/support-tickets/:id/status` | `TI_ROLES` | Cambiar estado del ticket |

## 5. Controles de acceso

| Nivel | Mecanismo | Detalle |
|---|---|---|
| Autenticación global | JWT middleware | Aplicado a nivel de router; todas las rutas requieren token válido |
| Roles TI | `requireRole(TI_ROLES)` | Aplicado explícitamente en 4 rutas de workspace y gestión |
| Acceso a datos propios | Validación en servicio | `requester_id = req.user.id` para cierre, reapertura y CSAT |
| Comentarios internos | Validación en servicio | `visibility = internal` filtrado según pertenencia a `TI_ROLES` |

Los roles que conforman `TI_ROLES` son: `ti`, `jefe_ti`, `admin_ti`, `jefe_de_ti`, `tecnico`, `jefe_tecnico`, `servicio_tecnico`, `jefe_servicio_tecnico`.

## 6. Dependencias

| Dependencia | Tipo | Uso |
|---|---|---|
| `auth` middleware | Middleware JWT | Validación de sesión en todas las rutas |
| `notifications.service` | Módulo interno | Notificación al solicitante ante asignación y cambios de estado |
| `notificationManager` | Módulo interno | Gestión de eventos de notificación |
| PostgreSQL — `support_tickets` | Tabla principal | Ciclo de vida completo del ticket |
| PostgreSQL — `support_ticket_events` | Tabla de trazabilidad | Registro de eventos del ciclo |
| PostgreSQL — `support_ticket_comments` | Tabla de comunicación | Comentarios públicos e internos |
| PostgreSQL — `users` | Referencia FK | `requester_id`, `assigned_ti_user_id` |

## 7. Observaciones

- La constante `TI_ROLES` se exporta desde `supportTickets.service.js` y es importada directamente por el router; si se modifica en el servicio, el cambio se propaga automáticamente a los controles de acceso de las rutas.
- El esquema se crea en runtime mediante `ensureSupportSchema()`; un fallo en la inicialización bloquea la operación completa del módulo hasta el reinicio del servidor.
- La saturación de tickets con prioridad `critica` (SLA: 1h respuesta / 8h resolución) puede generar picos en el indicador `sla_response_breached` si el equipo TI no tiene capacidad suficiente.
- La función `normalizeStatus()` maneja el alias `terminado → resuelto` para compatibilidad con integraciones externas o entradas del usuario, pero no expande la matriz de transiciones permitidas.
- Los comentarios internos deben validarse también en el frontend para evitar que un solicitante intente enviar `visibility = internal` a través de la API directamente.
