# FASE 1 - AUDITORÍA COMPLETA DEL SISTEMA DE NOTIFICACIONES

**Fecha:** 2026-01-13
**Objetivo:** Descubrir el sistema REAL actual de notificaciones y su integración con procesos (Solicitudes y Business Case)

---

## 📋 RESUMEN EJECUTIVO

### Estado Actual
- ✅ **Sistema de notificaciones EXISTE y está FUNCIONAL**
- ⚠️ **Integración PARCIAL**: Solo en algunos procesos
- ❌ **Business Case NO tiene notificaciones implementadas**
- ⚠️ **Solicitudes tiene notificaciones LIMITADAS** (solo en creación)
- 📊 **Base de datos**: 0 notificaciones registradas (sistema nuevo sin uso real)

### Hallazgos Clave
1. **Backend completo**: NotificationManager + Service + Controller + Routes
2. **Frontend completo**: NotificationContext + API + Componentes UI
3. **Infraestructura lista**: BD, email (SMTP + Gmail API), Google Chat
4. **GAP crítico**: Falta integración en TODOS los eventos de flujo de procesos

---

## 1️⃣ LISTA EXACTA DE ARCHIVOS RELEVANTES

### Backend - Módulo de Notificaciones

| Archivo | Ubicación | Propósito | Estado |
|---------|-----------|-----------|--------|
| `notificationManager.js` | `backend/src/modules/notifications/` | Gestor unificado (BD + Email + Chat) | ✅ Completo |
| `notifications.service.js` | `backend/src/modules/notifications/` | CRUD de notificaciones en BD | ✅ Completo |
| `notifications.controller.js` | `backend/src/modules/notifications/` | Endpoints REST | ✅ Completo |
| `notifications.routes.js` | `backend/src/modules/notifications/` | Rutas `/api/v1/notifications` | ✅ Completo |
| `017_notifications.sql` | `backend/migrations/` | Esquema de BD | ✅ Migrado |

**Funcionalidades del NotificationManager:**
- ✅ Envío a BD (persistencia)
- ✅ Envío por email (SMTP + Gmail API con fallback)
- ✅ Envío a Google Chat
- ✅ Templates reutilizables
- ✅ Interpolación de variables
- ✅ Generación de HTML para emails

### Backend - Módulo de Solicitudes (Requests)

| Archivo | Ubicación | Uso de Notificaciones | Estado |
|---------|-----------|----------------------|--------|
| `requests.service.js` | `backend/src/modules/requests/` | ⚠️ Solo en creación (líneas 446, 1595) | Parcial |
| `requests.controller.js` | `backend/src/modules/requests/` | No usa notificaciones directamente | - |
| `requests.routes.js` | `backend/src/modules/requests/` | No usa notificaciones directamente | - |

**Eventos detectados con notificaciones:**
- ✅ **Creación de solicitud** (línea 1595): Notifica a backoffice sobre nueva solicitud
- ✅ **Envío de código de consentimiento** (línea 446): Notifica al cliente con código OTP

**Eventos SIN notificaciones:**
- ❌ Aprobación de solicitud
- ❌ Rechazo de solicitud
- ❌ Cambio de estado
- ❌ Asignación a usuario
- ❌ Comentarios/observaciones

### Backend - Módulo de Business Case

| Archivo | Ubicación | Uso de Notificaciones | Estado |
|---------|-----------|----------------------|--------|
| `businessCase.service.js` | `backend/src/modules/business-case/` | ❌ NO usa notificaciones | Sin integrar |
| `businessCase.controller.js` | `backend/src/modules/business-case/` | ❌ NO usa notificaciones | Sin integrar |
| `BusinessCaseOrchestrator.service.js` | `backend/src/modules/business-case/` | ❌ NO usa notificaciones | Sin integrar |
| `businessCaseStateMachine.js` | `backend/src/modules/business-case/` | ❌ NO usa notificaciones | Sin integrar |

**Eventos SIN notificaciones (CRÍTICO):**
- ❌ Creación de Business Case
- ❌ Transiciones de estado (7 estados canónicos)
- ❌ Aprobaciones/rechazos
- ❌ Asignación a usuarios
- ❌ Completado de fases
- ❌ Validaciones fallidas
- ❌ Cambios en equipos/determinaciones

### Frontend - Módulo de Notificaciones

| Archivo | Ubicación | Propósito | Estado |
|---------|-----------|-----------|--------|
| `notificationsApi.js` | `spi_front/src/core/api/` | Cliente API REST | ✅ Completo |
| `NotificationContext.jsx` | `spi_front/src/core/ui/` | Context Provider React | ✅ Completo |
| `NotificationBell.jsx` | `spi_front/src/core/ui/components/` | Componente UI (campana) | ✅ Completo |
| `ClientRequestNotifications.jsx` | `spi_front/src/core/ui/widgets/` | Widget específico | ✅ Completo |

