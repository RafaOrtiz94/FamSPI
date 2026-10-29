# CONTEXT.md — auth

## 1. Descripción
Módulo de autenticación basado en OAuth2 con Google. Emite JWT (accessToken + refreshToken) vía headers HTTP. Gestiona sesiones activas y controla el ciclo de vida de la autenticación. Incluye soporte para aceptación interna de LOPDP.

## 2. Endpoints

- **GET /api/v1/auth/google**
  - Controller: `auth.controller.js → googleAuthRedirect`
  - Service: No verificado
  - Middleware: Ninguno (pública)
  - Roles requeridos: Ninguno (pública)

- **GET /api/v1/auth/google/callback**
  - Controller: `auth.controller.js → googleCallback`
  - Service: No verificado
  - Middleware: Ninguno (pública)
  - Roles requeridos: Ninguno (pública)

- **GET /api/v1/auth/me**
  - Controller: `auth.controller.js → me`
  - Service: No verificado
  - Middleware: `verifyToken`
  - Roles requeridos: Cualquier usuario autenticado

- **POST /api/v1/auth/refresh**
  - Controller: `auth.controller.js → refreshToken`
  - Service: No verificado
  - Middleware: Ninguno (lee header `x-refresh-token`)
  - Roles requeridos: Ninguno

- **POST /api/v1/auth/logout**
  - Controller: `auth.controller.js → logout`
  - Service: No verificado
  - Middleware: `verifyToken`
  - Roles requeridos: Cualquier usuario autenticado

- **POST /api/v1/auth/lopdp/accept**
  - Controller: `auth.controller.js → acceptInternalLopdp`
  - Service: No verificado
  - Middleware: `verifyToken`
  - Roles requeridos: Cualquier usuario autenticado

- **GET /api/v1/auth/sessions**
  - Controller: `auth.controller.js → listSessions`
  - Service: `session.repository.js` (probable)
  - Middleware: `verifyToken`, `requireRole`
  - Roles requeridos: `ti`, `gerencia`

- **GET /api/v1/auth/active-users**
  - Controller: `auth.controller.js → activeUsers`
  - Service: No verificado
  - Middleware: `verifyToken`, `requireRole`
  - Roles requeridos: `ti`, `gerencia`

## 3. Flujo principal

1. Usuario accede a `/api/v1/auth/google` → redirige a Google OAuth2
2. Google retorna a `/api/v1/auth/google/callback` con código de autorización
3. El controller procesa el código, genera `accessToken` (JWT) y `refreshToken`
4. Tokens son enviados por headers: `Authorization` y `x-refresh-token`
5. El frontend usa `/api/v1/auth/me` para obtener datos del usuario actual
6. Al expirar el accessToken, se llama `/api/v1/auth/refresh` usando el header `x-refresh-token`
7. Logout cierra la sesión activa en base de datos

## 4. Validaciones
- `verifyToken`: valida JWT en header `Authorization: Bearer <token>`
- Sesiones gestionadas por `session.repository.js`
- Roles auditados solo para `ti` y `gerencia`

## 5. Base de datos

### Tablas usadas:
- No verificado en DB (se infiere: tabla de sesiones/usuarios)

### Campos relevantes:
- No verificado en DB

## 6. Relaciones
- Dependencias con otros módulos: Es la fuente de verdad de autenticación para todos los demás módulos
- Uso de:
  - auditoría: Registra sesiones activas (a través de `session.repository.js`)
  - LOPDP: acepta el consentimiento interno al crear nuevos colaboradores

## 7. Frontend asociado
- Rutas React: `/login`, `/login/callback`
- Componentes: `Login.jsx`, `LoginCallback.jsx`, `RolePending.jsx`
- Servicio: No verificado en frontend (se infiere: llamadas a `/api/v1/auth/`)

## 8. Riesgos detectados
- El endpoint `/api/v1/auth/refresh` no aplica `verifyToken` — acepta directamente el header `x-refresh-token` sin validar JWT actual
- Módulo monolítico: `auth.controller.js` pesa 28KB — alta concentración de lógica
- `session.repository.js` es el único archivo de persistencia de sesiones visible

## 9. Notas técnicas
- Tokens transmitidos por headers, no por cookies — compatible con clients móviles (iPhone shortcuts)
- Prefijo público: `/api/v1/auth` (montado en `mountPublicRoutes`)
- `session.repository.js` parece ser el único archivo de acceso a DB para este módulo
