# CONTEXT.md — delivery-ceilings

## 1. Descripción
Módulo de **solo lectura** para consultar "techos" (máximos) de entrega por Business Case o compra privada, junto con sus líneas de ítems (cantidad máxima, entregado, reservado, saldo). No crea ni modifica techos: la creación/transición de estado vive en **otros dos módulos** (ver sección 6 — "Relación real con business-case").

Controller: `deliveryCeilings.controller.js`. Service: `deliveryCeilings.service.js` (~220 líneas, un solo query compuesto + cálculo de saldos).

## 2. Roles

`DELIVERY_CEILING_READ_ROLES` (hardcodeado en `deliveryCeilings.routes.js`, no usa `ROLE_GROUPS` de `middlewares/roles.js`):
```
comercial, backoffice_comercial, acp_comercial, jefe_comercial,
gerencia, gerencia_general,
jefe_operaciones, operaciones,
jefe_logistica,
jefe_tecnico, jefe_servicio_tecnico,
tecnico, servicio_tecnico
```

## 3. Endpoints

Prefijo: `/api/v1/delivery-ceilings`

| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/` | `listDeliveryCeilings` | `DELIVERY_CEILING_READ_ROLES` (arriba) |

Query params (validados con Joi en el controller): `ceilingId`, `businessCaseId` (uuid), `privatePurchaseId` (int o texto), `status` (`draft\|approved\|active\|closed`), `purchaseType` (`private\|public`), `page`, `limit` (máx 200).

Respuesta: `{ ok, data: { page, limit, total, rows: [ceiling...], open_statuses_used_for_reservation } }`. Cada `ceiling` incluye `lines[]` con `max_quantity`, `delivered_qty`, `reserved_open_qty`, `remaining_qty`, `remaining_effective_qty`.

**No hay endpoints de escritura en este módulo.** Crear/aprobar/activar/cerrar un techo, y agregar líneas, se hace desde otros módulos (ver §6).

## 4. Flujo principal (uso real, combinando 3 módulos)

1. Un `delivery_ceiling` se crea (hoy, en producción, solo vía `delivery-requests` — ver §6.2).
2. Frontend (`DeliveryCeilingsPage` o `SupplyControlTab`) llama `GET /api/v1/delivery-ceilings` para listar techos + saldos.
3. Comercial arma una `delivery_request` contra un techo `active` (módulo `delivery-requests`, `POST /api/v1/delivery-requests`).
4. Operaciones aprueba (`POST /delivery-requests/:id/ops-approve`), Logística confirma despacho (`POST /delivery-requests/:id/confirm-delivery`) → decrementa saldo (`delivered_qty`).
5. El saldo mostrado por este módulo (`remaining_effective_qty`) descuenta lo ya entregado y lo reservado por solicitudes abiertas.

## 5. Base de datos

Migración base: `backend/migrations/126_delivery_ceiling_tables.sql`. Alteraciones posteriores: `130_workflow_alignment.sql` (agrega `private_purchase_id` FK), `162_cutover_delivery_planning_columns.sql`, `164_delivery_request_ops_workflow.sql`.

- **`public.delivery_ceiling`** — cabecera: `business_case_id` (UUID, FK a `equipment_purchase_requests`, nullable) **o** `private_purchase_id` (agregado en migración 130, para compras privadas sin BC — "open orders"), `purchase_type` (`private`/`public`), `status` (`draft`/`approved`/`active`/`closed`), `valid_from`/`valid_to`, `notes`. Único índice parcial: solo un techo `draft|approved|active` abierto por `business_case_id` a la vez.
- **`public.delivery_ceiling_line`** — líneas por ítem: `max_quantity` (nullable — NULL = sin máximo, usado en "open orders"), `unit`, `item_type` (`equipment|reagent|determination|calibrator|control|additional_investment|service`), referencia a `equipment_model_id` o `integration_product_map_id` (uno de los dos requerido), `delivered_qty` (columna agregada por `deliveryRequests.service.js#ensureDeliveryTables`, no está en la migración 126 original).
- **`public.delivery_ceiling_audit`** — tabla de auditoría de acciones (`create_draft`, `add_line`, `status_transition`). **Existe en el schema pero prácticamente no se usa en producción**: solo la escribe `business-case/deliveryCeiling.service.js`, que a su vez no tiene ningún caller real (ver §6.1). El path de escritura real (`delivery-requests/createOpenOrderCeiling`) no inserta auditoría.
- Tablas relacionadas usadas para calcular reservas: `public.delivery_request` / `public.delivery_request_line` (módulo `delivery-requests`), `public.delivery_dispatch` / `public.delivery_dispatch_line`, `public.public_delivery_plan` / `public.public_delivery_plan_line` (módulo `public-delivery-plans`, migración 128).

