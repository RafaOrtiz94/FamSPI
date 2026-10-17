# Fase 2 — Diseño de esquema SaaS y autorización

Estado: `schema aplicado / backfill y activación bloqueados por decisiones funcionales`

Fecha: 2026-09-03

## 1. Fuente de verdad actual

Neon PostgreSQL fue consultado en modo lectura usando el secreto de GCP `DB_PASSWORD`, proyecto `famspi-sbox`.

### Tablas actuales relevantes

| Tabla | Estado real |
|---|---|
| `public.users` | 38 usuarios; `role TEXT NULL`; `extra_roles TEXT[] NOT NULL` |
| `public.user_module_access` | 256 registros; asignación por usuario y módulo |
| `public.module_global_status` | 1 registro; PK `module_key` |
| `public.audit_access_grants` | Existe en Neon; contiene email, expiración, estado, creador y revocación; no tiene FK visible a usuarios |

### Constraints verificadas

- `user_module_access.user_id` referencia `users(id)`.
- Unicidad actual de `user_module_access` por `(user_id, module_key)`.
- Índice actual por `user_id`.
- `module_global_status.module_key` es PK.
- `users.role` no tiene constraint de catálogo.
- No existen tablas verificadas de tenants, membresías de tenant, permisos, roles por tenant o relaciones rol-permiso.
- `audit_access_grants` no se reutiliza automáticamente: su semántica actual está basada en email y acceso temporal de auditoría, no en membresías RBAC.

## 2. Decisiones que aún requieren aprobación

No se debe ejecutar una migración hasta resolver:

1. nombre y configuración del tenant inicial;
2. si los 38 usuarios actuales pertenecen a un solo tenant o a varios;
3. política de `extra_roles` durante la transición;
4. catálogo inicial de permisos sensibles;
5. responsables funcionales de cada módulo;
6. reglas para usuarios que no tienen `role` o tienen `pending`;
7. si `audit_access_grants` será reutilizada como grant temporal de auditoría o permanecerá separada del RBAC general.

## 3. Esquema objetivo propuesto

El siguiente esquema es diseño, no evidencia de tablas existentes.

### `tenants`

Datos de la organización cliente.

Campos propuestos:

- `id BIGSERIAL PRIMARY KEY`;
- `slug TEXT NOT NULL UNIQUE`;
- `name TEXT NOT NULL`;
- `status TEXT NOT NULL` con valores definidos por producto;
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

### `tenant_memberships`

Relación usuario-organización.

Campos propuestos:

- `id BIGSERIAL PRIMARY KEY`;
- `tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`;
- `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`;
- `status TEXT NOT NULL`;
- `is_default BOOLEAN NOT NULL DEFAULT FALSE`;
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
- `UNIQUE (tenant_id, user_id)`.

Debe existir como máximo una membresía default por usuario. La forma de garantizarlo debe definirse en la migración mediante índice parcial o lógica transaccional revisada.

### `modules`

Catálogo persistente de módulos, reemplazando gradualmente el catálogo hardcodeado.

Campos propuestos:

- `key TEXT PRIMARY KEY`;
- `label TEXT NOT NULL`;
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`;
- `metadata JSONB NOT NULL DEFAULT '{}'`;
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

El seed inicial debe salir exactamente de `MODULE_CATALOG`, sin inventar módulos nuevos.

### `tenant_modules`

Entitlements contratados o habilitados por tenant.

Campos propuestos:

- `id BIGSERIAL PRIMARY KEY`;
- `tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`;
- `module_key TEXT NOT NULL REFERENCES modules(key)`;
- `is_enabled BOOLEAN NOT NULL DEFAULT TRUE`;
- `plan_code TEXT`;
- `starts_at TIMESTAMPTZ`;
- `ends_at TIMESTAMPTZ`;
- `updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL`;
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
- `UNIQUE (tenant_id, module_key)`.

### `permissions`

Catálogo de capacidades.

Campos propuestos:

- `key TEXT PRIMARY KEY`;
- `module_key TEXT REFERENCES modules(key)`;
- `resource TEXT NOT NULL`;
- `action TEXT NOT NULL`;
- `description TEXT NOT NULL`;
- `is_sensitive BOOLEAN NOT NULL DEFAULT FALSE`;
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`;
- `UNIQUE (module_key, resource, action)`.

### `roles`

Roles configurables por tenant o roles de plataforma.

Campos propuestos:

