# AGENTS.md — module agent: integrations

## Proposito
Gestionar integraciones externas (CRM-FAM, casos externos, libro de
correspondencia de productos) con patron outbox, sin logica de negocio local.
La integracion a Odoo se elimino del sistema (Odoo ya no existe) -- ver
`git log` sobre este archivo si necesitas el historial de esa remocion.

## Alcance exacto
- `integrationOutbox.service.js`
- `integrationOutboxWorker.service.js` (hoy solo despacha eventos `crm.*`)
- `crm.service.js` / `crmWebhook.*`
- `productMap.service.js`
- `integrations.routes.js`

## Activar cuando
- Fallo en encolado/procesamiento outbox.
- Cambio de contrato con CRM-FAM o mapeo de productos.

## Config relacionada

- Migración: `129_integration_outbox.sql` y `125_integration_product_map.sql`

## Jobs relacionados

- `jobs/externalCaseSyncScheduler.js` — sincroniza casos externos periódicamente
- `jobs/crmSyncScheduler.js` — procesa la outbox filtrando `crm.%`

## No usar cuando
- Cambio principal es en modulo origen (business-case/private-purchases/etc).
- Cambio es solo feature flag/config sin codigo de integracion.

## Limites de scope
- Maximo 3 archivos por tarea.
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
