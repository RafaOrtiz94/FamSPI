# CONTEXT.md — clients

## 1. Descripción
Módulo CRM de clientes **ya aprobados**. Gestiona listado con scoping por asesor/asignación, detalle, edición de datos legales, sedes multi-ubicación (con geocodificación Google Maps), interacciones CRM (llamadas/visitas), visitas a clientes y a prospectos, y asignación/reasignación (temporal o permanente) de cartera a asesores comerciales.

**No** gestiona la creación ni aprobación de un cliente nuevo — eso vive en el módulo `requests` (`/api/v1/requests/new-client/*`, ver su `CONTEXT.md`). Este módulo solo opera sobre filas de `client_requests` cuyo `status = 'approved'`.

Controller: `clients.controller.js` (~300 líneas, thin). Service: `clients.service.js` (~2550 líneas — el `ensureTables()` al inicio hace migraciones DDL perezosas en cada request, ver Riesgos).

## 2. Roles

Todos los roles definidos localmente en el módulo (no via `ROLE_GROUPS` de `middlewares/roles.js`), y todos soportan `extra_roles` (ver sección 2.1).

### EDIT_CLIENT_ROLES / OPERATIONS_MANAGER_ROLES (editar cliente y sedes)
```
jefe_operaciones, jefe_de_operaciones, backoffice_comercial
```

### ASSIGN_CLIENT_ROLES / ASSIGNER_ROLES (asignar/reasignar cartera)
```
jefe_operaciones, jefe_de_operaciones, backoffice_comercial
```

### CRM_INTERACTION_ROLES (registrar interacción, ver historial, ver sedes)
```
comercial, acp_comercial, backoffice, backoffice_comercial,
jefe_comercial, gerencia, gerente, admin, administrador, ti,
jefe_operaciones, jefe_de_operaciones
```

### FULL_ACCESS_ROLES / isManager (bypass de scoping en listados, ve attachments)
```
jefe_comercial, acp_comercial, backoffice, backoffice_comercial,
gerencia, gerente, admin, administrador, ti
```

### FIELD_CLIENT_READ_ROLES (lectura para roles técnicos/logística)
```
tecnico, jefe_tecnico, servicio_tecnico, jefe_servicio_tecnico,
logistica, jefe_logistica
```

### ADVISOR_ROLES / ASSIGNABLE_ADVISOR_ROLES (pueden ser asignados como asesor)
```
comercial, asesor_comercial, asesor, ejecutivo_comercial,
acp_comercial, backoffice, backoffice_comercial
```

`GET /`, `GET /:id`, `POST /prospect-visit` y `POST /:id/visit-status` **no** tienen `requireRole` — solo `verifyToken`. Cualquier usuario autenticado puede listar/ver detalle/registrar visitas; el filtrado real de qué clientes ve cada quien ocurre dentro del service (ver sección 5).

### 2.1 Mecanismo `extra_roles` (capacidad puntual sin cambiar el rol principal)
`backend/migrations/276_users_extra_roles.sql` agrega `users.extra_roles TEXT[]`. Permite otorgar a un usuario puntual (ej. `lorena.loaiza`, con rol base distinto) las capacidades de `backoffice_comercial` sin cambiarle el rol. Se propaga al JWT y **hay que respetarlo en dos capas independientes**:
1. **Gate de ruta**: `middlewares/roles.js#collectUserRoles` ya lee `user.extra_roles` — `requireRole([...])` en `clients.routes.js` lo respeta automáticamente.
2. **Lógica interna del service**: `clients.service.js#hasRole(user, allowedRoles)` es un helper local que **también** debe leer `user?.extra_roles` explícitamente (lo hace desde el fix del bug real documentado en el propio archivo, línea ~87). Si se agrega un nuevo `Set` de roles en este service (ej. un nuevo `XXX_ROLES`), debe evaluarse con `hasRole(user, XXX_ROLES)` y NO comparando `user.role` directo, o un usuario con `extra_roles` pasará el gate de la ruta pero seguirá viendo la app como si no tuviera permiso (403 silencioso o vista vacía, sin error visible).

Ejemplo real ya resuelto: `backoffice_comercial` vía `extra_roles` pasaba el `requireRole` de `PUT /:id` pero `canEditClients()` seguía evaluando solo `user.role`, y el frontend ya mostraba el formulario de edición (`FULL_ACCESS_ROLES` en `Clientes.jsx` sí lo incluía) → 403 al guardar sin feedback claro del motivo.

## 3. Endpoints

Prefijo: `/api/v1/clients`

| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/` | `listClients` | verifyToken (scoping interno, ver Flujo) |
| POST | `/prospect-visit` | `registerProspectVisit` | verifyToken |
| POST | `/:id/visit-status` | `setVisitStatus` | verifyToken |
| POST | `/:id/interactions` | `registerInteraction` | CRM_INTERACTION_ROLES |
| GET | `/:id/history` | `getClientHistory` | CRM_INTERACTION_ROLES |
| GET | `/:id/locations` | `listClientLocations` | CRM_INTERACTION_ROLES |
| POST | `/:id/locations` | `addClientLocation` | EDIT_CLIENT_ROLES |
| PUT | `/:id/locations/:locationId` | `updateClientLocation` | EDIT_CLIENT_ROLES |
| DELETE | `/:id/locations/:locationId` | `removeClientLocation` | EDIT_CLIENT_ROLES |
| GET | `/:id` | `getClientDetail` | verifyToken (sin requireRole — ver Riesgos) |
| PUT | `/:id` | `updateClient` | EDIT_CLIENT_ROLES (multipart: `legal_rep_appointment_file`, `ruc_file`, `id_file`, `bpadt_certification_file`, `operating_permit_file`, `consent_evidence_file`, `approval_letter`, `consent_record`) |
| POST | `/:id/assign` | `assignClient` | ASSIGN_CLIENT_ROLES |

## 4. Flujo principal

1. `GET /` (`listAccessibleClients`) — construye la lista visible según el usuario:
   - `isManager` (FULL_ACCESS_ROLES) o `canAssignClients` (jefe_operaciones/backoffice_comercial) o `includeAllForBusinessCase=true` → ve **toda** la cartera (`canBypassAssignmentScope`).
   - `hasFieldClientReadAccess` (roles técnicos/logística) → también ve todo.
   - Cualquier otro (ej. `comercial` puro) → solo clientes donde es `created_by` o tiene un `client_assignments` activo (`is_active=TRUE` y dentro de `starts_at`/`ends_at`).
   - Excluye filas "sucias" de Odoo sin `commercial_name` real (patrón `CLIENTE ID nn` / `RUC ODOO-...`).
   - Soporta filtro por cronograma aprobado (`schedules` module), scope de cronograma técnico (`servicio.cronograma_actividades_tecnicas`), búsqueda `q`, y paginación (`limit` 25–250, default `CLIENTS_LIST_LIMIT` o 100).
   - También devuelve `prospects` (de `prospect_visits`, visitas a prospectos sin cliente aprobado aún) por separado.
2. `getClientDetail` — exige que `client_requests.status='approved'`; si no, 404/400. Trae `asignados` (emails) y `assignment_details` (join con `users`). `ensureClientAccess` bloquea a quien no sea manager/assigner ni tenga asignación/creación activa. `attachments` (links a Drive) solo se devuelven si `isManager` o `canEditClients`.
3. `updateClient` (edición legal/contacto) — solo EDIT_CLIENT_ROLES; sube archivos a Drive vía `uploadBase64File`.
4. `assignClient` — crea/actualiza filas en `client_assignments`; soporta asignación permanente o `temporary` con `starts_at`/`ends_at`, y `unassign` explícito.
5. Sedes (`client_locations`): CRUD con geocodificación automática (`GOOGLE_MAPS_SERVER_API_KEY`) si no se pasan `lat`/`lng` manuales. Solo una sede `is_main=TRUE` por cliente (índice único parcial); si se borra la principal, promueve la sede más antigua restante.
6. Aprendizaje de ubicación (`learnFrequentLocationFromVisits`): si hay ≥3 visitas cercanas entre sí (radio configurable `CLIENT_VISIT_LOCATION_CLUSTER_RADIUS_METERS`, default 250m) sin coordenadas manuales en la sede principal, actualiza/crea automáticamente una ubicación aprendida (`location_source='visit_learning'`).
7. Interacciones CRM (`client_interactions`) y visitas (`client_visit_logs`, estados `visited/pending/skipped/in_visit`) quedan separadas de las visitas a prospectos (`prospect_visits`, sin `client_id`, solo `user_email` + `prospect_name`).

### Flujo de aprobación de cliente nuevo (fuera de este módulo, en `requests`)
1. Comercial envía token de consentimiento LOPDP (`POST /requests/new-client/consent-token`).
2. Cliente acepta vía URL pública (`GET /requests/public/consent/:token`).
3. Comercial crea la solicitud con documentos legales (`POST /requests/new-client` → INSERT en `client_requests`, `status='pending_consent'`/`pending_approval'`).
4. Si `client_type='sub_distribuidor'`: Calidad (`calidad`/`jefe_calidad`) completa un checklist de validación (`PUT /requests/new-client/:id/quality-checklist`) — bloquea la aprobación de backoffice si queda algún ítem obligatorio pendiente o marcado inconsistente.
5. Backoffice (`backoffice_comercial`) aprueba/rechaza (`PUT /requests/new-client/:id/process` → `requests.service.js#processClientRequest`). Al aprobar: `client_requests.status='approved'`, `approval_status='aprobado'`. **No** inserta en la tabla legacy `clients` (ver Riesgos §8.1) ni crea `client_assignments` directamente — la asignación automática al creador ocurre de forma perezosa en `clients.service.js#ensureTables()` (`INSERT ... ON CONFLICT DO NOTHING` para `status='approved'` sin asignación previa), la primera vez que alguien llama a cualquier endpoint de `clients`.
6. A partir de ahí el cliente aparece en `GET /api/v1/clients` como cliente activo.

