---
name: modulo-cronogramas
description: Mapa real de "Cronogramas / Planificación mensual" (schedules) — quién es el editor real del asesor, quién es la vista de aprobación del jefe comercial, y por qué `PlanificacionMensual.jsx` no es ninguno de los dos. Úsalo antes de tocar cualquier archivo de `backend/src/modules/schedules/` o `spi_front/.../comercial/{pages,components/schedules,hooks}` relacionado con cronogramas — hay ~10 componentes de UI sin ningún importador (legacy).
---

# Skill: Módulo Cronogramas / Planificación mensual — FamSPI

Antes de tocar el flujo de planificación-aprobación de visitas comerciales, lee esto. El bug real más probable en esta área: abrir `PlanificacionMensual.jsx` esperando el editor de cronogramas cuando en realidad es solo un switch de 5 líneas.

---

## Mapa de archivos (front + back)

### Backend — `backend/src/modules/schedules/`
- `schedules.routes.js` — define `advisorRoles` (comercial, asesor_comercial, analista_comercial, acp_comercial, backoffice, backoffice_comercial) y `managerRoles` (jefe_comercial, gerencia, gerencia_general, admin, administrador) **inline**, no vienen de `ROLE_GROUPS` en `middlewares/roles.js`.
- `schedules.controller.js` — thin, un solo helper `respond()` que envuelve todas las promesas del service.
- `schedules.service.js` (2425 líneas) — toda la lógica real. Reimplementa `MANAGER_ROLES`/`ADVISOR_ROLES` como `Set` propios (líneas 14-30) — duplicado del router, no compartido.
- Montado en `backend/src/routes/registerRoutes.js` como `/api/v1/schedules`, dentro de `mountPrivateRoutes`. **No hay `verifyToken` explícito en el router** — depende del middleware global.

### Frontend — dos flujos que parecen uno solo
- `spi_front/src/modules/comercial/pages/PlanificacionMensual.jsx` — **NO es el editor**. Es un switch de 5 líneas:
  ```js
  if (user?.role === "jefe_comercial") return <AprobacionCronogramas />;
  return <ScheduleWorkspace {...scheduleState} />;
  ```
  Montado en la ruta `/dashboard/comercial/planificacion`.
- `spi_front/src/modules/comercial/components/schedules/ScheduleWorkspace.jsx` — el editor real del asesor (calendario, alta/edición/borrado de visitas, mapa de ruta con Google Maps). Usa `useSchedules.js` como hook de estado.
- `spi_front/src/modules/comercial/pages/AprobacionCronogramas.jsx` — la vista de aprobación real del jefe comercial (expediente por asesor, aprobar/rechazar). Self-contained: trae sus propios subcomponentes (`RejectModal`, `UserCard`, `ScheduleRow`, `VisitsList`) dentro del mismo archivo, NO reutiliza nada de `components/schedules/` salvo `ScheduleStatusBadge`. Usa `useScheduleApproval.js` como hook de estado. También tiene **su propia ruta directa**: `/dashboard/comercial/aprobaciones-planificacion`.
- `spi_front/src/core/api/schedulesApi.js` — cliente API único para ambos flujos (asesor y aprobación).

### Componentes muertos (sin importador real — confirmado con grep)
En `spi_front/src/modules/comercial/components/schedules/` hay 10 archivos que **nada importa**:
`ScheduleApprovalWidget.jsx`, `ScheduleReviewModal.jsx`, `TeamScheduleOverview.jsx`, `RejectScheduleModal.jsx`, `ScheduleDetailModal.jsx`, `ScheduleCard.jsx`, `ScheduleCalendarView.jsx`, `ScheduleEditorIntuitive.jsx`, `EditWarningModal.jsx`, `ExecutiveMonthlyReport.jsx`.

Son un diseño anterior (aprobación basada en widgets/modales separados) que fue reemplazado por las páginas self-contained actuales (`AprobacionCronogramas.jsx`, `ScheduleWorkspace.jsx`). **No los uses como referencia de "cómo se hace"** — copian patrones descartados. Antes de reutilizar cualquier componente de esa carpeta, corre `grep -rl "NombreComponente" spi_front/src` y confirma que algo más allá de sí mismo lo importa; si no, es legacy.

Solo dos archivos de esa carpeta están realmente en uso: `ScheduleStatusBadge.jsx` (badge de estado, usado por ambos flujos) y `ScheduleMapErrorBoundary.jsx` (usado solo por `ScheduleWorkspace.jsx`).

---

## Flujo real de planificación → aprobación

