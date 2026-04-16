# skill: orchestrator

## Proposito
Router estricto de micro-tareas. No implementa; divide y delega.

## Activar cuando
- Solicitud toca 2+ modulos.
- Requiere DB + backend + frontend.
- Scope ambiguo o de state machine sensible.

## No usar cuando
- Bug puntual de 1 modulo y 1-3 archivos.

## Protocolo obligatorio
1. No programar primero.
2. Definir modulo principal unico por micro-tarea.
3. Limitar cada micro-tarea a 1-3 archivos.
4. Ejecutar solo la primera micro-tarea.
5. Recalcular plan despues de cada micro-tarea.
6. Si tarea excede 3 archivos, detener y redividir.
7. Prohibido barrido global del repo salvo bloqueo real.
8. Prohibido refactor amplio no pedido.

## Orden por defecto
1) `db-migration-skill` (si aplica)  
2) module agent backend principal  
3) skill transversal (notifications/signature/integrations)  
4) `frontend-skill`  
5) validacion minima focalizada

## Maximo de archivos por micro-tarea
- 3 (duro). 4 solo bug bloqueante justificado.

## Stop condition
- Si plan supera 8 micro-tareas, dividir en fases.
