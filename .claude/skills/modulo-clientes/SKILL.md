---
name: modulo-clientes
description: Mapa real del módulo Clientes (backend/src/modules/clients + módulo requests para altas/aprobación) y su frontend en comercial/backoffice. Úsalo antes de tocar listado de cartera, asignación de asesores, sedes, o el flujo de aprobación de cliente nuevo — hay dos módulos backend distintos que comparten la misma tabla, y una tabla legacy que parece la fuente real de datos pero está muerta.
---

# Skill: Módulo Clientes — FamSPI

Antes de tocar cualquier cosa de "clientes" (cartera, asignación, sedes, o alta de cliente nuevo), lee esto. El error más común en esta área: asumir que existe una tabla `clients` con datos de cliente — no la hay en producción — o mezclar el módulo `clients` (cartera aprobada) con el módulo `requests` (alta y aprobación), que son código, roles y archivos front distintos.

---

## Los dos módulos backend que se llaman "clientes" y NO son el mismo código

| | `backend/src/modules/clients/` | `backend/src/modules/requests/` (rutas `/new-client/*`) |
|---|---|---|
| Qué hace | CRM de clientes **ya aprobados**: listar, ver detalle, editar datos legales, sedes, asignar asesor, registrar visitas/interacciones | Alta y **aprobación** de cliente nuevo: consentimiento LOPDP, checklist de calidad (sub-distribuidores), aprobar/rechazar |
| Prefijo API | `/api/v1/clients` | `/api/v1/requests/new-client` |
| Tabla | `client_requests` con `status='approved'` | `client_requests` (todos los estados) |
| Frontend fetch | `spi_front/src/core/api/clientsApi.js` | `spi_front/src/core/api/requestsApi.js` |
| Páginas comercial | `Clientes.jsx`, `ClientesPlanShell.jsx` | `NewClientRequest.jsx` (wrapper de `NewClientRequestForm.jsx`) |
| Páginas backoffice | — (backoffice llega a `Clientes.jsx` vía ruta `/dashboard/backoffice/clientes`) | `ClientRequests.jsx`, `ClientRequestReview.jsx` |
| Rol que aprueba/edita | `jefe_operaciones` / `jefe_de_operaciones` / `backoffice_comercial` (edición y asignación) | `backoffice_comercial` (aprobar/rechazar), `calidad`/`jefe_calidad` (checklist) |

**Regla práctica**: si el cambio es "cómo se ve/asigna/edita un cliente que ya existe", es `clients`. Si es "cómo se crea o aprueba un cliente nuevo", es `requests`. No busques `createClientRequest` ni `processClientRequest` dentro de `clients.service.js` — no están ahí.

Al aprobar (`requests.service.js#processClientRequest`), lo único que pasa es `UPDATE client_requests SET status='approved'`. No se crea nada en otra tabla. La asignación automática del cliente a su creador ocurre después, de forma perezosa, la primera vez que alguien golpea cualquier endpoint de `clients` (dentro de `ensureTables()`, ver abajo).

---

## La tabla `clients` (migración `007_clients_and_approvals.sql`) es código muerto

Existe una tabla `clients` con campos encriptados (`razon_social`, `ruc`, `ruc_hash`, etc.) y un servicio dedicado `backend/src/services/clients.service.js` (`createClientFromRequest`, con lista de `ENCRYPTED_FIELDS`). **No confundir con** `backend/src/modules/clients/clients.service.js` (el real, en uso). La tabla `clients` legacy:

- No la puebla nada del flujo real de aprobación.
- `createClientFromRequest` no tiene ningún `require()` real en el resto del backend (verificado con grep) — está huérfano.
- El módulo `clients` (activo) tampoco la consulta; trabaja siempre directo sobre `client_requests`.

**La fuente de verdad de "quién es un cliente" es**: fila en `client_requests` con `status = 'approved'`. Punto. Si vas a agregar un campo nuevo de cliente, va en `client_requests` (o en una tabla satélite con FK a `client_requests.id`), nunca en `clients`.

---

## Tablas reales del módulo `clients` (todas FK a `client_requests.id`)

