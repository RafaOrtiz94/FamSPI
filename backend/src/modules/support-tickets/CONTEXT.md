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
- **GET /api/v1/support-tickets/workspace/kpi-definitions** — `listWorkspaceKpiDefinitions` — requireRole(TI_ROLES), solo lectura de los KPIs configurados por jefe_ti
- **PATCH /api/v1/support-tickets/:id/assign-self** — `assignSelf` — requireRole(TI_ROLES)
- **PATCH /api/v1/support-tickets/:id/status** — `updateStatus` — requireRole(TI_ROLES)
- **/api/v1/support-tickets/admin/\*** — ver `supportTicketsAdmin.routes.js` — requireRole(["jefe_ti"]) exclusivo (CRUD de KPIs + reportes mensuales + export PDF/Excel)

`TI_ROLES` = `ROLE_GROUPS.support_ti` en `backend/src/middlewares/roles.js` (fuente unica de verdad desde el rework 2026-09-18): `ti, jefe_ti, admin_ti, jefe_de_ti, tecnico, ing_servicio, esp_app, jefe_tecnico, jefe_servicio, servicio_tecnico, jefe_servicio_tecnico`.

## 3. Flujo principal

1. Usuario crea ticket via `POST /`
2. TI ve el workspace con todos los tickets (`GET /workspace/list`)
3. Agente de TI se auto-asigna el ticket (`PATCH /:id/assign-self`)
4. TI actualiza el estado del ticket (`PATCH /:id/status`)
5. Usuario puede comentar, reabrir o cerrar su ticket
6. Al cierre, usuario califica la atención (`POST /:id/satisfaction`)

## 4. Validaciones
- Sin restricción de rol para acciones de usuario (crear, comentar, cerrar propio)
- TI_ROLES importado desde `ROLE_GROUPS.support_ti` (`middlewares/roles.js`)
- Reportes mensuales y CRUD de KPIs (`/admin/*`) exigen literalmente `jefe_ti` (no incluye `admin_ti`, decision explicita del rework)

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `notifications`: probable notificación a TI al crear ticket
- `users`: usuarios reportan tickets

## 7. Frontend asociado
- `/dashboard/ti/workspace` → `TicketsWorkspace` (tabla + inspector lateral, rework 2026-09-18)
- `/dashboard/ti/workspace/reportes` → `TicketsReports` (reportes mensuales + administracion de KPIs), exclusivo `jefe_ti`
- `/dashboard/ti/workspace/reportes/kpis/nuevo` y `/kpis/:id/editar` → `TicketKpiForm`, exclusivo `jefe_ti`
- Roles workspace operativo: `ti`, `jefe_ti`, `admin_ti`, `jefe_de_ti`, `tecnico`, `ing_servicio`, `esp_app`, `jefe_tecnico`, `jefe_servicio`, `servicio_tecnico`, `jefe_servicio_tecnico`
- Roles reportes/config KPI: `jefe_ti` exclusivamente

## 8. Riesgos detectados
- ~~`TI_ROLES` está definido en el service, no en el router — acoplamiento entre capas~~ Resuelto 2026-09-18: `TI_ROLES` ahora es `ROLE_GROUPS.support_ti` importado desde `middlewares/roles.js`.
- Sin `verifyToken` explícito en `supportTickets.routes.js` (depende de middleware global de autenticación) — `supportTicketsAdmin.routes.js` sí declara `verifyToken` explícitamente porque gatea todo el router en bloque.
- El esquema de `support_tickets*` sigue viviendo en `ensureSupportSchema()` (auto-migración perezosa) en vez de migraciones puras; las tablas nuevas de KPI/reportes (`support_ticket_kpi_definitions`, `support_ticket_report_exports`) SÍ siguen el patrón de migración pura (`migrations/297_support_tickets_kpi_reports.sql`), sin duplicarse en `ensureSupportSchema()` — no replicar el patrón antiguo al tocar este módulo de nuevo.

## 9. Notas técnicas
- `supportTickets.service.js` (~1400 líneas): CRUD de tickets, SLA, notificaciones.
- `supportTicketsKpi.service.js`: motor de KPIs configurables (catálogo cerrado de `metric_type` + filtros whitelisteados, sin SQL libre).
- `supportTicketsReports.service.js`: agregaciones del reporte mensual (volumen, tendencia 6 meses, SLA, tiempos, CSAT, ranking de técnicos, KPIs configurados).
- `supportTicketsExport.service.js`: genera el buffer PDF (pdfkit) o Excel (xlsx) del reporte mensual.
- `supportTicketsAdmin.routes.js` / `.controller.js`: CRUD de KPIs + endpoints de reporte/export, todo bajo `requireRole(["jefe_ti"])`.
