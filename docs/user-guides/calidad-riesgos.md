# Guía de uso — Gestión de Riesgos (CA-01-10)

> **Para quién es esta guía:** Personal de Calidad y Gerencia que identifica, evalúa, mitiga y revisa riesgos de procesos GXP mediante FMEA (Failure Mode and Effects Analysis).

---

## ¿Para qué sirve este submódulo?

Este submódulo aplica la metodología **FMEA** para gestionar riesgos de calidad en los procesos de la empresa. En lugar de reaccionar solo cuando ocurre una desviación, este módulo permite **anticipar fallas potenciales**, evaluar su impacto y definir acciones de mitigación antes de que afecten la calidad del producto o servicio.

El flujo incluye:

1. **FMEA**: identificación de modos de falla y cálculo de la prioridad de riesgo.
2. **Mitigación**: planificación de acciones para reducir el riesgo.
3. **Revisiones**: auditorías periódicas del análisis de riesgos.
4. **Evaluación de Impacto**: medición del efecto real de las acciones aplicadas.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Acceso completo: crear FMEA, mitigaciones, revisiones, evaluaciones de impacto y transicionar estados |
| Gerencia | Crear FMEA, mitigaciones, revisiones y evaluaciones de impacto |

> Solo Calidad puede cambiar los estados del workflow de riesgos.

---

## Pantalla principal

La pantalla se llama **"Gestión de Riesgos"** y muestra:

- Tarjeta de título con ícono de objetivo.
- Subtítulo: *"Sistema de gestión de riesgos GXP/FMEA."*
- Cuatro tarjetas de resumen:
  - Flujos activos.
  - RBAC privado.
  - Trazabilidad GXP.
  - Integración con gestión de riesgos.
- Cuatro **tarjetas de flujo**:
  1. **FMEA**: análisis de modo de falla y efecto.
  2. **Mitigación**: acciones para reducir el riesgo.
  3. **Revisiones**: revisiones periódicas del análisis.
  4. **Impacto**: evaluación del impacto real.

---

## Flujo principal — Crear un FMEA (Análisis de Modo de Falla)

### Paso 1 — Acceder a "FMEA"

Toca la tarjeta **"FMEA"**.

### Paso 2 — Completar el análisis

Debes registrar:

- **Nombre del proceso (processName)**: el proceso que estás analizando (ejemplo: "Control de temperatura en sala fría").
- **Modo de falla (failureMode)**: cómo podría fallar el proceso (ejemplo: "El termohigrómetro calibra por encima de 8 °C").
- **Puntaje de severidad (severityScore)**: de 1 a 10, qué tan grave sería el impacto si la falla ocurre.
- **Puntaje de ocurrencia (occurrenceScore)**: de 1 a 10, qué tan probable es que la falla ocurra.
- **Puntaje de detección (detectionScore)**: de 1 a 10, qué tan probable es que detectemos la falla antes de que cause daño.

> **Importante:** El sistema calcula automáticamente el **RPN (Risk Priority Number) o Número de Prioridad de Riesgo** multiplicando los tres puntajes: `RPN = severidad × ocurrencia × detección`. Un RPN mayor indica un riesgo más alto que debe mitigarse primero.

### Paso 3 — Guardar

El FMEA queda registrado con su RPN calculado. Según el valor del RPN, el sistema puede priorizar automáticamente los riesgos más críticos.

---

## Flujo principal — Crear un plan de mitigación

### Paso 1 — Acceder a "Mitigación"

Toca la tarjeta **"Mitigación"**.

### Paso 2 — Definir la acción correctiva

Vincula la mitigación al FMEA:

- **ID del FMEA (fmeaId)**: selecciona el análisis de riesgo.
- **Acción de mitigación (mitigationAction)**: qué vas a hacer para reducir el riesgo (ejemplo: "Instalar alarma de temperatura", "Capacitar al operario", "Calibrar el equipo mensualmente").
- **Responsable (responsibleId)**: quién ejecuta la acción.
- **Fecha límite (targetDate)**: cuándo debe estar implementada.

### Paso 3 — Guardar

La acción queda registrada. El sistema puede priorizar las mitigaciones según el RPN del FMEA asociado: mayor RPN = mayor urgencia.

---

## Flujo principal — Programar revisiones periódicas

### Paso 1 — Acceder a "Revisiones"

Toca la tarjeta **"Revisiones"**.

### Paso 2 — Crear una revisión

Calidad programa revisiones del análisis de riesgos para asegurarse de que sigue siendo vigente:

- **Tipo de revisión (reviewType)**:
  - `annual` (anual).
  - `quarterly` (trimestral).
  - `ad_hoc` (extraordinaria).
- **Fecha de la revisión (reviewDate)**.
- **Participantes (participants)**: lista de personas que asistirán.
- **Conclusiones (conclusions)** (opcional): resumen de lo acordado.
- **Acciones derivadas (actionItems)** (opcional): lista de compromisos.
- **Creado por (createdBy)** (opcional).

### Paso 3 — Guardar

La revisión queda programada. Cuando se realice, se registran las conclusiones y acciones.

---

## Flujo principal — Evaluar el impacto de las acciones

### Paso 1 — Acceder a "Impacto"

Toca la tarjeta **"Impacto"**.

### Paso 2 — Registrar la evaluación

Vincula la evaluación a un FMEA o a una mitigación:

- **ID del FMEA o mitigación** (según corresponda).
- **Fecha de evaluación**.
- **Resultado de la evaluación**: impacto medido después de aplicar la acción.
- **Notas adicionales**.

### Paso 3 — Guardar

La evaluación queda registrada. Si el impacto muestra que el riesgo se redujo, el FMEA puede cerrarse o actualizarse.

---

## Flujo principal — Consultar métricas de riesgos

### Paso 1 — Acceder a métricas

El submódulo expone un endpoint de métricas accesible para Calidad y Gerencia.

### Paso 2 — Interpretar las métricas

El panel muestra:
- Cantidad de FMEA registrados.
- Distribución por nivel de riesgo.
- Estado de mitigaciones (pendientes, vencidas, completadas).
- Tendencia de riesgos en el tiempo.

---

## Preguntas frecuentes

**[Qué es el RPN y cómo se calcula]**

El RPN (Risk Priority Number) es el número de prioridad de riesgo. Se calcula multiplicando tres puntajes de 1 a 10:
- **Severidad**: qué tan grave sería el daño.
- **Ocurrencia**: qué tan probable es que ocurra.
- **Detección**: qué tan probable es que lo detectemos antes de que cause daño.

Ejemplo: severidad 8 × ocurrencia 5 × detección 4 = RPN 160.

**[Un FMEA tiene un RPN muy alto]**

Prioriza la mitigación de ese riesgo. Mayor RPN significa mayor urgencia. Asigna responsable y fecha límite corta.

**[Puedo modificar un FMEA después de creado]**

El sistema permite transiciones de estado, pero modificar los puntajes de un FMEA existente puede implicar crear una nueva versión o actualizar el análisis según la configuración del workflow.

**[Las revisiones trimestrales no se realizaron]**

Registra la revisión como `ad_hoc` (extraordinaria) cuando se realice. Las fechas programadas son referencias; el sistema no bloquea las revisiones atrasadas.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Analizar un riesgo potencial | Ve a "FMEA" → registra proceso, modo de falla y puntajes |
| Calcular la prioridad del riesgo | El sistema calcula el RPN automáticamente |
| Definir acciones correctivas | Ve a "Mitigación" → asigna responsable y fecha |
| Programar una revisión | Ve a "Revisiones" → define tipo y fecha |
| Medir el resultado | Ve a "Impacto" → registra la evaluación |
