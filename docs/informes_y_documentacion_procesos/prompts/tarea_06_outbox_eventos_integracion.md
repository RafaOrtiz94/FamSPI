# Tarea 06 — Outbox de eventos para integración (cola + idempotencia)

---INICIO PROMPT TAREA 06---

## Rol

Desarrollador full stack senior en **FamSPI**. Rol base: `prompt_desarrollador_fullstack_integraciones_erp.md`. **Dependencia:** tarea 01 (flag). **Opcional:** tareas 03–04 para emitir eventos reales.

## Requisitos que DEBEN quedar cumplidos

- **REQ-SPI-012** — Emitir eventos sin bloquear HTTP (escritura outbox en misma transacción que el cambio de negocio cuando aplique).
- **INT-ODOO-002** — `correlation_id` + clave idempotente única por mensaje lógico.
- **INT-ODOO-003** — Cola desacoplada: tabla outbox + proceso worker (script o cron interno) que marque `pending→processing→sent|failed|dead`.

## Tarea concreta

1. Tabla `integration_outbox` con columnas mínimas: `id`, `event_type`, `payload` (JSONB), `idempotency_key` (UNIQUE), `correlation_id`, `status`, `attempt_count`, `last_error`, `created_at`, `processed_at`.
2. Función `enqueueIntegrationEvent({ eventType, payload, idempotencyKey, correlationId })` que inserte con `ON CONFLICT (idempotency_key) DO NOTHING` y retorne si insertó o era duplicado.
3. Worker ejecutable vía `node scripts/integration-outbox-worker.js` (ruta al gusto) que:
   - Procese batch de N mensajes `pending`.
   - Si `ODOO_INTEGRATION_ENABLED=false`, marque como `skipped` o no seleccione filas (documentar comportamiento).
4. No implementar llamada HTTP real a Odoo en esta tarea: el worker solo debe **simular** éxito (log) o invocar un stub `sendToOdooStub(payload)`.

## No hacer

- No bloquear requests del usuario esperando el worker.
- No duplicar mensajes ante reintento del mismo evento de negocio (usar idempotency key derivada de entidad+acción).

## Entregables

- Migración + módulo de cola + worker script.
- Documentar formato de `idempotency_key` recomendado (ej. `ceiling:{id}:status:active`).

## Checklist de verificación (Definition of Done)

- [ ] Doble llamada a `enqueueIntegrationEvent` con misma key no crea segunda fila.
- [ ] Worker procesa al menos un mensaje de prueba insertado manualmente o vía test.
- [ ] Con flag off, el sistema no intenta “enviar” (comportamiento acorde a la doc de tarea 01).
- [ ] Resumen final: **"REQ cumplidos: REQ-SPI-012; INT-ODOO-002; INT-ODOO-003 (outbox+worker stub)."**

---FIN PROMPT TAREA 06---