Casi ninguna tiene una migración `.sql` dedicada — se crean/parchean de forma perezosa dentro de `clients.service.js#ensureTables()`, que corre en el primer request de cada instancia (flag `_tablesEnsured` en memoria). Si necesitas cambiar una columna de estas tablas, edítalo ahí, no busques un archivo en `backend/migrations/`.

- **`client_assignments`** — asignación de cartera a asesor. `assignment_type` (`owner`/`manual`/`temporary`), `is_active`, `starts_at`/`ends_at`, `reason`. Único `(client_request_id, assigned_to_email)`. Tiene migración propia: `092_client_assignments_temporal_reassignment.sql`.
- **`client_locations`** — sedes multi-ubicación con lat/lng. Único `is_main=TRUE` por cliente (índice parcial). Migración propia: `122_client_locations.sql`. Soporta geocodificación automática (Google Maps) y "aprendizaje" de ubicación desde el promedio de las últimas visitas (`location_source='visit_learning'`, umbral 3 visitas / radio 250m, configurable via env `CLIENT_VISIT_LOCATION_LEARNING_THRESHOLD` / `CLIENT_VISIT_LOCATION_CLUSTER_RADIUS_METERS`).
- **`client_visit_logs`** — visitas a clientes aprobados (`visited`/`pending`/`skipped`/`in_visit`). Único `(client_request_id, user_email, visit_date)`. Sin migración `.sql` dedicada.
- **`client_interactions`** — interacciones CRM libres (`call`/`visit` + notas). Sin migración `.sql` dedicada.
- **`prospect_visits`** — visitas a **prospectos** (no tienen cliente aprobado todavía). No referencia `client_requests`, solo `user_email` + `prospect_name` en texto libre. Sin migración `.sql` dedicada.

---

## Roles: definidos a mano en 3 lugares, no en `ROLE_GROUPS`

A diferencia de módulos como `business-case`, `clients` **no** usa los grupos de `middlewares/roles.js#ROLE_GROUPS` — cada `Set` de roles está copiado por separado en:

1. `backend/src/modules/clients/clients.routes.js` — `EDIT_CLIENT_ROLES`, `ASSIGN_CLIENT_ROLES`, `CRM_INTERACTION_ROLES` (gate de la ruta, vía `requireRole`).
2. `backend/src/modules/clients/clients.service.js` — `FULL_ACCESS_ROLES`, `FIELD_CLIENT_READ_ROLES`, `OPERATIONS_MANAGER_ROLES`, `ASSIGNER_ROLES`, `ADVISOR_ROLES` (lógica interna: `isManager`, `canEditClients`, `canAssignClients`, scoping del listado).
3. `spi_front/src/modules/comercial/pages/Clientes.jsx` — `FULL_ACCESS_ROLES`, `ASSIGN_CLIENT_ROLES`, `ADVISOR_ROLES`, etc. (qué botones/formularios se muestran).

**Si agregas o quitas un rol, edita los tres.** El patrón de bug real ya visto aquí (Lorena Loaiza, `backoffice_comercial` via `extra_roles`): el frontend ya mostraba el formulario de edición, el gate de la ruta ya la dejaba pasar, pero `canEditClients()` en el service seguía comparando solo `user.role` — 403 al guardar sin ningún error visible explicando por qué.

### El mecanismo `extra_roles` (capacidad puntual sin cambiar el rol)

`backend/migrations/276_users_extra_roles.sql` agrega `users.extra_roles TEXT[]`. Da a un usuario puntual las capacidades de otro rol sin migrar su rol principal (ej. alguien con rol base distinto recibe `extra_roles=["backoffice_comercial"]`, scope financiero). Se propaga al JWT. Hay que respetarlo en **dos capas**:

- `middlewares/roles.js#collectUserRoles` ya lo lee — cualquier `requireRole([...])` en rutas lo respeta gratis.
- Cualquier `Set`/helper de roles **local** a un módulo (como los de `clients.service.js` o `Clientes.jsx` arriba) NO lo respeta automáticamente — hay que usar el helper `hasRole(user, allowedRoles)` (ya existe en `clients.service.js`) o replicar la misma lógica (`user.role` + `user.extra_roles.some(...)`), nunca comparar `user.role` a secas.

