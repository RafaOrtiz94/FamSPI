# CONTEXT.md — work-management

## 1. Descripción

Módulo de gestión de trabajo estilo monday.com (workspaces → proyectos → tableros → grupos → items), integrado al SPI y con un puente de creación hacia oportunidades de **CRM-Fam** (`crm.crm_opportunities`). No reemplaza cronogramas (`schedules`) ni CRM-Fam — es un módulo nuevo y separado.

**No confundir con los documentos de la raíz del repo** `Requerimientos_CRM_Work_Management_SPI.md` (URS v0.1, "Propuesta para revisión", fecha 2026-07-13) y `PLAN_CRM_WORK_MANAGEMENT_SPI.md`: describen una visión completa y ambiciosa (sprints, backlog ágil, Gantt, automatizaciones configurables, outbox de integración con SPI, plantillas versionadas, registro de tiempo, WIP limits, etc.). **Nada de eso está construido todavía.** Lo que existe hoy en producción es un MVP más acotado: workspaces, proyectos, un único tipo de tablero (vista tabla/board), grupos, items con checklist/comentarios/adjuntos/asignados/apoyo, reordenamiento drag-and-drop, "Mi trabajo" y un resumen de portafolio. Antes de prometer o asumir una funcionalidad de esos documentos, verificar contra `workManagement.service.js` — es muy probable que todavía no exista.

Backend: `workManagement.routes.js` (thin, solo `verifyToken` — sin `requireRole` por endpoint) → `workManagement.controller.js` (thin) → `workManagement.service.js` (~2450 líneas, toda la lógica de negocio y SQL raw).

## 2. Control de acceso — NO usa `requireRole` por ruta

A diferencia de casi todos los demás módulos del backend, `workManagement.routes.js` no declara ningún array de roles ni usa `requireRole`. El único middleware de ruta es `verifyToken`. Hay dos capas reales de control:

1. **Gate de módulo (nivel app, no del router):** `moduleAccessGuard` se aplica globalmente en `app.js` (`verifyToken → normalizeApiPayloads → moduleAccessGuard → auditMiddleware → mountPrivateRoutes`), antes de que la request llegue a cualquier router. Compara el header `x-app-path` que manda el frontend contra `module_access[]` del usuario. El módulo está registrado en `moduleAccess.service.js` como `{ key: "work_management", path_prefixes: ["/dashboard/work-management"] }` — un usuario sin ese `module_access` concedido no puede usar el módulo aunque tenga sesión válida. La concesión se administra en `TIModuleAccessPage.jsx` (frontend TI).
2. **Autorización fina, dentro del servicio, por membresía/propiedad:** `assertWorkspaceAccess`, `assertProjectAccess`, `assertBoardAccess`, `assertGroupAccess`, `assertItemAccess` (todas en `workManagement.service.js`) verifican que el `userId` sea owner o miembro activo del workspace/proyecto correspondiente — **no hay chequeo de rol de negocio** (comercial/técnico/etc.) dentro del módulo, solo pertenencia. `isManager(user)` es un set de roles hardcodeado (`jefe_ti`, `jefe_de_ti`, `admin`, `administrador`, `gerencia`, `gerencia_general`, `gerente_general`, `director`, `gerente`, `jefe_comercial`) que da bypass de pertenencia: ve todos los workspaces/proyectos/portafolio sin necesitar membresía.

Esto es intencional para esta fase (documentado como riesgo conocido): no hay RBAC por área/rol de negocio dentro del módulo, solo `module_access` (¿puede entrar?) + membresía/`isManager` (¿qué ve?).

## 3. Endpoints

Prefijo: `/api/v1/work-management`. Todos requieren JWT (`verifyToken`) + `module_access` de `work_management` (ver §2). Ninguno tiene restricción de rol adicional a nivel de ruta.

### Global / Mi trabajo / Portafolio
| Método | Ruta | Handler |
|---|---|---|
| GET | `/health` | `getHealth` |
| GET | `/my-work` | `listMyWork` |
| GET | `/portfolio-summary` | `getPortfolioSummary` (scope completo si `isManager`, si no solo proyectos propios/membresía) |
| GET | `/collaborators` | `listCollaborators` (usuarios activos del SPI para seleccionar participantes) |

