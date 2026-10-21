# Guía de uso — Firma Digital (FamSign)

> **Para quién es esta guía:** Colaboradores que necesitan firmar documentos oficiales, personal que verifica autenticidad de documentos firmados, y administradores que gestionan firmas.

---

## ¿Para qué sirve este módulo?

Este módulo permite firmar documentos digitalmente con el sello institucional de FamProject. Cada documento firmado recibe un **código QR** de verificación pública: cualquier persona puede escanearlo y confirmar que el documento es auténtico, sin necesidad de tener una cuenta en el sistema.

Además, el sistema guarda un **historial completo de auditoría**: quién firmó, cuándo, desde dónde y qué cambió en cada paso. Esto es útil para trámites legales o internos que necesiten trazabilidad.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Gerencia | Firmar documentos, ver bandeja de firmas |
| Gerencia general | Firmar documentos, ver bandeja de firmas |
| TI / jefe de TI | Firmar documentos, ver bandeja de firmas |
| Admin TI | Firmar documentos, ver bandeja de firmas |
| Comercial / jefe comercial | Firmar documentos, ver bandeja de firmas |
| Talento Humano | Firmar documentos de personal (permisos, vacaciones) |
| Finanzas | Firmar documentos financieros |
| Calidad | Firmar documentos de calidad |
| Cualquier persona con enlace público | Verificar un documento firmado por token (sin necesidad de cuenta) |

---

## Pantalla principal

La bandeja de firmas está en la ruta **"Firmas"** del menú principal.

Verás tres opciones principales:

1. **"Documentos creados"**: documentos que tú generaste y enviaste a firmar.
2. **"Documentos completados"**: documentos que ya fueron firmados por todas las partes.
3. **"Todos los documentos"**: vista general de todo lo que pasa por firma.

### ¿Qué significa cada estado?

| Estado | Qué significa |
|---|---|
| **Pendiente de firma** | El documento está listo pero falta que alguien lo firme |
| **Firmado** | Todas las partes requeridas ya firmaron |
| **Rechazado** | Alguien rechazó firmar; el documento no tiene validez |

---

## Flujo principal — Firmar un documento

### Paso 1 — Ir a la bandeja de firmas

En el menú principal, selecciona **"Firmas"**.

### Paso 2 — Elegir "Documentos pendientes"

Toca la opción **"Bandeja de entrada"** o **"Pendientes"**. Ahí verás los documentos que necesitan tu firma.

### Paso 3 — Abrir el documento

Toca el documento de la lista. El sistema mostrará una vista previa del documento para que lo revises antes de firmar.

### Paso 4 — Revisar el contenido

Lee el documento con atención. Asegúrate de que los datos sean correctos antes de firmar, porque una vez firmado, el documento queda registrado con validez digital.

### Paso 5 — Firmar

Si estás de acuerdo, toca el botón **"Firmar"** (puede aparecer como **"Firmar documento"** o tener el ícono de un bolígrafo). Confirma la acción si el sistema te lo pide.

### Resultado

El sistema genera un nuevo PDF con el sello institucional y el código QR de verificación. El documento pasa a estado **"Firmado"** y el sistema registra la fecha, hora y tu cuenta en el historial de auditoría.

---

## Flujo principal — Verificar un documento firmado (sin cuenta)

Si eres una persona externa o no tienes acceso al sistema:

### Paso 1 — Escanear el código QR

Usa la cámara de tu celular o cualquier app de lector de QR para escanear el código que aparece en el documento firmado.

### Paso 2 — Abrir el enlace

El QR te llevará a una página pública del sistema. Allí verás:

- Confirmación de que el documento es **válido**.
- Fecha y hora de la firma.
- Nombre de la persona que firmó.
- Sello institucional verificado.

No necesitas iniciar sesión para ver esto.

---

## Flujo principal — Ver el historial de un documento firmado

### Paso 1 — Abrir el documento firmado

En la bandeja de firmas, busca el documento en **"Documentos completados"** y tócalo.

### Paso 2 — Consultar la trazabilidad

Busca la opción **"Trazabilidad"**, **"Historial"** o **"Auditoría"**. Verás una lista con cada paso:

- Quién inició el documento.
- Quién lo revisó.
- Quién lo firmó y en qué momento.
- Si hubo rechazos o correcciones.

Esto sirve para demostrar la autenticidad del documento en caso de auditorías o requerimientos legales.

---

## Flujo principal — Crear un documento para firmar (según el flujo del módulo origen)

Algunos módulos generan documentos automáticamente para firma:

- **Permisos y vacaciones**: cuando un colaborador pide permiso, el sistema genera el documento automáticamente y lo envía a la bandeja del jefe o de Talento Humano para firma.
- **Mantenimientos**: ciertos mantenimientos requieren firma de cierre.
- **Documentos generales**: cualquier área puede generar un documento y enviarlo a firma.

En cada caso, tú solo debes revisar y firmar desde la bandeja de Firmas.

---

## Flujo principal — Revisar workflows de firma (avanzado)

Para documentos que requieren múltiples firmas en cadena:

### Paso 1 — Ir al detalle del workflow

Si el documento tiene varias etapas de firma, busca la opción **"Detalle de workflow"** o **"Workflows"**.

### Paso 2 — Ver el estado de cada etapa

El sistema muestra:

- Quién debe firmar en cada etapa.
- Quién ya firmó.
- Quién falta por firmar.
- Tiempos transcurridos entre cada firma.

---

## Preguntas frecuentes

**[El QR no me lleva a la página de verificación]**

Asegúrate de escanear el código completo, no una parte. Si el QR está distorsionado (por una foto o impresión de mala calidad), pide una copia digital del PDF para verificar desde el enlace directo.

**[Firmé un documento que no era]**

Si te diste cuenta después de firmar, contacta a la persona que generó el documento para que lo anule y cree uno nuevo. La firma digital no se puede borrar una vez registrada.

**[No veo el documento en mi bandeja]**

Verifica que el documento realmente requiera tu firma. Si crees que deberías verlo y no aparece, avisa a quien generó el documento para que revise los destinatarios.

**[El documento firmado no tiene el QR]**

Esto puede ocurrir si el sistema tuvo un error al generar el PDF final. Contacta a TI para regenerar el documento firmado.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Firmar un documento pendiente | Ve a "Firmas" → "Bandeja de entrada" → toca "Firmar" |
| Verificar un documento sin cuenta | Escanea el QR del documento firmado |
| Consultar quién firmó algo | Abre el documento → "Trazabilidad" |
| Ver todos tus documentos | Ve a "Firmas" → "Todos los documentos" |
| Ver documentos que enviaste | Ve a "Firmas" → "Documentos creados" |
