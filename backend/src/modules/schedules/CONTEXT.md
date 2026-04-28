# CONTEXT.md — schedules

## 1. Descripción
Módulo de planificación y aprobación de cronogramas comerciales (visitas mensuales). Asesores comerciales crean y gestionan su planificación mensual de visitas; jefes comerciales y gerencia aprueban, rechazan y acceden a analíticas. Incluye exportación ICS (calendar) y optimización de rutas.

## 2. Endpoints

- **GET /api/v1/schedules/** — `listMySchedules` — requireRole(advisorRoles + managerRoles)
- **GET /api/v1/schedules/holidays** — `getHolidays` — requireRole(advisorRoles + managerRoles)
- **GET /api/v1/schedules/pending-approval** — `listPendingApproval` — requireRole(managerRoles)
- **GET /api/v1/schedules/team** — `listTeamSchedules` — requireRole(managerRoles)
- **GET /api/v1/schedules/analytics** — `analytics` — requireRole(managerRoles)
- **GET /api/v1/schedules/approved/current** — `getApprovedSchedule` — requireRole(all)
- **GET /api/v1/schedules/my-calendar.ics** — `getMyCalendarIcs` — requireRole(all)
- **GET /api/v1/schedules/:id** — `getScheduleDetail` — requireRole(all)
- **POST /api/v1/schedules/** — `createSchedule` — requireRole(advisorRoles)
- **POST /api/v1/schedules/optimize-route** — `optimizeRoute` — requireRole(all)
- **PUT /api/v1/schedules/:id** — `updateSchedule` — requireRole(advisorRoles)
- **DELETE /api/v1/schedules/:id** — `deleteSchedule` — requireRole(advisorRoles)
- **POST /api/v1/schedules/:id/submit** — `submitForApproval` — requireRole(advisorRoles)
- **POST /api/v1/schedules/:id/justify** — `justifySchedule` — requireRole(advisorRoles)
- **POST /api/v1/schedules/:id/visits** — `addVisit` — requireRole(advisorRoles)
- **PUT /api/v1/schedules/:id/visits/:visitId** — `updateVisit` — requireRole(advisorRoles)
- **DELETE /api/v1/schedules/:id/visits/:visitId** — `deleteVisit` — requireRole(advisorRoles)
- **POST /api/v1/schedules/:id/visits/:visitId/justify** — `justifyVisit` — requireRole(advisorRoles)
- **POST /api/v1/schedules/:id/approve** — `approveSchedule` — requireRole(managerRoles)
- **POST /api/v1/schedules/:id/reject** — `rejectSchedule` — requireRole(managerRoles)

advisorRoles: `comercial`, `asesor_comercial`, `analista_comercial`, `acp_comercial`, `backoffice`, `backoffice_comercial`
managerRoles: `jefe_comercial`, `jefe_de_comercial`, `gerencia`, `gerencia_general`, `admin`, `administrador`

## 3. Flujo principal

1. Asesor crea cronograma mensual con visitas planificadas
2. Agrega visitas individuales con clientes/prospectos
3. Envía para aprobación al jefe comercial
4. Jefe aprueba o rechaza con observaciones
5. Asesor puede justificar desviaciones post-aprobación

## 4. Validaciones
- Dos grupos de roles claramente definidos: asesores y managers
- No hay `verifyToken` explícito en el router (depende del middleware global)

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `clients`: visitas planificadas referencian clientes
- `notifications`: notificación al jefe cuando se envía para aprobación

## 7. Frontend asociado
- `/dashboard/comercial/planificacion` → `PlanificacionMensual`
- `/dashboard/comercial/aprobaciones-planificacion` → `AprobacionCronogramas`

## 8. Riesgos detectados
- Sin `verifyToken` explícito en el router
- `schedules.service.js` (49KB) — grande, revisar antes de extender

## 9. Notas técnicas
- Exportación ICS para integración con calendarios externos (Google Calendar, etc.)
- `optimizeRoute` sugiere integración con mapas/geolocalización
