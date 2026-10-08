---
name: modulo-solicitudes
description: Mapa real de la pantalla "Solicitudes" comercial (spi_front/src/modules/comercial/pages/Solicitudes.jsx) y su backend — aclara que `backend/src/modules/requests/` (solicitudes generales + nuevo cliente) y `backend/src/modules/delivery-requests/` (topes de entrega de reactivos/calibradores sobre un Business Case) son DOS dominios sin relación de código, y que `RequestActionsExample.jsx`/`comercial/pages/Requests.jsx` son código legacy sin ruta. Úsalo antes de tocar cualquier flujo de "solicitudes" del área comercial — el nombre "request" aparece en 3 backends y 4 páginas de frontend distintas, y confundirlas es el error más fácil de cometer aquí.
---

# Skill: Módulo Solicitudes (comercial) — FamSPI

Antes de tocar cualquier cosa que huela a "solicitud" en el área comercial, lee esto. El error real más común en esta zona: asumir que "requests" y "delivery-requests" son el mismo módulo porque comparten palabra y roles — **no lo son**, son dos dominios de negocio distintos que nunca se importan entre sí.

**Si el trabajo es específicamente sobre techos de entrega / delivery-ceilings / delivery-requests** (crear, aprobar, despachar, saldos, `business-case/deliveryCeiling.service.js`), usa el skill `modulo-techos-entrega` en vez de este — tiene el mapa detallado de esa lógica (incluye un servicio "muerto" sin caller real y una inconsistencia de saldo entre dos archivos). Este skill (`modulo-solicitudes`) cubre el panorama general de "Solicitudes" y solo lo suficiente de `delivery-requests` para distinguirlo de `requests`.

---

## Los dos backends — NO son el mismo módulo

| | `backend/src/modules/requests/` | `backend/src/modules/delivery-requests/` |
|---|---|---|
| Qué gestiona | Solicitudes administrativas genéricas: compra, inspección, retiro, crédito (F.VE-02), personal, **y** alta de nuevo cliente (LOPDP + checklist calidad) | Entregas parciales de reactivos/calibradores/controles/materiales contra un tope (`delivery_ceiling`) ligado a un Business Case ya aprobado |
| Prefijo API | `/api/v1/requests` | `/api/v1/delivery-requests` |
| Tabla principal | `requests` (+ `request_types`, `request_versions`, `request_attachments`, `request_approvals`) | `delivery_request` (+ `delivery_request_line`, `delivery_ceiling`, `delivery_ceiling_line`, `delivery_dispatch*`) |
| Ligado a | `request_type_id` (código F.ST-xx) | `business_case_id` = `equipment_purchase_requests.id` |
| Pantalla frontend | `Solicitudes.jsx` (`/dashboard/comercial/solicitudes`) y `RequestsPage.jsx` (`/requests`) | `DeliveryCeilings.jsx` (`/dashboard/comercial/delivery-ceilings`) y el tab `SupplyControlTab.jsx` dentro del expediente de compra |
| CONTEXT.md | `backend/src/modules/requests/CONTEXT.md` | `backend/src/modules/delivery-requests/CONTEXT.md` |

**Por qué se confunden**: ambos los usan los mismos roles comerciales (`comercial`, `acp_comercial`, `jefe_comercial`, `backoffice_comercial`), ambos tienen la palabra "request(s)" en el nombre, y ambos viven bajo `modules/comercial/pages/`. Pero no hay un solo `require()`/`import` cruzado entre los dos módulos backend, ni el frontend de `Solicitudes.jsx` importa nada de `deliveryRequestsApi.js` (confirmado por grep). Si necesitas tocar "solicitudes de entrega" de reactivos/calibradores, es `delivery-requests`, no `requests` — aunque la palabra "solicitud" aparezca en ambos casos en español.

---

## Las páginas de frontend — 4 archivos con nombre parecido, 2 en producción

1. **`spi_front/src/modules/comercial/pages/Solicitudes.jsx`** (`SolicitudesPage`) — **PRODUCCIÓN**, ruta `/dashboard/comercial/solicitudes`. Es el hub real que ve comercial/ACP/jefe_comercial/jefe_financiero. Vistas por rol: `ComercialSolicitudesView`, `ACPComercialSolicitudesView`, `JefeFinancieroSolicitudesView`, `UserRequestsView`. Consume `core/api/requestsApi.js` → `/api/v1/requests`.

2. **`spi_front/src/modules/RequestsPage.jsx`** (`RequestsPage`) — **PRODUCCIÓN**, ruta `/requests` (genérica, fuera de `/dashboard/comercial/`). Mismo backend que `Solicitudes.jsx` (mismo `requestsApi.js`), pantalla más simple/antigua, solo `role === "jefe_comercial"` puede crear. Coexiste con `Solicitudes.jsx` sin que una redirija a la otra — dos entradas activas al mismo backend.

3. **`spi_front/src/modules/comercial/pages/Requests.jsx`** (`Requests`, mismo nombre de componente que el anterior pero archivo distinto) — **LEGACY, sin ruta**. Confirmado por grep en `AppRoutes.jsx` y en todo `spi_front/src`: ningún archivo lo importa. Usa `DashboardLayout` (patrón de layout antiguo) + `SolicitudesGrid`, llama al mismo `requestsApi.js`. Parece una versión intermedia entre `RequestsPage.jsx` y `Solicitudes.jsx` que nunca se borró tras ser reemplazada.

4. **`spi_front/src/modules/comercial/pages/RequestActionsExample.jsx`** — **DEMO explícita, sin ruta**. El propio archivo se autodescribe: *"Página de ejemplo que muestra todos los tipos de botones de solicitud disponibles para implementar en diferentes páginas del sistema"*. Sin importador en ningún archivo (confirmado por grep). Es documentación viva de los componentes `RequestActionCard`/`RequestActionButton`/`RequestActionGrid` (`core/ui/components/RequestActionCards.jsx`), útil como referencia de esos componentes, pero nunca se renderiza para un usuario real.

