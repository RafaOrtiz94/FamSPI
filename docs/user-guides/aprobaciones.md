# Guía de uso — Aprobaciones

> **Para quién es esta guía:** Jefes de servicio técnico, jefes técnicos, gerencia, calidad y técnicos que revisa solicitudes pendientes y las aprueba o rechaza.

---

## ¿Para qué sirve este módulo?

Este módulo es un **intermediario genérico de aprobaciones**. Su propósito es centralizar la revisión y decisión sobre solicitudes que necesitan validación jerárquica antes de continuar su flujo (mantenimientos, salidas, compras, etc.).

Solo tiene tres acciones documentadas:
- **Ver pendientes**: listado de solicitudes esperando aprobación.
- **Aprobar**: el jefe valida y autoriza la solicitud.
- **Rechazar**: el jefe deniega la solicitud con motivo.

---

## ¿Quién puede usarlo?

| Rol o perfil | Acceso |
|---|---|
| `tecnico`, `gerencia`, `calidad`, `jefe_calidad`, `jefe_servicio_tecnico`, `jefe_tecnico` | **Ver** solicitudes pendientes |
| `jefe_servicio_tecnico`, `jefe_tecnico` | **Aprobar / Rechazar** |

> Aprobar y rechazar está reservado exclusivamente a jefes de servicio técnico.

---

## Pantalla principal

Ruta: `/dashboard/servicio-tecnico/aprobaciones` → `ServicioAprobaciones`.

---

## Flujo principal — Revisar pendientes

### Paso 1 — Acceder al panel de aprobaciones

Ve a **"Aprobaciones"** desde el área de Servicio Técnico.

### Paso 2 — Revisar la lista de pendientes

El sistema muestra las solicitudes que esperan tu aprobación.

### Paso 3 — Evaluar la solicitud

Para cada solicitud, revisa:
- Tipo de solicitud.
- Datos del solicitante.
- Motivo o justificación.
- Detalles operativos (equipo, lugar, fecha, etc.).

---

## Flujo principal — Aprobar una solicitud

### Paso 1 — Seleccionar la solicitud

Toca el botón **"Aprobar"** o el equivalente.

### Paso 2 — Confirmar

Confirma la aprobación. El sistema actualiza el estado de la solicitud y permite que continúe su flujo normal.

---

## Flujo principal — Rechazar una solicitud

### Paso 1 — Seleccionar la solicitud

Toca **"Rechazar"**.

### Paso 2 -- Registrar el motivo (si aplica)

Agrega la razón del rechazo para que el solicitante pueda corregir o reconsiderar.

### Paso 3 — Confirmar

El sistema cambia el estado a rechazado.

---

## Preguntas frecuentes

**[No veo la solicitud en pendientes]**

Verifica que la solicitud esté efectivamente en estado "pendiente de aprobación". Si ya fue aprobada o rechazada, saldrá del listado.

**[Soy jefe técnico pero no puedo aprobar]**

Asegúrate de tener el rol exacto requerido (`jefe_servicio_tecnico` o `jefe_tecnico`). Roles similares pero distintos no tendrán permiso de escritura.

**[El sistema muestra error al rechazar]**

Verifica que el ID de la solicitud sea correcto. El servicio delega la lógica a `approvals.service.js`, que valida la transición.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Ver solicitudes pendientes | Ve a "Aprobaciones" → listado |
| Aprobar una solicitud | Toca "Aprobar" en la solicitud |
| Rechazar una solicitud | Toca "Rechazar" y registra el motivo |
