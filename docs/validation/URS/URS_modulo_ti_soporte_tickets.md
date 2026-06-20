# URS — MÓDULO TI, SOPORTE Y TICKETS

**Sistema:** FamSPI
**Versión:** 2.0
**Fecha:** 2026-06-18
**Estado:** En revisión
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5

---

## 1. Introducción

El presente documento define los requerimientos de usuario del módulo TI, Soporte y Tickets del sistema FamSPI. Su propósito es establecer, desde la perspectiva de los actores operativos y del equipo de tecnología, qué capacidades debe ofrecer la mesa de ayuda interna, por qué son necesarias y cómo deben manifestarse en la operación diaria.

El módulo centraliza la recepción, clasificación, asignación y resolución de incidentes, requerimientos técnicos, fallas y problemas reportados por cualquier colaborador autenticado. La necesidad se fundamenta en la obligación institucional de atender solicitudes TI con trazabilidad completa del ciclo, compromisos de tiempo de respuesta y resolución medibles mediante SLA, evidencia de comunicación entre solicitante y técnico, y visibilidad gerencial del desempeño del área.

## 2. Objetivo

Definir los requerimientos de usuario de alto nivel para el módulo `support-tickets`, estableciendo la justificación funcional de la mesa de ayuda, los actores involucrados, las capacidades esperadas por cada actor y las restricciones de negocio que deben respetarse durante el ciclo completo de atención.

## 3. Alcance

**Incluye:**
- Creación de tickets por cualquier usuario autenticado del sistema.
- Clasificación por tipo (`fallo`, `implementacion`, `requerimiento`, `problema`), prioridad (`baja`, `media`, `alta`, `critica`), impacto y urgencia.
- Gestión del ciclo de vida del ticket: estados `abierto`, `triage`, `en_progreso`, `en_espera`, `resuelto`, `cerrado`, `reabierto`.
- Auto-asignación de técnico TI y cambios de estado con validación de transiciones permitidas.
- Comentarios públicos (visibles al solicitante) e internos (exclusivos del equipo TI).
- Cierre del ticket por el solicitante, reapertura y encuesta de satisfacción (CSAT).
- KPI del workspace TI: carga por técnico, atrasos SLA, tiempos de ciclo y cumplimiento.
- Trazabilidad de eventos por ticket: creación, asignación, cambios de estado, comentarios, reapertura, cierre.
- Integración con el módulo de notificaciones para alertar cambios al solicitante.

**Excluye:**
- Gestión de activos TI físicos (cubierta por el módulo `ti-assets`).
- Gestión de usuarios y roles (módulo `auth` / administración).
- Generación de reportes formales en PDF o Drive.
- Integración con sistemas externos de ITSM.

## 4. Actores

| Actor | Rol en el sistema | Capacidades en este módulo |
|---|---|---|
| Colaborador autenticado (solicitante) | Cualquier usuario con sesión activa | Crear tickets, consultar sus propios tickets, agregar comentarios, cerrar, reabrir y calificar |
| Técnico TI | `tecnico`, `servicio_tecnico` | Auto-asignarse tickets, cambiar estado según transiciones, agregar comentarios públicos e internos |
| Jefe TI / Admin TI | `jefe_ti`, `admin_ti`, `jefe_de_ti`, `jefe_tecnico`, `jefe_servicio_tecnico` | Todas las capacidades del técnico, más acceso a workspace y KPI |
| Equipo TI general | `ti`, `admin_ti` | Acceso completo al workspace de gestión y métricas KPI |
| Supervisión / Gerencia TI | Roles TI con visión de reporting | Consultar KPI operativos del workspace |

## 5. Justificación

El módulo existe porque FamSPI requiere una mesa de ayuda interna que formalice la atención de incidentes y requerimientos TI. Sin este módulo, las solicitudes se canalizan por medios informales (WhatsApp, correo) sin evidencia de tiempos, responsables ni satisfacción. El control SLA es crítico para compromisos de calidad de servicio interno. La separación entre comentarios públicos e internos protege la comunicación técnica del equipo. La trazabilidad de eventos es requerida para auditorías internas y seguimiento de calidad. El cierre por el solicitante y la encuesta CSAT proveen retroalimentación objetiva sobre la calidad percibida del servicio TI.

