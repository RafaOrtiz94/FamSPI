# CHECKLIST FASE 2 - IMPLEMENTACIÓN DE NOTIFICACIONES

**Proyecto:** FamSPI - Sistema de Notificaciones  
**Fase:** 2 (Implementación)  
**Estado:** ⏸️ PENDIENTE DE APROBACIÓN

---

## 📋 SPRINT 1: SOLICITUDES COMPLETAS (3-5 días)

### Día 1-2: Aprobación + Rechazo

- [ ] **Archivo:** `backend/src/modules/requests/requests.service.js`
  - [ ] Localizar función `approveRequest()` (o crear si no existe)
  - [ ] Agregar llamada a `notificationManager.sendNotification()`
  - [ ] Template: `request_approved`
  - [ ] Destinatarios: Solicitante (requester_id)
  - [ ] Canales: Email + BD
  - [ ] Prioridad: 2
  - [ ] Source: `requests.approval`
  - [ ] Metadata: `{ requestId, action: 'approved' }`

- [ ] **Archivo:** `backend/src/modules/requests/requests.service.js`
  - [ ] Localizar función `rejectRequest()` (o crear si no existe)
  - [ ] Agregar llamada a `notificationManager.sendNotification()`
  - [ ] Template: `request_rejected`
  - [ ] Destinatarios: Solicitante (requester_id)
  - [ ] Canales: Email + BD
  - [ ] Prioridad: 3 (alta)
  - [ ] Source: `requests.rejection`
  - [ ] Metadata: `{ requestId, action: 'rejected', reason }`

- [ ] **Testing:**
  - [ ] Crear solicitud de prueba
  - [ ] Aprobar solicitud → verificar email + BD
  - [ ] Rechazar solicitud → verificar email + BD
  - [ ] Verificar templates HTML

### Día 3: Asignación + Cambio de Estado

- [ ] **Archivo:** `backend/src/modules/requests/requests.service.js`
  - [ ] Localizar función `assignRequest()` (o crear si no existe)
  - [ ] Agregar notificación al usuario asignado
  - [ ] Template: `request_assigned`
  - [ ] Canales: Email + BD
  - [ ] Prioridad: 2

- [ ] **Archivo:** `backend/src/modules/requests/requests.service.js`
  - [ ] Localizar función `updateRequestStatus()` (o crear si no existe)
  - [ ] Agregar notificación en cambio de estado
  - [ ] Template: `request_status_changed`
  - [ ] Canales: BD only
  - [ ] Prioridad: 1

- [ ] **Testing:**
  - [ ] Asignar solicitud → verificar notificación
  - [ ] Cambiar estado → verificar notificación

### Día 4: Completado + Templates

- [ ] **Archivo:** `backend/src/modules/requests/requests.service.js`
  - [ ] Localizar función `completeRequest()` (o crear si no existe)
  - [ ] Agregar notificación de completado
  - [ ] Template: `request_completed`
  - [ ] Canales: Email + BD
  - [ ] Prioridad: 2

- [ ] **Archivo:** `backend/src/modules/notifications/notificationManager.js`
  - [ ] Agregar template `request_assigned`
  - [ ] Agregar template `request_status_changed`
  - [ ] Agregar template `request_completed`
  - [ ] Verificar interpolación de variables

- [ ] **Testing:**
  - [ ] Completar solicitud → verificar notificación
  - [ ] Verificar todos los templates nuevos

### Día 5: Testing + Documentación

- [ ] **Testing completo:**
  - [ ] Flujo completo: Crear → Asignar → Aprobar → Completar
  - [ ] Flujo alternativo: Crear → Rechazar
  - [ ] Verificar emails recibidos
  - [ ] Verificar notificaciones en BD
  - [ ] Verificar contador de no leídas en UI

- [ ] **Documentación:**
  - [ ] Actualizar README con eventos implementados
  - [ ] Documentar templates nuevos
  - [ ] Crear guía de troubleshooting

---

## 📋 SPRINT 2: BUSINESS CASE COMPLETO (5-7 días)

### Día 1-2: Integración en State Machine

- [ ] **Archivo:** `backend/src/modules/business-case/businessCaseStateMachine.js`
  - [ ] Importar `notificationManager`
  - [ ] Localizar función `transition()` (línea 74)
  - [ ] Después de commit (línea 157), agregar:
    - [ ] Llamada a `_getTransitionRecipients()`
    - [ ] Loop para enviar notificaciones a cada destinatario
    - [ ] Template: `bc_state_transition`
    - [ ] Canales: Email + Chat (según destinatario)
    - [ ] Prioridad: Según estado destino

- [ ] **Testing:**
  - [ ] Crear BC de prueba
  - [ ] Transicionar DRAFT → DATOS_BASE → verificar notificación
  - [ ] Verificar logs de auditoría

### Día 3: Helpers de Destinatarios

