# Guía de uso — Tecnovigilancia (CA-01-17)

> **Para quién es esta guía:** Personal de Calidad y Gerencia que registra, investiga y gestiona incidentes relacionados con dispositivos médicos o tecnología sanitaria.

---

## ¿Para qué sirve este submódulo?

Este submódulo gestiona el sistema de **tecnovigilancia** de la empresa: el proceso de detectar, registrar, investigar y notificar incidentes, fallos o eventos adversos relacionados con **dispositivos médicos, equipamientos sanitarios o tecnología de salud** utilizada en la operación.

Su objetivo es:
- Capturar eventos que comprometan la seguridad del paciente o del operador.
- Investigar la causa raíz del incidente.
- Aplicar acciones correctivas o preventivas.
- Notificar a autoridades sanitarias cuando corresponda.

El flujo incluye:

1. **Reportes**: registro del evento adverso o fallo del dispositivo.
2. **Investigaciones**: análisis de la causa del incidente.
3. **Acciones correctivas**: medidas para evitar que se repita.
4. **Notificaciones**: envío de información a entidades regulatorias.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Acceso completo: crear reportes, investigaciones, acciones correctivas y transicionar estados |
| Gerencia | Acceso completo |

---

## Pantalla principal

La pantalla se llama **"Tecnovigilancia"** y muestra:

- Tarjeta de título con ícono de alerta.
- Subtítulo: *"Sistema de tecnovigilancia GXP."*
- Cuatro **tarjetas de flujo**:
  1. **Reportes**: registro de incidentes con dispositivos.
  2. **Investigaciones**: análisis y responsables asignados.
  3. **Acciones**: acciones correctivas derivadas.
  4. **Notificaciones**: envío a autoridades sanitarias.

---

## Flujo principal — Crear un reporte de tecnovigilancia

### Paso 1 — Acceder a "Reportes"

Toca la tarjeta **"Reportes"**.

### Paso 2 — Completar el reporte

Debes registrar:

- **Número de reporte (reportNumber)**: identificador único del evento.
- **Nombre del dispositivo (deviceName)**: equipo o dispositivo involucrado.
- **Modelo del dispositivo (deviceModel)** (opcional).
- **Número de serie (serialNumber)** (opcional).
- **Tipo de incidente (incidentType)**:
  - `malfunction` (fallo de funcionamiento).
  - `adverse_event` (evento adverso).
  - `near_miss` (cuasi accidente / incidente potencial).
  - `recall` (retiro del mercado relacionado).
  - `other` (otro).
- **Severidad**:
  - `low` (bajo).
  - `moderate` (moderado).
  - `serious` (grave).
  - `critical` (crítico).
- **Descripción (description)** (opcional): detalle de lo ocurrido.
- **Reportado por (reportedBy)** (opcional).

### Paso 3 — Guardar

El reporte queda registrado y disponible para asociarle una investigación.

---

## Flujo principal — Iniciar una investigación

### Paso 1 — Acceder a "Investigaciones"

Toca la tarjeta **"Investigaciones"**.

### Paso 2 — Crear la investigación

Vincula la investigación al reporte:

- **ID del reporte (reportId)**.
- **Investigador asignado (investigatorId)** (opcional): quién lleva la investigación.

### Paso 3 — Guardar

Queda registrada la apertura de la investigación. A partir de ahí, se documentan hallazgos y se derivan acciones correctivas.

---

## Flujo principal — Definir acciones correctivas

### Paso 1 — Acceder a "Acciones"

Toca la tarjeta **"Acciones"**.

### Paso 2 — Registrar la acción

Vincula la acción a la investigación:

- **ID de la investigación (investigationId)**.
- **Descripción de la acción (actionDescription)**: qué se hará para corregir o prevenir el incidente.
- **Responsable (responsibleId)** (opcional): quién ejecuta la acción.
- **Fecha límite (targetDate)** (opcional): cuándo debe estar completada.

### Paso 3 — Guardar

Queda registrada la acción correctiva.

---

## Flujo principal — Notificar a autoridades sanitarias

### Paso 1 — Acceder a "Notificaciones"

Toca la tarjeta **"Notificaciones"**.

### Paso 2 — Registrar la notificación

Vincular la notificación al reporte de tecnovigilancia y definir:

- **Destinatario**: autoridad sanitaria correspondiente.
- **Forma de envío**: correo, plataforma regulatoria, etc.
- **Fecha de envío**.
- **Acuse de recibo o confirmación** (si aplica).

### Paso 3 — Guardar

Queda registrada la notificación para trazabilidad regulatoria.

---

## Flujo principal — Cerrar el reporte (Calidad)

### Paso 1 — Verificar que todas las etapas estén completas

Asegúrate de que:
- El reporte esté documentado con dispositivo, tipo y severidad.
- La investigación esté abierta y con responsable asignado.
- Las acciones correctivas estén registradas con fecha límite.
- Las notificaciones regulatorias estén enviadas (si aplica).

### Paso 2 — Transicionar el estado del reporte

Cambia el estado del reporte para cerrarlo formalmente.

### Paso 3 — Confirmar

Queda registrado el cierre del reporte.

---

## Preguntas frecuentes

**[Qué diferencia hay entre "near_miss" y "adverse_event"]**

Un `near_miss` es un evento que pudo haber causado daño pero no lo hizo (ejemplo: una máquina se detuvo justo antes de contactar con el operador). Un `adverse_event` es un evento que sí generó daño o lesión al paciente o al operador.

**[El dispositivo involucrado no tiene número de serie]**

Puedes registrar el reporte sin número de serie. Agrega la mayor información disponible (modelo, nombre, ubicación) para facilitar la trazabilidad.

**[Debo notificar a la autoridad en todos los casos]**

No. Las notificaciones regulatorias se realizan según la severidad y normativa aplicable. Consulta con Calidad o el área regulatoria para definir cuándo es obligatorio notificar.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Registrar un incidente con un dispositivo | Ve a "Reportes" → completa tipo, severidad y descripción |
| Investigar la causa del incidente | Ve a "Investigaciones" → asigna investigador |
| Definir acciones correctivas | Ve a "Acciones" → registra responsable y fecha |
| Notificar a la autoridad sanitaria | Ve a "Notificaciones" → registra envío y acuse |
| Cerrar el reporte | Cambia el estado del reporte (solo Calidad) |
