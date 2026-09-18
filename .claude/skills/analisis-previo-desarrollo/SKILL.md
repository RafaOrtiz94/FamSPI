---
name: analisis-previo-desarrollo
description: Auditoría obligatoria del código real (backend+frontend) y de la documentación de procedimientos ANTES de implementar cualquier funcionalidad nueva o reorganización en FamSPI. Detecta qué ya existe, qué está duplicado/fragmentado en la UI y qué es código muerto, para no repetir trabajo ni reconstruir algo que ya funciona. Úsalo antes de escribir código cuando el usuario pida agregar, reorganizar o "unificar" una funcionalidad — sobre todo si el alcance parece grande o hay documentación de por medio.
---

# Skill: Análisis previo al desarrollo — FamSPI

Antes de escribir una sola línea de implementación, verifica qué existe de verdad. La documentación de procedimientos y requerimientos de este proyecto se desactualiza (ver caso real: `docs/Procedimientos/Servicio/LEVANTAMIENTO_REQUERIMIENTOS_AUTOMATIZACION_ST.md` marcaba REXIS/Navify/GoApp como "no evidenciado" cuando ya estaba implementado con más de 2000 líneas de código). Nunca confíes en el "estado actual" que dice un documento — confirma leyendo el código.

---

## Cuándo invocar esta skill

- El usuario pide agregar, reorganizar, "unificar" o "limpiar" una funcionalidad o módulo.
- Existe documentación de procedimientos/requerimientos para el área (`docs/Procedimientos/**`, `docs/plans/**`, `CONTEXT.md` de módulos) que el usuario menciona o que es razonable que exista.
- El alcance pedido por el usuario podría chocar con algo que ya existe pero está disperso, mal enlazado o duplicado.

No hace falta si la tarea es un fix puntual y acotado a un archivo ya identificado (bug conocido, línea concreta).

---

## Proceso obligatorio (en este orden)

### Paso 1 — Leer la documentación de procedimientos disponible

Si existe una carpeta de procedimientos/requerimientos para el dominio (ej. `docs/Procedimientos/<Area>/`), léela completa antes de proponer nada. Trátala como un **mapa de qué buscar**, no como la verdad sobre qué existe.

### Paso 2 — Auditar el código real (no la documentación)

Para cada artefacto que la documentación dice que existe o falta:
- Búscalo con Grep/Glob en el código real.
- Si existe, confirma que está **vivo**: importado desde una ruta activa (`AppRoutes.jsx`, `registerRoutes.js`), no solo presente como archivo huérfano.
- Si la tarea es amplia (más de ~5 archivos a inspeccionar), delega la búsqueda a un agente `Explore` o `general-purpose` en vez de leer todo tú mismo — así no gastas el contexto principal en exploración bruta.

### Paso 3 — Producir un inventario verificado

Organiza los hallazgos en tablas compactas:
1. **Backend**: archivo → qué hace → a qué requerimiento/procedimiento corresponde.
2. **Frontend**: página/componente → ruta real → estado (`flujo completo real` / `placeholder` / `código muerto`).
3. **Duplicación/fragmentación**: mismo dato o funcionalidad gestionable desde 2+ pantallas con lógica o estilo distinto.
4. **Gaps reales**: qué de lo pedido por la documentación genuinamente no existe en el código (verificado, no copiado del documento).
5. **Código muerto candidato**: archivos sin imports activos — confírmalo con Grep antes de proponer borrarlos.

### Paso 4 — Confirmar alcance antes de codear

Si el hallazgo cambia el alcance esperado (hay menos por construir de lo que parecía, o hay más ambigüedad de la esperada), usa `AskUserQuestion` para confirmar cómo proceder **antes** de escribir implementación. No asumas que "más grande es mejor" ni que hay que reconstruir algo que ya funciona.

### Paso 5 — Preferir reutilizar sobre reconstruir

Al implementar:
- Si algo ya existe y funciona, extiéndelo — no lo dupliques ni lo reescribas.
- Si algo existe pero está muerto o duplicado, bórralo (confirmando primero con Grep que no tiene referencias vivas) antes de agregar algo nuevo encima.
- Si falta un enlace de UI (una ruta sin pantalla amigable, un flujo sin filtro consistente), la solución suele ser una conexión delgada entre piezas existentes, no una pantalla nueva.

### Paso 6 — Verificar tras el cambio

- Lint de los archivos tocados.
- Grep de cualquier símbolo/archivo borrado para confirmar cero referencias colgantes.
- Build o test suite cuando sea viable.

---

## Criterios de calidad

- [ ] Se leyó la documentación de procedimientos disponible para el dominio, si existía.
- [ ] Cada afirmación de "esto ya existe" o "esto falta" está verificada contra el código real, no copiada de un documento.
- [ ] Se identificaron explícitamente casos de duplicación/fragmentación de UI, si los hay.
- [ ] Se identificó código muerto candidato con Grep de imports antes de proponer borrarlo.
- [ ] El alcance final se confirmó con el usuario si el hallazgo lo cambió respecto a lo pedido inicialmente.

---

## Stop conditions

Detente y pregunta al usuario si:
- La documentación y el código real se contradicen de forma importante (como ya pasó con ST-01-04).
- El hallazgo revela que el trabajo pedido es mucho más grande o mucho más pequeño de lo que el pedido original sugería.
- Hay dos caminos razonables de reorganización (ej. "extender pantalla existente" vs "crear una nueva unificada") y no es obvio cuál prefiere el usuario.