- `id BIGSERIAL PRIMARY KEY`;
- `tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE`;
- `key TEXT NOT NULL`;
- `label TEXT NOT NULL`;
- `is_system BOOLEAN NOT NULL DEFAULT FALSE`;
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`;
- `UNIQUE (tenant_id, key)`.

`tenant_id NULL` representaría roles de plataforma, solo si producto confirma que esa distinción es necesaria.

### `role_permissions`

Relación rol-permiso.

- `role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE`;
- `permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE`;
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
- `PRIMARY KEY (role_id, permission_key)`.

### `user_roles`

Asignación de roles a una membresía.

- `membership_id BIGINT NOT NULL REFERENCES tenant_memberships(id) ON DELETE CASCADE`;
- `role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE`;
- `assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL`;
- `expires_at TIMESTAMPTZ`;
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
- `PRIMARY KEY (membership_id, role_id)`.

`expires_at` permite controlar grants puntuales sin convertir `extra_roles` en acceso indefinido.

## 4. Compatibilidad con el modelo actual

Durante la transición:

- `users.role` continúa siendo el rol legacy principal.
- `users.extra_roles` continúa siendo leído por `collectUserRoles()`.
- `user_module_access` continúa funcionando para accesos por usuario.
- `module_global_status` continúa funcionando para estados de construcción/testing.
- el motor central combina temporalmente legacy + permisos persistidos;
- no se eliminan columnas ni tablas actuales en esta fase.

La precedencia propuesta, pendiente de aprobación, es:

```text
tenant_modules deshabilitado → denegar
user_module_access deshabilitado → denegar
permiso ausente → denegar
legacy compatible → permitir durante transición
```

Debe definirse expresamente si un `false` de acceso por usuario puede revocar un entitlement de tenant o si solo puede conceder restricciones adicionales.

## 5. Índices requeridos

Antes de crear índices se debe revisar el plan de ejecución real, pero el diseño necesita como mínimo:

- `tenant_memberships(user_id)`;
- `tenant_memberships(tenant_id, status)`;
- `tenant_modules(tenant_id, module_key)` por unicidad;
- `user_roles(membership_id)`;
- `role_permissions(permission_key)`;
- `users(account_expires_at)` ya existe y debe conservarse;
- `user_module_access(user_id)` ya existe y debe conservarse.

## 6. Secuencia de migración propuesta

El siguiente número funcional disponible es `284`. Los archivos con nombres de fecha como `20260901` no deben mezclarse con la secuencia numérica.

Orden previsto, sujeto a aprobación:

1. `284_saas_tenants_and_memberships.sql`;
2. `285_saas_modules_and_tenant_modules.sql`;
3. `286_saas_permissions_roles_and_assignments.sql`;
4. backfill controlado de módulos y membresías;
5. validación de conteos y constraints;
6. activación del motor en modo dual.

No se deben crear todavía estos archivos SQL hasta aprobar el diseño y el tenant inicial.

## 7. Resultado de aplicación del DDL

Los scripts `284`, `285` y `286` fueron aplicados en Neon dentro de una única transacción.

Resultado verificado:

- tablas creadas: `tenants`, `tenant_memberships`, `modules`, `tenant_modules`, `permissions`, `roles`, `role_permissions`, `user_roles`;
- constraints e índices creados correctamente;
- conteo de las ocho tablas nuevas: `0` registros cada una;
- no se modificaron `users`, `user_module_access` ni `module_global_status`;
- no se ejecutó backfill ni se asignó tenant.

## 8. Validaciones obligatorias antes de ejecutar backfill

- [ ] Confirmar tenant inicial y sus datos.
- [ ] Confirmar si habrá más de un tenant desde el primer backfill.
- [ ] Confirmar catálogo de módulos exacto.
- [ ] Confirmar catálogo mínimo de permisos.
- [x] Revisar columnas de `audit_access_grants` en Neon.
- [ ] Decidir si `audit_access_grants` permanece separada del RBAC general.
- [ ] Confirmar estrategia de rollback.
- [ ] Preparar snapshot de las tablas afectadas.
- [ ] Definir conteos esperados después de cada backfill.
- [ ] Ejecutar primero en entorno no productivo si existe.
- [x] Aprobar la ejecución de DDL.
-
## 9. Verificacion posterior y correccion aplicada

- Se detecto que las FK de `user_roles` validaban existencia, pero no coincidencia entre el tenant de la membresia y el tenant del rol.
- La migracion `287_validate_user_role_tenant_scope.sql` agrega un trigger que rechaza roles tenant-specific de otro tenant.
- Los roles globales (`tenant_id IS NULL`) siguen siendo asignables a cualquier membresia.
- La prueba funcional en Neon confirmo ambos comportamientos y revirtio todos los datos de prueba; las ocho tablas nuevas permanecen con cero registros.
- La secuencia ejecutada queda: 284, 285, 286 y 287. El backfill y la activacion dual siguen pendientes.
