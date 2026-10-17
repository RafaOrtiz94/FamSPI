# Guía de uso — Áreas Calificadas (CA-01-14)

> **Para quién es esta guía:** Personal de Calidad y Gerencia que califica, monitorea y mantiene áreas controladas con requisitos ambientales y de seguridad GXP.

---

## ¿Para qué sirve este submódulo?

Este submódulo gestiona la **calificación de áreas controladas** dentro de la empresa: salas limpias, almacenes, laboratorios, áreas de producción, cuarentenas y cualquier espacio que deba cumplir con parámetros ambientales o de seguridad normados.

No se trata solo de registrar el área, sino de:
- Definir los **parámetros críticos** (temperatura, humedad, partículas, presión, etc.).
- Registrar los **límites aceptables** (mínimo, máximo, valor objetivo).
- **Calificar** el área (IQ, OQ, PQ, recalificación).
- **Monitorear** lecturas en el tiempo para confirmar que se mantiene dentro de especificaciones.
- Gestionar **desviaciones** cuando un parámetro se sale de rango.

El objetivo es contar con áreas validadas y monitoreadas para cumplir con normativas GXP y asegurar que el producto no se expone a condiciones que comprometan su calidad.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Acceso completo: crear áreas, definir parámetros, registrar monitoreos, desviaciones, documentos y transicionar estados |
| Gerencia | Crear áreas, parámetros, monitoreos, desviaciones y documentos |

> Solo Calidad puede cambiar los estados del workflow de calificación de áreas.

---

## Pantalla principal

La pantalla se llama **"Calificación Áreas Controladas"** y muestra:

- Tarjeta de título con ícono de mapa.
- Subtítulo: *"Sistema de calificación de áreas GXP."*
- Cuatro tarjetas de resumen:
  - Flujos activos.
  - RBAC privado.
  - Trazabilidad GXP.
  - Calificación de áreas.
- Cuatro **tarjetas de flujo**:
  1. **Áreas**: registro de las áreas calificadas.
  2. **Parámetros**: definición de variables a controlar (temperatura, humedad, partículas, etc.).
  3. **Monitoreo**: lecturas y resultados de mediciones en el tiempo.
  4. **Desviaciones**: registros de valores fuera de especificación.

---

## Flujo principal — Crear un área calificada

### Paso 1 — Acceder a "Áreas"

Toca la tarjeta **"Áreas"**.

### Paso 2 — Registrar el área

Completa:

- **Nombre del área (areaName)**: ejemplo: "Sala de envasado A", "Almacén de producto terminado".
- **Código del área (areaCode)**: identificador interno (ejemplo: "SA-01", "APT-03").
- **Tipo de área (areaType)**:
  - `clean_room` (sala limpia).
  - `warehouse` (almacén).
  - `laboratory` (laboratorio).
  - `production` (área de producción).
  - `storage` (almacenamiento).
  - `quarantine` (cuarentena).
  - `other` (otra).
- **Nivel de clasificación (classificationLevel)**:
  - `a`, `b`, `c`, `d` (clases ISO de sala limpia).
  - `undefined` (no aplica).
- **Tipo de calificación (qualificationType)**:
  - `iq` (calificación de instalación).
  - `oq` (calificación operativa).
  - `pq` (calificación de desempeño).
  - `initial` (inicial).
  - `periodic` (periódica).
  - `requalification` (recalificación).
- **Próxima fecha de calificación (nextQualificationDate)** (opcional): cuándo corresponde la próxima verificación.
- **Validado por (validatedBy)** (opcional).

### Paso 3 — Guardar

El área queda registrada y disponible para asociarle parámetros de monitoreo.

---

## Flujo principal — Definir parámetros de calificación

### Paso 1 — Acceder a "Parámetros"

Toca la tarjeta **"Parámetros"**.

### Paso 2 — Crear un parámetro

Vincula el parámetro al área:

