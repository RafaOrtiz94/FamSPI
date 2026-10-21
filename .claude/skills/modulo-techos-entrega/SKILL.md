---
name: modulo-techos-entrega
description: Mapa real de "Techos de entrega" (delivery ceilings) — quién lee, quién escribe, y por qué hay dos implementaciones de escritura que no se tocan entre sí. Úsalo antes de tocar delivery-ceilings, delivery-requests, o el "servicio de soporte" deliveryCeiling.service.js dentro de business-case — el módulo que parece dueño de la lógica de negocio (business-case/deliveryCeiling.service.js) no tiene ningún caller real en producción.
---

# Skill: Techos de entrega (delivery ceilings) — FamSPI

Antes de tocar techos/saldos de entrega, lee esto. El bug real más probable en esta área: asumir que `business-case/deliveryCeiling.service.js` es la fuente de verdad de cómo se crean/transicionan los techos, cuando en realidad **no lo llama nadie**.

---

## Los 3 módulos involucrados (ninguno se llama "el dueño" solo)

1. **`backend/src/modules/delivery-ceilings/`** — solo lectura. Un único endpoint: `GET /api/v1/delivery-ceilings`. Lista techos + líneas + saldos calculados (`delivered_qty`, `reserved_open_qty`, `remaining_qty`, `remaining_effective_qty`). No crea ni modifica nada.

2. **`backend/src/modules/business-case/deliveryCeiling.service.js`** — servicio completo (534 líneas): `createDraft`, `addLine`, `transitionStatus` con state machine `draft→approved→active→closed`, validación de constraints, y auditoría en `delivery_ceiling_audit`. **Confirmado por grep: nada lo importa salvo su propio test** (`business-case/__tests__/deliveryCeiling.service.test.js`). No está montado detrás de ninguna ruta HTTP. Es documentado en `business-case/CONTEXT.md` como "servicio de soporte" — eso es LEGACY/aspiracional, no producción.

3. **`backend/src/modules/delivery-requests/deliveryRequests.service.js`** — el path que sí corre en producción. Función `createOpenOrderCeiling` (~línea 1286) crea el `delivery_ceiling` directo en `status='active'` (sin pasar por `draft`/`approved`) + 4 líneas sin máximo, con SQL crudo inline, **sin usar nada de `business-case/deliveryCeiling.service.js`** y **sin escribir en `delivery_ceiling_audit`**. Solo cubre el caso "compra privada sin Business Case" (open order).

**Pregunta abierta no resuelta en el código**: no se encontró ningún `INSERT INTO delivery_ceiling` para el caso "techo ligado a un `business_case_id`" (el caso no-open-order). Si vas a trabajar en ese flujo, primero confirma con grep (`INSERT INTO.*delivery_ceiling`) si ya existe o si hay que construirlo — no asumas que `business-case/deliveryCeiling.service.js` ya lo resuelve solo por existir.

---

## Regla práctica antes de escribir código nuevo

- ¿Vas a **crear/aprobar/cerrar** un techo? → mira primero si el caso ya lo cubre `delivery-requests/createOpenOrderCeiling`. Si necesitas el flujo `draft→approved→active→closed` completo con auditoría, `business-case/deliveryCeiling.service.js` ya tiene el código — pero tendrás que **conectarlo** a una ruta (hoy no existe ninguna), no asumas que ya está en producción.
- ¿Vas a **leer** techos/saldos? → usa `delivery-ceilings` (`GET /api/v1/delivery-ceilings`). Es el único consumidor real desde frontend.
- No dupliques `mapCeiling`/`mapLine` — ya existen 2 copias casi idénticas (`delivery-ceilings/deliveryCeilings.service.js` y `business-case/deliveryCeiling.service.js`); no agregues una tercera.

---

## Inconsistencia real: qué cuenta como "reservado"

- `delivery-ceilings/deliveryCeilings.service.js` (el GET de saldos) usa `OPEN_REQUEST_STATUSES = ["pending"]` — solo cuenta solicitudes `pending` como reserva.
- `delivery-requests/deliveryRequests.service.js` (la validación real al crear una solicitud) usa `OPEN_REQUEST_STATUSES = ["pending", "ops_approved"]` — cuenta también las ya aprobadas por Operaciones.

Efecto: una solicitud `ops_approved` (aprobada, pendiente de despacho) **no descuenta saldo visible** en `GET /delivery-ceilings`, pero **sí bloquea** una nueva solicitud que la excedería. El saldo que ve el usuario en pantalla puede ser más optimista que el saldo real disponible. Si tocas cualquiera de los dos archivos, sincroniza esta constante primero — no la cambies en uno solo sin revisar el otro.

---

## Tablas (migración base: `backend/migrations/126_delivery_ceiling_tables.sql`)