## 6. Requerimientos funcionales

**REQ-TI-001**
- **Actor:** Colaborador autenticado.
- **Requerimiento:** El sistema debe permitir crear tickets de soporte especificando tipo, título, descripción, prioridad, impacto, urgencia, categoría y subcategoría.
- **Resultado esperado:** Se genera un ticket con código único (`code VARCHAR(24)`), fechas SLA calculadas automáticamente según la prioridad (`first_response_due_at`, `resolution_due_at`) y estado inicial `abierto`.

**REQ-TI-002**
- **Actor:** Colaborador autenticado.
- **Requerimiento:** El sistema debe permitir al solicitante consultar únicamente sus propios tickets activos e históricos.
- **Resultado esperado:** `GET /my` devuelve el listado de tickets donde `requester_id` coincide con el usuario autenticado.

**REQ-TI-003**
- **Actor:** Colaborador autenticado y equipo TI.
- **Requerimiento:** El sistema debe permitir consultar la línea de tiempo de eventos de un ticket y sus comentarios.
- **Resultado esperado:** Se devuelven los eventos registrados en `support_ticket_events` y los comentarios de `support_ticket_comments` filtrando por visibilidad según el rol del solicitante.

**REQ-TI-004**
- **Actor:** Colaborador autenticado y equipo TI.
- **Requerimiento:** El sistema debe permitir agregar comentarios a un ticket indicando si son públicos o internos.
- **Resultado esperado:** El comentario queda registrado con `visibility` = `public` o `internal`; los comentarios internos solo son visibles para roles `TI_ROLES`.

**REQ-TI-005**
- **Actor:** Colaborador autenticado.
- **Requerimiento:** El sistema debe permitir al solicitante reabrir un ticket previamente resuelto o cerrado.
- **Resultado esperado:** El ticket cambia a estado `reabierto`, se incrementa `reopened_count` y se registra `last_reopened_at`.

**REQ-TI-006**
- **Actor:** Colaborador autenticado.
- **Requerimiento:** El sistema debe permitir al solicitante cerrar su propio ticket cuando considere resuelta la solicitud.
- **Resultado esperado:** El ticket cambia a estado `cerrado`, `closed_by_requester = true` queda persistido y se registra el evento.

**REQ-TI-007**
- **Actor:** Colaborador autenticado.
- **Requerimiento:** El sistema debe permitir al solicitante registrar una calificación de satisfacción (CSAT) sobre la atención recibida.
- **Resultado esperado:** Se persisten `satisfaction_score` (1–5) y `satisfaction_comment` en el ticket; solo se acepta sobre tickets en estado `resuelto` o `cerrado`.

**REQ-TI-008**
- **Actor:** Equipo TI (`TI_ROLES`).
- **Requerimiento:** El sistema debe permitir al técnico TI auto-asignarse un ticket del workspace.
- **Resultado esperado:** `assigned_ti_user_id` se actualiza con el id del técnico, se registra `first_response_at` si es la primera respuesta y se genera evento de asignación.

**REQ-TI-009**
- **Actor:** Equipo TI (`TI_ROLES`).
- **Requerimiento:** El sistema debe permitir cambiar el estado de un ticket siguiendo las transiciones definidas.
- **Resultado esperado:** El nuevo estado queda persistido solo si la transición es válida según `ALLOWED_TRANSITIONS`; de lo contrario se rechaza con error 400. Se registra evento `status_changed`.

**REQ-TI-010**
- **Actor:** Equipo TI (`TI_ROLES`).
- **Requerimiento:** El sistema debe exponer un workspace con todos los tickets activos y sus métricas de carga.
- **Resultado esperado:** `GET /workspace/list` devuelve tickets con filtros por estado, técnico asignado y alertas de vencimiento SLA.

**REQ-TI-011**
- **Actor:** Equipo TI / supervisión.
- **Requerimiento:** El sistema debe exponer KPI operativos del módulo de soporte.
- **Resultado esperado:** `GET /workspace/kpi` devuelve indicadores de volumen, tiempo de respuesta promedio, cumplimiento SLA, tickets vencidos y CSAT promedio.

## 7. Requerimientos no funcionales