### Workspaces
| Método | Ruta | Handler |
|---|---|---|
| GET | `/workspaces` | `listWorkspaces` (solo donde el usuario es owner o miembro activo) |
| POST | `/workspaces` | `createWorkspace` (acepta `member_user_ids[]`; el creador queda `owner`, el resto `member`) |
| PATCH | `/workspaces/:workspaceId` | `updateWorkspace` |
| GET | `/workspaces/:workspaceId/members` | `listWorkspaceMembers` |
| POST | `/workspaces/:workspaceId/members` | `addWorkspaceMember` |
| DELETE | `/workspaces/:workspaceId/members/:memberUserId` | `removeWorkspaceMember` |
| DELETE | `/workspaces/:workspaceId` | `deleteWorkspace` |

### Proyectos
| Método | Ruta | Handler |
|---|---|---|
| GET | `/workspaces/:workspaceId/projects` | `listProjectsByWorkspace` |
| POST | `/workspaces/:workspaceId/projects` | `createProject` |
| POST | `/projects/from-opportunity/:opportunityId` | `createProjectFromOpportunity` (puente con CRM-Fam, ver §6) |
| GET | `/projects/:projectId` | `getProject` |
| DELETE | `/projects/:projectId` | `deleteProject` |
| GET | `/projects/:projectId/boards` | `listBoardsByProject` |
| GET | `/projects/:projectId/items` | `listItemsByProject` |
| GET | `/projects/:projectId/assignee-options` | `listAssigneeOptions` (limitado a miembros activos del workspace) |
| POST | `/projects/:projectId/boards` | `createBoard` |

### Boards / grupos / items
| Método | Ruta | Handler |
|---|---|---|
| POST | `/boards/:boardId/groups` | `createGroup` |
| POST | `/groups/:groupId/items` | `createItem` |
| PATCH | `/items/:itemId` | `updateItem` |
| PUT | `/items/:itemId/assignees` | `updateItemAssignees` (valida que pertenezcan al workspace) |
| PUT | `/items/:itemId/supporters` | `updateItemSupporters` (usuarios activos globales del SPI, sin restricción de workspace) |
| POST | `/items/:itemId/comments` | `createItemComment` |
| POST | `/items/:itemId/checklist-items` | `createChecklistItem` |
| PATCH | `/checklist-items/:checklistItemId` | `updateChecklistItem` |
| DELETE | `/checklist-items/:checklistItemId` | `deleteChecklistItem` |
| POST | `/items/:itemId/attachments` | `uploadItemAttachment` (multipart, campo `file`, sube a Drive) |
| POST | `/items/:itemId/reorder` | `reorderItem` |
| DELETE | `/items/:itemId` | `deleteItem` |

## 4. Flujo principal

1. Un usuario crea un **workspace** (`POST /workspaces`), opcionalmente invitando colaboradores (`member_user_ids`) — quedan como `member` activo en `work_management.workspace_members`; el creador queda `owner`.
2. Dentro del workspace crea uno o más **proyectos** (`POST /workspaces/:workspaceId/projects`). `createDefaultBoard` + `insertDefaultGroups` generan automáticamente un tablero "General" con grupos por defecto al crear el proyecto.
3. Alternativamente, un proyecto se origina desde una **oportunidad de CRM-Fam** (`POST /projects/from-opportunity/:opportunityId`, ver §6) — no duplica datos de la oportunidad, solo guarda `origin_entity_type='opportunity'`, `origin_entity_id`, `crm_account_id`, `crm_opportunity_id` y reutiliza nombre/descripción/fecha de cierre estimada. Antes de crear, verifica si ya existe un proyecto originado por esa misma oportunidad (evita duplicados).
4. Dentro de un board, se crean **grupos** (`board_groups`) y dentro de cada grupo, **items** (`POST /groups/:groupId/items`) — tareas con responsable principal (`item_assignees`), apoyo/seguidores (`followers`), checklist (`checklists`/`checklist_items`, se crea un checklist por defecto al primer uso), comentarios/actualizaciones (`comments`) y adjuntos a Drive (`attachments`).
5. Cada cambio de checklist recalcula `items.completion_pct` (`recalculateChecklistProgress`).
6. Los items se pueden **reordenar** (`POST /items/:itemId/reorder`) dentro del mismo grupo o moviéndolos a otro, reescribiendo `sort_order` de forma transaccional (`rewriteItemSortOrders`).
7. Toda mutación relevante queda en `work_management.work_activity_log` vía `logActivity` (no confundir con el `comments` de "actualizaciones" del usuario — son dos bitácoras distintas: una es de negocio/usuario, otra es de sistema).
8. Si el proyecto del item tiene `crm_opportunity_id`/`crm_account_id`, crear/editar/borrar el item además dispara `syncCrmActivityForItem` hacia `crm.crm_activities` (ver §6) — no confundir con `items.source_module`/`source_entity_type` (§ tabla de columnas más abajo), que es el mecanismo de origen **entrante** (de dónde vino el item), mientras que esto es el enlace de **salida** (a qué actividad CRM se refleja).

