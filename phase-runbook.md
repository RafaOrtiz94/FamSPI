# Runbook por Fases

## Objetivo
Este archivo permite repartir el plan en bloques grandes sin que varias IAs se pisen entre si.

Uso esperado:

1. Cada chat o IA toma una sola fase.
2. Dentro de esa fase sigue el orden de micro-tareas definido en `prompts.md`.
3. Nadie trabaja dos fases al mismo tiempo sobre los mismos archivos.
4. El coordinador humano revisa este archivo antes de asignar trabajo.

## Archivos fuente

- Plan maestro: `plan.md`
- Prompts por micro-tarea: `prompts.md`
- Continuidad secuencial: `continue-runbook.md`
- Paralelizacion por fases: `phase-runbook.md`

## Reglas de asignacion

1. Una fase solo puede tener un `OWNER` activo.
2. Si una fase esta `in_progress`, otra IA no debe tocarla.
3. Si una fase depende de backend listo, no arranques el frontend de esa fase antes de tiempo.
4. Si una micro-tarea dentro de la fase exige mas de 3 archivos, se subdivide antes de seguir.
5. Si aparece un cruce con otra fase, se detiene y se marca `blocked`.

## Estados validos

- `pending`
- `ready`
- `in_progress`
- `blocked`
- `done`

## Prompt de arranque para una IA de fase

Pega esto al abrir un chat nuevo para una fase concreta:

```md
Trabaja sobre FamSPI usando `phase-runbook.md`, `prompts.md` y `plan.md`.

Reglas permanentes para este chat:
- Trabaja solo la fase que yo te indique.
- No toques otra fase.
- Dentro de la fase, ejecuta una sola micro-tarea por turno.
- Usa siempre el `Prefijo global` de `prompts.md`.
- Cuando yo escriba `continua`, debes:
  1. leer `phase-runbook.md`
  2. ubicar la fase asignada
  3. identificar `CURRENT_MT` de esa fase
  4. buscar en `prompts.md` el prompt exacto de esa micro-tarea
  5. ejecutar solo esa micro-tarea
  6. actualizar `phase-runbook.md`
- Si hay bloqueo, no avances la siguiente micro-tarea.
- Si necesitas mas de 3 archivos, subdivide y deja el bloqueo documentado.
```

## Tabla de fases

### FASE-0

- `NAME`: `Descubrimiento y contrato`
- `MT_RANGE`: `MT-000` a `MT-005`
- `DEPENDS_ON`: `none`
- `OWNER`: `unassigned`
- `STATUS`: `ready`
- `CURRENT_MT`: `MT-000`
- `LAST_COMPLETED_MT`: `none`
- `RESULT`: `pendiente`

### FASE-1

- `NAME`: `Backend de filtros administrativos`
- `MT_RANGE`: `MT-010` a `MT-020`
- `DEPENDS_ON`: `FASE-0`
- `OWNER`: `unassigned`
- `STATUS`: `pending`
- `CURRENT_MT`: `MT-010`
- `LAST_COMPLETED_MT`: `none`
- `RESULT`: `pendiente`

### FASE-2

- `NAME`: `Backend de consulta enriquecida`
- `MT_RANGE`: `MT-030` a `MT-047`
- `DEPENDS_ON`: `FASE-1`
- `OWNER`: `unassigned`
- `STATUS`: `pending`
- `CURRENT_MT`: `MT-030`
- `LAST_COMPLETED_MT`: `none`
- `RESULT`: `pendiente`

### FASE-3

- `NAME`: `Backend de seguridad, auditoria y robustez`
- `MT_RANGE`: `MT-060` a `MT-068`
- `DEPENDS_ON`: `FASE-1`, `FASE-2`
- `OWNER`: `unassigned`
- `STATUS`: `pending`
- `CURRENT_MT`: `MT-060`
- `LAST_COMPLETED_MT`: `none`
- `RESULT`: `pendiente`

### FASE-4

- `NAME`: `Frontend base y refactor del workspace`
- `MT_RANGE`: `MT-080` a `MT-089`
- `DEPENDS_ON`: `FASE-0`
- `OWNER`: `unassigned`
- `STATUS`: `pending`
- `CURRENT_MT`: `MT-080`
- `LAST_COMPLETED_MT`: `none`
- `RESULT`: `pendiente`

