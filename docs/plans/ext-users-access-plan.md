# Plan: Acceso completo para roles externos (`ing_servicio_ext` / `esp_app_ext`)

## Objetivo

Dar acceso real —backend + frontend— a los roles externos a los módulos:
**FamSign, Capacitaciones, Permisos, Vacaciones** + dashboard propio en `/dashboard/ext`.

---

## Estado final

| Capa | Estado |
|---|---|
| `ROLE_GROUPS.ext_users` definido en `roles.js` | ✅ Existe |
| Backend rutas — permisos, vacaciones, signature-workflows, trainings | ✅ Solo `verifyToken`, ext users pasan |
| Aprobador vacaciones para `ing_servicio_ext` / `esp_app_ext` | ✅ Mapeado a `jefe_servicio` en `vacaciones.service.js` |
| Aprobador permisos para ext roles | ✅ Ya estaba mapeado en `permisos.service.js` |
| `moduleAccessGuard` | ✅ Devuelve `true` por defecto si no hay fila en DB |
| `ProtectedRoute` global incluye ext roles | ✅ `AppRoutes.jsx` línea 235-236 |
| Rutas individuales (permisos, capacitaciones, firma) | ✅ Sin `ProtectedRoute` adicional o `allowedRoles={[]}` |
| Dashboard `/dashboard/ext` | ✅ `ExtUserDashboard.jsx` con `strictRoles` |
| Paths FamSign en `ExtUserDashboard` | ✅ Corregido a `/dashboard/signatures/inbox` |
| `RoleRedirect` mapea ext roles a `/dashboard/ext` | ✅ `ProtectedRoute.jsx` líneas 181-182 |
| Navbar muestra FamSign + Capacitaciones + Permisos para ext | ✅ `NavigationBar.jsx` actualizado |
| Migración DB | ✅ No necesaria — `isModuleEnabledForUser` pasa por defecto |

---

## Paso 1 — Backend: verificar y abrir rutas de los 4 módulos

### 1.1 Permisos (`permisos.routes.js`)
Todas las rutas usan solo `verifyToken` sin `requireRole` → **acceso ya implícito**.
Verificar que `permisos.service.js` no filtre por rol internamente en `listarMias` / `create`.
El mapeo `ing_servicio_ext → jefe_servicio` para supervisor ya existe en `permisos.service.js:57`.

### 1.2 Vacaciones (`vacaciones.routes.js`)
Igual que permisos — solo `verifyToken`. **Acceso ya implícito.**
Confirmar que `vacaciones.service.js` no restrinja por rol en `list` / `create`.

### 1.3 FamSign — Signature Workflows (`signatureWorkflows.routes.js`)
Revisar `requireRole` en:
- `GET /me/pending`
- `GET /me/completed`
- `POST /:id/signers/:signerId/sign`
- `POST /:id/signers/:signerId/open`

Si tienen `requireRole`, agregar `"ext_users"` al array de cada una.

### 1.4 Capacitaciones (`trainings.routes.js`)
Revisar `requireRole` en rutas de consulta propia (listar, ver detalle, confirmar asistencia).
Agregar `"ext_users"` donde corresponda.

---

## Paso 2 — Backend: moduleAccessGuard

El middleware `moduleAccessGuard` verifica `user.module_access[]` (del JWT) contra la tabla DB.
Si los módulos `permisos`, `vacaciones`, `signature`, `trainings` no están en esa tabla para estos roles,
el guard los bloqueará aunque pasen `requireRole`.

**Opciones (elegir una):**
- **A)** Agregar lógica de bypass en `moduleAccess.service.js` para el grupo `ext_users`
- **B)** Migración DB que inserte filas de acceso (ver Paso 6)
- **C)** Si los módulos no usan `module_access` en absoluto, no hay nada que hacer

---

## Paso 3 — Frontend: rutas en `AppRoutes.jsx`

Verificar y agregar `"ing_servicio_ext"` y `"esp_app_ext"` en `allowedRoles` de:

