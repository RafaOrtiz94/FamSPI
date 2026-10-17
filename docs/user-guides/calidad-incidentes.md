# Guía de uso — Incidentes y Derrames (CA-01-11)

> **Para quién es esta guía:** Personal de Calidad, Gerencia, Servicio Técnico y Operaciones que registra, contiene, limpia y documenta incidentes y derrames en las instalaciones.

---

## ¿Para qué sirve este submódulo?

Este submódulo gestiona el tratamiento de **incidentes y derrames** que ocurren en las instalaciones de la empresa: derrames de productos químicos, fallas de equipos, incendios, fugas, eventos de seguridad o cualquier evento que genere un riesgo para la calidad, la seguridad o el medio ambiente.

El objetivo es registrar el incidente, tomar acciones inmediatas de contención, manejar materiales peligrosos si los hay, ejecutar la limpieza correspondiente y dejar toda la trazabilidad para análisis posteriores.

El flujo incluye:

1. **Incidentes**: registro formal del evento.
2. **Contención**: acciones inmediatas para controlar el daño.
3. **Limpieza**: tareas de saneamiento y restauración del área.
4. **Materiales**: registro de sustancias peligrosas involucradas.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Acceso completo: registrar incidentes, acciones de contención, limpieza y materiales peligrosos |
| Gerencia | Registrar incidentes, acciones de contención, limpieza y materiales peligrosos |

> Solo Calidad puede cambiar los estados del workflow de incidentes.

---

## Pantalla principal

La pantalla se llama **"Manejo de Derrames e Incidentes"** y muestra:

- Tarjeta de título con ícono de alerta.
- Subtítulo: *"Sistema de gestión de incidentes y derrames GXP."*
- Cuatro tarjetas de resumen:
  - Flujos activos.
  - RBAC privado.
  - Trazabilidad GXP.
  - Manejo de derrames.
- Cuatro **tarjetas de flujo**:
  1. **Incidentes**: registro del evento.
  2. **Contención**: acciones inmediatas de control.
  3. **Limpieza**: saneamiento del área.
  4. **Materiales**: registro de sustancias peligrosas.

---

## Flujo principal — Registrar un incidente

### Paso 1 — Acceder a "Incidentes"

Toca la tarjeta **"Incidentes"**.

### Paso 2 — Completar el registro

Debes ingresar:

- **Tipo de incidente**:
  - `spill` (derrame de líquido o sustancia).
  - `fire` (incendio).
  - `security` (evento de seguridad).
  - `equipment_failure` (falla de equipo).
  - `environmental` (incidente ambiental).
  - `other` (otro).
- **Severidad**:
  - `low` (bajo).
  - `medium` (medio).
  - `high` (alto).
  - `critical` (crítico).
- **Título**: nombre descriptivo del incidente.
- **Descripción**: detalle de lo ocurrido.
- **Ubicación (location)** (opcional): dónde ocurrió.
- **Reportado por (reportedBy)** (opcional): quién lo reportó.

### Paso 3 — Guardar

El incidente queda registrado con un ID. A partir de ahí, puedes agregar las acciones de contención, limpieza y materiales asociados.

---

## Flujo principal — Registrar acciones de contención

### Paso 1 — Acceder a "Contención"

Toca la tarjeta **"Contención"**.

### Paso 2 — Registrar la acción

Vincula la acción al incidente:

- **ID del incidente (incidentId)**.
- **Descripción de la acción (actionDescription)**: qué se hizo para contener el daño (ejemplo: "Se cerró la válvula de suministro", "Se colocó barrera de contención").
- **Responsable (responsibleId)** (opcional): quién ejecutó la acción.

### Paso 3 — Guardar

Queda registrada la acción de contención con su responsable y descripción.

---

## Flujo principal — Registrar materiales peligrosos involucrados

### Paso 1 — Acceder a "Materiales"

Toca la tarjeta **"Materiales"**.

### Paso 2 — Registrar cada sustancia

Completa:

- **ID del incidente (incidentId)**.
- **Nombre del material (materialName)**: ejemplo: "Ácido sulfúrico", "Gas refrigerante R-404A".
- **Cantidad (quantity)** (opcional).
- **Unidad (unit)** (opcional): litros, kilos, etc.
- **Número CAS (casNumber)** (opcional): identificador químico internacional.
- **Clase de peligro (hazardClass)** (opcional): según normativa de materiales peligrosos.

### Paso 3 — Guardar

Cada material peligroso queda asociado al incidente. Esto es clave para informes ambientales, de seguridad y para el personal de limpieza que manipula estas sustancias.

---

## Flujo principal — Registrar acciones de limpieza

### Paso 1 — Acceder a "Limpieza"

Toca la tarjeta **"Limpieza"**.

### Paso 2 — Registrar la tarea

Vincula la limpieza al incidente:

- **ID del incidente (incidentId)**.
- **Descripción de la acción de limpieza**: qué se limpió, con qué productos, en qué área.
- **Responsable (responsibleId)** (opcional).

### Paso 3 — Guardar

La acción de limpieza queda registrada.

---

## Flujo principal — Cerrar el incidente (Calidad)

### Paso 1 — Verificar que todas las etapas estén completas

Asegúrate de que:
- El incidente esté registrado con tipo, severidad y descripción.
- Las acciones de contención estén documentadas.
- Los materiales peligrosos estén inventariados.
- Las tareas de limpieza estén completadas.

### Paso 2 — Transicionar el estado del workflow

Calidad cambia el estado del incidente para cerrarlo formalmente.

### Paso 3 — Confirmar

El incidente queda cerrado en el sistema.

---

## Preguntas frecuentes

**[El incidente involucró varios materiales peligrosos]**

Registra cada uno individualmente en la sección de **Materiales**. No los agrupes en un solo registro; cada sustancia debe estar identificada por separado.

**[La acción de contención no fue suficiente]**

Registra una segunda acción de contención con la descripción del problema encontrado. El sistema mantiene el historial completo de todas las acciones aplicadas.

**[Necesito informar a una autoridad externa]**

Si el incidente requiere notificación a entidades regulatorias o de seguridad, registra la comunicación correspondiente y conserva la evidencia del envío.

**[Un derrame ocurrió en un área de producción activa]**

Registra la ubicación exacta y la severidad como `critical` si el producto en proceso fue afectado. Evalúa si debes activar el flujo de **Recall (CA-01-06)** si el producto contaminado pudo haber sido distribuido.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Registrar un derrame o incidente | Ve a "Incidentes" → tipo, severidad, ubicación, descripción |
| Documentar la contención | Ve a "Contención" → describe la acción y responsable |
| Registrar materiales peligrosos | Ve a "Materiales" → nombre, cantidad, clase de peligro |
| Registrar la limpieza | Ve a "Limpieza" → describe las tareas realizadas |
| Cerrar el caso | Cambia el estado del workflow (solo Calidad) |
