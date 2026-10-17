# CONTEXT.md — delivery-requests

## 1. Descripción
Módulo de **entregas parciales de reactivos/calibradores/controles/materiales** sobre un `delivery_ceiling` (tope de entrega ligado a un Business Case, `equipment_purchase_requests`). No es un módulo de "solicitudes comerciales" en el sentido genérico — es el sub-flujo transaccional de despacho dentro del ciclo de vida de una compra (pública o privada) ya aprobada: cuánto se ha pedido, cuánto aprobó operaciones, cuánto se despachó físicamente, y cuánto saldo queda contra el tope.

**Sin relación de código con `backend/src/modules/requests/`** (ver ese CONTEXT.md) — tablas distintas (`delivery_request`/`delivery_request_line`/`delivery_dispatch` vs `requests`/`request_types`), sin joins ni imports cruzados, sin overlap de endpoints. Comparten únicamente roles comerciales como consumidores y la palabra "request" en el nombre. Documentados por separado a propósito: son dominios de negocio distintos (solicitud administrativa genérica vs. despacho físico de inventario).

Controller: `deliveryRequests.controller.js` (validación Joi). Service: `deliveryRequests.service.js` (20KB — mayor complejidad de la esperada para 6 endpoints: incluye lógica de saldo/reserva, migración de esquema en runtime, y outbox de integración).

## 2. Roles

Definidos como constantes en `deliveryRequests.routes.js` (patrón distinto a `requests`, que declara arrays inline por ruta):

```js
MANAGER_ROLES         = [acp_comercial, gerencia, gerencia_general, jefe_comercial]
REQUEST_CREATOR_ROLES = [comercial, asesor_comercial, analista_comercial, backoffice, backoffice_comercial, ...MANAGER_ROLES]
OPS_APPROVE_ROLES     = [jefe_operaciones, operaciones, ...MANAGER_ROLES]
LOGISTICS_ROLES       = [jefe_logistica, ...MANAGER_ROLES]   // logistica base (sin jefe) NO confirma
CANCEL_ROLES          = [...MANAGER_ROLES]                    // solo managers cancelan
READ_ROLES            = REQUEST_CREATOR_ROLES + OPS_APPROVE_ROLES + LOGISTICS_ROLES
                         + [jefe_tecnico, jefe_servicio_tecnico, tecnico, servicio_tecnico]
```

## 3. Endpoints

Prefijo: `/api/v1/delivery-requests`

| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/` | `listDeliveryRequests` | READ_ROLES |
| POST | `/` | `createDeliveryRequest` | REQUEST_CREATOR_ROLES |
| POST | `/:id/ops-approve` | `opsApproveDeliveryRequest` | OPS_APPROVE_ROLES |
| POST | `/:id/cancel` | `cancelDeliveryRequest` | CANCEL_ROLES (solo managers) |
| POST | `/:id/confirm-delivery` | `confirmDeliveryRequest` | LOGISTICS_ROLES |
| GET | `/dispatches` | `listDeliveryDispatches` | READ_ROLES |

Todos los bodies se validan con esquemas Joi en el controller antes de llegar al service (`createDeliveryRequestSchema`, `opsApproveSchema`, `confirmDeliveryBodySchema`, etc.) — patrón de validación explícita ausente en `requests.controller.js`.

## 4. Flujo principal

1. **Crear** (`POST /`): comercial/backoffice/manager solicita entrega parcial contra un `ceilingId` activo, con líneas `{ ceilingLineId, requestedQty }` — reserva saldo (estado `pending`), no descuenta `delivered_qty` todavía.
2. **Aprobación OPS** (`POST /:id/ops-approve`): operaciones aprueba total o parcialmente por línea (`{ lineId, approvedQty }`); si se omiten `lines`, aprueba todo tal cual se pidió → estado `ops_approved`.
3. **Confirmación de despacho** (`POST /:id/confirm-delivery`): logística (rol `jefe_logistica` o manager — logística base NO puede) confirma el envío físico, crea un registro en `delivery_dispatch` + `delivery_dispatch_line` por ítem, y recién ahí descuenta contra `delivered_qty` del `delivery_ceiling_line` → estado `confirmed`.
4. **Cancelación** (`POST /:id/cancel`): solo managers, libera la reserva de saldo → estado `cancelled`.
5. **Consulta**: `GET /` lista `delivery_request` por ceiling/status; `GET /dispatches` lista el historial de despachos físicos (`delivery_dispatch`) con cantidades por ítem — visible a técnicos para planificación pre/post entrega.

Estados válidos de `delivery_request.status`: `pending`, `ops_approved`, `confirmed`, `cancelled` (constante `DELIVERY_REQUEST_STATUSES` en el service; nota: la constraint SQL `delivery_request_status_check` en la migración 127 solo permite `pending`/`confirmed`/`cancelled` — `ops_approved` se maneja a nivel aplicación, ver Riesgos).

**Reglas de saldo**: `OPEN_REQUEST_STATUSES = [pending, ops_approved]` — ambos estados retienen la reserva contra el tope hasta que logística despacha; `EPSILON = 1e-9` para comparaciones numéricas de punto flotante en cantidades.

## 5. Base de datos

**Migraciones dedicadas:**
- `backend/migrations/126_delivery_ceiling_tables.sql` — crea `delivery_ceiling` (FK a `equipment_purchase_requests.id`, i.e. Business Case) y `delivery_ceiling_line`
- `backend/migrations/127_delivery_requests.sql` — crea `delivery_request` y `delivery_request_line`, agrega `delivered_qty` + constraints a `delivery_ceiling_line`

**Tablas adicionales creadas en runtime** (NO en `migrations/`, sino vía `ensureDeliveryTables()` en `deliveryRequests.service.js` al arrancar el server — patrón "migración fantasma" a vigilar):
- `delivery_dispatch` — un registro por envío físico (`delivery_request_id`, `dispatched_by`, `dispatched_at`, `notes`)
- `delivery_dispatch_line` — cantidades por ítem dentro de un despacho (`delivery_dispatch_id`, `delivery_ceiling_line_id`, `dispatched_qty`)
- Columnas agregadas igual (`delivery_request_line.approved_qty`, `delivery_request.dispatch_notes`, `delivery_ceiling_line.max_quantity` vuelto nullable para "open orders" sin tope)

**Relaciones de tablas:**
```
equipment_purchase_requests (Business Case)
  └─ delivery_ceiling (1 por BC, purchase_type: public/private)
       └─ delivery_ceiling_line (ítem: reactivo/calibrador/control/material, max_quantity, delivered_qty)
            ├─ delivery_request_line ── delivery_request (pending → ops_approved → confirmed)
            └─ delivery_dispatch_line ── delivery_dispatch (envío físico confirmado)
