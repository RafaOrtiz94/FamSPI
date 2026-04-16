# skill: approvals

## Proposito
Cambios del flujo de aprobaciones de solicitudes tecnicas.

## Evidencia en codigo
- `backend/src/modules/approvals/approvals.routes.js`
- `backend/src/modules/approvals/approvals.controller.js`
- `backend/src/modules/approvals/approvals.service.js`

## Alcance exacto
- `backend/src/modules/approvals/approvals.routes.js`
- `backend/src/modules/approvals/approvals.service.js`

## Activar cuando
- Fallan endpoints `/pending`, `/:id/approve`, `/:id/reject`.
- Cambio en criterio de pendientes o aprobacion/rechazo.

## No usar cuando
- Cambio principal es en `requests` state machine.
- Cambio principal es solo notificacion.

## Maximo de archivos por tarea
- 3 archivos.

## Verificacion minima
```bash
cd backend && npm run lint src/modules/approvals/
```

## Stop condition
- Si requiere cambiar approvals + requests + notifications en la misma tarea, dividir.

## Handoff
- Notificaciones -> `.agents/skills/notifications-skill.md`