**Funcionalidades Frontend:**
- ✅ Listado de notificaciones
- ✅ Contador de no leídas
- ✅ Marcar como leída (individual/todas)
- ✅ Refresh automático
- ✅ Toast notifications
- ✅ Context API para acceso global

---

## 2️⃣ MAPA ACTUAL DEL SISTEMA DE NOTIFICACIONES

### Arquitectura Completa

```
┌─────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE NOTIFICACIONES                     │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│   EMISORES       │
│  (Backend)       │
└────────┬─────────┘
         │
         ├─► requests.service.js (líneas 446, 1595)
         │   └─► notificationManager.sendNotification()
         │
         ├─► private-purchases.service.js (11 llamadas)
         │   └─► NotificationManager.sendNotification()
         │
         ├─► personnel-requests.service.js (1 llamada)
         │   └─► notificationManager.sendNotification()
         │
         ├─► equipment-purchases.service.js (2 llamadas)
         │   └─► notificationManager.sendNotification()
         │
         └─► notifications.service.js (1 llamada)
             └─► notificationManager.sendNotification()
                 (para login fuera de horario)

         ▼
┌──────────────────────────────────────────────────────────────────┐
│              NOTIFICATION MANAGER (Orquestador)                   │
│  backend/src/modules/notifications/notificationManager.js         │
├──────────────────────────────────────────────────────────────────┤
│  • sendNotification({ userId, template, data, email, chat })     │
│  • Templates predefinidos: request_approved, request_rejected,   │
│    maintenance_due, equipment_available, custom_html             │
│  • Interpolación de variables: {{variable}}                      │
│  • Generación de HTML para emails                                │
└────┬─────────────────┬─────────────────┬────────────────────────┘
     │                 │                 │
     ▼                 ▼                 ▼
┌─────────┐    ┌──────────────┐   ┌─────────────┐
│   BD    │    │    EMAIL     │   │ GOOGLE CHAT │
│ (persist)│    │ (SMTP/Gmail) │   │  (webhook)  │
└─────────┘    └──────────────┘   └─────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────────┐
│                    BASE DE DATOS                                  │
│  Tabla: notifications                                             │
├──────────────────────────────────────────────────────────────────┤
│  • id (SERIAL)                                                    │
│  • user_id (FK → users.id)                                       │
│  • title (VARCHAR 255)                                            │
│  • message (TEXT)                                                 │
│  • type (VARCHAR 50): info, success, warning, error              │
│  • source (VARCHAR 100): módulo origen                           │
│  • status (VARCHAR 20): unread, read                             │
│  • priority (INTEGER): 0-3                                        │
│  • meta (JSONB): metadata adicional                              │
│  • created_at, read_at (TIMESTAMPTZ)                             │
├──────────────────────────────────────────────────────────────────┤
│  Índices:                                                         │
│  • idx_notifications_user (user_id)                              │
│  • idx_notifications_status (status)                             │
└──────────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────────┐
│                    API REST                                       │
│  Rutas: /api/v1/notifications                                    │
├──────────────────────────────────────────────────────────────────┤
│  GET    /                  → Listar notificaciones               │
│  POST   /                  → Crear notificación                  │
│  PATCH  /:id/read          → Marcar como leída                   │
│  PATCH  /read-all          → Marcar todas como leídas            │
└──────────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────────┐
│                    FRONTEND                                       │
│  NotificationContext + NotificationBell                           │
├──────────────────────────────────────────────────────────────────┤
│  • Polling automático (refresh)                                  │
│  • Contador de no leídas                                         │
│  • Toast notifications                                            │
│  • Acceso global via useNotifications()                          │
└──────────────────────────────────────────────────────────────────┘
```

### Flujo de una Notificación

```
1. EVENTO TRIGGER (ej: crear solicitud)
   ↓
2. Backend llama: notificationManager.sendNotification({
     userId: 123,
     template: 'request_approved',
     data: { requestId: 456, clientName: 'ABC' },
     email: true,
     chat: false
   })
   ↓
3. NotificationManager:
   ├─► Interpola template con data
   ├─► Genera HTML para email
   ├─► Guarda en BD (notifications.service.createNotification)
   ├─► Envía email (mailer.sendMail con fallback Gmail API)
   └─► Envía a Google Chat (si chat: true)
   ↓
4. Frontend:
   ├─► NotificationContext hace polling
   ├─► Detecta nueva notificación
   ├─► Actualiza contador de no leídas
   ├─► Muestra toast
   └─► Usuario ve campana con badge
```