Ver comentario real en `spi_front/src/routes/AppRoutes.jsx` (~línea 770): la ruta `/dashboard/backoffice/clientes` se agregó específicamente porque `backoffice_comercial` (incl. via `extra_roles`) ya podía editar/asignar según `FULL_ACCESS_ROLES` en `Clientes.jsx`, pero no existía ninguna ruta protegida que lo dejara *llegar* a la página desde el dashboard de backoffice.

---

## Rutas frontend — la misma página, 4 entradas distintas

`ClientesPage` (`Clientes.jsx`) se monta en 4 rutas con `allowedRoles` distintos — el control de "quién ve qué botón" adentro de la página lo decide `Clientes.jsx` mismo (sus propios `Set`), no la ruta:

- `/dashboard/comercial/clientes` (dentro de `ClientesPlanShell`, tabs Clientes/Planificación) — roles: `comercial`, `jefe_comercial`, `jefe_financiero`, `gerencia`, `gerencia_general`.
- `/dashboard/clientes` — roles: comercial + operaciones + admin/ti (lista más amplia).
- `/dashboard/operaciones/clientes` — solo `jefe_operaciones`/`jefe_de_operaciones`.
- `/dashboard/backoffice/clientes` — grupo backoffice (incluye `backoffice_comercial`).

Si agregas una ruta nueva que monte `ClientesPage`, revisa que `allowedRoles` de `ProtectedRoute` incluya el rol que necesitas — sin eso, aunque `Clientes.jsx` internamente reconozca el rol (`FULL_ACCESS_ROLES`, etc.), el usuario nunca llega a la página.

---

## Scoping del listado (`GET /api/v1/clients`, `listAccessibleClients`)

Quién ve qué en la cartera, en orden de prioridad:

1. `isManager` (FULL_ACCESS_ROLES) o `canAssignClients` (jefe_operaciones/backoffice_comercial) o el caller pasa `include_all_for_business_case=true` → ve **toda** la cartera.
2. `hasFieldClientReadAccess` (roles técnicos/logística) → también ve todo.
3. Cualquier otro rol (`comercial` puro, etc.) → solo clientes donde es `created_by` o tiene un `client_assignments` activo vigente (`is_active=TRUE`, dentro de `starts_at`/`ends_at`).

Filas de Odoo sin nombre comercial real (patrón `CLIENTE ID nn` / `RUC ODOO-...`) se excluyen siempre del listado. Paginación: `limit` clamp a 25–250 (default `CLIENTS_LIST_LIMIT` env o 100).

---

## Checklist antes de tocar algo de "clientes"

1. ¿Es sobre un cliente **ya aprobado** (cartera, edición, sedes, asignación)? → módulo `clients`. ¿Es sobre **crear/aprobar** un cliente nuevo? → módulo `requests` (`/new-client/*`). No mezcles los dos `clients.service.js` (hay uno en `modules/clients/` en uso y otro en `src/services/` muerto).
2. ¿Vas a agregar/quitar un rol? → edita los 3 lugares (routes, service, frontend `Clientes.jsx`) y usa `hasRole()`/lee `extra_roles`, no compares `user.role` directo.
3. ¿Vas a cambiar el esquema de `client_assignments`/`client_locations`/`client_visit_logs`/`client_interactions`/`prospect_visits`? → la mayoría vive solo en `ensureTables()` dentro de `clients.service.js`, no en `backend/migrations/*.sql` (excepto `client_assignments` y `client_locations`, que sí tienen migración propia).
4. ¿Vas a montar `ClientesPage` en una ruta nueva? → agrega el rol también en `ProtectedRoute allowedRoles` de esa ruta en `AppRoutes.jsx`, no solo en los `Set` internos de `Clientes.jsx`.
5. Después de editar backend: `node -e "require('./ruta')"` para syntax-check, `npx eslint <archivo>`. Después de editar frontend: `npx eslint <archivo>`.