Frontend de este flujo: `spi_front/src/modules/comercial/pages/NewClientRequest.jsx` (wrapper delgado sobre `NewClientRequestForm.jsx`, que llama `createClientRequest` → `POST /requests/new-client`) y `spi_front/src/modules/backoffice/pages/ClientRequests.jsx` + `ClientRequestReview.jsx` (listan/procesan vía `core/api/requestsApi.js`, **no** `clientsApi.js`).

## 5. Base de datos

**Tabla fuente de verdad**: `client_requests` — cada fila con `status='approved'` **es** un cliente activo. No hay una tabla `clients` separada poblada en producción (ver Riesgos §8.1).

**Tablas del módulo** (todas con FK a `client_requests.id`, `ON DELETE CASCADE`, creadas/parcheadas de forma perezosa por `ensureTables()` en cada cold start del proceso — no hay migración SQL dedicada para varias de ellas):
- `client_assignments` — asignación de cartera a asesores. `assignment_type` (`owner`/`manual`/`temporary`), `is_active`, `starts_at`/`ends_at`, `reason`. Único `(client_request_id, assigned_to_email)`.
- `client_locations` — sedes/ubicaciones (multi-sede). `is_main` único parcial por cliente. `location_source` (`manual`/`visit_learning`).
- `client_visit_logs` — visitas a clientes aprobados. Único `(client_request_id, user_email, visit_date)`.
- `client_interactions` — interacciones CRM (`call`/`visit`) con notas libres.
- `prospect_visits` — visitas a prospectos (sin cliente aprobado aún; no referencia `client_requests`).

**Migraciones relevantes**: `007_clients_and_approvals.sql` (crea `clients` legacy + columnas de aprobación en `client_requests`), `092_client_assignments_temporal_reassignment.sql`, `122_client_locations.sql`, `148_clients_odoo_identity_sync.sql` (sync Odoo), `041_add_client_data_fields.sql`, `276_users_extra_roles.sql`.

**Integración Odoo**: filas sincronizadas tienen `external_source='odoo'`, `external_id`, `last_synced_at`. El usuario técnico de sync es `odoo_sync@spi.local` — sus asignaciones automáticas se desactivan (`is_active=FALSE`) para forzar reasignación real por jefatura comercial (ver `ensureTables()`).

## 6. Relaciones con otros módulos
- `requests`: origen y aprobación de la solicitud de cliente nuevo; comparte la tabla `client_requests`.
- `schedules`: cronogramas comerciales aprobados filtran/priorizan la lista de clientes (`filterBySchedule`, `scheduleWindow`).
- `business-case` / `equipment_purchase_requests`: `client_id` referencia `client_requests.id`; `includeAllForBusinessCase=true` da acceso completo a la cartera al crear un BC.
- `private-purchases` (`private_purchase_requests`): también referencia `client_request_id` para el cronograma técnico combinado.
- Cronograma técnico: `servicio.cronograma_actividades_tecnicas` (schema `servicio`) se cruza para marcar `is_planned_technical` en el listado.
- `integrations`: `integrationOutbox.service.js` (`enqueueIntegrationEvent`) y `config/crmDb.js` (`isCrmSyncEnabled`) — sync con Odoo/CRM externo.
- `files` + Google Drive: `uploadBase64File` para documentos legales del cliente.
- Google Maps Geocoding API: geocodificación de sedes (`GOOGLE_MAPS_SERVER_API_KEY` / `GOOGLE_MAPS_API_KEY` / `GOOGLE_API_KEY`).

