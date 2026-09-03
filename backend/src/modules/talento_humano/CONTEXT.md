# CONTEXT.md — talento_humano

## 1. Descripción
Módulo base de Talento Humano. Gestiona empleados (alta, listado, actualización) y carga de documentos. Es diferente de `collaborators` (perfil extendido) y `users` (autenticación). Actúa como el núcleo de gestión de personal.

## 2. Endpoints

Prefijo: `/api/v1/talento-humano`

- **POST /api/v1/talento-humano/employees** — `createEmployee` — verifyToken, requireRole(`talento_humano`, `gerencia`)
- **GET /api/v1/talento-humano/employees** — `listEmployees` — verifyToken, requireRole(`talento_humano`, `gerencia`)
- **PUT /api/v1/talento-humano/employees/:id** — `updateEmployee` — verifyToken, requireRole(`talento_humano`, `gerencia`)
- **POST /api/v1/talento-humano/documents/:id** — `uploadDocument` — verifyToken, requireRole(`talento_humano`, `gerencia`), multer.single('file')

## 3. Flujo principal

1. TH crea un nuevo empleado en el sistema
2. Actualiza datos del empleado cuando es necesario
3. Sube documentos asociados al empleado

## 4. Validaciones
- Acceso restringido a `talento_humano` y `gerencia`
- `multer.memoryStorage()` para documentos

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `users`: los empleados tienen cuenta de usuario en el sistema
- `collaborators`: vista extendida del empleado
- `permisos`/`vacaciones`: empleados solicitan permisos y vacaciones
- `offboarding`: proceso de baja del empleado

## 7. Frontend asociado
- `/dashboard/talento-humano` → `DashboardTalento`
- `/dashboard/talento-humano/gestion` → `PeopleAdminHub`

## 8. Riesgos detectados
- Módulo muy pequeño (solo 4 endpoints) — puede estar delegando funcionalidad a `collaborators`
- `hr.controller.js` (3KB) muy pequeño — revisar si hay lógica en `index.js`
- `index.js` tiene 0 bytes — archivo vacío

## 9. Notas técnicas
- `AGENTS.md` presente
- `index.js` vacío — probable placeholder para futuras exportaciones