---

## 3️⃣ MATRIZ DE EVENTOS REQUERIDOS

### SOLICITUDES (Requests)

| Evento | Fase/Estado | Emisor Backend | Receptor (Rol/Usuario) | Canal | Persistencia BD | Estado Actual |
|--------|-------------|----------------|------------------------|-------|-----------------|---------------|
| **Creación de solicitud** | Inicial | `requests.service.js:1595` | Backoffice (emails config) | Email | ✅ Sí | ✅ IMPLEMENTADO |
| **Envío código consentimiento** | Registro cliente | `requests.service.js:446` | Cliente (email) | Email | ❌ No (skipSave) | ✅ IMPLEMENTADO |
| **Aprobación de solicitud** | Aprobación | ❌ NO EXISTE | Solicitante | Email + BD | ❌ No | ❌ FALTA |
| **Rechazo de solicitud** | Rechazo | ❌ NO EXISTE | Solicitante | Email + BD | ❌ No | ❌ FALTA |
| **Asignación a usuario** | Workflow | ❌ NO EXISTE | Usuario asignado | Email + BD | ❌ No | ❌ FALTA |
| **Cambio de estado** | Cualquier transición | ❌ NO EXISTE | Solicitante + Asignado | BD | ❌ No | ❌ FALTA |
| **Comentario agregado** | Cualquier fase | ❌ NO EXISTE | Solicitante + Involucrados | BD | ❌ No | ❌ FALTA |
| **Documento adjunto** | Cualquier fase | ❌ NO EXISTE | Involucrados | BD | ❌ No | ❌ FALTA |
| **Solicitud completada** | Final | ❌ NO EXISTE | Solicitante + Backoffice | Email + BD | ❌ No | ❌ FALTA |

**Estados de solicitudes detectados:**
- `pendiente` (36 registros)
- `aprobado` (20 registros)
- `rechazado` (3 registros)

**Tipos de solicitudes:**
- `F.ST-19`: Proceso de compra (4 registros)
- `F.ST-20`: Solicitud de inspección de ambiente (54 registros)
- `F.ST-21`: Solicitud de retiro de equipo (0 registros)
- `F.ST-22`: Registro de nuevo cliente (1 registro)

### BUSINESS CASE (Equipment Purchase Requests)

| Evento | Fase/Estado Canónico | Emisor Backend | Receptor (Rol/Usuario) | Canal | Persistencia BD | Estado Actual |
|--------|---------------------|----------------|------------------------|-------|-----------------|---------------|
| **Creación de BC** | DRAFT_INICIAL | ❌ NO EXISTE | Comercial (creador) | Email + BD | ❌ No | ❌ FALTA |
| **Asignación inicial** | DRAFT_INICIAL | ❌ NO EXISTE | Usuario asignado | Email + BD | ❌ No | ❌ FALTA |
| **Datos base completos** | DRAFT_INICIAL → DATOS_BASE_COMPLETOS | ❌ NO EXISTE | Jefe Comercial | Email + BD | ❌ No | ❌ FALTA |
| **Envío a viabilidad** | DATOS_BASE_COMPLETOS → EN_EVALUACION_VIABILIDAD | ❌ NO EXISTE | Equipo Viabilidad | Email + BD | ❌ No | ❌ FALTA |
| **Observaciones viabilidad** | EN_EVALUACION_VIABILIDAD → OBSERVADO_POR_VIABILIDAD | ❌ NO EXISTE | Comercial (creador) | Email + BD | ❌ No | ❌ FALTA |
| **BC viable** | EN_EVALUACION_VIABILIDAD → VIABLE | ❌ NO EXISTE | Comercial + Jefe | Email + BD | ❌ No | ❌ FALTA |
| **Ajustes operativos** | VIABLE → AJUSTES_OPERATIVOS | ❌ NO EXISTE | Operaciones | Email + BD | ❌ No | ❌ FALTA |
| **Listo para aprobación** | AJUSTES_OPERATIVOS → CERRADO_PARA_APROBACION | ❌ NO EXISTE | Gerencia | Email + BD | ❌ No | ❌ FALTA |
| **BC aprobado** | CERRADO_PARA_APROBACION → APROBADO | ❌ NO EXISTE | Todos involucrados | Email + BD | ❌ No | ❌ FALTA |
| **BC rechazado** | Cualquier estado → RECHAZADO | ❌ NO EXISTE | Comercial (creador) | Email + BD | ❌ No | ❌ FALTA |
| **Equipo agregado** | Cualquier fase | ❌ NO EXISTE | Involucrados | BD | ❌ No | ❌ FALTA |
| **Determinación agregada** | Cualquier fase | ❌ NO EXISTE | Involucrados | BD | ❌ No | ❌ FALTA |
| **Cálculo actualizado** | Cualquier fase | ❌ NO EXISTE | Comercial + Finanzas | BD | ❌ No | ❌ FALTA |
| **Comentario en BC** | Cualquier fase | ❌ NO EXISTE | Involucrados | BD | ❌ No | ❌ FALTA |
| **Validación fallida** | Transición bloqueada | ❌ NO EXISTE | Usuario que intenta transición | BD | ❌ No | ❌ FALTA |

