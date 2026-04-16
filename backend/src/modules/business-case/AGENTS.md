# AGENTS.md — module agent: business-case

## Proposito
Gestionar cambios del flujo Business Case con state machine, permisos y readiness.

## Alcance exacto
- `businessCaseStateMachine.js`
- `businessCaseStates.constants.js`
- `businessCasePermissions.js`
- `businessCaseDataOwnership.js`
- `BusinessCaseOrchestrator.service.js`
- `businessCase.service.js`
- `businessCaseStateMachineReadiness.js`

## Activar cuando
- Cambio de estado, readiness o permisos de Business Case.
- Ajuste de calculo/scoring dentro del mismo modulo.

## No usar cuando
- Cambio es solo de UI (usar `frontend-skill.md`).
- Cambio es solo notificacion transversal (usar `notifications-skill.md`).
- Cambio es solo migracion DB (usar `db-migration-skill.md`).

## Limites de scope
- Maximo 3 archivos por tarea (4 solo si incluye test puntual).
- Prohibido tocar controlador+rutas+state machine en la misma micro-tarea.
- No leer el modulo completo; iniciar por archivo objetivo.

## Verificacion minima
```bash
cd backend && npm run lint src/modules/business-case/
```

## Stop condition
- Si requiere cambiar 2+ capas (state machine + orchestrator + calculadora), detener y dividir.

## Handoff
- Integraciones Odoo -> `backend/src/modules/integrations/AGENTS.md`
- Notificaciones -> `.agents/skills/notifications-skill.md`
