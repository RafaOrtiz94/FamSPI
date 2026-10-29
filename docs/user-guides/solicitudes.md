# Guía de uso — Solicitudes

> **Para quién es esta guía:** Personal comercial, backoffice comercial, calidad y gerencia que gestiona trámites internos y registros de nuevos clientes.

---

## ¿Para qué sirve este módulo?

Este módulo gestiona dos tipos de solicitudes:

1. **Solicitudes generales del área comercial**: trámites internos generados por el equipo comercial o sus jefaturas (por ejemplo, solicitudes de soporte, recursos o gestiones varias).
2. **Solicitudes de nuevos clientes**: el flujo completo para registrar una cuenta de cliente nuevo en el sistema, que incluye envío de consentimiento de datos (LOPDP), carga de documentos legales, revisión de calidad y procesamiento final por backoffice.

Ambos flujos usan el mismo motor de solicitudes, pero tienen reglas y pasos distintos.

---

## ¿Quién puede usarlo?

### Solicitudes generales

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Jefe comercial | Crear, editar, cancelar, reenviar solicitudes |
| Comercial | Crear y consultar solicitudes |
| Backoffice comercial | Consultar y procesar solicitudes |
| ACP comercial | Consultar solicitudes |
| Analista comercial | Consultar solicitudes |
| Gerencia | Consultar todas las solicitudes |
| Calidad / jefe de calidad | Participar en revisión de solicitudes de clientes |

### Solicitudes de nuevos clientes

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Comercial | Crear solicitud de cliente, enviar token de consentimiento |
| Backoffice comercial | Procesar (aprobar/rechazar) solicitudes de cliente |
| Calidad / jefe de calidad | Completar checklist de calidad |
| Gerencia | Ver resumen y estado de solicitudes de clientes |
| TI / jefe de TI | Acceso para soporte |

---

## Pantalla principal

La pantalla principal de solicitudes generales está en **"Solicitudes"** dentro del área Comercial.

Para solicitudes de nuevos clientes, el backoffice accede desde **"Solicitudes de clientes"** en la sección de backoffice.

### ¿Qué significa cada estado?

| Estado | Qué significa |
|---|---|
| **Borrador / Pendiente** | La solicitud fue creada pero no enviada formalmente |
| **Enviada / En revisión** | Esperando que el responsable correspondiente la revise |
| **Aprobada** | La solicitud pasó la revisión y puede continuar |
| **Rechazada** | No cumplió con los requisitos; debe corregirse y reenviarse |
| **Procesada** | Backoffice terminó la gestión y el trámite está cerrado |
| **Cancelada** | El jefe comercial la canceló |

---

## Flujo 1 — Crear una solicitud general

### Paso 1 — Ingresar a "Solicitudes"

En el área Comercial, busca la sección **"Solicitudes"**.

### Paso 2 — Tocar "Nueva solicitud" o "+"

Busca el botón con el signo **"+"** o el texto **"Nueva solicitud"**.

### Paso 3 — Completar el formulario

Llena los campos de la solicitud:

- **Tipo o motivo**: indica por qué haces la solicitud.
- **Descripción**: explica detalladamente lo que necesitas.
- **Destinatario**: selecciona el área o persona que debe revisarla.

Si el sistema lo pide, adjunta archivos relevantes (cotizaciones, reportes, imágenes).

### Paso 4 — Enviar

Toca **"Enviar"** o **"Crear solicitud"**. El sistema notifica al jefe o área correspondiente para que la revise.

---

## Flujo 1 — Reenviar una solicitud rechazada

Si tu solicitud fue rechazada:

### Paso 1 — Abrir la solicitud rechazada

En la lista, busca la solicitud con estado **"Rechazada"** y tócala.

### Paso 2 — Revisar el motivo

Lee la justificación que escribió quien la rechazó.

### Paso 3 — Corregir

Modifica los campos necesarios (descripción, archivos, datos) para solucionar el problema señalado.

### Paso 4 — Reenviar

Toca **"Reenviar"** o **"Enviar de nuevo"**. Solo el jefe comercial puede hacer este paso. La solicitud vuelve a la bandeja de aprobaciones.

---

## Flujo 1 — Cancelar una solicitud

