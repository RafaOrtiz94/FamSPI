# CONTEXT.md — audit-prep

## 1. Descripción
Módulo de preparación para auditorías externas (GXP/ISO). Gestiona el estado global del proceso de preparación, secciones de checklist configurables, documentos requeridos y accesos externos temporales. Feature flag para activar/desactivar el módulo.

## 2. Endpoints

Prefijo: `/api/v1/audit-prep`

- **GET /api/v1/audit-prep/status** — `getStatus` — sin requireRole (todos autenticados)
- **PUT /api/v1/audit-prep/status** — `updateStatus` — requireRole(`admin_ti`, `jefe_ti`)
- **GET /api/v1/audit-prep/sections** — `listSections` — sin requireRole
- **POST /api/v1/audit-prep/sections** — `upsertSection` — requireRole(`admin_ti`, `jefe_ti`)
- **GET /api/v1/audit-prep/documents** — `listDocuments` — sin requireRole
- **POST /api/v1/audit-prep/documents/upload** — `uploadDocument` — sin requireRole
- **PATCH /api/v1/audit-prep/documents/:id/status** — `updateDocumentStatus` — sin requireRole
- **GET /api/v1/audit-prep/documents/:id/download** — `downloadDocument` — sin requireRole
- **GET /api/v1/audit-prep/external-access** — `listExternalAccess` — requireRole(`admin_ti`, `jefe_ti`)
- **POST /api/v1/audit-prep/external-access** — `addExternalAccess` — requireRole(`admin_ti`, `jefe_ti`)
- **DELETE /api/v1/audit-prep/external-access/:id** — `revokeExternalAccess` — requireRole(`admin_ti`, `jefe_ti`)

Nota: usa `requireRole` de `../../middlewares/auth` (no de `roles.js`) — no verificado si es el mismo

## 3. Flujo principal

1. Admin TI activa el modo de preparación de auditoría
2. Define secciones del checklist
3. Equipos suben documentos requeridos por sección
4. Se otorgan accesos temporales a auditores externos
5. Al finalizar: se revoca el acceso externo y se cierra el proceso

## 4. Validaciones
- Configuración restringida a `admin_ti`/`jefe_ti`
- Documentos y estado accesibles a todos los autenticados

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `calidad`: módulos de calidad (CA-01-xx) son los que generan documentos auditables
- `files`/Drive: almacenamiento de documentos

## 7. Frontend asociado
- `/dashboard/auditoria/preparacion` → `AuditPrepPage`
- Roles: `admin_ti`, `jefe_ti`, `ti`, `gerencia`, `calidad`, `finanzas`, `comercial`, `talento_humano`, `operaciones`, `jefe_calidad`

## 8. Riesgos detectados
- `uploadDocument`, `updateDocumentStatus`, `downloadDocument` sin `requireRole` — cualquier autenticado puede subir/modificar documentos
- Usa `requireRole` de `auth.js` en lugar de `roles.js` — posible inconsistencia

## 9. Notas técnicas
- `auditPrep.service.js` (14KB): lógica de preparación
- Módulo diseñado para ser temporal (feature flag)
