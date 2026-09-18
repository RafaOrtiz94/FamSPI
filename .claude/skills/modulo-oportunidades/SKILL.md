---
name: modulo-oportunidades
description: Mapa real del módulo comercial FamSheets (nombre de producto) / opportunities (nombre de carpeta backend) — dónde vive cada endpoint, qué tablas usa, qué es producción vs qué es alias/código legacy, y qué está realmente roto. Úsalo antes de tocar OpportunitiesPage.jsx, OpportunityWorkspace.jsx, FamSheetsDashboardPage.jsx o cualquier archivo bajo backend/src/modules/opportunities/ — el naming "opportunities" en el código no corresponde a las URLs "famsheets" que usa el producto, y hay un endpoint que el frontend llama pero el backend nunca definió.
---

# Skill: Módulo Oportunidades / FamSheets — FamSPI

Antes de tocar este módulo, lee esto. El problema real más común: el nombre del código (`opportunities`) y el nombre del producto (`FamSheets`) NO coinciden, y hay tres capas (backend routes, backend module folder, frontend routes) donde ambos nombres conviven con distinto grado de "vivo" vs "legacy". Confundir cuál es cuál lleva a editar el alias equivocado o a asumir que algo está muerto cuando en realidad sigue sirviendo tráfico.

Documentación completa (endpoints, roles, tablas, flujo): `backend/src/modules/opportunities/CONTEXT.md`. Este skill es el resumen operativo — para el detalle línea por línea de cada endpoint, léelo.

---

## Mapa de archivos

**Backend** — `backend/src/modules/opportunities/`
- `opportunities.routes.js` — roles por endpoint (dos listas propias del módulo, `OPPORTUNITY_READ_ROLES`/`OPPORTUNITY_WRITE_ROLES`, no vienen de `ROLE_GROUPS.comercial`)
- `opportunities.controller.js` — thin, ~240 líneas, solo despacha a service y mapea errores
- `opportunities.service.js` — ~950 líneas, toda la lógica y SQL raw (`db.query` directo, sin ORM)

**Frontend** — `spi_front/src/modules/comercial/`
- `pages/OpportunitiesPage.jsx` (408 líneas) — listado + alta rápida
- `pages/OpportunityWorkspace.jsx` (1304 líneas) — el archivo grande, toda la edición: influencias, flags, competidores, acciones, comentarios, vínculos, valoración
- `pages/FamSheetsDashboardPage.jsx` (284 líneas) — dashboard agregado
- `api/opportunitiesApi.js` — único archivo de fetch, `basePath = "/famsheets"` hardcodeado

**No hay** `components/opportunities/` ni hooks dedicados. A diferencia de Business Case, FamSheets no comparte componentes de workspace (`components/workspace/*` es exclusivo de BC) — todo vive autocontenido en las 3 páginas de arriba.

---

## Producción vs Legacy (la parte que confunde)

Tres capas, tres estados distintos de "legacy":

1. **Nombre del módulo backend** (`opportunities`, tablas `opportunity`/`opportunity_flag`/etc.): cosmético/histórico. Es el código real y activo, solo el nombre quedó desactualizado frente al producto. No tocar el naming sin necesidad — renombrar la carpeta ahora sería puro churn.

2. **Prefijo de ruta backend**: `registerRoutes.js` monta el **mismo router** dos veces:
   ```js
   app.use("/api/v1/famsheets", opportunitiesRoutes);
   app.use("/api/v1/opportunities", opportunitiesRoutes);
   ```
   Ambos prefijos responden igual, hoy. Pero ningún código de frontend llama a `/opportunities` — `opportunitiesApi.js` usa `/famsheets` exclusivamente. El prefijo `/opportunities` en el backend es tráfico cero desde la app, vivo solo por si alguna integración externa vieja aún apunta ahí.

3. **Rutas de frontend** (`spi_front/src/routes/AppRoutes.jsx`, ~línea 329):
   ```jsx
   <Route path="/dashboard/comercial/famsheets" element={<OpportunitiesPage />} />
   <Route path="/dashboard/comercial/famsheets/dashboard" element={<FamSheetsDashboardPage />} />
   <Route path="/dashboard/comercial/famsheets/:id" element={<OpportunityWorkspace />} />
   <Route path="/dashboard/comercial/opportunities" element={<Navigate to="/dashboard/comercial/famsheets" replace />} />
   <Route path="/dashboard/comercial/opportunities/:id" element={<OpportunityWorkspace />} />
   ```
   `/famsheets*` es producción. El listado legacy (`/opportunities` sin id) sí redirige. **Pero `/opportunities/:id` (con id) NO redirige** — resuelve directo al mismo `OpportunityWorkspace`, sin cambiar la URL visible. La migración de rutas quedó a medias: el listado emigró, el detalle no. Si alguna vez terminas esa migración, hay que agregar el redirect que falta en esa línea también.

**No confundir con** `spi_front/src/modules/crm-fam/pages/OpportunitiesPage.jsx` — mismo nombre de archivo, módulo totalmente distinto (`/dashboard/crm-fam/opportunities`, vista de solo lectura de un CRM externo sincronizado). Comparte tablas de base de datos con FamSheets (`buying_influence`, `opportunity_flag`, `bs_action_item`, `bs_comment` — ver `backend/src/modules/crm-fam/crm.service.js`) pero no comparte código. Si buscas "OpportunitiesPage" con grep vas a encontrar dos archivos — confirma el import path (`comercial/pages` vs `crm-fam/pages`) antes de editar.

