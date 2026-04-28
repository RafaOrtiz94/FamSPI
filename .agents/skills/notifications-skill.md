# skill: notifications

## Propósito
Gestionar notificaciones, destinatarios, plantillas, colas y despacho de mensajes en FamSPI sin alterar indebidamente la lógica del módulo origen.

Este skill debe asegurar que las notificaciones sean:
- correctas
- trazables
- no duplicadas
- dirigidas a los destinatarios correctos
- basadas en eventos reales
- compatibles con la cola de despacho existente
- seguras frente a spam interno

---

## Principio central

La notificación NO decide la lógica de negocio.

El módulo origen decide:
- cuándo ocurre el evento
- qué estado cambió
- qué datos son válidos
- qué acción generó la notificación

El módulo de notificaciones decide:
- a quién notificar
- qué plantilla usar
- cómo construir el mensaje
- cómo encolar o enviar
- cómo registrar errores
- cómo evitar duplicados si el sistema lo permite

---

## Activar cuando

Usar este skill si el requerimiento involucra:

- No se envía una notificación.
- Se envía una notificación incorrecta.
- Se envía a destinatarios incorrectos.
- Se requiere ajustar destinatarios por tipo de evento.
- Se requiere ajustar plantilla.
- Se requiere mejorar asunto, cuerpo o variables de plantilla.
- Se requiere revisar cola de despacho.
- Se requiere evitar notificaciones duplicadas.
- Se requiere validar configuración de destinatarios.
- Se requiere revisar fallos de envío.
- Se requiere revisar notificaciones por aprobación, rechazo, solicitud, vencimiento, recordatorio o alerta.

---

## No usar cuando

No usar este skill si:

- El error real está en el cambio de estado del módulo origen.
- El módulo origen no genera el evento.
- El backend no llama al notification manager/service.
- El problema es de permisos/RBAC.
- El problema es de frontend.
- El problema es de datos faltantes antes de llegar a notificaciones.
- Se requiere modificar la regla de negocio que determina si debe notificarse.

Handoff:

- Módulo que genera el evento:
  agente del módulo correspondiente

- Flujo multi-módulo:
  `.agents/skills/orchestrator-skill.md`

- Auditoría:
  `.agents/skills/audit-security-skill.md`

- Frontend:
  `.agents/skills/frontend-skill.md`

---

## Alcance principal

Archivos principales:

- `backend/src/modules/notifications/notificationManager.js`
- `backend/src/modules/notifications/notifications.service.js`
- `backend/src/modules/notifications/notificationRecipientsConfig.service.js`
- `backend/src/jobs/processNotificationDispatchQueue.js`

Archivos relacionados solo si existe evidencia:

- services del módulo origen
- controllers del módulo origen
- jobs internos relacionados
- templates existentes
- helpers de email
- configuración de variables de entorno
- consultas DB relacionadas con cola, destinatarios o plantillas

Prohibido tocar el módulo origen salvo que el problema esté demostrado ahí.

---

## Fuentes obligatorias

Consultar en este orden:

1. `backend/src/modules/notifications/CONTEXT.md`
2. `backend/src/modules/<modulo_origen>/CONTEXT.md`
3. Código real de notifications
4. Código real del punto donde se dispara el evento
5. Neon PostgreSQL usando secrets desde GCP Secret Manager, si aplica
6. Job de cola de despacho
7. Logs o errores disponibles

Si falta contexto, escribir:

```txt
Falta evidencia para modificar notificaciones.