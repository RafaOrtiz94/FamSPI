# Guía de uso — Retiro del Mercado / Recall (CA-01-06)

> **Para quién es esta guía:** Personal de Calidad y Gerencia que gestiona el retiro de productos del mercado ante una desviación o riesgo detectado.

---

## ¿Para qué sirve este submódulo?

Este submódulo gestiona el proceso de **retiro del mercado (Recall)** de productos. Cuando se detecta una desviación de calidad que afecta a lotes ya distribuidos (por ejemplo, una excursión de temperatura en cadena de frío, una contaminación o un defecto de fabricación), Calidad debe actuar rápidamente para:

- Rastrear el lote afectado y su distribución.
- Comunicar a clientes, autoridades o consumidores.
- Poner en cuarentena el producto disponible.
- Gestionar la logística de retiro, reemplazo o destrucción.

El objetivo es hacer el recall de forma ordenada, trazable y cumpliendo con normativas GXP.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Acceso completo: crear trazabilidad, registrar comunicaciones, cuarentenas, logística y transicionar estados |
| Gerencia | Ver y crear trazabilidad, comunicaciones, cuarentenas y logística |

> Solo Calidad puede cambiar el estado general del flujo de recall. Gerencia puede participar en todas las etapas excepto la transición final de estado.

---

## Pantalla principal

La pantalla se llama **"Retiro del Mercado (Recall)"** y muestra:

- Tarjeta de título con ícono de alerta.
- Subtítulo: *"Sistema de gestión de retiros GXP con trazabilidad y logística."*
- Cuatro tarjetas de resumen:
  - Flujos activos.
  - RBAC privado.
  - Trazabilidad GXP.
  - Alerta de Recall.
- Cuatro **tarjetas de flujo (lane cards)**:
  1. **Trazabilidad**: lotes afectados, distribución y rastreo.
  2. **Comunicaciones**: avisos a autoridades y consumidores.
  3. **Cuarentena**: productos retenidos en ubicaciones.
  4. **Logística**: retiro, reemplazo y destrucción.

Al tocar una tarjeta, se despliega el panel correspondiente con el formulario o listado del flujo.

---

## Flujo principal — Iniciar un recall

### Paso 1 — Crear el registro de trazabilidad

Toca la tarjeta **"Trazabilidad"** y luego **"+ Nuevo"**. Completa:

- **Producto (productId)**: identificador del producto afectado.
- **Nombre del producto**: descripción comercial.
- **Número de lote (lotNumber)**: el lote específico que debe retirarse.
- **Fecha de fabricación**.
- **Fecha de vencimiento**.
- **Cantidad total afectada**.
- **Canales de distribución**: dónde se distribuyó el lote.
- **Países afectados** (si aplica).
- **Nivel de recall**:
  - `wholesale` (mayorista).
  - `retail` (minorista).
  - `consumer` (consumidor final).
  - `defect` (defecto de fabricación específico).

### Paso 2 — Verificar la trazabilidad

El sistema registra el lote con estado inicial. Puedes consultar en cualquier momento el listado de trazabilidad filtrando por producto, lote o estado.

---

## Flujo principal — Gestionar comunicaciones

### Paso 1 — Acceder a "Comunicaciones"

Toca la tarjeta **"Comunicaciones"**.

### Paso 2 — Crear una comunicación

Debes seleccionar el recall al que corresponde y definir:

- **Tipo de comunicación**:
  - `press` (comunicado de prensa).
  - `direct` (comunicación directa a clientes).
  - `regulatory` (notificación a autoridades sanitarias).
  - `internal` (comunicación interna).
- **Asunto**: título del aviso.
- **Cuerpo**: texto del mensaje.
- **Audiencia objetivo**: quiénes deben recibir el aviso.
- **Canales** (opcional): correo, llamada, etc.

### Paso 3 — Enviar o gestionar el estado

Las comunicaciones pueden estar en estado:
- `draft` (borrador).
- `sent` (enviada).
- `cancelled` (cancelada).

---

## Flujo principal — Registrar cuarentena

### Paso 1 — Acceder a "Cuarentena"

Toca la tarjeta **"Cuarentena"**.

### Paso 2 — Crear un registro de cuarentena

Debes indicar:

- **Recall asociado (recallId)**.
- **Ubicación (locationId)**: dónde está retenido el producto.
- **Nombre de la ubicación**.
- **Cantidad en cuarentena**.
- **Motivo de la cuarentena**.

### Paso 3 — Transicionar el estado de la cuarentena

Los estados posibles son:

| Estado | Qué significa |
|---|---|
| **pending** | Pendiente de aprobación |
| **approved** | Aprobada por Calidad |
| **released** | Liberada (el producto ya no está en cuarentena) |
| **destroyed** | Destruida |

---

## Flujo principal — Gestionar logística de retiro

### Paso 1 — Acceder a "Logística"

Toca la tarjeta **"Logística"**.

### Paso 2 — Registrar la operación logística

Debes indicar:

- **Recall asociado**.
- **Tipo de operación**: retiro del mercado, reemplazo del producto, destrucción.
- **Cantidad movilizada**.
- **Ruta o destino**.
- **Transporte utilizado** (si aplica).

### Paso 3 — Actualizar el estado logístico

Los estados posibles son:

| Estado | Qué significa |
|---|---|
| **pending** | Pendiente de ejecutar |
| **in_transit** | En tránsito |
| **completed** | Completada |
| **cancelled** | Cancelada |

---

## Flujo principal — Cerrar el recall (Calidad)

### Paso 1 — Verificar que todas las etapas estén completas

Antes de cerrar, asegúrate de que:
- La trazabilidad del lote esté documentada.
- Las comunicaciones hayan sido enviadas.
- La cuarentena esté aplicada o liberada según corresponda.
- La logística esté ejecutada.

### Paso 2 — Transicionar el estado general

Toca la opción de transición de estado del workflow. El sistema valida que se pueda cambiar al estado final (cerrado) según la máquina de estados configurada.

### Paso 3 — Confirmar

Calidad confirma el cierre. El recall queda registrado como finalizado.

---

## Preguntas frecuentes

**[El producto ya fue vendido y no puedo ponerlo en cuarentena]**

Usa la sección de **Logística** para registrar el retiro del mercado. Si el producto ya está en manos del consumidor, el tipo de recall será `consumer` y la comunicación deberá ser directa o de prensa.

**[Puedo cancelar una comunicación ya enviada]**

Sí, puedes cambiar el estado a `cancelled` si la comunicación fue enviada por error o si el recall se canceló. Usa la sección de Comunicaciones para actualizar el estado.

**[Qué diferencia hay entre cuarentena y destrucción]**

Cuarentena es el estado temporal en el que el producto queda retenido en una ubicación controlada. Destrucción es el estado final cuando el producto se elimina físicamente.

**[Cómo sé qué lotes están afectados]**

Usa la sección de **Trazabilidad** para filtrar por número de lote, producto o estado. Ahí verás todos los registros de recall y su estado actual.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Iniciar un recall | Ve a "Trazabilidad" → "+ Nuevo" → registra el lote |
| Comunicar a clientes o autoridades | Ve a "Comunicaciones" → "+ Nuevo" |
| Poner producto en cuarentena | Ve a "Cuarentena" → registra la ubicación y cantidad |
| Gestionar retiro o destrucción | Ve a "Logística" → registra la operación |
| Cerrar el recall | Cambia el estado del workflow (solo Calidad) |
