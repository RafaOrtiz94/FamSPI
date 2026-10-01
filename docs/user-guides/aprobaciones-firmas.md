# Guía de uso — Firma Digital (Signature Workflows)

> **Para quién es esta guía:** Usuarios que firman documentos y administradores que crea, envía y verifica workflows de firma interna.

---

## ¿Para qué sirve este módulo?

Este módulo es el **motor transversal de firma documental** del sistema. Gestiona el flujo completo para que un documento PDF sea firmado por varias personas, en el orden definido, con trazabilidad de cada evento.

No es una simple firma digital: es un **workflow secuenciado** que controla:
- Quiénes deben firmar.
- En qué orden deben hacerlo.
- Si un firmante rechaza o no.
- El estado actual del documento (pendiente, firmado, rechazado, etc.).
- La verificación pública del documento firmado.

El workflow se conecta con otros módulos (collab-deliveries, actas de servicio técnico, auditoría, etc.), que usan este motor para firmar actas, contratos, certificados y otros documentos.

---

## ¿Quién puede usarlo?

| Acción | Rol |
|---|---|
| Crear workflow | Usuarios autenticados según la integración del módulo origen |
| Ver mis pendientes | Cualquier usuario autenticado |
| Ver mis completados | Cualquier usuario autenticado |
| Firmar o rechazar | Firmante asignado |
| Verificar documento por link público | Cualquier persona con el token |
| Administrar workflows | Según los roles definidos en la integración |

---

## Flujo principal — Entender el flujo de firma

### Paso 1 — Creación del workflow

Otro módulo del sistema (por ejemplo, Collab Deliveries, Servicio Técnico, Calidad, Capacitaciones, etc.) crea el workflow:
- Toma el PDF generado y hace un **snapshot**.
- Define los **firmantes** y el **orden de firma**.
- Crea el workflow con estado inicial `pending` (pendiente).

### Paso 2 — Envío del workflow

El administrador o sistema ejecuta **"Enviar"**. El primer firmante queda disponible para firmar.

### Paso 3 — Firma por cada firmante

Cada firmante:
- Recibe la notificación.
- Abre el paso (`open`).
- Firma (`sign`) o rechaza (`reject`).

El sistema valida que solo el firmante correspondiente pueda ejecutar la acción y en el orden indicado.

### Paso 4 — Cierre

- Si todos firman: el workflow se completa y el documento queda **firmado digitalmente**.
- Si alguien rechaza: el workflow se marca como rechazado y queda disponible para revisión o reasignación.

### Paso 5 — Verificación pública

Cualquier persona con el link de verificación puede consultar el estado del workflow y el documento. Esto sirve para que terceros (clientes, auditores, autoridades) validen la autenticidad sin acceso al sistema.

---

## Flujo principal — Consultar mis pendientes

### Paso 1 — Acceder a "Mis pendientes"

Endpoint: `GET /me/pending`.

### Paso 2 — Revisar los workflows

Verás los workflows en los que eres el siguiente firmante, con:
- Nombre del documento.
- Orden de firma (qué número de firmante eres).
- Fecha límite (si aplica).
- Estado actual.

---

## Flujo principal — Firmar un documento

### Paso 1 — Abrir el paso

Endpoint: `POST /:id/signers/:signerId/open`.

Esto reserva el turno de firma para el firmante.

### Paso 2 — Firmar

Endpoint: `POST /:id/signers/:signerId/sign`.

Una vez firmado, el sistema avanza al siguiente firmante (si existe).

---

## Flujo principal — Rechazar un documento

### Paso 1 — Abrir el paso

Endpoint: `POST /:id/signers/:signerId/open`.

### Paso 2 — Rechazar

Endpoint: `POST /:id/signers/:signerId/reject`.

El workflow pasa a estado rechazado. El creador puede decidir reasignar el firmante o cancelar el flujo.

---

## Flujo principal — Reasignar un firmante

### Paso 1 — Acceder al detalle del workflow

Endpoint: `GET /:id`.

### Paso 2 — Reasignar

Endpoint: `POST /:id/signers/:signerId/reassign`.

Cambia el firmante original por otro usuario habilitado y Continúa el flujo.

---

## Flujo principal — Verificar un documento firmado

### Paso 1 — Obtener el token de verificación

El workflow genera un token público asociado al documento firmado.

### Paso 2 — Acceder a la verificación

Endpoint público: `GET /verify/:token` (HTML) o `GET /verify/:token/json` (JSON).

Muestra:
- Estado final del workflow.
- Lista de firmantes con fecha/hora de firma.
- Documento final (PDF con firmas o el snapshot guardado).

---

## Flujo principal — Descargar PDFs

- **PDF fuente (snapshot)**: `GET /:id/documents/:documentId/pdf` — documento original.
- **PDF final**: `GET /:id/documents/:documentId/final-pdf` — documento con firmas aplicadas (cuando el flujo está completo).

---

## Preguntas frecuentes

**[No llega la notificación de firma]**

Verifica que el workflow esté enviado (`/send`) y que el usuario esté asignado como firmante. También revisa el módulo de notificaciones.

**[Puedo firmar fuera de orden]**

No. El flujo respeta el orden configurado. El sistema no te permitirá firmar si no es tu turno.

**[El documento firmado no tiene las firmas visibles]**

El PDF final con bloque gráfico de firmas está planificado para una iteración posterior. Actualmente puedes verificar las firmas por el endpoint de verificación pública, que muestra la trazabilidad.

**[Qué pasa si se cancela un workflow]**

Se marca como cancelado y deja de estar disponible para firmar. Los firmantes ya no podrán continuar.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Ver mis documentos pendientes de firma | `GET /me/pending` |
| Ver documentos ya firmados | `GET /me/completed` |
| Firmar un documento | Abrir paso (`open`) → firmar (`sign`) |
| Rechazar un documento | Abrir paso (`open`) → rechazar (`reject`) |
| Cambiar un firmante | Reasignar (`reassign`) |
| Verificar un documento firmado | Acceder a `GET /verify/:token` |
| Descargar el documento original | `GET /:id/documents/:documentId/pdf` |
| Descargar documento final firmado | `GET /:id/documents/:documentId/final-pdf` |
