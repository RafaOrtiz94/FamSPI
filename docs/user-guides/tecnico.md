# Guía de uso — Técnico (Operaciones de Servicio)

> **Para quién es esta guía:** Técnicos y jefes técnicos que participan en flujos operativos vinculados a solicitudes y servicio.

---

## ¿Para qué sirve este submódulo?

El submódulo **Técnico** actúa como un **alias o wrapper** que expone rutas específicas para el rol técnico, delegando la lógica al controller de `requests`. Su función es permitir que técnicos y jefes técnicos interactúen con solicitudes usando endpoints propios del área técnica, sin cambiar el comportamiento del módulo general de solicitudes.

Endpoints conocidos:
- `POST /:id/complete` — completar una solicitud en curso (middleware `isOperaciones`).

Esto indica que existe al menos una operación dedicada al cierre o finalización de solicitudes por parte del área técnica.

---

## ¿Quién puede usarlo?

| Rol o perfil | Acción |
|---|---|
| Técnicos habilitados por `isOperaciones` | Completar solicitudes |

> La validación concreta depende del middleware `isOperaciones` definido en `auth.middleware.js`.

---

## Pantalla principal

No confirmada. El flujo probablemente se ejecuta desde:
- Módulo de **Servicio Técnico**.
- Módulo de **Solicitudes**.

---

## Flujo principal — Completar una solicitud

### Paso 1 — Recibir la solicitud

La solicitud debe estar asignada al área técnica y pendiente de cierre.

### Paso 2 — Completar la solicitud

Envía la acción de completado por el endpoint correspondiente del área técnica.

### Paso 3 — Confirmar cierre

El sistema actualiza el estado de la solicitud al estado final.

---

## Preguntas frecuentes

**[No encuentro la opción de completar la solicitud]**

El acceso está vinculado al rol técnico y al estado actual de la solicitud. Si no aparece, verifica que la solicitud esté en un estado que permita la acción.

**[Puedo completar solicitudes de otras áreas]**

No. El endpoint está pensado para solicitudes del flujo técnico.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Cerrar una solicitud técnica | Completa la solicitud desde el flujo de Servicio Técnico |
