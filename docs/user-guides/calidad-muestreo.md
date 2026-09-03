# Guía de uso — Muestreo y Aprobación (CA-01-16)

> **Para quién es esta guía:** Personal de Calidad y Gerencia que diseña planes de muestreo, registra resultados analíticos y autoriza la liberación de lotes.

---

## ¿Para qué sirve este submódulo?

Este submódulo gestiona el proceso de **muestreo de producto** para confirmar que un lote cumple con las especificaciones antes de ser liberado para distribución o uso.

En lugar de inspeccionar el 100 % de la producción (lo cual puede ser destructivo o inviable), el muestreo permite seleccionar una porción representativa, analizarla y, si los resultados son conformes, aprobar la liberación del lote completo.

El flujo incluye:

1. **Lotes**: registro del lote o remesa a muestrear.
2. **Análisis**: carga de resultados de ensayos o inspecciones de la muestra.
3. **Aprobaciones**: autorización de Calidad o Gerencia para liberar el lote.
4. **Liberación**: registro formal del lote liberado, con destino y cantidad.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Acceso completo: crear lotes, registrar análisis, aprobar, liberar y transicionar estados |
| Gerencia | Acceso completo |

---

## Pantalla principal

La pantalla se llama **"Muestreo y Aprobación"** y muestra:

- Tarjeta de título con ícono de actividad.
- Subtítulo: *"Sistema de muestreo GXP."*
- Cuatro **tarjetas de flujo**:
  1. **Lotes**: lotes de muestreo registrados.
  2. **Análisis**: resultados de análisis de muestras.
  3. **Aprobaciones**: registro de autorizaciones.
  4. **Liberaciones**: lotes liberados para su destino.

---

## Flujo principal — Registrar un lote de muestreo

### Paso 1 — Acceder a "Lotes"

Toca la tarjeta **"Lotes"**.

### Paso 2 — Completar los datos del lote

Debes registrar:

- **Número de lote (batchNumber)**: identificador único del lote de producción o recepción.
- **Nombre del producto (productName)**.
- **Cantidad (quantity)**: unidades o volumen total del lote.
- **Unidad (unit)**: ejemplo: "unidades", "litros", "kg".
- **Fecha de muestreo (sampleDate)** (opcional): cuándo se extrajo la muestra.

### Paso 3 — Guardar

El lote queda registrado y disponible para asociarle resultados de análisis.

---

## Flujo principal — Registrar un resultado de análisis

### Paso 1 — Acceder a "Análisis"

Toca la tarjeta **"Análisis"**.

### Paso 2 — Cargar el resultado

Vincula el análisis al lote:

- **ID del lote (batchId)**.
- **Parámetro analizado (parameter)**: ejemplo: "pH", "Recuento de partículas", "Espesor".
- **Valor del resultado (resultValue)**: número obtenido en el ensayo.
- **¿Conforma? (conforms)**: indica si el resultado cumple con la especificación del producto.

### Paso 3 — Guardar

Queda registrado el resultado. Si algún parámetro no conforma, el lote no debería liberarse hasta resolver la desviación.

---

## Flujo principal — Aprobar el lote

### Paso 1 — Acceder a "Aprobaciones"

Toca la tarjeta **"Aprobaciones"**.

### Paso 2 — Registrar la aprobación

Vincula la aprobación al lote:

- **ID del lote (batchId)**.
- **Aprobador (approverId)** (opcional): persona que autoriza la liberación.

### Paso 3 — Guardar

La aprobación queda registrada. Esto es la autorización formal de Calidad o Gerencia para continuar con la liberación.

---

## Flujo principal — Liberar el lote

### Paso 1 — Acceder a "Liberaciones"

Toca la tarjeta **"Liberaciones"**.

### Paso 2 — Registrar la liberación

Completa:

- **ID del lote (batchId)**.
- **Liberado por (releasedBy)**: quién ejecuta la liberación.
- **Destino (destination)** (opcional): dónde se envía el lote (ejemplo: "Almacén de producto terminado", "Cliente X").
- **Cantidad liberada (quantityReleased)** (opcional): puede ser el total o parcial.

### Paso 3 — Guardar

El lote queda liberado formalmente en el sistema y puede distribuirse.

---

## Flujo principal — Cambiar el estado del lote (Calidad)

### Paso 1 — Seleccionar el lote

Localiza el lote en el listado.

### Paso 2 — Transicionar el estado

Calidad puede cambiar el estado del lote (por ejemplo, a `released` o `rejected`) según los resultados y aprobaciones registradas.

### Paso 3 — Confirmar

El sistema actualiza el estado del lote.

---

## Preguntas frecuentes

**[Un resultado de análisis salió no conforme]**

No liberes el lote. Registra el resultado como `conforms: false` y genera una desviación o CAPA según corresponda.

**[El lote tiene varios parámetros y uno falló]**

Todos los parámetros deben conformar para poder aprobar y liberar el lote. Si uno falla, el lote se considera no conforme hasta su evaluación posterior.

**[Puedo aprobar un lote sin análisis]**

El sistema no evita la creación de la aprobación, pero normativamente un lote debe tener al menos un análisis registrado antes de aprobarse.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Iniciar un muestreo | Ve a "Lotes" → crea el lote de muestreo |
| Cargar resultados de ensayo | Ve a "Análisis" → vincula al lote → registra valor y conformidad |
| Aprobar el lote | Ve a "Aprobaciones" → registra la autorización |
| Liberar el lote | Ve a "Liberaciones" → registra destino y cantidad |
| Rechazar un lote | Cambia el estado del lote (solo Calidad) |
