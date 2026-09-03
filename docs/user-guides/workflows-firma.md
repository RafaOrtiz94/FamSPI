# Guía de uso — Workflows de Firma

> **Para quién es esta guía:** Colaboradores que participan en procesos de firma en cadena (varios firmantes en orden), y administradores que crean y gestionan workflows de firma complejos.

---

## ¿Para qué sirve este módulo?

Este módulo complementa la firma digital simple y agrega la posibilidad de crear **flujos de firma en cadena**. Mientras que la firma simple permite firmar un documento en un solo paso, los workflows permiten definir varios firmantes en un orden específico, de modo que cada uno firma después del anterior.

Esto es útil para documentos que necesitan la aprobación de varias personas en secuencia:

- Contratos que firman jurídico, luego gerencia, luego el cliente.
- Documentos internos que requieren visto bueno de jefe, luego de calidad, luego de finanzas.
- Cualquier trámite cuya validez dependa de múltiples partes.

Además, el módulo guarda el historial completo de cada firma y permite verificar el documento en cualquier momento público mediante un token.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Cualquier usuario autenticado | Ver sus workflows pendientes, firmar o rechazar documentos que le corresponden |
| Cualquier usuario autenticado | Crear workflows de firma (según el módulo origen) |
| Calidad, Gerencia, TI, Comercial, Talento Humano, Finanzas | Acceso a workflows según el área que los genera |

---

## Pantalla principal

La pantalla principal muestra el estado de tus workflows:

1. **"Pendientes"**: workflows que esperan tu firma.
2. **"Completados"**: workflows que ya fueron firmados por todas las partes.
3. **"Todos"**: vista completa de workflows (creados por ti o en los que participas).

---

## Flujo principal — Firmar dentro de un workflow

### Paso 1 — Ver tus pendientes

Ingresa al área de **Firmas** del menú. Toca la pestaña **"Pendientes"** o **"Bandeja de entrada"**.

Verás los workflows que requieren tu firma en este momento.

### Paso 2 — Abrir el workflow

Toca el workflow de la lista. El sistema muestra:

- El documento PDF a firmar.
- El orden de los firmantes (quién firma antes y quién después).
- Tu posición en la cadena.

> **Importante:** Si aún no te toca firmar (porque otro firmante no lo ha hecho), el botón de firma estará deshabilitado. Debes esperar tu turno.

### Paso 3 — Revisar el documento

Lee el PDF con atención. Asegúrate de que los datos sean correctos antes de firmar.

### Paso 4 — Firmar

Si estás de acuerdo, toca **"Firmar"**.

El sistema registra tu firma con:

- Fecha y hora exactas.
- Tu cuenta de usuario.
- Dirección IP desde la que firmaste.

### Resultado

El workflow pasa al siguiente firmante en la cadena. Si eras el último, el documento queda completamente firmado y pasa a estado **"Completado"**.

---

## Flujo principal — Rechazar una firma en un workflow

### Paso 1 — Abrir el workflow pendiente

En tu bandeja de pendientes, toca el workflow.

### Paso 2 — Revisar el documento

Asegúrate de que el rechazo es justificado (por ejemplo, el documento tiene datos erróneos o no corresponde al proceso).

### Paso 3 — Tocar "Rechazar"

Toca el botón de rechazo. El sistema te pedirá una justificación.

### Paso 4 — Escribir el motivo

Explica claramente por qué rechazas la firma. Esta justificación quedará en el historial y la verán las demás partes.

### Resultado

El workflow se detiene. El creador o responsable recibirá una notificación para corregir el documento y enviarlo de nuevo.

---

## Flujo principal — Verificar un workflow públicamente

### Paso 1 — Obtener el token de verificación

El token de verificación es un enlace único que se genera cuando se crea el workflow. Lo reciben las personas interesadas o está disponible a través de un enlace del documento.

### Paso 2 — Abrir el enlace de verificación

En un navegador, abre:

```
https://[tu-dominio]/api/v1/signature-workflows/verify/[token]
```

No necesitas iniciar sesión.

### Paso 3 — Consultar el estado

Verás:

- Estado actual del workflow (pendiente, en curso, completado).
- Documento PDF asociado.
- Lista de firmantes con su estado (pendiente, firmado, rechazado).
- Fecha de cada firma.

---

## Flujo principal — Consultar el historial de un workflow

### Paso 1 — Abrir el workflow

Ve a la pestaña **"Todos"** o **"Completados"** y toca el workflow.

### Paso 2 — Buscar "Auditoría" o "Historial"

Dentro del detalle, verás una línea de tiempo con cada evento:

- Creación del workflow.
- Cada paso de firma (quién firmó, cuándo).
- Rechazos y sus justificaciones.
- Finalización.

---

## Flujo principal — Crear un workflow de firma

Este paso lo realiza el módulo origen de forma automática (por ejemplo, un permiso aprobado por Talento Humano, una factura aprobada por Finanzas, un acta de Servicio Técnico). No necesitas crearlo manualmente desde este módulo.

Si necesitas crear uno manualmente:

### Paso 1 — Acceder a la creación de workflows

Busca el botón **"Nuevo workflow"** o **"Crear flujo de firma"**.

### Paso 2 — Subir el documento

Selecciona el PDF que necesitas que sea firmado.

### Paso 3 — Definir los firmantes

Agrega las personas que deben firmar, en el orden correcto. Para cada firmante:

- Nombre y correo.
- Orden de firma.
- Plazo para firmar (si aplica).

### Paso 4 — Enviar

Toca **"Crear workflow"**. El sistema notifica al primer firmante en la cadena.

---

## Preguntas frecuentes

**[El botón de firmar está deshabilitado]**

Significa que todavía no te toca firmar. Debes esperar a que el firmante anterior complete su paso.

**[Rechacé un workflow por error]**

No puedes deshacer un rechazo. Contacta a la persona que creó el workflow para que regenere el documento o corrija el error.

**[No recibo notificación cuando me toca firmar]**

Verifica que tu correo esté correctamente configurado en el sistema. Si no llega la notificación, consulta tu bandeja de pendientes directamente en el módulo.

**[El enlace de verificación no funciona]**

Asegúrate de que el token esté completo y no tenga espacios. Si el token venció, solicita uno nuevo a quien generó el workflow.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Firmar un documento en cadena | Ve a "Firmas" → "Pendientes" → toca "Firmar" |
| Rechazar | Abre el workflow → "Rechazar" con justificación |
| Ver el historial completo | Abre el workflow → "Auditoría" |
| Verificar sin cuenta | Abre el enlace público `/verify/:token` |
| Crear un nuevo flujo | Sube el PDF → agrega firmantes → "Crear workflow" |
