# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)

## Nombre del modulo
Autenticacion y Sesiones

## Descripcion funcional
Gestiona el acceso al sistema mediante Google OAuth2, emision y renovacion de JWT, cierre de sesion, consulta de usuario autenticado y auditoria de sesiones activas/historicas.

## Logica funcional observada
- Inicio de sesion con Google (`/auth/google`, callback OAuth).
- Emision de `accessToken` y `refreshToken`.
- Renovacion de sesion con `x-refresh-token`.
- Cierre de sesiones.
- Registro de aceptacion LOPDP interna con evidencia documental.
- Auditoria de sesiones (`sessions`, `active-users`).
- Deteccion y notificacion de accesos fuera de horario.

## Especificaciones funcionales
### FRS-AUTH-001
**Descripcion:** Inicio de sesion con Google (`/auth/google`, callback OAuth).

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-AUTH-002
**Descripcion:** Emision de `accessToken` y `refreshToken`.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-AUTH-003
**Descripcion:** Renovacion de sesion con `x-refresh-token`.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-AUTH-004
**Descripcion:** Cierre de sesiones.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-AUTH-005
**Descripcion:** Registro de aceptacion LOPDP interna con evidencia documental.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-AUTH-006
**Descripcion:** Auditoria de sesiones (`sessions`, `active-users`).

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-AUTH-007
**Descripcion:** Deteccion y notificacion de accesos fuera de horario.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

## Endpoints API relacionados
- `GET /api/v1/auth/google`
- `GET /api/v1/auth/google/callback`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/lopdp/accept`
- `GET /api/v1/auth/sessions`
- `GET /api/v1/auth/active-users`

## Validaciones y controles funcionales
### Control de acceso
- JWT obligatorio en rutas protegidas.
- Restriccion de auditoria de sesiones para `ti` y `gerencia`.

### Autenticacion
- OAuth2 Google con dominio permitido (`ALLOWED_DOMAIN`).
- Claims JWT validados (`iss`, `aud`, `sub`).

### Autorizacion
- `verifyToken` + `requireRole` en rutas sensibles.

### Registro de auditoria
- `logAction` en eventos de login y aceptacion LOPDP.
- Persistencia de sesiones en `user_sessions`.

### Proteccion de datos
- Registro de IP/user-agent para consentimientos.
- Evidencia documental de consentimiento interno LOPDP.

## Dependencias funcionales
- Usuarios y Perfiles (datos de identidad y rol).
- Notificaciones (alertas fuera de horario).
- Auditoria (registro de acciones de login/seguridad).
- Documentos (carga de firma/PDF LOPDP en Drive).

## Observaciones
- Falla OAuth/Google APIs impide inicio de sesion.
- Desalineacion de secretos JWT invalida renovaciones.
- Fallas de DB impactan login y creacion de sesion.
- Error en notificacion de seguridad puede ocultar eventos de riesgo fuera de horario.
