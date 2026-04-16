# Starter Prompt

Copia y pega todo este bloque en un chat nuevo con la IA que va a ejecutar el plan:

```md
Trabaja sobre el repo FamSPI siguiendo un flujo secuencial y estricto por micro-tareas.

Lee estos archivos antes de hacer cualquier cosa:
- `AGENTS.md`
- `continue-runbook.md`
- `prompts.md`
- `plan.md`

Instrucciones permanentes para este chat:

1. Usa `AGENTS.md` como regla superior del repo.
2. Usa `continue-runbook.md` como fuente de estado.
3. Usa `prompts.md` como fuente del `Prefijo global` y del prompt exacto de cada micro-tarea.
4. Usa `plan.md` como mapa general del proyecto.
5. Cuando yo escriba `continua`, debes hacer exactamente esto:
   - abrir `continue-runbook.md`
   - identificar `CURRENT_MT`
   - abrir `prompts.md`
   - tomar el `Prefijo global`
   - tomar el prompt exacto de `CURRENT_MT`
   - ejecutar solo esa micro-tarea
   - actualizar `continue-runbook.md`
6. No ejecutes dos micro-tareas en la misma respuesta.
7. No toques mas de 1 a 3 archivos por micro-tarea.
8. No hagas refactor fuera del objetivo.
9. No cambies contratos existentes salvo lo pedido.
10. No toques `registerRoutes.js`, `app.js` ni `roles.js` salvo bloqueo real.
11. Si la micro-tarea requiere mas de 3 archivos, no avances: explica como subdividirla y deja el bloqueo registrado en `continue-runbook.md`.
12. Al final de cada micro-tarea responde con:
   - que cambiaste
   - archivos tocados
   - validacion ejecutada
   - riesgos o bloqueos restantes
13. Ejecuta solo verificacion minima focalizada del modulo tocado.

Comportamiento esperado:

- Si el runbook esta en `RUN_STATUS: idle` o `ready`, ejecuta la `CURRENT_MT`.
- Si el runbook esta en `RUN_STATUS: blocked`, primero explica el bloqueo exacto.
- Si `CURRENT_MT` es `none`, responde que el plan ya termino.

No empieces a improvisar el flujo. Sigue el runbook.
```

## Uso rapido

1. Abre un chat nuevo con la IA.
2. Pega el bloque anterior.
3. Luego escribe solo:

```md
continua
```

## Si quieres correr varias IAs en paralelo

En ese caso no uses este starter. Usa:

- `phase-runbook.md`

porque este archivo esta pensado para una sola linea secuencial de trabajo.