**Estados canónicos de Business Case (State Machine):**
1. `DRAFT_INICIAL`: BC recién creado
2. `DATOS_BASE_COMPLETOS`: Datos básicos completados
3. `EN_EVALUACION_VIABILIDAD`: En evaluación de viabilidad
4. `OBSERVADO_POR_VIABILIDAD`: Viabilidad encontró problemas
5. `VIABLE`: Aprobado por viabilidad
6. `AJUSTES_OPERATIVOS`: Planificación operativa
7. `CERRADO_PARA_APROBACION`: Listo para aprobación final

**Estados legacy detectados en BD (campo `status`):**
- `pending_contract` (22 registros)
- `draft` (11 registros)
- `pending_provider_assignment` (9 registros)
- `waiting_proforma` (4 registros)
- `waiting_provider_response` (3 registros)
- `completed` (3 registros)
- `business_case` (3 registros)
- `no_stock` (2 registros)
- `pending_feasibility` (1 registro)
- `proforma_received` (1 registro)
- `waiting_signed_proforma` (1 registro)

**Nota:** El sistema moderno usa `canonical_state` (7 estados), mientras que el legacy usa `status` (múltiples valores). Ambos coexisten en `equipment_purchase_requests`.

---

## 4️⃣ GAPS IDENTIFICADOS

### GAP 1: Business Case SIN Notificaciones (CRÍTICO)
**Impacto:** Alto
**Descripción:** El módulo de Business Case NO tiene ninguna integración con el sistema de notificaciones.

**Archivos afectados:**
- `businessCase.service.js`
- `businessCase.controller.js`
- `BusinessCaseOrchestrator.service.js`
- `businessCaseStateMachine.js`

**Eventos sin notificar:**
- ❌ 7 transiciones de estado canónico
- ❌ Creación/edición/eliminación de equipos
- ❌ Creación/edición/eliminación de determinaciones
- ❌ Cálculos actualizados
- ❌ Validaciones fallidas
- ❌ Asignaciones de usuarios
- ❌ Comentarios/observaciones

**Receptores potenciales:**
- Comercial (creador del BC)
- Jefe Comercial
- Equipo de Viabilidad
- Equipo de Operaciones
- Finanzas
- Gerencia (aprobadores finales)

### GAP 2: Solicitudes con Notificaciones Incompletas
**Impacto:** Medio
**Descripción:** Solo 2 de 9 eventos críticos tienen notificaciones.

**Eventos implementados:**
- ✅ Creación de solicitud
- ✅ Envío de código de consentimiento

**Eventos faltantes:**
- ❌ Aprobación
- ❌ Rechazo
- ❌ Asignación
- ❌ Cambio de estado
- ❌ Comentarios
- ❌ Documentos adjuntos
- ❌ Completado

### GAP 3: Falta de Notificaciones In-App para Usuarios
**Impacto:** Medio
**Descripción:** Las notificaciones se envían por email, pero no siempre se persisten en BD para que el usuario las vea en la UI.

**Ejemplo:** 
- Código de consentimiento usa `skipSave: true` (no se guarda en BD)
- Usuario no puede ver historial de notificaciones en la app

### GAP 4: No hay Notificaciones de Sistema/Auditoría
**Impacto:** Bajo
**Descripción:** Eventos de sistema no notifican a roles específicos.

**Ejemplos:**
- Login fuera de horario (implementado, pero solo a TI)
- Errores críticos
- Cambios masivos
- Exportaciones/reportes generados

### GAP 5: Falta Configuración de Destinatarios por Rol
**Impacto:** Medio
**Descripción:** No hay un sistema centralizado para definir "quién recibe qué notificación".

**Problema actual:**
- Destinatarios hardcodeados en código
- No hay tabla de configuración de notificaciones por rol
- Difícil cambiar destinatarios sin modificar código

---

## 5️⃣ PLAN DE IMPLEMENTACIÓN FASE 2

### Objetivo FASE 2
Implementar notificaciones completas en TODOS los eventos de Solicitudes y Business Case, con persistencia en BD y envío por email/chat según configuración.

### Estrategia de Implementación