- [ ] **Archivo:** `backend/src/modules/business-case/businessCaseStateMachine.js`
  - [ ] Crear función `_getTransitionRecipients(businessCaseId, fromState, toState, businessCase)`
  - [ ] Implementar lógica por estado:
    - [ ] `EN_EVALUACION_VIABILIDAD` → Equipo Viabilidad
    - [ ] `OBSERVADO_POR_VIABILIDAD` → Comercial (creador)
    - [ ] `VIABLE` → Jefe Comercial
    - [ ] `AJUSTES_OPERATIVOS` → Operaciones
    - [ ] `CERRADO_PARA_APROBACION` → Gerencia
  - [ ] Crear función `_getUsersByRole(role)`
  - [ ] Crear función `_getStateFriendlyName(state)`
  - [ ] Crear función `_getTransitionPriority(toState)`

- [ ] **Testing:**
  - [ ] Verificar que cada transición notifica a roles correctos
  - [ ] Verificar prioridades asignadas

### Día 4: Notificación en Creación

- [ ] **Archivo:** `backend/src/modules/business-case/businessCase.service.js`
  - [ ] Localizar función `createBusinessCase()`
  - [ ] Al final, agregar notificación
  - [ ] Template: `bc_created`
  - [ ] Destinatario: Creador (userId)
  - [ ] Canales: BD only
  - [ ] Prioridad: 1

- [ ] **Testing:**
  - [ ] Crear BC → verificar notificación en BD
  - [ ] Verificar metadata

### Día 5: Testing de Transiciones

- [ ] **Testing completo de State Machine:**
  - [ ] DRAFT → DATOS_BASE → verificar notificación a Jefe Comercial
  - [ ] DATOS_BASE → VIABILIDAD → verificar notificación a Viabilidad + Chat
  - [ ] VIABILIDAD → OBSERVADO → verificar notificación a Comercial
  - [ ] VIABILIDAD → VIABLE → verificar notificación a Jefe Comercial
  - [ ] VIABLE → AJUSTES_OP → verificar notificación a Operaciones + Chat
  - [ ] AJUSTES_OP → APROBACION → verificar notificación a Gerencia + Chat
  - [ ] Verificar todas las prioridades

---

### Día 6-7: Equipos/Determinaciones + Templates

- [ ] **Archivo:** `backend/src/modules/business-case/BusinessCaseOrchestrator.service.js`
  - [ ] Localizar función `addEquipment()`
  - [ ] Agregar notificación
  - [ ] Template: `bc_equipment_added`
  - [ ] Canales: BD only
  - [ ] Prioridad: 1

- [ ] **Archivo:** `backend/src/modules/business-case/BusinessCaseOrchestrator.service.js`
  - [ ] Localizar función `addDetermination()`
  - [ ] Agregar notificación
  - [ ] Template: `bc_determination_added`
  - [ ] Canales: BD only
  - [ ] Prioridad: 1

- [ ] **Archivo:** `backend/src/modules/notifications/notificationManager.js`
  - [ ] Agregar template `bc_created`
  - [ ] Agregar template `bc_state_transition`
  - [ ] Agregar template `bc_equipment_added`
  - [ ] Agregar template `bc_determination_added`
  - [ ] Agregar template `bc_calculation_updated`
  - [ ] Agregar template `bc_validation_failed`

- [ ] **Testing:**
  - [ ] Agregar equipo → verificar notificación
  - [ ] Agregar determinación → verificar notificación
  - [ ] Verificar todos los templates

---

## 📋 SPRINT 3: CONFIGURACIÓN DE DESTINATARIOS (3-4 días)

### Día 1-2: Tabla de Configuración

- [ ] **Crear migración:** `backend/migrations/054_notification_recipients_config.sql`
  - [ ] Crear tabla `notification_recipients_config`
  - [ ] Columnas:
    - [ ] `id` (SERIAL PRIMARY KEY)
    - [ ] `event_type` (VARCHAR 100)
    - [ ] `event_source` (VARCHAR 100)
    - [ ] `role` (VARCHAR 50)
    - [ ] `user_id` (FK → users.id)
    - [ ] `send_email` (BOOLEAN)
    - [ ] `send_chat` (BOOLEAN)
    - [ ] `send_in_app` (BOOLEAN)
    - [ ] `priority` (INTEGER)
    - [ ] `created_at`, `updated_at` (TIMESTAMPTZ)
  - [ ] Crear índices
  - [ ] Insertar datos iniciales

- [ ] **Ejecutar migración:**
  - [ ] Validar con `Test-Path`
  - [ ] Ejecutar en PostgreSQL
  - [ ] Verificar tabla creada
  - [ ] Verificar datos iniciales

### Día 3: Servicio de Configuración

- [ ] **Crear archivo:** `backend/src/modules/notifications/notificationRecipientsConfig.service.js`
  - [ ] Función `getRecipients(eventType, eventSource)`
  - [ ] Query con JOIN a `users`
  - [ ] Retornar array de destinatarios con configuración

- [ ] **Archivo:** `backend/src/modules/notifications/notificationManager.js`
  - [ ] Importar `notificationRecipientsConfig.service`
  - [ ] Modificar `sendNotification()` para usar configuración
  - [ ] Mantener compatibilidad con llamadas existentes

- [ ] **Testing:**
  - [ ] Verificar que configuración se aplica
  - [ ] Verificar fallback si no hay configuración

### Día 4: Testing + Documentación