### FASE-5

- `NAME`: `Frontend de filtros, URL y persistencia`
- `MT_RANGE`: `MT-100` a `MT-118`
- `DEPENDS_ON`: `FASE-1`, `FASE-4`
- `OWNER`: `unassigned`
- `STATUS`: `pending`
- `CURRENT_MT`: `MT-100`
- `LAST_COMPLETED_MT`: `none`
- `RESULT`: `pendiente`

### FASE-6

- `NAME`: `Frontend de datos con React Query`
- `MT_RANGE`: `MT-130` a `MT-136`
- `DEPENDS_ON`: `FASE-5`
- `OWNER`: `unassigned`
- `STATUS`: `pending`
- `CURRENT_MT`: `MT-130`
- `LAST_COMPLETED_MT`: `none`
- `RESULT`: `pendiente`

### FASE-7

- `NAME`: `Frontend tabla administrativa premium`
- `MT_RANGE`: `MT-150` a `MT-158`
- `DEPENDS_ON`: `FASE-6`
- `OWNER`: `unassigned`
- `STATUS`: `pending`
- `CURRENT_MT`: `MT-150`
- `LAST_COMPLETED_MT`: `none`
- `RESULT`: `pendiente`

### FASE-8

- `NAME`: `Frontend de vista mapa`
- `MT_RANGE`: `MT-170` a `MT-194`
- `DEPENDS_ON`: `FASE-2`, `FASE-6`
- `OWNER`: `unassigned`
- `STATUS`: `pending`
- `CURRENT_MT`: `MT-170`
- `LAST_COMPLETED_MT`: `none`
- `RESULT`: `pendiente`

### FASE-9

- `NAME`: `UX premium, animaciones y responsive`
- `MT_RANGE`: `MT-210` a `MT-220`
- `DEPENDS_ON`: `FASE-7`, `FASE-8`
- `OWNER`: `unassigned`
- `STATUS`: `pending`
- `CURRENT_MT`: `MT-210`
- `LAST_COMPLETED_MT`: `none`
- `RESULT`: `pendiente`

### FASE-10

- `NAME`: `Pruebas y endurecimiento`
- `MT_RANGE`: `MT-230` a `MT-243`
- `DEPENDS_ON`: `FASE-3`, `FASE-9`
- `OWNER`: `unassigned`
- `STATUS`: `pending`
- `CURRENT_MT`: `MT-230`
- `LAST_COMPLETED_MT`: `none`
- `RESULT`: `pendiente`

## Politica de paralelizacion recomendada

Paralelo seguro sugerido:

- `FASE-0` sola
- luego `FASE-1` y `FASE-4` en paralelo
- luego `FASE-2` y `FASE-5` en paralelo si `FASE-1` y `FASE-4` ya cerraron
- luego `FASE-3` y `FASE-6` en paralelo
- luego `FASE-7` y `FASE-8` en paralelo
- luego `FASE-9`
- luego `FASE-10`

## Regla para `continua`

Si el chat fue asignado a una fase concreta, cuando el usuario escriba `continua` la IA debe:

1. leer este archivo
2. ubicar la fase asignada
3. leer `CURRENT_MT`
4. ir a `prompts.md`
5. tomar el prompt exacto de esa micro-tarea
6. ejecutar una sola micro-tarea
7. actualizar solo el bloque de esa fase

## Plantilla de actualizacion por fase

Si una micro-tarea termina:

- `LAST_COMPLETED_MT`: micro-tarea ejecutada
- `CURRENT_MT`: siguiente micro-tarea de la fase
- `STATUS`: `in_progress` o `done` si la fase termino
- `RESULT`: resumen corto

Si queda bloqueada:

- `CURRENT_MT`: no cambia
- `STATUS`: `blocked`
- `RESULT`: motivo exacto

## Registro de actividad

Formato:

```md
- 2026-04-16 | FASE-1 | MT-010 | owner: ia-backend-1 | completed | normalizador base creado
- 2026-04-16 | FASE-4 | MT-081 | owner: ia-frontend-1 | completed | estructura inicial creada
- 2026-04-16 | FASE-8 | MT-175 | owner: ia-map-1 | blocked | falta confirmar API key en entorno
```

## Registro

- sin actividad aun
