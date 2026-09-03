# CONTEXT.md — opportunities (FamSheets)

## 1. Descripción
Módulo comercial "FamSheets" (Blue Sheet / Miller Heiman adaptado). Gestiona oportunidades estratégicas de venta: cuentas prospecto, contactos, influencias compradoras (economic/technical/user/coach), banderas rojas (red flags) con severidad, competidores con scoring, plan de acción de mitigación, comentarios de coaching con menciones, y vínculo polimórfico opcional hacia procesos ya existentes (Business Case, compra privada, compra pública).

El nombre de carpeta/módulo en el backend es `opportunities` (histórico), pero el producto y el frontend lo llaman **FamSheets**. Ver sección 9 para la distinción producción vs legacy.

Controller: `opportunities.controller.js` (thin, ~240 líneas). Service: `opportunities.service.js` (~950 líneas, toda la lógica de negocio y SQL raw).

## 2. Roles

Definidos directamente en `opportunities.routes.js` (no usan `ROLE_GROUPS.comercial` de `middlewares/roles.js`, son listas propias del módulo):

### OPPORTUNITY_READ_ROLES
```
comercial, asesor_comercial, analista_comercial, backoffice_comercial, acp_comercial,
jefe_comercial, gerencia, gerencia_general, director,
operaciones, jefe_operaciones, servicio_tecnico, jefe_tecnico
```

### OPPORTUNITY_WRITE_ROLES
```
comercial, asesor_comercial, analista_comercial, backoffice_comercial, acp_comercial,
jefe_comercial, gerencia, gerencia_general
```

Notas:
- `MANAGER_ROLES` (en `opportunities.service.js`, usado para decidir si el usuario ve todas las oportunidades o solo las propias) es un set aparte: `jefe_comercial, gerencia, gerencia_general, gerente_general, director, admin, administrador`. Incluye `admin/administrador/gerente_general`, que no están en `OPPORTUNITY_READ_ROLES` — en la práctica no importa porque `requireRole` deja pasar admin/administrador siempre (bypass global, ver `middlewares/roles.js`).
- En el frontend, `OpportunitiesPage.jsx` define su propio `managerRoles` (para decidir qué vista de dashboard mostrar) con: `jefe_comercial, gerencia, gerencia_general, director, admin, administrador` — **sin** `gerente_general`. Es una tercera lista, inconsistente con las dos del backend, pero solo afecta UI (qué panel se muestra), no seguridad.

## 3. Endpoints

Prefijo canónico (producción): `/api/v1/famsheets`
Prefijo alias legacy: `/api/v1/opportunities`

Ambos prefijos se montan sobre el **mismo router** (`opportunities.routes.js`) en `registerRoutes.js`:
```js
app.use("/api/v1/famsheets", opportunitiesRoutes);
app.use("/api/v1/opportunities", opportunitiesRoutes);
```
No es un redirect HTTP — es el mismo Express router montado dos veces. Ambos prefijos están 100% funcionales en el backend hoy.

| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/accounts` | `listAccounts` | READ |
| POST | `/accounts` | `createAccount` | WRITE |
| GET | `/contacts` | `listContacts` | READ |
| POST | `/contacts` | `createContact` | WRITE |
| GET | `/dashboard/manager` | `getManagerDashboard` | READ |
| GET | `/process-lookup/:type/:processId` | `lookupProcess` | READ |
| GET | `/` | `listOpportunities` | READ |
| POST | `/` | `createOpportunity` | WRITE |
| GET | `/:id` | `getOpportunity` | READ |
| PUT | `/:id` | `updateOpportunity` | WRITE |
| PUT | `/:id/rating` | `updateRating` | WRITE |
| POST | `/:id/influences` | `upsertInfluence` | WRITE |
| DELETE | `/:id/influences/:influenceId` | `deleteInfluence` | WRITE |
| POST | `/:id/flags` | `upsertFlag` | WRITE |
| DELETE | `/:id/flags/:flagId` | `deleteFlag` | WRITE |
| POST | `/:id/competitors` | `upsertCompetitor` | WRITE |
| DELETE | `/:id/competitors/:competitorId` | `deleteCompetitor` | WRITE |
| POST | `/:id/actions` | `upsertAction` | WRITE |
| DELETE | `/:id/actions/:actionId` | `deleteAction` | WRITE |
| POST | `/:id/comments` | `createComment` | WRITE |
| DELETE | `/:id/comments/:commentId` | `deleteComment` | WRITE |
| POST | `/:id/links` | `linkProcess` | WRITE |
| DELETE | `/:id/links/:linkId` | `unlinkProcess` | WRITE |

**Fix aplicado**: se agregó `PUT /:id/rating` (`updateRating` en controller/service) para atender la llamada que hace el frontend (`opportunitiesApi.js`, función `updateRating`, usada por `guardarCriterio` en `OpportunityWorkspace.jsx`). Los 5 criterios S/N/D (`tiene_presupuesto`, `tiene_acceso`, `entiende_proceso_compra`, `relacion_con_eb`, `tiene_coach`) se guardan como dato informativo en la nueva columna `opportunity_rating.manual_criteria` (JSONB, migración `283_opportunity_rating_manual_criteria.sql`) — **no** alteran `total_score`, que sigue siendo 100% calculado por `refreshRating()` a partir de señales reales. El endpoint guarda `manual_criteria` y dispara `refreshRating()` antes de devolver el detalle actualizado, para que el score que ve el usuario siga siendo el real.

## 4. Flujo principal

1. Se busca/crea una `account` (cuenta prospecto) y opcionalmente un `contact`.
2. Se crea la oportunidad (`POST /`) con `title` y `singular_objective` obligatorios → `funnel_stage` inicial `prospect`.
3. Se agregan influencias compradoras (`buying_influence`): rol (economic/technical/user/coach), nivel de influencia, modo de compra, y un índice `euphoria_panic` (1-10).
   - **Trigger DB automático**: si `euphoria_panic >= 7`, el trigger `trg_buying_influence_euphoria_red_flag` (función `bs_handle_euphoria_red_flag`, migración 189) inserta automáticamente una `opportunity_flag` de severidad `high` con título "Euforia/pánico alto" — esto ocurre **en la base de datos**, no en el service Node. Si se audita solo el código JS se puede pensar que no existe generación automática de banderas.
4. Se registran competidores con 5 scores (relationship/technical/price/service/evidence, 0-10 cada uno).
5. Se crean acciones de mitigación (`bs_action_item`), opcionalmente ligadas a una `opportunity_flag`; si tienen `assignee_user_id` disparan notificación (`bluesheet_action_assigned`).
6. Se dejan comentarios de coaching (`bs_comment`), con menciones (`mention_user_ids`) que disparan notificación (`bluesheet_comment_mention`).
7. Tras **cada** mutación de influencias/flags/competidores/acciones o de `singular_objective`, se recalcula `opportunity_rating` vía `refreshRating()`: 5 criterios booleanos (has_economic_buyer, has_coach, has_competition_strategy, has_red_flag_mitigation, has_clear_objective), cada uno vale 20 puntos → `total_score` es una columna `GENERATED ALWAYS` en Postgres (no se calcula en JS, se computa en la fila).
8. Toda mutación relevante (`create`, `update`, `link_process`, `unlink_process`) crea un `opportunity_snapshot` (histórico JSONB, tabla append-only, sin límite de retención visible en el service — se lee con `LIMIT 20` en el detalle).
9. Opcionalmente se vincula (`POST /:id/links`) un expediente existente: Business Case (`bc_master`), compra privada (`private_purchase_requests`) o compra pública (`equipment_purchase_requests`), vía `process_type` polimórfico. El lookup (`lookupProcessByTypeAndId`) valida contra `PROCESS_TYPE_TO_TABLE` y trae datos resumidos (cliente, título, monto/estado) para importar campos.
10. Sincronización CRM opcional: si `isCrmSyncEnabled()` (config `crmDb.js`) está activo, cada `create`/`update` de oportunidad encola un evento `crm.opportunity.sync` vía `enqueueIntegrationEvent` (outbox pattern, `integrationOutbox.service.js`). Falla silenciosamente (solo `logger.warn`) si el encolado falla — no bloquea la operación principal.

### Visibilidad de listado
`listOpportunities`: si el rol del actor está en `MANAGER_ROLES`, ve todas las oportunidades (o filtra por `ownerId` si se pasa); si no es manager, siempre ve solo las propias (`owner_id = actorId`), ignorando cualquier `ownerId` que mande en query — el filtro `mineOnly` es forzado a `true` para no-managers.

## 5. Base de datos

Migración de origen: `backend/migrations/189_bluesheet_foundation.sql` (toda la estructura del módulo llegó en una sola migración, "Smart Blue Sheet foundation").

**Tablas**:
- `accounts` — cuentas prospecto (UUID PK), opcionalmente ligada a `clients(id)` (INTEGER)
- `contacts` — contactos por cuenta
- `opportunity` — tabla principal (UUID PK), `owner_id INTEGER NOT NULL REFERENCES users(id)`
- `opportunity_rating` — 1:1 con `opportunity`, `total_score` es columna `GENERATED ALWAYS AS (...) STORED` (no editable directamente)
- `buying_influence` — influencias compradoras por oportunidad
- `red_flag_templates` / `opportunity_flag` — catálogo y banderas reales (banderas también se autogeneran, ver flujo)
- `competitor_catalog` / `competitor` — catálogo y competidores por oportunidad
- `action_templates` / `bs_action_item` — catálogo y acciones de mitigación (prefijo `bs_` = "blue sheet", no `opportunity_`)
- `opportunity_snapshot` — historial JSONB append-only
- `bs_comment` — comentarios/coaching, soporta hilos (`parent_comment_id`) y visibilidad `team`/`private`
- `opportunity_process_link` — vínculo polimórfico (`process_type` enum: `business_case`/`private_purchase`/`equipment_purchase`) con `UNIQUE(opportunity_id, process_type, process_id)`

**Enums** (prefijo `bs_`): `bs_funnel_stage_enum`, `bs_buying_role_enum`, `bs_buying_mode_enum`, `bs_influence_level_enum`, `bs_flag_severity_enum`, `bs_flag_status_enum`, `bs_action_status_enum`, `bs_competitive_position_enum`, `bs_comment_visibility_enum`, `bs_process_type_enum`.

**Trigger de negocio real**: `trg_buying_influence_euphoria_red_flag` → `bs_handle_euphoria_red_flag()`: autogenera `opportunity_flag` cuando `euphoria_panic >= 7`, con guardia `WHERE NOT EXISTS` para no duplicar la bandera automática.

**Nota**: es la única migración de todo el repo (299 archivos en `backend/migrations/`) que crea estas tablas — no hay migraciones incrementales posteriores para este módulo (a diferencia de business-case, que tiene decenas). Si `189_bluesheet_foundation.sql` no está aplicada en un ambiente, el módulo completo falla (confirmado en el CONTEXT.md anterior, sigue siendo cierto).

## 6. Relaciones con otros módulos
- `clients`: `accounts.client_id` — vínculo opcional cuenta prospecto → cliente ya convertido
- `users`: `owner_id`, `created_by`, `updated_by`, `assignee_user_id`, `author_user_id`, `mention_user_ids`
- `business-case` (`bc_master`): vínculo opcional vía `opportunity_process_link` con `process_type = 'business_case'`
- `private-purchases` (`private_purchase_requests`): idem con `process_type = 'private_purchase'`
- `equipment-purchases` (`equipment_purchase_requests`): idem con `process_type = 'equipment_purchase'`
- `notifications`: `notificationManager.sendNotification` para asignación de acciones (`bluesheet_action_assigned`) y menciones en comentarios (`bluesheet_comment_mention`)
- `integrations` (CRM externo): outbox `crm.opportunity.sync` vía `integrationOutbox.service.js`, condicionado a `isCrmSyncEnabled()` (`config/crmDb.js`)
- **`crm-fam`** (módulo distinto, NO confundir): `backend/src/modules/crm-fam/` reutiliza las mismas tablas (`buying_influence`, `opportunity_flag`, `bs_action_item`, `bs_comment`, etc.) desde su propio `crm.service.js`/`crm.calculators.js`. Es un módulo separado con sus propias rutas y su propio frontend (`spi_front/src/modules/crm-fam/`), pero opera sobre el mismo esquema de datos que FamSheets. Antes de tocar el esquema de estas tablas hay que revisar ambos módulos.

## 7. Frontend asociado

Ver sección 9 para el detalle de rutas producción vs legacy. Archivos:
- `spi_front/src/modules/comercial/pages/OpportunitiesPage.jsx` (408 líneas) — listado + creación rápida
- `spi_front/src/modules/comercial/pages/OpportunityWorkspace.jsx` (1304 líneas) — detalle/edición completa de una oportunidad (influencias, flags, competidores, acciones, comentarios, vínculos)
- `spi_front/src/modules/comercial/pages/FamSheetsDashboardPage.jsx` (284 líneas) — dashboard agregado (`/dashboard/manager`)
- `spi_front/src/modules/comercial/api/opportunitiesApi.js` — todas las funciones de fetch, `basePath = "/famsheets"` (hardcodeado, el frontend **nunca** llama al alias `/opportunities` del backend)

No existe carpeta `components/opportunities/` ni hooks dedicados — a diferencia de Business Case, todo FamSheets vive autocontenido en las 3 páginas de arriba (sin componentes compartidos en `components/workspace/`, que son exclusivos de Business Case).

## 8. Middlewares
Estándar del sistema: `verifyToken` (aplicado con `router.use`) → `requireRole(OPPORTUNITY_READ_ROLES | OPPORTUNITY_WRITE_ROLES)` por ruta. No usa `moduleAccessGuard` explícitamente en el router (se aplica más arriba en el pipeline global, ver `registerRoutes.js`/`CLAUDE.md`). No tiene middlewares de validación propios (a diferencia de business-case con `validateDeterminationEquipment` etc.) — todas las validaciones de payload (`title obligatorio`, `full_name y role obligatorios`, etc.) están inline en `opportunities.service.js`, lanzando `Error` con mensajes en español que el controller reinterpreta en `resolveBadRequestStatus` (busca substrings `"no encontrad"` → 404, `"obligatorio"`/`"soportado"` → 400, resto → 500).

## 9. Producción vs Legacy — IMPORTANTE

**"FamSheets" es el nombre y la URL de producción. "opportunities" es el nombre legacy que sobrevive en tres capas distintas, con distinto grado de actividad:**

1. **Backend — carpeta de módulo y nombre de tablas**: `backend/src/modules/opportunities/` y tablas `opportunity`, `opportunity_flag`, etc. Esto es cosmético/histórico, no se puede considerar "muerto" porque es el código real en uso — simplemente el naming quedó desactualizado respecto al producto.

2. **Backend — prefijo de ruta `/api/v1/opportunities`**: sigue montado y 100% funcional (mismo router que `/api/v1/famsheets`), pero **ningún código de frontend lo llama** (`opportunitiesApi.js` usa `/famsheets` exclusivamente). Es alias muerto desde la perspectiva de tráfico real, vivo desde la perspectiva de compatibilidad con integraciones externas o clientes API antiguos que pudieran seguir apuntando ahí.

3. **Frontend — rutas de React Router** (`spi_front/src/routes/AppRoutes.jsx`, líneas 329-333):
   ```jsx
   <Route path="/dashboard/comercial/famsheets" element={<OpportunitiesPage />} />
   <Route path="/dashboard/comercial/famsheets/dashboard" element={<FamSheetsDashboardPage />} />
   <Route path="/dashboard/comercial/famsheets/:id" element={<OpportunityWorkspace />} />
   <Route path="/dashboard/comercial/opportunities" element={<Navigate to="/dashboard/comercial/famsheets" replace />} />
   <Route path="/dashboard/comercial/opportunities/:id" element={<OpportunityWorkspace />} />
   ```
   - `/dashboard/comercial/famsheets*` son las rutas de producción.
   - `/dashboard/comercial/opportunities` (sin `:id`, el listado) sí redirige con `<Navigate replace>` a `/famsheets`.
   - **`/dashboard/comercial/opportunities/:id` (con id) NO redirige** — resuelve directo a `OpportunityWorkspace`, el mismo componente que `/famsheets/:id`. Es decir, un link viejo a una oportunidad específica bajo `/opportunities/123` sigue funcionando sin redirect visible en la URL (el usuario se queda navegando bajo `/opportunities/...`), mientras que entrar al listado bajo `/opportunities` sí lo manda a `/famsheets`. Inconsistencia real: la migración de URLs quedó a medias — el listado emigró, el detalle no.

4. **No confundir con `spi_front/src/modules/crm-fam/pages/OpportunitiesPage.jsx`**: existe un archivo con el mismo nombre `OpportunitiesPage.jsx` pero en el módulo `crm-fam` (montado en `/dashboard/crm-fam/opportunities`), que es una vista de solo lectura del CRM externo sincronizado — no tiene relación de código con `comercial/pages/OpportunitiesPage.jsx` aunque comparta tablas de base de datos (ver sección 6).

## 10. Riesgos y notas técnicas
- **Bug corregido**: `OpportunityWorkspace.jsx` (función `guardarCriterio`, línea ~408) llama `updateRating(id, nueva)` → `PUT /famsheets/:id/rating`. Antes, esa ruta no existía y la llamada fallaba con 404. Ahora existe (`updateOpportunityRating` en el service) y persiste los 5 criterios en `opportunity_rating.manual_criteria` (JSONB, migración 283) sin tocar `total_score`, que sigue viniendo 100% de `refreshRating()` (datos reales: influencias, coach, competidores, flags, objetivo). **Requiere aplicar manualmente la migración `283_opportunity_rating_manual_criteria.sql` en el ambiente** (no hay runner automático) antes de que el endpoint funcione — sin esa columna el `INSERT ... manual_criteria` fallará.
- Tres listas de roles distintas y no sincronizadas conviven en este módulo: `OPPORTUNITY_READ_ROLES`/`OPPORTUNITY_WRITE_ROLES` (routes), `MANAGER_ROLES` (service), `managerRoles` (frontend `OpportunitiesPage.jsx`). Ninguna reutiliza `ROLE_GROUPS.comercial` de `middlewares/roles.js`. Si se agrega un rol comercial nuevo al grupo central, este módulo no lo hereda automáticamente — hay que tocar las 3 listas a mano.
- `opportunity_rating.total_score` es una columna generada por Postgres (`GENERATED ALWAYS AS ... STORED`); no se puede hacer `UPDATE` directo sobre ella ni calcularla en JS. El endpoint `/rating` respeta esto: solo escribe `manual_criteria` y dispara `refreshRating()`.
- El trigger de auto-generación de banderas por euforia/pánico vive en SQL (`bs_handle_euphoria_red_flag`), invisible si solo se audita `opportunities.service.js`.
- **Bug corregido**: `deleteComment` ahora recibe `actorUser` (controller pasa `req.user`) y valida ownership — solo el autor (`author_user_id === actor.id`) o un rol de `MANAGER_ROLES` puede borrar un comentario ajeno; de lo contrario lanza error (→ 403 vía `resolveBadRequestStatus`, que ahora mapea mensajes con "permiso"/"autoriz" a 403).
- `linkProcess` calcula un `patch.title` a partir del expediente vinculado pero nunca lo aplica (variable `patch` se construye y se descarta, no hay `UPDATE` con ella) — código muerto dentro del método.
- Todas las tablas del módulo llegaron en una sola migración (189); no hay migraciones incrementales posteriores como en business-case, así que cualquier cambio de esquema futuro debería crear una migración nueva, no editar la 189 (que ya pudo estar aplicada en producción).
- No hay tests dedicados (`__tests__/`) para este módulo, a diferencia de business-case.
