# Guía de uso — Auditorías Internas/Externas (CA-01-15)

> **Para quién es esta guía:** Personal de Calidad y Gerencia que programa, ejecuta y cierra auditorías internas, externas, regulatorias y de proveedores.

---

## ¿Para qué sirve este submódulo?

Este submódulo gestiona el ciclo completo de **auditorías de calidad** bajo normativas como ISO 9001, ISO 14001, GMP, GDP y GQP. Sirve para asegurar que los procesos, productos y sistemas de la empresa cumplan con los requisitos establecidos, y para documentar los hallazgos, evidencias y acciones correctivas resultantes de cada auditoría.

El flujo incluye:

1. **Auditorías**: planificación, alcance, tipo, fechas y equipo auditor.
2. **Hallazgos**: registro de no conformidades, observaciones y oportunidades de mejora.
3. **Evidencias**: documentos, fotos, registros o entrevistas que respaldan cada hallazgo.
4. **Checklists**: listas de verificación por cláusula o requisito normativo.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Acceso completo: crear auditorías, registrar hallazgos, evidencias, checklists y transicionar estados |
| Gerencia | Acción completa |

> Solo Calidad puede cambiar los estados del workflow de auditoría.

---

## Pantalla principal

La pantalla se llama **"Auditorías Internas/Externas"** y muestra:

- Tarjeta de título con ícono de búsqueda.
- Subtítulo: *"Sistema de gestión de auditorías GXP."*
- Cuatro **tarjetas de flujo**:
  1. **Auditorías**: gestión de auditorías (programadas, en curso, cerradas).
  2. **Hallazgos**: hallazgos y no conformidades detectadas.
  3. **Evidencias**: respaldo documental o físico de cada hallazgo.
  4. **Checklists**: listas de verificación por cláusula o requisito normativo.

---

## Flujo principal — Crear una auditoría

### Paso 1 — Acceder a "Auditorías"

Toca la tarjeta **"Auditorías"**.

### Paso 2 — Completar los datos

Debes registrar:

- **Número de auditoría (auditNumber)**: identificador único (ejemplo: "AUD-2026-001").
- **Tipo de auditoría (auditType)**:
  - `internal` (interna).
  - `external` (externa).
  - `regulatory` (regulatoria).
  - `supplier` (de proveedor).
- **Alcance (scope)**: áreas, procesos o productos que abarca la auditoría.
- **Normativa (standard)**:
  - `iso_9001`
  - `iso_14001`
  - `gmp`
  - `gdp`
  - `gqp`
  - `other`
- **Fecha de inicio planificada (plannedStartDate)**.
- **Fecha de fin planificada (plannedEndDate)**.
- **Líder auditor (leadAuditorId)**: responsable de dirigir la auditoría.
- **Miembros del equipo (teamMembers)**: lista de auditores participantes.

### Paso 3 — Guardar

La auditoría queda registrada y disponible para asociarle hallazgos, evidencias y checklist.

---

## Flujo principal — Registrar hallazgos de auditoría

### Paso 1 — Acceder a "Hallazgos"

Toca la tarjeta **"Hallazgos"**.

### Paso 2 — Crear un hallazgo

Vincula el hallazgo a la auditoría:

- **ID de la auditoría (auditId)**.
- **Número de hallazgo (findingNumber)**: correlativo dentro de la auditoría.
- **Tipo de hallazgo (findingType)**:
  - `critical` (crítica).
  - `major` (grave).
  - `minor` (leve).
  - `observation` (observación).
  - `opportunity` (oportunidad de mejora).
- **Descripción (description)**: detalle del hallazgo.
- **Área afectada (areaAffected)** (opcional).
- **Referencia de cláusula (clauseReference)** (opcional): cláusula de la normativa aplicada.

### Paso 3 — Guardar

Queda registrado el hallazgo con su clasificación de severidad.

---

## Flujo principal — Adjuntar evidencias

### Paso 1 — Acceder a "Evidencias"

Toca la tarjeta **"Evidencias"**.

### Paso 2 — Cargar la evidencia

Puedes adjuntar distintos tipos de respaldo:

- **Tipo de evidencia (evidenceType)**:
  - `document` (documento).
  - `photo` (fotografía).
  - `record` (registro o trazabilidad).
  - `interview` (entrevista).
  - `observation` (observación directa).
- **ID de la auditoría (auditId)**.
- **ID del hallazgo (findingId)** (opcional): si la evidencia corresponde a un hallazgo específico.
- **Descripción (description)** (opcional).
- **URL del archivo (fileUrl)**: enlace al documento o imagen.
- **Subido por (uploadedBy)** (opcional).

### Paso 3 — Guardar

La evidencia queda vinculada a la auditoría o al hallazgo.

---

## Flujo principal — Completar la checklist de la auditoría

### Paso 1 — Acceder a "Checklists"

Toca la tarjeta **"Checklists"**.

### Paso 2 — Registrar una pregunta o requisito

Vincula la checklist a la auditoría:

- **ID de la auditoría (auditId)**.
- **Código de cláusula (clauseCode)**: referencia normativa (ejemplo: "ISO-9001:7.1.5").
- **Texto de la pregunta (questionText)**: el requisito evaluado.
- **Respuesta (response)**:
  - `compliant` (cumple).
  - `non_compliant` (no cumple).
  - `na` (no aplica).
  - `pending` (pendiente de evaluar).
- **Referencia de evidencia (evidenceRef)** (opcional): enlace a la evidencia que respalda la respuesta.

### Paso 3 — Guardar

El ítem queda registrado con su estado de cumplimiento.

---

## Flujo principal — Cerrar la auditoría (Calidad)

### Paso 1 — Verificar que todo está completo

Asegúrate de que:
- Todos los hallazgos están documentados.
- Cada hallazgo tiene sus evidencias adjuntas.
- La checklist está completada.
- Las no conformidades tienen plan de acción vinculado (CAPA u otro módulo).

### Paso 2 — Transicionar el estado

Cambia el estado de la auditoría a cerrado o finalizado.

### Paso 3 — Confirmar

Queda registrado el cierre de la auditoría con fecha y responsable.

---

## Preguntas frecuentes

**[Un hallazgo no tiene evidencia digital]**

Usa el tipo de evidencia `observation` o `interview` y describe en texto lo que se constató. Si corresponde, adjunta un registro firmado o una fotografía posterior.

**[La checklist tiene ítems en "pending"]**

Esto significa que aún no evaluaste esos requisitos. Completa las respuestas antes de cerrar la auditoría.

**[Puedo modificar una auditoría ya cerrada]**

El sistema permite transiciones de estado, pero modificar una auditoría cerrada debería generar una nueva versión o una auditoría de seguimiento. Consulta a Calidad.

**[Qué diferencia hay entre un hallazgo "minor" y una "observation"]**

Un hallazgo `minor` es una no conformidad pequeña que requiere una acción correctiva. Una `opportunity` es una mejora recomendada que no implica un incumplimiento, pero sí una optimización del sistema.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Programar una auditoría | Ve a "Auditorías" → define tipo, alcance, fechas y equipo |
| Registrar una no conformidad | Ve a "Hallazgos" → crea el hallazgo con su tipo |
| Respalda un hallazgo | Ve a "Evidencias" → adjunta documento, foto o registro |
| Evaluar cumplimiento normativo | Ve a "Checklists" → completa requisito por requisito |
| Cerrar la auditoría | Transiciona el estado final (solo Calidad) |
