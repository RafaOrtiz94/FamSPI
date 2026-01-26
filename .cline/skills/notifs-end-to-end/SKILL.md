---
name: notifs-end-to-end
description: asegurar notificaciones correctas por eventos y roles, con contratos claros y logs de seguimiento
---

# SKILL: notifs-end-to-end

## Propósito
Asegurar que notificaciones se disparen correctamente según eventos y roles definidos.

## GATE: ¿Aplicar este skill?
**SI** → Al implementar/configurar notificaciones para nuevos flujos/eventos
**NO** → Para debugging de notificaciones existentes (usar db-check-when-needed)

## Flujo Corto (5 min)

### 1. Definir contrato de notificación
```javascript
const notificationSpec = {
  event: "{{EVENT_NAME}}",
  recipientRoles: ["{{ROLE_1}}", "{{ROLE_2}}"],
  channels: ["{{CHANNEL_1}}", "{{CHANNEL_2}}"],
  template: "{{TEMPLATE_TEXT}}",
  context: {
    entityId: "{{ID}}",
    entityType: "{{TYPE}}",
    link: "{{URL}}"
  }
}
```

### 2. Disparar notificación de test
```javascript
// En service/controller apropiado
await notificationManager.send(notificationSpec)
```

### 3. Verificar recepción
```sql
-- Verificar en BD
SELECT * FROM notifications
WHERE event = '{{EVENT_NAME}}'
AND created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
```

## Plantillas Parametrizables

### Evento de solicitud
```javascript
# Template: notificación de nueva solicitud
{
  event: "SOLICITUD_CREATED",
  recipientRoles: ["JEFE_INMEDIATO"],
  channels: ["DB", "UI"],
  template: "Nueva solicitud pendiente de {{applicantName}}",
  context: { requestId: {{id}}, link: "/solicitudes/{{id}}" }
}
```

### Evento de aprobación
```javascript
# Template: notificación de aprobación
{
  event: "SOLICITUD_APPROVED",
  recipientRoles: ["SOLICITANTE"],
  channels: ["DB", "UI", "EMAIL"],
  template: "Tu solicitud #{{id}} fue aprobada",
  context: { requestId: {{id}}, link: "/solicitudes/{{id}}" }
}
```

### Logs de seguimiento
```javascript
# Template: logs para debugging
console.log(`[NOTIFS] ${event} → ${recipientRoles.join(', ')} via ${channels.join(', ')}`)
```

## Evidencia Mínima Obligatoria
- ✅ Notificación creada en tabla `notifications`
- ✅ Receptores correctos según roles
- ✅ Canales especificados utilizados
- ✅ Contexto/entityId correcto

## Límites de Alcance
- NO configura infraestructura de envío (email, push)
- NO maneja templates complejos/HTML
- NO valida contenido de templates
- NO reemplaza configuración de roles existente
