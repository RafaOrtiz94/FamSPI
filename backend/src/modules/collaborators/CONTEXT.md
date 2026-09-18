# CONTEXT.md — collaborators

## 1. Descripción
Módulo de gestión de perfiles de colaboradores. Provee vista extendida del personal con estadísticas, perfil detallado, actualización de perfil y carga de documentos. Diferente de `users` (que gestiona autenticación/roles) — este módulo gestiona el perfil laboral.

## 2. Endpoints

- **GET /api/v1/collaborators/stats** — `getCollaboratorStats` — requireRole
  - Roles: `talento_humano`, `gerencia`, `gerencia_general`, `admin`, `comercial`
- **GET /api/v1/collaborators/** — `listCollaborators` — requireRole mismos roles
- **GET /api/v1/collaborators/:id/profile** — `getCollaboratorProfile` — requireRole mismos roles
- **PUT /api/v1/collaborators/:id/profile** — `updateCollaboratorProfile` — requireRole mismos roles
- **POST /api/v1/collaborators/:id/documents** — `uploadCollaboratorDocument` — requireRole mismos roles, multer.single('file')

## 3. Flujo principal

1. TH lista colaboradores activos con estadísticas de resumen
2. Accede al perfil individual de un colaborador
3. Actualiza información del perfil laboral
4. Sube documentos del colaborador (contratos, certificaciones, etc.)

## 4. Validaciones
- `multer.memoryStorage()` para documentos
- No hay `verifyToken` explícito en rutas — confiar en middleware global (riesgo potencial)

## 5. Base de datos
- Verificado en Neon PostgreSQL: `users`, `collaborator_profiles` y `collaborator_documents`.
- Fuente unica de documentos de colaboradores: `collaborator_documents`.
- `backend/src/modules/shared/collaboratorDocumentCatalog.js` es la fuente de codigos canonicos y aliases.

## 6. Relaciones
- `users`: extiende el perfil de un usuario del sistema
- `user-certifications`: certificaciones asociadas al colaborador
- `offboarding`: proceso de baja se inicia desde el contexto del colaborador
- `personnel-requests`: cuando se contrata, se crea un colaborador

## 7. Frontend asociado
- `/dashboard/talento-humano/command-center` → `CollaboratorCommandCenter`
- `/dashboard/talento-humano/colaboradores` → `CollaboratorCommandCenter`

## 8. Riesgos detectados
- No hay `verifyToken` explícito en el router de este módulo (solo requireRole) — si el middleware global falla, exposición posible
- `collaborators.service.js` (22KB) — revisar antes de extender

## 9. Notas técnicas
- Separación intencional entre `users` (autenticación/roles) y `collaborators` (perfil laboral)
- **Fuente única de verdad para status**: `users.active` se sincroniza automáticamente con `profile->'laboral'->>'estatus_empleado'`
- Valores pasivos sincronizados: `pasivo`, `desvinculado`, `inactivo`, `en_desvinculacion`
- Cambiar `estatus_empleado` a valor pasivo marca `users.active = false`
- Cambiar `users.active` a `false` actualiza `estatus_empleado = 'inactivo'`

## 10. Consulta documental de Calidad
- Endpoint: `GET /api/v1/collaborators/documents/quality-hr`.
- Rol: `jefe_calidad`.
- La respuesta reutiliza la misma proyeccion normalizada del reporte documental de Talento Humano y limita la consulta a `CONTRACT_FAM`, `HR_RESUME`, `IMAGE_USE_AUTHORIZATION` y `SENESCYT_RECORD`.
- Para Calidad, la proyeccion incluye activos y desvinculados, excluye `pasante` y solo incorpora cualificaciones de `collaborator_qualifications` (no `user_certifications`).