- [ ] **Testing completo:**
  - [ ] Configurar destinatarios por rol
  - [ ] Verificar que notificaciones llegan a roles correctos
  - [ ] Modificar configuración → verificar cambios
  - [ ] Verificar prioridades desde configuración

- [ ] **Documentación:**
  - [ ] Guía de configuración de destinatarios
  - [ ] Ejemplos de queries SQL
  - [ ] Troubleshooting

---

## 📋 SPRINT 4: TESTING Y DOCUMENTACIÓN (2-3 días)

### Día 1: Testing End-to-End

- [ ] **Solicitudes:**
  - [ ] Flujo completo: Crear → Asignar → Aprobar → Completar
  - [ ] Flujo alternativo: Crear → Rechazar
  - [ ] Verificar emails, BD, UI

- [ ] **Business Case:**
  - [ ] Flujo completo: Crear → DRAFT → DATOS_BASE → VIABILIDAD → VIABLE → AJUSTES_OP → APROBACION
  - [ ] Flujo con observaciones: VIABILIDAD → OBSERVADO → VIABILIDAD → VIABLE
  - [ ] Agregar equipos/determinaciones
  - [ ] Verificar emails, chat, BD, UI

### Día 2: Testing de Canales

- [ ] **Email:**
  - [ ] Verificar envío por SMTP
  - [ ] Verificar fallback a Gmail API
  - [ ] Verificar templates HTML
  - [ ] Verificar reply-to

- [ ] **Google Chat:**
  - [ ] Verificar envío a webhook
  - [ ] Verificar formato de mensajes
  - [ ] Verificar prioridades

- [ ] **BD:**
  - [ ] Verificar persistencia
  - [ ] Verificar metadata
  - [ ] Verificar contador de no leídas

### Día 3: Documentación Final

- [ ] **Actualizar documentación:**
  - [ ] README con eventos implementados
  - [ ] Matriz de eventos actualizada
  - [ ] Templates disponibles
  - [ ] Configuración de destinatarios
  - [ ] Guía de troubleshooting

- [ ] **Crear guías:**
  - [ ] Guía de usuario (cómo ver notificaciones)
  - [ ] Guía de administrador (cómo configurar destinatarios)
  - [ ] Guía de desarrollador (cómo agregar nuevas notificaciones)

---

## ✅ CRITERIOS DE ACEPTACIÓN

### Solicitudes
- [ ] 9/9 eventos notifican correctamente
- [ ] Emails se envían y reciben
- [ ] Notificaciones aparecen en BD
- [ ] UI muestra notificaciones
- [ ] Contador de no leídas funciona

### Business Case
- [ ] 13/13 eventos notifican correctamente
- [ ] 7 transiciones de estado notifican
- [ ] Emails + Chat se envían según configuración
- [ ] Roles correctos reciben notificaciones
- [ ] Prioridades asignadas correctamente

### Configuración
- [ ] Tabla de configuración creada
- [ ] Servicio de configuración funciona
- [ ] Destinatarios se pueden modificar sin código
- [ ] Cambios en configuración se aplican inmediatamente

### Testing
- [ ] Todos los flujos probados
- [ ] Todos los canales probados
- [ ] Documentación completa
- [ ] Guías de usuario/admin/dev creadas

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica | Objetivo | Actual |
|---------|----------|--------|
| **Cobertura Solicitudes** | 100% (9/9) | 22% (2/9) |
| **Cobertura Business Case** | 100% (13/13) | 0% (0/13) |
| **Tasa de entrega Email** | > 95% | - |
| **Tasa de entrega Chat** | > 90% | - |
| **Tasa de entrega BD** | 100% | - |
| **Tiempo de envío** | < 2s | - |
| **Impacto en transiciones** | < 500ms | - |
| **Tasa de error** | < 1% | - |

---

## 🚨 RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Spam de notificaciones | Media | Alto | Prioridades + Configuración de usuario |
| Fallos en envío de email | Baja | Medio | Fallback + Retry logic |
| Performance en transiciones | Baja | Medio | Envío asíncrono |
| Configuración incorrecta | Media | Alto | UI de admin + Logs |

---

## 📅 TIMELINE

| Sprint | Inicio | Fin | Días | Estado |
|--------|--------|-----|------|--------|
| Sprint 1 | TBD | TBD | 3-5 | ⏸️ Pendiente |
| Sprint 2 | TBD | TBD | 5-7 | ⏸️ Pendiente |
| Sprint 3 | TBD | TBD | 3-4 | ⏸️ Pendiente |
| Sprint 4 | TBD | TBD | 2-3 | ⏸️ Pendiente |
| **TOTAL** | **TBD** | **TBD** | **13-19** | **⏸️ Pendiente** |

---

## 🚀 PRÓXIMO PASO

**ESPERAR CONFIRMACIÓN DEL USUARIO PARA INICIAR FASE 2**

Una vez aprobado:
1. Definir fechas de inicio/fin de cada sprint
2. Asignar recursos
3. Comenzar Sprint 1

---

**Preparado por:** Antigravity  
**Fecha:** 2026-01-13  
**Versión:** 1.0
