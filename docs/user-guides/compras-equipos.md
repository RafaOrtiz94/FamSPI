# Guía de uso — Compras de Equipos

> **Para quién es esta guía:** Comercial, ACP comercial, jefes de comercial y gerencia que gestiona la compra pública de equipos para clientes.

---

## ¿Para qué sirve este módulo?

Este módulo gestiona el ciclo completo de una **compra pública de equipos**. A diferencia de las compras privadas, este flujo sigue el proceso estándar de adquisición de la empresa: desde que el área comercial solicita un equipo, hasta que se recibe, inspecciona y entrega al cliente.

El flujo incluye:

1. Creación de la orden de compra desde Comercial.
2. Consulta de disponibilidad con el proveedor.
3. Solicitud y carga de proforma.
4. Firma de la proforma.
5. Solicitud de inspección técnica.
6. Coordinación de fechas de entrega.
7. Recepción del equipo operativa (llegada, checklist).
8. Instalación y entrega final.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Comercial | Crear órdenes de compra, subir proformas |
| ACP comercial | Gestionar disponibilidad del proveedor, firmar proformas, solicitar inspección |
| Jefe comercial | Supervisar compras, aprobar etapas |
| Gerencia / gerente general | Supervisar compras |
| Servicio técnico / técnico | Realizar inspección en sitio, gestión de instalación |
| Operaciones / logística | Marcar llegada, coordinar fechas, completar entrega |

---

## Pantalla principal

El acceso a las compras de equipos está en:

- **`/dashboard/comercial/equipment-purchases`** — Vista de compras para comercial general.
- **`/dashboard/comercial/acp-compras`** — Vista específica para ACP comercial.

### ¿Qué significa cada estado?

| Estado | Qué significa |
|---|---|
| **Borrador** | Orden de compra en creación |
| **Disponibilidad consultada** | Proveedor respondió sobre stock y tiempos |
| **Proforma recibida** | El proveedor envió la cotización formal |
| **Proforma firmada** | ACP firmó la proforma del proveedor |
| **Contrato cargado** | Se adjuntó el contrato correspondiente |
| **En inspección** | Técnico revisa el equipo |
| **En entrega** | Coordinando la llegada al cliente |
| **Entregado** | Equipo recibido, instalado y cerrado |

---

## Flujo principal — Crear una orden de compra

### Paso 1 — Ingresar al módulo

Ve a **"Compras de equipos"** en el área Comercial o ACP.

### Paso 2 — Tocar "Nueva orden" o "+"

Completa:

- **Cliente**: quién recibirá el equipo.
- **Equipo requerido**: modelo, cantidad, especificaciones.
- **Presupuesto**: monto estimado.
- **Proveedor sugerido** (si aplica).

### Paso 3 — Guardar

La orden queda como borrador.

---

## Flujo principal — Gestionar disponibilidad y proforma

### Paso 1 — Consultar disponibilidad

ACP toca **"Consultar disponibilidad"** con el proveedor. El sistema registra el tiempo de respuesta y el stock confirmado.

### Paso 2 — Solicitar proforma

Si hay stock, solicita la proforma formal al proveedor.

### Paso 3 — Subir proforma

Adjunta el documento de proforma recibido.

### Paso 4 — Firmar proforma

ACP revisa y toca **"Firmar proforma"**.

---

## Flujo principal — Inspección y entrega técnica

### Paso 1 — Solicitar inspección

Una vez firmada la proforma, solicita la inspección técnica.

### Paso 2 — Coordinar fecha

El jefe técnico define la fecha de inspección en sitio.

### Paso 3 — Marcar llegada

Cuando el equipo llega a las instalaciones del cliente:

1. Verifica que coincida con lo solicitado.
2. Completa el checklist de recepción.
3. Toca **"Marcar llegada"** en el sistema.

### Paso 4 — Instalar

El técnico ejecuta la instalación y registra el workflow de puesta en marcha.

---

## Flujo principal — Consultar agenda técnica

### Paso 1 — Ir a "Agenda técnica"

En el workspace de compras, busca la sección **"Agenda"** o **"Calendario técnico"**.

### Paso 2 — Revisar inspecciones y entregas programadas

Verás el cronograma de todos los eventos técnicos relacionados con tus compras.

---

## Flujo principal — Cerrar la compra

Después de la instalación exitosa:

### Paso 1 — Completar entrega

Confirma que el equipo está operativo en el cliente.

### Paso 2 — Cerrar la orden

Toca **"Cerrar orden"** o **"Completar"**. El estado pasa a **"Entregado"**.

---

## Preguntas frecuentes

**[El proveedor cambios los tiempos de entrega]**

Actualiza la fecha en el sistema y notifica al cliente. Si el retraso es considerable, coordina con operaciones para reprogramar.

**[La inspección encontró fallas en el equipo]**

Registra las observaciones en la inspección. El equipo puede ser rechazado y regresado al proveedor, o se acuerda una compensación.

**[No veo mis compras en la lista]**

Filtra por estado o verifica que estés en la vista correcta (comercial o ACP). Algunas compras están visibles solo para roles específicos.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Crear orden de compra | Ve a "Compras de equipos" → "Nueva orden" |
| Gestionar oferta del proveedor | Abre la orden → "Disponibilidad" / "Proforma" |
| Firmar proforma (ACP) | Abre la orden → "Firmar proforma" |
| Solicitar inspección | Abre la orden → "Inspección técnica" |
| Marcar llegada y completar entrega | Abre la orden → "Entrega" → "Marcar llegada" |
| Ver agenda técnica | Ve a "Agenda técnica" |
