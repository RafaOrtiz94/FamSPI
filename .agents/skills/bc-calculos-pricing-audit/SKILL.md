---
name: bc-calculos-pricing-audit
description: Audita y reconstruye fórmulas y precios de los libros CALCULOS del Business Case (Hematología e Inmuno-Química), distinguiendo datos literales, resultados calculables y casos ambiguos. Úsala para analizar celdas faltantes, errores de referencia, precios por determinación, prueba efectiva o todo comprado; no para editar los libros o implementar el motor salvo petición expresa.
---

# BC Cálculos y Precios

Trabaja sobre los libros de `backend/Mapeador_Sheets/CALCULOS` con evidencia de
celda. El PVP base es un dato literal del documento: nunca lo deduzcas de otro
producto. Solo reconstruye las transformaciones que parten de PVP, rendimiento,
demanda, estabilidad, equipos, plazo, adicionales e inversiones verificables.

## Antes de analizar

1. Lee `backend/src/modules/business-case/CONTEXT.md` y su `AGENTS.md`.
2. Enumera los libros y todas sus hojas; no uses nombres recordados como prueba.
3. Lee [references/pricing-model.md](references/pricing-model.md).
4. Si el alcance incluye Hematología, lee
   [references/hematology.md](references/hematology.md). Si incluye
   Inmuno-Química, lee
   [references/immunochemistry.md](references/immunochemistry.md).
5. Revalida las fórmulas contra la versión actual del XLSX. Los hallazgos de las
   referencias son una línea base fechada, no sustituyen la inspección actual.

## Método de auditoría

- Inspecciona cada celda con fórmula, su valor almacenado, formato y referencias.
- Compara bloques equivalentes por modalidad y equipo; exige al menos dos bloques
  funcionales independientes antes de llamar a algo “patrón”.
- Rastrea precedentes hasta su origen. Clasifica cada entrada como literal,
  fórmula, referencia a BC, dato faltante o error.
- Recalcula fuera del valor cacheado y contrasta ambos resultados. Un cache XLSX
  puede estar obsoleto y no demuestra que la fórmula sea correcta.
- Distingue error estructural de entrada ausente. Una división por cero causada
  por demanda vacía no autoriza reemplazar el resultado por cero.
- No normalices excepciones reales entre equipos. Reporta la desviación y exige
  confirmación funcional cuando el propio libro contiene reglas contradictorias.

## Niveles de certeza

- **Demostrado:** fórmula repetida en bloques funcionales, referencias trazadas y
  resultado reproducido matemáticamente.
- **Inferencia fuerte:** estructura inequívoca y respaldada por equivalentes,
  pero sin fórmula original intacta. Preséntala como propuesta, no como hecho.
- **Ambiguo:** hay dos reglas plausibles o se perdió una referencia que no puede
  reconstruirse. Expón alternativas y la decisión de negocio requerida.
- **No calculable:** falta PVP, demanda u otro denominador imprescindible. Indica
  el dato requerido; no fabriques un valor.

## Entrega

Reporta por libro, hoja, celda o rango: fórmula actual, problema, patrón de
comparación, fórmula reconstruida, resultado, dependencias y nivel de certeza.
Separa siempre PVP base, precio unitario base, precio comercial y total. Si el
usuario pidió solo revisión, no cambies libros, código, base de datos ni Google
Sheets.
