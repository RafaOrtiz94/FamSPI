# Guía de uso — Contingencia Refrigerados (CA-01-08)

> **Para quién es esta guía:** Personal de Calidad y Gerencia que gestiona contingencias por cortes de energía en la cadena de frío de productos refrigerados.

---

## ¿Para qué sirve este submódulo?

Este submódulo gestiona el **plan de contingencia para productos refrigerados**. Cuando ocurre un corte de energía o una falla en el sistema de refrigeración, el equipo debe actuar rápidamente para:

- Registrar el incidente (cuándo empezó, cuándo terminó, causas, áreas afectadas).
- Calcular la cantidad de hielo seco necesaria para mantener la cadena de frío.
- Transferir productos a ubicaciones alternativas si es necesario.
- Validar que los productos mantuvieron su integridad (temperatura, empaque, transporte).

Todo el flujo está diseñado para tomar decisiones rápidas con trazabilidad GXP.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Acceso completo: registrar cortes, calcular hielo seco, transferir productos, validar y transicionar estados |
| Gerencia | Registrar cortes, calcular hielo seco, transferir productos, validar |

> Solo Calidad puede cambiar el estado general del workflow. Gerencia puede participar en todas las etapas operativas.

---

## Pantalla principal

La pantalla se llama **"Contingencia Refrigerados"** y muestra:

- Tarjeta de título con ícono de termómetro.
- Subtítulo: *"Sistema de gestión de contingencias para productos refrigerados."*
- Cuatro tarjetas de resumen:
  - Flujos activos.
  - RBAC privado.
  - Trazabilidad GXP.
  - Contingencia Refrigerados.
- Cuatro **tarjetas de flujo**:
  1. **Corte de Energía**: registros de cortes de energía.
  2. **Hielo Seco**: cálculos de hielo seco necesario.
  3. **Transferencia**: traslado de productos a ubicaciones alternativas.
  4. **Validación**: validaciones de integridad del producto.

---

## Flujo principal — Registrar un corte de energía

### Paso 1 — Acceder a "Corte de Energía"

Toca la tarjeta **"Corte de Energía"**.

### Paso 2 — Crear el registro del corte

Completa:

- **Fecha y hora de inicio del corte (outageStart)**: cuándo se detectó la falla de energía.
- **Fecha y hora de fin (outageEnd)** (opcional): cuándo se restableció la energía.
- **Duración en minutos (durationMinutes)** (opcional).
- **Causa del corte** (opcional): falla eléctrica, mantenimiento, etc.
- **Áreas afectadas (affectedAreas)** (opcional): cámaras frías, almacenes, líneas de producción.
- **Caída de temperatura registrada (temperatureDrop)** (opcional): en grados Celsius.

### Paso 3 — Guardar

El corte queda registrado y asociado a un ID. Con ese ID podrás generar los cálculos de hielo seco, transferencias y validaciones posteriores.

---

## Flujo principal — Calcular hielo seco requerido

### Paso 1 — Acceder a "Hielo Seco"

Toca la tarjeta **"Hielo Seco"**.

### Paso 2 — Crear el cálculo

Vincula el cálculo al corte de energía registrado:

- **ID del corte de energía (powerOutageId)**: selecciona el incidente.
- **Volumen del contenedor (containerVolumeLiters)**: capacidad en litros del equipo o contenedor que debe mantenerse frío.
- **Temperatura objetivo (targetTempCelsius)**: temperatura que debe mantenerse.
- **Duración de la contingencia (durationHours)**: cuántas horas se estima sin energía.
- **Método de cálculo (calculationMethod)** (opcional): fórmula o criterio usado.

### Paso 3 — Guardar

El sistema registra el cálculo. Con esta información, el equipo puede preparar la cantidad de hielo seco necesaria o decidir transferir los productos.

---

## Flujo principal — Transferir productos a ubicación alternativa

### Paso 1 — Acceder a "Transferencia"

Toca la tarjeta **"Transferencia"**.

### Paso 2 — Registrar la transferencia

Completa:

- **ID del corte de energía (powerOutageId)**: el incidente que motivó la transferencia.
- **Ubicación de origen (fromLocationId / fromLocationName)**: de dónde se retiran los productos.
- **Ubicación de destino (toLocationId / toLocationName)**: a dónde se envían.
- **Cantidad de productos afectados (productsAffected)**: número de unidades transferidas.

### Paso 3 — Guardar

Queda registrado el movimiento de productos. Esto es clave para la trazabilidad: sabes exactamente qué salió de dónde y hacia dónde fue.

---

## Flujo principal — Validar la integridad de los productos

### Paso 1 — Acceder a "Validación"

Toca la tarjeta **"Validación"**.

### Paso 2 — Registrar una validación

Puedes realizar validaciones de distintos tipos:

- **Tipo de validación**:
  - `temperature` (temperatura): se verificó que la temperatura se mantuvo en rango.
  - `product_integrity` (integridad del producto): el producto no sufrió daños.
  - `transport` (transporte): el traslado se realizó en condiciones adecuadas.
  - `storage` (almacenamiento): la nueva ubicación cumple con requisitos de almacenamiento.
- **ID del corte de energía (powerOutageId)**.
- **Resultado de la validación (result)** (opcional): texto descriptivo.
- **¿Pasó la validación? (passed)**: sí o no.
- **Validado por (validatedBy)** (opcional): quién realizó la validación.

### Paso 3 — Consultar validaciones

Lista todas las validaciones asociadas a un corte de energía para confirmar que los productos están en condiciones.

---

## Flujo principal — Cerrar la contingencia (Calidad)

### Paso 1 — Verificar que todas las etapas estén completas

Asegúrate de que:
- El corte de energía esté registrado con fechas y causas.
- El cálculo de hielo seco esté documentado.
- Las transferencias necesarias estén registradas.
- Las validaciones de integridad estén aprobadas.

### Paso 2 — Transicionar el estado

Usa la opción de transición de estado del workflow para cerrar la contingencia.

### Paso 3 — Confirmar

Calidad confirma el cierre. La contingencia queda registrada como finalizada.

---

## Preguntas frecuentes

**[El corte de energía terminó pero no tengo la hora exacta]**

Puedes registrar solo la fecha y hora de inicio. Si luego confirmas la hora de fin, actualiza el registro. La duración se calculará en base a ambas fechas.

**[No sé cuánto hielo seco necesito]**

El cálculo de hielo seco depende del volumen del contenedor, la temperatura objetivo y la duración del corte. Si tienes dudas, consulta a Calidad o al área técnica para definir el método de cálculo.

**[Los productos se transfirieron pero no llegaron a destino]**

Registra la transferencia de todas formas y agrega una nota en las validaciones indicando el problema. Si los productos no llegaron, genera un nuevo incidente o caso de seguimiento.

**[Una validación salió negativa (producto dañado)]**

Si la validación de integridad del producto falla, debes evaluar si el producto se puede recuperar, si debe ser reclasificado o si debe ser objeto de un recall (CA-01-06).

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Registrar un corte de energía | Ve a "Corte de Energía" → fecha inicio, áreas afectadas, causa |
| Calcular hielo seco | Ve a "Hielo Seco" → vincula al corte → volumen, temperatura, duración |
| Transferir productos | Ve a "Transferencia" → origen, destino, cantidad |
| Validar integridad | Ve a "Validación" → tipo y resultado |
| Cerrar la contingencia | Cambia el estado del workflow (solo Calidad) |
