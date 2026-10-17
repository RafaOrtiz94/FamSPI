# CONTEXT.md — schedules

## 1. Descripción
Módulo de planificación mensual de visitas comerciales ("Cronogramas"). Un asesor comercial crea un cronograma por mes/año, agrega visitas planificadas a clientes/prospectos, lo envía a aprobación y el jefe comercial (o gerencia) lo aprueba/rechaza. Incluye analíticas de cumplimiento, exportación a calendario (.ics), sincronización de ciudad por semana y un endpoint de optimización de ruta (Google Directions).

Controller: `schedules.controller.js` (thin, delega todo a `schedules.service.js`). Service: `schedules.service.js` (2425 líneas — el archivo grande del módulo).

## 2. Roles

Definidos **de forma independiente** en tres lugares (router, service, y `spi_front/.../roleSectionConfig`-style inline arrays en frontend) — no hay un `ROLE_GROUPS` compartido para schedules en `middlewares/roles.js`. Mantenerlos sincronizados a mano.

### advisorRoles (crear/editar/enviar cronograma propio)
```
comercial, asesor_comercial, analista_comercial, acp_comercial,
backoffice, backoffice_comercial
```

### managerRoles (aprobar/rechazar, ver equipo, analíticas)
```
jefe_comercial, gerencia, gerencia_general,
admin, administrador
```

`schedules.service.js` reimplementa estos mismos sets como `MANAGER_ROLES` / `ADVISOR_ROLES` (líneas 14-30) para checks internos (`isManager`, `isAdvisor`, `assertAdvisor`) — duplicado del router, no importado de ahí.

## 3. Endpoints

Prefijo: `/api/v1/schedules` (montado en `registerRoutes.js` como `schedulesRoutes`, dentro de `mountPrivateRoutes`). **No hay `verifyToken` explícito en el router** — depende enteramente del middleware global de autenticación que envuelve las rutas privadas.

| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/` | `listMySchedules` | advisorRoles + managerRoles |
| GET | `/holidays` | `getHolidays` | advisorRoles + managerRoles |
| GET | `/pending-approval` | `listPendingApproval` | managerRoles |
| GET | `/team` | `listTeamSchedules` | managerRoles |
| GET | `/analytics` | `analytics` | managerRoles |
| GET | `/approved/current` | `getApprovedSchedule` | advisorRoles + managerRoles |
| GET | `/my-calendar.ics` | `getMyCalendarIcs` | advisorRoles + managerRoles |
| GET | `/:id` | `getScheduleDetail` | advisorRoles + managerRoles |
| POST | `/` | `createSchedule` | advisorRoles |
| POST | `/optimize-route` | `optimizeRoute` | advisorRoles + managerRoles |
| PUT | `/:id` | `updateSchedule` | advisorRoles |
| DELETE | `/:id` | `deleteSchedule` | advisorRoles |
| POST | `/:id/submit` | `submitForApproval` | advisorRoles |
| POST | `/:id/justify` | `justifySchedule` | advisorRoles |
| POST | `/:id/visits` | `addVisit` | advisorRoles |
| POST | `/:id/weeks/sync-city` | `syncWeekCity` | advisorRoles |
| PUT | `/:id/visits/:visitId` | `updateVisit` | advisorRoles |
| DELETE | `/:id/visits/:visitId` | `deleteVisit` | advisorRoles |
| POST | `/:id/visits/:visitId/justify` | `justifyVisit` | advisorRoles |
| POST | `/:id/approve` | `approveSchedule` | managerRoles |
| POST | `/:id/reject` | `rejectSchedule` | managerRoles |

## 4. Flujo principal

1. Asesor crea cronograma (POST `/`, `{month, year, notes}`) → status inicial `draft`. Un asesor solo puede tener un cronograma por `(user_email, month, year)`.
2. Asesor agrega visitas planificadas (POST `/:id/visits`) referenciando `client_request_id` (cliente existente) o `lead_id`/`prospect_name` (prospecto CRM), con `planned_date`, `city`, `priority` (1-3).
3. Asesor puede sincronizar ciudad por semana (`weeks/sync-city`) para forzar la misma ciudad en un rango de fechas.
4. Asesor envía a aprobación (POST `/:id/submit`) → status `pending_approval`. Dispara notificación al jefe comercial vía `notificationManager`.
5. Jefe comercial revisa (GET `/pending-approval` o `/team`) y aprueba (POST `/:id/approve`) → status `approved`, o rechaza (POST `/:id/reject`, requiere `rejection_reason`) → status `rejected`.
6. Tras aprobación/rechazo, el asesor puede editar de nuevo — el sistema vuelve a poner en `pending_approval` internamente si hay cambios sobre un cronograma ya `approved`/`rejected` (ver `WHERE status IN ('approved','rejected')` en `updateSchedule`, línea ~544).
7. Post-aprobación, si hay desviaciones (visita no realizada, visita no planificada), el asesor puede justificar por visita (`visits/:visitId/justify`) o a nivel de cronograma completo (`:id/justify`, `general_justification`).
8. Jefe/gerencia consulta `analytics` (cumplimiento por asesor) y exporta el cronograma aprobado del usuario como `.ics` (`my-calendar.ics`) para importar en Google Calendar.
9. `optimize-route` es un endpoint independiente que llama a Google Directions API para sugerir orden óptimo de visitas dado un set de `schedule_ids`.

### Estados del cronograma (`visit_schedules.status`)
`draft` → `pending_approval` → `approved` | `rejected` (con reingreso a `pending_approval` si se edita tras aprobar/rechazar).

### Estados de visita (`scheduled_visits` / `client_visit_logs.status`)
`pending`, `visited`, `skipped`, `in_visit`.

## 5. Base de datos

**No hay migración numerada que cree `visit_schedules` ni `scheduled_visits`** — son tablas preexistentes al sistema de migraciones (`backend/migrations/`). Solo hay migraciones que las **alteran**:
- `237_schedule_visit_external_sync_fields.sql` — agrega `crm_meeting_id`, `crm_activity_id`, `calendar_event_id`, `calendar_event_link`, `calendar_event_calendar_id`, `external_synced_at` a `scheduled_visits`.
- `238_scheduled_visits_prospect_support.sql` — soporte de prospectos (sin cliente registrado).
- `239_scheduled_visits_crm_activity_id.sql` — vínculo con `crm.crm_activities`.
- `240_crm_leads_city_and_scheduled_visits_lead_id.sql` — vínculo con `crm.crm_leads`.

`schedules.service.js` usa `columnExists()`/`tableExists()` (helper `utils/dbMeta.js`) con cache en memoria antes de usar columnas opcionales — patrón defensivo porque el esquema real no está 100% garantizado igual en todos los ambientes.

**Tablas principales**:
- `visit_schedules` — un registro por asesor/mes/año. Columnas relevantes usadas en queries: `id, user_email, month, year, notes, status, submitted_at, reviewed_by_email, rejection_reason, general_justification, created_at, updated_at`.
- `scheduled_visits` — visitas planificadas dentro de un cronograma. `schedule_id` (FK a `visit_schedules`), `client_request_id` (FK opcional a `client_requests`), `lead_id` (FK opcional a `crm.crm_leads`), `prospect_name`, `planned_date`, `city`, `priority`, `notes`, `justification`, más columnas de sync externo (ver migración 237).

**Tablas relacionadas (join, no propiedad del módulo)**:
- `client_requests` — clientes/prospectos referenciados por las visitas.
- `client_assignments` — asignación de cliente a asesor (usado para scoping de "mis clientes").
- `client_visit_logs` — registro real de visitas ejecutadas (fuente de `visit_status`/eficiencia, cruzado por fecha con `visit_schedules.month/year`).
- `prospect_visits` — visitas no planificadas a prospectos (aparecen como "visitas no planificadas" en la UI de aprobación).
- `crm.crm_leads`, `crm.crm_activities` — integración con el módulo CRM-FAM.
- `public.users` — datos de nombre/email del asesor.

## 6. Relaciones con otros módulos
- `clients` / `client_requests`: las visitas planificadas referencian clientes existentes.
- `crm-fam`: visitas pueden originarse o sincronizarse con `crm.crm_leads` / `crm.crm_activities` (integración agregada en migraciones 239-240, posterior al resto del módulo).
- `notifications`: `notificationManager` notifica al jefe comercial al enviar a aprobación.
- Calendario externo: `utils/calendar.js#createOrUpdateSharedAllDayEvent` y exportación `.ics` vía librería `ics`.
- Google Directions API (`optimizeRoute`) — dependencia externa, no falla el módulo si no hay API key pero el endpoint sí puede devolver error 502.

## 7. Frontend asociado