#### **Enfoque: Incremental por Módulo**
1. Completar Solicitudes (más simple, menos estados)
2. Implementar Business Case (más complejo, state machine)
3. Agregar configuración de destinatarios por rol
4. Implementar notificaciones de sistema/auditoría

---

### SPRINT 1: Solicitudes - Notificaciones Completas (3-5 días)

#### Archivos a modificar:
1. `backend/src/modules/requests/requests.service.js`
2. `backend/src/modules/requests/requests.controller.js`
3. `backend/src/modules/approvals/approvals.service.js` (si existe)

#### Tareas:

**1.1. Agregar notificación en aprobación de solicitud**
- **Archivo:** `requests.service.js`
- **Función:** `approveRequest()` (buscar o crear)
- **Código a agregar:**
```javascript
await notificationManager.sendNotification({
  userId: request.requester_id,
  template: 'request_approved',
  data: {
    requestId: request.id,
    requestType: requestType.title,
    approvedBy: approver.fullname
  },
  email: true,
  chat: false,
  priority: 2,
  source: 'requests.approval',
  meta: { requestId: request.id, action: 'approved' }
});
```

**1.2. Agregar notificación en rechazo de solicitud**
- **Archivo:** `requests.service.js`
- **Función:** `rejectRequest()` (buscar o crear)
- **Código similar a aprobación, template: 'request_rejected'**

**1.3. Agregar notificación en asignación**
- **Archivo:** `requests.service.js`
- **Función:** `assignRequest()` (buscar o crear)
- **Template:** `request_assigned`

**1.4. Agregar notificación en cambio de estado**
- **Archivo:** `requests.service.js`
- **Función:** `updateRequestStatus()` (buscar o crear)
- **Template:** `request_status_changed`

**1.5. Agregar notificación en completado**
- **Archivo:** `requests.service.js`
- **Función:** `completeRequest()` (buscar o crear)
- **Template:** `request_completed`

**1.6. Crear templates faltantes en NotificationManager**
- **Archivo:** `notificationManager.js`
- **Templates a agregar:**
  - `request_assigned`
  - `request_status_changed`
  - `request_completed`

**Entregables Sprint 1:**
- ✅ Notificaciones en 5 eventos críticos de solicitudes
- ✅ Templates nuevos en NotificationManager
- ✅ Pruebas manuales de cada evento
- ✅ Documentación de eventos notificados

---

### SPRINT 2: Business Case - Notificaciones en State Machine (5-7 días)

#### Archivos a modificar:
1. `backend/src/modules/business-case/businessCaseStateMachine.js`
2. `backend/src/modules/business-case/BusinessCaseOrchestrator.service.js`
3. `backend/src/modules/business-case/businessCase.service.js`
4. `backend/src/modules/notifications/notificationManager.js`

#### Tareas:

**2.1. Integrar notificaciones en State Machine**
- **Archivo:** `businessCaseStateMachine.js`
- **Función:** `transition()` (línea 74)
- **Punto de inserción:** Después de commit exitoso (línea 157)
- **Código a agregar:**
```javascript
// Después de línea 157 (await client.query('COMMIT'))

// Determinar destinatarios según transición
const recipients = await this._getTransitionRecipients(
  businessCaseId, 
  fromState, 
  toState, 
  businessCase
);

// Enviar notificaciones
for (const recipient of recipients) {
  await notificationManager.sendNotification({
    userId: recipient.userId,
    template: 'bc_state_transition',
    data: {
      businessCaseId,
      clientName: businessCase.client_name,
      fromState: this._getStateFriendlyName(fromState),
      toState: this._getStateFriendlyName(toState),
      transitionedBy: userId,
      reason: reason || 'Sin motivo especificado'
    },
    email: recipient.sendEmail,
    chat: recipient.sendChat,
    priority: this._getTransitionPriority(toState),
    source: 'business_case.state_transition',
    meta: {
      businessCaseId,
      fromState,
      toState,
      transitionedBy: userId
    }
  });
}
```

