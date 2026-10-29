# Guía de uso — CAPA (Acciones Correctivas y Preventivas) (CA-01-09)

> **Para quién es esta guía:** Personal de Calidad y Gerencia que investiga causas raíz, diseña planes de acción, escala casos y verifica la efectividad de las correcciones.

---

## ¿Para qué sirve este submódulo?

Este submódulo implementa el proceso de **CAPA (Corrective and Preventive Action)**. Cuando se descubre una desviación de calidad —por ejemplo, una queja de cliente, una falla en inspección, una auditoría con hallazgos o una excursión de temperatura— Calidad no solo corrige el problema puntual, sino que busca la **causa raíz** y define acciones para que no vuelva a ocurrir.

El flujo CAPA sigue cuatro etapas:

1. **RCA (Root Cause Analysis)**: análisis de la causa raíz del problema.
2. **Plan de Acción**: definición de las acciones correctivas o preventivas, responsables y fechas.
3. **Escalación**: si el caso requiere atención de niveles superiores (jefatura, gerencia, directorio).
4. **Efectividad**: verificación de que las acciones aplicadas realmente resolvieron el problema.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Acceso completo: crear RCA, planes de acción, escalar, evaluar efectividad y transicionar estados |
| Gerencia | Crear RCA, planes de acción, escalar y evaluar efectividad |

> Solo Calidad puede cambiar los estados del workflow CAPA.

---

## Pantalla principal

La pantalla se llama **"CAPA (Acciones Correctivas)"** y muestra:

- Tarjeta de título con ícono de análisis de causa raíz.
- Subtítulo: *"Sistema de gestión de acciones correctivas GXP."*
- Cuatro tarjetas de resumen:
  - Flujos activos.
  - RBAC privado.
  - Trazabilidad GXP.
  - Integración con el sistema de acciones correctivas.
- Cuatro **tarjetas de flujo**:
  1. **RCA**: análisis de causa raíz.
  2. **Plan de Acción**: acciones correctivas y preventivas.
  3. **Escalación**: escalamiento a niveles superiores.
  4. **Efectividad**: verificación de resultados.

---

## Flujo principal — Crear un RCA (Análisis de Causa Raíz)

### Paso 1 — Acceder a "RCA"

Toca la tarjeta **"RCA"**.

### Paso 2 — Crear el análisis

Completa:

- **Tipo de fuente (sourceType)**: de dónde surgió la desviación:
  - `audit` (auditoría).
  - `complaint` (queja de cliente).
  - `deviation` (desviación de proceso).
  - `inspection` (inspección).
  - `other` (otra).
- **ID de la fuente (sourceId)** (opcional): si la desviación viene de otro submódulo (por ejemplo, una queja de CA-01-07 o una alarma de CA-01-01).
- **Descripción**: explica el problema detectado.
- **Severidad**:
  - `minor` (leve).
  - `major` (grave).
  - `critical` (crítica).
- **Causa raíz identificada (rootCause)** (opcional): si ya la conoces en el momento de crear el RCA.
- **Creado por (createdBy)** (opcional): se asigna automáticamente según tu usuario.

### Paso 3 — Guardar

El RCA queda registrado con un ID que usarás para vincularle el plan de acción.

---

## Flujo principal — Crear un plan de acción

### Paso 1 — Acceder a "Plan de Acción"

Toca la tarjeta **"Plan de Acción"**.

### Paso 2 — Definir las acciones correctivas

Para el RCA creado:

- **ID del RCA (rcaId)**: selecciona el análisis de causa raíz.
- **Descripción de la acción (actionDescription)**: qué se va a hacer para corregir o prevenir el problema.
- **Responsable (responsibleId)**: quién ejecuta la acción.
- **Fecha límite (dueDate)**: cuándo debe estar completada.

### Paso 3 — Guardar

La acción queda registrada y asignada.

### Ejemplo de plan de acción