- `public.delivery_ceiling` — cabecera. `business_case_id` (UUID, nullable) **o** `private_purchase_id` (agregado en `130_workflow_alignment.sql`, para open orders). `status`: `draft|approved|active|closed`. Único índice parcial: máximo un techo abierto (`draft|approved|active`) por `business_case_id`.
- `public.delivery_ceiling_line` — líneas por ítem. `max_quantity` es **nullable** (NULL = sin límite, usado en open orders) — pero `mapLine()` en ambos services trata `max_quantity` ausente como `0` al calcular saldo, no como "ilimitado". Cuidado si vas a mostrar/usar saldo de una línea open-order.
- `public.delivery_ceiling_audit` — existe en el schema pero casi no se usa: solo la escribe el servicio "muerto" de business-case (§2 arriba). El path real (`createOpenOrderCeiling`) no la toca.
- `public.delivery_request` / `public.delivery_request_line` (módulo `delivery-requests`) — solicitudes de entrega contra un techo.
- `public.delivery_dispatch` / `public.delivery_dispatch_line` — despachos físicos confirmados por logística.
- `public.public_delivery_plan` / `public.public_delivery_plan_line` (módulo `public-delivery-plans`, migración `128_public_delivery_plan.sql`) — planes de entrega por tramos para compras públicas; `delivery-requests` los consulta para validar ventana de entrega (`OUTSIDE_DELIVERY_WINDOW`).

---

## Roles (definidos localmente en cada `*.routes.js`, no en `ROLE_GROUPS` de `middlewares/roles.js`)

- **Lectura de techos** (`delivery-ceilings`): `comercial, backoffice_comercial, acp_comercial, jefe_comercial, gerencia, gerencia_general, jefe_operaciones, operaciones, jefe_logistica, jefe_tecnico, jefe_servicio_tecnico, tecnico, servicio_tecnico`.
- **Crear solicitud** (`delivery-requests`, DR-01): `comercial, asesor_comercial, analista_comercial, backoffice, backoffice_comercial` + managers (`acp_comercial, gerencia, gerencia_general, jefe_comercial`).
- **Aprobar Ops** (DR-02): `jefe_operaciones, operaciones` + managers.
- **Confirmar despacho** (Logística, DR-02): `jefe_logistica` + managers (nota: `logistica` base, sin "jefe", NO confirma).
- **Cancelar**: solo managers.

---

## Frontend

- `spi_front/src/modules/comercial/pages/DeliveryCeilings.jsx` — página standalone, ruta `/dashboard/comercial/delivery-ceilings`. Lista techos, expande cada uno para crear/aprobar/confirmar/cancelar solicitudes.
- `spi_front/src/modules/shared/purchases-workspace/expediente/tabs/SupplyControlTab.jsx` — mismo patrón, embebido como tab del expediente de una compra.
- Ambos usan `spi_front/src/core/api/deliveryRequestsApi.js`, que pese al nombre expone tanto `listDeliveryCeilings` (GET `/delivery-ceilings`) como todos los endpoints de `/delivery-requests`. No hay un `deliveryCeilingsApi.js` separado — no lo crees pensando que falta, ya está cubierto ahí.
- **Gotcha de roles no sincronizados**: `AppRoutes.jsx` envuelve la ruta `/dashboard/comercial/delivery-ceilings` en un `ProtectedRoute` con `allowedRoles=["comercial","jefe_comercial","jefe_financiero","gerencia","gerencia_general"]` — más angosto que los roles que el propio componente (`VIEW_ROLES`) y el backend sí permiten (`jefe_operaciones, operaciones, jefe_logistica, admin, administrador`). Si vas a dar acceso directo por URL a Operaciones/Logística, revisa primero el `ProtectedRoute`, no solo el componente.

---

## Checklist antes de tocar este módulo

1. ¿Vas a **crear/escribir** un techo? → decide primero si el caso es "open order" (usa `delivery-requests/createOpenOrderCeiling`, patrón real) o "ligado a BC" (no hay path real confirmado — investiga antes de asumir que `business-case/deliveryCeiling.service.js` ya funciona, porque no está conectado a ninguna ruta).
2. ¿Vas a **leer** saldos? → `delivery-ceilings/deliveryCeilings.service.js` es la única fuente; no dupliques el cálculo de `remaining_effective_qty` en otro lugar.
3. ¿Vas a tocar `OPEN_REQUEST_STATUSES`? → sincroniza `delivery-ceilings/deliveryCeilings.service.js` y `delivery-requests/deliveryRequests.service.js` a la vez (ver inconsistencia arriba).
4. ¿Vas a exponer un endpoint de escritura nuevo para techos? → decide explícitamente si reutilizas la lógica de `business-case/deliveryCeiling.service.js` (state machine + auditoría, pero nunca probada en producción) o el patrón simple de `delivery-requests` (SQL directo, sin auditoría) — no mezcles ambos sin documentar la decisión.
5. Backend: syntax-check con `node -e "require('./ruta')"`, `npx eslint <archivo>`. Frontend: `npx eslint <archivo>`.
