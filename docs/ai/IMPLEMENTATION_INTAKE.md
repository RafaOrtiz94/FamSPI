# IMPLEMENTATION_INTAKE.md

Punto de entrada unico para ejecutar implementaciones con IA en FamSPI.

## Entradas obligatorias
1. Ruta de este dispatcher: `docs/ai/IMPLEMENTATION_INTAKE.md`
2. Ruta de requerimientos: `docs/ai/requirements/<archivo>.md`

## Secuencia obligatoria (no saltar pasos)
1. Leer `AGENTS.md` raiz.
2. Leer archivo de requerimientos indicado.
3. Identificar modulo principal (uno solo).
4. Leer AGENT local del modulo principal (si existe).
5. Leer `docs/ai/ROUTING_MAP.md` para elegir skills/agentes.
6. Generar plan en `docs/ai/plans/<id>_plan.md`.
7. Generar cola de micro-tareas en `docs/ai/tasks/<id>_tasks.md`.
8. Ejecutar solo la primera micro-tarea (salvo instruccion explicita de continuar).
9. Registrar cierre parcial/final en `docs/ai/closures/<id>_closure.md`.

## Reglas operativas duras
- No programar primero.
- No leer mas de 12 archivos por micro-tarea salvo bloqueo real.
- No editar mas de 3 archivos por micro-tarea por defecto (4 solo bloqueo justificado).
- Si una tarea toca 2 o mas modulos, usar `orchestrator-skill.md`.
- No ejecutar suites globales salvo necesidad demostrable.
- No cambiar contratos API, rutas publicas, roles ni estados salvo instruccion explicita.
- No hacer refactors amplios ni cambios cosmeticos no pedidos.

## Stop conditions
- Si una micro-tarea crece a >3 archivos, detener y dividir.
- Si requiere backend + frontend + DB, detener y orquestar por fases.
- Si hay ambiguedad funcional, detener y pedir aclaracion antes de editar.

## Formato obligatorio por micro-tarea ejecutada
Cada ejecucion debe devolver:
- objetivo
- modulo principal
- skill/agente elegido
- archivos leidos
- archivos editados
- verificacion ejecutada
- riesgo residual
- siguiente paso recomendado

## Archivos de salida obligatorios
- Plan: `docs/ai/plans/<id>_plan.md` usando `PLAN_TEMPLATE.md`
- Tareas: `docs/ai/tasks/<id>_tasks.md` usando `TASKS_TEMPLATE.md`
- Cierre: `docs/ai/closures/<id>_closure.md` usando `CLOSURE_TEMPLATE.md`

## Prompts de uso rapido

### Prompt minimo para iniciar implementacion nueva
```txt
Usa como dispatcher `docs/ai/IMPLEMENTATION_INTAKE.md`.
Usa este archivo de requerimientos: `docs/ai/requirements/<archivo>.md`.
Ejecuta la secuencia completa del dispatcher, crea plan y cola de micro-tareas, y ejecuta solo la primera micro-tarea.
```

### Prompt para continuar implementacion existente
```txt
Continua la implementacion usando `docs/ai/IMPLEMENTATION_INTAKE.md`.
Requerimiento: `docs/ai/requirements/<archivo>.md`.
Plan actual: `docs/ai/plans/<id>_plan.md`.
Tasks actuales: `docs/ai/tasks/<id>_tasks.md`.
Retoma desde la siguiente micro-tarea pendiente y actualiza closure.
```

### Prompt para validar lote ya implementado
```txt
Valida este lote implementado usando `docs/ai/IMPLEMENTATION_INTAKE.md`.
Requerimiento: `docs/ai/requirements/<archivo>.md`.
Plan: `docs/ai/plans/<id>_plan.md`.
Tasks: `docs/ai/tasks/<id>_tasks.md`.
Closure: `docs/ai/closures/<id>_closure.md`.
No implementes features nuevas; solo verifica cobertura, validaciones y riesgos residuales.
```
