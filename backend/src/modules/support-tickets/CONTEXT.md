# CONTEXT.md — support-tickets

## 1. Descripción
Módulo de tickets de soporte técnico interno (TI). Cualquier usuario autenticado puede crear tickets y seguir su propio historial. El equipo de TI gestiona el workspace, asigna tickets y actualiza estados.

## 2. Endpoints

- **POST /api/v1/support-tickets/** — `create` — sin requireRole (todos autenticados)
- **GET /api/v1/support-tickets/my** — `listMy` — todos autenticados
- **GET /api/v1/support-tickets/:id/events** — `listEvents` — todos autenticados
- **GET /api/v1/support-tickets/:id/comments** — `listComments` — todos autenticados
- **POST /api/v1/support-tickets/:id/comments** — `addComment` — todos autenticados
- **POST /api/v1/support-tickets/:id/reopen** — `reopen` — todos autenticados
- **POST /api/v1/support-tickets/:id/close** — `closeByRequester` — todos autenticados
- **POST /api/v1/support-tickets/:id/satisfaction** — `rateSatisfaction` — todos autenticados
- **GET /api/v1/support-tickets/workspace/list** — `listWorkspace` — requireRole(TI_ROLES)
- **GET /api/v1/support-tickets/workspace/kpi** — `kpiWorkspace` — requireRole(TI_ROLES)
- **PATCH /api/v1/support-tickets/:id/assign-self** — `assignSelf` — requireRole(TI_ROLES)
- **PATCH /api/v1/support-tickets/:id/status** — `updateStatus` — requireRole(TI_ROLES)

`TI_ROLES` definido en `supportTickets.service.js` (no verificado el valor exacto — probablemente `ti`, `jefe_ti`, `admin_ti`)

## 3. Flujo principal

1. Usuario crea ticket via `POST /`
2. TI ve el workspace con todos los tickets (`GET /workspace/list`)
3. Agente de TI se auto-asigna el ticket (`PATCH /:id/assign-self`)
4. TI actualiza el estado del ticket (`PATCH /:id/status`)
5. Usuario puede comentar, reabrir o cerrar su ticket
6. Al cierre, usuario califica la atención (`POST /:id/satisfaction`)

## 4. Validaciones
- Sin restricción de rol para acciones de usuario (crear, comentar, cerrar propio)
- TI_ROLES importado desde el service — no verificado el valor exacto

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `notifications`: probable notificación a TI al crear ticket
- `users`: usuarios reportan tickets

## 7. Frontend asociado
- `/dashboard/ti/workspace` → `TicketsWorkspace`
- Roles: `ti`, `jefe_ti`, `admin_ti`

## 8. Riesgos detectados
- `TI_ROLES` está definido en el service, no en el router — acoplamiento entre capas
- Sin `verifyToken` explícito en el router (depende de middleware global de autenticación)

## 9. Notas técnicas
- `supportTickets.service.js` (39KB): lógica principal incluyendo definición de TI_ROLES
