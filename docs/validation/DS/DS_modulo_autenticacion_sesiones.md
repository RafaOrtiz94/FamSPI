# DOCUMENTO DE DISENO DEL SISTEMA (DS)

## Nombre del modulo
Autenticacion y Sesiones

## Arquitectura del modulo
- Capa de presentacion: frontend React o consumidores internos del SPI.
- Capa API: rutas Express bajo prefijos del backend.
- Capa de negocio: controladores y servicios del modulo.
- Capa de persistencia: consultas SQL directas y tablas asociadas.
- Capa transversal: autenticacion, autorizacion, auditoria y notificaciones cuando aplica.

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

## Modelo de datos asociado
- `users`
- `departments`
- `user_sessions`
- `user_profile`
- `user_attendance_records`
- `user_lopdp_consents`

## Interfaces API
- `GET /api/v1/auth/google`
- `GET /api/v1/auth/google/callback`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/lopdp/accept`
- `GET /api/v1/auth/sessions`
- `GET /api/v1/auth/active-users`

## Dependencias tecnicas
- Usuarios y Perfiles (datos de identidad y rol).
- Notificaciones (alertas fuera de horario).
- Auditoria (registro de acciones de login/seguridad).
- Documentos (carga de firma/PDF LOPDP en Drive).

## Controles de seguridad y operacion
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

## Riesgos tecnicos detectados
- Falla OAuth/Google APIs impide inicio de sesion.
- Desalineacion de secretos JWT invalida renovaciones.
- Fallas de DB impactan login y creacion de sesion.
- Error en notificacion de seguridad puede ocultar eventos de riesgo fuera de horario.

## Diagrama tecnico
`mermaid
flowchart LR
  UI[Frontend o consumidor] --> API[API AUTH]
  API --> CTRL[Controladores]
  CTRL --> SVC[Servicios]
  SVC --> DB[(Base de datos)]
  SVC --> EXT[Dependencias externas o modulos transversales]
`