1. Asesor crea cronograma mensual (`POST /schedules`, `{month, year}`) → `status = draft`. Único por `(user_email, month, year)`.
2. Asesor agrega visitas (`POST /schedules/:id/visits`) contra cliente (`client_request_id`) o prospecto CRM (`lead_id`/`prospect_name`).
3. Asesor envía a aprobación (`POST /schedules/:id/submit`) → `status = pending_approval`, notifica al jefe comercial.
4. Jefe comercial (o gerencia/admin) aprueba (`POST /schedules/:id/approve` → `approved`) o rechaza (`POST /schedules/:id/reject`, requiere `rejection_reason` → `rejected`).
5. Si el asesor edita un cronograma ya `approved`/`rejected`, vuelve a `pending_approval` automáticamente (ver `WHERE status IN ('approved','rejected')` en `schedules.service.js` ~línea 544) — no hace falta un endpoint separado de "reenviar".
6. Post-aprobación, desviaciones se justifican por visita (`justify` a nivel de visita) o a nivel de cronograma completo (`justify` a nivel de schedule, `general_justification`).
7. Analíticas de cumplimiento y export `.ics` para calendario externo son de solo lectura, no forman parte del state machine de aprobación.

Estados de cronograma: `draft → pending_approval → approved | rejected` (con reingreso a `pending_approval`).
Estados de visita: `pending, visited, skipped, in_visit` (via `client_visit_logs`, cruzado por fecha con el cronograma).

---

## Hallazgo histórico (resuelto): `jefe_comercial` vs `jefe_de_comercial`

`jefe_de_comercial` era un alias legacy de rol que en algunas partes del sistema (`businessCaseRoles` en business-case, `managerRoles` del propio backend de schedules) se trataba como equivalente a `jefe_comercial`, pero que en el **frontend** de este módulo no lo era:

1. **`PlanificacionMensual.jsx`** compara `user?.role === "jefe_comercial"` (string exacto). Un usuario con el alias `jefe_de_comercial` caía al `else` y recibía `ScheduleWorkspace` — el editor de asesor — en vez de la vista de aprobación.
2. **La ruta `/dashboard/comercial/aprobaciones-planificacion`** en `AppRoutes.jsx` tenía `allowedRoles = ["jefe_comercial", "gerencia", "gerencia_general", "admin", "administrador"]` — no incluía el alias, y `ProtectedRoute` no tiene bypass automático para roles equivalentes no listados.

**Este hallazgo ya no aplica**: `jefe_de_comercial` no existe como rol real de usuario en el sistema — era un alias legacy que fue eliminado. El único rol válido es `jefe_comercial`, así que el switch de `PlanificacionMensual.jsx` y el `allowedRoles` de la ruta en `AppRoutes.jsx` ya cubren correctamente a todos los usuarios reales. Se deja esta nota como referencia histórica por si aparece código o documentación vieja que todavía mencione `jefe_de_comercial` — no es un bug activo a corregir.

---

## Tablas de base de datos

`visit_schedules` (un registro por asesor/mes/año) y `scheduled_visits` (visitas dentro de un cronograma) son **tablas preexistentes**, no creadas por ninguna migración numerada del repo. Las migraciones 237-240 solo las alteran (soporte de prospectos, sync con CRM, columnas de sincronización con calendario externo). Antes de asumir que una columna no existe, revisar `columnExists()`/`tableExists()` en `schedules.service.js` — el propio service verifica el esquema en runtime con cache en memoria por instancia.

Joins frecuentes: `client_requests`, `client_assignments`, `client_visit_logs` (fuente real de si una visita se ejecutó), `prospect_visits` (visitas no planificadas), `crm.crm_leads` / `crm.crm_activities` (integración CRM-FAM).

---

## Checklist antes de tocar el módulo de cronogramas

1. ¿El cambio es sobre el **editor del asesor**? → `ScheduleWorkspace.jsx` + `useSchedules.js`, no `PlanificacionMensual.jsx`.
2. ¿El cambio es sobre la **vista de aprobación**? → `AprobacionCronogramas.jsx` + `useScheduleApproval.js`, no los widgets sueltos de `components/schedules/` (están muertos).
3. ¿El cambio toca **roles/acceso**? → edita a la vez el switch en `PlanificacionMensual.jsx` y el `allowedRoles` de la(s) ruta(s) en `AppRoutes.jsx`; confirma contra `advisorRoles`/`managerRoles` de `schedules.routes.js` (backend) para no desalinear de nuevo.
4. ¿Vas a **reutilizar un componente** de `components/schedules/`? → `grep -rl "NombreComponente" spi_front/src` primero; si nada más que el propio archivo lo referencia, es legacy, no lo copies.
5. ¿El cambio toca el **service** (`schedules.service.js`, 2425 líneas)? → revisa si ya existe el set de roles o el helper que necesitas antes de reimplementarlo; el archivo ya duplica roles del router una vez, no sumes una tercera copia.
