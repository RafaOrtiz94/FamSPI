# Guía de uso — Compras Privadas

> **Para quién es esta guía:** Comercial, ACP comercial, servicio técnico, backoffice, operaciones, logística y gerencia que gestiona la compra, entrega e instalación de equipos para clientes finales.

---

## ¿Para qué sirve este módulo?

Este módulo gestiona el ciclo completo de una **compra privada de equipos**: desde que un cliente solicita un equipo personalizado, hasta que el equipo se instala y firma el acta de entrega. A diferencia de las compras públicas, las compras privadas siguen un flujo contractual directo con el cliente.

El flujo incluye:

1. Creación de la solicitud de compra.
2. Envío de oferta al proveedor.
3. Firma del proveedor y subida del contrato.
4. Inspección técnica del equipo.
5. Coordinación de instalación.
6. Entrega y acta de entrega firmada digitalmente.
7. Cierre formal del proceso.

Cada cambio de estado en el proceso genera notificaciones automáticas a las partes involucradas.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Comercial | Crear compras privadas, enviar ofertas |
| ACP comercial | Gestionar ofertas, firmar proformas, solicitar inspección |
| Jefe comercial | Supervisar compras, generar business case |
| Servicio técnico / técnico | Realizar inspección en sitio, gestionar instalación |
| Backoffice comercial | Procesar el flujo completo |
| Operaciones / logística | Coordinar fechas de entrega, marcar llegada y completar entrega |
| Gerencia | Supervisar y aprobar etapas clave |

---

## Pantalla principal

El acceso a compras privadas depende de tu área:

| Ruta | Vista |
|---|---|
| `/dashboard/backoffice/private-purchases` | Workspace general (backoffice) |
| `/dashboard/servicio-tecnico/compras-privadas` | Vista para servicio técnico |
| `/dashboard/operaciones/private-purchases` | Vista para jefe de operaciones |
| `/dashboard/logistica/private-purchases` | Vista para logística |
| `/dashboard/servicio-tecnico/entregas-privadas` | Seguimiento de entregas (servicio técnico) |

### ¿Qué significa cada estado?

| Estado | Qué significa |
|---|---|
| **Borrador** | La compra está creándose |
| **Oferta enviada** | Esperando respuesta del proveedor |
| **Contrato firmado** | Proveedor aceptó; listo para inspección |
| **En inspección** | Técnico evalúa el equipo |
| **En instalación** | Coordinando la puesta en marcha |
| **En entrega** | Esperando fecha de entrega al cliente |
| **Entregado** | Equipo en manos del cliente, acta firmada |
| **Cerrado** | Proceso completado |

---

## Flujo principal — Crear una compra privada (comercial)

### Paso 1 — Ingresar al módulo

Ve a la ruta de compras privadas según tu área.

### Paso 2 — Tocar "Nueva compra" o "+"

Completa los datos iniciales:

- Cliente final.
- Equipo requerido.
- Especificaciones técnicas.
- Presupuesto estimado.

### Paso 3 — Guardar como borrador

La compra queda en estado **Borrador**.

---

## Flujo principal — Gestionar la oferta y el contrato

### Paso 1 — Enviar oferta al proveedor

Una vez listo el requerimiento, toca **"Enviar oferta"**. El sistema registra la oferta comercial enviada al proveedor.

### Paso 2 — Subir proforma o respuesta del proveedor

Cuando el proveedor responde, adjunta su proforma o cotización.

### Paso 3 — Firmar la oferta (ACP comercial)

Si la oferta debe ser firmada por ACP antes de proceder:

1. Revisa la propuesta del proveedor.
2. Toca **"Firmar oferta"**.
3. La oferta queda firmada digitalmente.

### Paso 4 — Subir contrato firmado

Si el proveedor exige contrato:

1. Adjunta el contrato firmado por ambas partes.
2. El sistema notifica a las áreas siguientes para continuar el flujo.

---

## Flujo principal — Inspección técnica

### Paso 1 — Solicitar inspección

Una vez firmado el contrato, ACP o comercial toca **"Solicitar inspección"**.

### Paso 2 — Coordinar fecha de inspección

El jefe técnico define la fecha y lugar de la inspección en sitio.

### Paso 3 — Realizar la inspección

El técnico concurre al lugar, revisa el equipo y registra su evaluación en el sistema.

---

## Flujo principal — Instalación y entrega

### Paso 1 — Coordinar instalación

Después de la inspección, se coordina la fecha de instalación en el cliente.

### Paso 2 — Marcar llegada del equipo

Cuando el equipo llega a la ubicación del cliente, operaciones o logística toca **"Marcar llegada"** en el sistema.

### Paso 3 — Completar la instalación

El técnico instala el equipo y registra el workflow de instalación.

### Paso 4 — Emitir guías de entrega

Adjunta las guías de remisión correspondientes.

### Paso 5 — Firmar acta de entrega

El cliente y el representante de la empresa firman el acta digitalmente.

### Paso 6 — Finalizar el acta

Una vez firmada por todas las partes, el acta se cierra formalmente.

---

## Flujo principal — Ver el timeline de una compra

### Paso 1 — Abrir la compra

Toca la compra en la lista.

### Paso 2 — Consultar el timeline

Verás cada paso del proceso con fecha, usuario que lo realizó y comentarios.

---

## Preguntas frecuentes

**[No veo una compra en mi lista]**

Filtra por estado o verifica que estés en la vista de tu área correspondiente (backoffice, servicio técnico, operaciones, logística).

**[La oferta fue rechazada por el proveedor]**

El proveedor puede registrar su respuesta en el sistema. Si no desea continuar, la compra puede cancelarse o renegociarse.

**[La inspección no fue aprobada]**

El técnico registrará las observaciones. Según el resultado, se pueden solicitar correcciones al proveedor o cancelar la compra.

**[El cliente no puede firmar el acta de entrega]**

Coordina una fecha posterior o utiliza la firma digital remota. Si el acta queda pendiente, el sistema mantiene la compra en estado "En entrega" hasta que se firme.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Crear una compra privada | Ve al workspace → "Nueva compra" |
| Gestionar oferta y proforma | Abre la compra → "Oferta" / "Contrato" |
| Solicitar/coordinar inspección | Abre la compra → "Inspección" |
| Coordinar entrega | Abre la compra → "Entrega" |
| Firmar acta de entrega | Abre la compra → "Acta de entrega" |
| Ver el historial | Abre la compra → "Timeline" |