| Acción | Responsable | Fecha límite |
|---|---|---|
| Recalibrar el termohigrómetro TH-03 | Servicio técnico | 2026-06-30 |
| Actualizar el instructivo de limpieza de sala fría | Calidad | 2026-07-05 |
| Capacitar al operario de turno noche | Talento Humano | 2026-07-10 |

---

## Flujo principal — Escalar un caso

### Paso 1 — Acceder a "Escalación"

Toca la tarjeta **"Escalación"**.

### Paso 2 — Registrar la escalación

Define:

- **ID del RCA (rcaId)**: el caso que se escala.
- **Nivel de escalación (escalationLevel)**:
  - `level1`: jefe de área.
  - `level2`: gerencia.
  - `level3`: directorio o alta gerencia.
  - `executive`: comité ejecutivo.
- **Razón de la escalación (reason)**: por qué el caso requiere atención superior.
- **Escalado a (escalatedTo)** (opcional): a quién se envía.

### Paso 3 — Guardar

La escalación queda registrada y visible para el nivel correspondiente.

---

## Flujo principal — Evaluar la efectividad de las acciones

### Paso 1 — Acceder a "Efectividad"

Toca la tarjeta **"Efectividad"**.

### Paso 2 — Evaluar una acción del plan

Vincula la evaluación al plan de acción:

- **ID del plan de acción (actionPlanId)**.
- **Fecha de evaluación (evaluationDate)**.
- **Puntaje de efectividad (effectivenessScore)**:
  - `effective` (efectiva): la acción resolvió el problema.
  - `partially_effective` (parcialmente efectiva): ayudó pero no resolvió completamente.
  - `ineffective` (inefectiva): no funcionó; se requiere un nuevo plan.
- **Notas de evaluación (evaluationNotes)** (opcional).
- **¿Requiere seguimiento? (followUpRequired)**: sí o no.
- **Fecha de seguimiento (followUpDate)** (opcional).
- **Evaluado por (evaluatedBy)** (opcional).

### Paso 3 — Guardar

La evaluación queda registrada. Si la efectividad es `ineffective`, probablemente debas crear un nuevo RCA o modificar el plan de acción existente.

---

## Flujo principal — Transicionar estados (Calidad)

### Paso 1 — Seleccionar el flujo

Puedes transicionar cualquiera de los cuatro flujos internos:
- `rca`
- `action_plan`
- `escalation`
- `effectiveness`

### Paso 2 — Definir la transición

Indica el registro, el estado destino y notas de justificación.

### Paso 3 — Confirmar

El sistema valida la transición mediante la máquina de estados antes de aplicarla.

---

## Preguntas frecuentes

**[Puedo crear un plan de acción sin un RCA previo]**

El sistema no evita la creación, pero normativamente un plan de acción debe estar vinculado a un análisis de causa raíz. Asegúrate de crear primero el RCA.

**[Un plan de acción venció sin completarse]**

Actualiza el estado del plan y registra las razones del retraso. Si la acción sigue siendo necesaria, ajusta la fecha límite.

**[La efectividad salió "inefectiva"]**

Esto significa que la acción no resolvió el problema. Crea un nuevo RCA o modifica el plan de acción actual. No cierres el CAPA hasta tener una evaluación de efectividad positiva.

**[A qué nivel debo escalar un caso crítico]**

Depende de la severidad y el impacto. Para problemas críticos que afectan a clientes o a la integridad del producto, usa `level2` (gerencia) o `level3` (directorio).

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Iniciar un CAPA | Ve a "RCA" → crea el análisis de causa raíz |
| Definir acciones correctivas | Ve a "Plan de Acción" → asigna responsable y fecha |
| Escalar a gerencia | Ve a "Escalación" → selecciona nivel y motivo |
| Verificar si funcionó | Ve a "Efectividad" → evalúa la acción |
| Cerrar el CAPA | Transiciona el estado final (solo Calidad) |