- **ID del área (areaId)**.
- **Nombre del parámetro (paramName)**: ejemplo: "Temperatura", "Humedad relativa", "Partículas vivas".
- **Código del parámetro (paramCode)**: identificador interno (ejemplo: "TEMP", "HUM", "PTV").
- **Tipo de parámetro (paramType)**:
  - `temperature` (temperatura).
  - `humidity` (humedad).
  - `pressure` (presión).
  - `particulate` (partículas).
  - `viable` (partículas viables).
  - `nonviable` (partículas no viables).
  - `other` (otro).
- **Valor mínimo (minValue)** (opcional).
- **Valor máximo (maxValue)** (opcional).
- **Valor objetivo (targetValue)** (opcional).
- **Unidad (unit)** (opcional): °C, %, Pa, partículas/m³, etc.
- **Método utilizado (methodUsed)** (opcional): cómo se mide.

### Paso 3 — Guardar

Queda definido el parámetro con sus límites. A partir de ahí, se registran monitoreos y se evalúan desviaciones.

---

## Flujo principal — Registrar un monitoreo

### Paso 1 — Acceder a "Monitoreo"

Toca la tarjeta **"Monitoreo"**.

### Paso 2 — Cargar la lectura

Vincula el resultado al área y al parámetro:

- **ID del área (areaId)**.
- **ID del parámetro (paramId)** (opcional, si es una lectura específica).
- **Valor de la lectura (readingValue)**.
- **¿Está dentro de especificación? (isWithinSpec)**: sí o no.
- **Notas (notes)** (opcional).
- **Registrado por (recordedBy)** (opcional).

### Paso 3 — Guardar

La lectura queda registrada. El sistema puede marcar automáticamente si el valor respeta los límites definidos para ese parámetro.

---

## Flujo principal — Gestionar desviaciones

### Paso 1 — Acceder a "Desviaciones"

Toca la tarjeta **"Desviaciones"**.

### Paso 2 — Registrar la desviación

Vincula la desviación al área y al parámetro:

- **ID del área (areaId)**.
- **ID del parámetro (paramId)** (opcional).
- **Descripción de la desviación**: qué valor salió de rango y en qué momento.
- **Acción correctiva aplicada (correctiveAction)** (opcional).

### Paso 3 — Guardar

Queda documentada la salida de especificación y la respuesta.

---

## Flujo principal — Gestionar documentos de calificación

### Paso 1 — Acceder a "Documentos"

Dentro del área, busca la sección de documentos de calificación.

### Paso 2 — Adjuntar el protocolo

Puedes subir o vincular:
- Protocolos de calificación (IQ, OQ, PQ).
- Resultados de ensayos.
- Certificados de calibración de equipos de monitoreo.

### Paso 3 — Actualizar la calificación

Cuando venza la calificación vigente, registra la nueva calificación (recalificación o requalification) y actualiza la fecha próxima.

---

## Preguntas frecuentes

**[Un parámetro de monitoreo salió fuera de rango]**

Registra la desviación en la sección correspondiente y aplica la acción correctiva establecida en el procedimiento del área.

**[El área no tiene nivel de clasificación "a", "b", "c" o "d"]**

Selecciona `undefined` si el área no corresponde a una sala limpia clasificada por ISO. Ejemplo: almacenes o oficinas.

**[Qué es la diferencia entre IQ, OQ y PQ]**

- **IQ (calificación de instalación)**: verifica que el área y sus servicios estén instalados según diseño.
- **OQ (calificación operativa)**: verifica que el área opere dentro de los límites establecidos en condiciones normales.
- **PQ (calificación de desempeño)**: verifica que el área mantenga el desempeño a lo largo del tiempo.

**[Cuándo debo recalificar un área]**

Cuando:
- Venció la calificación vigente.
- Se realizaron modificaciones mayores en el área.
- Se detectaron desviaciones recurrentes.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Registrar una nueva área calificada | Ve a "Áreas" → completa tipo, clasificación y calificación |
| Definir qué parámetros controlar | Ve a "Parámetros" → asocia al área y define límites |
| Cargar una lectura de monitoreo | Ve a "Monitoreo" → registra el valor y si está en rango |
| Documentar una desviación | Ve a "Desviaciones" → describe la salida de especificación |
| Actualizar la calificación | Cambia el estado del workflow o actualiza la fecha próxima |
