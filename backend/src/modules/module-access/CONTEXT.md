# CONTEXT.md — module-access

## Descripción

Módulo de habilitación de módulos por usuario y estado global. Actualmente controla entitlements simples, no permisos por acción ni tenants.

## Rutas

- `GET /api/v1/module-access/catalog`
- `GET /api/v1/module-access/users/:userId`
- `PUT /api/v1/module-access/users/:userId`
- `GET /api/v1/module-access/global`
- `PUT /api/v1/module-access/global/:moduleKey`

Todas usan `verifyToken` y `requireRole(["jefe_ti", "admin_ti"])`; la actualización global repite el control explícitamente.

## Neon verificado

- `public.user_module_access`: 256 registros observados, FK a `users(id)`, unicidad `(user_id, module_key)`.
- `public.module_global_status`: 1 registro observado, PK `module_key`.
- `public.users`: 38 usuarios observados; `role` es texto nullable y `extra_roles` es `TEXT[] NOT NULL`.

## Flujo actual

1. El perfil incluye `module_access` y `module_global_status`.
2. Frontend evalúa la ruta con un catálogo local duplicado.
3. Backend ejecuta `moduleAccessGuard` después de `verifyToken`.
4. El backend intenta resolver el módulo desde `x-app-path`.
5. Un módulo deshabilitado devuelve `403` con `code: MODULE_DISABLED`.
6. `requireRole` permite a pasantes continuar solo cuando el guard marca `_moduleAccessVerified`.

## Estado después de Fase 2

Neon ahora contiene tablas nuevas vacías para `tenants`, `tenant_memberships`, `modules`, `tenant_modules`, `permissions`, `roles`, `role_permissions` y `user_roles`. No existe todavía un tenant inicial ni backfill de usuarios, módulos o permisos.

## Riesgos

- Catálogo backend/frontend duplicado.
- `x-app-path` no debe determinar por sí solo una decisión de seguridad.
- No hay permisos por acción.
- Las tablas de tenant y permisos existen, pero no tienen datos operativos todavía.
- Acceso por usuario no sustituye entitlement por tenant.

## Evolución prevista

Será la base de compatibilidad para `tenant_modules` y el manifiesto de autorización, pero no debe crecer con más listas de roles. Fase 1 introduce la interfaz central; Fase 2 agrega el modelo SaaS en Neon.
