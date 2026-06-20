# FRS — MÓDULO DE NOTIFICACIONES Y COMUNICACIONES

**Sistema:** FamSPI  
**Versión:** 2.0  
**Fecha:** 2026-06-18  
**Estado:** En revisión  
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5  
**Referencia URS:** URS_modulo_notificaciones_comunicaciones.md v2.0

---

## 1. Introducción

El presente documento describe cómo el sistema SPI implementa funcionalmente los requerimientos del módulo de Notificaciones y Comunicaciones. El módulo opera en dos capas: la capa in-app (bandeja del usuario) gestionada mediante endpoints REST, y la capa de despacho asíncrono multicanal (email, Google Chat) gestionada mediante una cola de base de datos procesada por un job interno.

---

## 2. Descripción funcional del módulo

El módulo de Notificaciones gestiona el ciclo completo de una notificación: creación, lectura, marcado y eliminación en la bandeja del usuario; y despacho externo mediante una cola asíncrona con reintentos. Los módulos de negocio del sistema (comercial, talento, servicio, TI) son productores de notificaciones mediante llamadas internas al servicio.

Las tablas del módulo son: `notifications`, `notification_recipients_config`, `notification_dispatch_queue`, `notification_process_email_threads`.

---

## 3. Especificaciones funcionales

### FRS-NTF-001 — Listado de notificaciones del usuario
**Requerimiento origen:** REQ-NOT-001  
**Endpoint:** `GET /api/v1/notifications`  
**Entradas:** Token JWT válido; parámetros opcionales `status` (ej. `unread`) y `limit` (máx. 50, default 50).  
**Proceso:** El servicio filtra `notifications` por `user_id = req.user.id`. Si `status` está presente, añade condición `AND status = $2`. Ordena por `priority DESC, created_at DESC`. Aplica el límite efectivo calculado como `Math.min(limit, 50)`. La ruta aplica rate limit de 20 peticiones por minuto por usuario para proteger el endpoint del polling del frontend.  
**Salida:** Array de objetos notificación con campos: `id`, `user_id`, `title`, `message`, `type`, `source`, `status`, `priority`, `meta`, `created_at`, `read_at`.

### FRS-NTF-002 — Creación de notificación
**Requerimiento origen:** REQ-NOT-003  
**Endpoint:** `POST /api/v1/notifications`  
**Entradas:** Token JWT válido; `user_id` (requerido), `title` (requerido), `message`, `type` (default `info`), `source`, `status` (default `unread`), `priority` (default 0), `meta` (object).  
**Proceso:** Valida que `user_id` y `title` estén presentes. Inserta el registro en `notifications` con todos los campos. Retorna el registro creado.  
**Salida:** Objeto notificación creada con su identificador y `created_at`.

### FRS-NTF-003 — Marcado de una notificación como leída
**Requerimiento origen:** REQ-NOT-002  
**Endpoint:** `PATCH /api/v1/notifications/:id/read`  
**Entradas:** Token JWT válido; `id` de la notificación.  
**Proceso:** Actualiza `status = 'read'` y `read_at = NOW()` en `notifications` para el registro `id` donde `user_id = req.user.id` (garantiza ownership). Si el registro no existe o no pertenece al usuario, devuelve HTTP 404.  
**Salida:** Objeto notificación actualizado.

### FRS-NTF-004 — Marcado masivo de notificaciones como leídas
**Requerimiento origen:** REQ-NOT-002  
**Endpoint:** `PATCH /api/v1/notifications/read-all`  
**Entradas:** Token JWT válido.  
**Proceso:** Actualiza `status = 'read'` y `read_at = NOW()` en todas las notificaciones con `user_id = req.user.id` que tengan `status = 'unread'`.  
**Salida:** Conteo de registros actualizados.

### FRS-NTF-005 — Eliminación de una notificación
**Requerimiento origen:** REQ-NOT-001  
**Endpoint:** `DELETE /api/v1/notifications/:id`  
**Entradas:** Token JWT válido; `id` de la notificación.  
**Proceso:** Elimina el registro `id` de `notifications` donde `user_id = req.user.id`. Garantiza que el usuario solo puede eliminar sus propias notificaciones.  
**Salida:** Confirmación de eliminación.

### FRS-NTF-006 — Eliminación de todas las notificaciones del usuario
**Requerimiento origen:** REQ-NOT-001  
**Endpoint:** `DELETE /api/v1/notifications/clear`  
**Entradas:** Token JWT válido.  
**Proceso:** Elimina todos los registros de `notifications` donde `user_id = req.user.id`.  
**Salida:** Confirmación de eliminación con conteo de registros eliminados.