## 6. Relación real con `business-case` (IMPORTANTE — duplicación de lógica)

Hay **dos implementaciones distintas** que escriben en `delivery_ceiling` / `delivery_ceiling_line`, y ninguna vive en este módulo (`delivery-ceilings`):

### 6.1 `backend/src/modules/business-case/deliveryCeiling.service.js` (534 líneas) — código sin caller real
Expone `createDraft`, `addLine`, `transitionStatus` (state machine `draft→approved→active→closed`), con transacciones, validación de constraints (`purchase_type`, `item_type`), manejo de errores Postgres (`23505`/`23503`/`23514`) y **auditoría completa** vía `insertAuditEvent` → `delivery_ceiling_audit`. Es, con diferencia, la implementación más robusta y completa de las dos.

Sin embargo, **grep confirma que ninguna ruta ni controller de `business-case` (ni de ningún otro módulo) importa este archivo** — el único importador es su propio test (`business-case/__tests__/deliveryCeiling.service.test.js`). No está montado detrás de ningún endpoint HTTP. Es documentado en `business-case/CONTEXT.md` §6 como "servicio de soporte" pero en la práctica es **código muerto en producción** (probablemente el diseño original antes de que `delivery-requests` implementara su propio flujo simplificado).

### 6.2 `backend/src/modules/delivery-requests/deliveryRequests.service.js#createOpenOrderCeiling` (línea ~1286) — el path real
Auto-crea un `delivery_ceiling` (`status='active'` directo, sin pasar por `draft`/`approved`) + 4 líneas sin máximo (`max_quantity = NULL`) para compras privadas que usan control de insumos "open orders" (sin Business Case asociado). Usa SQL crudo inline, **no reutiliza `mapCeiling`/`mapLine`/las validaciones de `business-case/deliveryCeiling.service.js`**, y **no escribe en `delivery_ceiling_audit`**. Es idempotente (verifica existencia antes de crear).

**No se encontró en el código ningún path de creación para techos ligados a `business_case_id`** (el caso "normal", no open-order) — ni en `business-case` ni en `delivery-requests`. Si existe, no quedó localizado por grep de `INSERT INTO.*delivery_ceiling`; puede crearse manualmente/por script, o ser un flujo pendiente de implementar. **Marcar como pregunta abierta antes de asumir que el flujo público/BC-based está completo.**

### Conclusión
- `delivery-ceilings` (este módulo) = **solo lectura**, agnóstico de quién escribió los datos.
- `business-case/deliveryCeiling.service.js` = servicio "de catálogo" completo pero no conectado a ninguna ruta — no lo asumas como fuente de verdad de cómo se crean techos hoy.
- `delivery-requests/createOpenOrderCeiling` = el creador real (solo para compras privadas "open order").
- No son dos vistas del mismo dato: son dos implementaciones paralelas con reglas de negocio distintas (state machine completo vs. creación directa en `active`).

## 7. Inconsistencia corregida: cálculo de "reservado"

