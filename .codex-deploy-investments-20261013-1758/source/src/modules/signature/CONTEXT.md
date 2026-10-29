# CONTEXT.md — signature

## 1. Descripción
Módulo de firma digital (FamSign). Permite firmar documentos con sello institucional y QR, verificar documentos firmados públicamente por token, y obtener el trail de auditoría completo. Expone un dashboard de gestión de firmas.

## 2. Endpoints

Prefijo de montaje: `/api` (no `/api/v1/signature`)

- **POST /api/documents/:documentId/sign** — `signDocument` — verifyToken
  - Alias: `POST /api/signature/documents/:documentId/sign`
- **GET /api/verificar/:token** — `verifyDocument` — pública
  - Aliases: `/api/verify/:token`, `/api/signature/verificar/:token`, `/api/signature/verify/:token`
- **GET /api/documents/:documentId/audit-trail** — `getDocumentAuditTrail` — verifyToken
  - Alias: `/api/signature/documents/:documentId/audit-trail`
- **GET /api/dashboard** — `getSignatureDashboard` — verifyToken
  - Alias: `/api/signature/dashboard`

Prefijo v1: `/api/v1/signature` (signature.v1.routes.js — no se leyó contenido)

## 3. Flujo principal

1. Usuario firma un documento via `POST /documents/:documentId/sign`
2. Se genera PDF con sello institucional y QR de verificación
3. Verificador externo escanea QR → accede a `/verificar/:token` para validar autenticidad
4. Administrador revisa trail de auditoría via `GET /documents/:documentId/audit-trail`

## 4. Validaciones
- Verificación pública sin autenticación (acceso por token único)
- `signature.controller.js` (15KB): lógica de firma y verificación

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `permisos`: firma aplicada a permisos laborales
- `vacaciones`: firma aplicada a vacaciones
- `mantenimientos`: firma avanzada en mantenimientos
- `documents`: documentos genéricos pueden ser firmados
- Múltiples módulos referencian firma digital

## 7. Frontend asociado
- `/dashboard/signatures` → `SignatureDashboard`
- `/dashboard/signatures/:documentId/sign` → `DocumentSigner`
- `/verificar/:token` → `DocumentVerification` (ruta pública)
- Roles: `gerencia`, `gerencia_general`, `ti`, `jefe_ti`, `admin_ti`, `comercial`, `jefe_comercial`, `talento_humano`, `finanzas`, `calidad`

## 8. Riesgos detectados
- Prefijo `/api` (sin versión v1) — inconsistencia con el resto del sistema
- Múltiples aliases de la misma ruta — puede generar confusión en logs y pruebas
- `signature.v1.routes.js` (547 bytes) no se leyó — validar si contiene rutas activas distintas

## 9. Notas técnicas
- FamSign es el nombre interno del sistema de firma
- Verificación pública por token es el mecanismo de validación de autenticidad
