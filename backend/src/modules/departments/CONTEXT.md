# CONTEXT.md — departments

## 1. Descripción
Módulo CRUD de departamentos organizacionales. Permite listar, crear, actualizar y eliminar departamentos. Usado por talento humano para estructurar la organización.

## 2. Endpoints

- **GET /api/v1/departments/** — `getDepartments` — verifyToken, requireRole(DEPARTMENT_READ_ROLES)
  - Roles: admin, talento_humano, gerencia, ti, finanzas, y variantes
- **GET /api/v1/departments/:id** — `getDepartmentById` — verifyToken, requireRole(DEPARTMENT_READ_ROLES)
- **POST /api/v1/departments/** — `createDepartment` — verifyToken, requireRole(DEPARTMENT_ADMIN_ROLES)
  - Roles: `talento_humano`, `jefe_talento_humano`, `gerencia`, `ti`, `jefe_ti`, `admin_ti`, `admin`, `administrador`
- **PUT /api/v1/departments/:id** — `updateDepartment` — verifyToken, requireRole(DEPARTMENT_ADMIN_ROLES)
- **DELETE /api/v1/departments/:id** — `deleteDepartment` — verifyToken, requireRole(DEPARTMENT_ADMIN_ROLES)

## 3. Flujo principal

1. TH/Admin crea estructura departamental
2. Usuarios se asocian a departamentos
3. Consultas de directorio filtrables por departamento

## 4. Validaciones
- Dos niveles de acceso: lectura amplia (incluye finanzas/gerencia), escritura restringida a admin/TH/TI

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `users`: usuarios pertenecen a departamentos
- `collaborators`: perfil de colaborador puede referenciar departamento

## 7. Frontend asociado
- `/dashboard/talento-humano/departamentos` → `PeopleAdminHub` (tab departamentos)

## 8. Riesgos detectados
- No hay service separado — solo controller (8KB)

## 9. Notas técnicas
- Módulo simple sin dependencias complejas
