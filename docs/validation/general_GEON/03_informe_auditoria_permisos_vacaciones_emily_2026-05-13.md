# Informe de Auditoría — Solicitudes de Permisos/Vacaciones

## 1) Metadatos de auditoría
- Fecha de emisión: 2026-05-14
- Fecha auditada (objetivo): 2026-05-13
- Zona horaria oficial del informe: **America/Guayaquil (UTC-05:00)**
- Usuario auditado: **emily.sevilla@fam-project.com**
- Sistema: FamSPI (Neon PostgreSQL como fuente de verdad para datos de DB)

## 2) Objetivo
Verificar solicitudes de permisos/vacaciones de la usuaria auditada, con foco en:
1. solicitud cancelada,
2. solicitud de permiso por calamidad,
3. estado de notificaciones (email y otros canales).

## 3) Alcance y fuente de verdad
- Módulos analizados: `permisos`, `vacaciones`, `notifications`.
- Tablas verificadas en Neon:
  - `users`
  - `permisos_vacaciones`
  - `notifications`
  - `notification_dispatch_queue`
- Regla aplicada: si no está en DB/código/contexto validado, no se afirma.

## 4) Procedimiento auditable (reproducible)
Ejecutar consultas SQL de solo lectura sobre Neon y formatear tiempos en Ecuador.

```sql
-- 4.1 Usuario auditado
SELECT id, email, fullname, role, active
FROM users
WHERE LOWER(email) = LOWER('emily.sevilla@fam-project.com')
LIMIT 1;
```

```sql
-- 4.2 Solicitudes foco (IDs identificados en la fecha auditada)
SELECT
  id,
  tipo_solicitud,
  tipo_permiso,
  subtipo_calamidad,
  status,
  cancellation_status,
  cancellation_reason,
  to_char(created_at AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD HH24:MI:SS') AS created_at_ecuador,
  to_char(updated_at AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD HH24:MI:SS') AS updated_at_ecuador
FROM permisos_vacaciones
WHERE id IN (129, 131)
ORDER BY id;
```

```sql
-- 4.3 Notificaciones asociadas a las solicitudes foco
SELECT
  id,
  title,
  source,
  (meta->>'solicitud_id')::int AS solicitud_id,
  to_char(created_at AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD HH24:MI:SS') AS created_at_ecuador
FROM notifications
WHERE id IN (1699, 1701, 1734, 1737)
ORDER BY id;
```

```sql
-- 4.4 Evidencia de cola asíncrona para esas notificaciones
SELECT
  id,
  notification_id,
  channel,
  status,
  attempts,
  max_attempts,
  last_error,
  to_char(created_at AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD HH24:MI:SS') AS created_at_ecuador,
  to_char(updated_at AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD HH24:MI:SS') AS updated_at_ecuador
FROM notification_dispatch_queue
WHERE notification_id IN (1699, 1701, 1734, 1737)
ORDER BY notification_id, channel;
```

## 5) Evidencia obtenida

### 5.1 Identidad del usuario auditado
- `id`: 6
- `email`: emily.sevilla@fam-project.com
- `fullname`: Emily Sevilla
- `role`: backoffice_comercial
- `active`: true

### 5.2 Solicitud cancelada (foco)
- `id`: 129
- `tipo_solicitud`: vacaciones
- `status`: cancelled
- `cancellation_status`: approved
- `cancellation_reason`: auto_expired_without_approval
- `created_at_ecuador`: 2026-05-13 09:05:27
- `updated_at_ecuador`: 2026-05-13 09:05:29

### 5.3 Solicitud de permiso por calamidad (foco)
- `id`: 131
- `tipo_solicitud`: permiso
- `tipo_permiso`: calamidad
- `subtipo_calamidad`: Fallecimiento Familiar
- `status`: partially_approved
- `created_at_ecuador`: 2026-05-13 11:37:41
- `updated_at_ecuador`: 2026-05-13 17:32:38

### 5.4 Notificaciones asociadas (in-app)
- `#1699` — "Solicitud enviada" — solicitud `129` — `2026-05-13 09:05:27` (Ecuador)
- `#1701` — "Solicitud cancelada automaticamente" — solicitud `129` — `2026-05-13 09:05:29` (Ecuador)
- `#1734` — "Solicitud enviada" — solicitud `131` — `2026-05-13 11:37:41` (Ecuador)
- `#1737` — "Solicitud aprobada parcialmente" — solicitud `131` — `2026-05-13 17:32:38` (Ecuador)