## 7. Frontend asociado
- `/dashboard/comercial/clientes` → `ClientesPage` (dentro de `ClientesPlanShell`, tabs Clientes/Planificación) — roles: `comercial`, `jefe_comercial`, `jefe_financiero`, `gerencia`, `gerencia_general`.
- `/dashboard/clientes` → `ClientesPage` — roles: `comercial`, `jefe_comercial`, `backoffice_comercial`, `acp_comercial`, `gerencia`, `gerencia_general`, `operaciones`, `jefe_operaciones`, `jefe_de_operaciones`, `admin`, `administrador`, `ti`.
- `/dashboard/operaciones/clientes` → `ClientesPage` — roles: `jefe_operaciones`, `jefe_de_operaciones`.
- `/dashboard/backoffice/clientes` → `ClientesPage` — dentro del grupo de rutas de `backoffice_comercial`/`gerencia`/`calidad`/`comercial`; agregada específicamente para que `backoffice_comercial` (incl. vía `extra_roles`) pueda alcanzar la cartera (ver comentario en `AppRoutes.jsx` ~línea 770).
- `/dashboard/comercial/new-client-request` → `NewClientRequest` (crea la solicitud; procesada por el módulo `requests`).
- `/dashboard/backoffice/client-requests` y `/dashboard/backoffice/client-request/:id` → `ClientRequests` / `ClientRequestReview` (módulo `requests`, no `clients`).
- Fetch functions: `spi_front/src/core/api/clientsApi.js` (`fetchClients`, `getClientDetail`, `updateClient`, `assignClient`, `setVisitStatus`, `startClientVisit`, `endClientVisit`, `registerProspectVisit`, `fetchClientLocations`, `addClientLocation`, `updateClientLocation`, `removeClientLocation`, `searchApprovedClients`). El flujo de solicitud/aprobación usa en cambio `spi_front/src/core/api/requestsApi.js` (`createClientRequest`, `getClientRequests`, `getClientRequestById`, `processClientRequest`, `updateClientRequestQualityChecklist`).
- Componente de sedes: `spi_front/src/modules/comercial/components/LocationManager.jsx`.
- Widgets relacionados en `spi_front/src/modules/comercial/components/`: `ClientApprovalsWidget` (en `backoffice/components/`), `BackofficeClientRequestsKpiWidget`, `MyClientRequestsWidget`, `ACPClientRequestsWidget`, `ACPClientSummaryWidget`, `JefeClientReportsWidget`.

## 8. Riesgos y notas técnicas

### 8.1 Tabla `clients` (migración 007) es LEGACY / código muerto
`backend/migrations/007_clients_and_approvals.sql` crea una tabla `clients` con campos encriptados (`razon_social`, `ruc`, etc.) y un servicio dedicado `backend/src/services/clients.service.js` (`createClientFromRequest`, con `ENCRYPTED_FIELDS`). **Nada en el flujo real la usa**: `requests.service.js#processClientRequest` aprueba el cliente actualizando solo `client_requests.status`, sin tocar `clients`; `createClientFromRequest` no tiene ningún `require()` en el resto del backend (confirmado por grep). El módulo `clients` (este) tampoco la consulta — trabaja directo sobre `client_requests`. No editar ni intentar "arreglar" esa tabla/servicio pensando que es la fuente real de datos de cliente — está desconectada del flujo de producción. `client_requests.client_id` (columna agregada por la misma migración) tampoco se popula en el flujo actual.

### 8.2 `ensureTables()` como migración perezosa
`clients.service.js#ensureTables()` corre DDL (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) y DML de backfill (seed de `client_assignments`/`client_locations`) en el primer request de cada instancia (guardado en memoria con `_tablesEnsured`). Es idempotente pero no hay migración `.sql` dedicada para varias tablas (`client_visit_logs`, `client_interactions`, `prospect_visits`) — viven solo en este archivo. Si se necesita cambiar su esquema, hacerlo aquí, no asumir que existe un `.sql` en `backend/migrations/`.

### 8.3 `hasRole()` local vs `extra_roles`
Ver sección 2.1 — cualquier nuevo `Set` de roles en este service debe pasar por `hasRole()`, no comparar `user.role` directo, o romperá silenciosamente para usuarios con capacidad otorgada vía `extra_roles`.

### 8.4 `GET /:id` sin `requireRole`
Solo exige `verifyToken`; el control de acceso real es `ensureClientAccess()` dentro del service (creador, asignado activo, manager o assigner). Cualquier cambio a esa función afecta quién puede ver el detalle de un cliente ajeno.

### 8.5 Roles hardcodeados, no via `ROLE_GROUPS`
A diferencia de otros módulos (ver `business-case`), este módulo no usa `ROLE_GROUPS` de `middlewares/roles.js` — cada `Set` de roles se mantiene manualmente y duplicado entre `clients.routes.js`, `clients.service.js` y el frontend (`Clientes.jsx`). Al agregar/quitar un rol hay que sincronizar los tres lugares a mano (patrón similar al de tabs de Business Case, ver skill `bc-workspace-tabs`).

### 8.6 `clients.service.js` es el archivo más grande del módulo
~2550 líneas, sin separar por responsabilidad (listado, sedes, geocodificación, asignaciones, visitas, prospectos, aprendizaje de ubicación). Cambios de alto riesgo — revisar `ensureTables()` primero para entender qué columnas/tablas existen realmente antes de escribir una query nueva.

### 8.7 Tests
`backend/src/modules/clients/__tests__/clients.helpers.test.js` — cobertura limitada (helpers), no cubre los flujos completos de asignación/geocodificación.
