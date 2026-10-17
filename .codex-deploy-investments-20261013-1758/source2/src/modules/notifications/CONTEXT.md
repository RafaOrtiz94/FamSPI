# CONTEXT.md — notifications

## 1. Descripción
Módulo de notificaciones internas de la plataforma. Permite a usuarios listar, crear, marcar como leídas (individual o masivo), y eliminar notificaciones. Es consumido internamente por otros módulos vía `notificationManager.js` y `notificationRecipientsConfig.service.js`.

## 2. Endpoints

- **GET /api/v1/notifications/**
  - Controller: `notifications.controller.js → list`
  - Service: `notifications.service.js`
  - Middleware: `verifyToken`
  - Roles requeridos: Cualquier usuario autenticado

- **POST /api/v1/notifications/**
  - Controller: `notifications.controller.js → create`
  - Service: `notifications.service.js`
  - Middleware: `verifyToken`
  - Roles requeridos: Cualquier usuario autenticado

- **PATCH /api/v1/notifications/read-all**
  - Controller: `notifications.controller.js → markAll`
  - Service: `notifications.service.js`
  - Middleware: `verifyToken`
  - Roles requeridos: Cualquier usuario autenticado

- **PATCH /api/v1/notifications/:id/read**
  - Controller: `notifications.controller.js → markRead`
  - Service: `notifications.service.js`
  - Middleware: `verifyToken`
  - Roles requeridos: Cualquier usuario autenticado

- **DELETE /api/v1/notifications/clear**
  - Controller: `notifications.controller.js → clear`
  - Service: `notifications.service.js`
  - Middleware: `verifyToken`
  - Roles requeridos: Cualquier usuario autenticado

- **DELETE /api/v1/notifications/:id**
  - Controller: `notifications.controller.js → remove`
  - Service: `notifications.service.js`
  - Middleware: `verifyToken`
  - Roles requeridos: Cualquier usuario autenticado

## 3. Flujo principal

1. Módulos internos (permisos, vacaciones, business-case, etc.) llaman a `notificationManager.js` directamente
2. `notificationRecipientsConfig.service.js` determina qué usuarios reciben cada notificación según el evento
3. Las notificaciones se almacenan en DB con estado `leída/no leída`
4. El frontend consulta `GET /notifications/` al cargar para mostrar el badge
5. El usuario marca como leídas o elimina desde la UI

## 4. Validaciones
- Todas las rutas requieren JWT válido
- No hay validación de roles diferenciada — cualquier usuario autenticado opera sus propias notificaciones
- No verificado si hay filtrado por `user_id` en el service (no se leyó el service)

## 5. Base de datos

### Tablas usadas:
- No verificado en DB

### Campos relevantes:
- No verificado en DB

## 6. Relaciones
- **Módulo crítico**: es consumido internamente por prácticamente todos los módulos con flujos de aprobación
- `notificationManager.js` (27KB): orquestador central de envío de notificaciones
- `notificationRecipientsConfig.service.js` (10KB): configuración de destinatarios por tipo de evento

## 7. Frontend asociado
- No verificado en frontend (no hay ruta React dedicada visible en AppRoutes.jsx)
- Probable integración en el layout global (badge de notificaciones)

## 8. Riesgos detectados
- Sin control de roles por notificación — un usuario podría acceder a notificaciones de otro si no hay filtro por `user_id` en el service
- Alta dependencia: todos los módulos lo usan indirectamente — cambios en el contrato afectan toda la plataforma

## 9. Notas técnicas
- `notificationManager.js` es el punto de entrada interno para enviar notificaciones desde otros módulos
- No usar este módulo como proxy externo — es de consumo interno
