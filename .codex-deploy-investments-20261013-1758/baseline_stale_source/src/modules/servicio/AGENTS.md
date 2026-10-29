# AGENTS.md — module agent: servicio

## Proposito
Gestionar workflows tecnicos de `servicio` sin mezclar tipos de flujo.

## Alcance exacto
- `workflowRegistry.service.js`
- `workflowStateMachine.service.js`
- `workflowAudit.service.js`
- `correctiveCases.service.js`
- `installationWorkflow.service.js`
- `withdrawalWorkflow.service.js`
- `trainingWorkflow.service.js`
- `externalCases.service.js`
- `servicio.routes.js`

## Activar cuando
- El bug/mejora pertenece a un workflow tecnico puntual.
- El cambio afecta transicion de estado de un workflow de servicio.

## Roles involucrados

`servicio_tecnico`, `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`,
`operaciones`, `jefe_operaciones`, `comercial`, `gerencia`

## Identificar el workflow correcto antes de editar

```bash
# Identificar qué workflow corresponde a la tarea:
grep -rn "workflowType\|workflow_type" backend/src/modules/servicio/workflowRegistry.service.js
```

## No usar cuando
- Entidad principal es `private-purchases`.
- Cambio principal es firma digital o notificacion.

## Limites de scope
- Maximo 3 archivos por tarea.
- Una tarea solo puede tocar 1 tipo de workflow (ej. solo retiro, solo entrenamiento).
- Prohibido mezclar FST de distintos numeros en la misma tarea.

## Verificacion minima

```bash
cd backend && npm run lint src/modules/servicio/
```

## Stop condition
- Si toca 2+ workflows tecnicos, detener y dividir.

## Handoff
- Business Case -> `backend/src/modules/business-case/AGENTS.md`
- Notificaciones -> `.agents/skills/notifications-skill.md`
- Firma -> `.agents/skills/signature-skill.md`
