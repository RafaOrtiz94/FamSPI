# CONTEXT.md — gmail

## 1. Descripción
Módulo de integración con Gmail OAuth2. Permite a usuarios autorizar su cuenta de Gmail para enviar correos desde la plataforma en su nombre. Soporta autorización, verificación de estado, envío y revocación de acceso.

## 2. Endpoints

Prefijo: `/api/v1/gmail`

- **GET /api/v1/gmail/auth/url** — `getAuthUrl` — verifyToken
- **GET /api/v1/gmail/auth/callback** — `oauthCallback` — pública (sin verifyToken)
- **GET /api/v1/gmail/auth/status** — `checkAuthStatus` — verifyToken
- **POST /api/v1/gmail/send** — `sendEmail` — verifyToken
  - Body: `{ to, subject, html, text?, cc?, bcc?, replyTo? }`
- **DELETE /api/v1/gmail/auth/revoke** — `revokeAccess` — verifyToken

## 3. Flujo principal

1. Usuario solicita URL de autorización de Gmail
2. Google redirige al callback con código OAuth
3. Sistema almacena tokens de acceso
4. Usuario puede enviar emails desde su cuenta
5. Usuario puede revocar acceso en cualquier momento

## 4. Validaciones
- `verifyToken` en todas las rutas excepto el callback
- Sin restricción de roles — cualquier usuario autenticado puede autorizar su Gmail

## 5. Base de datos
- No verificado en DB (tokens de Gmail deben almacenarse en alguna tabla)

## 6. Relaciones
- `notifications`: probable uso para notificaciones por email
- `permisos`/`vacaciones`: probable para envío de PDFs por correo

## 7. Frontend asociado
- No verificado en frontend (probable uso interno desde otros módulos)

## 8. Riesgos detectados
- Callback OAuth sin `verifyToken` — estado de sesión debe validarse por otro mecanismo
- Sin restricción de roles — cualquier usuario puede autorizar Gmail

## 9. Notas técnicas
- `gmail.controller.js` (8KB): lógica de OAuth y envío
- Integración por usuario individual (no cuenta institucional compartida)