- `deliveryCeilings.service.js` (este módulo, en el GET) calcula `reserved_open_qty` sumando `delivery_request_line` de requests con `status = ANY(OPEN_REQUEST_STATUSES)`.
- `deliveryRequests.service.js` (módulo hermano, valida saldo al crear una request) usa `OPEN_REQUEST_STATUSES = ["pending", "ops_approved"]` (línea 60).

Antes, `deliveryCeilings.service.js` solo incluía `["pending"]` — una solicitud ya aprobada por Operaciones (`ops_approved`, pendiente solo de despacho) no se contaba como reservada en la vista de saldos, pero sí bloqueaba saldo al validar una nueva solicitud en `delivery-requests`, mostrando un saldo más alto de lo realmente disponible. **Fix aplicado**: `deliveryCeilings.service.js` ahora también usa `OPEN_REQUEST_STATUSES = ["pending", "ops_approved"]`, sincronizado con `delivery-requests`. Si se toca cualquiera de los dos archivos, mantener esta constante sincronizada.

## 8. Frontend asociado

- `spi_front/src/modules/comercial/pages/DeliveryCeilings.jsx` → ruta `/dashboard/comercial/delivery-ceilings` (`DeliveryCeilingsPage`). Página standalone: lista techos + saldos, expande cada techo para ver/crear `delivery_request` y aprobar/confirmar/cancelar (llama a `core/api/deliveryRequestsApi.js`, que mezcla `GET /delivery-ceilings` con los endpoints de `/delivery-requests`).
- `spi_front/src/modules/shared/purchases-workspace/expediente/tabs/SupplyControlTab.jsx` → mismo patrón (techos + requests + dispatches) pero embebido como tab dentro del expediente de una compra.
- Ambos frontends consumen el mismo `listDeliveryCeilings` de `core/api/deliveryRequestsApi.js` (que pese al nombre del archivo, expone tanto delivery-ceilings como delivery-requests).
- **Gotcha de roles**: el `ProtectedRoute` que envuelve `/dashboard/comercial/delivery-ceilings` en `AppRoutes.jsx` (línea ~317) solo permite `["comercial", "jefe_comercial", "jefe_financiero", "gerencia", "gerencia_general"]`. La página en sí (`VIEW_ROLES` en `DeliveryCeilings.jsx`) permite además `jefe_operaciones`, `operaciones`, `jefe_logistica`, `admin`, `administrador` — igual que el backend (`DELIVERY_CEILING_READ_ROLES`). Un usuario `jefe_operaciones`/`jefe_logistica`/`operaciones` que navegue directo a esa URL puede quedar bloqueado por `ProtectedRoute` aunque el backend y el componente lo permitirían. Verificar si llegan a esa página solo vía el link del `NavigationBar` (que si aparece para roles gerencia/comercial) o si hay un caso real de acceso directo bloqueado.

## 9. Riesgos y notas técnicas

- Módulo con un solo endpoint real; toda la lógica de escritura vive fuera de él (ver §6) — no busques mutaciones aquí.
- `deliveryCeilings.service.js` no usa transacciones (es un GET compuesto: 2-3 queries en paralelo/secuencia), no hay lock de filas.
- Redondeo de cantidades a 3 decimales vía `toRounded` (único símbolo cubierto por test unitario, `__tests__/deliveryCeilings.helpers.test.js`).
- `delivery_ceiling_line.max_quantity` es nullable (línea "open order" sin máximo) — el cálculo de `remaining_qty`/`remaining_effective_qty` en `mapLine` trata `max_quantity` ausente como `0` (`Number(row.max_quantity || 0)`), lo que puede mostrar saldo `0` para líneas "sin límite" en vez de indicar "ilimitado". Revisar antes de confiar en ese campo para líneas open-order.
- Ver `business-case/CONTEXT.md` §6 y §11 (menciona `deliveryCeiling.service.js` como "servicio de soporte" — hoy inexacto, ver §6.1 arriba).
