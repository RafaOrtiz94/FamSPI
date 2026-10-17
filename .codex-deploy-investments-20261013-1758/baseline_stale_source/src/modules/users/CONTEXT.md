# CONTEXT.md — users

## 1. Descripción
Módulo CRUD de usuarios del sistema. Permite listar, crear, actualizar y eliminar usuarios. Expone el catálogo de roles disponibles para selects del frontend.

## 2. Endpoints

- **GET /api/v1/users/roles** — catálogo de roles — verifyToken, requireRole(USER_DIRECTORY_ROLES)
  - Roles: `talento_humano`, `jefe_talento_humano`, `gerencia`, `ti`, `jefe_ti`, `admin_ti`, `admin`, `administrador`, `finanzas`, `comercial`, `jefe_comercial`, + variantes
- **GET /api/v1/users/** — `getUsers` — verifyToken, requireRole(USER_DIRECTORY_ROLES)
- **GET /api/v1/users/:id** — `getUserById` — verifyToken, requireRole(USER_ADMIN_ROLES)
  - Roles: `talento_humano`, `jefe_talento_humano`, `gerencia`, `ti`, `jefe_ti`, `admin_ti`, `admin`, `administrador`
- **POST /api/v1/users/** — `createUser` — verifyToken, requireRole(USER_ADMIN_ROLES)
- **PUT /api/v1/users/:id** — `updateUser` — verifyToken, requireRole(USER_ADMIN_ROLES)
- **DELETE /api/v1/users/:id** — `deleteUser` — verifyToken, requireRole(USER_ADMIN_ROLES)

## 3. Flujo principal

1. TH/Admin busca usuarios con `GET /users/`
2. Crea nuevo usuario con `POST /users/` asignándole un rol del catálogo
3. Actualiza datos o rol con `PUT /users/:id`
4. En caso de baja: `DELETE /users/:id`

## 4. Validaciones
- Catálogo de roles válidos definido en `ALLOWED_USER_ROLES` (41 roles)
- Solo `USER_ADMIN_ROLES` puede crear/editar/eliminar

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `departments`: asociación de usuarios a departamentos
- `collaborators`: extiende el perfil de un usuario del sistema. Sincronización automática de status: `users.active` se actualiza cuando `collaborator_profiles.profile->'laboral'->>'estatus_empleado'` cambia a valor pasivo
- `auth`: base de creación de cuenta via OAuth2 Google

## 7. Frontend asociado
- `/dashboard/talento-humano/gestion` → `PeopleAdminHub` (tab usuarios)
- `/dashboard/talento-humano/usuarios` → `PeopleAdminHub`

## 8. Riesgos detectados
- No hay service separado — `users.controller.js` (16KB) puede contener lógica de negocio
- No hay validación de unicidad de email visible en rutas

## 9. Notas técnicas
- `users.routes.js` referenciado dos veces en registerRoutes: `/api/v1/users` y `/api/v1/users` (user-certifications monta en el mismo prefijo)
