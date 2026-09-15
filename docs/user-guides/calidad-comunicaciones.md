# Guía de uso — Comunicaciones Internas (CA-01-13)

> **Para quién es esta guía:** Personal de Calidad, Gerencia, Comercial y Servicio Técnico que crea, distribuye y gestiona comunicados oficiales de la empresa.

---

## ¿Para qué sirve este submódulo?

Este submódulo gestiona las **comunicaciones GXP** dentro de la empresa y hacia actores externos. Asegura que avisos, alertas, cambios normativos y mensajes regulatorios lleguen a las personas correctas, por el canal adecuado, con la trazabilidad exigida por normativas de calidad.

No es un gestor de correo electrónico común: es un sistema de comunicaciones **estructurado y auditado** para:

- Difundir cambios en procedimientos o políticas.
- Emitir alertas de calidad o seguridad.
- Notificar a roles o departamentos completos.
- Almacenar registros de lectura y acuse de recibo.
- Gestionar plantillas reutilizables.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Acceso completo: crear comunicaciones, definir destinatarios, adjuntar archivos, crear plantillas, transicionar estados |
| Gerencia | Acción completa |
| Comercial | Ver y marcar como leídas las comunicaciones |
| Servicio técnico | Ver y marcar como leídas las comunicaciones |

> Solo Calidad puede crear, enviar, editar plantillas y transicionar estados. Los demás roles consultan y confirman lectura.

---

## Pantalla principal

La pantalla se llama **"Comunicación Interna/Externa"** y muestra:

- Tarjeta de título con ícono de correo.
- Subtítulo: *"Sistema de gestión de comunicaciones GXP."*
- Cuatro tarjetas de resumen:
  - Flujos activos.
  - RBAC privado.
  - Trazabilidad GXP.
  - Gestión de comunicaciones.
- Cuatro **tarjetas de flujo**:
  1. **Comunicaciones**: canalizaciones de mensajes y avisos.
  2. **Destinatarios**: selección de quiénes reciben la comunicación.
  3. **Adjuntos**: archivos vinculados a la comunicación.
  4. **Plantillas**: modelos reutilizables de comunicaciones frecuentes.

---

## Flujo principal — Crear una comunicación

### Paso 1 — Acceder a "Comunicaciones"

Toca la tarjeta **"Comunicaciones"**.

### Paso 2 — Completar los datos

Debes registrar:

- **Tipo de comunicación**:
  - `internal` (interna).
  - `external` (externa).
  - `emergency` (emergencia).
  - `regulatory` (regulatoria).
  - `general` (general).
- **Título**: asunto del comunicado.
- **Contenido (content)**: texto completo del mensaje.
- **Prioridad**:
  - `low` (baja).
  - `normal` (normal).
  - `high` (alta).
  - `urgent` (urgente).
- **Canal de envío (channel)**:
  - `email` (correo electrónico).
  - `portal` (portal interno).
  - `sms` (mensaje de texto).
  - `whatsapp` (WhatsApp).
  - `physical` (físico / impreso).
  - `all` (todos los canales).
- **Audiencia objetivo (targetAudience)** (opcional): descripción del público al que se envía.
- **Fecha de vencimiento (expirationDate)** (opcional): hasta cuándo es válido el aviso.

### Paso 3 — Enviar

Una vez creada, se asigna a los destinatarios definidos y se despacha por los canales seleccionados.

---

## Flujo principal — Definir los destinatarios

### Paso 1 — Acceder a "Destinatarios"

Toca la tarjeta **"Destinatarios"**.

### Paso 2 — Seleccionar el público

Puedes dirigir la comunicación a:

| Tipo de destinatario | Ejemplo |
|---|---|
| `user` | Una persona específica por su ID. |
| `role` | Todos los usuarios con un rol (ejemplo: todos los operadores). |
| `department` | Todo un departamento. |
| `all` | Toda la empresa. |

### Paso 3 — Vincular

Cada destinatario queda asociado a la comunicación. El sistema registra si la persona leyó el mensaje o no.

---

## Flujo principal — Adjuntar archivos

### Paso 1 — Acceder a "Adjuntos"

Toca la tarjeta **"Adjuntos"**.

### Paso 2 — Agregar un archivo

Vincula el adjunto a la comunicación:

- **ID de la comunicación (communicationId)**.
- **Nombre del archivo (fileName)**.
- **URL del archivo (fileUrl)**: enlace al documento.
- **Tipo de archivo (fileType)** (opcional): PDF, imagen, etc.
- **Tamaño del archivo (fileSize)** (opcional, en bytes).
- **Subido por (uploadedBy)** (opcional).

### Paso 3 — Guardar

El archivo queda asociado al comunicado. Los destinatarios pueden descargarlo desde el mensaje.

---

## Flujo principal — Usar plantillas

### Paso 1 — Acceder a "Plantillas"

Toca la tarjeta **"Plantillas"**.

### Paso 2 — Crear una plantilla

Calidad y Gerencia pueden definir modelos reutilizables para comunicados frecuentes:

- **Título** de la plantilla.
- **Cuerpo predefinido** con campos variables.
- **Canal sugerido**.
- **Destinatario sugerido** (rol o departamento).

### Paso 3 — Aplicar la plantilla

Al crear una nueva comunicación, selecciona la plantilla para pre-cargar el contenido y ahorrar tiempo.

---

## Flujo principal — Confirmar lectura (usuarios)

### Paso 1 — Recibir la comunicación

Los usuarios con acceso ven el comunicado en su bandeja o en el portal.

### Paso 2 — Marcar como leído

Toca **"Marcar como leído"** o la opción equivalente en el mensaje.

### Paso 3 — Verificar acuse

Calidad y Gerencia pueden consultar los registros de lectura para confirmar quiénes vieron el comunicado y quiénes no.

---

## Flujo principal — Cambiar el estado de una comunicación (Calidad)

### Paso 1 — Seleccionar el flujo

Puedes transicionar los siguientes flujos:
- `communications`
- `recipients`
- `attachments`
- `templates`

### Paso 2 — Definir la transición

Indica el estado destino y notas de justificación.

### Paso 3 — Confirmar

El sistema valida la transición y actualiza el estado.

---

## Preguntas frecuentes

**[Un destinatario no recibió el comunicado]**

Verifica que el canal seleccionado esté operativo. También revisa que el destinatario esté correctamente asignado por rol, departamento o usuario. Si no hay acuse de recibo, reenvía por un canal alternativo.

**[Puedo editar una comunicación ya enviada]**

El sistema permite transiciones de estado, pero editar un comunicado enviado puede requerir crear una aclaración o un nuevo comunicado. Consulta a Calidad.

**[Las plantillas no aparecen en la lista]**

Asegúrate de que hayas creado la plantilla con el rol `calidad` o `gerencia` y que esté publicada.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Emitir un aviso oficial | Ve a "Comunicaciones" → crea el comunicado y envía |
| Enviar a un rol completo | Ve a "Destinatarios" → asigna por `role` |
| Adjuntar un documento | Ve a "Adjuntos" → vincula el archivo |
| Reutilizar un modelo | Ve a "Plantillas" → selecciona la plantilla |
| Saber quién leyó el mensaje | Ve a "Destinatarios" → consulta estado de lectura |
