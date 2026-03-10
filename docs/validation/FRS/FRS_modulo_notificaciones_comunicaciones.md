# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)

## Nombre del modulo
Notificaciones y Comunicaciones

## Descripcion funcional
Gestiona la comunicacion operativa interna del sistema mediante notificaciones in-app, correo y Google Chat, incluyendo despacho asincrono por cola y configuracion de destinatarios por evento.

## Logica funcional observada
- Bandeja de notificaciones por usuario (listar, crear, marcar, eliminar).
- Conteo de no leidas y marcado masivo.
- Envio de notificaciones por plantillas y mensajes custom.
- Cola de despacho asincrono con reintentos por canal (email/chat).
- Configuracion de destinatarios por evento/fuente.
- Notificaciones de seguridad (login fuera de horario) a usuarios TI.

## Especificaciones funcionales
### FRS-NTF-001
**Descripcion:** Bandeja de notificaciones por usuario (listar, crear, marcar, eliminar).

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-NTF-002
**Descripcion:** Conteo de no leidas y marcado masivo.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-NTF-003
**Descripcion:** Envio de notificaciones por plantillas y mensajes custom.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-NTF-004
**Descripcion:** Cola de despacho asincrono con reintentos por canal (email/chat).

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-NTF-005
**Descripcion:** Configuracion de destinatarios por evento/fuente.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-NTF-006
**Descripcion:** Notificaciones de seguridad (login fuera de horario) a usuarios TI.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

## Endpoints API relacionados
### Notificaciones in-app
- `GET /api/v1/notifications`
- `POST /api/v1/notifications`
- `PATCH /api/v1/notifications/read-all`
- `PATCH /api/v1/notifications/:id/read`
- `DELETE /api/v1/notifications/clear`
- `DELETE /api/v1/notifications/:id`

### Jobs internos
- `POST /internal/jobs/notifications/dispatch`

## Validaciones y controles funcionales
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

## Dependencias funcionales
- Autenticacion y Sesiones.
- Usuarios y Perfiles.
- Comercial, Talento Humano, Servicio Tecnico, TI Soporte (eventos de negocio).
- Integraciones Gmail/Chat para envio multicanal.

## Observaciones
- Acumulacion de `failed` en cola puede degradar la comunicacion del sistema.
- Dependencia de servicios externos (SMTP/Gmail/Chat) para canales no in-app.
- Error de ausencia de tabla de threads en entornos sin migracion 113.
- Configuracion incorrecta de destinatarios puede producir alertas incompletas.