---

## Roles: quién puede qué

Tres listas de roles, ninguna reutiliza `ROLE_GROUPS.comercial` de `backend/src/middlewares/roles.js` ni está sincronizada entre sí:

- **`OPPORTUNITY_READ_ROLES`** (routes) — puede ver: comercial, asesor_comercial, analista_comercial, backoffice_comercial, acp_comercial, jefe_comercial, gerencia, gerencia_general, director, operaciones, jefe_operaciones, servicio_tecnico, jefe_tecnico.
- **`OPPORTUNITY_WRITE_ROLES`** (routes) — puede crear/editar: el subconjunto comercial puro (sin operaciones/servicio_tecnico): comercial, asesor_comercial, analista_comercial, backoffice_comercial, acp_comercial, jefe_comercial, gerencia, gerencia_general.
- **`MANAGER_ROLES`** (service, decide si el usuario ve TODAS las oportunidades o solo las propias): jefe_comercial, gerencia, gerencia_general, gerente_general, director, admin, administrador.
- **`managerRoles`** (frontend `OpportunitiesPage.jsx`, decide qué panel de dashboard mostrar): jefe_comercial, gerencia, gerencia_general, director, admin, administrador — sin `gerente_general`.

Si vas a agregar un rol nuevo al grupo comercial central (`ROLE_GROUPS.comercial` en `middlewares/roles.js`), este módulo NO lo hereda — hay que tocarlo a mano en las 3 listas.

Ver también sección "Riesgos" de `CONTEXT.md` para dos huecos de autorización: `deleteComment` no valida `author_user_id` (cualquiera con rol WRITE puede borrar comentarios ajenos), y `linkProcess` calcula un `patch.title` que nunca se aplica (variable construida y descartada).

---

## Tablas (todas de una sola migración)

`backend/migrations/189_bluesheet_foundation.sql` — es la ÚNICA migración de las ~299 del repo que toca este módulo. No hay migraciones incrementales posteriores (a diferencia de business-case, que tiene decenas). Si se necesita un cambio de esquema, crear una migración nueva — no editar la 189, que ya puede estar aplicada en producción.

Tablas: `accounts`, `contacts`, `opportunity` (tabla principal, UUID PK), `opportunity_rating` (1:1, `total_score` es columna `GENERATED ALWAYS ... STORED`, no editable por UPDATE), `buying_influence`, `red_flag_templates` + `opportunity_flag`, `competitor_catalog` + `competitor`, `action_templates` + `bs_action_item` (prefijo `bs_` = "blue sheet"), `opportunity_snapshot` (historial JSONB append-only), `bs_comment` (hilos + visibilidad team/private), `opportunity_process_link` (vínculo polimórfico a `bc_master`/`private_purchase_requests`/`equipment_purchase_requests`).

**Trigger de negocio en SQL, no en JS**: `trg_buying_influence_euphoria_red_flag` → función `bs_handle_euphoria_red_flag()` — si `euphoria_panic >= 7` en una influencia compradora, se autogenera una `opportunity_flag` severidad `high` con guardia `WHERE NOT EXISTS` para no duplicar. Si auditas solo `opportunities.service.js` esta generación automática de banderas es invisible; está en la migración 189, no en el código Node.

---

## El bug real que vas a encontrar si tocas la valoración manual

`OpportunityWorkspace.jsx`, función `guardarCriterio` (~línea 408): al marcar cualquier criterio S/N/D de la valoración, llama `updateRating(id, nueva)` → `PUT /famsheets/:id/rating`. **Esa ruta no existe** en `opportunities.routes.js` — no hay `router.put("/:id/rating", ...)`. La función hace update optimista, la llamada falla, revierte el estado y muestra "No se pudo actualizar la valoración." El control está roto de punta a punta en producción hoy.

El rating real (`opportunity_rating.total_score`) sí se actualiza, pero solo automáticamente vía `refreshRating()` en el backend — recalculado desde datos reales (hay coach entre las influencias, hay estrategia de competencia, banderas críticas mitigadas, objetivo claro) cada vez que se toca una influencia/flag/competidor/acción/objetivo. No hay endpoint para setear el criterio a mano; si vas a arreglar el botón, la corrección correcta es togglear el dato real que alimenta `refreshRating()`, no exponer un endpoint que escriba directo sobre `total_score` — esa columna es `GENERATED ALWAYS`, Postgres rechazaría el UPDATE.

---

## Checklist antes de tocar algo aquí

1. ¿Vas a agregar/cambiar un endpoint? → edítalo solo en `opportunities.routes.js`/`.controller.js`/`.service.js`; ambos prefijos (`/famsheets`, `/opportunities`) lo heredan automáticamente porque comparten router.
2. ¿Vas a cambiar quién puede ver/editar? → actualiza las 3 listas de roles (routes READ/WRITE, service MANAGER_ROLES, frontend managerRoles) si el cambio debe ser consistente en toda la experiencia.
3. ¿Vas a tocar el esquema? → migración nueva, nunca edites `189_bluesheet_foundation.sql`.
4. ¿Vas a arreglar la valoración manual rota? → no reintroduzcas un endpoint que escriba `total_score` directo (es columna generada); haz que el toggle manual dispare el dato real correspondiente y deje que `refreshRating()` recalcule.
5. ¿Buscaste "OpportunitiesPage" con grep? → confirma si el resultado es `comercial/pages` (FamSheets real) o `crm-fam/pages` (CRM externo, módulo distinto).