## 5. Base de datos — riesgo importante: sin migración numerada

**No existe ningún archivo en `backend/migrations/` que cree el schema `work_management` base ni la mayoría de sus tablas.** Las tablas (`workspaces`, `workspace_members`, `projects`, `project_members`, `boards`, `board_groups`, `items`, `item_assignees`, `followers`, `checklists`, `checklist_items`, `comments`, `attachments`, `work_activity_log`, entre otras referenciadas en `workManagement.service.js`) existen directamente en Neon, aparentemente creadas fuera del flujo de migraciones versionadas del repo. **Antes de tocar cualquier columna nueva o de aprovisionar un ambiente nuevo, confirmar el esquema real contra Neon (`information_schema`) — no asumir que `backend/migrations/` es la fuente completa de verdad para este módulo**, a diferencia del resto del sistema.

`backend/migrations/298_work_management_crm_activity_sync.sql` es la **primera** migración versionada que toca este schema (agrega `items.crm_activity_id`, aditivo/nullable) — no reconstruye el resto del esquema, solo ese incremento puntual. No asumir que aplicar las migraciones del repo desde cero en un ambiente nuevo reproduce `work_management` completo.

Relaciones externas verificadas (documentadas ya antes de esta actualización, siguen vigentes):
- `public.users(id)`
- `crm.crm_accounts(id)`, `crm.crm_opportunities(id)`
- `public.visit_schedules(id)`, `public.scheduled_visits(id)` (reservadas para integraciones futuras; no hay código que las use todavía en este módulo)

## 6. Puente real con CRM-Fam

`createProjectFromOpportunity(opportunityId, payload, user)` (`workManagement.service.js:1185`) es el enlace de **entrada** entre Work Management y CRM-Fam:
- Lee la oportunidad desde `crm.crm_opportunities` (cross-schema).
- Exige que el usuario sea `isManager` o el `owner_user_id` de la oportunidad — si no, 403.
- Chequea duplicados por `crm_opportunity_id` antes de crear.
- El proyecto nuevo hereda `crm_account_id`, `crm_opportunity_id`, `due_date` (de `estimated_close_date` si no se pasa una propia) y arma nombre/descripción por defecto a partir de la oportunidad.

Además, `syncCrmActivityForItem(client, { item, project, action, actorUserId })` (`workManagement.service.js`, junto a `logActivity`/`addLink`) es el enlace de **salida**: cuando un item se crea (`createItem`), se le cambia título/estado/fecha límite (`updateItem`) o se elimina (`deleteItem`), y su **proyecto** tiene `crm_opportunity_id` o `crm_account_id`, se crea/actualiza una fila en `crm.crm_activities` (`activity_type='tarea'`, `source_module='work_management'`), guardando el vínculo en `items.crm_activity_id` (mismo patrón que `scheduled_visits.crm_activity_id` en `schedules.service.js`) para no duplicar en ediciones siguientes. Borrar el item hace soft-delete de la actividad (`deleted_at = now()`), no `DELETE` físico. Si el proyecto no tiene vínculo CRM, es un no-op silencioso — no se inventa una relación. La sincronización nunca bloquea la operación de Work Management: cualquier fallo queda en `logger.warn` (ver migración `298_work_management_crm_activity_sync.sql`, que agrega `crm.crm_activities.source_module` e `items.crm_activity_id`).

- **Sigue sin ser bidireccional en el otro sentido**: un cambio de etapa/estado hecho directamente sobre la oportunidad en CRM-Fam no actualiza nada en Work Management. El puente equivalente en sentido CRM→BC/Compras (`crmPurchaseSync.service.js`, ver `backend/src/modules/crm-fam/CONTEXT.md` §2) es un módulo totalmente distinto y no toca `work_management`.
- No hay todavía outbox/eventos/idempotencia con SPI (`INT-SPI-*` del URS) — toda la integración real hoy son llamadas síncronas directas (lectura+creación de proyecto, y upsert/soft-delete de actividad por item).

