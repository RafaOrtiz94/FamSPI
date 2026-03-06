# INFORME DE VALIDACION DEL MODULO

## Nombre del modulo
Autenticacion y Sesiones

## Descripcion del modulo
Gestiona el acceso al sistema mediante Google OAuth2, emision y renovacion de JWT, cierre de sesion, consulta de usuario autenticado y auditoria de sesiones activas/historicas.

## Alcance funcional
- Inicio de sesion con Google (`/auth/google`, callback OAuth).
- Emision de `accessToken` y `refreshToken`.
- Renovacion de sesion con `x-refresh-token`.
- Cierre de sesiones.
- Registro de aceptacion LOPDP interna con evidencia documental.
- Auditoria de sesiones (`sessions`, `active-users`).
- Deteccion y notificacion de accesos fuera de horario.

## Componentes del sistema
### Controladores
- `backend/src/modules/auth/auth.controller.js`

### Servicios
- `backend/src/modules/auth/session.repository.js`
- `backend/src/modules/notifications/notifications.service.js` (alertas de seguridad)
- `backend/src/utils/offHoursPolicy.js`, `backend/src/utils/geoip.js`
- `backend/src/utils/drive.js` (evidencias LOPDP)

### Modelos
- No existe ORM/modelos de dominio. Acceso SQL directo.

### Rutas
- `backend/src/modules/auth/auth.routes.js`
- Montaje en `backend/src/app.js`: `app.use("/api/v1/auth", authRoutes)`

### Componentes de interfaz
- `spi_front/src/modules/shared/pages/Login.jsx`
- `spi_front/src/modules/shared/pages/LoginCallback.jsx`
- `spi_front/src/core/auth/AuthContext.jsx`
- `spi_front/src/core/auth/ProtectedRoute.jsx`
- `spi_front/src/core/api/authApi.js`

## Endpoints de API
- `GET /api/v1/auth/google`
- `GET /api/v1/auth/google/callback`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/lopdp/accept`
- `GET /api/v1/auth/sessions`
- `GET /api/v1/auth/active-users`

## Tablas de base de datos asociadas
- `users`
- `departments`
- `user_sessions`
- `user_profile`
- `user_attendance_records`
- `user_lopdp_consents`

## Dependencias con otros modulos
- Usuarios y Perfiles (datos de identidad y rol).
- Notificaciones (alertas fuera de horario).
- Auditoria (registro de acciones de login/seguridad).
- Documentos (carga de firma/PDF LOPDP en Drive).

## Controles de seguridad
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

## Riesgos operativos
- Falla OAuth/Google APIs impide inicio de sesion.
- Desalineacion de secretos JWT invalida renovaciones.
- Fallas de DB impactan login y creacion de sesion.
- Error en notificacion de seguridad puede ocultar eventos de riesgo fuera de horario.

## Posibles escenarios de falla
- Token refresh vencido y sin manejo correcto de redireccion.
- Usuario creado automaticamente con rol `pendiente` sin flujo de habilitacion controlado.
- Dependencia Drive no disponible al firmar LOPDP.

## Nivel de criticidad
CRITICO

## Prioridad de validacion
MUY ALTA

---

## BASE DOCUMENTAL PARA VALIDACION

## Requerimientos del usuario (URS)
- `URS-AUTH-001`: El usuario debe iniciar sesion con cuenta corporativa Google.
- `URS-AUTH-002`: El sistema debe mantener la sesion activa sin pedir login continuo.
- `URS-AUTH-003`: El usuario debe poder cerrar sesion de forma segura.
- `URS-AUTH-004`: El personal TI/Gerencia debe visualizar sesiones activas e historicas.
- `URS-AUTH-005`: El sistema debe exigir aceptacion interna LOPDP para nuevos colaboradores.

## Requerimientos funcionales
- `RF-AUTH-001`: Validar dominio permitido en callback OAuth.
- `RF-AUTH-002`: Emitir `accessToken` (8h) y `refreshToken` (7d).
- `RF-AUTH-003`: Renovar tokens con `x-refresh-token` y actualizar `user_sessions`.
- `RF-AUTH-004`: Registrar login en auditoria y detectar accesos fuera de horario.
- `RF-AUTH-005`: Persistir consentimiento LOPDP con trazabilidad de firma y PDF.

## Resumen del diseño tecnico
- Backend Express con middleware JWT.
- Flujo OAuth2 con `googleapis`.
- Frontend React con `AuthContext` y refresh automatico por interceptor Axios.
- Persistencia SQL directa con tablas de sesion, usuario y consentimiento.

## Escenarios de prueba
### Funcionalidad
- Caso: Login OAuth exitoso.
- Resultado esperado: Redireccion a dashboard segun rol y tokens validos en cliente.

### Seguridad
- Caso: Acceso a `/api/v1/auth/sessions` con rol no autorizado.
- Resultado esperado: Respuesta `403`.

### Manejo de errores
- Caso: `refreshToken` expirado.
- Resultado esperado: `401`, limpieza de sesion en frontend y redireccion a login.

### Integridad de datos
- Caso: Logout con refresh token activo.
- Resultado esperado: `logout_time` actualizado en `user_sessions`.

---

## MATRIZ DE TRAZABILIDAD

| Requerimiento | Componente | Prueba |
|---|---|---|
| REQ-AUTH-001 Inicio de sesion corporativo | `auth.controller.googleCallback` | Login con correo dominio permitido y denegado |
| REQ-AUTH-002 Renovacion de sesion | `auth.controller.refreshToken` | Simular expiracion de access token y verificar renovacion |
| REQ-AUTH-003 Cierre seguro de sesion | `session.repository.closeSessionsByEmail` | Logout y validacion de `logout_time` |
| REQ-AUTH-004 Auditoria de sesiones | `auth.controller.listSessions` | Consultar sesiones con rol TI/Gerencia |
| REQ-AUTH-005 Consentimiento LOPDP | `auth.controller.acceptInternalLopdp` | Enviar firma+PDF y verificar persistencia en DB/Drive |