**RNF-TI-001 Autenticación:** Todas las rutas del módulo requieren sesión activa validada mediante JWT. No existe ningún endpoint público en este módulo.

**RNF-TI-002 Control de acceso por rol:** Las rutas `/workspace/list`, `/workspace/kpi`, `PATCH /:id/assign-self` y `PATCH /:id/status` están restringidas a los roles definidos en `TI_ROLES`: `ti`, `jefe_ti`, `admin_ti`, `jefe_de_ti`, `tecnico`, `jefe_tecnico`, `servicio_tecnico`, `jefe_servicio_tecnico`.

**RNF-TI-003 Integridad de transiciones:** El servicio debe rechazar con error 400 cualquier cambio de estado que no esté definido en la matriz `ALLOWED_TRANSITIONS`. El alias `terminado → resuelto` es la única normalización permitida.

**RNF-TI-004 Trazabilidad de ciclo:** Cada acción relevante sobre un ticket debe quedar registrada en `support_ticket_events` con tipo de evento, actor y timestamp. Los eventos mínimos requeridos son: `created`, `assigned`, `status_changed`, `commented`, `reopened`, `closed_by_requester`, `satisfaction_rated`.

**RNF-TI-005 Visibilidad de comentarios:** Los comentarios con `visibility = internal` no deben ser accesibles para usuarios que no pertenezcan a `TI_ROLES`. La consulta `GET /:id/comments` debe filtrar por el rol del solicitante de la petición.

**RNF-TI-006 Cálculo SLA automático:** Al crear un ticket, el sistema debe calcular `first_response_due_at` y `resolution_due_at` en función de la prioridad según la tabla `SLA_HOURS_BY_PRIORITY`: critica (1h / 8h), alta (4h / 24h), media (8h / 72h), baja (24h / 120h).

**RNF-TI-007 Rendimiento del workspace:** Las consultas del workspace deben responder en tiempos operativos adecuados para el volumen diario esperado, con soporte de filtros por estado y técnico asignado sin degradación crítica.

## 8. Reglas de negocio

1. Los tipos de ticket válidos son exclusivamente: `fallo`, `implementacion`, `requerimiento`, `problema`.
2. Las prioridades válidas son: `baja`, `media`, `alta`, `critica`. El valor por defecto es `media`.
3. La secuencia de estados válida está definida por `ALLOWED_TRANSITIONS`; ninguna transición fuera de esa matriz puede ejecutarse.
4. El alias `terminado` se normaliza internamente a `resuelto` mediante `STATUS_ALIASES`.
5. Solo el solicitante original (`requester_id`) puede ejecutar las acciones de cierre, reapertura y CSAT.
6. La calificación de satisfacción solo puede registrarse cuando el ticket está en estado `resuelto` o `cerrado`.
7. Los comentarios internos son exclusivos del equipo TI y no deben exponerse al solicitante.
8. Los roles de gestión están definidos en la constante exportada `TI_ROLES` del servicio y son consumidos por el router.
9. El campo `sla_response_breached` y `sla_resolution_breached` deben actualizarse cuando se supera el tiempo definido por prioridad.
10. Un ticket en estado `cerrado` solo puede transicionar a `reabierto`.

## 9. Dependencias

| Módulo | Dependencia |
|---|---|
| `auth` / `users` | Autenticación JWT y obtención de `requester_id` y `assigned_ti_user_id` |
| `notifications` | Envío de alertas al solicitante ante cambios de estado y asignación |
| `notificationManager` | Gestión interna de eventos de notificación del módulo |
| Base de datos PostgreSQL | Persistencia de `support_tickets`, `support_ticket_events`, `support_ticket_comments` |

## 10. Conclusión

Los requerimientos del módulo TI, Soporte y Tickets se justifican por la necesidad institucional de formalizar la atención de incidentes y solicitudes tecnológicas con control de tiempos (SLA), trazabilidad de ciclo, comunicación diferenciada entre público e interno, retroalimentación de calidad (CSAT) y visibilidad operativa del equipo TI. La implementación observada en el código cubre estas necesidades mediante un conjunto de endpoints diferenciados por rol, una máquina de estados con transiciones validadas en el servicio y un esquema de persistencia con timestamps de ciclo completo.
