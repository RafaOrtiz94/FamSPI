# Guía de uso — Higiene Personal (CA-01-12)

> **Para quién es esta guía:** Personal de Calidad y Gerencia que evalúa, verifica y registra las prácticas de higiene del personal en las instalaciones.

---

## ¿Para qué sirve este submódulo?

Este submódulo gestiona el cumplimiento de las **prácticas de higiene personal** por parte del personal de la empresa. Asegura que todo colaborador que ingresa a áreas de producción o manipulación de productos cumpla con los estándares de higiene exigidos por normativas GXP.

El flujo incluye:

1. **Evaluaciones**: registro de evaluaciones de higiene por empleado y por área.
2. **Verificación de prácticas**: control de cumplimiento de prácticas específicas (lavado de manos, uso de EPP, etc.).
3. **Incumplimientos**: registro de no conformidades detectadas.
4. **Capacitaciones**: vinculación a capacitaciones de higiene cuando se detectan brechas.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Acceso completo: evaluar, verificar prácticas, registrar incumplimientos, crear capacitaciones y transicionar estados |
| Gerencia | Evaluar, verificar prácticas, registrar incumplimientos, crear capacitaciones |

> Solo Calidad puede cambiar los estados del workflow de higiene.

---

## Pantalla principal

La pantalla se llama **"Prácticas de Higiene Personal"** y muestra:

- Tarjeta de título con ícono de usuario.
- Subtítulo: *"Sistema de gestión de higiene personal GXP."*
- Cuatro tarjetas de resumen:
  - Flujos activos.
  - RBAC privado.
  - Trazabilidad GXP.
  - Integración con higiene.
- Cuatro **tarjetas de flujo**:
  1. **Evaluaciones**: evaluaciones de higiene por empleado y área.
  2. **Prácticas**: verificación de cumplimiento de prácticas específicas.
  3. **Incumplimientos**: no conformidades registradas.
  4. **Capacitaciones**: capacitaciones vinculadas a higiene.

---

## Flujo principal — Registrar una evaluación de higiene

### Paso 1 — Acceder a "Evaluaciones"

Toca la tarjeta **"Evaluaciones"**.

### Paso 2 — Completar la evaluación

Debes registrar:

- **Empleado evaluado (employeeId)**: selecciona el colaborador.
- **Fecha de evaluación (evaluationDate)**.
- **Área de higiene (hygieneArea)**: ejemplo: "Sala de producción", "Almacén de materias primas".
- **Tipo de evaluación**:
  - `daily` (diaria).
  - `weekly` (semanal).
  - `monthly` (mensual).
  - `procedural` (por procedimiento específico).
- **Resultado**:
  - `approved` (aprobado).
  - `conditionally_approved` (aprobado condicionalmente).
  - `failed` (reprobado).
- **Observaciones (observations)** (opcional).
- **Evaluado por (evaluatedBy)** (opcional).

### Paso 3 — Guardar

La evaluación queda registrada y disponible para vincularle verificaciones de prácticas.

---

## Flujo principal — Verificar el cumplimiento de una práctica

### Paso 1 — Acceder a "Prácticas"

Toca la tarjeta **"Prácticas"**.

### Paso 2 — Registrar la verificación

Vincula la verificación a una evaluación existente:

- **ID de la evaluación (evaluationId)**.
- **Nombre de la práctica (practiceName)**: ejemplo: "Lavado de manos pre-operativo", "Uso de cofia y barbijo".
- **Código de la práctica (practiceCode)**: identificador interno (ejemplo: "HP-001").
- **¿Cumplió? (isComplied)**: sí o no.
- **Severidad** (si no cumplió):
  - `critical` (crítica).
  - `major` (grave).
  - `minor` (leve).
- **Notas (notes)** (opcional).

### Paso 3 — Guardar

La verificación queda registrada. Si hay prácticas no cumplidas, se generan incumplimientos automáticamente o se registran manualmente.

---

## Flujo principal — Registrar un incumplimiento

### Paso 1 — Acceder a "Incumplimientos"

Toca la tarjeta **"Incumplimientos"**.

### Paso 2 — Documentar la no conformidad

Vincula el incumplimiento a una evaluación:

- **ID de la evaluación (evaluationId)**.
- **ID de la práctica (practiceId)** (opcional): si corresponde a una práctica específica.
- **Descripción (description)**: explica en qué consistió el incumplimiento.
- **Tipo de incumplimiento**:
  - `hygiene` (higiene).
  - `ppe` (equipo de protección personal).
  - `behavior` (conducta).
  - `contamination` (contaminación).
- **Acción correctiva (correctiveAction)** (opcional): qué se hizo o se hará para corregirlo.

### Paso 3 — Guardar

El incumplimiento queda registrado y visible para seguimiento.

---

## Flujo principal — Vincular capacitaciones

### Paso 1 — Acceder a "Capacitaciones"

Toca la tarjeta **"Capacitaciones"**.

### Paso 2 — Registrar la capacitación

Vincula la capacitación a una evaluación o a un incumplimiento:

- **ID de la evaluación (evaluationId)** (si aplica).
- **Tema de la capacitación**.
- **Fecha programada**.
- **Instructor**.
- **Participantes**.

### Paso 3 — Guardar

La capacitación queda registrada como respuesta a una brecha de higiene detectada.

---

## Preguntas frecuentes

**[Un empleado reprobó la evaluación de higiene]**

Registra el resultado como `failed` y crea los incumplimientos correspondientes. Vincula una capacitación para corregir la brecha.

**[Puedo registrar una capacitación sin una evaluación previa]**

Sí, puedes registrar capacitaciones de higiene generales sin vinculación a una evaluación específica. Úsalas para entrenamiento continuo del personal.

**[Qué diferencia hay entre "conditionally_approved" y "approved"]**

`conditionally_approved` significa que el empleado cumplió con la mayoría de las prácticas, pero tiene observaciones menores que debe corregir en un plazo corto.

**[Un incumplimiento es por falta de EPP]**

Registra el tipo de incumplimiento como `ppe` (equipo de protección personal). Si aplica, crea una acción correctiva inmediata y una capacitación de refuerzo.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Evaluar la higiene de un empleado | Ve a "Evaluaciones" → registra empleado, área, tipo y resultado |
| Verificar una práctica específica | Ve a "Prácticas" → vincula a la evaluación → marca cumplimiento |
| Registrar una no conformidad | Ve a "Incumplimientos" → describe el incumplimiento |
| Crear una capacitación correctiva | Ve a "Capacitaciones" → vincula a la evaluación o incumplimiento |
