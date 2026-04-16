# Runbook: outbox de integracion SPI -> Odoo

- Ultima revision: 2026-04-11
- Alcance: `integration_outbox` + worker stub sin llamada HTTP real a Odoo.

---

## 1. Objetivo

Desacoplar eventos de integracion para que las rutas HTTP de SPI no esperen envio externo.

Flujo de estados:

`pending -> processing -> sent | failed | dead`

Con `ODOO_INTEGRATION_ENABLED=false`, el worker marca lote como `skipped` y no intenta envio.

---

## 2. Tabla outbox

- Migracion: `backend/migrations/129_integration_outbox.sql`
- Tabla: `public.integration_outbox`
- Campos clave:
  - `event_type`
  - `payload` (JSONB)
  - `idempotency_key` (UNIQUE)
  - `correlation_id`
  - `status`
  - `attempt_count`
  - `last_error`
  - `created_at`, `processed_at`, `updated_at`

---

## 3. API interna de encolado

Modulo:

- `backend/src/modules/integrations/integrationOutbox.service.js`

Funcion:

- `enqueueIntegrationEvent({ eventType, payload, idempotencyKey, correlationId, dbClient })`

Comportamiento:

1. Inserta fila `pending` con `ON CONFLICT (idempotency_key) DO NOTHING`.
2. Retorna:
   - `{ inserted: true, outbox_id, ... }` si crea fila.
   - `{ inserted: false, duplicate: true, ... }` si ya existe.
3. Si se entrega `dbClient`, usa la misma transaccion del cambio de negocio.

---

## 4. Worker

Script ejecutable:

```bash
node scripts/integration-outbox-worker.js
node scripts/integration-outbox-worker.js --limit=50 --max-attempts=5
```

Implementacion:

- `backend/src/modules/integrations/integrationOutboxWorker.service.js`
- `backend/scripts/integration-outbox-worker.js`

Notas:

- En esta tarea, el envio usa `sendToOdooStub(payload)`.
- Si `payload.simulate_failure === true`, el stub falla para probar reintentos/estado.

---

## 5. Formato recomendado de `idempotency_key`

Patron recomendado:

`<entidad>:<id>:<accion>[:<version>]`

Ejemplos:

- `delivery_request:88:created`
- `delivery_request:88:confirmed`
- `delivery_ceiling:101:status:active:v1`

Reglas:

1. Debe identificar un mensaje logico unico.
2. Debe ser deterministico para el mismo evento.
3. Si el evento se reintenta, debe reusar exactamente la misma key.

---

## 6. Integracion actual en negocio (v1)

El servicio de `delivery_request` encola eventos en la misma transaccion SQL:

- `delivery_request.created`
- `delivery_request.confirmed`

Con esto, si la transaccion de negocio falla, tampoco se persiste el evento outbox.