**Regla práctica**: si vas a modificar la experiencia de "Solicitudes" que ve un comercial, es casi seguro `Solicitudes.jsx`. Si el ticket menciona la ruta `/requests` a secas (sin `/dashboard/comercial/`), es `RequestsPage.jsx`. Nunca edites `comercial/pages/Requests.jsx` ni `RequestActionsExample.jsx` esperando que el cambio se vea en algún lado — confirma primero con grep de `AppRoutes.jsx` si dudas de cuál es cuál.

---

## Roles — patrones distintos entre los dos backends

- `requests.routes.js` declara arrays de roles **inline en cada ruta**, sin constantes reutilizables — hay que leer cada `requireRole([...])` una por una; no asumas que el mismo array se repite en otra ruta sin verificar.
- `deliveryRequests.routes.js` sí centraliza en constantes (`MANAGER_ROLES`, `REQUEST_CREATOR_ROLES`, `OPS_APPROVE_ROLES`, `LOGISTICS_ROLES`, `READ_ROLES`) — más fácil de auditar, pero ojo: `LOGISTICS_ROLES` excluye a propósito al rol base `logistica` (solo `jefe_logistica` confirma entregas) — no es un bug si alguien con rol `logistica` no puede confirmar.
- Ninguno de los dos usa `ROLE_GROUPS` de `middlewares/roles.js` (el grupo `comercial` centralizado) — cada módulo reinventa su propia lista de roles comerciales. Si agregas un rol nuevo (p.ej. un nuevo tipo de `acp_comercial`), tienes que tocar las listas de AMBOS módulos por separado si quieres que ese rol vea ambas pantallas.
- En `requests`, `jefe_comercial` NO aparece en los roles de lectura general (`GET /` y `GET /:id`) pese a poder crear/reenviar/cancelar — verifica esto en el código real antes de asumir que un jefe_comercial puede ver el detalle de cualquier solicitud.

---

## Gotchas reales

1. **Tablas sin migración de creación rastreable**: `requests`, `request_types`, `client_requests` y sus tablas relacionadas no tienen un `CREATE TABLE` en `backend/migrations/` — son anteriores al historial de migraciones versionado. Solo hay migraciones que las alteran (ej. `044_purchase_requests_legacy_mapping.sql`). No busques el schema completo en migrations; si necesitas la estructura exacta, consulta la DB real (Neon, vía gcloud Secret Manager) o el código de `requests.service.js` (que hace `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` en runtime, líneas ~169-194 y ~406-408).

2. **`delivery-requests` también auto-migra en runtime**: `ensureDeliveryTables()` en `deliveryRequests.service.js` crea `delivery_dispatch`/`delivery_dispatch_line` al arrancar el server, "fire-and-forget" (`.catch(() => {})`) — si falla silenciosamente, las rutas de confirmación de entrega fallan con error genérico de SQL sin pista de la causa raíz. Si `confirm-delivery` da error inesperado, lo primero a revisar son los logs de arranque del server buscando `ensureDeliveryTables failed`.

3. **Constraint de estado desalineada en `delivery_request`**: la constraint SQL `delivery_request_status_check` (migración 127) solo permite `pending`/`confirmed`/`cancelled`, pero el código de aplicación usa también `ops_approved` como estado intermedio (`DELIVERY_REQUEST_STATUSES` en el service incluye los 4). Verifica el constraint real en la DB antes de asumir que bloquea `ops_approved` — puede que se haya relajado manualmente fuera de las migraciones versionadas.

4. **`purchaseRequestsFacade.js`** (dentro de `backend/src/modules/requests/`) conecta solicitudes tipo "compra" (F.ST-19) con el flujo real de compras (`equipment-purchases`/`private-purchases`) — si tocas la creación de solicitudes de compra, revisa esta fachada antes de asumir que el flujo termina en `requests.service.js`.

5. **`SupplyControlTab.jsx`** (dentro de `purchases-workspace/expediente/`) es OTRA entrada a `delivery-requests` además de `DeliveryCeilings.jsx` — mismo `deliveryRequestsApi.js`, contexto distinto (tab dentro del expediente de una compra específica vs. pantalla dedicada de topes). Si cambias el comportamiento de creación/confirmación de entregas, verifica ambos consumidores, no solo `DeliveryCeilings.jsx`.

---

## Checklist antes de tocar algo en "Solicitudes"

1. ¿Es una solicitud administrativa genérica (compra, inspección, retiro, crédito, nuevo cliente)? → `backend/src/modules/requests/`, frontend `Solicitudes.jsx` (o `RequestsPage.jsx` si el ticket dice `/requests` a secas).
2. ¿Es sobre entrega física de reactivos/calibradores/controles/materiales contra un tope de Business Case? → `backend/src/modules/delivery-requests/`, frontend `DeliveryCeilings.jsx` o `SupplyControlTab.jsx`.
3. ¿El archivo que vas a editar es `comercial/pages/Requests.jsx` o `RequestActionsExample.jsx`? → Confirma con grep en `AppRoutes.jsx` antes de invertir tiempo; ambos son legacy/demo sin ruta activa a la fecha de esta auditoría (2026-09).
4. ¿Vas a agregar un rol a una de las dos rutas de "lectura"? → Revisa si también debe agregarse en la otra lista (no comparten `ROLE_GROUPS`, cada módulo tiene su propia copia).
5. Después de editar backend: syntax-check con `node -e "require('./ruta')"`, `npx eslint <archivo>`. Después de editar frontend: `npx eslint <archivo>`.
