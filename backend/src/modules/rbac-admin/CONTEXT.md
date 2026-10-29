# rbac-admin

Administración del catálogo central de RBAC (plan `docs/plans/rbac-unified-access-implementation-plan.md`, Fase 6).

## Qué hace hoy y qué no

Permite ver roles, permisos y el acceso central de un usuario, y asignar o revocar roles y permisos individuales con motivo y vencimiento.

**Los cambios no alteran el acceso real.** Mientras un módulo no esté activado en el motor central (Fases 5 y 7), decide `requireRole`. Las respuestas lo indican en `enforcement`.

## Endpoints (`/api/v1/rbac`, rol `jefe_ti` / `admin_ti`)

| Método y ruta | Permiso | Uso |
|---|---|---|
| `GET /summary` | `rbac.read` | conteos del catálogo y estado de la activación |
| `GET /roles` | `rbac.read` | roles con nº de permisos y de usuarios |
| `GET /permissions?q=&module=&limit=&offset=` | `rbac.read` | permisos del catálogo |
| `GET /users/:userId` | `rbac.read` | rol heredado, asignaciones y grants vigentes |
| `GET /roles/:roleId` | `rbac.read` | un rol con la lista de sus permisos |
| `POST /roles` `{ key, label, permissions[], clone_from?, reason }` | `rbac.manage` | crea un rol personalizado (prefijo `custom_` obligatorio) |
| `PUT /roles/:roleId` `{ label?, permissions?, reason }` | `rbac.manage` | edita un rol personalizado; los de sistema responden 403 |
| `DELETE /roles/:roleId` `{ reason }` | `rbac.manage` | archiva un rol personalizado; con usuarios activos responde 409 |
| `GET /matrix`, `GET /audit`, `POST /sync-inherited` | `rbac.read` / `rbac.manage` | matriz rol por area, auditoria con antes y despues, sincronizacion de heredadas |
| `POST /users/:userId/roles` `{ role, reason, expires_at? }` | `rbac.manage` | asignación manual |
| `DELETE /users/:userId/roles/:assignmentId` `{ reason }` | `rbac.manage` | revoca una asignación **manual** |
| `POST /users/:userId/grants` `{ permission, reason, expires_at? }` | `rbac.manage` | permiso individual |
| `DELETE /users/:userId/grants/:grantId` | `rbac.manage` | revoca un grant |

Reglas: el motivo es obligatorio (mínimo 5 caracteres); el vencimiento debe ser futuro; nadie modifica sus propios roles ni permisos; las asignaciones heredadas de `users.role` / `extra_roles` no se tocan desde aquí.

## Modelo de datos

Migraciones 284 a 286 (catálogo) y 316 (`user_role_assignments`, `user_permission_grants`, `rbac_endpoint_permissions`). No usa tenants (restricción 12 del plan).

El catálogo se deriva de las guardas actuales con `backend/scripts/rbac/seed_rbac_catalog.js` (solo base local de staging por ahora). Los nombres de permiso son provisionales hasta que cada responsable de área los apruebe.

## Banderas (todas apagadas por defecto)

| Variable | Efecto |
|---|---|
| `RBAC_MODULE_SHADOW` | compara el registro ruta API → módulo con la decisión actual y registra diferencias |
| `RBAC_CENTRAL_SHADOW` | compara la decisión del motor central con el 403 real y registra diferencias |
| `RBAC_CENTRAL_PILOT` | `module_access.*` se decide con el motor central; si falla, decide la regla de siempre |

## Verificación

- `node scripts/rbac/verify_central_parity.js`: ejecuta las guardas reales contra el motor central para todos los endpoints y roles.
- `node scripts/rbac/generate_api_module_registry.js --check` y `generate_access_inventory.js --check`.
- Pruebas: `npx jest src/security src/modules/rbac-admin`.

## Constructor de roles (enfoque SaaS, paso 1)

- Los roles de sistema (los que vienen del codigo) son de solo lectura; se pueden ver y duplicar.
- Un rol personalizado lleva siempre el prefijo `custom_`: ninguno puede llamarse `admin`, `jefe_ti` ni un nombre que `requireRole` o los superroles reconozcan.
- No se pueden delegar permisos de administracion del propio RBAC (`rbac.*`, `module_access.*`); la pantalla ni los ofrece y el servidor los rechaza.
- Un rol con usuarios activos no se archiva. Archivar conserva el historial y reserva el nombre.
- Crear, editar y archivar exigen motivo y dejan registro con antes y despues (modulo `rbac_cambios`).
- Un rol personalizado solo cambia el acceso real en las areas con `RBAC_CENTRAL_ENFORCE` activo; en el resto decide `requireRole`.
- El sembrador (`seed_rbac_catalog.js`) solo reescribe lo generado desde el codigo: los roles personalizados y sus permisos se conservan.
- Hoy los roles son globales (`tenant_id` NULL). El modelo multiempresa (paso 2) los pasara a ser por empresa.

## Multiempresa (enfoque SaaS, paso 2): garantia de no afectar lo actual

**Apagado por defecto.** `RBAC_TENANT_MODE` solo existe para las tablas y la pantalla de RBAC. Apagado, cada funcion ejecuta las mismas consultas de siempre (hay pruebas que lo fijan) y el motor central usa los mismos nombres de rol.

Lo que NO toca: `users`, `user_module_access`, ninguna tabla de negocio, el token JWT, `requireRole`, las rutas existentes ni el frontend fuera de la pestana de RBAC. La empresa no viaja en el token ni en un encabezado: se resuelve en el servidor desde `tenant_memberships`, asi no se puede falsificar.

Cambios de datos (migracion `317_rbac_tenant_scope.sql`): solo columnas nulas `tenant_id` en `user_role_assignments` y `user_permission_grants` (tablas de 316, que nadie mas lee) y un indice unico que incluye la empresa. No cambia ninguna fila.

Encendido (`RBAC_TENANT_MODE=true`):

- La empresa de un administrador es su membresia activa por defecto; sin ella, 403.
- Solo se ven y modifican usuarios miembros de la propia empresa; los de otra responden 404, igual que uno inexistente.
- Los roles de sistema son comunes a todas las empresas. Un rol personalizado nace en la empresa de quien lo crea; dos empresas pueden tener el mismo nombre tecnico con permisos distintos.
- El motor central llama `t<id>:<clave>` a los roles de una empresa, asi un rol no coincide con el de otra ni con uno de sistema.
- La auditoria, la matriz, los conteos y el resumen se limitan a la empresa. Los registros de auditoria anteriores al modo multiempresa no tienen etiqueta y no se muestran a ninguna empresa.
- Las asignaciones y permisos creados antes del modo (`tenant_id` NULL) y las heredadas de `users.role` valen para todas las empresas del usuario.
- Un rol personalizado anterior al modo (sin empresa) se ve pero no se edita desde una empresa: se duplica.

Limites del paso 2: no hay administrador de plataforma separado ni aislamiento de los datos de negocio (clientes, compras, tickets...). Eso es el paso 3 y se hara con el mismo metodo: aditivo, apagado por defecto y modulo por modulo.