| Ruta | Ruta actual protegida por |
|---|---|
| `/dashboard/talento-humano/permisos` | ProtectedRoute con lista de roles |
| `/dashboard/firma` | ProtectedRoute con lista de roles |
| `/dashboard/capacitaciones` | ProtectedRoute con lista de roles |
| `/dashboard/ext` | `strictRoles: ["ing_servicio_ext", "esp_app_ext"]` ✅ ya correcto |

---

## Paso 4 — Frontend: NavigationBar (`NavigationBar.jsx`)

Bloque actual para externos (línea ~360):
```js
else if (["ing_servicio_ext", "esp_app_ext"].includes(scope)) {
  groups.primary.push(capacitacionesLink, permisosLink);
}
```

Cambiar a:
```js
else if (["ing_servicio_ext", "esp_app_ext"].includes(scope)) {
  groups.primary.push(firmaLink, capacitacionesLink, permisosLink);
}
```

Verificar que `firmaLink` esté definido en el mismo archivo (buscar cómo se define para otros roles).

---

## Paso 5 — Frontend: ExtUserDashboard (`ext-users/pages/ExtUserDashboard.jsx`)

El dashboard ya lista los 4 módulos con paths correctos:
- Firma Digital → `/dashboard/firma` ✅
- Capacitaciones → `/dashboard/capacitaciones` ✅
- Permisos → `/dashboard/talento-humano/permisos` ✅
- Vacaciones → `/dashboard/talento-humano/permisos` ⚠️ apunta al mismo path que permisos

Si vacaciones tiene su propia ruta, actualizar `path` del módulo `vacaciones` en el array `MODULES`.

---

## Paso 6 — Migración DB (si aplica Paso 2-B)

Crear `backend/migrations/227_ext_users_module_access.sql`:

```sql
-- Habilitar acceso a módulos para roles externos
INSERT INTO module_access (role, module_key, enabled)
VALUES
  ('ing_servicio_ext', 'permisos', true),
  ('ing_servicio_ext', 'vacaciones', true),
  ('ing_servicio_ext', 'signature', true),
  ('ing_servicio_ext', 'trainings', true),
  ('esp_app_ext', 'permisos', true),
  ('esp_app_ext', 'vacaciones', true),
  ('esp_app_ext', 'signature', true),
  ('esp_app_ext', 'trainings', true)
ON CONFLICT (role, module_key) DO UPDATE SET enabled = true;
```

> Ajustar nombres de `module_key` según los valores reales en la tabla `module_access`.

---

## Resumen de archivos a modificar

| Archivo | Cambio |
|---|---|
| `backend/src/modules/signature-workflows/signatureWorkflows.routes.js` | Agregar `"ext_users"` en rutas `/me/pending`, `/me/completed`, `/sign`, `/open` |
| `backend/src/modules/trainings/trainings.routes.js` | Agregar `"ext_users"` en rutas de lectura/lista propias |
| `backend/src/modules/permisos/permisos.service.js` | Confirmar que `listarMias`/`create` no filtran por rol |
| `backend/src/modules/vacaciones/vacaciones.service.js` | Confirmar que `list`/`create` no filtran por rol |
| `backend/src/middlewares/moduleAccess.js` o `moduleAccess.service.js` | Bypass para `ext_users` si necesario |
| `spi_front/src/routes/AppRoutes.jsx` | Agregar roles ext en `allowedRoles` de permisos, vacaciones, firma, capacitaciones |
| `spi_front/src/core/ui/components/NavigationBar.jsx` | Agregar `firmaLink` en bloque de externos |
| `backend/migrations/227_ext_users_module_access.sql` | (Opcional) seed de module_access |

---

## Orden de implementación sugerido

1. Verificar rutas actuales (permisos/vacaciones/firma/capacitaciones) en backend
2. Agregar `ext_users` donde falte en `requireRole`
3. Resolver `moduleAccessGuard` (bypass o migración)
4. Actualizar `AppRoutes.jsx` con roles ext
5. Actualizar `NavigationBar.jsx` con `firmaLink`
6. Corregir path de vacaciones en `ExtUserDashboard.jsx` si tiene ruta propia
7. Probar flujo completo: login con rol `ing_servicio_ext` → dashboard → cada módulo
