# Guía de uso — Operaciones

> **Para quién es esta guía:** Personal del rol de Operaciones que completa solicitudes en curso.

---

## ¿Para qué sirve este submódulo?

Este submódulo es un **wrapper mínimo** que permite al rol de Operaciones completar solicitudes provenientes del módulo `requests`. No es un sistema independiente: externaliza la acción `completeRequest` desde el controller de `requests`.

Su único flujo documentado es:
- Recibir una solicitud en curso.
- Completar la acción requerida por Operaciones.
- Cerrar o avanzar la solicitud.

---

## ¿Quién puede usarlo?

| Rol o perfil | Acción permitida |
|---|---|
| Operaciones (`isOperaciones`) | Completar solicitudes (`POST /:id/complete`) |

> Solo accesible para usuarios autenticados con el middleware `isOperaciones`.

---

## Flujo principal — Completar una solicitud

### Paso 1 — Recibir la solicitud

La solicitud debe estar en un estado que permita ser completada por Operaciones.

### Paso 2 — Acceder al endpoint de cierre

El flujo envía un `POST` al endpoint del módulo con el ID de la solicitud.

### Paso 3 — Confirmar

El controller de `requests` procesa la finalización y actualiza el estado de la solicitud.

---

## Estado actual

> **Importante:** Este módulo no cuenta con un workspace frontend propio confirmado en `registerRoutes.js` y su ruta depende de cómo esté montado en el router global. Si no ves la opción en el menú, probablemente el flujo se maneje directamente desde el módulo **Solicitudes** o **Dashboard** con roles de Operaciones.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Completar una solicitud asignada a Operaciones | Accede desde el flujo de Solicitudes con tu rol de Operaciones |