**2.2. Crear función helper para destinatarios**
- **Archivo:** `businessCaseStateMachine.js`
- **Nueva función:**
```javascript
static async _getTransitionRecipients(businessCaseId, fromState, toState, businessCase) {
  const recipients = [];
  
  // Siempre notificar al creador
  if (businessCase.created_by) {
    recipients.push({
      userId: businessCase.created_by,
      sendEmail: true,
      sendChat: false
    });
  }
  
  // Notificar según estado destino
  switch (toState) {
    case STATES.EN_EVALUACION_VIABILIDAD:
      // Notificar a equipo de viabilidad
      const viabilityTeam = await this._getUsersByRole('viabilidad');
      recipients.push(...viabilityTeam.map(u => ({
        userId: u.id,
        sendEmail: true,
        sendChat: true
      })));
      break;
      
    case STATES.OBSERVADO_POR_VIABILIDAD:
      // Notificar al comercial (creador)
      // Ya incluido arriba
      break;
      
    case STATES.VIABLE:
      // Notificar a jefe comercial
      const jefeComercial = await this._getUsersByRole('jefe_comercial');
      recipients.push(...jefeComercial.map(u => ({
        userId: u.id,
        sendEmail: true,
        sendChat: false
      })));
      break;
      
    case STATES.AJUSTES_OPERATIVOS:
      // Notificar a operaciones
      const operations = await this._getUsersByRole('operaciones');
      recipients.push(...operations.map(u => ({
        userId: u.id,
        sendEmail: true,
        sendChat: true
      })));
      break;
      
    case STATES.CERRADO_PARA_APROBACION:
      // Notificar a gerencia
      const management = await this._getUsersByRole('gerencia');
      recipients.push(...management.map(u => ({
        userId: u.id,
        sendEmail: true,
        sendChat: true
      })));
      break;
  }
  
  return recipients;
}

static async _getUsersByRole(role) {
  const { rows } = await db.query(
    'SELECT id, email, fullname FROM users WHERE role = $1',
    [role]
  );
  return rows;
}

static _getStateFriendlyName(state) {
  const names = {
    [STATES.DRAFT_INICIAL]: 'Borrador Inicial',
    [STATES.DATOS_BASE_COMPLETOS]: 'Datos Base Completos',
    [STATES.EN_EVALUACION_VIABILIDAD]: 'En Evaluación de Viabilidad',
    [STATES.OBSERVADO_POR_VIABILIDAD]: 'Observado por Viabilidad',
    [STATES.VIABLE]: 'Viable',
    [STATES.AJUSTES_OPERATIVOS]: 'Ajustes Operativos',
    [STATES.CERRADO_PARA_APROBACION]: 'Cerrado para Aprobación'
  };
  return names[state] || state;
}

static _getTransitionPriority(toState) {
  // Prioridad alta para estados críticos
  if ([STATES.OBSERVADO_POR_VIABILIDAD, STATES.CERRADO_PARA_APROBACION].includes(toState)) {
    return 3;
  }
  return 2;
}
```

**2.3. Notificaciones en creación de BC**
- **Archivo:** `businessCase.service.js`
- **Función:** `createBusinessCase()` (buscar)
- **Agregar notificación al final:**
```javascript
await notificationManager.sendNotification({
  userId: createdBy,
  template: 'bc_created',
  data: {
    businessCaseId: bc.id,
    clientName: bc.client_name
  },
  email: false,
  chat: false,
  priority: 1,
  source: 'business_case.created',
  meta: { businessCaseId: bc.id }
});
```

**2.4. Notificaciones en equipos/determinaciones**
- **Archivo:** `BusinessCaseOrchestrator.service.js`
- **Funciones:** `addEquipment()`, `addDetermination()`
- **Agregar notificación a involucrados**

**2.5. Crear templates de BC en NotificationManager**
- **Archivo:** `notificationManager.js`
- **Templates a agregar:**
  - `bc_created`
  - `bc_state_transition`
  - `bc_equipment_added`
  - `bc_determination_added`
  - `bc_calculation_updated`
  - `bc_validation_failed`

**Entregables Sprint 2:**
- ✅ Notificaciones en 7 transiciones de estado
- ✅ Notificaciones en creación de BC
- ✅ Notificaciones en equipos/determinaciones
- ✅ Templates de BC en NotificationManager
- ✅ Pruebas de cada transición
- ✅ Documentación completa

---

### SPRINT 3: Configuración de Destinatarios (3-4 días)

#### Objetivo:
Crear sistema de configuración para definir quién recibe qué notificación sin modificar código.

#### Tareas:

**3.1. Crear migración de tabla de configuración**
- **Archivo nuevo:** `backend/migrations/054_notification_recipients_config.sql`
```sql
CREATE TABLE notification_recipients_config (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  event_source VARCHAR(100) NOT NULL,
  role VARCHAR(50),
  user_id INTEGER REFERENCES users(id),
  send_email BOOLEAN DEFAULT true,
  send_chat BOOLEAN DEFAULT false,
  send_in_app BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_type, event_source, role, user_id)
);

CREATE INDEX idx_notification_recipients_event ON notification_recipients_config(event_type, event_source);
CREATE INDEX idx_notification_recipients_role ON notification_recipients_config(role);

-- Datos iniciales
INSERT INTO notification_recipients_config (event_type, event_source, role, send_email, send_chat, priority) VALUES
  ('state_transition', 'business_case', 'viabilidad', true, true, 3),
  ('state_transition', 'business_case', 'jefe_comercial', true, false, 2),
  ('state_transition', 'business_case', 'operaciones', true, true, 2),
  ('state_transition', 'business_case', 'gerencia', true, true, 3),
  ('approval', 'requests', 'comercial', true, false, 2),
  ('rejection', 'requests', 'comercial', true, false, 2);
```