## 7. Frontend

`spi_front/src/modules/work-management/pages/WorkManagementPage.jsx` — **un único archivo monolítico de ~160 KB / ~4000+ líneas**, sin descomponer en subcomponentes (a diferencia de Business Case, que sí separa por `components/workspace/sections/`). Cualquier cambio aquí es más riesgoso de aislar y más lento de ubicar — usar `grep` por nombre de función/handler antes de leer el archivo completo.

Solo existen **3 vistas** (`VIEW_OPTIONS`, línea ~102): `board` (tabla/grid, la vista real), `my_work` ("Mi trabajo") y `overview` ("Resumen"). No hay Kanban, calendario ni Gantt renderizados, pese a que la URS los pide y a que el formulario de creación de tablero (`boardForm.board_type`) ofrece **"kanban"/"calendar" como opciones seleccionables y persiste el valor en `boards.board_type`** — pero ninguna vista del frontend lee ese campo para cambiar el render. **Es un hallazgo de esta auditoría, no confirmado como bug reportado por el usuario todavía**: el selector de tipo de tablero es efectivamente cosmético hoy — cualquier tablero, sin importar `board_type`, se renderiza igual (vista `board`/tabla). Si se va a "corregir" esto, decidir primero si el objetivo es implementar Kanban/Calendario real o quitar el selector.

Ruta montada: `/dashboard/work-management` (`AppRoutes.jsx`), protegida además por el gate de `module_access` (ver §2) vía `isPathEnabledForUser` en `spi_front/src/core/auth/moduleAccess.js`. Entrada en `NavigationBar.jsx`.

API client: `spi_front/src/core/api/workManagementApi.js` (6.4 KB — mucho más delgado que la página; cliente delgado, no concentra lógica).

## 8. Tests

`backend/src/modules/work-management/__tests__/`: `workManagement.helpers.test.js`, `workManagement.createItem.test.js`, `workManagement.updateItemSupporters.test.js`, `workManagement.portfolio.test.js`, `workManagement.workspaceManagerAccess.test.js`, `workManagement.crmActivitySync.test.js` (cubre `syncCrmActivityForItem` vía `createItem`/`updateItem`/`deleteItem`, incluido el caso de fallo silencioso). Cobertura parcial — no hay tests para `createProjectFromOpportunity`, checklist, comments, attachments ni reorder.

## 9. Riesgos y notas técnicas

- **El `CONTEXT.md` anterior de este módulo estaba desactualizado respecto al código**: listaba una fase inicial sin invitaciones a workspace más allá de la creación, sin gestión de miembros (`GET/POST/DELETE .../members`), sin `DELETE` de workspace/proyecto/item y sin mencionar `POST /projects/from-opportunity/:opportunityId` — las cinco cosas ya existen y están montadas en `workManagement.routes.js`. Aplica la misma lección que en `crm-fam`: verificar el código antes de repetir afirmaciones de un CONTEXT.md viejo.
- **Sin migración de base de datos versionada para el grueso del schema** (ver §5) — riesgo real para reproducir el ambiente o auditar cambios; la migración `298` es la primera excepción puntual, no una reconstrucción completa.
- **No hay RBAC de rol de negocio dentro del módulo** (ver §2) — cualquier usuario con `module_access` de `work_management` y membresía puede operar sobre "su" workspace/proyecto sin importar su rol (comercial, técnico, TI, etc.). El único filtro de rol es `isManager` para ver todo.
- **`board_type` es un campo persistido pero sin efecto visual** (ver §7) — confirmado en código, no en documentación de terceros.
- **Gran distancia entre la URS/plan de la raíz del repo y el código real**: sprints, backlog ágil, historias de usuario, Gantt, calendario, automatizaciones, registro de tiempo, WIP limits, plantillas versionadas y el outbox de integración con SPI (`INT-SPI-*`) están descritos en detalle en `Requerimientos_CRM_Work_Management_SPI.md` pero **no implementados**. Tratar esos documentos como backlog/visión, no como documentación del estado actual.
- `followers`/"Apoyo" no está restringido a miembros del workspace (a diferencia de `item_assignees`/"Responsable", que sí valida pertenencia en `assertWorkspaceAssigneeIds`) — es asimétrico a propósito según el código, pero vale confirmarlo como decisión de producto antes de "corregirlo" como si fuera inconsistencia.