Si ya no necesitas la solicitud:

### Paso 1 — Seleccionar la solicitud

Toca la solicitud en la lista.

### Paso 2 — Tocar "Cancelar"

Busca el botón **"Cancelar"**.

### Paso 3 — Confirmar

Confirma la cancelación. El estado pasa a **"Cancelada"** y el sistema notifica a los involucrados.

> **Nota:** Solo el jefe comercial puede cancelar solicitudes generales.

---

## Flujo 2 — Registrar un nuevo cliente (LOPDP)

Este flujo tiene más pasos porque involucra validez legal y revisión de calidad.

### Paso 1 — Enviar el token de consentimiento

Antes de crear la solicitud, el comercial debe enviar al cliente un token de aceptación de protección de datos personales (LOPDP).

1. En el módulo de solicitudes de nuevo cliente, toca **"Nueva solicitud de cliente"**.
2. Ingresa el correo del cliente.
3. Toca **"Enviar token de consentimiento"**.
4. El sistema envía un correo al cliente con un enlace único para que acepte el tratamiento de datos.

### Paso 2 — Esperar la aceptación del cliente

El cliente debe ingresar al enlace del correo y aceptar el aviso de privacidad. Mientras tanto, la solicitud queda en espera.

### Paso 3 — Crear la solicitud con documentos

Una vez que el cliente aceptó:

1. Completa los datos del cliente (razón social, RUC, representante legal, etc.).
2. Adjunta los documentos legales requeridos:
   - Nombramiento del representante legal.
   - RUC o identificación fiscal.
   - Cédula o documento de identidad.
   - Certificación de cumplimiento de BPA/DT.
   - Permiso de operación.
   - Evidencia del consentimiento firmado.
3. Toca **"Crear solicitud de cliente"**.

### Paso 4 — Revisión de calidad

Calidad revisa la solicitud y completa el **checklist de aprobación**:
- Verifica que los documentos estén completos.
- Valida que cumplan con los estándares del negocio.
- Marca cada ítem como aprobado o rechazado.

### Paso 5 — Procesamiento por backoffice

Backoffice toma la decisión final:
- Si todo está bien, **aprueba** la solicitud y se crea el cliente en el sistema.
- Si falta algo, **rechaza** con observaciones específicas para que el comercial corrija.

### Paso 6 — Notificación

El sistema avisa automáticamente al comercial y al cliente sobre el resultado.

---

## Flujo 2 — Consultar el resumen de solicitudes de cliente

Backoffice o gerencia pueden ver un resumen consolidado:

### Paso 1 — Ir al resumen

En la sección de backoffice, toca **"Resumen de solicitudes de cliente"**.

### Paso 2 — Revisar métricas

Verás cuántas solicitudes están en cada estado, cuántas esperan revisión de calidad y cuántas fueron aprobadas en el período.

---

## Preguntas frecuentes

**[El cliente dice que no recibió el correo del token]**

Verifica que el correo esté bien escrito. Puedes reenviar el token desde el sistema. Pide al cliente que revise la bandeja de spam.

**[Subí un documento equivocado en la solicitud de cliente]**

Mientras la solicitud esté en borrador o pendiente, puedes actualizarla y reemplazar el archivo. Si ya fue aprobada por calidad, contacta a ese área para que invaliden el checklist y puedas corregir.

**[No veo la opción de reenviar]**

Solo el jefe comercial tiene permiso para reenviar solicitudes generales. Si necesitas hacerlo y no tienes acceso, solicita a tu jefe que lo haga.

**[Calidad marcó un ítem como rechazado]**

Revisa el checklist detallado. Cada ítem rechazado tiene una observación. Corrige el documento o dato señalado y solicita a calidad que revise de nuevo.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Crear una solicitud interna | Ve a "Solicitudes" → "+" |
| Registrar un nuevo cliente | Ve a "Solicitudes de cliente" → enviar token LOPDP primero |
| Reenviar una solicitud rechazada | Abre la solicitud → "Reenviar" (solo jefe) |
| Cancelar una solicitud | Abre la solicitud → "Cancelar" (solo jefe) |
| Ver el estado de solicitudes de cliente | Ve al resumen de backoffice |