**3.2. Crear servicio de configuración**
- **Archivo nuevo:** `backend/src/modules/notifications/notificationRecipientsConfig.service.js`
```javascript
const db = require('../../config/db');

async function getRecipients(eventType, eventSource) {
  const { rows } = await db.query(`
    SELECT 
      nrc.role,
      nrc.user_id,
      nrc.send_email,
      nrc.send_chat,
      nrc.send_in_app,
      nrc.priority,
      u.id as user_id,
      u.email,
      u.fullname
    FROM notification_recipients_config nrc
    LEFT JOIN users u ON (nrc.role = u.role OR nrc.user_id = u.id)
    WHERE nrc.event_type = $1 AND nrc.event_source = $2
      AND u.id IS NOT NULL
  `, [eventType, eventSource]);
  
  return rows;
}

module.exports = { getRecipients };
```

**3.3. Integrar en NotificationManager**
- **Archivo:** `notificationManager.js`
- **Modificar `sendNotification()` para usar configuración**

**Entregables Sprint 3:**
- ✅ Tabla de configuración de destinatarios
- ✅ Servicio de configuración
- ✅ Integración en NotificationManager
- ✅ UI de administración (opcional)

---

### SPRINT 4: Testing y Documentación (2-3 días)

#### Tareas:

**4.1. Pruebas manuales**
- Crear solicitud → verificar notificación
- Aprobar solicitud → verificar notificación
- Rechazar solicitud → verificar notificación
- Crear BC → verificar notificación
- Transicionar BC por todos los estados → verificar notificaciones
- Agregar equipo/determinación → verificar notificación

**4.2. Pruebas de email**
- Verificar envío por SMTP
- Verificar fallback a Gmail API
- Verificar templates HTML

**4.3. Pruebas de Google Chat**
- Verificar envío a webhook
- Verificar formato de mensajes

**4.4. Documentación**
- Actualizar README con eventos notificados
- Documentar templates disponibles
- Documentar configuración de destinatarios
- Crear guía de troubleshooting

**Entregables Sprint 4:**
- ✅ Matriz de pruebas completada
- ✅ Documentación actualizada
- ✅ Guía de configuración
- ✅ Troubleshooting guide

---

## 6️⃣ ESTIMACIÓN DE ESFUERZO

| Sprint | Descripción | Días | Complejidad |
|--------|-------------|------|-------------|
| Sprint 1 | Solicitudes completas | 3-5 | Media |
| Sprint 2 | Business Case completo | 5-7 | Alta |
| Sprint 3 | Configuración destinatarios | 3-4 | Media |
| Sprint 4 | Testing y documentación | 2-3 | Baja |
| **TOTAL** | **FASE 2 completa** | **13-19 días** | **Media-Alta** |

---

## 7️⃣ MIGRACIONES NECESARIAS

### Migración 1: Tabla de configuración de destinatarios
- **Archivo:** `054_notification_recipients_config.sql`
- **Descripción:** Tabla para configurar quién recibe qué notificación
- **Dependencias:** Ninguna
- **Validaciones:** FK a `users(id)` debe existir

### Migración 2: Tabla de historial de notificaciones enviadas (opcional)
- **Archivo:** `055_notification_delivery_log.sql`
- **Descripción:** Log de notificaciones enviadas (email/chat) para auditoría
- **Dependencias:** `notifications` table
- **Validaciones:** FK a `notifications(id)`

---

## 8️⃣ RIESGOS Y CONSIDERACIONES

### Riesgo 1: Spam de Notificaciones
**Descripción:** Demasiadas notificaciones pueden molestar a usuarios.
**Mitigación:**
- Configurar prioridades correctamente
- Permitir que usuarios configuren preferencias
- Agrupar notificaciones similares

### Riesgo 2: Fallos en Envío de Email
**Descripción:** SMTP puede fallar, Gmail API puede tener límites.
**Mitigación:**
- Ya implementado: fallback de Gmail API a SMTP
- Agregar retry logic
- Log de errores de envío

### Riesgo 3: Performance en Transiciones de Estado
**Descripción:** Enviar notificaciones puede ralentizar transiciones.
**Mitigación:**
- Enviar notificaciones de forma asíncrona (después de commit)
- Usar queue (opcional, para FASE 3)

