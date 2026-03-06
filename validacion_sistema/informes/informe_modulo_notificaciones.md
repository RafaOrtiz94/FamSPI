# INFORME DE VALIDACION DEL MODULO

## Nombre del modulo
Notificaciones y Comunicaciones

## Descripcion del modulo
Gestiona la comunicacion operativa interna del sistema mediante notificaciones in-app, correo y Google Chat, incluyendo despacho asincrono por cola y configuracion de destinatarios por evento.

## Alcance funcional
- Bandeja de notificaciones por usuario (listar, crear, marcar, eliminar).
- Conteo de no leidas y marcado masivo.
- Envio de notificaciones por plantillas y mensajes custom.
- Cola de despacho asincrono con reintentos por canal (email/chat).
- Configuracion de destinatarios por evento/fuente.
- Notificaciones de seguridad (login fuera de horario) a usuarios TI.

## Componentes del sistema
### Controladores
- `backend/src/modules/notifications/notifications.controller.js`

### Servicios
- `backend/src/modules/notifications/notifications.service.js`
- `backend/src/modules/notifications/notificationManager.js`
- `backend/src/modules/notifications/notificationRecipientsConfig.service.js`
- `backend/src/jobs/processNotificationDispatchQueue.js`

### Modelos
- Sin ORM; SQL directo y procesamiento batch de cola.

### Rutas
- `backend/src/modules/notifications/notifications.routes.js`
- `backend/src/routes/internalJobs.routes.js` (ruta de dispatch)

### Componentes de interfaz
- `spi_front/src/core/api/notificationsApi.js`
- Componentes de consumo transversal en dashboards/widgets de modulos de negocio.

## Endpoints de API
### Notificaciones in-app
- `GET /api/v1/notifications`
- `POST /api/v1/notifications`
- `PATCH /api/v1/notifications/read-all`
- `PATCH /api/v1/notifications/:id/read`
- `DELETE /api/v1/notifications/clear`
- `DELETE /api/v1/notifications/:id`

### Jobs internos
- `POST /internal/jobs/notifications/dispatch`

## Tablas de base de datos asociadas
- `notifications`
- `notification_recipients_config`
- `notification_dispatch_queue`
- `notification_process_email_threads`

## Dependencias con otros modulos
- Autenticacion y Sesiones.
- Usuarios y Perfiles.
- Comercial, Talento Humano, Servicio Tecnico, TI Soporte (eventos de negocio).
- Integraciones Gmail/Chat para envio multicanal.

## Controles de seguridad
### Control de acceso
- JWT obligatorio en endpoints `/api/v1/notifications`.
- Endpoint de jobs protegido por `jobsAuth` y clave interna.

### Autenticacion
- Operaciones de usuario basadas en identidad JWT (`req.user.id`).

### Autorizacion
- Acceso acotado por ownership para lectura/modificacion de notificaciones.
- Seleccion de destinatarios por rol/usuario en configuracion de eventos.

### Registro de auditoria
- Trazabilidad de estado de cola (`pending`, `processing`, `sent`, `failed`).
- Metadatos por notificacion (`source`, `priority`, `process_key`, timestamp).

### Proteccion de datos
- Normalizacion de payload y metadatos.
- Reintentos con backoff y control de concurrencia (`FOR UPDATE SKIP LOCKED`).

## Riesgos operativos
- Acumulacion de `failed` en cola puede degradar la comunicacion del sistema.
- Dependencia de servicios externos (SMTP/Gmail/Chat) para canales no in-app.
- Error de ausencia de tabla de threads en entornos sin migracion 113.
- Configuracion incorrecta de destinatarios puede producir alertas incompletas.

## Posibles escenarios de falla
- Reintentos agotados en envio de correo critico.
- Bloqueo de cola por volumen alto de eventos simultaneos.
- Inconsistencia entre notificacion in-app creada y canal externo no enviado.
- Error de permisos al marcar o eliminar notificaciones de otro usuario.

## Nivel de criticidad
ALTO

## Prioridad de validacion
MEDIA-ALTA

---

## BASE DOCUMENTAL PARA VALIDACION

## Requerimientos del usuario (URS)
- `URS-NOT-001`: El sistema debe notificar al usuario sobre eventos relevantes de sus procesos.
- `URS-NOT-002`: El sistema debe permitir gestionar estado de lectura y limpieza de notificaciones.
- `URS-NOT-003`: El sistema debe enviar comunicaciones por correo/chat para eventos criticos.
- `URS-NOT-004`: El sistema debe reintentar envios fallidos sin perder trazabilidad.
- `URS-NOT-005`: El sistema debe permitir definir destinatarios por tipo de evento.

## Requerimientos funcionales
- `RF-NOT-001`: Exponer CRUD operativo de notificaciones in-app por usuario autenticado.
- `RF-NOT-002`: Encolar despachos asincronos por canal y procesarlos en batch.
- `RF-NOT-003`: Registrar estado de cola y errores de entrega por intento.
- `RF-NOT-004`: Mantener contexto de hilo de correo por proceso (`process_key`).
- `RF-NOT-005`: Soportar configuracion dinamica de receptores por rol/usuario.

## Resumen del diseno tecnico
- Patron manager (`notificationManager`) para orquestar in-app + email + chat.
- Cola SQL con locking transaccional para despacho concurrente seguro.
- API de notificaciones desacoplada de modulos productores de eventos.
- Endpoint de job interno para ejecucion programada o manual.

## Escenarios de prueba
### Funcionalidad
- Caso: Crear notificacion manual y marcarla como leida.
- Resultado esperado: Estado `read` persistido y conteo no leidas actualizado.

### Seguridad
- Caso: Usuario intenta eliminar notificacion de otro usuario.
- Resultado esperado: Rechazo por ownership y sin borrado.

### Manejo de errores
- Caso: Falla SMTP durante procesamiento de cola.
- Resultado esperado: Registro `failed` con reintento programado.

### Integridad de datos
- Caso: Procesar lote de cola con multiples canales.
- Resultado esperado: Consistencia entre estado de cola y notificacion fuente.

---

## MATRIZ DE TRAZABILIDAD

| Requerimiento | Componente | Prueba |
|---|---|---|
| REQ-NOT-001 Bandeja de usuario | `notifications.service.listNotifications` | Listar por usuario y validar filtros/status |
| REQ-NOT-002 Gestion de lectura | `markAsRead` y `markAllAsRead` | Marcar individual/masivo y verificar conteo |
| REQ-NOT-003 Envio multicanal | `notificationManager.sendNotification` | Disparar evento y validar email/chat/in-app |
| REQ-NOT-004 Reintentos de cola | `processDispatchQueueBatch` | Simular error de canal y verificar backoff |
| REQ-NOT-005 Destinatarios por evento | `notificationRecipientsConfig.service.getRecipients` | Configurar rol/usuario y validar expansion de destinatarios |