| Ruta | Componente | Acceso (ProtectedRoute) |
|------|-----------|--------------------------|
| `/dashboard/comercial/planificacion` | `PlanificacionMensual` (switch, ver §8) | `comercial, jefe_comercial, jefe_financiero, gerencia, gerencia_general` |
| `/dashboard/comercial/aprobaciones-planificacion` | `AprobacionCronogramas` | `jefe_comercial, gerencia, gerencia_general, admin, administrador` |

Componentes en producción:
- `spi_front/src/modules/comercial/pages/PlanificacionMensual.jsx` — entry point con switch por rol (ver Riesgos).
- `spi_front/src/modules/comercial/components/schedules/ScheduleWorkspace.jsx` — editor real del asesor (calendario, mapa de ruta con Google Maps, alta/edición/borrado de visitas). Self-contained; solo importa `ScheduleStatusBadge` y `ScheduleMapErrorBoundary` del resto de la carpeta.
- `spi_front/src/modules/comercial/pages/AprobacionCronogramas.jsx` — vista de aprobación del jefe comercial (expediente por asesor, aprobar/rechazar). Self-contained también.
- `spi_front/src/modules/comercial/hooks/useSchedules.js` — estado del cronograma del asesor (CRUD optimista de visitas).
- `spi_front/src/modules/comercial/hooks/useScheduleApproval.js` — estado de la vista de aprobación (pending, team, analytics; auto-refresh via `DATA_UPDATE_SCOPES.SCHEDULES`).
- `spi_front/src/modules/comercial/components/schedules/ScheduleStatusBadge.jsx` — badge de estado (`draft/pending_approval/approved/rejected`), usado por ambos flujos.
- `spi_front/src/core/api/schedulesApi.js` — cliente API único para todo el módulo.

Componentes en `components/schedules/` que **no se usan en ningún lado** (código muerto, ver Riesgos): `ScheduleApprovalWidget.jsx`, `ScheduleReviewModal.jsx`, `TeamScheduleOverview.jsx`, `RejectScheduleModal.jsx`, `ScheduleDetailModal.jsx`, `ScheduleCard.jsx`, `ScheduleCalendarView.jsx`, `ScheduleEditorIntuitive.jsx`, `EditWarningModal.jsx`, `ExecutiveMonthlyReport.jsx`.

## 8. Riesgos y notas técnicas

- **Sin `verifyToken` explícito** en `schedules.routes.js` — depende del middleware global; si algún día se reorganiza el montaje de rutas, este módulo quedaría expuesto sin aviso.
- **`PlanificacionMensual.jsx` es solo un switch por rol**, no el componente real de planificación:
  ```js
  if (user?.role === "jefe_comercial") return <AprobacionCronogramas />;
  return <ScheduleWorkspace {...scheduleState} />;
  ```
  Quien busque "el componente de planificación mensual" y abra este archivo esperando el editor real se equivoca — el editor está en `ScheduleWorkspace.jsx`.
- **El switch compara `=== "jefe_comercial"` exacto**, no contra el grupo de roles. `jefe_de_comercial` fue eliminado como rol real del sistema (era un alias legacy que causaba bugs de acceso inconsistentes) — `jefe_comercial` es el único rol de jefatura comercial soportado.
- La ruta `/dashboard/comercial/planificacion` en `AppRoutes.jsx` tampoco lista explícitamente a `asesor_comercial, analista_comercial, acp_comercial, backoffice, backoffice_comercial` (solo `comercial, jefe_comercial, jefe_financiero, gerencia, gerencia_general`) — verificar `user.scope` antes de asumir que un asesor con uno de esos roles queda bloqueado.
- 10 de los ~13 archivos en `components/schedules/` son código muerto sin importadores (ver §7). No usarlos como referencia de "cómo se hace" — reflejan un diseño anterior (probablemente basado en widgets/modales separados) reemplazado por las páginas self-contained actuales.
- `schedules.service.js` (2425 líneas / ~49KB) — el archivo grande del módulo; duplica los sets de roles del router (`MANAGER_ROLES`/`ADVISOR_ROLES`) en vez de importarlos.
- Uso de `columnExists`/`tableExists` con cache en memoria de proceso — si se corre en múltiples instancias Cloud Run, cada una cachea su propia verificación de esquema.
- Tests: `backend/src/modules/schedules/__tests__/schedules.helpers.test.js` — cobertura limitada (helpers), no hay tests de integración del flujo completo.
