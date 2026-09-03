# CONTEXT.md — user-certifications

## 1. Descripción
Módulo de certificaciones profesionales de usuarios. Permite a cada usuario registrar, gestionar y exportar sus propias certificaciones. Roles privilegiados pueden ver certificaciones de otros usuarios y generar dossiers consolidados.

## 2. Endpoints

Prefijo: `/api/v1/users` (montado sobre el mismo prefijo de users)

- **POST /api/v1/users/me/certifications** — `createMyCertification` — verifyToken, multer.single('file')
- **POST /api/v1/users/me/certifications/bulk** — `createMyBulkCertifications` — verifyToken, multer.array('files', 10)
- **GET /api/v1/users/me/certifications** — `getMyCertifications` — verifyToken
- **GET /api/v1/users/:id/certifications** — `getUserCertifications` — verifyToken, requireRole(`acp_comercial`, `talento_humano`, `gerencia`, `gerencia_general`)
- **DELETE /api/v1/users/me/certifications/:certId** — `deleteMyCertification` — verifyToken
- **GET /api/v1/users/:id/certifications/pdf** — `generateUserCertificationsPDF` — verifyToken, requireRole(`acp_comercial`, `talento_humano`, `gerencia`, `gerencia_general`)
- **GET /api/v1/users/:id/certifications/dossier** — `generateUserCertificationsDossier` — verifyToken

## 3. Flujo principal

1. Usuario sube certificaciones propias (con archivo opcional)
2. Puede subir múltiples en lote
3. TH o ACP consulta certificaciones de otro usuario
4. Se genera PDF consolidado para presentación
5. Dossier incluye enlace/QR por certificación

## 4. Validaciones
- `multer.memoryStorage()` para archivos de certificaciones
- Máximo 10 archivos en carga masiva
- DELETE usa soft delete (no elimina físicamente)

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `users`: el `:id` referencia un usuario del sistema
- `collaborators`: certificaciones del colaborador
- Google Drive: probable almacenamiento de archivos de certificaciones

## 7. Frontend asociado
- No verificado en frontend (probable integración en `CollaboratorCommandCenter` o perfil de usuario)

## 8. Riesgos detectados
- **Conflicto de ruta**: el prefijo `/api/v1/users` es compartido con el módulo `users` — posible colisión de rutas en registros como `/api/v1/users/:id`
- `GET /api/v1/users/:id/certifications/dossier` sin `requireRole` — cualquier autenticado puede generar dossiers de otros usuarios

## 9. Notas técnicas
- `userCertifications.service.js` (42KB) — grande, incluye generación de PDF/QR
- El dossier genera enlaces/QR para verificación externa de certificaciones
