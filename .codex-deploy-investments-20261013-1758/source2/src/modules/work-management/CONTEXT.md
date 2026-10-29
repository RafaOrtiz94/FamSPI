# Work Management

## Estado actual verificado

- `backend/src/modules/work-management/` no existia antes de esta fase.
- Neon no tenia schema `work_management`.
- CRM-FAM ya existe en schema `crm` y se reutiliza como fuente relacional para:
  - `crm.crm_accounts`
  - `crm.crm_opportunities`
- Planificacion comercial ya existe en `public.visit_schedules` y `public.scheduled_visits`.
- El registro global de rutas privadas vive en `backend/src/routes/registerRoutes.js`.

## Objetivo de esta fase

Crear la base tecnica para un modulo nuevo de gestion de trabajo, sin reemplazar CRM-FAM ni cronogramas existentes.

Esta fase habilita:

- workspaces
- proyectos
- boards
- grupos
- items
- asignaciones
- trazabilidad basica
- enlaces hacia entidades SPI/CRM ya existentes

## Fuente de verdad DB

- Schema nuevo: `work_management`
- Relaciones externas verificadas:
  - `public.users(id)`
  - `crm.crm_accounts(id)`
  - `crm.crm_opportunities(id)`
  - `public.visit_schedules(id)`
  - `public.scheduled_visits(id)`

## Rutas implementadas en esta fase

- `GET /api/v1/work-management/health`
- `GET /api/v1/work-management/my-work`
- `GET /api/v1/work-management/portfolio-summary`
- `GET /api/v1/work-management/collaborators`
- `GET /api/v1/work-management/workspaces`
- `POST /api/v1/work-management/workspaces`
- `GET /api/v1/work-management/workspaces/:workspaceId/projects`
- `POST /api/v1/work-management/workspaces/:workspaceId/projects`
- `GET /api/v1/work-management/projects/:projectId`
- `GET /api/v1/work-management/projects/:projectId/boards`
- `GET /api/v1/work-management/projects/:projectId/items`
- `GET /api/v1/work-management/projects/:projectId/assignee-options`
- `POST /api/v1/work-management/projects/:projectId/boards`
- `POST /api/v1/work-management/boards/:boardId/groups`
- `POST /api/v1/work-management/groups/:groupId/items`
- `PATCH /api/v1/work-management/items/:itemId`
- `PUT /api/v1/work-management/items/:itemId/assignees`
- `PUT /api/v1/work-management/items/:itemId/supporters`
- `POST /api/v1/work-management/items/:itemId/comments`
- `POST /api/v1/work-management/items/:itemId/checklist-items`
- `PATCH /api/v1/work-management/checklist-items/:checklistItemId`
- `DELETE /api/v1/work-management/checklist-items/:checklistItemId`
- `POST /api/v1/work-management/items/:itemId/attachments`
- `POST /api/v1/work-management/items/:itemId/reorder`

## Invitaciones a workspace

- `POST /workspaces` acepta `member_user_ids: number[]`.
- El creador queda como `owner` en `workspace_members`.
- Los colaboradores seleccionados quedan como `member` activo en `workspace_members`.
- `GET /workspaces` solo lista workspaces donde el usuario es propietario o miembro activo.
- `GET /collaborators` devuelve usuarios activos mínimos para seleccionar participantes dentro del módulo.

## Tabla operativa

- `Responsable` usa `work_management.item_assignees`.
- Las opciones de responsable salen de `GET /projects/:projectId/assignee-options` y quedan limitadas a propietario/miembros activos del workspace.
- Backend valida en `createItem` y `updateItemAssignees` que los responsables pertenezcan al workspace.
- `Apoyo` usa `work_management.followers` y permite asignar usuarios activos globales del SPI.
- `Checklist` usa `work_management.checklists` y `work_management.checklist_items`.
- La checklist se arma colaborativamente: cualquier usuario con acceso al item por membresia/propiedad del workspace/proyecto puede agregar, editar, marcar o eliminar pasos.
- `GET /projects/:projectId/items` devuelve `checklist` embebido con `items`, `total_items` y `done_items`.
- Cada cambio de checklist recalcula `items.completion_pct` segun pasos cumplidos.
- `Actualizaciones` usa `work_management.comments`.
- Cualquier usuario con acceso al item puede registrar una actualizacion/comentario/nota mediante `POST /items/:itemId/comments`.
- `GET /projects/:projectId/items` devuelve las ultimas 5 actualizaciones embebidas en `comments` y el total en `comment_count`.
- Los documentos por item se registran en `work_management.attachments`.
- `POST /items/:itemId/attachments` recibe `multipart/form-data` con campo `file`, sube a Google Drive y registra metadatos.

## Contrato actual

El modulo mantiene el patron general del backend:

- prefijo `/api/v1/`
- respuestas `{ ok: true|false }`
- JWT obligatorio

## Riesgos conocidos

- El RBAC fino por area todavia no se activa; en esta fase el acceso queda controlado por membresia/propiedad dentro del modulo.
- La sincronizacion automatica con CRM, Compras y otras areas queda para fases siguientes.