### Riesgo 4: Configuración Incorrecta de Destinatarios
**Descripción:** Notificaciones pueden llegar a personas incorrectas.
**Mitigación:**
- Validar configuración en UI de administración
- Logs de auditoría de quién recibe qué
- Permitir que usuarios reporten notificaciones incorrectas

---

## 9️⃣ DATOS DE BASELINE

### Base de Datos
- **Total de notificaciones:** 0 (sistema nuevo sin uso)
- **Total de solicitudes:** 59
  - Pendientes: 36
  - Aprobadas: 20
  - Rechazadas: 3
- **Total de Business Cases:** 60
  - Modernos (uses_modern_system=true): 0
  - Legacy: 60
- **Tabla de aprobaciones:** `request_approvals` existe
- **Tabla de workflow BC:** `bc_workflow_history` existe

### Frontend Build
- **Estado:** ✅ Exitoso
- **Advertencias:** 1 (BusinessCaseWizard no usado, menor)
- **Errores:** 0
- **Build time:** ~60 segundos

---

## 🔟 CONCLUSIONES FASE 1

### ✅ Hallazgos Positivos
1. **Infraestructura completa**: NotificationManager es robusto y reutilizable
2. **Frontend listo**: NotificationContext y componentes UI funcionan
3. **BD preparada**: Tabla `notifications` con índices correctos
4. **Canales múltiples**: Email (SMTP + Gmail API) + Google Chat
5. **Templates flexibles**: Sistema de interpolación de variables

### ⚠️ Hallazgos Críticos
1. **Business Case 100% sin notificaciones**: Ningún evento notifica
2. **Solicitudes parcialmente implementadas**: Solo 2 de 9 eventos
3. **Falta configuración de destinatarios**: Todo hardcodeado
4. **No hay notificaciones in-app persistentes**: Muchas usan `skipSave: true`

### 🎯 Recomendaciones
1. **Priorizar Business Case**: Es el proceso más crítico y complejo
2. **Implementar por sprints**: Incremental, probando cada evento
3. **Crear configuración de destinatarios**: Evitar hardcodear roles
4. **Documentar eventos**: Matriz completa de qué notifica a quién
5. **Testing exhaustivo**: Cada transición de estado debe probarse

---

## 📚 ANEXOS

### Anexo A: Endpoints de Notificaciones

```
GET    /api/v1/notifications              → Listar notificaciones del usuario
GET    /api/v1/notifications?status=unread → Listar solo no leídas
POST   /api/v1/notifications              → Crear notificación manual
PATCH  /api/v1/notifications/:id/read     → Marcar como leída
PATCH  /api/v1/notifications/read-all     → Marcar todas como leídas
```

### Anexo B: Templates Actuales en NotificationManager

```javascript
{
  request_approved: {
    title: 'Solicitud Aprobada',
    message: 'Tu solicitud #{{requestId}} ha sido aprobada.',
    type: 'success'
  },
  request_rejected: {
    title: 'Solicitud Rechazada',
    message: 'Tu solicitud #{{requestId}} ha sido rechazada. Motivo: {{reason}}',
    type: 'error'
  },
  maintenance_due: {
    title: 'Mantenimiento Pendiente',
    message: 'El equipo {{equipmentName}} requiere mantenimiento.',
    type: 'warning'
  },
  equipment_available: {
    title: 'Equipo Disponible',
    message: 'El equipo {{equipmentName}} está disponible.',
    type: 'info'
  },
  custom_html: {
    // Template flexible para HTML personalizado
  }
}
```

### Anexo C: Estructura de Notificación

```javascript
{
  userId: 123,                    // ID del usuario receptor
  template: 'request_approved',   // Template a usar
  data: {                         // Variables para interpolar
    requestId: 456,
    clientName: 'ABC Corp'
  },
  email: true,                    // Enviar por email
  chat: false,                    // Enviar por Google Chat
  customTitle: 'Título custom',   // Opcional, sobrescribe template
  customMessage: 'Mensaje custom',// Opcional, sobrescribe template
  priority: 2,                    // 0-3 (0=baja, 3=alta)
  source: 'requests.approval',    // Origen del evento
  meta: {                         // Metadata adicional
    requestId: 456,
    action: 'approved'
  },
  sender: {                       // Info del remitente
    name: 'Juan Pérez',
    replyTo: 'juan@example.com',
    gmailUserId: 789
  },
  skipSave: false,                // Si true, no guarda en BD
  to: 'email@example.com'         // Email destino (opcional)
}
```

---

**FIN DE FASE 1**

**Próximo paso:** Esperar confirmación del usuario para proceder con FASE 2.
