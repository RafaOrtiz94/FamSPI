# AGENTS.md — module agent: private-purchases

## Proposito
Cambios de compras privadas con su state machine y eventos de entrega.

## Alcance exacto
- `privatePurchaseStateMachine.js`
- `privatePurchaseStates.constants.js`
- `privatePurchaseEvents.js`
- `privatePurchases.service.js`
- `privatePurchases.acta.js`

## Activar cuando
- Cambio de estado o regla de flujo de compra privada.
- Ajuste de acta/PDF ligado a compra privada.

## No usar cuando
- Cambios de entrega tecnica en flujo `servicio`.
- Cambios de notificacion transversal.

## Limites de scope
- Maximo 3 archivos por tarea.
- En `privatePurchases.service.js`, editar solo funcion localizada.
- No tocar rutas/controlador salvo tarea explicita de contrato API.

## Verificacion minima
```bash
cd backend && npm run lint src/modules/private-purchases/
```

## Stop condition
- Si una tarea pide tocar state machine + service + controller, dividir en micro-tareas.

## Handoff
- Entregas tecnicas -> `backend/src/modules/servicio/AGENTS.md`
- Notificaciones -> `.agents/skills/notifications-skill.md`
- Migracion -> `.agents/skills/db-migration-skill.md`
