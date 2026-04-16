# AGENTS.md — module agent: integrations

## Proposito
Gestionar integracion Odoo con patron outbox, sin logica de negocio local.

## Alcance exacto
- `integrationOutbox.service.js`
- `integrationOutboxWorker.service.js`
- `odooClient.js`
- `odoo.service.js`
- `productMap.service.js`
- `hooks.js`
- `integrations.routes.js`

## Activar cuando
- Fallo en encolado/procesamiento outbox.
- Cambio de contrato con Odoo o mapeo de productos.

## Config relacionada

- `backend/src/config/odooIntegration.js` — credenciales y base URL de Odoo
- Migración: `129_integration_outbox.sql` y `125_integration_product_map.sql`

## Jobs relacionados

- `jobs/externalCaseSyncScheduler.js` — sincroniza casos externos periódicamente

## No usar cuando
- Cambio principal es en modulo origen (business-case/private-purchases/etc).
- Cambio es solo feature flag/config sin codigo de integracion.

## Limites de scope
- Maximo 3 archivos por tarea.
- No tocar `odooClient.js` y `hooks.js` en una sola micro-tarea salvo bug bloqueante.
- Prohibido agregar logica de dominio de FamSPI.

## Verificacion minima

```bash
cd backend && npm run lint src/modules/integrations/
```

## Stop condition
- Si un ajuste requiere tocar worker + hooks + cliente HTTP, detener y dividir.

## Handoff
- Migracion outbox -> `.agents/skills/db-migration-skill.md`
- Modulo origen del evento -> agente de ese modulo