### FRS-NTF-007 — Despacho asíncrono multicanal por cola
**Requerimiento origen:** REQ-NOT-004  
**Endpoint interno:** `POST /internal/jobs/notifications/dispatch`  
**Entradas:** Header `x-jobs-secret` con clave interna (`jobsAuth`); no requiere JWT de usuario.  
**Proceso:** El job `processNotificationDispatchQueue` selecciona registros de `notification_dispatch_queue` con `status = 'pending'` usando `FOR UPDATE SKIP LOCKED` para garantizar procesamiento exclusivo sin bloqueos entre instancias concurrentes. Por cada registro: cambia estado a `processing`, intenta despachar por el canal indicado (email, Google Chat o ambos), actualiza estado a `sent` o `failed` con log del error. Los reintentos se controlan por campo `attempts` y `max_attempts`. El proceso trabaja en lotes para controlar concurrencia.  
**Salida:** Resumen del lote procesado con conteo de enviados y fallidos.

### FRS-NTF-008 — Configuración de destinatarios por evento
**Requerimiento origen:** REQ-NOT-005  
**Acceso:** Servicio interno (`notificationRecipientsConfig.service.js`), no expuesto directamente como endpoint REST público.  
**Proceso:** La tabla `notification_recipients_config` almacena, por combinación de `source` (módulo) y `event_type`, qué `user_id` o `role` debe recibir la notificación. Los módulos productores de notificaciones consultan esta configuración para resolver a quién notificar. Las operaciones de lectura y escritura de configuración se realizan internamente; no existe endpoint REST de usuario para esta tabla en la versión actual.  
**Salida:** Lista de destinatarios (`user_id[]` o `role[]`) para una combinación source/event.

### FRS-NTF-009 — Notificaciones de seguridad fuera de horario
**Requerimiento origen:** REQ-NOT-003, REQ-NOT-005  
**Integración:** El módulo `security` produce notificaciones cuando detecta un login fuera del horario laboral establecido. Llama al servicio de notificaciones con `source = 'security'`, `type = 'warning'`, `priority` elevada, y los destinatarios resueltos como los usuarios con rol `jefe_ti` mediante `notificationRecipientsConfig`.  
**Salida:** Notificación in-app creada para cada usuario TI identificado como destinatario; opcionalmente también encolada en `notification_dispatch_queue` para despacho por email/chat.

---

## 4. Endpoints API del módulo

| Método | Ruta | Acceso | Función |
|---|---|---|---|
| GET | `/api/v1/notifications` | JWT usuario (rate limit 20/min) | Listar notificaciones propias |
| POST | `/api/v1/notifications` | JWT usuario | Crear notificación |
| PATCH | `/api/v1/notifications/read-all` | JWT usuario | Marcar todas como leídas |
| PATCH | `/api/v1/notifications/:id/read` | JWT usuario (ownership) | Marcar una como leída |
| DELETE | `/api/v1/notifications/clear` | JWT usuario | Eliminar todas las propias |
| DELETE | `/api/v1/notifications/:id` | JWT usuario (ownership) | Eliminar una propia |
| POST | `/internal/jobs/notifications/dispatch` | jobsAuth (clave interna) | Procesar cola de despacho |

---

## 5. Controles de acceso y seguridad funcional

**Autenticación:** `verifyToken` como middleware global en el router de notificaciones. Todas las operaciones de usuario usan `req.user.id` del JWT para garantizar ownership.

**Endpoint de jobs:** Protegido por `jobsAuth` con clave secreta interna (`x-jobs-secret`). No requiere JWT de usuario. Solo accesible desde el job scheduler interno o herramientas de administración.

**Rate limit:** El endpoint de listado aplica `express-rate-limit` con máximo de 20 peticiones por minuto por usuario (`keyGenerator: req.user.id`). Exceder el límite devuelve HTTP 429 con código `RATE_LIMIT_NOTIFICATIONS`.

**Ownership:** Todas las operaciones de lectura, marcado y eliminación filtran por `user_id = req.user.id`. No es posible acceder a notificaciones de otro usuario.

**Concurrencia de cola:** El job usa `FOR UPDATE SKIP LOCKED` para evitar que múltiples instancias procesen el mismo registro simultáneamente.

---

## 6. Dependencias funcionales

- **Autenticación y Sesiones:** JWT para identidad del usuario en toda operación.
- **Usuarios y Perfiles:** Resolución de destinatarios por rol en `notificationRecipientsConfig`.
- **Módulos productores de eventos:** Comercial, Talento Humano, Servicio Técnico, Seguridad/TI — todos crean notificaciones mediante `NotificationManager` o llamadas directas al servicio.
- **Integraciones Gmail/Chat:** Canales externos para el despacho multicanal en `notification_dispatch_queue`.

---

## 7. Observaciones técnicas y riesgos

- La acumulación de registros con `status = 'failed'` en `notification_dispatch_queue` puede indicar problemas con los canales externos (SMTP, Google Chat). Se recomienda monitorear el conteo de fallidos periódicamente.
- La tabla `notification_process_email_threads` requiere la migración 113 para existir. En entornos sin esa migración, el job puede fallar al intentar consultar esa tabla; el error debe estar manejado con `try/catch` en el job.
- La configuración de destinatarios en `notification_recipients_config` no tiene interfaz de administración REST en la versión actual; los cambios requieren operaciones directas en base de datos o scripts de configuración.
- El límite de 50 notificaciones por consulta es un tope operativo intencional; el frontend muestra solo las 6 más recientes. El tope evita respuestas masivas hacia la base de datos Neon.
