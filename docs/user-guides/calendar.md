# Guía de uso — Calendario (servicio interno)

> **Para quién es esta guía:** Usuarios indirectos del sistema: cualquier módulo que necesite validar feriados, días hábiles, disponibilidad o rangos de fechas.

---

## ¿Para qué sirve este módulo?

Este módulo **no es un workspace de usuario final**. Es un **servicio interno compartido** que otras áreas del sistema consultan para operaciones temporales.

Funcionalidades clave:
- Cálculo de **días hábiles** (para permisos, vacaciones, capacitaciones).
- Validación de **feriados** nacionales o locales.
- Cálculo de disponibilidad temporal.
- Apoyo a `schedules`, `attendance`, `permisos`, `vacaciones`.

No tiene endpoints HTTP propios ni pantalla frontend. Su única pieza visible es el archivo `calendar.service.js`.

---

## ¿Quién puede usarlo?

| Rol | Acceso |
|---|---|
| Cualquier rol | Indirecto, a través de otros módulos |

> No se accede directamente desde un menú. Lo usan otros módulos en segundo plano.

---

## Flujos indirectos comunes

Cuando un usuario completa formularios en otros módulos, el sistema consulta este servicio para:
- Saber si una fecha cae en feriado.
- Calcular la duración real de una solicitud (descontando fines de semana y feriados).
- Validar disponibilidad de técnicos o salas.

---

## Preguntas frecuentes

**[Por qué mi solicitud de vacaciones duró menos días de los solicitados]**

Porque el sistema calculó los días hábiles descontando feriados y fines de semana usando este servicio.

**[El sistema no reconoce un feriado]**

Verifica que esté cargado en el complemento de feriados del módulo `security` (`holidays.ec.js`). El calendario solo procesa lo que ese archivo provee.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Entender por qué una fecha no se cuenta | Revisa si es feriado o fin de semana |
| Revisar lógica de días hábiles | Consulta el módulo que calculó el valor (permisos, vacaciones, etc.) |
