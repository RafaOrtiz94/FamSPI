# Guía de uso — Quejas y Reclamos (CA-01-07)

> **Para quién es esta guía:** Personal de Calidad y Gerencia que registra, investiga y resuelve quejas de clientes o partes interesadas.

---

## ¿Para qué sirve este submódulo?

Este submódulo gestiona las **quejas y reclamos** que ingresan por vías externas o internas. Sirve para capturar la voz del cliente, investigar la causa raíz de cada insatisfacción, aplicar compensaciones cuando corresponda y vincular el caso al sistema de **Acciones Correctivas y Preventivas (CAPA)** cuando la queja revela un problema sistémico.

El flujo incluye:

1. **Registro (Intake)**: recepción formal de la queja con datos del reclamante y el producto/servicio afectado.
2. **Investigación**: análisis de la causa raíz y hallazgos.
3. **Compensación**: gestión de reembolsos, créditos o reemplazos.
4. **CAPA**: vinculación a acciones correctivas si el problema requiere mejoras permanentes.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Acceso completo: registrar quejas, investigar, gestionar reembolsos, vincular CAPA, transicionar estados |
| Gerencia | Registrar quejas, investigar, gestionar reembolsos, vincular CAPA |

> Solo Calidad puede cambiar los estados del workflow de queja (transiciones). Gerencia puede participar en todas las etapas operativas.

---

## Pantalla principal

La pantalla se llama **"Quejas y Reclamos"** y muestra:

- Tarjeta de título con ícono de alerta.
- Subtítulo: *"Sistema de gestión de quejas GXP con investigación y link a CAPA."*
- Cuatro tarjetas de resumen:
  - Flujos activos.
  - RBAC privado.
  - Trazabilidad GXP.
  - Integración con CAPA.
- Cuatro **tarjetas de flujo**:
  1. **Intake**: formulario de ingreso de quejas.
  2. **Investigación**: análisis de causa raíz.
  3. **Reembolsos**: gestión de compensaciones.
  4. **CAPA**: link a acciones correctivas.

Al tocar una tarjeta, se despliega el panel correspondiente.

---

## Flujo principal — Registrar una queja (Intake)

### Paso 1 — Acceder a "Intake"

Toca la tarjeta **"Intake"**.

### Paso 2 — Completar el formulario de ingreso

Debes registrar:

- **Tipo de queja**:
  - `quality` (calidad del producto).
  - `service` (servicio al cliente).
  - `delivery` (entrega / logística).
  - `billing` (facturación / cobros).
  - `other` (otra).
- **Asunto**: título breve de la queja.
- **Descripción**: detalle completo del reclamo.
- **Nombre del reclamante** (opcional).
- **Correo del reclamante** (opcional, debe ser un email válido).
- **Teléfono del reclamante** (opcional).
- **Orden asociada (orderId)** (opcional): si la queja está vinculada a una orden de compra o entrega.
- **Producto asociado (productId)** (opcional): si la queja corresponde a un producto específico.
- **Prioridad**:
  - `low` (baja).
  - `medium` (media).
  - `high` (alta).
  - `critical` (crítica).

### Paso 3 — Enviar el registro

Toca **"Guardar"** o **"Crear"**. El sistema asigna un ID a la queja y la deja disponible para investigación.

---

## Flujo principal — Investigar la queja

### Paso 1 — Acceder a "Investigación"

Toca la tarjeta **"Investigación"**.

### Paso 2 — Registrar la investigación

Vincula la investigación a la queja existente:

- **ID de la queja (complaintId)**: selecciona la queja que estás investigando.
- **Investigador asignado (investigatorId)**: quién lleva la investigación.
- **Hallazgos (findings)**: qué encontraste en la investigación.
- **Causa raíz (rootCause)**: identificación de la causa principal del problema.

### Paso 3 — Consultar investigaciones

Puedes listar investigaciones filtrando por queja o por estado.

---

## Flujo principal — Gestionar reembolsos o compensaciones

### Paso 1 — Acceder a "Reembolsos"

Toca la tarjeta **"Reembolsos"**.

### Paso 2 — Registrar una compensación

Vincula el reembolso a la queja:

- **ID de la queja (complaintId)**.
- **Monto**: valor de la compensación.
- **Tipo de reembolso**:
  - `full` (reembolso total).
  - `partial` (reembolso parcial).
  - `credit` (crédito a favor).
  - `replacement` (reemplazo del producto).
- **Aprobado por (approvedBy)** (opcional): quién autorizó la compensación.

### Paso 3 — Consultar reembolsos

Puedes listar reembolsos filtrando por queja o estado.

---

## Flujo principal — Vincular a CAPA

### Paso 1 — Acceder a "CAPA"

Toca la tarjeta **"CAPA"**.

### Paso 2 — Crear el vínculo

Si la queja revela un problema que requiere una acción correctiva permanente:

- **ID de la queja (complaintId)**.
- **ID del CAPA (capaId)** (opcional): si ya existe un CAPA creado para esta causa.
- **Descripción**: explica por qué esta queja se vincula a un CAPA.

### Paso 3 — Consultar vínculos

Puedes listar los vínculos entre quejas y CAPA para ver qué reclamos generaron acciones correctivas.

---

## Flujo principal — Transicionar el estado del workflow (Calidad)

### Paso 1 — Seleccionar el flujo a transicionar

El sistema permite cambiar el estado de cualquiera de los cuatro flujos internos de la queja:
- `intake`
- `investigation`
- `refunds`
- `capa`

### Paso 2 — Definir la transición

Indica:
- El **registro** (ID y estado actual).
- El **estado destino (toStatus)**.
- **Notas** explicativas (opcional).

### Paso 3 — Confirmar

Calidad ejecuta la transición. El sistema valida que la transición sea permitida por la máquina de estados antes de aplicarla.

---

## Preguntas frecuentes

**[Puedo registrar una queja sin datos del reclamante]**

Sí. El nombre, correo y teléfono son opcionales. Sin embargo, si la queja requiere seguimiento o respuesta, es recomendable contar con los datos de contacto.

**[Qué pasa si una queja revela un problema mayor]**

Vincula la queja a un CAPA en la sección correspondiente. Así se asegura que el problema no se repita y se generen acciones correctivas documentadas.

**[Un reembolso fue aprobado pero no se ejecutó]**

Registra el reembolso en el sistema con la persona que lo aprobó. Si el pago depende de Finanzas, coordina con ese área para su ejecución.

**[Puedo cerrar una queja sin investigar]**

Teóricamente el sistema permite transiciones, pero normativamente una queja debe tener al menos una investigación registrada antes de cerrarse. Contacta a Calidad si ves casos cerrados sin investigación.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Registrar una nueva queja | Ve a "Intake" → completa tipo, asunto, descripción y prioridad |
| Investigar la causa raíz | Ve a "Investigación" → registra hallazgos y causa raíz |
| Gestionar una compensación | Ve a "Reembolsos" → registra monto y tipo |
| Vincular a CAPA | Ve a "CAPA" → asocia la queja a un CAPA existente |
| Cambiar el estado del flujo | Usa la transición de workflow (solo Calidad) |