```

## 6. Relaciones con otros módulos
- `business-case`: cada `delivery_ceiling` cuelga de un `business_case_id` (`equipment_purchase_requests.id`) — el tope de entrega nace del BC aprobado
- `private-purchases`: `createDeliveryRequest` acepta `privatePurchaseId` opcional para asociar la entrega a una compra privada específica
- `integrations` (`integrationOutbox.service`): encola eventos de integración al crear/confirmar solicitudes
- `notifications`: `notificationManager` notifica en los cambios de estado

## 7. Frontend asociado

**Producción:**
- `/dashboard/comercial/delivery-ceilings` → `spi_front/src/modules/comercial/pages/DeliveryCeilings.jsx` — pantalla dedicada de gestión de topes de entrega; usa `createDeliveryRequest`, `listDeliveryRequests`, `opsApproveDeliveryRequest`, `confirmDeliveryRequest` de `core/api/deliveryRequestsApi.js`
- `spi_front/src/modules/shared/purchases-workspace/expediente/tabs/SupplyControlTab.jsx` — tab "Control de suministro" dentro del expediente de compra (`purchases-workspace`), mismo API client, cubre creación y confirmación de entregas desde el workspace de la compra
- `core/api/deliveryRequestsApi.js` — cliente API dedicado (`listDeliveryCeilings`, `listDeliveryRequests`, `createDeliveryRequest`, `opsApproveDeliveryRequest`, `cancelDeliveryRequest`, `confirmDeliveryRequest`, `listDeliveryDispatches`)

**No aparece en absoluto en la pantalla "Solicitudes" (`Solicitudes.jsx`)** — confirmado por grep, ningún componente de `comercial/pages/Solicitudes.jsx` ni sus vistas hijas (`ComercialSolicitudesView`, `ACPComercialSolicitudesView`, etc.) importa `deliveryRequestsApi`. Es una pantalla y flujo completamente aparte, aunque ambos viven bajo `modules/comercial/pages/`.

## 8. Riesgos detectados
- `ensureDeliveryTables()` corre "fire-and-forget" al cargar el módulo (`ensureDeliveryTables().catch(() => {})`, línea 56) — errores de migración en runtime se tragan silenciosamente salvo por el log; si falla, las tablas `delivery_dispatch`/`delivery_dispatch_line` pueden no existir y las rutas de confirmación fallarán con error genérico de SQL
- Constraint SQL `delivery_request_status_check` (migración 127) permite solo `pending`/`confirmed`/`cancelled`, pero el código de aplicación usa también `ops_approved` como estado intermedio — sugiere que la constraint no se actualizó tras agregar el paso de aprobación OPS; verificar en DB real antes de asumir que el constraint bloquea `ops_approved`
- `deliveryRequests.service.js` (20KB) para 6 endpoints — la complejidad viene de la lógica de reservas/saldo y overbooking prevention, no trivial de tocar sin entender `OPEN_REQUEST_STATUSES`/`EPSILON`
- Rol `logistica` (base, sin jefe) explícitamente EXCLUIDO de confirmar entregas (`LOGISTICS_ROLES` solo incluye `jefe_logistica` + managers) — si un usuario con rol `logistica` reporta no poder confirmar, es comportamiento esperado, no bug
- `__tests__` presente

## 9. Notas técnicas
- DR-01 a DR-04 en comentarios de `deliveryRequests.routes.js` referencian requisitos internos (creadores, aprobación OPS, confirmación logística, historial de despachos) — útil para rastrear el porqué de cada grupo de roles
- `OPEN_ORDER_FALLBACK_ITEMS` — catálogo de fallback (Reactivo/Calibrador/Control/Material) cuando un `delivery_ceiling_line` no especifica ítems concretos ("open order" sin tope máximo)