### 5.5 Cola de notificaciones (email/chat asíncrono)
- Resultado para notificaciones `1699,1701,1734,1737`: **sin filas en `notification_dispatch_queue`**.
- Interpretación técnica consistente con envío sincrónico (si la cola asíncrona no está activa para ese flujo/instancia).

## 6) Verificación de canales de notificación (email true/false y otros)

### 6.1 Evidencia en código (módulo origen)
En `backend/src/modules/permisos/permisos.service.js` los eventos auditados usan `notificationManager.sendNotification(...)` con `email: true` en los puntos de envío de:
- "Solicitud enviada"
- "Solicitud cancelada automaticamente"
- "Solicitud aprobada parcialmente"

### 6.2 Evidencia en gestor de notificaciones
En `backend/src/modules/notifications/notificationManager.js`:
- `email` del payload se combina con `NOTIFICATIONS_EMAIL_ENABLED` para habilitar despacho de email.
- `chat` por defecto es `false` salvo activación explícita por llamada.
- siempre se crea registro in-app en tabla `notifications` como base del evento.

### 6.3 Limitación de evidencia de configuración por tabla
En este entorno Neon auditado **no existe** la tabla `notification_recipients_config`; por tanto:
- No se puede auditar `send_email/send_chat/send_in_app` por configuración dinámica en DB.
- La evidencia de canal se sustenta en: código ejecutor + registros reales en `notifications` + ausencia/presencia de `notification_dispatch_queue`.

## 7) Hallazgos
1. Se confirma una solicitud cancelada (`#129`) el 2026-05-13, con causa automática por expiración sin aprobación.
2. Se confirma una solicitud de permiso por calamidad (`#131`) el 2026-05-13, con estado parcialmente aprobado.
3. Existen notificaciones in-app trazables para ambas solicitudes foco.
4. No hay evidencia de jobs en cola (`notification_dispatch_queue`) para esos eventos concretos.
5. No hay tabla de configuración dinámica de destinatarios/canales (`notification_recipients_config`) en este Neon.

## 8) Conclusión de auditoría
Con evidencia directa en Neon y normalización horaria a Ecuador, se valida la trazabilidad completa de las dos solicitudes foco (cancelada y calamidad) y sus notificaciones in-app asociadas. La validación de canales por configuración DB queda limitada por inexistencia de `notification_recipients_config` en el entorno auditado.

## 9) Anexos de integridad
- Este informe usa únicamente evidencia verificable en DB y código local.
- No se incluyen secretos ni credenciales.
- Todas las marcas de tiempo reportadas están en `America/Guayaquil (UTC-05:00)`.

## 10) Evidencia de deploy backend en GCloud (2026-05-13)
- Revisión Cloud Run usada como evidencia: `spi-backend-00349-8pl`.
- Hora de creación de revisión:
  - UTC: `2026-05-13 15:00:52`
  - Ecuador: `2026-05-13 10:00:52` (America/Guayaquil, UTC-05:00)
- Variables de entorno verificadas en esa revisión:
  - `EMAIL_NOTIFICATIONS_ENABLED=true`
  - `NOTIFICATIONS_EMAIL_ENABLED=false`
- Interpretación técnica auditable:
  - El switch efectivo del `notificationManager` para envío de correo usa `NOTIFICATIONS_EMAIL_ENABLED`.
  - Por tanto, con `NOTIFICATIONS_EMAIL_ENABLED=false`, el canal email queda deshabilitado para ese despliegue, aun cuando `EMAIL_NOTIFICATIONS_ENABLED=true` exista en entorno.
- Tiempos de despliegue reportados por Cloud Run para esa revisión:
  - `Deploying revision succeeded in 29.86s`
  - `Container image import completed in 12.79s`
  - `Containers became healthy in 14.26s`

### Aclaración de rango horario solicitado
- No existe evidencia de inicio de deploy a las `10:30:52` Ecuador para `spi-backend` el `2026-05-13`.
- Evidencia más cercana:
  - anterior: `spi-backend-00349-8pl` a `10:00:52` Ecuador
  - posterior: `spi-backend-00350-9zp` a `11:00:44` Ecuador
